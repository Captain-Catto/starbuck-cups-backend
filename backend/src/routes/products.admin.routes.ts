/**
 * Admin product management routes — JWT auth required.
 * Mounted at /api/admin/products
 */
import { Router } from "express";
import {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  updateProductWithFiles,
  deleteProduct,
  reactivateProduct,
  updateProductStock,
  toggleProductStatus,
  searchProducts,
  getLowStockProducts,
  reorderProductImages,
  getFeaturedProductsStats,
  pinProduct,
  unpinProduct,
  getPinnedProductsCount,
} from "../controllers/products.controller";
import {
  authenticateWithAutoRefresh,
  requirePermission,
} from "../middleware/auth.middleware";
import {
  uploadMultiple,
  handleMulterError,
} from "../middleware/upload.middleware";
import { syncProduct } from "../middleware/auto-sync.middleware";
import { PERMISSIONS } from "../constants/permissions";

const router = Router();

// Static paths must be registered before the /:id catch-all
router.get("/", authenticateWithAutoRefresh, requirePermission(PERMISSIONS.PRODUCTS_VIEW), getProducts);
router.get("/low-stock", authenticateWithAutoRefresh, requirePermission(PERMISSIONS.PRODUCTS_VIEW), getLowStockProducts);
router.get("/search", authenticateWithAutoRefresh, requirePermission(PERMISSIONS.PRODUCTS_VIEW), searchProducts);
router.get("/stats/featured", authenticateWithAutoRefresh, requirePermission(PERMISSIONS.PRODUCTS_VIEW), getFeaturedProductsStats);
router.get("/stats/pinned", authenticateWithAutoRefresh, requirePermission(PERMISSIONS.PRODUCTS_VIEW), getPinnedProductsCount);
router.get("/:id", authenticateWithAutoRefresh, requirePermission(PERMISSIONS.PRODUCTS_VIEW), getProductById);

// Create product with image upload (multipart/form-data, max 10 images)
router.post(
  "/",
  authenticateWithAutoRefresh,
  requirePermission(PERMISSIONS.PRODUCTS_MANAGE),
  uploadMultiple("images", 10),
  handleMulterError,
  syncProduct.create(),
  createProduct
);

router.put(
  "/:id",
  authenticateWithAutoRefresh,
  requirePermission(PERMISSIONS.PRODUCTS_MANAGE),
  syncProduct.update(),
  updateProduct
);

// Update product including new image files (multipart/form-data)
router.put(
  "/:id/upload",
  authenticateWithAutoRefresh,
  requirePermission(PERMISSIONS.PRODUCTS_MANAGE),
  uploadMultiple("images", 10),
  handleMulterError,
  syncProduct.update(),
  updateProductWithFiles
);

// Stock updates are allowed for staff, not only admin
router.patch(
  "/:id/stock",
  authenticateWithAutoRefresh,
  requirePermission(PERMISSIONS.PRODUCTS_STOCK),
  syncProduct.update(),
  updateProductStock
);

router.patch(
  "/:id/toggle-status",
  authenticateWithAutoRefresh,
  requirePermission(PERMISSIONS.PRODUCTS_MANAGE),
  syncProduct.update(),
  toggleProductStatus
);

// Reactivate a soft-deleted product
router.patch(
  "/:id/reactivate",
  authenticateWithAutoRefresh,
  requirePermission(PERMISSIONS.PRODUCTS_MANAGE),
  syncProduct.update(),
  reactivateProduct
);

// Soft delete
router.delete(
  "/:id",
  authenticateWithAutoRefresh,
  requirePermission(PERMISSIONS.PRODUCTS_MANAGE),
  syncProduct.delete(),
  deleteProduct
);

router.patch(
  "/:id/reorder-images",
  authenticateWithAutoRefresh,
  requirePermission(PERMISSIONS.PRODUCTS_MANAGE),
  syncProduct.update(),
  reorderProductImages
);

router.patch(
  "/:id/pin",
  authenticateWithAutoRefresh,
  requirePermission(PERMISSIONS.PRODUCTS_MANAGE),
  syncProduct.update(),
  pinProduct
);

router.patch(
  "/:id/unpin",
  authenticateWithAutoRefresh,
  requirePermission(PERMISSIONS.PRODUCTS_MANAGE),
  syncProduct.update(),
  unpinProduct
);

export default router;
