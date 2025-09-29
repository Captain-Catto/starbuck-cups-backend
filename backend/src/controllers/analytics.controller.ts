import { Request, Response } from "express";
import { productAnalyticsService } from "../services/productAnalytics.service";

export class AnalyticsController {
  // Track product click
  async trackProductClick(req: Request, res: Response) {
    try {
      const { productId, productName, timestamp } = req.body;

      if (!productId) {
        return res.status(400).json({
          success: false,
          message: "Product ID is required",
        });
      }

      const analytics = await productAnalyticsService.incrementProductClick(productId);

      return res.json({
        success: true,
        data: analytics,
        message: "Product click tracked successfully",
      });
    } catch (error) {
      console.error("Product click tracking error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to track product click",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Track add to cart click
  async trackAddToCartClick(req: Request, res: Response) {
    try {
      const { productId, productName, timestamp } = req.body;

      if (!productId) {
        return res.status(400).json({
          success: false,
          message: "Product ID is required",
        });
      }

      const analytics = await productAnalyticsService.incrementAddToCart(productId);

      return res.json({
        success: true,
        data: analytics,
        message: "Add to cart click tracked successfully",
      });
    } catch (error) {
      console.error("Add to cart tracking error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to track add to cart click",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Get product analytics
  async getProductAnalytics(req: Request, res: Response) {
    try {
      const { productId } = req.params;

      if (!productId) {
        return res.status(400).json({
          success: false,
          message: "Product ID is required",
        });
      }

      const analytics = await productAnalyticsService.getProductAnalytics(productId);

      return res.json({
        success: true,
        data: analytics,
      });
    } catch (error) {
      console.error("Get product analytics error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to get product analytics",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Get top clicked products
  async getTopClickedProducts(req: Request, res: Response) {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const topProducts = await productAnalyticsService.getTopClickedProducts(limit);

      return res.json({
        success: true,
        data: topProducts,
      });
    } catch (error) {
      console.error("Get top clicked products error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to get top clicked products",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Get top added to cart products
  async getTopAddedToCartProducts(req: Request, res: Response) {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const topProducts = await productAnalyticsService.getTopAddedToCartProducts(limit);

      return res.json({
        success: true,
        data: topProducts,
      });
    } catch (error) {
      console.error("Get top added to cart products error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to get top added to cart products",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Get top conversion products
  async getTopConversionProducts(req: Request, res: Response) {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const topProducts = await productAnalyticsService.getTopConversionProducts(limit);

      return res.json({
        success: true,
        data: topProducts,
      });
    } catch (error) {
      console.error("Get top conversion products error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to get top conversion products",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Get analytics summary
  async getAnalyticsSummary(req: Request, res: Response) {
    try {
      const summary = await productAnalyticsService.getAnalyticsSummary();

      return res.json({
        success: true,
        data: summary,
      });
    } catch (error) {
      console.error("Get analytics summary error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to get analytics summary",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Get bulk product analytics (for admin product lists)
  async getBulkProductAnalytics(req: Request, res: Response) {
    try {
      const { productIds } = req.body;

      if (!Array.isArray(productIds)) {
        return res.status(400).json({
          success: false,
          message: "Product IDs array is required",
        });
      }

      const analyticsMap = await productAnalyticsService.getBulkProductAnalytics(productIds);

      // Convert Map to Object for JSON response
      const analyticsObject = Object.fromEntries(analyticsMap);

      return res.json({
        success: true,
        data: analyticsObject,
      });
    } catch (error) {
      console.error("Get bulk product analytics error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to get bulk product analytics",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}

export const analyticsController = new AnalyticsController();