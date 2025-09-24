import express from "express";
import {
  getOrders,
  getOrderById,
  createOrder,
  updateOrderStatus,
  updateOrder,
  getOrderStats,
  getRecentOrders,
} from "../controllers/orders.controller";
import { authenticateWithAutoRefresh, requireAdmin } from "../middleware/auth.middleware";

const router = express.Router();

// Order routes
router.get("/", authenticateWithAutoRefresh, getOrders);
router.get("/stats", authenticateWithAutoRefresh, getOrderStats);
router.get("/recent", authenticateWithAutoRefresh, getRecentOrders);
router.get("/:id", authenticateWithAutoRefresh, getOrderById);
router.post("/", authenticateWithAutoRefresh, requireAdmin, createOrder);
router.patch("/:id/status", authenticateWithAutoRefresh, requireAdmin, updateOrderStatus);
router.put("/:id", authenticateWithAutoRefresh, requireAdmin, updateOrder);

export default router;
