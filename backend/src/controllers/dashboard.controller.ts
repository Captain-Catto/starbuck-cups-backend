import { Request, Response } from "express";
import { models } from "../models";

const { Order, OrderItem, Customer, Product, Consultation } = models;

import { ResponseHelper } from "../types/api";
import { Op, QueryTypes } from "sequelize";
import { sequelize } from "../config/database";
import { productAnalyticsService } from "../services/productAnalytics.service";

interface TopCustomerQueryResult {
  customerId: number;
  totalSpent: string;
}

/**
 * Get dashboard statistics
 */
export const getDashboardStats = async (req: Request, res: Response) => {
  try {
    console.log("Getting dashboard stats");

    // Get all counts in parallel
    const [totalOrders, totalCustomers, totalProducts, pendingConsultations] =
      await Promise.all([
        Order.count(),
        Customer.count(),
        Product.count({
          where: {
            isActive: true,
          },
        }),
        Consultation.count({
          where: {
            status: "PENDING",
          },
        }),
      ]);

    const stats = {
      totalOrders,
      totalCustomers,
      totalProducts,
      pendingConsultations,
    };

    console.log("Dashboard stats:", stats);
    return res.status(200).json(ResponseHelper.success(stats));
  } catch (error) {
    console.error("Get dashboard stats error:", error);
    return res
      .status(500)
      .json(
        ResponseHelper.error(
          "Failed to get dashboard stats",
          "GET_DASHBOARD_STATS_ERROR"
        )
      );
  }
};

/**
 * Get revenue data and growth
 */
export const getRevenueData = async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    // Get revenue data in parallel
    const [totalRevenue, thisMonthRevenue, lastMonthRevenue] =
      await Promise.all([
        // Total revenue from all completed orders (DELIVERED or other completion statuses)
        Order.sum("totalAmount", {
          where: {
            status: "DELIVERED",
          },
        }),

        // This month revenue
        Order.sum("totalAmount", {
          where: {
            status: "DELIVERED",
            createdAt: {
              [Op.gte]: currentMonth,
              [Op.lt]: nextMonth,
            },
          },
        }),

        // Last month revenue
        Order.sum("totalAmount", {
          where: {
            status: "DELIVERED",
            createdAt: {
              [Op.gte]: lastMonth,
              [Op.lt]: currentMonth,
            },
          },
        }),
      ]);

    const total = Number(totalRevenue || 0);
    const thisMonth = Number(thisMonthRevenue || 0);
    const lastMonthAmount = Number(lastMonthRevenue || 0);

    // Calculate growth percentage
    const growth =
      lastMonthAmount > 0
        ? ((thisMonth - lastMonthAmount) / lastMonthAmount) * 100
        : thisMonth > 0
          ? 100
          : 0;

    const revenueData = {
      totalRevenue: total,
      thisMonthRevenue: thisMonth,
      lastMonthRevenue: lastMonthAmount,
      growth: Math.round(growth * 10) / 10, // Round to 1 decimal place
    };

    return res.status(200).json(ResponseHelper.success(revenueData));
  } catch (error) {
    console.error("Get revenue data error:", error);
    return res
      .status(500)
      .json(
        ResponseHelper.error(
          "Failed to get revenue data",
          "GET_REVENUE_DATA_ERROR"
        )
      );
  }
};

/**
 * Get comprehensive statistics
 */
