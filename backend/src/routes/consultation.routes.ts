import { Router } from "express";
import {
  createConsultation,
  getConsultations,
  getConsultationById,
  updateConsultationStatus,
  deleteConsultation,
  getPendingConsultationsCount,
} from "../controllers/consultation.controller";
import { authenticateWithAutoRefresh } from "../middleware/auth.middleware";

const router = Router();

// POST /api/consultations - Create new consultation
router.post("/", createConsultation);

// GET /api/consultations - Get all consultations with optional filters
router.get("/", authenticateWithAutoRefresh, getConsultations);

// GET /api/consultations/pending/count - Get pending consultations count
router.get(
  "/pending/count",
  authenticateWithAutoRefresh,
  getPendingConsultationsCount
);

// GET /api/consultations/:id - Get consultation by ID
router.get("/:id", authenticateWithAutoRefresh, getConsultationById);

// PUT /api/consultations/:id/status - Update consultation status
router.put(
  "/:id/status",
  authenticateWithAutoRefresh,
  updateConsultationStatus
);

// DELETE /api/consultations/:id - Delete consultation
router.delete("/:id", authenticateWithAutoRefresh, deleteConsultation);

export default router;
