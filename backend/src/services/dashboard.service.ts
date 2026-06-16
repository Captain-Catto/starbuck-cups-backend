/**
 * Dashboard aggregation queries.
 * Keeps raw SQL / Sequelize aggregation out of the controller layer.
 */
import { Op, QueryTypes } from "sequelize";
import { sequelize } from "../config/database";
import { models } from "../models";
import { productAnalyticsService } from "./productAnalytics.service";

const { Order, Customer, Product, Consultation } = models;

export type StatisticsPeriod = "week" | "month" | "year";

interface SumRow {
  sum: string | number | null;
}

export interface TopSellingProductRow {
  productId: string;
  productName: string | null;
  productSlug: string | null;
  capacityName: string | null;
  totalQuantity: string | number | null;
}

export interface TopCustomerRow {
  customerId: string;
  fullName: string | null;
  messengerId: string | null;
  zaloId: string | null;
  totalSpent: string | number | null;
  mainPhone: string | null;
}

export interface RevenueTrendRow {
  period: string;
  revenue: string | number | null;
}

interface DateRange {
  current: { gte: Date };
  last: { gte: Date; lt: Date };
}

const getDateRange = (period: StatisticsPeriod, now = new Date()): DateRange => {
  const currentYear = new Date(now.getFullYear(), 0, 1);
  const lastYear = new Date(now.getFullYear() - 1, 0, 1);
  const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const currentWeek = new Date(now);
  currentWeek.setDate(now.getDate() - now.getDay());
  currentWeek.setHours(0, 0, 0, 0);
  const lastWeek = new Date(currentWeek);
  lastWeek.setDate(currentWeek.getDate() - 7);

  switch (period) {
    case "week":
      return {
        current: { gte: currentWeek },
        last: { gte: lastWeek, lt: currentWeek },
      };
    case "year":
      return {
        current: { gte: currentYear },
        last: { gte: lastYear, lt: currentYear },
      };
    default:
      return {
        current: { gte: currentMonth },
        last: { gte: lastMonth, lt: currentMonth },
      };
  }
};

const soldQuantitySum = async (
  extraCondition: string,
  extraReplacements: unknown[]
): Promise<number> => {
  const row = await sequelize.query<SumRow>(
    `SELECT COALESCE(SUM(oi.quantity), 0) as sum
     FROM order_items oi JOIN orders o ON oi.order_id = o.id
     WHERE o.status = ? ${extraCondition}`,
    {
      replacements: ["DELIVERED", ...extraReplacements],
      type: QueryTypes.SELECT,
      plain: true,
    }
  );
  return Number(row?.sum || 0);
};

