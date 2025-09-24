import { Request, Response } from "express";
import { PrismaClient } from "../generated/prisma";
import {
  hashPassword,
  comparePassword,
  validatePassword,
} from "../utils/password";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from "../utils/jwt";
import { ResponseHelper } from "../types/api";
import { z } from "zod";

const prisma = new PrismaClient();

// Validation schemas
const loginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
});

const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required"),
});

/**
 * Login admin user (specific endpoint for admin panel)
 */
export const adminLogin = async (req: Request, res: Response) => {
  try {
    // Validate input
    const validationResult = loginSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res
        .status(400)
        .json(
          ResponseHelper.error(
            "Validation failed",
            "VALIDATION_ERROR",
            validationResult.error.issues
          )
        );
    }

    const { email, password } = validationResult.data;

    // Find admin user by email
    const user = await prisma.adminUser.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      return res
        .status(401)
        .json(
          ResponseHelper.error(
            "Invalid email or password",
            "INVALID_CREDENTIALS"
          )
        );
    }

    // Check if user is active
    if (!user.isActive) {
      return res
        .status(401)
        .json(
          ResponseHelper.error("Account is deactivated", "ACCOUNT_DEACTIVATED")
        );
    }

    // Check if user has admin privileges
    if (!["SUPER_ADMIN", "ADMIN", "STAFF"].includes(user.role)) {
      return res
        .status(403)
        .json(
          ResponseHelper.error(
            "Access denied. Admin privileges required.",
            "ACCESS_DENIED"
          )
        );
    }

    // Verify password
    const isPasswordValid = await comparePassword(password, user.passwordHash);

    if (!isPasswordValid) {
      return res
        .status(401)
        .json(
          ResponseHelper.error(
            "Invalid email or password",
            "INVALID_CREDENTIALS"
          )
        );
    }

    // Update last login
    await prisma.adminUser.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Generate tokens
    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      username: user.username,
    });

    const refreshToken = generateRefreshToken({
      userId: user.id,
      tokenVersion: 1,
    });

    // Set refresh token as HTTP-only cookie
    res.cookie("admin_refresh_token", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: "/",
    });

    return res.status(200).json(
      ResponseHelper.success({
        user: {
          id: user.id,
          email: user.email,
          name: user.username,
          role: user.role,
        },
        token: accessToken,
        refreshToken: refreshToken,
        message: "Admin login successful",
      })
    );
  } catch (error) {
    console.error("Admin login error:", error);
    return res
      .status(500)
      .json(ResponseHelper.error("Internal server error", "INTERNAL_ERROR"));
  }
};

/**
 * Login admin user (general endpoint)
 */
export const login = async (req: Request, res: Response) => {
  try {
    // Validate input
    const validationResult = loginSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res
        .status(400)
        .json(
          ResponseHelper.error(
            "Validation failed",
            "VALIDATION_ERROR",
            validationResult.error.issues
          )
        );
    }

    const { email, password } = validationResult.data;

    // Find user by email
    const user = await prisma.adminUser.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      return res
        .status(401)
        .json(
          ResponseHelper.error(
            "Invalid email or password",
            "INVALID_CREDENTIALS"
          )
        );
    }

    // Check if user is active
    if (!user.isActive) {
      return res
        .status(401)
        .json(
          ResponseHelper.error("Account is deactivated", "ACCOUNT_DEACTIVATED")
        );
    }

    // Verify password
    const isPasswordValid = await comparePassword(password, user.passwordHash);
    if (!isPasswordValid) {
      return res
        .status(401)
        .json(
          ResponseHelper.error(
            "Invalid email or password",
            "INVALID_CREDENTIALS"
          )
        );
    }

    // Update last login
    await prisma.adminUser.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Generate tokens
    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      username: user.username,
    });

    const refreshToken = generateRefreshToken({
      userId: user.id,
      tokenVersion: 1, // Default version, could be stored in database if needed
    });

    // Set refresh token as HTTP-only cookie
    res.cookie("admin_refresh_token", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: "/",
    });

    return res.status(200).json(
      ResponseHelper.success({
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          role: user.role,
        },
        accessToken,
        refreshToken
      })
    );
  } catch (error) {
    console.error("Login error:", error);
    return res
      .status(500)
      .json(ResponseHelper.error("Login failed", "LOGIN_ERROR"));
  }
};

