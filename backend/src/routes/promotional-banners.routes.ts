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
  requireAdmin,
} from "../middleware/auth.middleware";

const router = Router();

/**
 * Public Routes
 */

// GET /api/promotional-banners - Get active promotional banner
router.get("/", getActivePromotionalBanner);

/**
 * Admin Routes (Protected)
 */

// GET /api/admin/promotional-banners - Get all promotional banners
router.get(
  "/admin",
  authenticateWithAutoRefresh,
  requireAdmin,
  getAdminPromotionalBanners
);

// GET /api/admin/promotional-banners/:id - Get promotional banner by ID
router.get(
  "/admin/:id",
  authenticateWithAutoRefresh,
  requireAdmin,
  getPromotionalBannerById
);

// POST /api/admin/promotional-banners - Create promotional banner
router.post(
  "/admin",
  authenticateWithAutoRefresh,
  requireAdmin,
  createPromotionalBanner
);

// PUT /api/admin/promotional-banners/:id - Update promotional banner
router.put(
  "/admin/:id",
  authenticateWithAutoRefresh,
  requireAdmin,
  updatePromotionalBanner
);

// DELETE /api/admin/promotional-banners/:id - Delete promotional banner
router.delete(
  "/admin/:id",
  authenticateWithAutoRefresh,
  requireAdmin,
  deletePromotionalBanner
);

export default router;
