import { logger } from "@/utils/logger";
import { Request, Response } from "express";
import { ResponseHelper } from "../types/api";
import { ServiceError } from "../utils/service-error";
import { z } from "zod";
import * as productService from "../services/product.service";

// ── Validation schemas ────────────────────────────────────────────────────────

const translationEntrySchema = z.object({
  // Empty name is allowed: for en/zh it means "remove this translation".
  name: z.string().max(255).optional(),
  description: z.string().optional(),
  metaTitle: z.string().max(300).optional(),
  metaDescription: z.string().optional(),
}).optional();

const translationsSchema = z.object({
  vi: translationEntrySchema,
  en: translationEntrySchema,
  zh: translationEntrySchema,
}).optional();

const createProductSchema = z.object({
  name: z.string().min(1, "Product name is required").max(255),
  slug: z.string().optional(),
  description: z.string().optional(),
  capacityId: z.string().uuid().optional().nullable().or(z.literal("")).transform((v) => v === "" ? null : v),
  stockQuantity: z.coerce.number().int().nonnegative("Stock quantity must be non-negative"),
  unitPrice: z.coerce.number().nonnegative().optional().default(0),
  productUrl: z.string().url().optional().or(z.literal("")),
  isVip: z.boolean().optional().default(false),
  isFeatured: z.boolean().optional().default(false),
  isPinned: z.boolean().optional(),
  categoryIds: z.array(z.string().uuid()).min(1, "At least one category is required"),
  colorIds: z.array(z.string().uuid()).optional().default([]),
  productImages: z.array(z.object({ url: z.string().url(), order: z.number().int().nonnegative() })).optional().default([]),
  translations: translationsSchema,
});

const updateProductSchema = createProductSchema.partial().extend({ isActive: z.boolean().optional() });

const updateStockSchema = z.object({
  stockQuantity: z.coerce.number().int().nonnegative("Stock quantity must be non-negative"),
});

const reorderImagesSchema = z.object({
  imageOrders: z.array(z.object({ id: z.string().uuid(), order: z.coerce.number().int().nonnegative() })),
});

// ── Error handler helper ──────────────────────────────────────────────────────

function handleError(res: Response, err: unknown, label: string) {
  if (err instanceof ServiceError) {
    return res.status(err.statusCode).json(ResponseHelper.error(err.message, err.code));
  }
  const msg = err instanceof Error ? err.message : "";
  if (msg.includes("not found") || msg.includes("inactive")) {
    return res.status(400).json(ResponseHelper.error(msg, "VALIDATION_ERROR"));
  }
  logger.error(`${label}:`, err);
  return res.status(500).json(ResponseHelper.error(`Failed to ${label}`, label.toUpperCase().replace(/ /g, "_") + "_ERROR"));
}

// ── Multipart body parser for updateProductWithFiles ─────────────────────────

function parseMultipartBody(body: Record<string, unknown>) {
  const parseJson = <T>(v: unknown, fallback: T): T => {
    if (v === undefined || v === null || v === "") return fallback;
    if (typeof v !== "string") return v as T;
    try { return JSON.parse(v) as T; } catch { return fallback; }
  };

  const parsed = { ...body };
  if ("categoryIds" in parsed) parsed.categoryIds = parseJson<string[]>(parsed.categoryIds, []);
  if ("colorIds" in parsed) parsed.colorIds = parseJson<string[]>(parsed.colorIds, []);
  if ("productImages" in parsed) parsed.productImages = parseJson<Array<{ url: string; order: number }>>(parsed.productImages, []);
  if ("translations" in parsed) parsed.translations = parseJson<Record<string, unknown>>(parsed.translations, {});
  if (parsed.stockQuantity !== undefined) parsed.stockQuantity = Number(parsed.stockQuantity);
  if (parsed.unitPrice !== undefined) parsed.unitPrice = Number(parsed.unitPrice);
  for (const boolField of ["isActive", "isVip", "isFeatured", "isPinned"]) {
    if (parsed[boolField] !== undefined) parsed[boolField] = parsed[boolField] === "true" || parsed[boolField] === true;
  }
  return parsed;
}

// ── Controllers ───────────────────────────────────────────────────────────────

export const getProducts = async (req: Request, res: Response) => {
  try {
    const result = await productService.findProducts(req.query);
    return res.status(200).json(ResponseHelper.paginated(result.items, result.pagination));
  } catch (err) {
    return handleError(res, err, "get products");
  }
};

export const getProductById = async (req: Request, res: Response) => {
  try {
    const product = await productService.findProductById(req.params.id, req.query.locale as string);
    return res.status(200).json(ResponseHelper.success(product));
  } catch (err) {
    return handleError(res, err, "get product");
  }
};

export const createProduct = async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json(ResponseHelper.error("Authentication required", "UNAUTHORIZED"));
  const validation = createProductSchema.safeParse(req.body);
  if (!validation.success) return res.status(400).json(ResponseHelper.error("Validation failed", "VALIDATION_ERROR", validation.error.issues));
  try {
    const product = await productService.createProduct(validation.data, req.user.userId);
    return res.status(201).json(ResponseHelper.success(product));
  } catch (err) {
    return handleError(res, err, "create product");
  }
};

