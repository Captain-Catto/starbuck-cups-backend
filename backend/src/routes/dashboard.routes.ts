import express from "express";
import { getDashboardStats, getRevenueData, getStatistics, getTopSellingProducts } from "../controllers/dashboard.controller";
import { authenticateWithAutoRefresh, requirePermission } from "../middleware/auth.middleware";
import { PERMISSIONS } from "../constants/permissions";

const router = express.Router();

// Dashboard routes - simple authentication
router.get("/stats", authenticateWithAutoRefresh, requirePermission(PERMISSIONS.DASHBOARD_VIEW), getDashboardStats);
router.get("/revenue", authenticateWithAutoRefresh, requirePermission(PERMISSIONS.DASHBOARD_VIEW), getRevenueData);
router.get("/statistics", authenticateWithAutoRefresh, requirePermission(PERMISSIONS.DASHBOARD_VIEW), getStatistics);
router.get("/top-selling-products", authenticateWithAutoRefresh, requirePermission(PERMISSIONS.DASHBOARD_VIEW), getTopSellingProducts);

export default router;