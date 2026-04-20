import { logger } from "@/utils/logger";
import { Request, Response } from "express";
import { models, OrderType, OrderStatus } from "../models";

const {
  Order,
  OrderItem,
  Customer,
  CustomerPhone,
  Product,
  ProductImage,
  Capacity,
  Category,
  ProductCategory,
  ProductColor,
  Color,
} = models;

import { ResponseHelper } from "../types/api";
import { z } from "zod";
import { sequelize } from "../config/database";
import { Op } from "sequelize";

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
  paymentMethod: z
    .enum([
      "cash",
      "credit_card",
      "debit_card",
      "bank_transfer",
      "momo",
      "zalopay",
    ])
    .optional(),
  shippingAddress: z
    .object({
      fullName: z.string().min(1, "Full name is required"),
      phoneNumber: z.string().min(1, "Phone number is required"),
      addressLine1: z.string().min(1, "Address line 1 is required"),
      addressLine2: z.string().optional(),
      district: z.string().optional(),
      city: z.string().min(1, "City is required"),
      postalCode: z.string().optional(),
    })
    .optional(),
  notes: z.string().optional(),
  orderItems: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.coerce.number().int().positive(),
      })
    )
    .optional(),
  originalShippingCost: z.number().nonnegative().optional(),
  shippingDiscount: z.number().nonnegative().optional(),
  shippingCost: z.number().nonnegative().optional(),
});

/**
 * Generate unique order number (must be called inside a transaction)
 */
async function generateOrderNumber(transaction?: any): Promise<string> {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");

  // Count orders created today within the transaction to prevent race conditions
  const startOfDay = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

  const todayOrderCount = await Order.count({
    where: {
      createdAt: {
        [Op.gte]: startOfDay,
        [Op.lt]: endOfDay,
      },
    },
    ...(transaction ? { transaction, lock: true } : {}),
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
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    const where: any = {};

    if (status !== "all") {
      where.status = (status as string).toUpperCase();
    }

    if (customerId) {
      where.customerId = customerId;
    }

    if (orderType !== "all") {
      where.orderType = (orderType as string).toUpperCase();
    }

    if (search) {
      where[Op.or] = [{ orderNumber: { [Op.like]: `%${search}%` } }];
    }

    // Date range filtering
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) {
        where.createdAt[Op.gte] = new Date(dateFrom as string);
      }
      if (dateTo) {
        // Add 1 day to include the end date
        const endDate = new Date(dateTo as string);
        endDate.setDate(endDate.getDate() + 1);
        where.createdAt[Op.lt] = endDate;
      }
    }

    const [orders, totalCount] = await Promise.all([
      Order.findAll({
        where,
        include: [
          {
            model: Customer,
            as: "customer",
            attributes: ["id", "fullName"],
            include: [
              {
                model: CustomerPhone,
                as: "customerPhones",
                attributes: ["id", "phoneNumber", "isMain"],
              },
            ],
          },
          {
            model: OrderItem,
            as: "items",
            include: [
              {
                model: Product,
                as: "product",
                attributes: ["id", "name", "slug"],
              },
            ],
          },
        ],
        order: [["createdAt", "DESC"]],
        offset,
        limit: limitNum,
      }),
      Order.count({ where }),
    ]);

    const totalPages = Math.ceil(totalCount / limitNum);

    // Add _count.items for frontend compatibility
    const ordersWithCount = orders.map((order) => {
      const orderJson = order.toJSON() as any;
      return {
        ...orderJson,
        _count: {
          items: orderJson.items?.length || 0,
        },
      };
    });

    return res.status(200).json(
      ResponseHelper.paginated(ordersWithCount, {
        current_page: pageNum,
        per_page: limitNum,
        total_pages: totalPages,
        total_items: totalCount,
        has_next: pageNum < totalPages,
        has_prev: pageNum > 1,
      })
    );
  } catch (error: any) {
    logger.error("Get orders error:", error);
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

    const order = await Order.findByPk(id, {
      include: [
        {
          model: Customer,
          as: "customer",
          attributes: ["id", "fullName", "messengerId", "zaloId"],
          include: [
            {
              model: CustomerPhone,
              as: "customerPhones",
              attributes: ["id", "phoneNumber", "isMain"],
            },
          ],
        },
        {
          model: OrderItem,
          as: "items",
          attributes: [
            "id",
            "orderId",
            "productId",
            "quantity",
            "productSnapshot",
            "createdAt",
            "updatedAt",
          ],
          // We don't need to include Product associations anymore since we use productSnapshot
          // But we can still include basic product info for reference (optional)
          include: [
            {
              model: Product,
              as: "product",
              attributes: ["id", "name", "slug"],
              required: false, // Make it optional in case product was deleted
            },
          ],
        },
      ],
    });

    if (!order) {
      return res
        .status(404)
        .json(ResponseHelper.error("Order not found", "ORDER_NOT_FOUND"));
    }

    return res.status(200).json(ResponseHelper.success(order));
  } catch (error: any) {
    logger.error("Get order error:", error);
    return res
      .status(500)
      .json(
        ResponseHelper.error("Failed to retrieve order", "GET_ORDER_ERROR")
      );
  }
};

