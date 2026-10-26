import { logger } from "@/utils/logger";
import { Request, Response } from "express";
import { z } from "zod";
import { ResponseHelper } from "../types/api";
import { ServiceError } from "../utils/service-error";
import * as roleService from "../services/admin-role.service";

const roleSchema = z.object({
  name: z.string().trim().min(2, "Tên vai trò tối thiểu 2 ký tự").max(100),
  description: z.string().trim().max(255).optional().nullable(),
  permissions: z.array(z.string().min(1).max(60)).max(200),
});

function handleError(res: Response, err: unknown, label: string) {
  if (err instanceof ServiceError) {
    return res.status(err.statusCode).json(ResponseHelper.error(err.message, err.code));
  }
  logger.error(`${label}:`, err);
  return res.status(500).json(ResponseHelper.error(`Failed to ${label}`, label.toUpperCase().replace(/ /g, "_") + "_ERROR"));
}

export const listRoles = async (req: Request, res: Response) => {
  try {
    const roles = await roleService.listRoles(typeof req.query.search === "string" ? req.query.search : undefined);
    return res.status(200).json(ResponseHelper.success({ items: roles }));
  } catch (err) {
    return handleError(res, err, "list roles");
  }
};

export const getPermissionCatalog = (_req: Request, res: Response) => {
  return res.status(200).json(ResponseHelper.success(roleService.getPermissionCatalog()));
};

export const createRole = async (req: Request, res: Response) => {
  const validation = roleSchema.safeParse(req.body);
  if (!validation.success) return res.status(400).json(ResponseHelper.error("Validation failed", "VALIDATION_ERROR", validation.error.issues));
  try {
    return res.status(201).json(ResponseHelper.success(await roleService.createRole(validation.data)));
  } catch (err) {
    return handleError(res, err, "create role");
  }
};

export const updateRole = async (req: Request, res: Response) => {
  const validation = roleSchema.safeParse(req.body);
  if (!validation.success) return res.status(400).json(ResponseHelper.error("Validation failed", "VALIDATION_ERROR", validation.error.issues));
  try {
    return res.status(200).json(ResponseHelper.success(await roleService.updateRole(req.params.id, validation.data)));
  } catch (err) {
    return handleError(res, err, "update role");
  }
};

export const deleteRole = async (req: Request, res: Response) => {
  try {
    await roleService.deleteRole(req.params.id);
    return res.status(200).json(ResponseHelper.success({ message: "Role deleted" }));
  } catch (err) {
    return handleError(res, err, "delete role");
  }
};
