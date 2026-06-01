import { logger } from "@/utils/logger";
import { Request, Response } from "express";
import { ResponseHelper } from "../types/api";
import { ServiceError } from "../utils/service-error";
import { z } from "zod";
import * as authService from "../services/auth.service";
import { AuthRequest } from "../middleware/auth.middleware";

// ── Validation schemas ────────────────────────────────────────────────────────

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

// ── Error handler helper ──────────────────────────────────────────────────────

function handleError(res: Response, err: unknown, label: string) {
  if (err instanceof ServiceError) {
    return res.status(err.statusCode).json(ResponseHelper.error(err.message, err.code));
  }
  logger.error(`${label}:`, err);
  return res.status(500).json(ResponseHelper.error("Internal server error", "INTERNAL_ERROR"));
}

// ── Cookie helpers ────────────────────────────────────────────────────────────

function setRefreshCookie(res: Response, token: string) {
  res.cookie("admin_refresh_token", token, authService.COOKIE_OPTIONS);
}

function clearRefreshCookie(res: Response) {
  res.clearCookie("admin_refresh_token", {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === "true",
    sameSite: (process.env.COOKIE_SAME_SITE as "strict" | "lax" | "none") || "lax",
    path: "/",
    domain: process.env.COOKIE_DOMAIN || undefined,
  });
}

// ── Controllers ───────────────────────────────────────────────────────────────

export const adminLogin = async (req: Request, res: Response) => {
  const validation = loginSchema.safeParse(req.body);
  if (!validation.success) return res.status(400).json(ResponseHelper.error("Validation failed", "VALIDATION_ERROR", validation.error.issues));
  try {
    const result = await authService.adminLogin(validation.data.email, validation.data.password);
    setRefreshCookie(res, result.refreshToken);
    const responseData: Record<string, unknown> = { user: result.user, token: result.token, message: "Admin login successful" };
    if (authService.EXPOSE_REFRESH_TOKEN()) responseData.refreshToken = result.refreshToken;
    return res.status(200).json(ResponseHelper.success(responseData));
  } catch (err) {
    return handleError(res, err, "admin login");
  }
};

export const login = async (req: Request, res: Response) => {
  const validation = loginSchema.safeParse(req.body);
  if (!validation.success) return res.status(400).json(ResponseHelper.error("Validation failed", "VALIDATION_ERROR", validation.error.issues));
  try {
    const result = await authService.login(validation.data.email, validation.data.password);
    setRefreshCookie(res, result.refreshToken);
    const responseData: Record<string, unknown> = { user: result.user, accessToken: result.accessToken };
    if (authService.EXPOSE_REFRESH_TOKEN()) responseData.refreshToken = result.refreshToken;
    return res.status(200).json(ResponseHelper.success(responseData));
  } catch (err) {
    return handleError(res, err, "login");
  }
};

export const refreshToken = async (req: Request, res: Response) => {
  const validation = refreshTokenSchema.safeParse(req.body);
  if (!validation.success) return res.status(400).json(ResponseHelper.error("Validation failed", "VALIDATION_ERROR", validation.error.issues));
  try {
    const result = await authService.refreshAccessToken(validation.data.refreshToken);
    return res.status(200).json(ResponseHelper.success(result));
  } catch (err) {
    if (err instanceof ServiceError) {
      return res.status(err.statusCode).json(ResponseHelper.error(err.message, err.code));
    }
    logger.error("Refresh token error:", err);
    return res.status(401).json(ResponseHelper.error("Invalid refresh token", "INVALID_REFRESH_TOKEN"));
  }
};

export const logout = async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json(ResponseHelper.error("Authentication required", "UNAUTHORIZED"));
  try {
    await authService.logoutUser(req.user.userId);
    clearRefreshCookie(res);
    return res.status(200).json(ResponseHelper.success(null, { message: "Logged out successfully" }));
  } catch (err) {
    return handleError(res, err, "logout");
  }
};

export const changePassword = async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json(ResponseHelper.error("Authentication required", "UNAUTHORIZED"));
  const validation = changePasswordSchema.safeParse(req.body);
  if (!validation.success) return res.status(400).json(ResponseHelper.error("Validation failed", "VALIDATION_ERROR", validation.error.issues));
  try {
    await authService.changePassword(req.user.userId, validation.data.currentPassword, validation.data.newPassword);
    return res.status(200).json(ResponseHelper.success(null, { message: "Password changed successfully" }));
  } catch (err) {
    return handleError(res, err, "change password");
  }
};

export const verifyToken = async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json(ResponseHelper.error("Authentication required", "UNAUTHORIZED"));
  try {
    const user = await authService.getUserById(req.user.userId);
    return res.status(200).json(ResponseHelper.success({ user: { id: user.id, email: user.email, name: user.username, role: user.role }, message: "Token is valid" }));
  } catch (err) {
    return handleError(res, err, "verify token");
  }
};

export const getProfile = async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json(ResponseHelper.error("Authentication required", "UNAUTHORIZED"));
  try {
    const user = await authService.getUserById(req.user.userId, ["id", "email", "username", "role", "lastLoginAt", "createdAt"]);
    return res.status(200).json(ResponseHelper.success(user));
  } catch (err) {
    return handleError(res, err, "get profile");
  }
};

export const adminVerifyToken = async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json(ResponseHelper.error("Authentication required", "UNAUTHORIZED"));
  try {
    const user = await authService.getAdminUserById(req.user.userId);
    return res.status(200).json(ResponseHelper.success({ user: { id: user.id, email: user.email, name: user.username, role: user.role } }));
  } catch (err) {
    return handleError(res, err, "admin verify token");
  }
};

export const adminRefreshToken = async (req: Request, res: Response) => {
  const token = req.body.refreshToken || req.cookies?.admin_refresh_token;
  if (!token) return res.status(400).json(ResponseHelper.error("Refresh token is required", "MISSING_REFRESH_TOKEN"));
  try {
    const result = await authService.adminRefreshToken(token);
    setRefreshCookie(res, result.refreshToken);
    const responseData: Record<string, unknown> = { token: result.token, user: result.user };
    if (authService.EXPOSE_REFRESH_TOKEN()) responseData.refreshToken = result.refreshToken;
    return res.status(200).json(ResponseHelper.success(responseData));
  } catch (err) {
    return handleError(res, err, "admin refresh token");
  }
};

export const adminLogout = async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json(ResponseHelper.error("Authentication required", "UNAUTHORIZED"));
  try {
    await authService.logoutUser(req.user.userId);
    clearRefreshCookie(res);
    return res.status(200).json(ResponseHelper.success({ message: "Admin logged out successfully" }));
  } catch (err) {
    return handleError(res, err, "admin logout");
  }
};

export const adminSessionCheck = async (req: Request, res: Response) => {
  const token = req.cookies?.admin_refresh_token;
  if (!token) return res.status(401).json(ResponseHelper.error("No session found", "NO_SESSION"));
  try {
    const result = await authService.checkAdminSession(token);
    setRefreshCookie(res, result.newRefreshToken);
    return res.status(200).json(ResponseHelper.success({ user: result.user, token: result.token, message: "Session restored successfully" }));
  } catch (err) {
    if (err instanceof ServiceError) {
      return res.status(err.statusCode).json(ResponseHelper.error(err.message, err.code));
    }
    logger.error("Admin session check error:", err);
    return res.status(401).json(ResponseHelper.error("Invalid session", "INVALID_SESSION"));
  }
};
