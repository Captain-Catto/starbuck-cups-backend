import { Request, Response } from "express";
import { PrismaClient } from "../generated/prisma";
import { ResponseHelper } from "../types/api";
import { z } from "zod";

const prisma = new PrismaClient();

// Validation schemas
const createCustomerSchema = z.object({
  messengerId: z.string().nullable().optional(),
  zaloId: z.string().nullable().optional(),
  fullName: z.string().min(1, "Full name is required"),
  phone: z.string().min(1, "Phone number is required"),
  notes: z.string().nullable().optional(),
  isVip: z.boolean().optional(),
  address: z
    .object({
      addressLine: z.string().min(1, "Address line is required"),
      ward: z.string().nullable().optional(),
      district: z.string().nullable().optional(),
      city: z.string().min(1, "City is required"),
      postalCode: z.string().nullable().optional(),
      isDefault: z.boolean().optional(),
    })
    .optional(),
});

const updateCustomerSchema = z.object({
  messengerId: z.string().nullable().optional(),
  zaloId: z.string().nullable().optional(),
  fullName: z.string().optional(),
  phone: z.string().optional(),
  notes: z.string().optional(),
  isVip: z.boolean().optional(),
});

const createAddressSchema = z.object({
  addressLine: z.string().min(1, "Address line is required"),
  ward: z.string().optional(),
  district: z.string().optional(),
  city: z.string().min(1, "City is required"),
  postalCode: z.string().optional(),
  isDefault: z.boolean().optional(),
});

/**
 * Get all customers with pagination
 */
export const getCustomers = async (req: Request, res: Response) => {
  try {
    const {
      page = "1",
      limit = "20",
      search = "",
      active = "all",
      vipStatus = "all",
      dateFrom,
      dateTo,
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    const where: any = {};

    if (search) {
      where.OR = [
        { fullName: { contains: search as string, mode: "insensitive" } },
        { phone: { contains: search as string, mode: "insensitive" } },
        { messengerId: { contains: search as string, mode: "insensitive" } },
        {
          addresses: {
            some: {
              OR: [
                {
                  addressLine: {
                    contains: search as string,
                    mode: "insensitive",
                  },
                },
                { city: { contains: search as string, mode: "insensitive" } },
                {
                  district: { contains: search as string, mode: "insensitive" },
                },
                { ward: { contains: search as string, mode: "insensitive" } },
              ],
            },
          },
        },
      ];
    }

    // VIP status filtering
    if (vipStatus && vipStatus !== "all") {
      if (vipStatus === "vip") {
        where.isVip = true;
      } else if (vipStatus === "regular") {
        where.isVip = false;
      }
    }

    // Date filtering
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) {
        where.createdAt.gte = new Date(dateFrom as string);
      }
      if (dateTo) {
        // Add one day to include the end date
        const endDate = new Date(dateTo as string);
        endDate.setDate(endDate.getDate() + 1);
        where.createdAt.lt = endDate;
      }
    }

    const [customers, totalCount] = await Promise.all([
      prisma.customer.findMany({
        where,
        include: {
          createdByAdmin: {
            select: { username: true, email: true },
          },
          addresses: {
            orderBy: { isDefault: "desc" },
          },
          orders: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              createdAt: true,
            },
          },
          _count: {
            select: {
              orders: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: offset,
        take: limitNum,
      }),
      prisma.customer.count({ where }),
    ]);

    const totalPages = Math.ceil(totalCount / limitNum);

    // Add lastOrderDate to each customer
    const customersWithLastOrderDate = customers.map((customer) => ({
      ...customer,
      lastOrderDate:
        customer.orders.length > 0 ? customer.orders[0].createdAt : null,
    }));

    return res.status(200).json(
      ResponseHelper.paginated(customersWithLastOrderDate, {
        current_page: pageNum,
        per_page: limitNum,
        total_pages: totalPages,
        total_items: totalCount,
        has_next: pageNum < totalPages,
        has_prev: pageNum > 1,
      })
    );
  } catch (error) {
    console.error("Get customers error:", error);
    return res
      .status(500)
      .json(
        ResponseHelper.error(
          "Failed to retrieve customers",
          "GET_CUSTOMERS_ERROR"
        )
      );
  }
};

