import { Op, WhereOptions, Transaction } from "sequelize";
import { sequelize } from "../config/database";
import { models, OrderType, OrderStatus } from "../models";
import { ServiceError } from "../utils/service-error";

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

// ── Shared include configs ────────────────────────────────────────────────────

const ORDER_WITH_CUSTOMER_AND_ITEMS = [
  {
    model: Customer,
    as: "customer",
    attributes: ["id", "fullName"],
    include: [
      { model: CustomerPhone, as: "customerPhones", attributes: ["id", "phoneNumber", "isMain"] },
    ],
  },
  {
    model: OrderItem,
    as: "items",
    include: [{ model: Product, as: "product", attributes: ["id", "name", "slug"] }],
  },
];

const ORDER_WITH_FULL_CUSTOMER = [
  {
    model: Customer,
    as: "customer",
    attributes: ["id", "fullName", "messengerId", "zaloId"],
    include: [
      { model: CustomerPhone, as: "customerPhones", attributes: ["id", "phoneNumber", "isMain"] },
    ],
  },
  {
    model: OrderItem,
    as: "items",
    attributes: ["id", "orderId", "productId", "quantity", "productSnapshot", "createdAt", "updatedAt"],
    include: [{ model: Product, as: "product", attributes: ["id", "name", "slug"], required: false }],
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

export async function generateOrderNumber(transaction?: Transaction): Promise<string> {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");

  const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

  const todayOrderCount = await Order.count({
    where: { createdAt: { [Op.gte]: startOfDay, [Op.lt]: endOfDay } },
    ...(transaction ? { transaction, lock: true } : {}),
  });

  const sequence = (todayOrderCount + 1).toString().padStart(4, "0");
  return `ORD${year}${month}${day}${sequence}`;
}

// ── Service methods ───────────────────────────────────────────────────────────

export async function findOrders(filters: {
  page?: string | number;
  limit?: string | number;
  status?: string;
  customerId?: string;
  orderType?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  const {
    page = "1",
    limit = "20",
    status = "all",
    customerId,
    orderType = "all",
    search = "",
    dateFrom,
    dateTo,
  } = filters;

  const pageNum = parseInt(String(page));
  const limitNum = parseInt(String(limit));
  const offset = (pageNum - 1) * limitNum;

  const where: WhereOptions = {};
  if (status !== "all") (where as Record<string, unknown>)["status"] = (status as string).toUpperCase();
  if (customerId) (where as Record<string, unknown>)["customerId"] = customerId;
  if (orderType !== "all") (where as Record<string, unknown>)["orderType"] = (orderType as string).toUpperCase();
  if (search) Object.assign(where, { [Op.or]: [{ orderNumber: { [Op.like]: `%${search}%` } }] });
  if (dateFrom || dateTo) {
    const createdAt: WhereOptions = {};
    if (dateFrom) Object.assign(createdAt, { [Op.gte]: new Date(dateFrom as string) });
    if (dateTo) {
      const endDate = new Date(dateTo as string);
      endDate.setDate(endDate.getDate() + 1);
      Object.assign(createdAt, { [Op.lt]: endDate });
    }
    (where as Record<string, unknown>)["createdAt"] = createdAt;
  }

  const [orders, totalCount] = await Promise.all([
    Order.findAll({ where, include: ORDER_WITH_CUSTOMER_AND_ITEMS, order: [["createdAt", "DESC"]], offset, limit: limitNum }),
    Order.count({ where }),
  ]);

  const totalPages = Math.ceil(totalCount / limitNum);
  const ordersWithCount = orders.map((order) => {
    const json = order.toJSON() as unknown as Record<string, unknown> & { items?: unknown[] };
    return { ...json, _count: { items: json.items?.length ?? 0 } };
  });

  return {
    items: ordersWithCount,
    pagination: {
      current_page: pageNum,
      per_page: limitNum,
      total_pages: totalPages,
      total_items: totalCount,
      has_next: pageNum < totalPages,
      has_prev: pageNum > 1,
    },
  };
}

export async function findOrderById(id: string) {
  const order = await Order.findByPk(id, { include: ORDER_WITH_FULL_CUSTOMER });
  if (!order) throw new ServiceError(404, "ORDER_NOT_FOUND", "Order not found");
  return order;
}

export async function createOrder(data: {
  customerId: string;
  orderType: string;
  deliveryAddress: Record<string, unknown>;
  customDescription?: string;
  totalAmount?: number;
  notes?: string;
  items?: Array<{ productId: string; quantity: number; unitPrice?: number; requestedColor?: string }>;
  originalShippingCost?: number;
  shippingDiscount?: number;
}) {
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
  } = data;

  const shippingCost = Math.max(0, originalShippingCost - shippingDiscount);

  const order = await sequelize.transaction(async (t) => {
    let calculatedTotalAmount = totalAmount || 0;
    const orderItems: Array<{ productId: string; quantity: number; productSnapshot: Record<string, unknown> }> = [];

    if (orderType === "product" && items && items.length > 0) {
      for (const item of items) {
        const product = await Product.findByPk(item.productId, { transaction: t, lock: t.LOCK.UPDATE });

        if (!product) {
          throw new ServiceError(400, "PRODUCT_NOT_FOUND", `Product with ID ${item.productId} not found`);
        }
        if (product.stockQuantity < item.quantity) {
          throw new ServiceError(400, "INSUFFICIENT_STOCK", `Insufficient stock for product ${product.name}. Available: ${product.stockQuantity}, Requested: ${item.quantity}`);
        }

        const [capacity, productCategories, productColors, productImages] = await Promise.all([
          product.capacityId ? Capacity.findByPk(product.capacityId, { transaction: t }) : null,
          ProductCategory.findAll({ where: { productId: item.productId }, include: [{ model: Category, as: "category" }], transaction: t }),
          ProductColor.findAll({ where: { productId: item.productId }, include: [{ model: Color, as: "color" }], transaction: t }),
          ProductImage.findAll({ where: { productId: item.productId }, limit: 1, order: [["createdAt", "ASC"]], transaction: t }),
        ]);

        const unitPrice = item.unitPrice || product.unitPrice;
        calculatedTotalAmount += unitPrice * item.quantity;

        const productSnapshot = {
          id: product.id,
          name: product.name,
          slug: product.slug,
          description: product.description,
          basePrice: product.unitPrice,
          unitPrice,
          requestedColor: item.requestedColor,
          capacity: capacity ? { id: capacity.id, name: capacity.name, slug: capacity.slug, volumeMl: capacity.volumeMl } : null,
          categories: productCategories.filter((pc) => pc.category).map((pc) => ({ id: pc.category!.id, name: pc.category!.name, slug: pc.category!.slug })),
          colors: productColors.filter((pc) => pc.color).map((pc) => ({ id: pc.color!.id, name: pc.color!.name, slug: pc.color!.slug, hexCode: pc.color!.hexCode })),
          image: productImages.length > 0 ? { id: productImages[0].id, url: productImages[0].url, altText: productImages[0].altText } : null,
          snapshotCreatedAt: new Date().toISOString(),
        };

        orderItems.push({ productId: item.productId, quantity: item.quantity, productSnapshot });
        await product.update({ stockQuantity: product.stockQuantity - item.quantity }, { transaction: t });
      }
    }

    calculatedTotalAmount += shippingCost;
    const orderNumber = await generateOrderNumber(t);
    const orderTypeEnum = orderType === "product" ? OrderType.PRODUCT : OrderType.CUSTOM;

    const newOrder = await Order.create(
      { orderNumber, customerId, orderType: orderTypeEnum, deliveryAddress, customDescription, notes, totalAmount: calculatedTotalAmount, originalShippingCost, shippingDiscount, shippingCost, status: OrderStatus.PENDING },
      { transaction: t }
    );

    if (orderItems.length > 0) {
      await OrderItem.bulkCreate(
        orderItems.map((item) => ({ orderId: newOrder.id, productId: item.productId, quantity: item.quantity, productSnapshot: item.productSnapshot })),
        { transaction: t }
      );
    }

    return newOrder;
  });

  return Order.findByPk(order.id, { include: ORDER_WITH_CUSTOMER_AND_ITEMS });
}

export async function updateOrderStatus(id: string, status: string, notes?: string) {
  const existingOrder = await Order.findByPk(id);
  if (!existingOrder) throw new ServiceError(404, "ORDER_NOT_FOUND", "Order not found");

  const orderItems = await OrderItem.findAll({
    where: { orderId: id },
    attributes: ["id", "productId", "quantity", "productSnapshot"],
  });

  const newStatus = OrderStatus[status as keyof typeof OrderStatus];

  if (newStatus === OrderStatus.CANCELLED && existingOrder.status !== OrderStatus.CANCELLED) {
    await sequelize.transaction(async (t) => {
      for (const item of orderItems) {
        const product = await Product.findByPk(item.productId, { transaction: t, lock: t.LOCK.UPDATE });
        if (product) {
          await product.update({ stockQuantity: product.stockQuantity + item.quantity }, { transaction: t });
        }
      }
      await existingOrder.update({ status: newStatus, notes }, { transaction: t });
    });
  } else {
    await existingOrder.update({ status: newStatus, notes });
  }

  return Order.findByPk(id, { include: ORDER_WITH_CUSTOMER_AND_ITEMS });
}

export async function deleteOrder(id: string) {
  const existingOrder = await Order.findByPk(id, {
    include: [{ model: OrderItem, as: "items", include: [{ model: Product, as: "product" }] }],
  });
  if (!existingOrder) throw new ServiceError(404, "ORDER_NOT_FOUND", "Order not found");

  await sequelize.transaction(async (t) => {
    if (existingOrder.status !== OrderStatus.CANCELLED && existingOrder.items) {
      for (const item of existingOrder.items) {
        if (item.product) {
          await item.product.update({ stockQuantity: item.product.stockQuantity + item.quantity }, { transaction: t });
        }
      }
    }
    await OrderItem.destroy({ where: { orderId: id }, transaction: t });
    await existingOrder.destroy({ transaction: t });
  });
}

export async function getOrderStats(period: number) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - period);

  const previousPeriodStart = new Date(startDate);
  previousPeriodStart.setDate(previousPeriodStart.getDate() - period);

  const currentWhere = { createdAt: { [Op.gte]: startDate } };
  const previousWhere = { createdAt: { [Op.gte]: previousPeriodStart, [Op.lt]: startDate } };

  const [currentTotal, currentRevenueRaw, previousTotal, previousRevenueRaw, statusRows] = await Promise.all([
    Order.count({ where: currentWhere }),
    Order.sum("totalAmount", { where: currentWhere }),
    Order.count({ where: previousWhere }),
    Order.sum("totalAmount", { where: previousWhere }),
    Order.findAll({
      where: currentWhere,
      attributes: ["status", [sequelize.fn("COUNT", sequelize.col("id")), "count"]],
      group: ["status"],
      raw: true,
    }),
  ]);

  const currentRevenue = Number(currentRevenueRaw || 0);
  const previousRevenue = Number(previousRevenueRaw || 0);

  const statusCounts = (statusRows as unknown as Array<{ status: string; count: number | string }>)
    .reduce((acc, row) => { acc[row.status] = Number(row.count || 0); return acc; }, {} as Record<string, number>);

  const calcGrowth = (curr: number, prev: number) => prev > 0 ? ((curr - prev) / prev) * 100 : 0;

  const currentAvg = currentTotal > 0 ? currentRevenue / currentTotal : 0;
  const previousAvg = previousTotal > 0 ? previousRevenue / previousTotal : 0;

  return {
    period,
    currentPeriod: { totalOrders: currentTotal, totalRevenue: currentRevenue, statusCounts, averageOrderValue: currentAvg },
    previousPeriod: { totalOrders: previousTotal, totalRevenue: previousRevenue, averageOrderValue: previousAvg },
    growth: {
      orders: calcGrowth(currentTotal, previousTotal),
      revenue: calcGrowth(currentRevenue, previousRevenue),
      averageOrderValue: calcGrowth(currentAvg, previousAvg),
    },
  };
}

