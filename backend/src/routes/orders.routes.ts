import express from "express";
import {
  getOrders,
  getOrderById,
  createOrder,
  updateOrderStatus,
  updateOrder,
  deleteOrder,
  getOrderStats,
  getRecentOrders,
} from "../controllers/orders.controller";
import { authenticateWithAutoRefresh, requirePermission } from "../middleware/auth.middleware";
import { PERMISSIONS } from "../constants/permissions";

const router = express.Router();

// Order routes
router.get("/", authenticateWithAutoRefresh, requirePermission(PERMISSIONS.ORDERS_VIEW), getOrders);
router.get("/stats", authenticateWithAutoRefresh, requirePermission(PERMISSIONS.ORDERS_VIEW), getOrderStats);
router.get("/recent", authenticateWithAutoRefresh, requirePermission(PERMISSIONS.ORDERS_VIEW), getRecentOrders);
router.get("/:id", authenticateWithAutoRefresh, requirePermission(PERMISSIONS.ORDERS_VIEW), getOrderById);
router.post("/", authenticateWithAutoRefresh, requirePermission(PERMISSIONS.ORDERS_MANAGE), createOrder);
router.patch("/:id/status", authenticateWithAutoRefresh, requirePermission(PERMISSIONS.ORDERS_MANAGE), updateOrderStatus);
router.put("/:id", authenticateWithAutoRefresh, requirePermission(PERMISSIONS.ORDERS_MANAGE), updateOrder);
router.delete("/:id", authenticateWithAutoRefresh, requirePermission(PERMISSIONS.ORDERS_MANAGE), deleteOrder);

export default router;
