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

const router = Router();

// Public routes
router.get("/public", getHeroImages);

// Admin routes (require authentication)
router.use(authenticateWithAutoRefresh);

router.get("/", getAdminHeroImages);
router.get("/:id", getHeroImageById);
router.post("/", requireAdmin, uploadMiddleware, createHeroImage);
router.put("/:id", requireAdmin, uploadMiddleware, updateHeroImage);
router.delete("/:id", requireAdmin, deleteHeroImage);
router.post("/reorder", requireAdmin, reorderHeroImages);

export default router;