export async function updateOrder(id: string, data: {
  notes?: string;
  shippingAddress?: Record<string, unknown>;
  shippingCost?: number;
  originalShippingCost?: number;
  shippingDiscount?: number;
  orderItems?: Array<{ productId: string; quantity: number }>;
}) {
  return sequelize.transaction(async (t) => {
    const existingOrder = await Order.findByPk(id, {
      include: [{ model: OrderItem, as: "items", include: [{ model: Product, as: "product" }] }],
      transaction: t,
    });
    if (!existingOrder) throw new ServiceError(404, "ORDER_NOT_FOUND", "Order not found");

    await existingOrder.update(
      {
        notes: data.notes,
        deliveryAddress: data.shippingAddress,
        shippingCost: data.shippingCost ?? existingOrder.shippingCost,
        originalShippingCost: data.originalShippingCost ?? existingOrder.originalShippingCost,
        shippingDiscount: data.shippingDiscount ?? existingOrder.shippingDiscount,
      },
      { transaction: t }
    );

    if (data.orderItems) {
      if (existingOrder.status !== "CANCELLED" && existingOrder.items?.length) {
        for (const oldItem of existingOrder.items) {
          if (oldItem.product) {
            await oldItem.product.update({ stockQuantity: oldItem.product.stockQuantity + oldItem.quantity }, { transaction: t });
          }
        }
      }

      await OrderItem.destroy({ where: { orderId: id }, transaction: t });

      let subtotal = 0;
      for (const item of data.orderItems) {
        const product = await Product.findByPk(item.productId, { transaction: t, lock: t.LOCK.UPDATE });
        if (!product) throw new ServiceError(404, "PRODUCT_NOT_FOUND", `Product not found: ${item.productId}`);
        if (product.stockQuantity < item.quantity) {
          throw new ServiceError(400, "INSUFFICIENT_STOCK", `Insufficient stock for product ${product.name}. Available: ${product.stockQuantity}, Requested: ${item.quantity}`);
        }

        const itemTotal = item.quantity * parseFloat(product.unitPrice.toString());
        subtotal += itemTotal;

        await OrderItem.create(
          { orderId: id, productId: item.productId, quantity: item.quantity, productSnapshot: { name: product.name, unitPrice: product.unitPrice, totalPrice: itemTotal } },
          { transaction: t }
        );

        if (existingOrder.status !== "CANCELLED") {
          await product.update({ stockQuantity: product.stockQuantity - item.quantity }, { transaction: t });
        }
      }

      const shippingCost = data.shippingCost ?? existingOrder.shippingCost ?? 0;
      await existingOrder.update({ totalAmount: subtotal + shippingCost }, { transaction: t });
    }

    return Order.findByPk(id, {
      include: [
        { model: OrderItem, as: "items", include: [{ model: Product, as: "product", attributes: ["id", "name", "slug", "unitPrice"] }] },
        { model: Customer, as: "customer", attributes: ["id", "fullName"] },
      ],
      transaction: t,
    });
  });
}

export async function getRecentOrders(limit: number) {
  const orders = await Order.findAll({
    limit,
    order: [["createdAt", "DESC"]],
    include: ORDER_WITH_CUSTOMER_AND_ITEMS,
  });

  interface OrderJSON {
    id: string;
    items?: Array<{ productSnapshot?: { name?: string }; product?: { name?: string } }>;
    customer?: { fullName?: string };
    orderType?: string;
    status?: string;
    totalAmount?: string;
    createdAt?: string;
  }
  return orders.map((order) => {
    const json = order.toJSON() as unknown as OrderJSON;
    let productName: string | null = null;

    if (json.items && json.items.length > 0) {
      const first = json.items[0];
      const firstName = first?.productSnapshot?.name || first?.product?.name || "Sản phẩm";
      productName = json.items.length === 1 ? firstName : `${firstName} + ${json.items.length - 1} sản phẩm khác`;
    }

    return {
      id: json.id,
      customerName: json.customer?.fullName || "Unknown Customer",
      productName,
      orderType: json.orderType?.toLowerCase() || "product",
      status: json.status?.toLowerCase() || "pending",
      totalAmount: parseFloat(json.totalAmount || "0"),
      createdAt: json.createdAt,
    };
  });
}
