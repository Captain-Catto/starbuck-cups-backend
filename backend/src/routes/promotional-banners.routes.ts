import { Router } from "express";
import {
  getActivePromotionalBanner,
  getAdminPromotionalBanners,
  getPromotionalBannerById,
  createPromotionalBanner,
  updatePromotionalBanner,
  deletePromotionalBanner,
} from "../controllers/promotional-banners.controller";
import { authenticate } from "../middleware/auth.middleware";

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
router.get("/admin", authenticate, getAdminPromotionalBanners);

// GET /api/admin/promotional-banners/:id - Get promotional banner by ID
router.get("/admin/:id", authenticate, getPromotionalBannerById);

// POST /api/admin/promotional-banners - Create promotional banner
router.post("/admin", authenticate, createPromotionalBanner);

// PUT /api/admin/promotional-banners/:id - Update promotional banner
router.put("/admin/:id", authenticate, updatePromotionalBanner);

// DELETE /api/admin/promotional-banners/:id - Delete promotional banner
router.delete("/admin/:id", authenticate, deletePromotionalBanner);

export default router;
