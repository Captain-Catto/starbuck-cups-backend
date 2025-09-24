import { Router } from "express";
import * as notificationController from "../controllers/notification.controller";
import { authenticateWithAutoRefresh } from "../middleware/auth.middleware";

const router = Router();

// GET /api/admin/notifications - Get notifications
router.get("/", authenticateWithAutoRefresh, notificationController.getNotifications);

// PUT /api/admin/notifications/:notificationId/read - Mark notification as read
router.put("/:notificationId/read", authenticateWithAutoRefresh, notificationController.markNotificationAsRead);

// GET /api/admin/notifications/unread/count - Get unread count
router.get("/unread/count", authenticateWithAutoRefresh, notificationController.getUnreadCount);

// PUT /api/admin/notifications/mark-all-read - Mark all notifications as read
router.put("/mark-all-read", authenticateWithAutoRefresh, notificationController.markAllNotificationsAsRead);

export default router;