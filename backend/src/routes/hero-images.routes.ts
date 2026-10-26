import { Router } from "express";
import {
  getHeroImages,
  getAdminHeroImages,
  getHeroImageById,
  createHeroImage,
  updateHeroImage,
  deleteHeroImage,
  reorderHeroImages,
  uploadMiddleware,
} from "../controllers/hero-images.controller";
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

const invalidateHeroCache = invalidateCachePrefixOnSuccess("/api/hero-images");

// Public routes
router.get("/public", redisCacheMiddleware(300), getHeroImages);

// Admin routes (require authentication)
router.use(authenticateWithAutoRefresh);

router.get("/", requirePermission(PERMISSIONS.HERO_IMAGES_VIEW), getAdminHeroImages);
router.get("/:id", requirePermission(PERMISSIONS.HERO_IMAGES_VIEW), getHeroImageById);
router.post("/", requirePermission(PERMISSIONS.HERO_IMAGES_MANAGE), uploadMiddleware, invalidateHeroCache, createHeroImage);
router.put("/:id", requirePermission(PERMISSIONS.HERO_IMAGES_MANAGE), uploadMiddleware, invalidateHeroCache, updateHeroImage);
router.delete("/:id", requirePermission(PERMISSIONS.HERO_IMAGES_MANAGE), invalidateHeroCache, deleteHeroImage);
router.post("/reorder", requirePermission(PERMISSIONS.HERO_IMAGES_MANAGE), invalidateHeroCache, reorderHeroImages);

export default router;
