import { logger } from "@/utils/logger";
import { Server as SocketIOServer, Socket } from "socket.io";
import { Server as HTTPServer } from "http";
import {
  socketAuthMiddleware,
  requireAdminRole,
} from "../middleware/socket.middleware";
import { Order } from "../models/Order";
import { Consultation } from "../models/Consultation";
import { Customer } from "../models/Customer";
import {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
  NotificationPayload,
  ConsultationNotification,
  OrderNotification,
  UserNotification,
  SystemNotification,
  PaymentNotification,
  InventoryNotification,
} from "../types/socket.types";
import { getAllowedOrigins, isAllowedOrigin } from "../config/cors";

class SocketService {
  private io: SocketIOServer<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  > | null = null;

  private adminSockets = new Map<string, Socket>();

  private readonly isSocketLoggingEnabled =
    process.env.SOCKET_LOG_ENABLED === "true" ||
    (process.env.SOCKET_LOG_ENABLED !== "false" &&
      process.env.NODE_ENV !== "production");

  private info(message: string, ...args: unknown[]): void {
    if (!this.isSocketLoggingEnabled) {
      return;
    }

    if (args.length > 0) {
      logger.info(message, ...args);
      return;
    }

    logger.info(message);
  }
  
  public initialize(server: HTTPServer): void {
    const allowedOrigins = getAllowedOrigins();

    this.io = new SocketIOServer(server, {
      cors: {
        origin: (origin, callback) => {
          if (isAllowedOrigin(origin, allowedOrigins)) {
            callback(null, true);
            return;
          }

          logger.warn(`Socket CORS blocked origin: ${origin}`);
          callback(new Error("Not allowed by CORS"));
        },
        methods: ["GET", "POST"],
        credentials: true,
      },
      transports: ["websocket", "polling"],
    });

    // Apply authentication middleware
    this.io.use(socketAuthMiddleware);

    // Handle connections
    this.io.on("connection", (socket) => {
      this.handleConnection(socket);
    });

    this.info("🔌 Socket.IO server initialized");
  }

  private handleConnection(socket: Socket): void {
    const user = (socket as any).data?.user;

    if (!user) {
      logger.error("Socket connection without user data");
      socket.disconnect();
      return;
    }

    this.info("👤 Socket client connected");

    // Handle admin joining
    socket.on("admin:join", () => {
      this.handleAdminJoin(socket, user);
    });

    // Handle admin leaving
    socket.on("admin:leave", () => {
      this.handleAdminLeave(socket, user);
    });

    // Handle notification mark as read
    socket.on("notification:mark_read", (notificationId: string) => {
      this.info(`📱 Notification marked as read: ${notificationId}`);
      // Future: Update notification status in database
    });

    // Handle disconnection
    socket.on("disconnect", (reason) => {
      this.info(`👋 Socket client disconnected: ${reason}`);
      this.adminSockets.delete(user.id);
    });
  }

  private handleAdminJoin(socket: Socket, user: any): void {
    // Verify admin role
    const adminRoles = ["SUPER_ADMIN", "ADMIN", "STAFF"];
    if (!adminRoles.includes(user.role)) {
      socket.emit("error", "Admin role required");
      this.info("❌ Admin room join rejected due to role");
      return;
    }

    // Join admin room
    socket.join("admin-room");
    this.adminSockets.set(user.id, socket);

    this.info("🔑 Admin joined socket room");

    // Confirm successful join
    socket.emit("admin:joined");

    // Send current notification count
    this.sendNotificationCount();
  }

  private handleAdminLeave(socket: Socket, user: any): void {
    socket.leave("admin-room");
    this.adminSockets.delete(user.id);
    this.info("🚪 Admin left socket room");
  }

  // Emit consultation created notification
  public emitConsultationCreated(consultationData: {
    id: string;
    customerName: string;
    items: number;
  }): void {
    if (!this.io) {
      logger.error("Socket.IO not initialized");
      return;
    }

    const notification: ConsultationNotification = {
      id: `consultation_${consultationData.id}_${Date.now()}`,
      type: "consultation",
      title: "Tư vấn mới",
      message: `${consultationData.customerName} đã gửi yêu cầu tư vấn về ${consultationData.items} sản phẩm`,
      data: {
        consultationId: consultationData.id,
        customerName: consultationData.customerName,
        items: consultationData.items,
      },
      timestamp: new Date().toISOString(),
    };

    // Emit to admin room
    this.io.to("admin-room").emit("notification:new", notification);

    this.info(`📧 Consultation notification sent: ${consultationData.id}`);

    // Update notification count
    this.sendNotificationCount();
  }

  // Emit order created notification (for future use)
  public emitOrderCreated(orderData: {
    id: string;
    customerName: string;
    totalAmount: number;
  }): void {
    if (!this.io) {
      logger.error("Socket.IO not initialized");
      return;
    }

    const notification: OrderNotification = {
      id: `order_${orderData.id}_${Date.now()}`,
      type: "order",
      title: "Đơn hàng mới",
      message: `${orderData.customerName} đã tạo đơn hàng mới`,
      data: {
        orderId: orderData.id,
        customerName: orderData.customerName,
        totalAmount: orderData.totalAmount,
      },
      timestamp: new Date().toISOString(),
    };

    // Emit to admin room
    this.io.to("admin-room").emit("notification:new", notification);

    this.info(`📧 Order notification sent: ${orderData.id}`);

    // Update notification count
    this.sendNotificationCount();
  }

