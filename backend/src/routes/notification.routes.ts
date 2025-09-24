import { Router } from "express";
import * as notificationController from "../controllers/notification.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();

// GET /api/admin/notifications - Get notifications
router.get("/", authenticate, notificationController.getNotifications);

// PUT /api/admin/notifications/:notificationId/read - Mark notification as read
router.put("/:notificationId/read", authenticate, notificationController.markNotificationAsRead);

// GET /api/admin/notifications/unread/count - Get unread count
router.get("/unread/count", authenticate, notificationController.getUnreadCount);

// PUT /api/admin/notifications/mark-all-read - Mark all notifications as read
router.put("/mark-all-read", authenticate, notificationController.markAllNotificationsAsRead);

export default router;