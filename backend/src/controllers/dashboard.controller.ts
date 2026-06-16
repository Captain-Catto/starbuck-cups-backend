import { logger } from "@/utils/logger";
import { Request, Response } from "express";
import { ResponseHelper } from "../types/api";
import {
  dashboardService,
  StatisticsPeriod,
} from "../services/dashboard.service";

const VALID_PERIODS: StatisticsPeriod[] = ["week", "month", "year"];

const parsePeriod = (raw: unknown): StatisticsPeriod =>
  VALID_PERIODS.includes(raw as StatisticsPeriod)
    ? (raw as StatisticsPeriod)
    : "month";

const growthPercent = (current: number, last: number): number => {
  const growth = last > 0 ? ((current - last) / last) * 100 : current > 0 ? 100 : 0;
  return Math.round(growth * 10) / 10;
};

/**
 * Get dashboard statistics
 */
export const getDashboardStats = async (req: Request, res: Response) => {
  try {
    const stats = await dashboardService.getCounts();
    return res.status(200).json(ResponseHelper.success(stats));
  } catch (error) {
    logger.error("Get dashboard stats error:", error);
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
    const revenueData = await dashboardService.getRevenueSummary();
    return res.status(200).json(ResponseHelper.success(revenueData));
  } catch (error) {
    logger.error("Get revenue data error:", error);
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
    const period = parsePeriod(req.query.period);
    const data = await dashboardService.getStatistics(period);

    const statistics = {
      period,
      overview: {
        totalProductsSold: data.totalSoldProducts,
        totalRevenue: data.totalRevenue,
        currentPeriodSales: data.currentPeriodSales,
        currentPeriodRevenue: data.currentPeriodRevenue,
        currentPeriodOrders: data.currentPeriodOrders,
        salesGrowth: growthPercent(data.currentPeriodSales, data.lastPeriodSales),
        revenueGrowth: growthPercent(
          data.currentPeriodRevenue,
          data.lastPeriodRevenue
        ),
        ordersGrowth: growthPercent(
          data.currentPeriodOrders,
          data.lastPeriodOrders
        ),
      },
      topSellingProducts: data.topSellingProducts.map((item) => ({
        id: item.productId,
        name: item.productName || "Unknown",
        slug: item.productSlug,
        capacity: item.capacityName || "Unknown",
        totalSold: Number(item.totalQuantity) || 0,
      })),
      topCustomers: data.topCustomers.map((item) => ({
        id: item.customerId,
        name: item.fullName || "Unknown",
        phone: item.mainPhone || "Unknown",
        messengerId: item.messengerId || null,
        zaloId: item.zaloId || null,
        totalSpent: Number(item.totalSpent || 0),
      })),
      lowStockProducts: data.lowStockProducts,
      revenueTrend: data.revenueTrend.map((item) => ({
        period: item.period,
        revenue: Number(item.revenue || 0),
      })),
      productAnalytics: {
        topClickedProducts: data.topClickedProducts.data,
        topAddToCartProducts: data.topAddToCartProducts,
        topConversionProducts: data.topConversionProducts.data,
        summary: {
          totalClicks: data.analyticsSummary.totalClicks,
          totalAddToCarts: data.analyticsSummary.totalAddToCarts,
          overallConversionRate:
            Math.round(data.analyticsSummary.overallConversionRate * 1000) / 10, // Convert to percentage with 1 decimal
          totalTrackedProducts: data.analyticsSummary.totalProducts,
        },
        recentActivity: data.analyticsSummary.recentActivity,
      },
    };

    return res.status(200).json(ResponseHelper.success(statistics));
  } catch (error) {
    logger.error("Get statistics error:", error);
    return res
      .status(500)
      .json(
        ResponseHelper.error("Failed to get statistics", "GET_STATISTICS_ERROR")
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

    const topSellingProducts = await dashboardService.getTopSellingProducts(
      limit,
      offset
    );

    const validProducts = topSellingProducts.map((item) => ({
      id: item.productId,
      name: item.productName || "Unknown",
      slug: item.productSlug,
      capacity: item.capacityName || "N/A",
      totalSold: Number(item.totalQuantity) || 0,
    }));

    return res.json({
      success: true,
      data: validProducts,
      pagination: { page, limit, offset },
    });
  } catch (error) {
    logger.error("Get top selling products error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get top selling products",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
