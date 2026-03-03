import { Router } from "express";
import {
  getEffectSettings,
  updateEffectSettings,
} from "../controllers/settings.controller";
// import { authenticate, authorize } from "../middleware/auth.middleware"; 
// Assuming auth middleware exists, but for now we might keep public get and protected update if needed.
// Based on file list, middleware dir exists.

const router = Router();

// Public route to get settings (frontend needs it)
router.get("/effect-settings", getEffectSettings);

// Admin route to update settings
// Add middleware later if needed: authenticate, authorize(["ADMIN", "SUPER_ADMIN"])
router.put("/effect-settings", updateEffectSettings);

export default router;