/**
 * Create new order
 */
export const createOrder = async (req: Request, res: Response) => {
  try {
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
      orderType,
      deliveryAddress,
      customDescription,
      totalAmount,
      notes,
      items,
      originalShippingCost = 0,
      shippingDiscount = 0,
    } = validationResult.data;

    // Calculate shipping cost
    const shippingCost = Math.max(0, originalShippingCost - shippingDiscount);

    // Create order with items in a transaction (stock check + snapshot inside transaction)
    const order = await sequelize.transaction(async (t) => {
      let calculatedTotalAmount = totalAmount || 0;
      const orderItems: any[] = [];

      if (orderType === "product" && items && items.length > 0) {
        // Validate products and calculate total inside transaction with row lock
        for (const item of items) {
          // Lock the product row to prevent concurrent stock modifications
          const product = await Product.findByPk(item.productId, {
            transaction: t,
            lock: t.LOCK.UPDATE,
          });

          if (!product) {
            throw { status: 400, code: "PRODUCT_NOT_FOUND", message: `Product with ID ${item.productId} not found` };
          }

          if (product.stockQuantity < item.quantity) {
            throw { status: 400, code: "INSUFFICIENT_STOCK", message: `Insufficient stock for product ${product.name}. Available: ${product.stockQuantity}, Requested: ${item.quantity}` };
          }

          // Load associations inside transaction
          const [capacity, productCategories, productColors, productImages] =
            await Promise.all([
              product.capacityId ? Capacity.findByPk(product.capacityId, { transaction: t }) : null,
              ProductCategory.findAll({
                where: { productId: item.productId },
                include: [{ model: Category, as: "category" }],
                transaction: t,
              }),
              ProductColor.findAll({
                where: { productId: item.productId },
                include: [{ model: Color, as: "color" }],
                transaction: t,
              }),
              ProductImage.findAll({
                where: { productId: item.productId },
                limit: 1,
                order: [["createdAt", "ASC"]],
                transaction: t,
              }),
            ]);

          const unitPrice = item.unitPrice || product.unitPrice;
          const itemTotal = unitPrice * item.quantity;
          calculatedTotalAmount += itemTotal;

          // Create complete product snapshot for historical record
          const productSnapshot = {
            id: product.id,
            name: product.name,
            slug: product.slug,
            description: product.description,
            basePrice: product.unitPrice,
            unitPrice,
            requestedColor: item.requestedColor,
            capacity: capacity
              ? { id: capacity.id, name: capacity.name, slug: capacity.slug, volumeMl: capacity.volumeMl }
              : null,
            categories: productCategories
              .filter((pc) => pc.category)
              .map((pc) => ({ id: pc.category.id, name: pc.category.name, slug: pc.category.slug })),
            colors: productColors
              .filter((pc) => pc.color)
              .map((pc) => ({ id: pc.color.id, name: pc.color.name, slug: pc.color.slug, hexCode: pc.color.hexCode })),
            image: productImages.length > 0
              ? { id: productImages[0].id, url: productImages[0].url, altText: productImages[0].altText }
              : null,
            snapshotCreatedAt: new Date().toISOString(),
          };

          orderItems.push({ productId: item.productId, quantity: item.quantity, productSnapshot });

          // Update stock immediately (row is already locked)
          await product.update(
            { stockQuantity: product.stockQuantity - item.quantity },
            { transaction: t }
          );
        }
      }

      // Add shipping cost to total
      calculatedTotalAmount += shippingCost;

      // Generate order number inside transaction to prevent race conditions
      const orderNumber = await generateOrderNumber(t);

      // Convert orderType to proper enum
      const orderTypeEnum =
        orderType === "product" ? OrderType.PRODUCT : OrderType.CUSTOM;

      const newOrder = await Order.create(
        {
          orderNumber,
          customerId,
          orderType: orderTypeEnum,
          deliveryAddress,
          customDescription,
          notes,
          totalAmount: calculatedTotalAmount,
          originalShippingCost,
          shippingDiscount,
          shippingCost,
          status: OrderStatus.PENDING,
        },
        { transaction: t }
      );

      // Create order items
      if (orderItems.length > 0) {
        await OrderItem.bulkCreate(
          orderItems.map((item) => ({
            orderId: newOrder.id,
            productId: item.productId,
            quantity: item.quantity,
            productSnapshot: item.productSnapshot,
          })),
          { transaction: t }
        );
      }

      return newOrder;
    });

    // Fetch the created order with associations
    const createdOrder = await Order.findByPk(order.id, {
      include: [
        {
          model: Customer,
          as: "customer",
          attributes: ["id", "fullName"],
          include: [
            {
              model: CustomerPhone,
              as: "customerPhones",
              attributes: ["id", "phoneNumber", "isMain"],
            },
          ],
        },
        {
          model: OrderItem,
          as: "items",
          include: [
            {
              model: Product,
              as: "product",
              attributes: ["id", "name", "slug"],
            },
          ],
        },
      ],
    });

    return res.status(201).json(ResponseHelper.success(createdOrder));
  } catch (error: any) {
    logger.error("Create order error:", error);

    // Handle custom validation errors thrown from inside transaction
    if (error.status && error.code) {
      return res
        .status(error.status)
        .json(ResponseHelper.error(error.message, error.code));
    }

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

    // Find existing order with items (use separate query for reliability)
    const existingOrder = await Order.findByPk(id);
    if (!existingOrder) {
      return res
        .status(404)
        .json(ResponseHelper.error("Order not found", "ORDER_NOT_FOUND"));
    }

    // Load order items separately for better reliability
    const orderItems = await OrderItem.findAll({
      where: { orderId: id },
      attributes: ["id", "productId", "quantity", "productSnapshot"],
    });

    // Handle stock restoration for cancelled orders
    const newStatus = OrderStatus[status as keyof typeof OrderStatus];

    if (
      newStatus === OrderStatus.CANCELLED &&
      existingOrder.status !== OrderStatus.CANCELLED
    ) {
      await sequelize.transaction(async (t) => {
        // Restore product stock
        if (orderItems && orderItems.length > 0) {
          for (const item of orderItems) {
            // Find the current product by productId (don't rely on item.product association)
            const currentProduct = await Product.findByPk(item.productId, {
              transaction: t,
            });

            if (currentProduct) {
              const currentStock = currentProduct.stockQuantity;
              const newStock = currentStock + item.quantity;

              // Get product name from snapshot or current product
              const productName =
                item.productSnapshot?.name ||
                currentProduct.name ||
                "Unknown Product";

              await currentProduct.update(
                {
                  stockQuantity: newStock,
                },
                { transaction: t }
              );
            }
          }
        }

        // Update order status
        await existingOrder.update(
          {
            status: newStatus,
            notes,
          },
          { transaction: t }
        );
      });
    } else {
      // Just update status for other cases
      await existingOrder.update({
        status: newStatus,
        notes,
      });
    }

    // Fetch updated order
    const updatedOrder = await Order.findByPk(id, {
      include: [
        {
          model: Customer,
          as: "customer",
          attributes: ["id", "fullName"],
          include: [
            {
              model: CustomerPhone,
              as: "customerPhones",
              attributes: ["id", "phoneNumber", "isMain"],
            },
          ],
        },
        {
          model: OrderItem,
          as: "items",
          include: [
            {
              model: Product,
              as: "product",
              attributes: ["id", "name", "slug"],
            },
          ],
        },
      ],
    });

    return res.status(200).json(ResponseHelper.success(updatedOrder));
  } catch (error: any) {
    logger.error("Update order status error:", error);
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
 * Delete order (admin only)
 */
export const deleteOrder = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const existingOrder = await Order.findByPk(id, {
      include: [
        {
          model: OrderItem,
          as: "items",
          include: [
            {
              model: Product,
              as: "product",
            },
          ],
        },
      ],
    });

    if (!existingOrder) {
      return res
        .status(404)
        .json(ResponseHelper.error("Order not found", "ORDER_NOT_FOUND"));
    }

    await sequelize.transaction(async (t) => {
      // Restore product stock if order was not cancelled
      if (
        existingOrder.status !== OrderStatus.CANCELLED &&
        existingOrder.items
      ) {
        for (const item of existingOrder.items) {
          if (item.product) {
            await item.product.update(
              {
                stockQuantity: item.product.stockQuantity + item.quantity,
              },
              { transaction: t }
            );
          }
        }
      }

      // Delete order items first
      await OrderItem.destroy({
        where: { orderId: id },
        transaction: t,
      });

      // Delete order
      await existingOrder.destroy({ transaction: t });
    });

    return res
      .status(200)
      .json(ResponseHelper.success({ message: "Order deleted successfully" }));
  } catch (error: any) {
    logger.error("Delete order error:", error);
    return res
      .status(500)
      .json(
        ResponseHelper.error("Failed to delete order", "DELETE_ORDER_ERROR")
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

    const currentPeriodWhere = {
      createdAt: { [Op.gte]: startDate },
    };
    const previousPeriodWhere = {
      createdAt: {
        [Op.gte]: previousPeriodStartDate,
        [Op.lt]: startDate,
      },
    };

    // Aggregate directly in SQL instead of loading full order rows into Node memory
    const [
      currentTotalOrders,
      currentTotalRevenueRaw,
      previousTotalOrders,
      previousTotalRevenueRaw,
      currentStatusRows,
    ] = await Promise.all([
      Order.count({ where: currentPeriodWhere }),
      Order.sum("totalAmount", { where: currentPeriodWhere }),
      Order.count({ where: previousPeriodWhere }),
      Order.sum("totalAmount", { where: previousPeriodWhere }),
      Order.findAll({
        where: currentPeriodWhere,
        attributes: [
          "status",
          [sequelize.fn("COUNT", sequelize.col("id")), "count"],
        ],
        group: ["status"],
        raw: true,
      }),
    ]);

    const currentTotalRevenue = Number(currentTotalRevenueRaw || 0);
    const previousTotalRevenue = Number(previousTotalRevenueRaw || 0);

    const statusCounts = (currentStatusRows as unknown as Array<{ status: string; count: number | string }>)
      .reduce((counts: Record<string, number>, row) => {
        counts[row.status] = Number(row.count || 0);
        return counts;
      }, {});

    // Calculate current period stats
    const currentStats = {
      totalOrders: currentTotalOrders,
      totalRevenue: currentTotalRevenue,
      statusCounts,
      averageOrderValue:
        currentTotalOrders > 0
          ? currentTotalRevenue / currentTotalOrders
          : 0,
    };

    // Calculate previous period stats
    const previousStats = {
      totalOrders: previousTotalOrders,
      totalRevenue: previousTotalRevenue,
      averageOrderValue:
        previousTotalOrders > 0
          ? previousTotalRevenue / previousTotalOrders
          : 0,
    };

    // Calculate growth percentages
    const growth = {
      orders:
        previousStats.totalOrders > 0
          ? ((currentStats.totalOrders - previousStats.totalOrders) /
              previousStats.totalOrders) *
            100
          : 0,
      revenue:
        previousStats.totalRevenue > 0
          ? ((currentStats.totalRevenue - previousStats.totalRevenue) /
              previousStats.totalRevenue) *
            100
          : 0,
      averageOrderValue:
        previousStats.averageOrderValue > 0
          ? ((currentStats.averageOrderValue -
              previousStats.averageOrderValue) /
              previousStats.averageOrderValue) *
            100
          : 0,
    };

    return res.status(200).json(
      ResponseHelper.success({
        period: days,
        currentPeriod: currentStats,
        previousPeriod: previousStats,
        growth,
      })
    );
  } catch (error) {
    logger.error("Get order stats error:", error);
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
 * Update order details
 */
export const updateOrder = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res
        .status(401)
        .json(ResponseHelper.error("Authentication required", "UNAUTHORIZED"));
    }

    const { id } = req.params;
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

    const updateData = validationResult.data;

    // Update order in transaction
    const updatedOrder = await sequelize.transaction(async (t) => {
      const existingOrder = await Order.findByPk(id, {
        include: [
          {
            model: OrderItem,
            as: "items",
            include: [
              {
                model: Product,
                as: "product",
              },
            ],
          },
        ],
        transaction: t,
      });

      if (!existingOrder) {
        throw new Error("Order not found");
      }

      // Update basic order fields
      await existingOrder.update(
        {
          notes: updateData.notes,
          deliveryAddress: updateData.shippingAddress,
          shippingCost: updateData.shippingCost || existingOrder.shippingCost,
          originalShippingCost:
            updateData.originalShippingCost ||
            existingOrder.originalShippingCost,
          shippingDiscount:
            updateData.shippingDiscount || existingOrder.shippingDiscount,
        },
        { transaction: t }
      );

      // Update order items if provided
      if (updateData.orderItems) {
        // Restore stock for old items before removing them (only if order is not cancelled)
        if (
          existingOrder.status !== "CANCELLED" &&
          existingOrder.items &&
          existingOrder.items.length > 0
        ) {
          for (const oldItem of existingOrder.items) {
            if (oldItem.product) {
              await oldItem.product.update(
                { stockQuantity: oldItem.product.stockQuantity + oldItem.quantity },
                { transaction: t }
              );
            }
          }
        }

        // Remove existing order items
        await OrderItem.destroy({
          where: { orderId: id },
          transaction: t,
        });

        // Add new order items and calculate totals
        let subtotal = 0;
        for (const item of updateData.orderItems) {
          const product = await Product.findByPk(item.productId, {
            transaction: t,
            lock: t.LOCK.UPDATE,
          });
          if (!product) {
            throw new Error(`Product not found: ${item.productId}`);
          }

          if (product.stockQuantity < item.quantity) {
            throw new Error(`Insufficient stock for product ${product.name}. Available: ${product.stockQuantity}, Requested: ${item.quantity}`);
          }

          const itemTotal =
            item.quantity * parseFloat(product.unitPrice.toString());
          subtotal += itemTotal;

          await OrderItem.create(
            {
              orderId: id,
              productId: item.productId,
              quantity: item.quantity,
              productSnapshot: {
                name: product.name,
                unitPrice: product.unitPrice,
                totalPrice: itemTotal,
              },
            },
            { transaction: t }
          );

          // Deduct stock for new items (only if order is not cancelled)
          if (existingOrder.status !== "CANCELLED") {
            await product.update(
              { stockQuantity: product.stockQuantity - item.quantity },
              { transaction: t }
            );
          }
        }

        // Update order totals
        const shippingCost =
          updateData.shippingCost || existingOrder.shippingCost || 0;
        const totalAmount = subtotal + shippingCost;
        await existingOrder.update(
          {
            totalAmount,
          },
          { transaction: t }
        );
      }

      return Order.findByPk(id, {
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
          {
            model: Customer,
            as: "customer",
            attributes: ["id", "firstName", "lastName", "email", "phoneNumber"],
          },
        ],
        transaction: t,
      });
    });

    return res.status(200).json(ResponseHelper.success(updatedOrder));
  } catch (error: any) {
    logger.error("Update order error:", error);

    if (error.message.includes("not found")) {
      return res
        .status(404)
        .json(ResponseHelper.error(error.message, "NOT_FOUND"));
    }

    return res
      .status(500)
      .json(
        ResponseHelper.error("Failed to update order", "UPDATE_ORDER_ERROR")
      );
  }
};

