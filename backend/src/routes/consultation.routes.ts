import { Router } from "express";
import {
  createConsultation,
  getConsultations,
  getConsultationById,
  updateConsultationStatus,
  deleteConsultation,
  getPendingConsultationsCount,
} from "../controllers/consultation.controller";
import { authenticateWithAutoRefresh, rateLimitPublicSubmit, requirePermission } from "../middleware/auth.middleware";
import { PERMISSIONS } from "../constants/permissions";

const router = Router();

// POST /api/consultations - Create new consultation (rate limited)
router.post("/", rateLimitPublicSubmit, createConsultation);

// GET /api/consultations - Get all consultations with optional filters
router.get("/", authenticateWithAutoRefresh, requirePermission(PERMISSIONS.CONSULTATIONS_VIEW), getConsultations);

// GET /api/consultations/pending/count - Get pending consultations count
router.get(
  "/pending/count",
  authenticateWithAutoRefresh, requirePermission(PERMISSIONS.CONSULTATIONS_VIEW),
  getPendingConsultationsCount
);

// GET /api/consultations/:id - Get consultation by ID
router.get("/:id", authenticateWithAutoRefresh, requirePermission(PERMISSIONS.CONSULTATIONS_VIEW), getConsultationById);

// PUT /api/consultations/:id/status - Update consultation status
router.put(
  "/:id/status",
  authenticateWithAutoRefresh, requirePermission(PERMISSIONS.CONSULTATIONS_MANAGE),
  updateConsultationStatus
);

// DELETE /api/consultations/:id - Delete consultation
router.delete("/:id", authenticateWithAutoRefresh, requirePermission(PERMISSIONS.CONSULTATIONS_MANAGE), deleteConsultation);

export default router;
