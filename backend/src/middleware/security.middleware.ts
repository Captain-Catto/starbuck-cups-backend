/**
 * Security middleware for Express application
 */
import { Request, Response, NextFunction } from "express";
import helmet from "helmet";
import cors from "cors";
import { ResponseHelper } from "../types/api";

// CORS configuration
const corsOptions: cors.CorsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      process.env.FRONTEND_URL || "http://localhost:3000",
      process.env.ADMIN_URL || "http://localhost:8081",
      "https://starbuck-cups-frontend.vercel.app",
      "http://localhost:3000",
      "http://localhost:8081",
      "http://127.0.0.1:3000",
      "http://127.0.0.1:8081",
    ];

    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked origin: ${origin}`);
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true, // Allow cookies
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "X-API-Key",
    "Accept",
    "Cookie",
    "Set-Cookie",
  ],
  exposedHeaders: [
    "X-Total-Count",
    "X-Has-Next-Page",
    "X-Token-Refresh-Needed",
    "X-Refresh-Type",
    "Set-Cookie",
  ],
  maxAge: 86400, // 24 hours
};

/**
 * Security headers middleware using Helmet
 */
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https:"],
      scriptSrc: ["'self'", "'unsafe-eval'"], // unsafe-eval needed for development
      imgSrc: ["'self'", "data:", "https:", "http:"],
      connectSrc: ["'self'", "https:", "wss:"],
      fontSrc: ["'self'", "https:", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'", "https:", "data:"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Disable for development
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
});

/**
 * CORS middleware
 */
export const corsMiddleware = cors(corsOptions);

/**
 * Request logging middleware
 */
export const requestLogger = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const start = Date.now();
  const timestamp = new Date().toISOString();

  // Log request
  console.log(`[${timestamp}] ${req.method} ${req.url} - IP: ${req.ip}`);

  // Log response when finished
  res.on("finish", () => {
    const duration = Date.now() - start;
    const statusColor = res.statusCode >= 400 ? "\x1b[31m" : "\x1b[32m"; // Red for errors, green for success
    console.log(
      `[${new Date().toISOString()}] ${statusColor}${res.statusCode}\x1b[0m ${req.method} ${req.url} - ${duration}ms`
    );
  });

  next();
};

/**
 * Request size limiter
 */
export const requestSizeLimit = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const maxSize = parseInt(process.env.MAX_REQUEST_SIZE || "10485760"); // 10MB default

  if (req.headers["content-length"]) {
    const contentLength = parseInt(req.headers["content-length"]);
    if (contentLength > maxSize) {
      res.status(413).json(
        ResponseHelper.error("Request too large", "REQUEST_TOO_LARGE", {
          maxSize,
          received: contentLength,
        })
      );
      return;
    }
  }

  next();
};

/**
 * API versioning middleware
 */
export const apiVersioning = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Extract version from header or URL
  const versionHeader = req.headers["api-version"] as string;
  const versionUrl = req.url.match(/^\/api\/v(\d+)/)?.[1];

  const version = versionHeader || versionUrl || "1";

  // Validate version
  const supportedVersions = ["1"];
  if (!supportedVersions.includes(version)) {
    res.status(400).json(
      ResponseHelper.error("Unsupported API version", "UNSUPPORTED_VERSION", {
        version,
        supported: supportedVersions,
      })
    );
    return;
  }

  // Add version to request
  (req as any).apiVersion = version;
  res.set("API-Version", version);

  next();
};

/**
 * Health check endpoint
 */
export const healthCheck = (req: Request, res: Response) => {
  const healthData = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.env.npm_package_version || "1.0.0",
    environment: process.env.NODE_ENV || "development",
  };

  res.status(200).json(ResponseHelper.success(healthData));
};

/**
 * Error handling middleware
 */
export const errorHandler = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  console.error("Error occurred:", error);

  // Handle CORS errors
  if (error.message === "Not allowed by CORS") {
    res
      .status(403)
      .json(ResponseHelper.error("CORS policy violation", "CORS_ERROR"));
    return;
  }

  // Handle JSON parsing errors
  if (error.type === "entity.parse.failed") {
    res
      .status(400)
      .json(ResponseHelper.error("Invalid JSON format", "INVALID_JSON"));
    return;
  }

  // Handle validation errors
  if (error.name === "ValidationError") {
    res
      .status(400)
      .json(
        ResponseHelper.error(
          "Validation failed",
          "VALIDATION_ERROR",
          error.details
        )
      );
    return;
  }

  // Handle database errors
  if (error.code === "P2002") {
    res
      .status(409)
      .json(
        ResponseHelper.error("Unique constraint violation", "DUPLICATE_ENTRY")
      );
    return;
  }

  if (error.code === "P2025") {
    res.status(404).json(ResponseHelper.error("Record not found", "NOT_FOUND"));
    return;
  }

  // Default server error
  res
    .status(500)
    .json(
      ResponseHelper.error(
        "Internal server error",
        "INTERNAL_ERROR",
        process.env.NODE_ENV === "development" ? error.stack : undefined
      )
    );
};

/**
 * 404 handler
 */
export const notFoundHandler = (req: Request, res: Response) => {
  res
    .status(404)
    .json(
      ResponseHelper.error(
        `Route ${req.method} ${req.url} not found`,
        "ROUTE_NOT_FOUND"
      )
    );
};

/**
 * Security headers for file uploads
 */
export const uploadSecurity = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Prevent executable file uploads
  const dangerousExtensions = [
    ".exe",
    ".bat",
    ".cmd",
    ".com",
    ".scr",
    ".vbs",
    ".js",
    ".jar",
    ".php",
  ];
  const fileName = req.file?.originalname?.toLowerCase();

  if (fileName && dangerousExtensions.some((ext) => fileName.endsWith(ext))) {
    res
      .status(400)
      .json(ResponseHelper.error("File type not allowed", "INVALID_FILE_TYPE"));
    return;
  }

  next();
};