/**
 * Refresh access token
 */
export const refreshToken = async (req: Request, res: Response) => {
  try {
    // Validate input
    const validationResult = refreshTokenSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res
        .status(400)
        .json(
          ResponseHelper.error(
            "Validation failed",
            "VALIDATION_ERROR",
            validationResult.error.issues
          )
        );
    }

    const { refreshToken: token } = validationResult.data;

    // Verify refresh token
    const decoded = verifyRefreshToken(token);

    // Find user and verify token version
    const user = await prisma.adminUser.findUnique({
      where: { id: decoded.userId },
    });

    if (!user || !user.isActive) {
      return res
        .status(401)
        .json(
          ResponseHelper.error("Invalid refresh token", "INVALID_REFRESH_TOKEN")
        );
    }

    // Generate new access token
    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      username: user.username,
    });

    return res.status(200).json(ResponseHelper.success({ accessToken }));
  } catch (error) {
    console.error("Refresh token error:", error);
    return res
      .status(401)
      .json(
        ResponseHelper.error("Invalid refresh token", "INVALID_REFRESH_TOKEN")
      );
  }
};

/**
 * Logout user (invalidate all tokens)
 */
export const logout = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res
        .status(401)
        .json(ResponseHelper.error("Authentication required", "UNAUTHORIZED"));
    }

    // For logout, we could implement a token blacklist or just rely on short-lived access tokens
    // No need to increment token version if not using it

    return res
      .status(200)
      .json(
        ResponseHelper.success(null, { message: "Logged out successfully" })
      );
  } catch (error) {
    console.error("Logout error:", error);
    return res
      .status(500)
      .json(ResponseHelper.error("Logout failed", "LOGOUT_ERROR"));
  }
};

/**
 * Change password
 */
export const changePassword = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res
        .status(401)
        .json(ResponseHelper.error("Authentication required", "UNAUTHORIZED"));
    }

    // Validate input
    const validationResult = changePasswordSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res
        .status(400)
        .json(
          ResponseHelper.error(
            "Validation failed",
            "VALIDATION_ERROR",
            validationResult.error.issues
          )
        );
    }

    const { currentPassword, newPassword } = validationResult.data;

    // Validate new password strength
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
      return res
        .status(400)
        .json(
          ResponseHelper.error(
            "Password does not meet requirements",
            "WEAK_PASSWORD",
            passwordValidation.errors
          )
        );
    }

    // Find user
    const user = await prisma.adminUser.findUnique({
      where: { id: req.user.userId },
    });

    if (!user) {
      return res
        .status(404)
        .json(ResponseHelper.error("User not found", "USER_NOT_FOUND"));
    }

    // Verify current password
    const isCurrentPasswordValid = await comparePassword(
      currentPassword,
      user.passwordHash
    );
    if (!isCurrentPasswordValid) {
      return res
        .status(400)
        .json(
          ResponseHelper.error(
            "Current password is incorrect",
            "INCORRECT_PASSWORD"
          )
        );
    }

    // Hash new password
    const hashedNewPassword = await hashPassword(newPassword);

    // Update password
    await prisma.adminUser.update({
      where: { id: user.id },
      data: {
        passwordHash: hashedNewPassword,
        updatedAt: new Date(),
      },
    });

    return res.status(200).json(
      ResponseHelper.success(null, {
        message: "Password changed successfully",
      })
    );
  } catch (error) {
    console.error("Change password error:", error);
    return res
      .status(500)
      .json(
        ResponseHelper.error(
          "Failed to change password",
          "CHANGE_PASSWORD_ERROR"
        )
      );
  }
};

