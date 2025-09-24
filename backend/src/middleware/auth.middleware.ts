/**
 * Authentication and authorization middleware
 */
import { Request, Response, NextFunction } from "express";
import { PrismaClient, AdminRole } from "../generated/prisma";
import {
  verifyAccessToken,
  verifyRefreshToken,
  extractTokenFromHeader,
} from "../utils/jwt";
import { ResponseHelper } from "../types/api";

const prisma = new PrismaClient();

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

/**
 * Authentication middleware - verifies JWT token
 */
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    console.log("Auth middleware - Request headers:", req.headers);

    // Extract token from Authorization header
    const token = extractTokenFromHeader(req.headers.authorization);
    console.log(
      "Auth middleware - Extracted token:",
      token ? `${token.substring(0, 20)}...` : "null"
    );

    if (!token) {
      console.warn("Auth middleware - No token found in request");
      res
        .status(401)
        .json(ResponseHelper.error("Authentication required", "UNAUTHORIZED"));
      return;
    }

    // Verify token
    const decoded = verifyAccessToken(token);
    console.log("Auth middleware - Decoded token:", decoded);

    // Check if user exists and is active
    const user = await prisma.adminUser.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      res
        .status(401)
        .json(ResponseHelper.error("Invalid or inactive user", "UNAUTHORIZED"));
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
    const user = await prisma.adminUser.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
      },
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
interface LoginAttempt {
  count: number;
  lastAttempt: Date;
  blocked: boolean;
}

const loginAttempts = new Map<string, LoginAttempt>();
const MAX_LOGIN_ATTEMPTS = 5;
const BLOCK_DURATION = 15 * 60 * 1000; // 15 minutes

export const rateLimitAuth = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const clientId = req.ip || req.socket.remoteAddress || "unknown";
  const now = new Date();

  const attempt = loginAttempts.get(clientId);

  if (attempt) {
    // Check if block period has expired
    if (
      attempt.blocked &&
      now.getTime() - attempt.lastAttempt.getTime() > BLOCK_DURATION
    ) {
      attempt.blocked = false;
      attempt.count = 0;
    }

    if (attempt.blocked) {
      const timeRemaining =
        BLOCK_DURATION - (now.getTime() - attempt.lastAttempt.getTime());
      res
        .status(429)
        .json(
          ResponseHelper.error(
            "Too many login attempts. Please try again later.",
            "RATE_LIMIT_EXCEEDED",
            { retryAfter: Math.ceil(timeRemaining / 1000) }
          )
        );
      return;
    }
  }

  // Add middleware to track failed attempts
  const originalJson = res.json;
  res.json = function (body) {
    if (body && !body.success && body.error?.code === "INVALID_CREDENTIALS") {
      const currentAttempt = loginAttempts.get(clientId) || {
        count: 0,
        lastAttempt: now,
        blocked: false,
      };
      currentAttempt.count++;
      currentAttempt.lastAttempt = now;

      if (currentAttempt.count >= MAX_LOGIN_ATTEMPTS) {
        currentAttempt.blocked = true;
      }

      loginAttempts.set(clientId, currentAttempt);
    } else if (body && body.success) {
      // Reset on successful login
      loginAttempts.delete(clientId);
    }

    return originalJson.call(this, body);
  };

  next();
};

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
      await prisma.adminUser.update({
        where: { id: req.user.userId },
        data: { lastLoginAt: new Date() },
      });
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
        const user = await prisma.adminUser.findUnique({
          where: { id: decoded.userId },
          select: { id: true, email: true, role: true, isActive: true },
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
        console.log("Access token invalid, trying refresh token...");
      }
    }

    // No valid access token, try refresh token
    const refreshToken = req.cookies.admin_refresh_token;

    if (!refreshToken) {
      return res
        .status(401)
        .json(ResponseHelper.error("Authentication required", "UNAUTHORIZED"));
    }

    try {
      const refreshPayload = verifyRefreshToken(refreshToken);
      const user = await prisma.adminUser.findUnique({
        where: { id: refreshPayload.userId },
        select: {
          id: true,
          email: true,
          role: true,
          isActive: true,
          username: true,
        },
      });

      if (!user || !user.isActive) {
        return res
          .status(401)
          .json(ResponseHelper.error("Invalid user account", "UNAUTHORIZED"));
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
      return res
        .status(401)
        .json(ResponseHelper.error("Authentication failed", "UNAUTHORIZED"));
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