export const updateProductWithFiles = async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json(ResponseHelper.error("Authentication required", "UNAUTHORIZED"));
  const parsedBody = parseMultipartBody(req.body as Record<string, unknown>);
  const validation = updateProductSchema.safeParse(parsedBody);
  if (!validation.success) return res.status(400).json(ResponseHelper.error("Validation failed", "VALIDATION_ERROR", validation.error.issues));
  try {
    const files = (req.files as Express.Multer.File[]) || [];
    const product = await productService.updateProductWithFiles(req.params.id, { ...validation.data, keepExistingImages: parsedBody.keepExistingImages as boolean | undefined }, files);
    return res.status(200).json(ResponseHelper.success(product));
  } catch (err) {
    return handleError(res, err, "update product");
  }
};

export const updateProduct = async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json(ResponseHelper.error("Authentication required", "UNAUTHORIZED"));
  const validation = updateProductSchema.safeParse(req.body);
  if (!validation.success) return res.status(400).json(ResponseHelper.error("Validation failed", "VALIDATION_ERROR", validation.error.issues));
  try {
    const product = await productService.updateProduct(req.params.id, validation.data);
    return res.status(200).json(ResponseHelper.success(product));
  } catch (err) {
    return handleError(res, err, "update product");
  }
};

export const deleteProduct = async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json(ResponseHelper.error("Authentication required", "UNAUTHORIZED"));
  try {
    await productService.deleteProduct(req.params.id, req.user.userId);
    return res.status(200).json(ResponseHelper.success({ message: "Product deleted successfully" }));
  } catch (err) {
    return handleError(res, err, "delete product");
  }
};

export const reactivateProduct = async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json(ResponseHelper.error("Authentication required", "UNAUTHORIZED"));
  try {
    const product = await productService.reactivateProduct(req.params.id);
    return res.status(200).json(ResponseHelper.success({ message: "Product reactivated successfully", product }));
  } catch (err) {
    return handleError(res, err, "reactivate product");
  }
};

export const updateProductStock = async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json(ResponseHelper.error("Authentication required", "UNAUTHORIZED"));
  const validation = updateStockSchema.safeParse(req.body);
  if (!validation.success) return res.status(400).json(ResponseHelper.error("Validation failed", "VALIDATION_ERROR", validation.error.issues));
  try {
    const result = await productService.updateStock(req.params.id, validation.data.stockQuantity);
    return res.status(200).json(ResponseHelper.success(result));
  } catch (err) {
    return handleError(res, err, "update product stock");
  }
};

export const toggleProductStatus = async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json(ResponseHelper.error("Authentication required", "UNAUTHORIZED"));
  try {
    const result = await productService.toggleProductStatus(req.params.id);
    return res.status(200).json(ResponseHelper.success(result));
  } catch (err) {
    return handleError(res, err, "toggle product status");
  }
};

export const searchProducts = async (req: Request, res: Response) => {
  try {
    const result = await productService.searchProducts(req.query);
    return res.status(200).json(ResponseHelper.paginated(result.items, result.pagination));
  } catch (err) {
    return handleError(res, err, "search products");
  }
};

export const getLowStockProducts = async (req: Request, res: Response) => {
  try {
    const result = await productService.findLowStockProducts(req.query);
    return res.status(200).json(ResponseHelper.paginated(result.items, result.pagination));
  } catch (err) {
    return handleError(res, err, "get low stock products");
  }
};

export const getPublicProducts = async (req: Request, res: Response) => {
  try {
    const result = await productService.findPublicProducts(req.query);
    return res.status(200).json(ResponseHelper.paginated(result.items, result.pagination));
  } catch (err) {
    return handleError(res, err, "get public products");
  }
};

export const getPublicProductById = async (req: Request, res: Response) => {
  try {
    const product = await productService.findPublicProductByIdOrSlug(req.params.id, req.query.locale as string);
    return res.status(200).json(ResponseHelper.success(product));
  } catch (err) {
    return handleError(res, err, "get public product");
  }
};

export const getFeaturedProductsStats = async (req: Request, res: Response) => {
  try {
    const stats = await productService.getFeaturedStats();
    return res.status(200).json(ResponseHelper.success(stats));
  } catch (err) {
    return handleError(res, err, "get featured products stats");
  }
};

export const reorderProductImages = async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json(ResponseHelper.error("Authentication required", "UNAUTHORIZED"));
  const validation = reorderImagesSchema.safeParse(req.body);
  if (!validation.success) return res.status(400).json(ResponseHelper.error("Validation failed", "VALIDATION_ERROR", validation.error.issues));
  try {
    const product = await productService.reorderImages(req.params.id, validation.data.imageOrders);
    return res.status(200).json(ResponseHelper.success({ message: "Product images reordered successfully", product }));
  } catch (err) {
    return handleError(res, err, "reorder product images");
  }
};

export const pinProduct = async (req: Request, res: Response) => {
  try {
    return res.status(200).json(ResponseHelper.success(await productService.pinProduct(req.params.id)));
  } catch (err) {
    return handleError(res, err, "pin product");
  }
};

export const unpinProduct = async (req: Request, res: Response) => {
  try {
    return res.status(200).json(ResponseHelper.success(await productService.unpinProduct(req.params.id)));
  } catch (err) {
    return handleError(res, err, "unpin product");
  }
};

export const getPinnedProductsCount = async (_req: Request, res: Response) => {
  try {
    return res.status(200).json(ResponseHelper.success(await productService.getPinnedCount()));
  } catch (err) {
    return handleError(res, err, "get pinned products count");
  }
};
