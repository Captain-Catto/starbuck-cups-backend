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
import { authenticate, requireAdmin } from "../middleware/auth.middleware";

const router = express.Router();

// Order routes
router.get("/", authenticate, getOrders);
router.get("/stats", authenticate, getOrderStats);
router.get("/recent", authenticate, getRecentOrders);
router.get("/:id", authenticate, getOrderById);
router.post("/", authenticate, requireAdmin, createOrder);
router.patch("/:id/status", authenticate, requireAdmin, updateOrderStatus);
router.put("/:id", authenticate, requireAdmin, updateOrder);

export default router;
