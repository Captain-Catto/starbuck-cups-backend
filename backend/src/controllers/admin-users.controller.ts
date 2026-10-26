import { logger } from "@/utils/logger";
import { Request, Response } from "express";
import { z } from "zod";
import { ResponseHelper } from "../types/api";
import { ServiceError } from "../utils/service-error";
import * as adminUserService from "../services/admin-user.service";

const createSchema = z.object({
  username: z.string().trim().min(3, "Tên đăng nhập tối thiểu 3 ký tự").max(50).regex(/^[A-Za-z0-9._-]+$/, "Tên đăng nhập chỉ gồm chữ, số, dấu chấm, gạch dưới và gạch ngang"),
  email: z.string().trim().email("Email không hợp lệ").max(255),
  roleId: z.string().uuid("Vai trò không hợp lệ"),
  password: z.string().min(1, "Mật khẩu là bắt buộc").max(128),
});

const updateSchema = z.object({
  username: z.string().trim().min(3).max(50).regex(/^[A-Za-z0-9._-]+$/).optional(),
  email: z.string().trim().email().max(255).optional(),
  roleId: z.string().uuid().optional(),
  isActive: z.boolean().optional(),
});

const resetPasswordSchema = z.object({
  password: z.string().min(1, "Mật khẩu là bắt buộc").max(128),
});

function handleError(res: Response, err: unknown, label: string) {
  if (err instanceof ServiceError) {
    return res.status(err.statusCode).json(ResponseHelper.error(err.message, err.code));
  }
  logger.error(`${label}:`, err);
  return res.status(500).json(ResponseHelper.error(`Failed to ${label}`, label.toUpperCase().replace(/ /g, "_") + "_ERROR"));
}

function invalid(res: Response, error: z.ZodError) {
  return res.status(400).json(ResponseHelper.error("Validation failed", "VALIDATION_ERROR", error.issues));
}

export const listAdminUsers = async (req: Request, res: Response) => {
  try {
    const result = await adminUserService.listAdminUsers(req.query);
    return res.status(200).json(ResponseHelper.paginated(result.items, result.pagination));
  } catch (err) {
    return handleError(res, err, "list admin users");
  }
};

export const createAdminUser = async (req: Request, res: Response) => {
  const validation = createSchema.safeParse(req.body);
  if (!validation.success) return invalid(res, validation.error);
  try {
    const user = await adminUserService.createAdminUser(validation.data);
    return res.status(201).json(ResponseHelper.success(user));
  } catch (err) {
    return handleError(res, err, "create admin user");
  }
};

export const updateAdminUser = async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json(ResponseHelper.error("Authentication required", "UNAUTHORIZED"));
  const validation = updateSchema.safeParse(req.body);
  if (!validation.success) return invalid(res, validation.error);
  try {
    const user = await adminUserService.updateAdminUser(req.user.userId, req.params.id, validation.data);
    return res.status(200).json(ResponseHelper.success(user));
  } catch (err) {
    return handleError(res, err, "update admin user");
  }
};

export const resetAdminUserPassword = async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json(ResponseHelper.error("Authentication required", "UNAUTHORIZED"));
  const validation = resetPasswordSchema.safeParse(req.body);
  if (!validation.success) return invalid(res, validation.error);
  try {
    await adminUserService.resetAdminUserPassword(req.user.userId, req.params.id, validation.data.password);
    return res.status(200).json(ResponseHelper.success({ message: "Password reset successfully" }));
  } catch (err) {
    return handleError(res, err, "reset admin user password");
  }
};
