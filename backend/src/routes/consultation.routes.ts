import { Router } from "express";
import { ConsultationController } from "../controllers/consultation.controller";
import { authenticateWithAutoRefresh } from "../middleware/auth.middleware";

const router = Router();
const consultationController = new ConsultationController();

// POST /api/consultations - Create new consultation
router.post("/", consultationController.createConsultation);

// GET /api/consultations - Get all consultations with optional filters
router.get("/", authenticateWithAutoRefresh, consultationController.getConsultations);

// GET /api/consultations/pending/count - Get pending consultations count
router.get("/pending/count", authenticateWithAutoRefresh, consultationController.getPendingConsultationsCount);

// GET /api/consultations/:id - Get consultation by ID
router.get("/:id", authenticateWithAutoRefresh, consultationController.getConsultationById);

// PUT /api/consultations/:id/status - Update consultation status
router.put("/:id/status", authenticateWithAutoRefresh, consultationController.updateConsultationStatus);

// DELETE /api/consultations/:id - Delete consultation
router.delete("/:id", authenticateWithAutoRefresh, consultationController.deleteConsultation);

export default router;
