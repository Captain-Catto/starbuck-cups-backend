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
  requireAdmin,
} from "../middleware/auth.middleware";
import {
  redisCacheMiddleware,
  invalidateCachePrefixOnSuccess,
} from "../middleware/redis-cache.middleware";

const router = Router();

const invalidateHeroCache = invalidateCachePrefixOnSuccess("/api/hero-images");

// Public routes
router.get("/public", redisCacheMiddleware(300), getHeroImages);

// Admin routes (require authentication)
router.use(authenticateWithAutoRefresh);

router.get("/", getAdminHeroImages);
router.get("/:id", getHeroImageById);
router.post("/", requireAdmin, uploadMiddleware, invalidateHeroCache, createHeroImage);
router.put("/:id", requireAdmin, uploadMiddleware, invalidateHeroCache, updateHeroImage);
router.delete("/:id", requireAdmin, invalidateHeroCache, deleteHeroImage);
router.post("/reorder", requireAdmin, invalidateHeroCache, reorderHeroImages);

export default router;
