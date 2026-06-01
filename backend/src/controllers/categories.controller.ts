import { logger } from "@/utils/logger";
import { Request, Response } from "express";
import { ResponseHelper } from "../types/api";
import { ServiceError } from "../utils/service-error";
import { z } from "zod";
import * as categoryService from "../services/category.service";

// ── Validation schemas ────────────────────────────────────────────────────────

const createCategorySchema = z.object({
  name: z.string().min(1, "Category name is required").max(200, "Name too long"),
  slug: z.string().optional(),
  description: z.string().optional(),
  parentId: z.string().uuid().optional(),
});

const updateCategorySchema = createCategorySchema.partial();

const querySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().min(1)).optional(),
  limit: z.string().transform(Number).pipe(z.number().min(-1).max(100)).optional(),
  search: z.string().optional(),
  isActive: z.string().transform((val) => val === "true").optional(),
  parentId: z.string().uuid().optional(),
  level: z.string().transform(Number).pipe(z.number().min(0).max(3)).optional(),
  sortBy: z.enum(["name", "createdAt", "updatedAt"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
  includeChildren: z.string().transform((val) => val === "true").optional(),
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

export const getCategories = async (req: Request, res: Response) => {
  const validation = querySchema.safeParse(req.query);
  if (!validation.success) {
    return res.status(400).json(ResponseHelper.error("Invalid query parameters", "VALIDATION_ERROR", validation.error.issues));
  }
  try {
    const result = await categoryService.findCategories(validation.data);
    return res.status(200).json(ResponseHelper.paginated(result.items, result.pagination));
  } catch (err) {
    return handleError(res, err, "get categories");
  }
};

export const getCategoryTree = async (req: Request, res: Response) => {
  try {
    const activeOnly = req.query.activeOnly !== "false";
    const tree = await categoryService.buildCategoryTree(activeOnly);
    return res.status(200).json(ResponseHelper.success(tree));
  } catch (err) {
    return handleError(res, err, "get category tree");
  }
};

export const getCategoryById = async (req: Request, res: Response) => {
  try {
    const category = await categoryService.findCategoryById(req.params.id);
    return res.status(200).json(ResponseHelper.success(category));
  } catch (err) {
    return handleError(res, err, "get category");
  }
};

export const createCategory = async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json(ResponseHelper.error("Authentication required", "UNAUTHORIZED"));
  }
  const validation = createCategorySchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json(ResponseHelper.error("Validation failed", "VALIDATION_ERROR", validation.error.issues));
  }
  try {
    const category = await categoryService.createCategory(validation.data, req.user.userId);
    return res.status(201).json(ResponseHelper.success(category));
  } catch (err) {
    return handleError(res, err, "create category");
  }
};

export const updateCategory = async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json(ResponseHelper.error("Authentication required", "UNAUTHORIZED"));
  }
  const validation = updateCategorySchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json(ResponseHelper.error("Validation failed", "VALIDATION_ERROR", validation.error.issues));
  }
  try {
    const category = await categoryService.updateCategory(req.params.id, validation.data);
    return res.status(200).json(ResponseHelper.success(category));
  } catch (err) {
    return handleError(res, err, "update category");
  }
};

export const toggleCategoryStatus = async (req: Request, res: Response) => {
  try {
    const category = await categoryService.toggleCategoryStatus(req.params.id);
    return res.status(200).json(ResponseHelper.success(category));
  } catch (err) {
    return handleError(res, err, "toggle category status");
  }
};

export const deleteCategory = async (req: Request, res: Response) => {
  try {
    await categoryService.deleteCategory(req.params.id);
    return res.status(200).json(ResponseHelper.success(null, { message: "Category deleted successfully" }));
  } catch (err) {
    return handleError(res, err, "delete category");
  }
};

export const searchCategories = async (req: Request, res: Response) => {
  try {
    const { q = "", active = "true", parentId } = req.query;
    const categories = await categoryService.searchCategories(
      q as string,
      active === "true",
      parentId as string | undefined
    );
    return res.status(200).json(ResponseHelper.success(categories));
  } catch (err) {
    return handleError(res, err, "search categories");
  }
};

// ── Public controllers ────────────────────────────────────────────────────────

const publicQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().min(1)).optional(),
  limit: z.string().transform(Number).pipe(z.number().min(1).max(100)).optional(),
  search: z.string().optional(),
  parentId: z.string().uuid().optional(),
  sortBy: z.enum(["name", "createdAt", "updatedAt"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
});

export const getPublicCategories = async (req: Request, res: Response) => {
  const validation = publicQuerySchema.safeParse(req.query);
  if (!validation.success) {
    return res.status(400).json(ResponseHelper.error("Invalid query parameters", "INVALID_QUERY", validation.error.issues));
  }
  try {
    const result = await categoryService.findPublicCategories(validation.data);
    return res.status(200).json(ResponseHelper.paginated(result.items, result.pagination));
  } catch (err) {
    return handleError(res, err, "get public categories");
  }
};

export const getPublicCategoryTree = async (req: Request, res: Response) => {
  try {
    const tree = await categoryService.findPublicCategoryTree();
    return res.status(200).json(ResponseHelper.success(tree));
  } catch (err) {
    return handleError(res, err, "get public category tree");
  }
};

export const getPublicCategoryById = async (req: Request, res: Response) => {
  try {
    const category = await categoryService.findPublicCategoryByIdOrSlug(req.params.id);
    return res.status(200).json(ResponseHelper.success(category));
  } catch (err) {
    return handleError(res, err, "get public category");
  }
};
