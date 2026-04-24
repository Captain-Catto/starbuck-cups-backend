/**
 * Security middleware for Express application
 */
import { Request, Response, NextFunction } from "express";
import helmet from "helmet";
import cors from "cors";
import crypto from "crypto";
import { ResponseHelper } from "../types/api";
import { getAllowedOrigins, isAllowedOrigin } from "../config/cors";
import { logger, loggerContext } from "../utils/logger";

const requestLoggingEnabled =
  process.env.REQUEST_LOG_ENABLED === "true" ||
  (process.env.REQUEST_LOG_ENABLED !== "false" &&
    process.env.NODE_ENV !== "production");

// CORS configuration
const corsOptions: cors.CorsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = getAllowedOrigins();

    if (isAllowedOrigin(origin, allowedOrigins)) {
      callback(null, true);
    } else {
      logger.warn(`CORS blocked origin: ${origin}`);
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
    "Origin",
    "Cookie",
    "Set-Cookie",
    "Access-Control-Allow-Credentials",
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
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
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
 * Permissions-Policy header (not supported by Helmet natively)
 */
export const permissionsPolicy = (
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()"
  );
  next();
};

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
  const requestId = crypto.randomUUID();
  (req as any).id = requestId;

  loggerContext.run({ requestId }, () => {
    if (!requestLoggingEnabled) {
      return next();
    }

    const start = Date.now();

    // Log request
    logger.info(`${req.method} ${req.url} - IP: ${req.ip}`);

    // Log response when finished
    res.on("finish", () => {
      const duration = Date.now() - start;
      if (res.statusCode >= 500) {
        logger.error(`${res.statusCode} ${req.method} ${req.url} - ${duration}ms`);
      } else if (res.statusCode >= 400) {
        logger.warn(`${res.statusCode} ${req.method} ${req.url} - ${duration}ms`);
      } else {
        logger.info(`${res.statusCode} ${req.method} ${req.url} - ${duration}ms`);
      }
    });

    next();
  });
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
  // Handle CORS errors
  if (error.message === "Not allowed by CORS") {
    logger.error(`CORS rejected: ${req.method} ${req.url} origin=${req.headers.origin}`);
    res
      .status(403)
      .json(ResponseHelper.error("CORS policy violation", "CORS_ERROR"));
    return;
  }

  // Handle JSON parsing errors
  if (error.type === "entity.parse.failed") {
    logger.warn(`Invalid JSON: ${req.method} ${req.url}`);
    res
      .status(400)
      .json(ResponseHelper.error("Invalid JSON format", "INVALID_JSON"));
    return;
  }

  // Handle validation errors
  if (error.name === "ValidationError") {
    logger.warn(`Validation error: ${req.method} ${req.url}`);
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
    logger.warn(`Duplicate entry: ${req.method} ${req.url}`);
    res
      .status(409)
      .json(
        ResponseHelper.error("Unique constraint violation", "DUPLICATE_ENTRY")
      );
    return;
  }

  if (error.code === "P2025") {
    logger.warn(`Record not found: ${req.method} ${req.url}`);
    res.status(404).json(ResponseHelper.error("Record not found", "NOT_FOUND"));
    return;
  }

  // Real server error — log and capture in Sentry
  logger.error("Server error:", error);
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
