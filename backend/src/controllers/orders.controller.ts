import { Request, Response } from "express";
import { PrismaClient } from "../generated/prisma";
import { ResponseHelper } from "../types/api";
import { z } from "zod";

const prisma = new PrismaClient();

// Validation schemas
const createOrderItemSchema = z.object({
  productId: z.string().uuid("Invalid product ID"),
  quantity: z.coerce.number().int().positive("Quantity must be positive"),
  unitPrice: z.coerce
    .number()
    .nonnegative("Unit price cannot be negative (0 = free item)")
    .optional(),
  requestedColor: z.string().optional(),
  updateBasePrice: z.boolean().optional(), // Flag to update product's base price
});

const createOrderSchema = z
  .object({
    customerId: z.string().uuid("Invalid customer ID"),
    orderType: z.enum(["custom", "product"]), // lowercase to match frontend
    deliveryAddress: z.object({
      addressLine: z.string().min(1, "Address line is required"),
      district: z.string().optional(),
      city: z.string().min(1, "City is required"),
      postalCode: z.string().optional(),
    }),
    customDescription: z.string().optional(),
    totalAmount: z.coerce.number().nonnegative().optional(), // For custom orders
    notes: z.string().optional(),
    items: z.array(createOrderItemSchema).optional(),
    originalShippingCost: z.number().nonnegative().optional(),
    shippingDiscount: z.number().nonnegative().optional(),
    shippingCost: z.number().nonnegative().optional(),
  })
  .refine(
    (data) => {
      // For product orders, items are required
      if (
        data.orderType === "product" &&
        (!data.items || data.items.length === 0)
      ) {
        return false;
      }
      // For custom orders, customDescription is required
      if (data.orderType === "custom" && !data.customDescription) {
        return false;
      }
      return true;
    },
    {
      message:
        "Invalid order data: check items for product orders, description for custom orders",
    }
  )
  .refine(
    (data) => {
      // Shipping discount cannot exceed original shipping cost
      if (
        data.shippingDiscount !== undefined &&
        data.originalShippingCost !== undefined &&
        data.shippingDiscount > data.originalShippingCost
      ) {
        return false;
      }
      return true;
    },
    {
      message: "Shipping discount cannot exceed original shipping cost",
    }
  );

const updateOrderStatusSchema = z.object({
  status: z.enum([
    "PENDING",
    "CONFIRMED",
    "PROCESSING",
    "SHIPPED",
    "DELIVERED",
    "CANCELLED",
  ]),
  notes: z.string().optional(),
});

const updateOrderSchema = z.object({
  deliveryAddress: z
    .object({
      addressLine: z.string().min(1, "Address line is required"),
      district: z.string().optional(),
      city: z.string().min(1, "City is required"),
      postalCode: z.string().optional(),
    })
    .optional(),
  originalShippingCost: z.coerce.number().nonnegative().optional(),
  shippingDiscount: z.coerce.number().nonnegative().optional(),
  shippingCost: z.coerce.number().nonnegative().optional(),
  totalAmount: z.coerce.number().nonnegative().optional(),
  notes: z.string().optional(),
  items: z.array(createOrderItemSchema).optional(),
});

/**
 * Generate unique order number
 */
async function generateOrderNumber(): Promise<string> {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");

  // Count orders created today
  const startOfDay = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

  const todayOrderCount = await prisma.order.count({
    where: {
      createdAt: {
        gte: startOfDay,
        lt: endOfDay,
      },
    },
  });

  const sequence = (todayOrderCount + 1).toString().padStart(4, "0");
  return `ORD${year}${month}${day}${sequence}`;
}

/**
 * Get all orders with pagination and filters
 */