export const getStatistics = async (req: Request, res: Response) => {
  try {
    const { period = "month" } = req.query;
    console.log("Getting statistics for period:", period);
    const now = new Date();
    console.log("Date range calculation starting...");

    // Date calculations
    const currentYear = new Date(now.getFullYear(), 0, 1);
    const lastYear = new Date(now.getFullYear() - 1, 0, 1);
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const currentWeek = new Date(now);
    currentWeek.setDate(now.getDate() - now.getDay());
    const lastWeek = new Date(currentWeek);
    lastWeek.setDate(currentWeek.getDate() - 7);

    // Helper function to get date range based on period
    const getDateRange = (period: string) => {
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
        default: // month
          return {
            current: { gte: currentMonth },
            last: { gte: lastMonth, lt: currentMonth },
          };
      }
    };

    const dateRange = getDateRange(period as string);
    console.log("Date range:", dateRange);

    // Get all statistics in parallel
    const [
      // Sales statistics
      totalSoldProducts,
      currentPeriodSales,
      lastPeriodSales,

      // Revenue statistics
      totalRevenue,
      currentPeriodRevenue,
      lastPeriodRevenue,

      // Top selling products
      topSellingProducts,

      // Top customers by total spent
      topCustomers,

      // Orders count this period
      currentPeriodOrders,
      lastPeriodOrders,

      // Low stock products
      lowStockProducts,

      // Weekly/Monthly revenue trend
      revenueTrend,

      // Product analytics data
      topClickedProducts,
      topAddToCartProducts,
      topConversionProducts,
      analyticsummary,
    ] = await Promise.all([
      // Total products sold (all time)
      sequelize
        .query(
          "SELECT COALESCE(SUM(oi.quantity), 0) as sum FROM order_items oi JOIN orders o ON oi.order_id = o.id WHERE o.status = ?",
          { replacements: ["DELIVERED"], type: QueryTypes.SELECT, plain: true }
        )
        .then((result: any) => result?.sum || 0),

      // Current period sales
      sequelize
        .query(
          "SELECT COALESCE(SUM(oi.quantity), 0) as sum FROM order_items oi JOIN orders o ON oi.order_id = o.id WHERE o.status = ? AND o.created_at >= ?",
          {
            replacements: ["DELIVERED", dateRange.current.gte],
            type: QueryTypes.SELECT,
            plain: true,
          }
        )
        .then((result: any) => result?.sum || 0),

      // Last period sales
      sequelize
        .query(
          "SELECT COALESCE(SUM(oi.quantity), 0) as sum FROM order_items oi JOIN orders o ON oi.order_id = o.id WHERE o.status = ? AND o.created_at >= ? AND o.created_at < ?",
          {
            replacements: ["DELIVERED", dateRange.last.gte, dateRange.last.lt],
            type: QueryTypes.SELECT,
            plain: true,
          }
        )
        .then((result: any) => result?.sum || 0),

      // Total revenue
      Order.sum("totalAmount", {
        where: {
          status: "DELIVERED",
        },
      }),

      // Current period revenue
      Order.sum("totalAmount", {
        where: {
          status: "DELIVERED",
          createdAt: {
            [Op.gte]: dateRange.current.gte,
          },
        },
      }),

      // Last period revenue
      Order.sum("totalAmount", {
        where: {
          status: "DELIVERED",
          createdAt: {
            [Op.gte]: dateRange.last.gte,
            [Op.lt]: dateRange.last.lt,
          },
        },
      }),

      // Top selling products
      sequelize.query(
        `SELECT 
          oi.product_id as "productId",
          SUM(oi.quantity) as "totalQuantity"
        FROM order_items oi 
        INNER JOIN orders o ON oi.order_id = o.id 
        WHERE o.status = 'DELIVERED' 
        GROUP BY oi.product_id 
        ORDER BY SUM(oi.quantity) DESC 
        LIMIT 10`,
        { type: QueryTypes.SELECT }
      ),

      // Top customers by total spent
      sequelize.query(
        `SELECT 
          customer_id as "customerId",
          SUM(total_amount) as "totalSpent"
        FROM orders 
        WHERE status = 'DELIVERED' 
        GROUP BY customer_id 
        ORDER BY SUM(total_amount) DESC 
        LIMIT 10`,
        { type: QueryTypes.SELECT }
      ),

      // Current period orders count
      Order.count({
        where: {
          status: "DELIVERED",
          createdAt: {
            [Op.gte]: dateRange.current.gte,
          },
        },
      }),

      // Last period orders count
      Order.count({
        where: {
          status: "DELIVERED",
          createdAt: {
            [Op.gte]: dateRange.last.gte,
            [Op.lt]: dateRange.last.lt,
          },
        },
      }),

      // Low stock products (stock <= 1)
      Product.findAll({
        where: {
          isActive: true,
          isDeleted: false,
          stockQuantity: {
            [Op.lte]: 1,
          },
        },
        attributes: ["id", "name", "stockQuantity"],
        include: [
          {
            association: "capacity",
            attributes: ["name"],
          },
        ],
        order: [["stockQuantity", "ASC"]],
        limit: 20,
      }),

      // Revenue trend - simple query compatible with both PostgreSQL and MySQL
      sequelize.query(
        `SELECT 
          DATE(created_at) as period,
          SUM(total_amount) as revenue
        FROM orders 
        WHERE status = 'DELIVERED' 
          AND created_at >= ?
        GROUP BY DATE(created_at)
        ORDER BY period ASC
        LIMIT 30`,
        {
          replacements: [dateRange.current.gte],
          type: QueryTypes.SELECT,
        }
      ),

      // Product analytics data
      productAnalyticsService.getTopClickedProducts(10),
      productAnalyticsService.getTopAddedToCartProducts(10),
      productAnalyticsService.getTopConversionProducts(10),
      productAnalyticsService.getAnalyticsSummary(),
    ]);

    // Get product details for top selling products
    const topProductsDetails = await Promise.all(
      (topSellingProducts as any[]).map(async (item: any) => {
        const product = await Product.findOne({
          where: { id: item.productId },
          attributes: ["id", "name"],
          include: [
            {
              association: "capacity",
              attributes: ["name"],
            },
          ],
        });
        return {
          id: item.productId,
          name: product?.name || "Unknown",
          capacity: product?.capacity?.name || "Unknown",
          totalSold: item.totalQuantity || 0,
        };
      })
    );

    // Get customer details for top customers
    const topCustomersDetails = await Promise.all(
      (topCustomers as TopCustomerQueryResult[]).map(async (item) => {
        const customer = await Customer.findOne({
          where: { id: item.customerId },
          attributes: ["id", "fullName", "messengerId", "zaloId"],
          include: [
            {
              association: "customerPhones",
              attributes: ["phoneNumber", "isMain"],
            },
          ],
        });

        const mainPhone = customer?.customerPhones?.find(
          (phone: any) => phone.isMain
        );
        const phoneNumber = mainPhone ? mainPhone.phoneNumber : null;

        return {
          id: item.customerId,
          name: customer?.fullName || "Unknown",
          phone: phoneNumber || "Unknown",
          messengerId: customer?.messengerId || null,
          zaloId: customer?.zaloId || null,
          totalSpent: Number((item as any).totalSpent || 0),
        };
      })
    );

    // Calculate growth percentages
    const salesGrowth =
      (lastPeriodSales || 0) > 0
        ? (((currentPeriodSales || 0) - (lastPeriodSales || 0)) /
            (lastPeriodSales || 1)) *
          100
        : (currentPeriodSales || 0) > 0
          ? 100
          : 0;

    const revenueGrowth =
      Number(lastPeriodRevenue || 0) > 0
        ? ((Number(currentPeriodRevenue || 0) -
            Number(lastPeriodRevenue || 0)) /
            Number(lastPeriodRevenue || 1)) *
          100
        : Number(currentPeriodRevenue || 0) > 0
          ? 100
          : 0;

    const ordersGrowth =
      lastPeriodOrders > 0
        ? ((currentPeriodOrders - lastPeriodOrders) / lastPeriodOrders) * 100
        : currentPeriodOrders > 0
          ? 100
          : 0;

    const statistics = {
      period,
      overview: {
        totalProductsSold: Number(totalSoldProducts || 0),
        totalRevenue: Number(totalRevenue || 0),
        currentPeriodSales: Number(currentPeriodSales || 0),
        currentPeriodRevenue: Number(currentPeriodRevenue || 0),
        currentPeriodOrders: currentPeriodOrders,
        salesGrowth: Math.round(salesGrowth * 10) / 10,
        revenueGrowth: Math.round(revenueGrowth * 10) / 10,
        ordersGrowth: Math.round(ordersGrowth * 10) / 10,
      },
      topSellingProducts: topProductsDetails,
      topCustomers: topCustomersDetails,
      lowStockProducts: lowStockProducts,
      revenueTrend: (revenueTrend as any[]).map((item: any) => ({
        period: item.period,
        revenue: Number(item.revenue || 0),
      })),
      productAnalytics: {
        topClickedProducts: topClickedProducts,
        topAddToCartProducts: topAddToCartProducts,
        topConversionProducts: topConversionProducts,
        summary: {
          totalClicks: analyticsummary.totalClicks,
          totalAddToCarts: analyticsummary.totalAddToCarts,
          overallConversionRate:
            Math.round(analyticsummary.overallConversionRate * 1000) / 10, // Convert to percentage with 1 decimal
          totalTrackedProducts: analyticsummary.totalProducts,
        },
        recentActivity: analyticsummary.recentActivity,
      },
    };

    console.log("Final statistics data:", {
      period: statistics.period,
      overviewKeys: Object.keys(statistics.overview),
      topProductsCount: statistics.topSellingProducts.length,
      topCustomersCount: statistics.topCustomers.length,
      lowStockCount: statistics.lowStockProducts.length,
      revenueTrendCount: statistics.revenueTrend.length,
    });
    return res.status(200).json(ResponseHelper.success(statistics));
  } catch (error) {
    console.error("Get statistics error:", error);
    console.error("Error stack:", (error as Error).stack);
    return res.status(500).json(
      ResponseHelper.error("Failed to get statistics", "GET_STATISTICS_ERROR", {
        message: (error as Error).message,
        stack: (error as Error).stack,
      })
    );
  }
};

