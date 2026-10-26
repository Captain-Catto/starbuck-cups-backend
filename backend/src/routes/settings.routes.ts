import { Router } from "express";
import {
  getEffectSettings,
  updateEffectSettings,
  getWatermarkSettings,
  updateWatermarkSettings,
} from "../controllers/settings.controller";
import {
  authenticateWithAutoRefresh,
  requirePermission,
} from "../middleware/auth.middleware";
import { PERMISSIONS } from "../constants/permissions";

const router = Router();

// Public route to get settings (frontend needs it)
router.get("/effect-settings", getEffectSettings);

// Site configuration (settings.manage)
router.put(
  "/effect-settings",
  authenticateWithAutoRefresh,
  requirePermission(PERMISSIONS.SETTINGS_MANAGE),
  updateEffectSettings
);

// Watermark settings for product image processing
router.get("/watermark-settings", getWatermarkSettings);
router.put(
  "/watermark-settings",
  authenticateWithAutoRefresh,
  requirePermission(PERMISSIONS.SETTINGS_MANAGE),
  updateWatermarkSettings
);

export default router;