/**
 * Get customer by ID
 */
export const getCustomerById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        createdByAdmin: {
          select: { username: true, email: true },
        },
        addresses: {
          orderBy: { isDefault: "desc" },
        },
        orders: {
          include: {
            items: {
              include: {
                product: {
                  select: { name: true, slug: true },
                },
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        _count: {
          select: {
            orders: true,
          },
        },
      },
    });

    if (!customer) {
      return res
        .status(404)
        .json(ResponseHelper.error("Customer not found", "CUSTOMER_NOT_FOUND"));
    }

    return res.status(200).json(ResponseHelper.success(customer));
  } catch (error) {
    console.error("Get customer error:", error);
    return res
      .status(500)
      .json(
        ResponseHelper.error(
          "Failed to retrieve customer",
          "GET_CUSTOMER_ERROR"
        )
      );
  }
};

/**
 * Create new customer
 */
export const createCustomer = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res
        .status(401)
        .json(ResponseHelper.error("Authentication required", "UNAUTHORIZED"));
    }

    // Validate input
    const validationResult = createCustomerSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res
        .status(400)
        .json(
          ResponseHelper.error(
            "Validation failed",
            "VALIDATION_ERROR",
            validationResult.error.issues
          )
        );
    }

    const { messengerId, zaloId, fullName, phone, notes, isVip, address } =
      validationResult.data;

    // Create customer with address in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.create({
        data: {
          messengerId,
          zaloId,
          fullName,
          phone,
          notes,
          isVip: isVip || false,
          createdByAdminId: req.user!.userId,
        },
        include: {
          createdByAdmin: {
            select: { username: true, email: true },
          },
        },
      });

      // Create address if provided
      if (address) {
        await tx.customerAddress.create({
          data: {
            customerId: customer.id,
            addressLine: address.addressLine,
            ward: address.ward,
            district: address.district,
            city: address.city,
            postalCode: address.postalCode,
            isDefault: address.isDefault ?? true,
          },
        });
      }

      // Return customer with addresses
      return await tx.customer.findUnique({
        where: { id: customer.id },
        include: {
          createdByAdmin: {
            select: { username: true, email: true },
          },
          addresses: true,
        },
      });
    });

    return res.status(201).json(ResponseHelper.success(result));
  } catch (error) {
    console.error("Create customer error:", error);
    return res
      .status(500)
      .json(
        ResponseHelper.error(
          "Failed to create customer",
          "CREATE_CUSTOMER_ERROR"
        )
      );
  }
};

/**
 * Update customer
 */
export const updateCustomer = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res
        .status(401)
        .json(ResponseHelper.error("Authentication required", "UNAUTHORIZED"));
    }

    const { id } = req.params;

    // Validate input
    const validationResult = updateCustomerSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res
        .status(400)
        .json(
          ResponseHelper.error(
            "Validation failed",
            "VALIDATION_ERROR",
            validationResult.error.issues
          )
        );
    }

    // Check if customer exists
    const existingCustomer = await prisma.customer.findUnique({
      where: { id },
    });

    if (!existingCustomer) {
      return res
        .status(404)
        .json(ResponseHelper.error("Customer not found", "CUSTOMER_NOT_FOUND"));
    }

    const customer = await prisma.customer.update({
      where: { id },
      data: validationResult.data,
      include: {
        createdByAdmin: {
          select: { username: true, email: true },
        },
        addresses: true,
        _count: {
          select: {
            orders: true,
          },
        },
      },
    });

    return res.status(200).json(ResponseHelper.success(customer));
  } catch (error) {
    console.error("Update customer error:", error);
    return res
      .status(500)
      .json(
        ResponseHelper.error(
          "Failed to update customer",
          "UPDATE_CUSTOMER_ERROR"
        )
      );
  }
};

/**
 * Delete customer
 */
