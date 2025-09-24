import express from "express";
import { getDashboardStats, getRevenueData, getStatistics } from "../controllers/dashboard.controller";
import { authenticate, requireAdmin } from "../middleware/auth.middleware";

const router = express.Router();

// Dashboard routes - all require admin authentication
router.get("/stats", authenticate, requireAdmin, getDashboardStats);
router.get("/revenue", authenticate, requireAdmin, getRevenueData);
router.get("/statistics", authenticate, requireAdmin, getStatistics);

export default router;