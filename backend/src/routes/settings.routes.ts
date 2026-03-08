import { Router } from "express";
import {
  getEffectSettings,
  updateEffectSettings,
  getWatermarkSettings,
  updateWatermarkSettings,
} from "../controllers/settings.controller";
import {
  authenticateWithAutoRefresh,
  requireAdmin,
} from "../middleware/auth.middleware";

const router = Router();

// Public route to get settings (frontend needs it)
router.get("/effect-settings", getEffectSettings);

// Admin route to update settings
router.put(
  "/effect-settings",
  authenticateWithAutoRefresh,
  requireAdmin,
  updateEffectSettings
);

// Watermark settings for product image processing
router.get("/watermark-settings", getWatermarkSettings);
router.put(
  "/watermark-settings",
  authenticateWithAutoRefresh,
  requireAdmin,
  updateWatermarkSettings
);

export default router;