export const deleteCustomer = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if customer exists and has no orders
    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        _count: {
          select: { orders: true },
        },
      },
    });

    if (!customer) {
      return res
        .status(404)
        .json(ResponseHelper.error("Customer not found", "CUSTOMER_NOT_FOUND"));
    }

    if (customer._count.orders > 0) {
      return res
        .status(400)
        .json(
          ResponseHelper.error(
            "Cannot delete customer with existing orders",
            "CUSTOMER_HAS_ORDERS"
          )
        );
    }

    await prisma.customer.delete({
      where: { id },
    });

    return res
      .status(200)
      .json(
        ResponseHelper.success({ message: "Customer deleted successfully" })
      );
  } catch (error) {
    console.error("Delete customer error:", error);
    return res
      .status(500)
      .json(
        ResponseHelper.error(
          "Failed to delete customer",
          "DELETE_CUSTOMER_ERROR"
        )
      );
  }
};

/**
 * Add address to customer
 */
export const addCustomerAddress = async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;

    // Validate input
    const validationResult = createAddressSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res
        .status(400)
        .json(
          ResponseHelper.error(
            "Validation failed",
            "VALIDATION_ERROR",
            validationResult.error.issues
          )
        );
    }

    // Check if customer exists
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      return res
        .status(404)
        .json(ResponseHelper.error("Customer not found", "CUSTOMER_NOT_FOUND"));
    }

    const { isDefault, ...addressData } = validationResult.data;

    // If this is default, unset other default addresses
    if (isDefault) {
      await prisma.customerAddress.updateMany({
        where: { customerId },
        data: { isDefault: false },
      });
    }

    const address = await prisma.customerAddress.create({
      data: {
        ...addressData,
        customerId,
        isDefault: isDefault || false,
      },
    });

    return res.status(201).json(ResponseHelper.success(address));
  } catch (error) {
    console.error("Add customer address error:", error);
    return res
      .status(500)
      .json(
        ResponseHelper.error(
          "Failed to add customer address",
          "ADD_ADDRESS_ERROR"
        )
      );
  }
};

/**
 * Update customer address
 */
export const updateCustomerAddress = async (req: Request, res: Response) => {
  try {
    const { customerId, addressId } = req.params;

    // Validate input
    const validationResult = createAddressSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res
        .status(400)
        .json(
          ResponseHelper.error(
            "Validation failed",
            "VALIDATION_ERROR",
            validationResult.error.issues
          )
        );
    }

    // Check if address exists and belongs to customer
    const existingAddress = await prisma.customerAddress.findUnique({
      where: { id: addressId },
    });

    if (!existingAddress || existingAddress.customerId !== customerId) {
      return res
        .status(404)
        .json(ResponseHelper.error("Address not found", "ADDRESS_NOT_FOUND"));
    }

    const { isDefault, ...addressData } = validationResult.data;

    // If setting as default, unset other default addresses
    if (isDefault) {
      await prisma.customerAddress.updateMany({
        where: { customerId, id: { not: addressId } },
        data: { isDefault: false },
      });
    }

    const address = await prisma.customerAddress.update({
      where: { id: addressId },
      data: {
        ...addressData,
        isDefault: isDefault || false,
      },
    });

    return res.status(200).json(ResponseHelper.success(address));
  } catch (error) {
    console.error("Update customer address error:", error);
    return res
      .status(500)
      .json(
        ResponseHelper.error(
          "Failed to update customer address",
          "UPDATE_ADDRESS_ERROR"
        )
      );
  }
};

/**
 * Delete customer address
 */
export const deleteCustomerAddress = async (req: Request, res: Response) => {
  try {
    const { customerId, addressId } = req.params;

    // Check if address exists and belongs to customer
    const address = await prisma.customerAddress.findUnique({
      where: { id: addressId },
    });

    if (!address || address.customerId !== customerId) {
      return res
        .status(404)
        .json(ResponseHelper.error("Address not found", "ADDRESS_NOT_FOUND"));
    }

    // Check if address is referenced in any orders (deliveryAddress is JSON field)
    const ordersWithAddress = await prisma.order.findFirst({
      where: {
        customerId: customerId,
        deliveryAddress: {
          path: ["id"],
          equals: addressId,
        },
      },
    });

    if (ordersWithAddress) {
      return res
        .status(400)
        .json(
          ResponseHelper.error(
            "Cannot delete address with existing orders",
            "ADDRESS_HAS_ORDERS"
          )
        );
    }

    await prisma.customerAddress.delete({
      where: { id: addressId },
    });

    return res
      .status(200)
      .json(
        ResponseHelper.success({ message: "Address deleted successfully" })
      );
  } catch (error) {
    console.error("Delete customer address error:", error);
    return res
      .status(500)
      .json(
        ResponseHelper.error(
          "Failed to delete customer address",
          "DELETE_ADDRESS_ERROR"
        )
      );
  }
};

