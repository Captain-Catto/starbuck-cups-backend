/**
 * Routes cho MeiliSearch functionality
 */
import { Router } from "express";
import { searchController } from "../controllers/search.controller";
import {
  authenticateWithAutoRefresh,
  requirePermission,
  rateLimitPublicRead,
} from "../middleware/auth.middleware";
import { PERMISSIONS } from "../constants/permissions";

const searchRoutes = Router();

// Every search endpoint hits MeiliSearch directly and is uncached — throttle
// per IP so public traffic can't overwhelm it.
searchRoutes.use(rateLimitPublicRead);

// ==================== PRODUCT SEARCH ====================
/**
 * GET /api/search/products
 * Tìm kiếm sản phẩm với các filter và pagination
 */
searchRoutes.get("/products", searchController.searchProducts);

/**
 * GET /api/search/products/autocomplete
 * Tự động hoàn thành cho sản phẩm
 */
searchRoutes.get(
  "/products/autocomplete",
  searchController.autocompleteProducts
);

/**
 * GET /api/search/products/facets
 * Lấy facets/filters có sẵn cho sản phẩm
 */
searchRoutes.get("/products/facets", searchController.getProductFacets);

// ==================== CATEGORY SEARCH ====================
/**
 * GET /api/search/categories
 * Tìm kiếm category
 */
searchRoutes.get("/categories", searchController.searchCategories);

/**
 * GET /api/search/categories/autocomplete
 * Tự động hoàn thành cho category
 */
searchRoutes.get(
  "/categories/autocomplete",
  searchController.autocompleteCategories
);

// ==================== COLOR SEARCH ====================
/**
 * GET /api/search/colors
 * Tìm kiếm màu sắc
 */
searchRoutes.get("/colors", searchController.searchColors);

/**
 * GET /api/search/colors/autocomplete
 * Tự động hoàn thành cho màu sắc
 */
searchRoutes.get("/colors/autocomplete", searchController.autocompleteColors);

// ==================== CAPACITY SEARCH ====================
/**
 * GET /api/search/capacities
 * Tìm kiếm dung tích
 */
searchRoutes.get("/capacities", searchController.searchCapacities);

/**
 * GET /api/search/capacities/autocomplete
 * Tự động hoàn thành cho dung tích
 */
searchRoutes.get(
  "/capacities/autocomplete",
  searchController.autocompleteCapacities
);

// ==================== CUSTOMER SEARCH ====================
/**
 * GET /api/search/customers
 * Tìm kiếm khách hàng (chỉ admin)
 */
searchRoutes.get(
  "/customers",
  authenticateWithAutoRefresh,
  requirePermission(PERMISSIONS.CUSTOMERS_VIEW),
  searchController.searchCustomers
);

/**
 * GET /api/search/customers/autocomplete
 * Tự động hoàn thành cho khách hàng (chỉ admin)
 */
searchRoutes.get(
  "/customers/autocomplete",
  authenticateWithAutoRefresh,
  requirePermission(PERMISSIONS.CUSTOMERS_VIEW),
  searchController.autocompleteCustomers
);

// ==================== GLOBAL SEARCH ====================
/**
 * GET /api/search/global
 * Tìm kiếm toàn bộ hệ thống
 */
searchRoutes.get("/global", searchController.globalSearch);

export { searchRoutes };
