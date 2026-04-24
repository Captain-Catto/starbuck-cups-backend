import { logger } from "@/utils/logger";
import "dotenv/config";
import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";

// Ensure to call this before importing any other modules!
Sentry.init({
  dsn: process.env.SENTRY_DSN || "",
  integrations: [
    nodeProfilingIntegration(),
  ],
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1.0,
  profilesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1.0,
});

import express from "express";
import cookieParser from "cookie-parser";
import session from "express-session";
import { RedisStore } from "connect-redis";
import { createClient } from "redis";
import { createServer } from "http";
// Import custom middleware
import {
  securityHeaders,
  permissionsPolicy,
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
import customerPhoneRoutes from "./routes/customerPhone.routes";
import ordersRoutes from "./routes/orders.routes";
import consultationRoutes from "./routes/consultation.routes";
import uploadRoutes from "./routes/upload.routes";
import dashboardRoutes from "./routes/dashboard.routes";
import notificationRoutes from "./routes/notification.routes";
import heroImagesRoutes from "./routes/hero-images.routes";
import analyticsRoutes from "./routes/analytics.routes";
import promotionalBannersRoutes from "./routes/promotional-banners.routes";
import settingsRoutes from "./routes/settings.routes";
import newsRoutes from "./routes/news.routes";
import { searchRoutes } from "./routes/search.routes";

// Import Socket.IO service
import { socketService } from "./services/socket.service";

// Import database connection
import sequelize from "./config/database";
import {
  initializeDatabase,
} from "./config/database-init";
import { validateRequiredEnv } from "./config/env";

import { initializeMeiliSearch, syncInitialData } from "./config/meilisearch-init";
validateRequiredEnv();

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 8080;

const parseTrustProxy = (): boolean | number | string => {
  const raw = process.env.TRUST_PROXY;

  if (!raw || raw.trim() === "") {
    return process.env.NODE_ENV === "production" ? 1 : false;
  }

  const normalized = raw.trim().toLowerCase();
  if (normalized === "true") {
    return true;
  }
  if (normalized === "false") {
    return false;
  }

  const asNumber = Number(raw);
  if (!Number.isNaN(asNumber)) {
    return asNumber;
  }

  return raw;
};

const shouldUseSecureCookie =
  process.env.COOKIE_SECURE === "true" ||
  (process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE !== "false");

const sessionSameSite =
  (process.env.COOKIE_SAME_SITE as "lax" | "strict" | "none") || "lax";

const sessionCookieDomain = process.env.COOKIE_DOMAIN || undefined;

app.set("trust proxy", parseTrustProxy());

// Security and middleware setup
app.use(securityHeaders);
app.use(permissionsPolicy);
app.use(corsMiddleware);
app.get("/favicon.ico", (_req, res) => res.status(204).end());
app.get("/security.txt", (_req, res) => res.status(204).end());
app.get("/.well-known/security.txt", (_req, res) => res.status(204).end());
app.use(requestLogger);
app.use(requestSizeLimit);
app.use(apiVersioning);

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser()); // Add cookie parser middleware

// Initialize Redis client for sessions
const redisClient = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
});
redisClient.connect().catch(logger.error);

// Session middleware (Redis store)
const sessionStore = new RedisStore({
  client: redisClient,
  prefix: "shop_session:",
  ttl: 24 * 60 * 60, // 24 hours
});

app.use(
  session({
    secret: (process.env.SESSION_SECRET || process.env.JWT_SECRET) as string,
    proxy: shouldUseSecureCookie,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: shouldUseSecureCookie,
      httpOnly: true,
      sameSite: sessionSameSite,
      domain: sessionCookieDomain,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  })
);

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
app.use("/api/promotional-banners", promotionalBannersRoutes);
app.use("/api/news", newsRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/api/settings", settingsRoutes); // Support double /api prefix from frontend
app.use("/api/search", searchRoutes);

// Public routes (for customer-facing website)
app.use("/api/consultations", consultationRoutes);

// Admin routes (for admin panel)
app.use("/api/admin/upload", uploadRoutes);
app.use("/api/admin/colors", colorsRoutes);
app.use("/api/admin/capacities", capacitiesRoutes);
app.use("/api/admin/categories", categoriesRoutes);
app.use("/api/admin/products", adminProductsRouter);
app.use("/api/admin/customers", customersRoutes);
app.use("/api/admin", customerPhoneRoutes);
app.use("/api/admin/orders", ordersRoutes);
app.use("/api/admin/consultations", consultationRoutes);
app.use("/api/admin/dashboard", dashboardRoutes);
app.use("/api/admin/notifications", notificationRoutes);
app.use("/api/admin/hero-images", heroImagesRoutes);
app.use("/api/analytics", analyticsRoutes);

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
        search: "/api/search",
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

// Sentry error handler must be registered before custom error handlers
Sentry.setupExpressErrorHandler(app);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Initialize Socket.IO
socketService.initialize(server);

initializeMeiliSearch().then((isReady) => {
  if (isReady) {
    syncInitialData();
  }
});

// Initialize database and start server
const startServer = async () => {
  try {
    // Initialize database connection and sync models
    await initializeDatabase();
    
    // sessionStore doesn't need explicit init like sequelize store does,
    // but we log it for consistency
    logger.info("✅ Redis Session store ready.");

    // Start server
    server.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`);
      logger.info(`📚 Environment: ${process.env.NODE_ENV}`);
      logger.info(`🔗 Health check: http://localhost:${PORT}/health`);
      logger.info(`📖 API docs: http://localhost:${PORT}/docs`);
      logger.info(`🔌 Socket.IO ready for connections`);
    });
  } catch (error) {
    logger.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

// Start the application
startServer();

// Graceful shutdown
process.on("SIGTERM", () => {
  logger.info("SIGTERM received, shutting down gracefully");
  server.close(() => {
    logger.info("Process terminated");
  });
});

export { app, server };