/**
 * Get recent orders
 */
export const getRecentOrders = async (req: Request, res: Response) => {
  try {
    const { limit = "10" } = req.query;
    const limitNum = parseInt(limit as string);

    const recentOrders = await Order.findAll({
      limit: limitNum,
      order: [["createdAt", "DESC"]],
      include: [
        {
          model: Customer,
          as: "customer",
          attributes: ["id", "fullName"],
          include: [
            {
              model: CustomerPhone,
              as: "customerPhones",
              attributes: ["id", "phoneNumber", "isMain"],
            },
          ],
        },
        {
          model: OrderItem,
          as: "items",
          include: [
            {
              model: Product,
              as: "product",
              attributes: ["id", "name", "slug"],
            },
          ],
        },
      ],
    });

    // Convert Sequelize instances to plain objects
    const plainOrders = recentOrders.map((order) => order.toJSON());

    // Transform data to match frontend interface expectations
    const transformedOrders = plainOrders.map((order: any) => {
      let productName = null;

      if (order.items && order.items.length > 0) {
        if (order.items.length === 1) {
          // Chỉ có 1 sản phẩm
          const item = order.items[0];
          productName =
            item?.productSnapshot?.name || item?.product?.name || null;
        } else {
          // Có nhiều sản phẩm
          const firstItem = order.items[0];
          const firstName =
            firstItem?.productSnapshot?.name ||
            firstItem?.product?.name ||
            "Sản phẩm";
          const otherCount = order.items.length - 1;
          productName = `${firstName} + ${otherCount} sản phẩm khác`;
        }
      }

      return {
        id: order.id,
        customerName: order.customer?.fullName || "Unknown Customer",
        productName: productName,
        orderType: order.orderType?.toLowerCase() || "product",
        status: order.status?.toLowerCase() || "pending",
        totalAmount: parseFloat(order.totalAmount || "0"),
        createdAt: order.createdAt,
      };
    });

    return res.status(200).json(ResponseHelper.success(transformedOrders));
  } catch (error) {
    logger.error("Get recent orders error:", error);
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

// Export additional functions that might be needed
export { generateOrderNumber };
