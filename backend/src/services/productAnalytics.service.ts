import { ProductAnalytics } from "../models/ProductAnalytics";
import { Product } from "../models/Product";
import { Op } from "sequelize";

export interface ProductAnalyticsData {
  productId: string;
  productName?: string;
  clickCount: number;
  addToCartCount: number;
  lastClicked?: Date;
  lastAddedToCart?: Date;
  conversionRate?: number; // add to cart / clicks
}

export interface TopProductsData {
  productId: string;
  productName: string;
  productSlug?: string;
  clickCount: number;
  addToCartCount: number;
  conversionRate: number;
}

export class ProductAnalyticsService {
  // Increment product click count
  async incrementProductClick(productId: string): Promise<ProductAnalyticsData> {
    try {
      const [analytics, created] = await ProductAnalytics.upsert(
        {
          productId,
          clickCount: 1,
          addToCartCount: 0,
          lastClicked: new Date(),
        },
        {
          returning: true,
        }
      );

      if (!created) {
        // If record exists, increment click count
        await analytics.increment('clickCount', { by: 1 });
        await analytics.update({ lastClicked: new Date() });
        await analytics.reload();
      }

      return {
        productId: analytics.productId,
        clickCount: analytics.clickCount,
        addToCartCount: analytics.addToCartCount,
        lastClicked: analytics.lastClicked,
        lastAddedToCart: analytics.lastAddedToCart,
        conversionRate: analytics.clickCount > 0
          ? analytics.addToCartCount / analytics.clickCount
          : 0,
      };
    } catch (error) {
      console.error("Error incrementing product click:", error);
      throw new Error("Failed to track product click");
    }
  }

  // Increment add to cart count
  async incrementAddToCart(productId: string): Promise<ProductAnalyticsData> {
    try {
      const [analytics, created] = await ProductAnalytics.upsert(
        {
          productId,
          clickCount: 0,
          addToCartCount: 1,
          lastAddedToCart: new Date(),
        },
        {
          returning: true,
        }
      );

      if (!created) {
        // If record exists, increment add to cart count
        await analytics.increment('addToCartCount', { by: 1 });
        await analytics.update({ lastAddedToCart: new Date() });
        await analytics.reload();
      }

      return {
        productId: analytics.productId,
        clickCount: analytics.clickCount,
        addToCartCount: analytics.addToCartCount,
        lastClicked: analytics.lastClicked,
        lastAddedToCart: analytics.lastAddedToCart,
        conversionRate: analytics.clickCount > 0
          ? analytics.addToCartCount / analytics.clickCount
          : 0,
      };
    } catch (error) {
      console.error("Error incrementing add to cart:", error);
      throw new Error("Failed to track add to cart");
    }
  }

  // Get analytics for specific product
  async getProductAnalytics(productId: string): Promise<ProductAnalyticsData | null> {
    try {
      const analytics = await ProductAnalytics.findOne({
        where: { productId },
        include: [
          {
            model: Product,
            as: "product",
            attributes: ["name", "slug"],
          },
        ],
      });

      if (!analytics) {
        return null;
      }

      return {
        productId: analytics.productId,
        productName: (analytics as any).product?.name,
        clickCount: analytics.clickCount,
        addToCartCount: analytics.addToCartCount,
        lastClicked: analytics.lastClicked,
        lastAddedToCart: analytics.lastAddedToCart,
        conversionRate: analytics.clickCount > 0
          ? analytics.addToCartCount / analytics.clickCount
          : 0,
      };
    } catch (error) {
      console.error("Error getting product analytics:", error);
      throw new Error("Failed to get product analytics");
    }
  }

  // Get top products by clicks
  async getTopClickedProducts(limit: number = 10): Promise<TopProductsData[]> {
    try {
      const topProducts = await ProductAnalytics.findAll({
        include: [
          {
            model: Product,
            as: "product",
            attributes: ["name", "slug"],
            where: { isActive: true, isDeleted: false },
          },
        ],
        order: [["clickCount", "DESC"]],
        limit,
      });

      return topProducts.map((analytics) => ({
        productId: analytics.productId,
        productName: (analytics as any).product.name,
        productSlug: (analytics as any).product.slug,
        clickCount: analytics.clickCount,
        addToCartCount: analytics.addToCartCount,
        conversionRate: analytics.clickCount > 0
          ? analytics.addToCartCount / analytics.clickCount
          : 0,
      }));
    } catch (error) {
      console.error("Error getting top clicked products:", error);
      throw new Error("Failed to get top clicked products");
    }
  }

