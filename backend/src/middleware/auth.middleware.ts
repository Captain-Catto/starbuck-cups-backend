/**
 * Authentication and authorization middleware
 */
import { Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { createClient } from "redis";
import { AdminRole } from "../models/AdminUser";
import { AdminUser } from "../models/AdminUser";
import {
  verifyAccessToken,
  verifyRefreshToken,
  extractTokenFromHeader,
} from "../utils/jwt";
import { ResponseHelper } from "../types/api";

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
        role: AdminRole;
        username: string;
      };
    }
  }
}

export interface AuthRequest extends Request {
  user: {
    userId: string;
    email: string;
    role: AdminRole;
    username: string;
  };
}

/**
 * Authentication middleware - verifies JWT token
 */
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Extract token from Authorization header
    const token = extractTokenFromHeader(req.headers.authorization);

    if (!token) {
      res
        .status(401)
        .json(
          ResponseHelper.error("Access token required", "MISSING_ACCESS_TOKEN")
        );
      return;
    }

    // Verify token
    const decoded = verifyAccessToken(token);

    // Check if user exists and is active
    const user = await AdminUser.findOne({
      where: { id: decoded.userId },
      attributes: ["id", "email", "role", "isActive"],
    });

    if (!user || !user.isActive) {
      res
        .status(401)
        .json(
          ResponseHelper.error(
            "Invalid or inactive user account",
            "INVALID_USER_ACCOUNT"
          )
        );
      return;
    }

    // Add user to request object
    req.user = {
      userId: user.id,
      email: user.email,
      role: user.role,
      username: decoded.username,
    };

    next();
  } catch (error: any) {
    console.error("Authentication middleware error:", error);

    // Handle specific JWT errors
    if (error.message.includes("expired")) {
      res
        .status(401)
        .json(ResponseHelper.error("Token expired", "TOKEN_EXPIRED"));
      return;
    } else if (error.message.includes("invalid")) {
      res
        .status(401)
        .json(ResponseHelper.error("Invalid token", "INVALID_TOKEN"));
      return;
    }

    res
      .status(401)
      .json(
        ResponseHelper.error("Authentication failed", "AUTHENTICATION_ERROR")
      );
  }
};

/**
 * Authorization middleware factory - checks user roles
 */
export const authorize = (...allowedRoles: AdminRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res
        .status(401)
        .json(ResponseHelper.error("Authentication required", "UNAUTHORIZED"));
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json(
        ResponseHelper.error("Insufficient permissions", "FORBIDDEN", {
          required: allowedRoles,
          current: req.user.role,
        })
      );
      return;
    }

    next();
  };
};

/**
 * Role-specific middleware helpers
 */
export const requireSuperAdmin = authorize(AdminRole.SUPER_ADMIN);
export const requireAdmin = authorize(AdminRole.SUPER_ADMIN, AdminRole.ADMIN);
export const requireStaff = authorize(
  AdminRole.SUPER_ADMIN,
  AdminRole.ADMIN,
  AdminRole.STAFF
);

/**
 * Optional authentication middleware - doesn't fail if no token
 */
export const optionalAuthenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = extractTokenFromHeader(req.headers.authorization);

    if (!token) {
      return next();
    }

    const decoded = verifyAccessToken(token);
    const user = await AdminUser.findOne({
      where: { id: decoded.userId },
      attributes: ["id", "email", "role", "isActive"],
    });

    if (user && user.isActive) {
      req.user = {
        userId: user.id,
        email: user.email,
        role: user.role,
        username: decoded.username,
      };
    }

    next();
  } catch (error) {
    // Ignore authentication errors for optional auth
    next();
  }
};

/**
 * Rate limiting middleware for authentication endpoints
 */
const MAX_LOGIN_ATTEMPTS = parseInt(process.env.RATE_LIMIT_MAX_ATTEMPTS || "5");
const BLOCK_DURATION = parseInt(
  process.env.RATE_LIMIT_BLOCK_DURATION_MS || "900000"
); // 15 minutes default
const AUTH_RATE_LIMIT_STORE =
  process.env.AUTH_RATE_LIMIT_STORE ||
  (process.env.NODE_ENV === "production" ? "redis" : "memory");

let rateLimitRedisClient: ReturnType<typeof createClient> | undefined;
if (AUTH_RATE_LIMIT_STORE === "redis") {
  if (!process.env.REDIS_URL) {
    throw new Error(
      "AUTH_RATE_LIMIT_STORE=redis requires REDIS_URL to be configured"
    );
  }

  rateLimitRedisClient = createClient({
    url: process.env.REDIS_URL,
  });

  rateLimitRedisClient.on("error", (error) => {
    console.error("Redis rate limit client error:", error);
  });

  rateLimitRedisClient.connect().catch((error) => {
    console.error("Failed to connect Redis rate limit client:", error);
  });
} else if (
  process.env.NODE_ENV === "production" &&
  process.env.ALLOW_IN_MEMORY_RATE_LIMIT !== "true"
) {
  throw new Error(
    "In production, set AUTH_RATE_LIMIT_STORE=redis (or explicitly set ALLOW_IN_MEMORY_RATE_LIMIT=true)"
  );
}

const createRateLimitStore = (prefix: string): RedisStore | undefined => {
  if (!rateLimitRedisClient) return undefined;
  return new RedisStore({
    sendCommand: (...args: string[]) => rateLimitRedisClient!.sendCommand(args),
    prefix,
  });
};