export const getOrders = async (req: Request, res: Response) => {
  try {
    const {
      page = "1",
      limit = "20",
      status = "all",
      customerId,
      orderType = "all",
      search = "",
      dateFrom,
      dateTo,
      priceRange,
      freeShipping,
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    const where: any = {};

    if (status !== "all") {
      // Convert lowercase status to uppercase for Prisma enum
      where.status = (status as string).toUpperCase();
    }

    if (customerId) {
      where.customerId = customerId;
    }

    if (orderType !== "all") {
      // Convert lowercase orderType to uppercase for Prisma enum
      where.orderType = (orderType as string).toUpperCase();
    }

    if (search) {
      where.OR = [
        { orderNumber: { contains: search as string, mode: "insensitive" } },
        {
          customer: {
            fullName: { contains: search as string, mode: "insensitive" },
          },
        },
        {
          customer: {
            phone: { contains: search as string, mode: "insensitive" },
          },
        },
      ];
    }

    // Date range filtering
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) {
        where.createdAt.gte = new Date(dateFrom as string);
      }
      if (dateTo) {
        // Add 1 day to include the end date
        const endDate = new Date(dateTo as string);
        endDate.setDate(endDate.getDate() + 1);
        where.createdAt.lt = endDate;
      }
    }

    // Price range filtering
    if (priceRange && priceRange !== "all") {
      const ranges = {
        "0-100": { min: 0, max: 100000 }, // 0-100k VND
        "100-500": { min: 100000, max: 500000 }, // 100k-500k VND
        "500-1000": { min: 500000, max: 1000000 }, // 500k-1M VND
        "1000+": { min: 1000000, max: null }, // 1M+ VND
      };

      const range = ranges[priceRange as keyof typeof ranges];
      if (range) {
        where.totalAmount = {};
        where.totalAmount.gte = range.min;
        if (range.max) {
          where.totalAmount.lte = range.max;
        }
      }
    }

    // Free shipping filtering
    if (freeShipping && freeShipping !== "all") {
      if (freeShipping === "free") {
        // Free shipping means shippingCost is 0
        where.shippingCost = 0;
      } else if (freeShipping === "paid") {
        // Paid shipping means shippingCost is greater than 0
        where.shippingCost = { gt: 0 };
      }
    }

    const [orders, totalCount] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          customer: {
            select: {
              id: true,
              fullName: true,
              phone: true,
              messengerId: true,
            },
          },
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  isActive: true,
                },
              },
            },
          },
          _count: {
            select: { items: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: offset,
        take: limitNum,
      }),
      prisma.order.count({ where }),
    ]);

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
    console.error("Get orders error:", error);
    return res
      .status(500)
      .json(
        ResponseHelper.error("Failed to retrieve orders", "GET_ORDERS_ERROR")
      );
  }
};

/**
 * Get order by ID
 */
export const getOrderById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        customer: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            messengerId: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                slug: true,
                isActive: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      return res
        .status(404)
        .json(ResponseHelper.error("Order not found", "ORDER_NOT_FOUND"));
    }

    return res.status(200).json(ResponseHelper.success(order));
  } catch (error) {
    console.error("Get order error:", error);
    return res
      .status(500)
      .json(
        ResponseHelper.error("Failed to retrieve order", "GET_ORDER_ERROR")
      );
  }
};

/**
 * Create new order with product snapshots
 */
