/**
 * Controller xử lý các request search sử dụng MeiliSearch
 */
import { Request, Response } from "express";
import {
  meilisearchService,
  type SearchOptions,
} from "../services/meilisearch.service";

export class SearchController {
  // ==================== PRODUCT SEARCH ====================

  /**
   * GET /api/search/products
   * Tìm kiếm sản phẩm với filter và pagination
   */
  async searchProducts(req: Request, res: Response) {
    try {
      const {
        q = "",
        limit = 20,
        offset = 0,
        categoryIds,
        colorIds,
        capacityIds,
        isActive = true,
        sortBy = "relevance",
      } = req.query;

      const options: SearchOptions = {
        limit: Number(limit),
        offset: Number(offset),
      };

      // Thêm filters nếu có
      const filters: string[] = [];

      if (isActive !== undefined) {
        filters.push(`isActive = ${isActive}`);
      }

      if (categoryIds) {
        const ids = Array.isArray(categoryIds) ? categoryIds : [categoryIds];
        filters.push(
          `category.id IN [${ids.map((id) => `"${id}"`).join(", ")}]`
        );
      }

      if (colorIds) {
        const ids = Array.isArray(colorIds) ? colorIds : [colorIds];
        filters.push(`color.id IN [${ids.map((id) => `"${id}"`).join(", ")}]`);
      }

      if (capacityIds) {
        const ids = Array.isArray(capacityIds) ? capacityIds : [capacityIds];
        filters.push(
          `capacity.id IN [${ids.map((id) => `"${id}"`).join(", ")}]`
        );
      }

      if (filters.length > 0) {
        options.filters = filters;
      }

      // Thêm sort
      if (sortBy === "name") {
        options.sort = ["name:asc"];
      } else if (sortBy === "createdAt") {
        options.sort = ["createdAt:desc"];
      }

      const results = await meilisearchService.searchProducts(
        String(q),
        options
      );

      res.json({
        success: true,
        data: results,
        query: q,
        pagination: {
          limit: Number(limit),
          offset: Number(offset),
          total: results.estimatedTotalHits,
        },
      });
    } catch (error) {
      console.error("❌ Error searching products:", error);
      res.status(500).json({
        success: false,
        message: "Lỗi khi tìm kiếm sản phẩm",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * GET /api/search/products/autocomplete
   * Tự động hoàn thành cho sản phẩm
   */
  async autocompleteProducts(req: Request, res: Response) {
    try {
      const { q = "", limit = 10 } = req.query;

      const results = await meilisearchService.searchProducts(String(q), {
        limit: Number(limit),
      });

      res.json({
        success: true,
        data: results.hits.map((hit: any) => ({
          id: hit.id,
          name: hit.name,
          slug: hit.slug,
          category: hit.category.name,
          image: hit.images[0] || null,
        })),
      });
    } catch (error) {
      console.error("❌ Error in products autocomplete:", error);
      res.status(500).json({
        success: false,
        message: "Lỗi khi tự động hoàn thành sản phẩm",
      });
    }
  }

  /**
   * GET /api/search/products/facets
   * Lấy facets/filters có sẵn cho sản phẩm
   */
  async getProductFacets(req: Request, res: Response) {
    try {
      // Sử dụng search với facets để lấy thông tin facet
      const results = await meilisearchService.searchProducts("", {
        limit: 0,
        facets: ["category.name", "color.name", "capacity.name", "isActive"],
      });

      res.json({
        success: true,
        data: results.facetDistribution || {},
      });
    } catch (error) {
      console.error("❌ Error getting product facets:", error);
      res.status(500).json({
        success: false,
        message: "Lỗi khi lấy facets sản phẩm",
      });
    }
  }

  // ==================== CATEGORY SEARCH ====================

  /**
   * GET /api/search/categories
   * Tìm kiếm category
   */
  async searchCategories(req: Request, res: Response) {
    try {
      const { q = "", limit = 20, offset = 0, isActive = true } = req.query;

      const options: SearchOptions = {
        limit: Number(limit),
        offset: Number(offset),
      };

      if (isActive !== undefined) {
        options.filters = [`isActive = ${isActive}`];
      }

      const results = await meilisearchService.searchCategories(
        String(q),
        options
      );

      res.json({
        success: true,
        data: results,
      });
    } catch (error) {
      console.error("❌ Error searching categories:", error);
      res.status(500).json({
        success: false,
        message: "Lỗi khi tìm kiếm danh mục",
      });
    }
  }

  /**
   * GET /api/search/categories/autocomplete
   * Tự động hoàn thành cho category
   */
  async autocompleteCategories(req: Request, res: Response) {
    try {
      const { q = "", limit = 10 } = req.query;

      const results = await meilisearchService.searchCategories(String(q), {
        limit: Number(limit),
      });

      res.json({
        success: true,
        data: results.hits.map((hit: any) => ({
          id: hit.id,
          name: hit.name,
          slug: hit.slug,
        })),
      });
    } catch (error) {
      console.error("❌ Error in categories autocomplete:", error);
      res.status(500).json({
        success: false,
        message: "Lỗi khi tự động hoàn thành danh mục",
      });
    }
  }

  // ==================== COLOR SEARCH ====================

  /**
   * GET /api/search/colors
   * Tìm kiếm màu sắc
   */
  async searchColors(req: Request, res: Response) {
    try {
      const { q = "", limit = 20, offset = 0, isActive = true } = req.query;

      const options: SearchOptions = {
        limit: Number(limit),
        offset: Number(offset),
      };

      if (isActive !== undefined) {
        options.filters = [`isActive = ${isActive}`];
      }

      const results = await meilisearchService.searchColors(String(q), options);

      res.json({
        success: true,
        data: results,
      });
    } catch (error) {
      console.error("❌ Error searching colors:", error);
      res.status(500).json({
        success: false,
        message: "Lỗi khi tìm kiếm màu sắc",
      });
    }
  }

  /**
   * GET /api/search/colors/autocomplete
   * Tự động hoàn thành cho màu sắc
   */
  async autocompleteColors(req: Request, res: Response) {
    try {
      const { q = "", limit = 10 } = req.query;

      const results = await meilisearchService.searchColors(String(q), {
        limit: Number(limit),
      });

      res.json({
        success: true,
        data: results.hits.map((hit: any) => ({
          id: hit.id,
          name: hit.name,
          slug: hit.slug,
          hexCode: hit.hexCode,
        })),
      });
    } catch (error) {
      console.error("❌ Error in colors autocomplete:", error);
      res.status(500).json({
        success: false,
        message: "Lỗi khi tự động hoàn thành màu sắc",
      });
    }
  }

  // ==================== CAPACITY SEARCH ====================

  /**
   * GET /api/search/capacities
   * Tìm kiếm dung tích
   */
  async searchCapacities(req: Request, res: Response) {
    try {
      const { q = "", limit = 20, offset = 0, isActive = true } = req.query;

      const options: SearchOptions = {
        limit: Number(limit),
        offset: Number(offset),
      };

      if (isActive !== undefined) {
        options.filters = [`isActive = ${isActive}`];
      }

      const results = await meilisearchService.searchCapacities(
        String(q),
        options
      );

      res.json({
        success: true,
        data: results,
      });
    } catch (error) {
      console.error("❌ Error searching capacities:", error);
      res.status(500).json({
        success: false,
        message: "Lỗi khi tìm kiếm dung tích",
      });
    }
  }

  /**
   * GET /api/search/capacities/autocomplete
   * Tự động hoàn thành cho dung tích
   */
  async autocompleteCapacities(req: Request, res: Response) {
    try {
      const { q = "", limit = 10 } = req.query;

      const results = await meilisearchService.searchCapacities(String(q), {
        limit: Number(limit),
      });

      res.json({
        success: true,
        data: results.hits.map((hit: any) => ({
          id: hit.id,
          name: hit.name,
          slug: hit.slug,
          volumeMl: hit.volumeMl,
        })),
      });
    } catch (error) {
      console.error("❌ Error in capacities autocomplete:", error);
      res.status(500).json({
        success: false,
        message: "Lỗi khi tự động hoàn thành dung tích",
      });
    }
  }

  // ==================== CUSTOMER SEARCH (ADMIN ONLY) ====================

  /**
   * GET /api/search/customers
   * Tìm kiếm khách hàng (admin only)
   */
  async searchCustomers(req: Request, res: Response) {
    try {
      const { q = "", limit = 20, offset = 0 } = req.query;

      const options: SearchOptions = {
        limit: Number(limit),
        offset: Number(offset),
      };

      const results = await meilisearchService.searchCustomers(
        String(q),
        options
      );

      res.json({
        success: true,
        data: results,
      });
    } catch (error) {
      console.error("❌ Error searching customers:", error);
      res.status(500).json({
        success: false,
        message: "Lỗi khi tìm kiếm khách hàng",
      });
    }
  }

  /**
   * GET /api/search/customers/autocomplete
   * Tự động hoàn thành cho khách hàng (admin only)
   */
  async autocompleteCustomers(req: Request, res: Response) {
    try {
      const { q = "", limit = 10 } = req.query;

      const results = await meilisearchService.searchCustomers(String(q), {
        limit: Number(limit),
      });

      res.json({
        success: true,
        data: results.hits.map((hit: any) => ({
          id: hit.id,
          fullName: hit.fullName,
          phone: hit.phone,
        })),
      });
    } catch (error) {
      console.error("❌ Error in customers autocomplete:", error);
      res.status(500).json({
        success: false,
        message: "Lỗi khi tự động hoàn thành khách hàng",
      });
    }
  }

  // ==================== GLOBAL SEARCH ====================

  /**
   * GET /api/search/global
   * Tìm kiếm toàn bộ hệ thống
   */
  async globalSearch(req: Request, res: Response) {
    try {
      const { q = "", limit = 20 } = req.query;

      const [products, categories, colors, capacities] = await Promise.all([
        meilisearchService.searchProducts(String(q), {
          limit: Math.ceil(Number(limit) / 2),
        }),
        meilisearchService.searchCategories(String(q), {
          limit: Math.ceil(Number(limit) / 4),
        }),
        meilisearchService.searchColors(String(q), {
          limit: Math.ceil(Number(limit) / 8),
        }),
        meilisearchService.searchCapacities(String(q), {
          limit: Math.ceil(Number(limit) / 8),
        }),
      ]);

      res.json({
        success: true,
        data: {
          products: products.hits,
          categories: categories.hits,
          colors: colors.hits,
          capacities: capacities.hits,
          totalResults:
            products.estimatedTotalHits +
            categories.estimatedTotalHits +
            colors.estimatedTotalHits +
            capacities.estimatedTotalHits,
        },
      });
    } catch (error) {
      console.error("❌ Error in global search:", error);
      res.status(500).json({
        success: false,
        message: "Lỗi khi tìm kiếm toàn bộ",
      });
    }
  }
}

// Export instance
export const searchController = new SearchController();