export const rateLimitAuth = rateLimit({
  windowMs: BLOCK_DURATION,
  max: MAX_LOGIN_ATTEMPTS,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  passOnStoreError: true,
  store: createRateLimitStore("auth_rate_limit:"),
  keyGenerator: (req: Request): string =>
    req.ip || req.socket.remoteAddress || "unknown",
  handler: (_req, res) => {
    return res
      .status(429)
      .json(
        ResponseHelper.error(
          "Too many login attempts. Please try again later.",
          "RATE_LIMIT_EXCEEDED",
          { retryAfter: Math.ceil(BLOCK_DURATION / 1000) }
        )
      );
  },
});

/**
 * Rate limiting for public form submission endpoints (consultations, etc.)
 * More permissive than auth rate limit but still prevents abuse
 */
export const rateLimitPublicSubmit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 submissions per 15 minutes per IP
  standardHeaders: "draft-8",
  legacyHeaders: false,
  passOnStoreError: true,
  store: createRateLimitStore("public_submit_rate_limit:"),
  keyGenerator: (req: Request): string =>
    req.ip || req.socket.remoteAddress || "unknown",
  handler: (_req, res) => {
    return res
      .status(429)
      .json(
        ResponseHelper.error(
          "Too many requests. Please try again later.",
          "RATE_LIMIT_EXCEEDED",
          { retryAfter: 900 }
        )
      );
  },
});

/**
 * Rate limiting for public analytics tracking endpoints
 * Higher limit since these are fired on user interactions
 */
export const rateLimitAnalytics = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute per IP
  standardHeaders: "draft-8",
  legacyHeaders: false,
  passOnStoreError: true,
  store: createRateLimitStore("analytics_rate_limit:"),
  keyGenerator: (req: Request): string =>
    req.ip || req.socket.remoteAddress || "unknown",
  handler: (_req, res) => {
    return res
      .status(429)
      .json(
        ResponseHelper.error(
          "Too many requests. Please try again later.",
          "RATE_LIMIT_EXCEEDED",
          { retryAfter: 60 }
        )
      );
  },
});

/**
 * Admin session middleware - tracks admin activity
 */
export const trackAdminActivity = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (req.user) {
    // Update last activity timestamp (could be stored in cache for performance)
    try {
      await AdminUser.update(
        { lastLoginAt: new Date() },
        { where: { id: req.user.userId } }
      );
    } catch (error) {
      console.error("Failed to update admin activity:", error);
      // Don't fail the request for this
    }
  }
  next();
};

/**
 * Smart authentication middleware - tries refresh token if access token missing
 */
export const authenticateWithAutoRefresh = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Try normal authentication first
    const token = extractTokenFromHeader(req.headers.authorization);

    if (token) {
      try {
        const decoded = verifyAccessToken(token);
        const user = await AdminUser.findOne({
          where: { id: decoded.userId },
          attributes: ["id", "email", "role", "isActive"],
        });

        if (user && user.isActive) {
          req.user = {
            userId: user.id,
            email: user.email,
            role: user.role,
            username: decoded.username,
          };
          return next();
        }
      } catch (error) {
        // Access token invalid, continue to refresh token logic
        // Fall back to refresh token flow
      }
    }

    // No valid access token, try refresh token
    const refreshToken = req.cookies.admin_refresh_token;

    if (!refreshToken) {
      return res
        .status(401)
        .json(
          ResponseHelper.error(
            "Authentication required - no valid tokens",
            "NO_VALID_TOKENS"
          )
        );
    }

    try {
      const refreshPayload = verifyRefreshToken(refreshToken);
      const user = await AdminUser.findOne({
        where: { id: refreshPayload.userId },
        attributes: ["id", "email", "role", "isActive", "username"],
      });

      if (!user || !user.isActive) {
        return res
          .status(401)
          .json(
            ResponseHelper.error("Invalid user account", "INVALID_USER_ACCOUNT")
          );
      }

      // Set user for current request
      req.user = {
        userId: user.id,
        email: user.email,
        role: user.role,
        username: user.username,
      };

      // Add header to indicate client should refresh access token silently
      res.setHeader("X-Token-Refresh-Needed", "true");
      res.setHeader("X-Refresh-Type", "silent");

      next();
    } catch (refreshError) {
      console.error("Refresh token verification failed");
      return res
        .status(401)
        .json(
          ResponseHelper.error(
            "Refresh token invalid or expired",
            "INVALID_REFRESH_TOKEN"
          )
        );
    }
  } catch (error) {
    console.error("Authentication middleware error:", error);
    return res
      .status(500)
      .json(
        ResponseHelper.error("Authentication error", "AUTHENTICATION_ERROR")
      );
  }
};

/**
 * Admin authentication middleware - alias for authenticate + admin role check
 */
export const authenticateAdmin = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  authenticate(req, res, () => {
    if (!req.user) {
      res
        .status(401)
        .json(ResponseHelper.error("Authentication required", "UNAUTHORIZED"));
      return;
    }

    // Allow all admin roles (SUPER_ADMIN, ADMIN, STAFF)
    if (
      ![AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.STAFF].includes(
        req.user.role
      )
    ) {
      res
        .status(403)
        .json(ResponseHelper.error("Admin access required", "FORBIDDEN"));
      return;
    }

    next();
  });
};
