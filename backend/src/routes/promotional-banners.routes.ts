import { Router } from "express";
import {
  getActivePromotionalBanner,
  getAdminPromotionalBanners,
  getPromotionalBannerById,
  createPromotionalBanner,
  updatePromotionalBanner,
  deletePromotionalBanner,
} from "../controllers/promotional-banners.controller";
import {
  authenticateWithAutoRefresh,
  requirePermission,
} from "../middleware/auth.middleware";
import {
  redisCacheMiddleware,
  invalidateCachePrefixOnSuccess,
} from "../middleware/redis-cache.middleware";
import { PERMISSIONS } from "../constants/permissions";

const router = Router();

const invalidateBannerCache = invalidateCachePrefixOnSuccess(
  "/api/promotional-banners"
);

/**
 * Public Routes
 */

// GET /api/promotional-banners - Get active promotional banner
router.get("/", redisCacheMiddleware(300), getActivePromotionalBanner);

/**
 * Admin Routes (Protected)
 */

// GET /api/admin/promotional-banners - Get all promotional banners
router.get(
  "/admin",
  authenticateWithAutoRefresh,
  requirePermission(PERMISSIONS.BANNERS_VIEW),
  getAdminPromotionalBanners
);

// GET /api/admin/promotional-banners/:id - Get promotional banner by ID
router.get(
  "/admin/:id",
  authenticateWithAutoRefresh,
  requirePermission(PERMISSIONS.BANNERS_VIEW),
  getPromotionalBannerById
);

// POST /api/admin/promotional-banners - Create promotional banner
router.post(
  "/admin",
  authenticateWithAutoRefresh,
  requirePermission(PERMISSIONS.BANNERS_MANAGE),
  invalidateBannerCache,
  createPromotionalBanner
);

// PUT /api/admin/promotional-banners/:id - Update promotional banner
router.put(
  "/admin/:id",
  authenticateWithAutoRefresh,
  requirePermission(PERMISSIONS.BANNERS_MANAGE),
  invalidateBannerCache,
  updatePromotionalBanner
);

// DELETE /api/admin/promotional-banners/:id - Delete promotional banner
router.delete(
  "/admin/:id",
  authenticateWithAutoRefresh,
  requirePermission(PERMISSIONS.BANNERS_MANAGE),
  invalidateBannerCache,
  deletePromotionalBanner
);

export default router;
