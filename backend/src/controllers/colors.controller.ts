import { logger } from "@/utils/logger";
import { Request, Response } from "express";
import { ResponseHelper } from "../types/api";
import { ServiceError } from "../utils/service-error";
import { z } from "zod";
import * as colorService from "../services/color.service";

// ── Validation schemas ────────────────────────────────────────────────────────

const createColorSchema = z.object({
  name: z.string().min(1, "Color name is required").max(100, "Name too long"),
  slug: z.string().optional(),
  hexCode: z
    .string()
    .transform((val) => {
      let hex = val.trim().toUpperCase();
      if (!hex.startsWith("#")) hex = "#" + hex;
      const digits = hex.slice(1);
      const padded = digits.padEnd(6, "0").slice(0, 6);
      return "#" + padded;
    })
    .pipe(z.string().regex(/^#[0-9A-F]{6}$/i, "Invalid hex color code format")),
});

const updateColorSchema = createColorSchema.partial();

const querySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(-1).max(100).default(20),
  search: z.string().optional(),
  isActive: z.enum(["true", "false", "all"]).default("all"),
  sortBy: z.enum(["name", "createdAt", "updatedAt"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

const publicQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().min(1)).optional(),
  limit: z.string().transform(Number).pipe(z.number().min(-1).max(100)).optional(),
  search: z.string().optional(),
  sortBy: z.enum(["name", "createdAt"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
});

// ── Error handler helper ──────────────────────────────────────────────────────

function handleError(res: Response, err: unknown, label: string) {
  if (err instanceof ServiceError) {
    return res.status(err.statusCode).json(ResponseHelper.error(err.message, err.code));
  }
  logger.error(`${label}:`, err);
  return res.status(500).json(ResponseHelper.error(`Failed to ${label}`, label.toUpperCase().replace(/ /g, "_") + "_ERROR"));
}

// ── Admin controllers ─────────────────────────────────────────────────────────

export const getColors = async (req: Request, res: Response) => {
  const q = querySchema.parse(req.query);
  try {
    const result = await colorService.findColors(q);
    return res.status(200).json(ResponseHelper.paginated(result.items, result.pagination));
  } catch (err) {
    return handleError(res, err, "get colors");
  }
};

export const getColorsForAdmin = async (req: Request, res: Response) => {
  const q = querySchema.parse(req.query);
  try {
    const result = await colorService.findColorsForAdmin(q);
    return res.status(200).json(ResponseHelper.paginated(result.items, result.pagination));
  } catch (err) {
    return handleError(res, err, "get colors for admin");
  }
};

export const getColorById = async (req: Request, res: Response) => {
  try {
    const color = await colorService.findColorById(req.params.id);
    return res.status(200).json(ResponseHelper.success(color));
  } catch (err) {
    return handleError(res, err, "get color");
  }
};

export const createColor = async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json(ResponseHelper.error("Authentication required", "UNAUTHORIZED"));
  const validation = createColorSchema.safeParse(req.body);
  if (!validation.success) return res.status(400).json(ResponseHelper.error("Validation failed", "VALIDATION_ERROR", validation.error.issues));
  try {
    const color = await colorService.createColor(validation.data, req.user.userId);
    return res.status(201).json(ResponseHelper.success(color));
  } catch (err) {
    return handleError(res, err, "create color");
  }
};

export const updateColor = async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json(ResponseHelper.error("Authentication required", "UNAUTHORIZED"));
  const validation = updateColorSchema.safeParse(req.body);
  if (!validation.success) return res.status(400).json(ResponseHelper.error("Validation failed", "VALIDATION_ERROR", validation.error.issues));
  try {
    const color = await colorService.updateColor(req.params.id, validation.data);
    return res.status(200).json(ResponseHelper.success(color));
  } catch (err) {
    return handleError(res, err, "update color");
  }
};

export const deleteColor = async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json(ResponseHelper.error("Authentication required", "UNAUTHORIZED"));
  try {
    await colorService.deleteColor(req.params.id);
    return res.status(200).json(ResponseHelper.success({ message: "Color deleted successfully" }));
  } catch (err) {
    return handleError(res, err, "delete color");
  }
};

export const toggleColorStatus = async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json(ResponseHelper.error("Authentication required", "UNAUTHORIZED"));
  try {
    const color = await colorService.toggleColorStatus(req.params.id);
    return res.status(200).json(ResponseHelper.success(color));
  } catch (err) {
    return handleError(res, err, "toggle color status");
  }
};

export const getActiveColors = async (req: Request, res: Response) => {
  try {
    const colors = await colorService.findActiveColors();
    return res.status(200).json(ResponseHelper.success(colors));
  } catch (err) {
    return handleError(res, err, "get active colors");
  }
};

export const searchColors = async (req: Request, res: Response) => {
  try {
    const { q = "", active = "true" } = req.query;
    const colors = await colorService.searchColors(q as string, active === "true");
    return res.status(200).json(ResponseHelper.success(colors));
  } catch (err) {
    return handleError(res, err, "search colors");
  }
};

// ── Public controllers ────────────────────────────────────────────────────────

export const getPublicColorById = async (req: Request, res: Response) => {
  try {
    const color = await colorService.findPublicColorByIdOrSlug(req.params.id);
    return res.status(200).json(ResponseHelper.success(color));
  } catch (err) {
    return handleError(res, err, "get public color");
  }
};

export const getPublicColors = async (req: Request, res: Response) => {
  const validation = publicQuerySchema.safeParse(req.query);
  if (!validation.success) return res.status(400).json(ResponseHelper.error("Invalid query parameters", "INVALID_QUERY", validation.error.issues));
  try {
    const result = await colorService.findPublicColors(validation.data);
    return res.status(200).json(ResponseHelper.paginated(result.items, result.pagination));
  } catch (err) {
    return handleError(res, err, "get public colors");
  }
};
