import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import { createServer } from "http";

// Import custom middleware
import {
  securityHeaders,
  corsMiddleware,
  requestLogger,
  requestSizeLimit,
  apiVersioning,
  healthCheck,
  errorHandler,
  notFoundHandler,
} from "./middleware/security.middleware";

// Import routes
import authRoutes from "./routes/auth.routes";
import colorsRoutes from "./routes/colors.routes";
import capacitiesRoutes from "./routes/capacities.routes";
import categoriesRoutes from "./routes/categories.routes";
import productsRoutes, { adminProductsRouter } from "./routes/products.routes";
import customersRoutes from "./routes/customers.routes";
import ordersRoutes from "./routes/orders.routes";
import consultationRoutes from "./routes/consultation.routes";
import uploadRoutes from "./routes/upload.routes";
import dashboardRoutes from "./routes/dashboard.routes";
import notificationRoutes from "./routes/notification.routes";
import heroImagesRoutes from "./routes/hero-images.routes";
// import { searchRoutes } from "./routes/search.routes";

// Import Socket.IO service
import { socketService } from "./services/socket.service";

// Import MeiliSearch initialization - TEMPORARILY DISABLED
// import {
//   initializeMeiliSearch,
//   syncInitialData,
// } from "./config/meilisearch-init";

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 8080;

// Security and middleware setup
app.use(securityHeaders);
app.use(corsMiddleware);
app.use(requestLogger);
app.use(requestSizeLimit);
app.use(apiVersioning);

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser()); // Add cookie parser middleware

// Health check endpoint
app.get("/health", healthCheck);

// API routes
app.use("/api/auth", authRoutes);

// Public routes (for customer-facing pages)
app.use("/api/colors", colorsRoutes);
app.use("/api/capacities", capacitiesRoutes);
app.use("/api/categories", categoriesRoutes);
app.use("/api/products", productsRoutes);
app.use("/api/hero-images", heroImagesRoutes);
// app.use("/api/search", searchRoutes); // TEMPORARILY DISABLED - Meilisearch not available

// Public routes (for customer-facing website)
app.use("/api/consultations", consultationRoutes);

// Admin routes (for admin panel)
app.use("/api/admin/upload", uploadRoutes);
app.use("/api/admin/colors", colorsRoutes);
app.use("/api/admin/capacities", capacitiesRoutes);
app.use("/api/admin/categories", categoriesRoutes);
app.use("/api/admin/products", adminProductsRouter);
app.use("/api/admin/customers", customersRoutes);
app.use("/api/admin/orders", ordersRoutes);
app.use("/api/admin/consultations", consultationRoutes);
app.use("/api/admin/dashboard", dashboardRoutes);
app.use("/api/admin/notifications", notificationRoutes);
app.use("/api/admin/hero-images", heroImagesRoutes);

// API info endpoint
app.get("/api/v1", (req, res) => {
  res.json({
    success: true,
    data: {
      message: "Cups Shop E-commerce API",
      version: "1.0.0",
      endpoints: {
        health: "/health",
        docs: "/docs",
        auth: "/api/auth",
        upload: "/api/admin/upload",
        colors: "/api/admin/colors",
        capacities: "/api/admin/capacities",
        categories: "/api/admin/categories",
        products: "/api/admin/products",
        customers: "/api/admin/customers",
        orders: "/api/admin/orders",
        admin: "/api/v1/admin",
        customer: "/api/v1",
      },
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
    error: null,
  });
});

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Initialize Socket.IO
socketService.initialize(server);

// Initialize MeiliSearch - TEMPORARILY DISABLED
// initializeMeiliSearch().then(() => {
//   syncInitialData();
// });

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📚 Environment: ${process.env.NODE_ENV}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`📖 API docs: http://localhost:${PORT}/docs`);
  console.log(`🔌 Socket.IO ready for connections`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully");
  server.close(() => {
    console.log("Process terminated");
  });
});

export { app, server };