/**
 * Verify token and get user info
 */
export const verifyToken = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res
        .status(401)
        .json(ResponseHelper.error("Authentication required", "UNAUTHORIZED"));
    }

    const user = await prisma.adminUser.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res
        .status(404)
        .json(ResponseHelper.error("User not found", "USER_NOT_FOUND"));
    }

    if (!user.isActive) {
      return res
        .status(401)
        .json(
          ResponseHelper.error("Account is deactivated", "ACCOUNT_DEACTIVATED")
        );
    }

    return res.status(200).json(
      ResponseHelper.success({
        user: {
          id: user.id,
          email: user.email,
          name: user.username,
          role: user.role,
        },
        message: "Token is valid",
      })
    );
  } catch (error) {
    console.error("Verify token error:", error);
    return res
      .status(500)
      .json(
        ResponseHelper.error(
          "Token verification failed",
          "TOKEN_VERIFICATION_ERROR"
        )
      );
  }
};

/**
 * Get current user profile
 */
export const getProfile = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res
        .status(401)
        .json(ResponseHelper.error("Authentication required", "UNAUTHORIZED"));
    }

    const user = await prisma.adminUser.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res
        .status(404)
        .json(ResponseHelper.error("User not found", "USER_NOT_FOUND"));
    }

    return res.status(200).json(ResponseHelper.success(user));
  } catch (error) {
    console.error("Get profile error:", error);
    return res
      .status(500)
      .json(ResponseHelper.error("Failed to get profile", "GET_PROFILE_ERROR"));
  }
};

/**
 * Admin-specific token verification
 */
export const adminVerifyToken = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res
        .status(401)
        .json(ResponseHelper.error("Authentication required", "UNAUTHORIZED"));
    }

    // Ensure this is an admin user
    const adminUser = await prisma.adminUser.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        isActive: true,
      },
    });

    if (!adminUser) {
      return res
        .status(404)
        .json(ResponseHelper.error("Admin user not found", "ADMIN_NOT_FOUND"));
    }

    if (!adminUser.isActive) {
      return res
        .status(403)
        .json(
          ResponseHelper.error(
            "Admin account is deactivated",
            "ACCOUNT_DEACTIVATED"
          )
        );
    }

    return res.status(200).json(
      ResponseHelper.success({
        user: {
          id: adminUser.id,
          email: adminUser.email,
          name: adminUser.username,
          role: adminUser.role,
        },
      })
    );
  } catch (error) {
    console.error("Admin verify token error:", error);
    return res
      .status(500)
      .json(
        ResponseHelper.error("Token verification failed", "VERIFY_TOKEN_ERROR")
      );
  }
};

/**
 * Admin-specific token refresh
 */