  // Get top products by add to cart
  async getTopAddedToCartProducts(limit: number = 10): Promise<TopProductsData[]> {
    try {
      const topProducts = await ProductAnalytics.findAll({
        include: [
          {
            model: Product,
            as: "product",
            attributes: ["name", "slug"],
            where: { isActive: true, isDeleted: false },
          },
        ],
        order: [["addToCartCount", "DESC"]],
        limit,
      });

      return topProducts.map((analytics) => ({
        productId: analytics.productId,
        productName: (analytics as any).product.name,
        productSlug: (analytics as any).product.slug,
        clickCount: analytics.clickCount,
        addToCartCount: analytics.addToCartCount,
        conversionRate: analytics.clickCount > 0
          ? analytics.addToCartCount / analytics.clickCount
          : 0,
      }));
    } catch (error) {
      console.error("Error getting top added to cart products:", error);
      throw new Error("Failed to get top added to cart products");
    }
  }

  // Get products with highest conversion rates
  async getTopConversionProducts(limit: number = 10): Promise<TopProductsData[]> {
    try {
      const products = await ProductAnalytics.findAll({
        include: [
          {
            model: Product,
            as: "product",
            attributes: ["name", "slug"],
            where: { isActive: true, isDeleted: false },
          },
        ],
        where: {
          clickCount: { [Op.gt]: 0 }, // Must have at least 1 click
        },
      });

      // Calculate conversion rates and sort
      const productsWithConversion = products
        .map((analytics) => ({
          productId: analytics.productId,
          productName: (analytics as any).product.name,
          productSlug: (analytics as any).product.slug,
          clickCount: analytics.clickCount,
          addToCartCount: analytics.addToCartCount,
          conversionRate: analytics.addToCartCount / analytics.clickCount,
        }))
        .sort((a, b) => b.conversionRate - a.conversionRate)
        .slice(0, limit);

      return productsWithConversion;
    } catch (error) {
      console.error("Error getting top conversion products:", error);
      throw new Error("Failed to get top conversion products");
    }
  }

  // Get overall analytics summary
  async getAnalyticsSummary() {
    try {
      const totalClicks = await ProductAnalytics.sum("clickCount");
      const totalAddToCarts = await ProductAnalytics.sum("addToCartCount");
      const totalProducts = await ProductAnalytics.count();

      const overallConversionRate = totalClicks > 0 ? totalAddToCarts / totalClicks : 0;

      // Get most recent activity
      const recentActivity = await ProductAnalytics.findAll({
        include: [
          {
            model: Product,
            as: "product",
            attributes: ["name", "slug"],
          },
        ],
        order: [["lastClicked", "DESC"]],
        limit: 5,
      });

      return {
        totalClicks: totalClicks || 0,
        totalAddToCarts: totalAddToCarts || 0,
        totalProducts: totalProducts || 0,
        overallConversionRate,
        recentActivity: recentActivity.map((analytics) => ({
          productId: analytics.productId,
          productName: (analytics as any).product?.name,
          productSlug: (analytics as any).product?.slug,
          lastClicked: analytics.lastClicked,
          clickCount: analytics.clickCount,
          addToCartCount: analytics.addToCartCount,
        })),
      };
    } catch (error) {
      console.error("Error getting analytics summary:", error);
      throw new Error("Failed to get analytics summary");
    }
  }

  // Get analytics for multiple products (for admin product list)
  async getBulkProductAnalytics(productIds: string[]): Promise<Map<string, ProductAnalyticsData>> {
    try {
      const analyticsRecords = await ProductAnalytics.findAll({
        where: {
          productId: { [Op.in]: productIds },
        },
      });

      const analyticsMap = new Map<string, ProductAnalyticsData>();

      analyticsRecords.forEach((analytics) => {
        analyticsMap.set(analytics.productId, {
          productId: analytics.productId,
          clickCount: analytics.clickCount,
          addToCartCount: analytics.addToCartCount,
          lastClicked: analytics.lastClicked,
          lastAddedToCart: analytics.lastAddedToCart,
          conversionRate: analytics.clickCount > 0
            ? analytics.addToCartCount / analytics.clickCount
            : 0,
        });
      });

      return analyticsMap;
    } catch (error) {
      console.error("Error getting bulk product analytics:", error);
      throw new Error("Failed to get bulk product analytics");
    }
  }
}

export const productAnalyticsService = new ProductAnalyticsService();