export const createOrder = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res
        .status(401)
        .json(ResponseHelper.error("Authentication required", "UNAUTHORIZED"));
    }

    // Validate input
    const validationResult = createOrderSchema.safeParse(req.body);
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
      customerId,
      orderType: frontendOrderType,
      deliveryAddress,
      customDescription,
      totalAmount,
      notes,
      items,
      originalShippingCost = 0,
      shippingDiscount = 0,
      shippingCost = 0,
    } = validationResult.data;

    // Convert frontend orderType to database enum
    const orderType = frontendOrderType === "product" ? "PRODUCT" : "CUSTOM";

    // Verify customer exists
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      return res
        .status(404)
        .json(ResponseHelper.error("Customer not found", "CUSTOMER_NOT_FOUND"));
    }

    // For product orders, get products with snapshots
    let orderItems: any[] = [];
    let calculatedTotalAmount = totalAmount || 0; // Use provided totalAmount for custom orders, or calculate for product orders

    if (orderType === "PRODUCT" && items && items.length > 0) {
      const productIds = items.map((item) => item.productId);
      const products = await prisma.product.findMany({
        where: {
          id: { in: productIds },
          isActive: true,
          isDeleted: false,
        },
        include: {
          productColors: {
            include: {
              color: true,
            },
          },
          capacity: true,
          productCategories: {
            include: {
              category: true,
            },
          },
          productImages: {
            orderBy: { order: "asc" },
          },
        },
      });

      if (products.length !== productIds.length) {
        return res
          .status(400)
          .json(
            ResponseHelper.error(
              "Some products are not available",
              "PRODUCTS_NOT_AVAILABLE"
            )
          );
      }

      // Create order items with product snapshots
      orderItems = items.map((item) => {
        const product = products.find((p) => p.id === item.productId)!;

        // Calculate item total
        const itemTotal = item.quantity * (item.unitPrice || 0);
        calculatedTotalAmount += itemTotal;

        // Create product snapshot to preserve current state
        const productSnapshot = {
          id: product.id,
          name: product.name,
          description: product.description,
          slug: product.slug,
          images: product.productImages.map((img) => ({
            url: img.url,
            order: img.order,
          })),
          productUrl: product.productUrl,
          unitPrice: item.unitPrice || 0,
          requestedColor: item.requestedColor,
          colors: product.productColors.map((pc) => ({
            id: pc.color.id,
            name: pc.color.name,
            hexCode: pc.color.hexCode,
          })),
          capacity: {
            id: product.capacity.id,
            name: product.capacity.name,
            volumeMl: product.capacity.volumeMl,
          },
          categories: product.productCategories.map((pc) => ({
            id: pc.category.id,
            name: pc.category.name,
            slug: pc.category.slug,
          })),
          capturedAt: new Date().toISOString(),
        };

        return {
          productId: item.productId,
          quantity: item.quantity,
          productSnapshot,
        };
      });
    } else if (orderType === "CUSTOM") {
      // For custom orders, don't create order items
      // The custom description is stored in the order itself
      orderItems = [];
    }

    // Generate order number
    const orderNumber = await generateOrderNumber();

    // Create order with items in a transaction
    const order = await prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          orderNumber,
          customerId,
          orderType,
          deliveryAddress,
          customDescription,
          notes,
          totalAmount: calculatedTotalAmount,
          originalShippingCost,
          shippingDiscount,
          shippingCost,
          status: "PENDING",
        },
      });

      // Create order items
      if (orderItems.length > 0) {
        await tx.orderItem.createMany({
          data: orderItems.map((item) => ({
            orderId: newOrder.id,
            productId: item.productId, // This should always be valid for product orders
            quantity: item.quantity,
            productSnapshot: item.productSnapshot,
          })),
        });
      }

      // Update product stock for product orders
      if (orderType === "PRODUCT" && items && items.length > 0) {
        for (const item of items) {
          await tx.product.update({
            where: { id: item.productId },
            data: {
              stockQuantity: {
                decrement: item.quantity,
              },
            },
          });
        }
      }

      return newOrder;
    });

    // Fetch complete order with relations
    const completeOrder = await prisma.order.findUnique({
      where: { id: order.id },
      include: {
        customer: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            messengerId: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
      },
    });

    return res.status(201).json(ResponseHelper.success(completeOrder));
  } catch (error) {
    console.error("Create order error:", error);
    return res
      .status(500)
      .json(
        ResponseHelper.error("Failed to create order", "CREATE_ORDER_ERROR")
      );
  }
};

/**
 * Update order status
 */
