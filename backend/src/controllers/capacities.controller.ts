import { logger } from "@/utils/logger";
import { Request, Response } from "express";
import { ResponseHelper } from "../types/api";
import { ServiceError } from "../utils/service-error";
import { z } from "zod";
import * as capacityService from "../services/capacity.service";

// ── Validation schemas ────────────────────────────────────────────────────────

const createCapacitySchema = z.object({
  name: z.string().min(1, "Capacity name is required").max(100, "Name too long"),
  slug: z.string().optional(),
  volumeMl: z.number().int().positive("Volume must be positive"),
});

const updateCapacitySchema = createCapacitySchema.partial();

const querySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().min(1)).optional(),
  limit: z.string().transform(Number).pipe(z.number().min(-1).max(100)).optional(),
  search: z.string().optional(),
  isActive: z.string().transform((val) => val === "true").optional(),
  sortBy: z.enum(["name", "volumeMl", "createdAt", "updatedAt"]).optional(),
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

export const getCapacities = async (req: Request, res: Response) => {
  const validation = querySchema.safeParse(req.query);
  if (!validation.success) return res.status(400).json(ResponseHelper.error("Invalid query parameters", "VALIDATION_ERROR", validation.error.issues));
  try {
    const result = await capacityService.findCapacities(validation.data);
    return res.status(200).json(ResponseHelper.paginated(result.items, result.pagination));
  } catch (err) {
    return handleError(res, err, "get capacities");
  }
};

export const getCapacitiesForAdmin = async (req: Request, res: Response) => {
  const validation = querySchema.safeParse(req.query);
  if (!validation.success) return res.status(400).json(ResponseHelper.error("Invalid query parameters", "VALIDATION_ERROR", validation.error.issues));
  try {
    const result = await capacityService.findCapacitiesForAdmin(validation.data);
    return res.status(200).json(ResponseHelper.paginated(result.items, result.pagination));
  } catch (err) {
    return handleError(res, err, "get capacities for admin");
  }
};

export const getCapacityById = async (req: Request, res: Response) => {
  try {
    const capacity = await capacityService.findCapacityById(req.params.id);
    return res.status(200).json(ResponseHelper.success(capacity));
  } catch (err) {
    return handleError(res, err, "get capacity");
  }
};

export const createCapacity = async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json(ResponseHelper.error("Authentication required", "UNAUTHORIZED"));
  const validation = createCapacitySchema.safeParse(req.body);
  if (!validation.success) return res.status(400).json(ResponseHelper.error("Validation failed", "VALIDATION_ERROR", validation.error.issues));
  try {
    const capacity = await capacityService.createCapacity(validation.data, req.user.userId);
    return res.status(201).json(ResponseHelper.success(capacity));
  } catch (err) {
    return handleError(res, err, "create capacity");
  }
};

export const updateCapacity = async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json(ResponseHelper.error("Authentication required", "UNAUTHORIZED"));
  const validation = updateCapacitySchema.safeParse(req.body);
  if (!validation.success) return res.status(400).json(ResponseHelper.error("Validation failed", "VALIDATION_ERROR", validation.error.issues));
  try {
    const capacity = await capacityService.updateCapacity(req.params.id, validation.data);
    return res.status(200).json(ResponseHelper.success(capacity));
  } catch (err) {
    return handleError(res, err, "update capacity");
  }
};

export const toggleCapacityStatus = async (req: Request, res: Response) => {
  try {
    const capacity = await capacityService.toggleCapacityStatus(req.params.id);
    return res.status(200).json(ResponseHelper.success(capacity));
  } catch (err) {
    return handleError(res, err, "toggle capacity status");
  }
};

export const deleteCapacity = async (req: Request, res: Response) => {
  try {
    await capacityService.deleteCapacity(req.params.id);
    return res.status(200).json(ResponseHelper.success(null, { message: "Capacity deleted successfully" }));
  } catch (err) {
    return handleError(res, err, "delete capacity");
  }
};

export const searchCapacities = async (req: Request, res: Response) => {
  try {
    const { q = "", active = "true" } = req.query;
    const capacities = await capacityService.searchCapacities(q as string, active === "true");
    return res.status(200).json(ResponseHelper.success(capacities));
  } catch (err) {
    return handleError(res, err, "search capacities");
  }
};

// ── Public controllers ────────────────────────────────────────────────────────

export const getPublicCapacityById = async (req: Request, res: Response) => {
  try {
    const capacity = await capacityService.findPublicCapacityByIdOrSlug(req.params.id);
    return res.status(200).json(ResponseHelper.success(capacity));
  } catch (err) {
    return handleError(res, err, "get public capacity");
  }
};

export const getPublicCapacities = async (req: Request, res: Response) => {
  const validation = querySchema.safeParse(req.query);
  if (!validation.success) return res.status(400).json(ResponseHelper.error("Invalid query parameters", "INVALID_QUERY", validation.error.issues));
  try {
    const result = await capacityService.findPublicCapacities(validation.data);
    return res.status(200).json(ResponseHelper.paginated(result.items, result.pagination));
  } catch (err) {
    return handleError(res, err, "get public capacities");
  }
};
