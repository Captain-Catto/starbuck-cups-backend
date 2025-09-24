import { Request, Response } from "express";
import { PrismaClient } from "../generated/prisma";
import { ResponseHelper } from "../types/api";

const prisma = new PrismaClient();

/**
 * Get notifications for admin users
 * Convert consultations and orders into notifications format
 */
export const getNotifications = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 20, type } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const notifications = [];

    // Get recent consultations as notifications
    if (!type || type === 'consultation') {
      const consultations = await prisma.consultation.findMany({
        include: {
          consultationItems: {
            include: {
              product: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: Number(limit),
        skip: type === 'consultation' ? skip : 0
      });

      const consultationNotifications = consultations.map(consultation => ({
        id: `consultation_${consultation.id}`,
        type: 'consultation',
        title: 'Tư vấn mới',
        message: `${consultation.customerName} đã gửi yêu cầu tư vấn về ${consultation.totalItems} sản phẩm`,
        timestamp: consultation.createdAt.toISOString(),
        read: consultation.status !== 'PENDING', // Mark as read if not pending
        data: {
          consultationId: consultation.id,
          customerName: consultation.customerName,
          itemCount: consultation.totalItems,
          status: consultation.status,
          phoneNumber: consultation.phoneNumber
        }
      }));

      notifications.push(...consultationNotifications);
    }

    // Get recent orders as notifications (when orders are implemented)
    if (!type || type === 'order') {
      // For now, we don't have orders, so we'll skip this
      // When orders are implemented, add similar logic here
    }

    // Sort by timestamp (newest first)
    notifications.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Apply pagination if no specific type
    const startIndex = type ? 0 : skip;
    const paginatedNotifications = notifications.slice(startIndex, startIndex + Number(limit));

    // Count unread notifications
    const unreadCount = notifications.filter(n => !n.read).length;

    const response = {
      success: true,
      data: paginatedNotifications,
      meta: {
        timestamp: new Date().toISOString(),
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: notifications.length,
          totalPages: Math.ceil(notifications.length / Number(limit))
        },
        unreadCount
      },
      error: null,
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error("Get notifications error:", error);
    return res
      .status(500)
      .json(
        ResponseHelper.error("Failed to get notifications", "GET_NOTIFICATIONS_ERROR")
      );
  }
};

/**
 * Mark notification as read
 */
export const markNotificationAsRead = async (req: Request, res: Response) => {
  try {
    const { notificationId } = req.params;

    // Extract consultation/order ID from notification ID
    if (notificationId.startsWith('consultation_')) {
      const consultationId = notificationId.replace('consultation_', '');

      // Update consultation status if it's still pending
      await prisma.consultation.updateMany({
        where: {
          id: consultationId,
          status: 'PENDING'
        },
        data: {
          status: 'IN_PROGRESS'
        }
      });
    }

    // For orders, implement similar logic when orders are ready

    const response = {
      success: true,
      data: { notificationId, marked: true },
      meta: { timestamp: new Date().toISOString() },
      error: null,
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error("Mark notification as read error:", error);
    return res
      .status(500)
      .json(
        ResponseHelper.error("Failed to mark notification as read", "MARK_NOTIFICATION_ERROR")
      );
  }
};

/**
 * Get unread notification count
 */
export const getUnreadCount = async (req: Request, res: Response) => {
  try {
    // Count pending consultations as unread notifications
    const pendingConsultations = await prisma.consultation.count({
      where: {
        status: 'PENDING'
      }
    });

    // Add other unread counts when orders are implemented
    const unreadCount = pendingConsultations;

    const response = {
      success: true,
      data: { unreadCount },
      meta: { timestamp: new Date().toISOString() },
      error: null,
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error("Get unread count error:", error);
    return res
      .status(500)
      .json(
        ResponseHelper.error("Failed to get unread count", "GET_UNREAD_COUNT_ERROR")
      );
  }
};

/**
 * Mark all notifications as read
 */
export const markAllNotificationsAsRead = async (req: Request, res: Response) => {
  try {
    // Update all PENDING consultations to IN_PROGRESS (mark as read)
    const result = await prisma.consultation.updateMany({
      where: {
        status: 'PENDING'
      },
      data: {
        status: 'IN_PROGRESS'
      }
    });

    const response = {
      success: true,
      data: {
        updatedCount: result.count,
        message: `Marked ${result.count} notifications as read`
      },
      meta: { timestamp: new Date().toISOString() },
      error: null,
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error("Mark all notifications as read error:", error);
    return res
      .status(500)
      .json(
        ResponseHelper.error("Failed to mark all notifications as read", "MARK_ALL_NOTIFICATIONS_ERROR")
      );
  }
};