export const adminRefreshToken = async (req: Request, res: Response) => {
  try {
    // Try to get refresh token from body first, then from cookie
    let refreshToken = req.body.refreshToken;

    if (!refreshToken) {
      refreshToken = req.cookies.admin_refresh_token;
    }

    if (!refreshToken) {
      return res
        .status(400)
        .json(
          ResponseHelper.error(
            "Refresh token is required",
            "MISSING_REFRESH_TOKEN"
          )
        );
    }

    console.log("Admin refresh token attempt:", {
      tokenPresent: !!refreshToken,
      tokenLength: refreshToken?.length,
      tokenStart: refreshToken?.substring(0, 20) + "...",
      source: req.body.refreshToken ? "body" : "cookie",
    });

    // Verify refresh token
    const payload = verifyRefreshToken(refreshToken);
    if (!payload) {
      return res
        .status(401)
        .json(
          ResponseHelper.error("Invalid refresh token", "INVALID_REFRESH_TOKEN")
        );
    }

    // Check if admin user exists and is active
    const adminUser = await prisma.adminUser.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        isActive: true,
      },
    });

    if (!adminUser) {
      return res
        .status(404)
        .json(ResponseHelper.error("Admin user not found", "ADMIN_NOT_FOUND"));
    }

    if (!adminUser.isActive) {
      return res
        .status(403)
        .json(
          ResponseHelper.error(
            "Admin account is deactivated",
            "ACCOUNT_DEACTIVATED"
          )
        );
    }

    // Generate new tokens
    const accessToken = generateAccessToken({
      userId: adminUser.id,
      email: adminUser.email,
      role: adminUser.role,
      username: adminUser.username,
    });

    const newRefreshToken = generateRefreshToken({
      userId: adminUser.id,
      tokenVersion: 0, // You can implement token versioning if needed
    });

    // Set new refresh token as HTTP-only cookie
    res.cookie("admin_refresh_token", newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: "/",
    });

    return res.status(200).json(
      ResponseHelper.success({
        token: accessToken,
        refreshToken: newRefreshToken,
        user: {
          id: adminUser.id,
          email: adminUser.email,
          name: adminUser.username,
          role: adminUser.role,
        },
      })
    );
  } catch (error) {
    console.error("Admin refresh token error:", error);
    return res
      .status(500)
      .json(
        ResponseHelper.error("Failed to refresh token", "REFRESH_TOKEN_ERROR")
      );
  }
};

/**
 * Admin-specific logout
 */
export const adminLogout = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res
        .status(401)
        .json(ResponseHelper.error("Authentication required", "UNAUTHORIZED"));
    }

    // In a more complex implementation, you could:
    // 1. Invalidate the refresh token in database
    // 2. Add token to blacklist
    // 3. Log the logout activity

    // Clear refresh token cookie
    res.clearCookie("admin_refresh_token", { path: "/" });

    return res
      .status(200)
      .json(
        ResponseHelper.success({ message: "Admin logged out successfully" })
      );
  } catch (error) {
    console.error("Admin logout error:", error);
    return res
      .status(500)
      .json(ResponseHelper.error("Failed to logout", "LOGOUT_ERROR"));
  }
};

/**
 * Check admin session using refresh token from cookie
 */
export const adminSessionCheck = async (req: Request, res: Response) => {
  try {
    console.log("Admin session check request:", {
      hasCookies: !!req.cookies,
      cookies: req.cookies,
      headers: req.headers.cookie,
    });

    const refreshToken = req.cookies?.admin_refresh_token;

    if (!refreshToken) {
      return res
        .status(401)
        .json(ResponseHelper.error("No session found", "NO_SESSION"));
    }

    try {
      const payload = verifyRefreshToken(refreshToken);
      const user = await prisma.adminUser.findUnique({
        where: { id: payload.userId },
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
          .json(ResponseHelper.error("Invalid session", "INVALID_SESSION"));
      }

      // Generate new access token
      const accessToken = generateAccessToken({
        userId: user.id,
        email: user.email,
        role: user.role,
        username: user.username,
      });

      // Generate new refresh token and update cookie
      const newRefreshToken = generateRefreshToken({
        userId: user.id,
        tokenVersion: 0,
      });

      // Set new refresh token as HTTP-only cookie
      res.cookie("admin_refresh_token", newRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: "/",
      });

      return res.status(200).json(
        ResponseHelper.success({
          user: {
            id: user.id,
            email: user.email,
            name: user.username,
            role: user.role,
          },
          token: accessToken,
          message: "Session restored successfully",
        })
      );
    } catch (refreshError) {
      return res
        .status(401)
        .json(ResponseHelper.error("Invalid session", "INVALID_SESSION"));
    }
  } catch (error) {
    console.error("Admin session check error:", error);
    return res
      .status(500)
      .json(
        ResponseHelper.error("Session check failed", "SESSION_CHECK_ERROR")
      );
  }
};