export const dashboardService = {
  /** Counts shown on the dashboard landing cards. */
  async getCounts() {
    const [totalOrders, totalCustomers, totalProducts, pendingConsultations] =
      await Promise.all([
        Order.count(),
        Customer.count(),
        Product.count({ where: { isActive: true } }),
        Consultation.count({ where: { status: "PENDING" } }),
      ]);

    return { totalOrders, totalCustomers, totalProducts, pendingConsultations };
  },

  /** Total/this-month/last-month revenue with growth percentage. */
  async getRevenueSummary(now = new Date()) {
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const [totalRevenue, thisMonthRevenue, lastMonthRevenue] =
      await Promise.all([
        Order.sum("totalAmount", { where: { status: "DELIVERED" } }),
        Order.sum("totalAmount", {
          where: {
            status: "DELIVERED",
            createdAt: { [Op.gte]: currentMonth, [Op.lt]: nextMonth },
          },
        }),
        Order.sum("totalAmount", {
          where: {
            status: "DELIVERED",
            createdAt: { [Op.gte]: lastMonth, [Op.lt]: currentMonth },
          },
        }),
      ]);

    const total = Number(totalRevenue || 0);
    const thisMonth = Number(thisMonthRevenue || 0);
    const lastMonthAmount = Number(lastMonthRevenue || 0);

    const growth =
      lastMonthAmount > 0
        ? ((thisMonth - lastMonthAmount) / lastMonthAmount) * 100
        : thisMonth > 0
          ? 100
          : 0;

    return {
      totalRevenue: total,
      thisMonthRevenue: thisMonth,
      lastMonthRevenue: lastMonthAmount,
      growth: Math.round(growth * 10) / 10,
    };
  },

  /** All aggregations backing the statistics page, fetched in parallel. */
  async getStatistics(period: StatisticsPeriod) {
    const dateRange = getDateRange(period);

    const [
      totalSoldProducts,
      currentPeriodSales,
      lastPeriodSales,
      totalRevenue,
      currentPeriodRevenue,
      lastPeriodRevenue,
      topSellingProducts,
      topCustomers,
      currentPeriodOrders,
      lastPeriodOrders,
      lowStockProducts,
      revenueTrend,
      topClickedProducts,
      topAddToCartProducts,
      topConversionProducts,
      analyticsSummary,
    ] = await Promise.all([
      soldQuantitySum("", []),
      soldQuantitySum("AND o.created_at >= ?", [dateRange.current.gte]),
      soldQuantitySum("AND o.created_at >= ? AND o.created_at < ?", [
        dateRange.last.gte,
        dateRange.last.lt,
      ]),

      Order.sum("totalAmount", { where: { status: "DELIVERED" } }),
      Order.sum("totalAmount", {
        where: {
          status: "DELIVERED",
          createdAt: { [Op.gte]: dateRange.current.gte },
        },
      }),
      Order.sum("totalAmount", {
        where: {
          status: "DELIVERED",
          createdAt: { [Op.gte]: dateRange.last.gte, [Op.lt]: dateRange.last.lt },
        },
      }),

      // Top selling products (single JOIN query, no N+1)
      sequelize.query<TopSellingProductRow>(
        `SELECT
          oi.product_id as "productId",
          p.name as "productName",
          p.slug as "productSlug",
          cap.name as "capacityName",
          SUM(oi.quantity) as "totalQuantity"
        FROM order_items oi
        INNER JOIN orders o ON oi.order_id = o.id
        INNER JOIN products p ON oi.product_id = p.id
        LEFT JOIN capacities cap ON p.capacity_id = cap.id
        WHERE o.status = 'DELIVERED'
        GROUP BY oi.product_id, p.name, p.slug, cap.name
        ORDER BY SUM(oi.quantity) DESC
        LIMIT 10`,
        { type: QueryTypes.SELECT }
      ),

      // Top customers by total spent (single JOIN query, no N+1)
      sequelize.query<TopCustomerRow>(
        `SELECT
          o.customer_id as "customerId",
          c.full_name as "fullName",
          c.messenger_id as "messengerId",
          c.zalo_id as "zaloId",
          SUM(o.total_amount) as "totalSpent",
          (SELECT cp.phone_number FROM customer_phones cp
           WHERE cp.customer_id = o.customer_id AND cp.is_main = true LIMIT 1) as "mainPhone"
        FROM orders o
        INNER JOIN customers c ON o.customer_id = c.id
        WHERE o.status = 'DELIVERED'
        GROUP BY o.customer_id, c.full_name, c.messenger_id, c.zalo_id
        ORDER BY SUM(o.total_amount) DESC
        LIMIT 10`,
        { type: QueryTypes.SELECT }
      ),

      Order.count({
        where: {
          status: "DELIVERED",
          createdAt: { [Op.gte]: dateRange.current.gte },
        },
      }),
      Order.count({
        where: {
          status: "DELIVERED",
          createdAt: { [Op.gte]: dateRange.last.gte, [Op.lt]: dateRange.last.lt },
        },
      }),

      // Low stock products (stock <= 1)
      Product.findAll({
        where: {
          isActive: true,
          isDeleted: false,
          stockQuantity: { [Op.lte]: 1 },
        },
        attributes: ["id", "name", "stockQuantity"],
        include: [{ association: "capacity", attributes: ["name"] }],
        order: [["stockQuantity", "ASC"]],
        limit: 20,
      }),

      // Revenue trend - simple query compatible with both PostgreSQL and MySQL
      sequelize.query<RevenueTrendRow>(
        `SELECT
          DATE(created_at) as period,
          SUM(total_amount) as revenue
        FROM orders
        WHERE status = 'DELIVERED'
          AND created_at >= ?
        GROUP BY DATE(created_at)
        ORDER BY period ASC
        LIMIT 30`,
        { replacements: [dateRange.current.gte], type: QueryTypes.SELECT }
      ),

      productAnalyticsService.getTopClickedProducts(10),
      productAnalyticsService.getTopAddedToCartProducts(10),
      productAnalyticsService.getTopConversionProducts(10),
      productAnalyticsService.getAnalyticsSummary(),
    ]);

    return {
      totalSoldProducts,
      currentPeriodSales,
      lastPeriodSales,
      totalRevenue: Number(totalRevenue || 0),
      currentPeriodRevenue: Number(currentPeriodRevenue || 0),
      lastPeriodRevenue: Number(lastPeriodRevenue || 0),
      topSellingProducts,
      topCustomers,
      currentPeriodOrders,
      lastPeriodOrders,
      lowStockProducts,
      revenueTrend,
      topClickedProducts,
      topAddToCartProducts,
      topConversionProducts,
      analyticsSummary,
    };
  },

  /** Paginated top selling products list. */
  async getTopSellingProducts(limit: number, offset: number) {
    return sequelize.query<TopSellingProductRow>(
      `SELECT
        oi.product_id as "productId",
        p.name as "productName",
        p.slug as "productSlug",
        cap.name as "capacityName",
        SUM(oi.quantity) as "totalQuantity"
      FROM order_items oi
      INNER JOIN orders o ON oi.order_id = o.id
      INNER JOIN products p ON oi.product_id = p.id
      LEFT JOIN capacities cap ON p.capacity_id = cap.id
      WHERE o.status = 'DELIVERED'
      GROUP BY oi.product_id, p.name, p.slug, cap.name
      ORDER BY SUM(oi.quantity) DESC
      LIMIT ? OFFSET ?`,
      { replacements: [limit, offset], type: QueryTypes.SELECT }
    );
  },
};