/**
 * Get top selling products with pagination
 */
export const getTopSellingProducts = async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const page = parseInt(req.query.page as string) || 1;
    const offset = (page - 1) * limit;

    const topSellingProducts = await sequelize.query(
      `SELECT
        oi.product_id as "productId",
        SUM(oi.quantity) as "totalQuantity"
      FROM order_items oi
      INNER JOIN orders o ON oi.order_id = o.id
      WHERE o.status = 'DELIVERED'
      GROUP BY oi.product_id
      ORDER BY SUM(oi.quantity) DESC
      LIMIT ? OFFSET ?`,
      {
        replacements: [limit, offset],
        type: QueryTypes.SELECT
      }
    );

    // Get product details
    const topProductsDetails = await Promise.all(
      (topSellingProducts as any[]).map(async (item: any) => {
        const product = await Product.findByPk(item.productId, {
          attributes: ["id", "name", "slug"],
          include: [
            {
              association: "capacity",
              attributes: ["name"],
            },
          ],
        });

        if (!product) {
          return null;
        }

        return {
          id: product.id,
          name: product.name,
          slug: product.slug,
          capacity: (product as any).capacity?.name || "N/A",
          totalSold: parseInt(item.totalQuantity),
        };
      })
    );

    // Filter out null products
    const validProducts = topProductsDetails.filter((p) => p !== null);

    return res.json({
      success: true,
      data: validProducts,
      pagination: {
        page,
        limit,
        offset,
      },
    });
  } catch (error) {
    console.error("Get top selling products error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get top selling products",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