/**
 * Get customer orders with pagination
 */
export const getCustomerOrders = async (req: Request, res: Response) => {
  try {
    const { id: customerId } = req.params;
    const { page = "1", limit = "10" } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    // Check if customer exists
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, fullName: true },
    });

    if (!customer) {
      return res
        .status(404)
        .json(ResponseHelper.error("Customer not found", "CUSTOMER_NOT_FOUND"));
    }

    const [orders, totalCount] = await Promise.all([
      prisma.order.findMany({
        where: { customerId },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          orderType: true,
          totalAmount: true,
          notes: true,
          createdAt: true,
          deliveryAddress: true,
          items: {
            select: {
              id: true,
              quantity: true,
              productSnapshot: true,
              product: {
                select: {
                  name: true,
                  slug: true,
                  capacity: {
                    select: { name: true },
                  },
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: offset,
        take: limitNum,
      }),
      prisma.order.count({ where: { customerId } }),
    ]);

    const totalPages = Math.ceil(totalCount / limitNum);

    return res.status(200).json(
      ResponseHelper.paginated(
        orders,
        {
          current_page: pageNum,
          per_page: limitNum,
          total_pages: totalPages,
          total_items: totalCount,
          has_next: pageNum < totalPages,
          has_prev: pageNum > 1,
        },
        {
          customer: {
            id: customer.id,
            name: customer.fullName,
          },
        }
      )
    );
  } catch (error) {
    console.error("Get customer orders error:", error);
    return res
      .status(500)
      .json(
        ResponseHelper.error(
          "Failed to retrieve customer orders",
          "GET_CUSTOMER_ORDERS_ERROR"
        )
      );
  }
};

/**
 * Set default address for customer
 */
export const setDefaultCustomerAddress = async (
  req: Request,
  res: Response
) => {
  try {
    const { customerId, addressId } = req.params;

    // Check if address exists and belongs to customer
    const existingAddress = await prisma.customerAddress.findUnique({
      where: { id: addressId },
    });

    if (!existingAddress || existingAddress.customerId !== customerId) {
      return res
        .status(404)
        .json(ResponseHelper.error("Address not found", "ADDRESS_NOT_FOUND"));
    }

    // Unset all default addresses for this customer
    await prisma.customerAddress.updateMany({
      where: { customerId },
      data: { isDefault: false },
    });

    // Set this address as default
    const address = await prisma.customerAddress.update({
      where: { id: addressId },
      data: { isDefault: true },
    });

    return res.status(200).json(ResponseHelper.success(address));
  } catch (error) {
    console.error("Set default address error:", error);
    return res
      .status(500)
      .json(
        ResponseHelper.error(
          "Failed to set default address",
          "SET_DEFAULT_ADDRESS_ERROR"
        )
      );
  }
};

/**
 * Search customers for autocomplete
 */
export const searchCustomers = async (req: Request, res: Response) => {
  try {
    const { q: query = "" } = req.query;

    const where: any = {};

    if (query) {
      where.OR = [
        { fullName: { contains: query as string, mode: "insensitive" } },
        { phone: { contains: query as string, mode: "insensitive" } },
        { messengerId: { contains: query as string, mode: "insensitive" } },
      ];
    }

    const customers = await prisma.customer.findMany({
      where,
      select: {
        id: true,
        fullName: true,
        phone: true,
        messengerId: true,
      },
      orderBy: { fullName: "asc" },
      take: 50,
    });

    return res.status(200).json(ResponseHelper.success(customers));
  } catch (error) {
    console.error("Search customers error:", error);
    return res
      .status(500)
      .json(
        ResponseHelper.error(
          "Failed to search customers",
          "SEARCH_CUSTOMERS_ERROR"
        )
      );
  }
};