export const updateOrderStatus = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res
        .status(401)
        .json(ResponseHelper.error("Authentication required", "UNAUTHORIZED"));
    }

    const { id } = req.params;

    // Validate input
    const validationResult = updateOrderStatusSchema.safeParse(req.body);
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

    const { status, notes } = validationResult.data;

    // Check if order exists
    const existingOrder = await prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!existingOrder) {
      return res
        .status(404)
        .json(ResponseHelper.error("Order not found", "ORDER_NOT_FOUND"));
    }

    // Validate status transitions
    const validTransitions: Record<string, string[]> = {
      PENDING: ["CONFIRMED", "CANCELLED"],
      CONFIRMED: ["PROCESSING", "CANCELLED"],
      PROCESSING: ["SHIPPED", "CANCELLED"],
      SHIPPED: ["DELIVERED"],
      DELIVERED: [], // Final state
      CANCELLED: [], // Final state
    };

    if (!validTransitions[existingOrder.status].includes(status)) {
      return res
        .status(400)
        .json(
          ResponseHelper.error(
            `Cannot change status from ${existingOrder.status} to ${status}`,
            "INVALID_STATUS_TRANSITION"
          )
        );
    }

    const updateData: any = { status };

    // Set timestamps for specific statuses
    if (status === "CONFIRMED") {
      updateData.confirmedAt = new Date();
    } else if (status === "DELIVERED") {
      updateData.completedAt = new Date();
    }

    // If cancelling, restore stock for product orders
    if (status === "CANCELLED" && existingOrder.orderType === "PRODUCT") {
      await prisma.$transaction(async (tx) => {
        // Restore product stock
        for (const item of existingOrder.items) {
          if (item.product && !item.product.isDeleted) {
            await tx.product.update({
              where: { id: item.productId },
              data: {
                stockQuantity: {
                  increment: item.quantity,
                },
              },
            });
          }
        }

        // Update order
        await tx.order.update({
          where: { id },
          data: updateData,
        });
      });
    } else {
      await prisma.order.update({
        where: { id },
        data: updateData,
      });
    }

    // Add notes if provided
    if (notes) {
      await prisma.order.update({
        where: { id },
        data: {
          notes: existingOrder.notes
            ? `${existingOrder.notes}\n\n${new Date().toISOString()}: ${notes}`
            : notes,
        },
      });
    }

    // Fetch updated order
    const updatedOrder = await prisma.order.findUnique({
      where: { id },
      include: {
        customer: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            messengerId: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
      },
    });

    return res.status(200).json(ResponseHelper.success(updatedOrder));
  } catch (error) {
    console.error("Update order status error:", error);
    return res
      .status(500)
      .json(
        ResponseHelper.error(
          "Failed to update order status",
          "UPDATE_ORDER_STATUS_ERROR"
        )
      );
  }
};

/**
 * Get order statistics
 */
export const getOrderStats = async (req: Request, res: Response) => {
  try {
    const { period = "30" } = req.query; // days
    const days = parseInt(period as string);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Calculate previous period start date for comparison
    const previousPeriodStartDate = new Date(startDate);
    previousPeriodStartDate.setDate(previousPeriodStartDate.getDate() - days);

    const [currentPeriodCounts, previousPeriodCounts] = await Promise.all([
      // Current period status counts
      prisma.order.groupBy({
        by: ["status"],
        _count: { status: true },
        where: {
          createdAt: { gte: startDate },
        },
      }),

      // Previous period status counts for comparison
      prisma.order.groupBy({
        by: ["status"],
        _count: { status: true },
        where: {
          createdAt: {
            gte: previousPeriodStartDate,
            lt: startDate,
          },
        },
      }),
    ]);

    // Helper function to get count by status
    const getCountByStatus = (statusCounts: any[], status: string): number => {
      const found = statusCounts.find((item) => item.status === status);
      return found ? found._count.status : 0;
    };

    // Current period stats
    const currentStats = {
      total: currentPeriodCounts.reduce(
        (sum, item) => sum + item._count.status,
        0
      ),
      pending: getCountByStatus(currentPeriodCounts, "PENDING"),
      processing:
        getCountByStatus(currentPeriodCounts, "PROCESSING") +
        getCountByStatus(currentPeriodCounts, "CONFIRMED"),
      shipped: getCountByStatus(currentPeriodCounts, "SHIPPED"),
      delivered: getCountByStatus(currentPeriodCounts, "DELIVERED"),
      cancelled: getCountByStatus(currentPeriodCounts, "CANCELLED"),
    };

    // Previous period stats for comparison
    const previousStats = {
      total: previousPeriodCounts.reduce(
        (sum, item) => sum + item._count.status,
        0
      ),
      pending: getCountByStatus(previousPeriodCounts, "PENDING"),
      processing:
        getCountByStatus(previousPeriodCounts, "PROCESSING") +
        getCountByStatus(previousPeriodCounts, "CONFIRMED"),
      shipped: getCountByStatus(previousPeriodCounts, "SHIPPED"),
      delivered: getCountByStatus(previousPeriodCounts, "DELIVERED"),
      cancelled: getCountByStatus(previousPeriodCounts, "CANCELLED"),
    };

    return res.status(200).json(
      ResponseHelper.success({
        ...currentStats,
        previousPeriod: previousStats,
        period: days,
      })
    );
  } catch (error) {
    console.error("Get order stats error:", error);
    return res
      .status(500)
      .json(
        ResponseHelper.error(
          "Failed to get order statistics",
          "GET_ORDER_STATS_ERROR"
        )
      );
  }
};

