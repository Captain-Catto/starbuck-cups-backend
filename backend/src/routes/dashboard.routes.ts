import express from "express";
import { getDashboardStats, getRevenueData, getStatistics, getTopSellingProducts } from "../controllers/dashboard.controller";
import { authenticateWithAutoRefresh, requireAdmin } from "../middleware/auth.middleware";

const router = express.Router();

// Dashboard routes - simple authentication
router.get("/stats", authenticateWithAutoRefresh, requireAdmin, getDashboardStats);
router.get("/revenue", authenticateWithAutoRefresh, requireAdmin, getRevenueData);
router.get("/statistics", authenticateWithAutoRefresh, requireAdmin, getStatistics);
router.get("/top-selling-products", authenticateWithAutoRefresh, requireAdmin, getTopSellingProducts);

export default router;