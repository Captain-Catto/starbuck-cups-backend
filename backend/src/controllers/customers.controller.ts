import { Request, Response } from "express";
import { models } from "../models";

const {
  Customer,
  CustomerPhone,
  CustomerAddress,
  AdminUser,
  Order,
  OrderItem,
  Product,
} = models;

import { ResponseHelper } from "../types/api";
import { z } from "zod";
import { sequelize } from "../config/database";
import { Op } from "sequelize";
import {
  isValidPhoneNumber,
  getPhoneValidationErrorMessage,
} from "../utils/phoneValidation";

// Validation schemas
const createCustomerSchema = z.object({
  messengerId: z.string().nullable().optional(),
  zaloId: z.string().nullable().optional(),
  fullName: z.string().min(1, "Full name is required"),
  phoneNumber: z
    .string()
    .min(1, "Phone number is required")
    .refine(isValidPhoneNumber, {
      message: getPhoneValidationErrorMessage(),
    }),
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
  phoneNumber: z
    .string()
    .refine(isValidPhoneNumber, {
      message: getPhoneValidationErrorMessage(),
    })
    .optional(),
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
    const includePhoneSearch = search ? true : false;

    if (search) {
      where[Op.or] = [
        { fullName: { [Op.like]: `%${search}%` } },
        { messengerId: { [Op.like]: `%${search}%` } },
        { zaloId: { [Op.like]: `%${search}%` } },
        ...(includePhoneSearch
          ? [
              {
                "$customerPhones.phone_number$": { [Op.like]: `%${search}%` },
              },
            ]
          : []),
      ];
    }

    // Note: Customer model doesn't have isActive field, so we skip this filter
    // if (active !== "all") {
    //   where.isActive = active === "true";
    // }

    if (vipStatus !== "all") {
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
        where.createdAt[Op.gte] = new Date(dateFrom as string);
      }
      if (dateTo) {
        // Add one day to include the end date
        const endDate = new Date(dateTo as string);
        endDate.setDate(endDate.getDate() + 1);
        where.createdAt[Op.lt] = endDate;
      }
    }

    // Use findAndCountAll with distinct to get accurate count and avoid duplicates
    const { count: totalCount, rows: customers } =
      await Customer.findAndCountAll({
        where,
        include: [
          {
            model: AdminUser,
            as: "createdByAdmin",
            attributes: ["username", "email"],
          },
          {
            model: CustomerPhone,
            as: "customerPhones",
            attributes: ["id", "phoneNumber", "isMain"],
            required: false, // Always LEFT JOIN to include customers without phones
          },
          {
            model: CustomerAddress,
            as: "addresses",
            order: [["isDefault", "DESC"]],
          },
          {
            model: Order,
            as: "orders",
            limit: 1,
            order: [["createdAt", "DESC"]],
            attributes: ["createdAt"],
          },
        ],
        order: [["createdAt", "DESC"]],
        offset,
        limit: limitNum,
        subQuery: false,
        distinct: true, // This will count distinct customers and handle duplicates
      });

    const totalPages = Math.ceil(totalCount / limitNum);

    // Calculate additional data for each customer
    const customersWithAdditionalData = await Promise.all(
      customers.map(async (customer) => {
        // Get total amount from delivered orders only
        const totalAmount = await Order.sum("totalAmount", {
          where: {
            customerId: customer.id,
            status: "DELIVERED", // Only delivered orders
          },
        });

        return {
          ...customer.toJSON(),
          lastOrderDate:
            customer.orders && customer.orders.length > 0
              ? customer.orders[0].createdAt
              : null,
          totalSpent: totalAmount || 0,
          _count: {
            orders: customer.orders ? customer.orders.length : 0,
          },
        };
      })
    );

    return res.status(200).json(
      ResponseHelper.paginated(customersWithAdditionalData, {
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
 * Get customer by ID with details (addresses managed separately)
 */
export const getCustomerById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const customer = await Customer.findByPk(id, {
      include: [
        {
          model: AdminUser,
          as: "createdByAdmin",
          attributes: ["username", "email"],
        },
        {
          model: CustomerPhone,
          as: "customerPhones",
          attributes: ["id", "phoneNumber", "isMain"],
        },
        {
          model: CustomerAddress,
          as: "addresses",
          order: [["isDefault", "DESC"]],
        },
        {
          model: Order,
          as: "orders",
          include: [
            {
              model: OrderItem,
              as: "items",
              include: [
                {
                  model: Product,
                  as: "product",
                  attributes: ["name", "slug"],
                },
              ],
            },
          ],
          order: [["createdAt", "DESC"]],
          limit: 10,
        },
      ],
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
 * Create new customer (addresses managed separately via address endpoints)
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

    const {
      messengerId,
      zaloId,
      fullName,
      phoneNumber,
      notes,
      isVip,
      address,
    } = validationResult.data;

    // Create customer with address in a transaction
    const result = await sequelize.transaction(async (t) => {
      const customer = await Customer.create(
        {
          messengerId: messengerId || undefined,
          zaloId: zaloId || undefined,
          fullName,
          notes: notes || undefined,
          isVip: isVip || false,
          createdByAdminId: req.user!.userId,
        },
        { transaction: t }
      );

      // Create main phone number
      await CustomerPhone.create(
        {
          customerId: customer.id,
          phoneNumber,
          isMain: true,
        },
        { transaction: t }
      );

      // Create address if provided
      if (address) {
        await CustomerAddress.create(
          {
            customerId: customer.id,
            addressLine: address.addressLine,
            ward: address.ward || undefined,
            district: address.district || undefined,
            city: address.city,
            postalCode: address.postalCode || undefined,
            isDefault: address.isDefault ?? true,
          },
          { transaction: t }
        );
      }

      // Return customer with addresses ordered by isDefault
      return await Customer.findByPk(customer.id, {
        include: [
          {
            model: AdminUser,
            as: "createdByAdmin",
            attributes: ["username", "email"],
          },
          {
            model: CustomerPhone,
            as: "customerPhones",
            attributes: ["id", "phoneNumber", "isMain"],
          },
          {
            model: CustomerAddress,
            as: "addresses",
            order: [["isDefault", "DESC"]],
          },
        ],
        transaction: t,
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
 * Update customer (addresses managed separately via address endpoints)
 */
export const updateCustomer = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res
        .status(401)
        .json(ResponseHelper.error("Authentication required", "UNAUTHORIZED"));
    }

    const { id } = req.params;
    console.log("Update customer request body:", req.body);

    // Validate input
    const validationResult = updateCustomerSchema.safeParse(req.body);
    if (!validationResult.success) {
      console.log("Validation errors:", validationResult.error.issues);
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
    const existingCustomer = await Customer.findByPk(id);
    if (!existingCustomer) {
      return res
        .status(404)
        .json(ResponseHelper.error("Customer not found", "CUSTOMER_NOT_FOUND"));
    }

    // Update customer
    const updateData: any = {};
    if (validationResult.data.messengerId !== undefined) {
      updateData.messengerId = validationResult.data.messengerId || undefined;
    }
    if (validationResult.data.zaloId !== undefined) {
      updateData.zaloId = validationResult.data.zaloId || undefined;
    }
    if (validationResult.data.fullName !== undefined) {
      updateData.fullName = validationResult.data.fullName;
    }
    if (validationResult.data.notes !== undefined) {
      updateData.notes = validationResult.data.notes || undefined;
    }
    if (validationResult.data.isVip !== undefined) {
      updateData.isVip = validationResult.data.isVip;
    }

    console.log("Update data to be applied:", updateData);

    // Handle customer and phone updates in transaction
    await sequelize.transaction(async (t) => {
      // Update customer data
      await existingCustomer.update(updateData, { transaction: t });

      // Update phone number if provided
      if (validationResult.data.phoneNumber !== undefined) {
        // Find existing main phone or create new one
        const mainPhone = await CustomerPhone.findOne({
          where: { customerId: id, isMain: true },
          transaction: t,
        });

        if (mainPhone) {
          await mainPhone.update(
            { phoneNumber: validationResult.data.phoneNumber },
            { transaction: t }
          );
        } else {
          await CustomerPhone.create(
            {
              customerId: id,
              phoneNumber: validationResult.data.phoneNumber,
              isMain: true,
            },
            { transaction: t }
          );
        }
      }
    });

    console.log("Customer updated successfully");

    // Fetch updated customer with details and addresses ordered by isDefault
    const updatedCustomer = await Customer.findByPk(id, {
      include: [
        {
          model: AdminUser,
          as: "createdByAdmin",
          attributes: ["username", "email"],
        },
        {
          model: CustomerPhone,
          as: "customerPhones",
          attributes: ["id", "phoneNumber", "isMain"],
        },
        {
          model: CustomerAddress,
          as: "addresses",
          order: [["isDefault", "DESC"]],
        },
      ],
    });

    return res.status(200).json(ResponseHelper.success(updatedCustomer));
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
 * Delete customer (soft delete)
 */
export const deleteCustomer = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res
        .status(401)
        .json(ResponseHelper.error("Authentication required", "UNAUTHORIZED"));
    }

    const { id } = req.params;

    const customer = await Customer.findByPk(id);
    if (!customer) {
      return res
        .status(404)
        .json(ResponseHelper.error("Customer not found", "CUSTOMER_NOT_FOUND"));
    }

    // Since Customer model doesn't have isActive, we'll remove the customer logic for now
    // This would typically be implemented with a proper soft delete field
    await customer.destroy();

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
    if (!req.user) {
      return res
        .status(401)
        .json(ResponseHelper.error("Authentication required", "UNAUTHORIZED"));
    }

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
    const customer = await Customer.findByPk(customerId);
    if (!customer) {
      return res
        .status(404)
        .json(ResponseHelper.error("Customer not found", "CUSTOMER_NOT_FOUND"));
    }

    const addressData = validationResult.data;

    // If this is set as default, update other addresses
    if (addressData.isDefault) {
      await CustomerAddress.update(
        { isDefault: false },
        { where: { customerId } }
      );
    }

    // Create new address
    const address = await CustomerAddress.create({
      customerId,
      addressLine: addressData.addressLine,
      ward: addressData.ward,
      district: addressData.district,
      city: addressData.city,
      postalCode: addressData.postalCode,
      isDefault: addressData.isDefault ?? false,
    });

    return res.status(201).json(ResponseHelper.success(address));
  } catch (error) {
    console.error("Add customer address error:", error);
    return res
      .status(500)
      .json(
        ResponseHelper.error(
          "Failed to add customer address",
          "ADD_CUSTOMER_ADDRESS_ERROR"
        )
      );
  }
};

/**
 * Update customer address
 */
export const updateCustomerAddress = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res
        .status(401)
        .json(ResponseHelper.error("Authentication required", "UNAUTHORIZED"));
    }

    const { addressId } = req.params;

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

    // Check if address exists
    const existingAddress = await CustomerAddress.findByPk(addressId);
    if (!existingAddress) {
      return res
        .status(404)
        .json(ResponseHelper.error("Address not found", "ADDRESS_NOT_FOUND"));
    }

    const addressData = validationResult.data;

    // If this is set as default, update other addresses
    if (addressData.isDefault) {
      await CustomerAddress.update(
        { isDefault: false },
        { where: { customerId: existingAddress.customerId } }
      );
    }

    // Update address
    await existingAddress.update(addressData);

    return res.status(200).json(ResponseHelper.success(existingAddress));
  } catch (error) {
    console.error("Update customer address error:", error);
    return res
      .status(500)
      .json(
        ResponseHelper.error(
          "Failed to update customer address",
          "UPDATE_CUSTOMER_ADDRESS_ERROR"
        )
      );
  }
};

/**
 * Delete customer address
 */
export const deleteCustomerAddress = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res
        .status(401)
        .json(ResponseHelper.error("Authentication required", "UNAUTHORIZED"));
    }

    const { addressId } = req.params;

    const address = await CustomerAddress.findByPk(addressId);
    if (!address) {
      return res
        .status(404)
        .json(ResponseHelper.error("Address not found", "ADDRESS_NOT_FOUND"));
    }

    // Check if address is being used in any orders
    const ordersWithAddress = await Order.findOne({
      where: {
        [Op.or]: [
          { "deliveryAddress.addressLine": address.addressLine },
          { customerId: address.customerId },
        ],
      },
    });

    if (ordersWithAddress) {
      return res
        .status(409)
        .json(
          ResponseHelper.error(
            "Cannot delete address that is being used in orders",
            "ADDRESS_IN_USE"
          )
        );
    }

    await address.destroy();

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
          "DELETE_CUSTOMER_ADDRESS_ERROR"
        )
      );
  }
};

