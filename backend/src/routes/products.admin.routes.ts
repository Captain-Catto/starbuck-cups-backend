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
} from "../controllers/products.controller";
import {
  authenticateWithAutoRefresh,
  requireAdmin,
  requireStaff,
} from "../middleware/auth.middleware";
import {
  uploadMultiple,
  handleMulterError,
} from "../middleware/upload.middleware";
import { syncProduct } from "../middleware/auto-sync.middleware";

const router = Router();

// Static paths must be registered before the /:id catch-all
router.get("/", authenticateWithAutoRefresh, getProducts);
router.get("/low-stock", authenticateWithAutoRefresh, getLowStockProducts);
router.get("/search", authenticateWithAutoRefresh, searchProducts);
router.get("/stats/featured", authenticateWithAutoRefresh, getFeaturedProductsStats);
router.get("/:id", authenticateWithAutoRefresh, getProductById);

// Create product with image upload (multipart/form-data, max 10 images)
router.post(
  "/",
  authenticateWithAutoRefresh,
  requireAdmin,
  uploadMultiple("images", 10),
  handleMulterError,
  syncProduct.create(),
  createProduct
);

router.put(
  "/:id",
  authenticateWithAutoRefresh,
  requireAdmin,
  syncProduct.update(),
  updateProduct
);

// Update product including new image files (multipart/form-data)
router.put(
  "/:id/upload",
  authenticateWithAutoRefresh,
  requireAdmin,
  uploadMultiple("images", 10),
  handleMulterError,
  syncProduct.update(),
  updateProductWithFiles
);

// Stock updates are allowed for staff, not only admin
router.patch(
  "/:id/stock",
  authenticateWithAutoRefresh,
  requireStaff,
  syncProduct.update(),
  updateProductStock
);

router.patch(
  "/:id/toggle-status",
  authenticateWithAutoRefresh,
  requireAdmin,
  syncProduct.update(),
  toggleProductStatus
);

// Reactivate a soft-deleted product
router.patch(
  "/:id/reactivate",
  authenticateWithAutoRefresh,
  requireAdmin,
  syncProduct.update(),
  reactivateProduct
);

// Soft delete
router.delete(
  "/:id",
  authenticateWithAutoRefresh,
  requireAdmin,
  syncProduct.delete(),
  deleteProduct
);

router.patch(
  "/:id/reorder-images",
  authenticateWithAutoRefresh,
  requireAdmin,
  syncProduct.update(),
  reorderProductImages
);

export default router;
