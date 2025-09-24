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
import { authenticate } from "../middleware/auth.middleware";

const router = Router();

// Public routes
router.get("/public", getHeroImages);

// Admin routes (require authentication)
router.use(authenticate);

router.get("/", getAdminHeroImages);
router.get("/:id", getHeroImageById);
router.post("/", uploadMiddleware, createHeroImage);
router.put("/:id", uploadMiddleware, updateHeroImage);
router.delete("/:id", deleteHeroImage);
router.post("/reorder", reorderHeroImages);

export default router;