  // Send current notification count
  private async sendNotificationCount(): Promise<void> {
    if (!this.io) return;

    try {
      // Future: Get actual count from database
      // For now, we'll simulate with a simple count
      const count = await this.getUnreadNotificationCount();

      this.io.to("admin-room").emit("notification:count_update", count);
    } catch (error) {
      logger.error("Error sending notification count:", error);
    }
  }

  // Get unread notification count from database
  private async getUnreadNotificationCount(): Promise<number> {
    try {
      // Count pending consultations as unread notifications
      const pendingConsultations = await Consultation.count({
        where: {
          status: "PENDING",
        },
      });

      // Add other unread counts when orders are implemented
      const unreadCount = pendingConsultations;

      this.info(`📊 Socket unreadCount: ${unreadCount}`);
      return unreadCount;
    } catch (error) {
      logger.error("Error calculating unread notification count:", error);
      return 0; // Return 0 on error instead of random number
    }
  }

  // Get Socket.IO instance
  public getIO(): SocketIOServer<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  > | null {
    return this.io;
  }

  // Get connected admin count
  public getConnectedAdminCount(): number {
    return this.adminSockets.size;
  }

  // Emit user notification
  public emitUserNotification(userData: {
    id: string;
    userName: string;
    action: "registered" | "updated" | "deleted";
  }): void {
    if (!this.io) {
      logger.error("Socket.IO not initialized");
      return;
    }

    const notification: UserNotification = {
      id: `user_${userData.id}_${Date.now()}`,
      type: "user",
      title: "Người dùng",
      message: `${userData.userName} đã ${userData.action === "registered" ? "đăng ký" : userData.action === "updated" ? "cập nhật thông tin" : "bị xóa"}`,
      data: {
        userId: userData.id,
        userName: userData.userName,
        action: userData.action,
      },
      timestamp: new Date().toISOString(),
    };

    this.io.to("admin-room").emit("notification:new", notification);
    this.info(`👤 User notification sent: ${userData.id} ${userData.action}`);
    this.sendNotificationCount();
  }

  // Emit system notification
  public emitSystemNotification(systemData: {
    level: "info" | "warning" | "error";
    module: string;
    message: string;
    details?: string;
  }): void {
    if (!this.io) {
      logger.error("Socket.IO not initialized");
      return;
    }

    const notification: SystemNotification = {
      id: `system_${systemData.module}_${Date.now()}`,
      type: "system",
      title: "Hệ thống",
      message: systemData.message,
      data: {
        level: systemData.level,
        module: systemData.module,
        details: systemData.details,
      },
      timestamp: new Date().toISOString(),
    };

    this.io.to("admin-room").emit("notification:new", notification);
    this.info(
      `🔧 System notification sent: ${systemData.level} from ${systemData.module}`
    );
    this.sendNotificationCount();
  }

  // Emit payment notification
  public emitPaymentNotification(paymentData: {
    orderId: string;
    amount: number;
    status: "success" | "failed" | "pending";
    customerName: string;
  }): void {
    if (!this.io) {
      logger.error("Socket.IO not initialized");
      return;
    }

    const notification: PaymentNotification = {
      id: `payment_${paymentData.orderId}_${Date.now()}`,
      type: "payment",
      title: "Thanh toán",
      message: `Thanh toán ${paymentData.status === "success" ? "thành công" : paymentData.status === "failed" ? "thất bại" : "đang xử lý"} cho đơn hàng ${paymentData.orderId}`,
      data: {
        orderId: paymentData.orderId,
        amount: paymentData.amount,
        status: paymentData.status,
        customerName: paymentData.customerName,
      },
      timestamp: new Date().toISOString(),
    };

    this.io.to("admin-room").emit("notification:new", notification);
    this.info(
      `💳 Payment notification sent: ${paymentData.status} for order ${paymentData.orderId}`
    );
    this.sendNotificationCount();
  }

  // Emit inventory notification
  public emitInventoryNotification(inventoryData: {
    productId: string;
    productName: string;
    currentStock: number;
    threshold: number;
    action: "low_stock" | "out_of_stock" | "restocked";
  }): void {
    if (!this.io) {
      logger.error("Socket.IO not initialized");
      return;
    }

    const actionMessages = {
      low_stock: `Sản phẩm "${inventoryData.productName}" sắp hết hàng (còn ${inventoryData.currentStock})`,
      out_of_stock: `Sản phẩm "${inventoryData.productName}" đã hết hàng`,
      restocked: `Sản phẩm "${inventoryData.productName}" đã được nhập thêm hàng`,
    };

    const notification: InventoryNotification = {
      id: `inventory_${inventoryData.productId}_${Date.now()}`,
      type: "inventory",
      title: "Kho hàng",
      message: actionMessages[inventoryData.action],
      data: {
        productId: inventoryData.productId,
        productName: inventoryData.productName,
        currentStock: inventoryData.currentStock,
        threshold: inventoryData.threshold,
        action: inventoryData.action,
      },
      timestamp: new Date().toISOString(),
    };

    this.io.to("admin-room").emit("notification:new", notification);
    this.info(
      `📦 Inventory notification sent: ${inventoryData.action} for ${inventoryData.productId}`
    );
    this.sendNotificationCount();
  }
  // Emit settings update
  public emitSettingsUpdate(settings: any): void {
    if (!this.io) {
      logger.error("Socket.IO not initialized");
      return;
    }

    // Emit to all connected clients (settings are global)
    this.io.emit("settings:updated", settings);
    this.info("⚙️ Settings update broadcasted");
  }
}

// Export singleton instance
export const socketService = new SocketService();
