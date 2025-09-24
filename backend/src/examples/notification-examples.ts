// Example usage of new notification types

import { socketService } from "../services/socket.service";

// Example: User registration notification
export const notifyUserRegistered = (userData: {
  id: string;
  userName: string;
}) => {
  socketService.emitUserNotification({
    id: userData.id,
    userName: userData.userName,
    action: "registered",
  });
};

// Example: System error notification
export const notifySystemError = (module: string, error: string) => {
  socketService.emitSystemNotification({
    level: "error",
    module,
    message: `Lỗi hệ thống tại module ${module}`,
    details: error,
  });
};

// Example: Payment success notification
export const notifyPaymentSuccess = (orderData: {
  orderId: string;
  amount: number;
  customerName: string;
}) => {
  socketService.emitPaymentNotification({
    orderId: orderData.orderId,
    amount: orderData.amount,
    status: "success",
    customerName: orderData.customerName,
  });
};

// Example: Low stock notification
export const notifyLowStock = (productData: {
  productId: string;
  productName: string;
  currentStock: number;
  threshold: number;
}) => {
  socketService.emitInventoryNotification({
    productId: productData.productId,
    productName: productData.productName,
    currentStock: productData.currentStock,
    threshold: productData.threshold,
    action: "low_stock",
  });
};

// Example: Automatic low stock check (could be scheduled)
export const checkInventoryLevels = async () => {
  // This would typically query your database for products with low stock
  const lowStockProducts = [
    { id: "cup001", name: "Ceramic Cup Blue", stock: 5, threshold: 10 },
    { id: "cup002", name: "Glass Mug Large", stock: 2, threshold: 15 },
  ];

  lowStockProducts.forEach((product) => {
    if (product.stock <= product.threshold) {
      notifyLowStock({
        productId: product.id,
        productName: product.name,
        currentStock: product.stock,
        threshold: product.threshold,
      });
    }
  });
};

// Example: System startup notification
export const notifySystemStartup = () => {
  socketService.emitSystemNotification({
    level: "info",
    module: "server",
    message: "Hệ thống đã khởi động thành công",
  });
};
