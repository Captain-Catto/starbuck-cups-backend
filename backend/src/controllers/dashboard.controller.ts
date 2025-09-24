import { Request, Response } from "express";
import { PrismaClient } from "../generated/prisma";
import { ResponseHelper } from "../types/api";

const prisma = new PrismaClient();

/**
 * Get dashboard statistics
 */
export const getDashboardStats = async (req: Request, res: Response) => {
  try {
    // Get all counts in parallel
    const [totalOrders, totalCustomers, totalProducts, pendingConsultations] =
      await Promise.all([
        prisma.order.count(),
        prisma.customer.count(),
        prisma.product.count({
          where: {
            isActive: true,
            isDeleted: false,
          },
        }),
        prisma.consultation.count({
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
        prisma.order.aggregate({
          _sum: {
            totalAmount: true,
          },
          where: {
            status: "DELIVERED",
          },
        }),

        // This month revenue
        prisma.order.aggregate({
          _sum: {
            totalAmount: true,
          },
          where: {
            status: "DELIVERED",
            createdAt: {
              gte: currentMonth,
              lt: nextMonth,
            },
          },
        }),

        // Last month revenue
        prisma.order.aggregate({
          _sum: {
            totalAmount: true,
          },
          where: {
            status: "DELIVERED",
            createdAt: {
              gte: lastMonth,
              lt: currentMonth,
            },
          },
        }),
      ]);

    const total = Number(totalRevenue._sum.totalAmount || 0);
    const thisMonth = Number(thisMonthRevenue._sum.totalAmount || 0);
    const lastMonthAmount = Number(lastMonthRevenue._sum.totalAmount || 0);

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
    const now = new Date();

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
    ] = await Promise.all([
      // Total products sold (all time)
      prisma.orderItem.aggregate({
        _sum: {
          quantity: true,
        },
        where: {
          order: {
            status: "DELIVERED",
          },
        },
      }),

      // Current period sales
      prisma.orderItem.aggregate({
        _sum: {
          quantity: true,
        },
        where: {
          order: {
            status: "DELIVERED",
            createdAt: dateRange.current,
          },
        },
      }),

      // Last period sales
      prisma.orderItem.aggregate({
        _sum: {
          quantity: true,
        },
        where: {
          order: {
            status: "DELIVERED",
            createdAt: dateRange.last,
          },
        },
      }),

      // Total revenue
      prisma.order.aggregate({
        _sum: {
          totalAmount: true,
        },
        where: {
          status: "DELIVERED",
        },
      }),

      // Current period revenue
      prisma.order.aggregate({
        _sum: {
          totalAmount: true,
        },
        where: {
          status: "DELIVERED",
          createdAt: dateRange.current,
        },
      }),

      // Last period revenue
      prisma.order.aggregate({
        _sum: {
          totalAmount: true,
        },
        where: {
          status: "DELIVERED",
          createdAt: dateRange.last,
        },
      }),

      // Top selling products
      prisma.orderItem.groupBy({
        by: ["productId"],
        _sum: {
          quantity: true,
        },
        where: {
          order: {
            status: "DELIVERED",
          },
        },
        orderBy: {
          _sum: {
            quantity: "desc",
          },
        },
        take: 10,
      }),

      // Top customers by total spent
      prisma.order.groupBy({
        by: ["customerId"],
        _sum: {
          totalAmount: true,
        },
        where: {
          status: "DELIVERED",
        },
        orderBy: {
          _sum: {
            totalAmount: "desc",
          },
        },
        take: 10,
      }),

      // Current period orders count
      prisma.order.count({
        where: {
          status: "DELIVERED",
          createdAt: dateRange.current,
        },
      }),

      // Last period orders count
      prisma.order.count({
        where: {
          status: "DELIVERED",
          createdAt: dateRange.last,
        },
      }),

      // Low stock products (stock <= 1)
      prisma.product.findMany({
        where: {
          isActive: true,
          isDeleted: false,
          stockQuantity: {
            lte: 1,
          },
        },
        select: {
          id: true,
          name: true,
          stockQuantity: true,
          capacity: {
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          stockQuantity: "asc",
        },
        take: 20,
      }),

      // Revenue trend for the last 12 periods
      period === "year"
        ? prisma.$queryRaw`
            SELECT
              DATE_TRUNC('year', created_at) as period,
              SUM(total_amount) as revenue
            FROM orders
            WHERE status = 'DELIVERED'
              AND created_at >= NOW() - INTERVAL '12 years'
            GROUP BY DATE_TRUNC('year', created_at)
            ORDER BY period ASC
          `
        : period === "week"
          ? prisma.$queryRaw`
            SELECT
              DATE_TRUNC('week', created_at) as period,
              SUM(total_amount) as revenue
            FROM orders
            WHERE status = 'DELIVERED'
              AND created_at >= NOW() - INTERVAL '12 weeks'
            GROUP BY DATE_TRUNC('week', created_at)
            ORDER BY period ASC
          `
          : prisma.$queryRaw`
            SELECT
              DATE_TRUNC('month', created_at) as period,
              SUM(total_amount) as revenue
            FROM orders
            WHERE status = 'DELIVERED'
              AND created_at >= NOW() - INTERVAL '12 months'
            GROUP BY DATE_TRUNC('month', created_at)
            ORDER BY period ASC
          `,
    ]);

    // Get product details for top selling products
    const topProductsDetails = await Promise.all(
      topSellingProducts.map(async (item) => {
        const product = await prisma.product.findUnique({
          where: { id: item.productId },
          select: {
            id: true,
            name: true,
            capacity: {
              select: { name: true },
            },
          },
        });
        return {
          id: item.productId,
          name: product?.name || "Unknown",
          capacity: product?.capacity?.name || "Unknown",
          totalSold: item._sum.quantity || 0,
        };
      })
    );

    // Get customer details for top customers
    const topCustomersDetails = await Promise.all(
      topCustomers.map(async (item) => {
        const customer = await prisma.customer.findUnique({
          where: { id: item.customerId },
          select: {
            id: true,
            fullName: true,
            phone: true,
            messengerId: true,
            zaloId: true,
          },
        });
        return {
          id: item.customerId,
          name: customer?.fullName || "Unknown",
          phone: customer?.phone || "Unknown",
          messengerId: customer?.messengerId || null,
          zaloId: customer?.zaloId || null,
          totalSpent: Number(item._sum.totalAmount || 0),
        };
      })
    );

    // Calculate growth percentages
    const salesGrowth =
      (lastPeriodSales._sum.quantity || 0) > 0
        ? (((currentPeriodSales._sum.quantity || 0) -
            (lastPeriodSales._sum.quantity || 0)) /
            (lastPeriodSales._sum.quantity || 1)) *
          100
        : (currentPeriodSales._sum.quantity || 0) > 0
          ? 100
          : 0;

    const revenueGrowth =
      Number(lastPeriodRevenue._sum.totalAmount || 0) > 0
        ? ((Number(currentPeriodRevenue._sum.totalAmount || 0) -
            Number(lastPeriodRevenue._sum.totalAmount || 0)) /
            Number(lastPeriodRevenue._sum.totalAmount || 1)) *
          100
        : Number(currentPeriodRevenue._sum.totalAmount || 0) > 0
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
        totalProductsSold: totalSoldProducts._sum.quantity || 0,
        totalRevenue: Number(totalRevenue._sum.totalAmount || 0),
        currentPeriodSales: currentPeriodSales._sum.quantity || 0,
        currentPeriodRevenue: Number(
          currentPeriodRevenue._sum.totalAmount || 0
        ),
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
    };

    return res.status(200).json(ResponseHelper.success(statistics));
  } catch (error) {
    console.error("Get statistics error:", error);
    return res
      .status(500)
      .json(
        ResponseHelper.error("Failed to get statistics", "GET_STATISTICS_ERROR")
      );
  }
};