/**
 * Get customer orders
 */
export const getCustomerOrders = async (req: Request, res: Response) => {
  try {
    const { id: customerId } = req.params;
    const { page = "1", limit = "10", status = "all" } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    // Check if customer exists
    const customer = await Customer.findByPk(customerId);
    if (!customer) {
      return res
        .status(404)
        .json(ResponseHelper.error("Customer not found", "CUSTOMER_NOT_FOUND"));
    }

    const where: any = { customerId };
    if (status !== "all") {
      where.status = status;
    }

    const { count: totalCount, rows: orders } = await Order.findAndCountAll({
      where,
      include: [
        {
          model: OrderItem,
          as: "items",
          include: [
            {
              model: Product,
              as: "product",
              attributes: ["id", "name", "slug", "unitPrice"],
            },
          ],
        },
      ],
      order: [["createdAt", "DESC"]],
      offset,
      limit: limitNum,
    });

    const totalPages = Math.ceil(totalCount / limitNum);

    return res.status(200).json(
      ResponseHelper.paginated(orders, {
        current_page: pageNum,
        per_page: limitNum,
        total_pages: totalPages,
        total_items: totalCount,
        has_next: pageNum < totalPages,
        has_prev: pageNum > 1,
      })
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
 * Set default address
 */
export const setDefaultAddress = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res
        .status(401)
        .json(ResponseHelper.error("Authentication required", "UNAUTHORIZED"));
    }

    const { addressId } = req.params;

    const existingAddress = await CustomerAddress.findByPk(addressId);
    if (!existingAddress) {
      return res
        .status(404)
        .json(ResponseHelper.error("Address not found", "ADDRESS_NOT_FOUND"));
    }

    // Update all addresses of the customer to not default
    await CustomerAddress.update(
      { isDefault: false },
      { where: { customerId: existingAddress.customerId } }
    );

    // Set this address as default
    await existingAddress.update({ isDefault: true });

    return res.status(200).json(ResponseHelper.success(existingAddress));
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
 * Get customers for select dropdown (simplified data)
 */
export const getCustomersForSelect = async (req: Request, res: Response) => {
  try {
    const { search = "" } = req.query;

    const where: any = {}; // Customer model doesn't have isActive field
    const includePhoneSearch = search ? true : false;

    if (search) {
      where[Op.or] = [
        { fullName: { [Op.like]: `%${search}%` } },
        ...(includePhoneSearch
          ? [
              {
                "$customerPhones.phone_number$": { [Op.like]: `%${search}%` },
              },
            ]
          : []),
      ];
    }

    const customers = await Customer.findAll({
      where,
      attributes: ["id", "fullName", "isVip"],
      include: [
        {
          model: CustomerPhone,
          as: "customerPhones",
          attributes: ["id", "phoneNumber", "isMain"],
          required: includePhoneSearch, // Use INNER JOIN if searching by phone
        },
      ],
      order: [["fullName", "ASC"]],
      limit: 50,
      subQuery: false, // Disable subquery to allow proper JOINs with WHERE
    });

    return res.status(200).json(ResponseHelper.success(customers));
  } catch (error) {
    console.error("Get customers for select error:", error);
    return res
      .status(500)
      .json(
        ResponseHelper.error(
          "Failed to retrieve customers for select",
          "GET_CUSTOMERS_FOR_SELECT_ERROR"
        )
      );
  }
};

/**
 * Search customers by query string
 */
export const searchCustomers = async (req: Request, res: Response) => {
  try {
    const { q: query = "" } = req.query;

    const where: any = {};
    const includePhoneSearch = query ? true : false;

    if (query && typeof query === "string") {
      where[Op.or] = [
        { fullName: { [Op.like]: `%${query}%` } },
        { messengerId: { [Op.like]: `%${query}%` } },
        ...(includePhoneSearch
          ? [
              {
                "$customerPhones.phone_number$": { [Op.like]: `%${query}%` },
              },
            ]
          : []),
      ];
    }

    const customers = await Customer.findAll({
      where,
      attributes: ["id", "fullName", "messengerId"],
      include: [
        {
          model: CustomerPhone,
          as: "customerPhones",
          attributes: ["id", "phoneNumber", "isMain"],
          required: includePhoneSearch, // Use INNER JOIN if searching by phone
        },
      ],
      order: [["fullName", "ASC"]],
      limit: 50,
      subQuery: false, // Disable subquery to allow proper JOINs with WHERE
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
