import { Router } from "express";
import { ConsultationController } from "../controllers/consultation.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();
const consultationController = new ConsultationController();

// POST /api/consultations - Create new consultation
router.post("/", consultationController.createConsultation);

// GET /api/consultations - Get all consultations with optional filters
router.get("/", authenticate, consultationController.getConsultations);

// GET /api/consultations/pending/count - Get pending consultations count
router.get("/pending/count", authenticate, consultationController.getPendingConsultationsCount);

// GET /api/consultations/:id - Get consultation by ID
router.get("/:id", authenticate, consultationController.getConsultationById);

// PUT /api/consultations/:id/status - Update consultation status
router.put("/:id/status", authenticate, consultationController.updateConsultationStatus);

// DELETE /api/consultations/:id - Delete consultation
router.delete("/:id", authenticate, consultationController.deleteConsultation);

export default router;