/**
 * Update order details (for editable fields only)
 */
export const updateOrder = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res
        .status(401)
        .json(ResponseHelper.error("Authentication required", "UNAUTHORIZED"));
    }

    const { id } = req.params;

    // Validate input
    const validationResult = updateOrderSchema.safeParse(req.body);
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

    // Check if order exists and is editable
    const existingOrder = await prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!existingOrder) {
      return res
        .status(404)
        .json(ResponseHelper.error("Order not found", "ORDER_NOT_FOUND"));
    }

    // Only allow editing if order is in PENDING or CONFIRMED status
    if (!["PENDING", "CONFIRMED"].includes(existingOrder.status)) {
      return res
        .status(400)
        .json(
          ResponseHelper.error(
            "Order can only be edited in PENDING or CONFIRMED status",
            "ORDER_NOT_EDITABLE"
          )
        );
    }

    const {
      deliveryAddress,
      originalShippingCost,
      shippingDiscount,
      shippingCost,
      totalAmount,
      notes,
      items,
    } = validationResult.data;

    await prisma.$transaction(async (tx) => {
      // Update order basic fields
      const updateData: any = {};

      if (deliveryAddress !== undefined) {
        updateData.deliveryAddress = deliveryAddress;
      }
      if (originalShippingCost !== undefined) {
        updateData.originalShippingCost = originalShippingCost;
      }
      if (shippingDiscount !== undefined) {
        updateData.shippingDiscount = shippingDiscount;
      }
      if (shippingCost !== undefined) {
        updateData.shippingCost = shippingCost;
      }
      if (totalAmount !== undefined) {
        updateData.totalAmount = totalAmount;
      }
      if (notes !== undefined) {
        updateData.notes = notes;
      }

      await tx.order.update({
        where: { id },
        data: updateData,
      });

      // Handle items update for product orders
      if (items && existingOrder.orderType === "PRODUCT") {
        // First, restore stock for existing items
        for (const existingItem of existingOrder.items) {
          if (existingItem.product && !existingItem.product.isDeleted) {
            await tx.product.update({
              where: { id: existingItem.productId },
              data: {
                stockQuantity: {
                  increment: existingItem.quantity,
                },
              },
            });
          }
        }

        // Delete existing items
        await tx.orderItem.deleteMany({
          where: { orderId: id },
        });

        // Create new items with product snapshots
        for (const item of items) {
          const product = await tx.product.findUnique({
            where: { id: item.productId },
            include: {
              productColors: {
                include: {
                  color: true,
                },
              },
              capacity: true,
              productCategories: {
                include: {
                  category: true,
                },
              },
            },
          });

          // Fetch product images separately if needed
          const productImages = await tx.productImage.findMany({
            where: { productId: item.productId },
            orderBy: { order: "asc" },
          });

          if (!product) {
            throw new Error(`Product ${item.productId} not found`);
          }

          if (product.stockQuantity < item.quantity) {
            throw new Error(
              `Insufficient stock for product ${product.name}. Available: ${product.stockQuantity}, Required: ${item.quantity}`
            );
          }

          // Create product snapshot
          const productSnapshot = {
            id: product.id,
            name: product.name,
            slug: product.slug,
            description: product.description,
            images: productImages,
            unitPrice: item.unitPrice || 0,
            requestedColor: item.requestedColor,
            colors: product.productColors.map((pc) => ({
              id: pc.color.id,
              name: pc.color.name,
              hexCode: pc.color.hexCode,
            })),
            capacity: {
              id: product.capacity.id,
              name: product.capacity.name,
              volumeMl: product.capacity.volumeMl,
            },
            categories: product.productCategories.map((pc) => ({
              id: pc.category.id,
              name: pc.category.name,
              slug: pc.category.slug,
            })),
            capturedAt: new Date().toISOString(),
          };

          // Create order item
          await tx.orderItem.create({
            data: {
              orderId: id,
              productId: item.productId,
              quantity: item.quantity,
              productSnapshot,
            },
          });

          // Update product stock
          await tx.product.update({
            where: { id: item.productId },
            data: {
              stockQuantity: {
                decrement: item.quantity,
              },
              // Update product's base price if requested
              ...(item.updateBasePrice &&
                item.unitPrice && {
                  unitPrice: item.unitPrice,
                }),
            },
          });
        }
      }

      // Recalculate total amount if items were updated
      if (items && items.length > 0) {
        const newTotalAmount = items.reduce((total, item) => {
          return total + item.quantity * (item.unitPrice || 0);
        }, 0);

        await tx.order.update({
          where: { id },
          data: {
            totalAmount: newTotalAmount,
          },
        });
      }
    });

    // Fetch updated order
    const updatedOrder = await prisma.order.findUnique({
      where: { id },
      include: {
        customer: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            messengerId: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                slug: true,
                isActive: true,
                isDeleted: true,
              },
            },
          },
        },
        _count: {
          select: {
            items: true,
          },
        },
      },
    });

    return res.status(200).json(ResponseHelper.success(updatedOrder));
  } catch (error) {
    console.error("Update order error:", error);
    return res
      .status(500)
      .json(
        ResponseHelper.error(
          "Failed to update order",
          "UPDATE_ORDER_ERROR",
          error instanceof Error ? error.message : undefined
        )
      );
  }
};

/**
 * Get recent orders for dashboard
 */
export const getRecentOrders = async (req: Request, res: Response) => {
  try {
    const { limit = "10" } = req.query;
    const limitNum = parseInt(limit as string);

    const orders = await prisma.order.findMany({
      take: limitNum,
      orderBy: { createdAt: "desc" },
      include: {
        customer: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            messengerId: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
          take: 1, // Only first item for display
        },
      },
    });

    // Transform data for frontend
    const recentOrders = orders.map((order) => ({
      id: order.id,
      customerName: order.customer.fullName,
      productName: order.items[0]?.product?.name || null,
      orderType: order.orderType.toLowerCase(), // Convert PRODUCT/CUSTOM to product/custom
      status: order.status.toLowerCase(), // Convert to lowercase for frontend
      totalAmount: order.totalAmount,
      createdAt: order.createdAt.toISOString(),
    }));

    return res
      .status(200)
      .json(ResponseHelper.success({ orders: recentOrders }));
  } catch (error) {
    console.error("Get recent orders error:", error);
    return res
      .status(500)
      .json(
        ResponseHelper.error(
          "Failed to get recent orders",
          "GET_RECENT_ORDERS_ERROR"
        )
      );
  }
};
