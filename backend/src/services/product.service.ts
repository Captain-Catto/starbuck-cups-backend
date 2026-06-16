import { logger } from "@/utils/logger";
import { Op, col, where as sequelizeWhere, Order, WhereOptions, Includeable, IncludeOptions, Transaction } from "sequelize";
import { sequelize } from "../config/database";
import {
  Product,
  ProductTranslation,
  ProductCategory,
  ProductColor,
  ProductImage,
  Category,
  Color,
  Capacity,
} from "../models";
import { googleDriveService } from "./google-drive.service";
import { processImage } from "./image-processing.service";
import { getProductImageProcessingOptions } from "./watermark-settings.service";
import { generateVietnameseSlug } from "../utils/vietnamese-slug";
import { clearCachePrefix } from "../middleware/redis-cache.middleware";
import { ServiceError } from "../utils/service-error";

// ── Types ─────────────────────────────────────────────────────────────────────

export const SUPPORTED_LOCALES = ["vi", "en", "zh"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
export type TranslationPayload = {
  name?: string;
  description?: string;
  metaTitle?: string;
  metaDescription?: string;
};

export interface ProductFilters {
  page?: string;
  limit?: string;
  search?: string;
  isActive?: string;
  isDeleted?: string;
  isFeatured?: string;
  categorySlug?: string;
  colorSlug?: string;
  minCapacity?: string;
  maxCapacity?: string;
  locale?: string;
  sortBy?: string;
  sortOrder?: string;
  lowStock?: string;
  lowStockThreshold?: string;
}

export interface SearchFilters {
  q?: string;
  page?: string;
  limit?: string;
  categorySlug?: string;
  colorSlug?: string;
  capacitySlug?: string;
  isActive?: string;
}

export interface LowStockFilters {
  threshold?: string;
  page?: string;
  limit?: string;
}

export interface PublicProductFilters {
  page?: string;
  limit?: string;
  search?: string;
  category?: string;
  categorySlug?: string;
  color?: string;
  colorSlug?: string;
  capacity?: string;
  capacitySlug?: string;
  minCapacity?: string;
  maxCapacity?: string;
  isFeatured?: string;
  locale?: string;
  sortBy?: string;
  sortOrder?: string;
}

export interface ProductUpdateData {
  name?: string;
  slug?: string;
  description?: string;
  capacityId?: string | null;
  stockQuantity?: number;
  unitPrice?: number;
  productUrl?: string;
  isVip?: boolean;
  isFeatured?: boolean;
  isActive?: boolean;
  categoryIds?: string[];
  colorIds?: string[];
  productImages?: Array<{ url: string; order: number }>;
  translations?: unknown;
}

export interface ProductUpdateWithFilesData extends ProductUpdateData {
  keepExistingImages?: boolean;
}

const ADMIN_SORT_FIELDS = new Set(["name", "stockQuantity", "createdAt", "updatedAt", "isFeatured"]);
const PUBLIC_SORT_FIELDS = new Set(["name", "createdAt", "isFeatured"]);

// ── Shared include config ─────────────────────────────────────────────────────

// Top-level order clause to sort product images by their `order` field
const IMAGE_ORDER: Order = [[{ model: ProductImage, as: "productImages" }, "order", "ASC"]];

const FULL_PRODUCT_INCLUDE: Includeable[] = [
  { model: Capacity, as: "capacity", attributes: ["id", "name", "slug", "volumeMl"] },
  {
    model: ProductCategory,
    as: "productCategories",
    include: [{ model: Category, as: "category", attributes: ["id", "name", "slug"] }],
  },
  {
    model: ProductColor,
    as: "productColors",
    include: [{ model: Color, as: "color", attributes: ["id", "name", "slug", "hexCode"] }],
  },
  {
    model: ProductImage,
    as: "productImages",
    attributes: ["id", "url", "altText", "order"],
  },
  {
    model: ProductTranslation,
    as: "translations",
    attributes: ["locale", "name", "description", "metaTitle", "metaDescription"],
    required: false,
  },
];

// ── Locale helpers ────────────────────────────────────────────────────────────

export const normalizeLocale = (rawLocale?: string): SupportedLocale => {
  if (!rawLocale) return "vi";
  const n = rawLocale.trim().toLowerCase();
  if (n.startsWith("en")) return "en";
  if (n.startsWith("zh")) return "zh";
  return "vi";
};

const getSearchableLocales = (locale: SupportedLocale): SupportedLocale[] =>
  locale === "vi" ? ["vi"] : [locale, "vi"];

interface RawTranslation {
  locale: string;
  name?: string;
  description?: string;
  metaTitle?: string;
  metaDescription?: string;
}

const toTranslationMap = (translations: unknown = []) => {
  const arr: RawTranslation[] = Array.isArray(translations)
    ? (translations as RawTranslation[])
    : Object.values((translations as Record<string, RawTranslation>) || {});
  return Object.fromEntries(
    arr.map((t) => [
      t.locale,
      { locale: t.locale, name: t.name, description: t.description || "", metaTitle: t.metaTitle || "", metaDescription: t.metaDescription || "" },
    ])
  ) as Partial<Record<SupportedLocale, { locale: SupportedLocale; name: string; description: string; metaTitle: string; metaDescription: string }>>;
};

export const applyLocaleToProduct = (product: Product, locale: SupportedLocale, includeTranslationsMap = false) => {
  const plain = (typeof product.toJSON === "function" ? product.toJSON() : product) as unknown as Record<string, unknown>;
  const map = toTranslationMap(plain.translations);
  const localized = map[locale] || map.vi;
  const { translations: _t, ...rest } = plain;
  const transformed = {
    ...rest,
    name: localized?.name ?? plain.name,
    description: localized?.description ?? plain.description ?? "",
    metaTitle: localized?.metaTitle ?? map.vi?.metaTitle ?? "",
    metaDescription: localized?.metaDescription ?? map.vi?.metaDescription ?? "",
  };
  return includeTranslationsMap ? { ...transformed, translations: map } : transformed;
};

export const parseTranslationPayload = (translations?: unknown): Partial<Record<SupportedLocale, TranslationPayload>> => {
  if (!translations) return {};
  let parsed: unknown = translations;
  if (typeof parsed === "string") {
    try { parsed = JSON.parse(parsed); } catch { return {}; }
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
  const obj = parsed as Record<string, TranslationPayload>;
  const result: Partial<Record<SupportedLocale, TranslationPayload>> = {};
  for (const locale of SUPPORTED_LOCALES) {
    const v = obj[locale];
    if (!v) continue;
    result[locale] = {
      name: v.name?.trim(),
      description: v.description?.trim(),
      metaTitle: v.metaTitle?.trim(),
      metaDescription: v.metaDescription?.trim(),
    };
  }
  return result;
};

// ── Query helpers ─────────────────────────────────────────────────────────────

const buildLocalizedSearchConditions = (keyword: string, includeSlug = false) => {
  const likeKeyword = `%${keyword}%`;
  const escapedLike = sequelize.escape(likeKeyword);
  const conditions: object[] = [
    sequelizeWhere(
      sequelize.fn("unaccent", col("Product.name")),
      { [Op.iLike]: sequelize.fn("unaccent", likeKeyword) as unknown as string }
    ),
    sequelize.literal(`EXISTS (SELECT 1 FROM product_translations AS "pt_search" WHERE "pt_search"."product_id" = "Product"."id" AND unaccent("pt_search"."name") ILIKE unaccent(${escapedLike}))`),
  ];
  if (includeSlug) conditions.push({ slug: { [Op.iLike]: likeKeyword } });
  return conditions;
};

const normalizeSortField = (raw: unknown, allowed: Set<string>, fallback: string) =>
  typeof raw === "string" && allowed.has(raw) ? raw : fallback;

const normalizeSortOrder = (raw: unknown, fallback: "asc" | "desc" = "desc"): "asc" | "desc" => {
  if (typeof raw !== "string") return fallback;
  const n = raw.toLowerCase();
  return n === "asc" || n === "desc" ? n : fallback;
};

const buildCapacityWhere = (min?: string | number, max?: string | number): WhereOptions => {
  const where: WhereOptions = {};
  if (min && max) (where as Record<string, unknown>)["volumeMl"] = { [Op.between]: [parseInt(String(min)), parseInt(String(max))] };
  else if (min) (where as Record<string, unknown>)["volumeMl"] = { [Op.gte]: parseInt(String(min)) };
  else if (max) (where as Record<string, unknown>)["volumeMl"] = { [Op.lte]: parseInt(String(max)) };
  return where;
};

const buildCountInclude = (categoryWhere: WhereOptions, colorWhere: WhereOptions, capacityWhere: WhereOptions): Includeable[] => [
  { model: Capacity, as: "capacity", where: Object.keys(capacityWhere).length > 0 ? capacityWhere : undefined, required: Object.keys(capacityWhere).length > 0, attributes: [] },
  {
    model: ProductCategory,
    as: "productCategories",
    attributes: [],
    ...(Object.keys(categoryWhere).length > 0 && { required: true, include: [{ model: Category, as: "category", where: categoryWhere, required: true, attributes: [] }] }),
  },
  {
    model: ProductColor,
    as: "productColors",
    attributes: [],
    ...(Object.keys(colorWhere).length > 0 && { required: true, include: [{ model: Color, as: "color", where: colorWhere, required: true, attributes: [] }] }),
  },
];

// ── Cache helpers ─────────────────────────────────────────────────────────────

export async function invalidateProductCaches(slug?: string) {
  try {
    await Promise.all([clearCachePrefix("/api/products"), clearCachePrefix("/api/admin/products")]);
    const frontendUrl = process.env.FRONTEND_URL;
    const secret = process.env.REVALIDATE_SECRET;
    if (frontendUrl && secret) {
      fetch(`${frontendUrl}/api/revalidate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
        body: JSON.stringify(slug ? { slug } : {}),
      }).catch((err) => logger.error("Failed to trigger frontend revalidation:", err));
    }
  } catch (err) {
    logger.error("Failed to invalidate product caches:", err);
  }
}

// ── Translation upsert ────────────────────────────────────────────────────────

async function upsertTranslations(
  productId: string,
  parsedTranslations: Partial<Record<SupportedLocale, TranslationPayload>>,
  finalName: string,
  finalDescription?: string,
  t?: Transaction
) {
  const existing = await ProductTranslation.findAll({ where: { productId }, transaction: t });
  const existingMap = new Map(existing.map((tr) => [tr.locale, tr]));

  const toPersist: Partial<Record<SupportedLocale, TranslationPayload>> = {
    ...parsedTranslations,
    vi: { ...parsedTranslations.vi, name: finalName, description: finalDescription },
  };

  for (const locale of SUPPORTED_LOCALES) {
    const incoming = toPersist[locale];
    if (!incoming) continue;
    const hasData = incoming.name !== undefined || incoming.description !== undefined || incoming.metaTitle !== undefined || incoming.metaDescription !== undefined;
    if (!hasData) continue;

    const current = existingMap.get(locale);
    const nextName = incoming.name?.trim() || current?.name || finalName;
    const nextDescription = incoming.description !== undefined ? incoming.description : current?.description || (locale === "vi" ? finalDescription : undefined);
    const nextMetaTitle = incoming.metaTitle !== undefined ? incoming.metaTitle?.trim() || undefined : current?.metaTitle;
    const nextMetaDescription = incoming.metaDescription !== undefined ? incoming.metaDescription?.trim() || undefined : current?.metaDescription;

    if (current) {
      await current.update({ name: nextName, description: nextDescription, metaTitle: nextMetaTitle, metaDescription: nextMetaDescription }, { transaction: t });
    } else {
      await ProductTranslation.create({ productId, locale, name: nextName, description: nextDescription, metaTitle: nextMetaTitle, metaDescription: nextMetaDescription }, { transaction: t });
    }
  }
}

// ── Service methods ───────────────────────────────────────────────────────────

export async function findProducts(filters: ProductFilters) {
  const {
    page = "1", limit = "20", search = "", isActive = "all", isDeleted = "false",
    isFeatured = "all", categorySlug, colorSlug, minCapacity, maxCapacity,
    locale, sortBy = "createdAt", sortOrder = "desc", lowStock = "false", lowStockThreshold = "1",
  } = filters;

  const requestedLocale = normalizeLocale(locale);
  const sortByNorm = normalizeSortField(sortBy, ADMIN_SORT_FIELDS, "createdAt");
  const sortOrderNorm = normalizeSortOrder(sortOrder, "desc");
  const pageNum = parseInt(page) || 1; const limitNum = parseInt(limit) || 20;
  const offset = (pageNum - 1) * limitNum;

  const where: WhereOptions = {};
  if (isDeleted === "false") (where as Record<string, unknown>)["isDeleted"] = false;
  else if (isDeleted === "true") (where as Record<string, unknown>)["isDeleted"] = true;
  if (isActive !== "all") (where as Record<string, unknown>)["isActive"] = isActive === "true";
  if (isFeatured !== "all") (where as Record<string, unknown>)["isFeatured"] = isFeatured === "true";
  if (search) (where as Record<symbol, unknown>)[Op.or] = buildLocalizedSearchConditions(search, true);
  if (lowStock === "true") (where as Record<string, unknown>)["stockQuantity"] = { [Op.lte]: parseInt(lowStockThreshold) };

  const categoryWhere: WhereOptions = categorySlug ? { slug: categorySlug } : {};
  const colorWhere: WhereOptions = colorSlug ? { slug: colorSlug } : {};
  const capacityWhere = buildCapacityWhere(minCapacity, maxCapacity);
  const countInclude = buildCountInclude(categoryWhere, colorWhere, capacityWhere);

  const orderClauses: Order = [];
  if (isFeatured === "true") orderClauses.push(["isFeatured", "DESC"]);
  if (sortByNorm === "isFeatured") orderClauses.push(["createdAt", "DESC"]);
  else orderClauses.push([sortByNorm, sortOrderNorm.toUpperCase()]);

  const totalCount = await Product.count({ where, include: countInclude, distinct: true, col: "id" });
  const idRows = await Product.findAll({ where, include: countInclude, attributes: ["id"], order: orderClauses, group: ["Product.id"], offset, limit: limitNum, raw: true, subQuery: false });
  const paginatedIds = (idRows as Array<{ id: string }>).map((r) => r.id);

  const productsUnsorted = await Product.findAll({
    where: { id: { [Op.in]: paginatedIds } },
    include: FULL_PRODUCT_INCLUDE,
    order: [[{ model: ProductImage, as: "productImages" }, "order", "ASC"]],
  });

  const productsMap = new Map(productsUnsorted.map((p) => [p.id, p]));
  const products = paginatedIds.map((id) => productsMap.get(id)!).filter(Boolean).map((p) => applyLocaleToProduct(p, requestedLocale, true));

  return {
    items: products,
    pagination: { current_page: pageNum, per_page: limitNum, total_pages: Math.ceil(totalCount / limitNum), total_items: totalCount, has_next: pageNum < Math.ceil(totalCount / limitNum), has_prev: pageNum > 1 },
  };
}

export async function findProductById(id: string, locale?: string) {
  const requestedLocale = normalizeLocale(locale);
  const product = await Product.findByPk(id, {
    include: FULL_PRODUCT_INCLUDE,
    order: [[{ model: ProductImage, as: "productImages" }, "order", "ASC"]],
  });
  if (!product || product.isDeleted) throw new ServiceError(404, "PRODUCT_NOT_FOUND", "Product not found");
  return applyLocaleToProduct(product, requestedLocale, true);
}

export async function createProduct(data: {
  name: string; slug?: string; description?: string; capacityId?: string | null;
  stockQuantity: number; unitPrice?: number; productUrl?: string;
  isVip?: boolean; isFeatured?: boolean; categoryIds: string[];
  colorIds?: string[]; productImages?: Array<{ url: string; order: number }>;
  translations?: unknown;
}, adminId: string) {
  const parsedTranslations = parseTranslationPayload(data.translations);
  const viTranslation = parsedTranslations.vi;
  const canonicalName = viTranslation?.name?.trim() || data.name.trim();
  const canonicalDescription = viTranslation?.description !== undefined ? viTranslation.description : data.description?.trim();
  const imagesToProcess = (data.productImages || []).sort((a, b) => a.order - b.order).map((img) => img.url);

  const result = await sequelize.transaction(async (t) => {
    const [capacity, colors, categories] = await Promise.all([
      data.capacityId ? Capacity.findOne({ where: { id: data.capacityId, isActive: true }, transaction: t }) : null,
      data.colorIds?.length ? Color.findAll({ where: { id: { [Op.in]: data.colorIds }, isActive: true }, transaction: t }) : [],
      Category.findAll({ where: { id: { [Op.in]: data.categoryIds }, isActive: true }, transaction: t }),
    ]);

    if (data.capacityId && !capacity) throw new ServiceError(400, "VALIDATION_ERROR", "Capacity not found or inactive");
    if (data.colorIds && colors.length !== data.colorIds.length) throw new ServiceError(400, "VALIDATION_ERROR", "One or more colors not found or inactive");
    if (categories.length !== data.categoryIds.length) throw new ServiceError(400, "VALIDATION_ERROR", "One or more categories not found or inactive");

    const finalSlug = data.slug?.trim() || generateVietnameseSlug(canonicalName);
    if (!finalSlug) throw new ServiceError(400, "VALIDATION_ERROR", "Cannot generate slug from product name");

    const existing = await Product.findOne({ where: { slug: finalSlug }, transaction: t });
    if (existing) throw new ServiceError(409, "DUPLICATE_SLUG", `Sản phẩm với tên này đã tồn tại (slug: "${finalSlug}"). Vui lòng đổi tên sản phẩm.`);

    const product = await Product.create(
      { name: canonicalName, slug: finalSlug, description: canonicalDescription, capacityId: data.capacityId, stockQuantity: data.stockQuantity, unitPrice: data.unitPrice || 0, productUrl: data.productUrl, isVip: Boolean(data.isVip), isFeatured: Boolean(data.isFeatured), isActive: true, isDeleted: false, createdByAdminId: adminId },
      { transaction: t }
    );

    await Promise.all([
      ProductCategory.bulkCreate(data.categoryIds.map((cid) => ({ productId: product.id, categoryId: cid })), { transaction: t }),
      data.colorIds?.length ? ProductColor.bulkCreate(data.colorIds.map((cid) => ({ productId: product.id, colorId: cid })), { transaction: t }) : null,
      imagesToProcess.length ? ProductImage.bulkCreate(imagesToProcess.map((url, i) => ({ productId: product.id, url, altText: canonicalName, order: i })), { transaction: t }) : null,
    ]);

    await upsertTranslations(product.id, { ...parsedTranslations, vi: { ...parsedTranslations.vi, name: canonicalName, description: canonicalDescription } }, canonicalName, canonicalDescription, t);

    return product;
  });

  const created = await Product.findByPk(result.id, { include: FULL_PRODUCT_INCLUDE, order: IMAGE_ORDER });
  invalidateProductCaches();
  return applyLocaleToProduct(created!, "vi", true);
}

export async function updateProduct(id: string, data: ProductUpdateData) {
  const existing = await Product.findByPk(id);
  if (!existing || existing.isDeleted) throw new ServiceError(404, "PRODUCT_NOT_FOUND", "Product not found");

  const parsedTranslations = parseTranslationPayload(data.translations);
  const { categoryIds, colorIds, productImages, translations: _t, ...baseData } = data;

  const updated = await sequelize.transaction(async (t) => {
    const viTranslation = parsedTranslations.vi;
    const finalName = viTranslation?.name?.trim() || data.name?.trim() || existing.name;
    const finalDescription = viTranslation?.description !== undefined ? viTranslation.description : data.description !== undefined ? data.description.trim() : existing.description;

    let finalSlug = existing.slug;
    const requestedSlug = data.slug?.trim();
    if (requestedSlug || finalName !== existing.name) {
      finalSlug = requestedSlug || generateVietnameseSlug(finalName) || existing.slug;
      const conflict = await Product.findOne({ where: { slug: finalSlug, id: { [Op.ne]: id } }, transaction: t });
      if (conflict) throw new ServiceError(409, "DUPLICATE_SLUG", `Sản phẩm với tên này đã tồn tại (slug: "${finalSlug}"). Vui lòng đổi tên sản phẩm.`);
    }

    await existing.update({ ...baseData, slug: finalSlug, name: finalName, description: finalDescription }, { transaction: t });

    if (categoryIds) {
      const cats = await Category.findAll({ where: { id: { [Op.in]: categoryIds }, isActive: true }, transaction: t });
      if (cats.length !== categoryIds.length) throw new ServiceError(400, "VALIDATION_ERROR", "One or more categories not found or inactive");
      await ProductCategory.destroy({ where: { productId: id }, transaction: t });
      await ProductCategory.bulkCreate(categoryIds.map((cid: string) => ({ productId: id, categoryId: cid })), { transaction: t });
    }

    if (colorIds) {
      const cols = await Color.findAll({ where: { id: { [Op.in]: colorIds }, isActive: true }, transaction: t });
      if (cols.length !== colorIds.length) throw new ServiceError(400, "VALIDATION_ERROR", "One or more colors not found or inactive");
      await ProductColor.destroy({ where: { productId: id }, transaction: t });
      await ProductColor.bulkCreate(colorIds.map((cid: string) => ({ productId: id, colorId: cid })), { transaction: t });
    }

    if (productImages?.length) {
      const sorted = (productImages as Array<{ order: number; url: string }>).sort((a, b) => a.order - b.order).map((img) => img.url);
      await ProductImage.destroy({ where: { productId: id }, transaction: t });
      await ProductImage.bulkCreate(sorted.map((url: string, i: number) => ({ productId: id, url, altText: finalName, order: i })), { transaction: t });
    }

    await upsertTranslations(id, { ...parsedTranslations, vi: { ...parsedTranslations.vi, name: finalName, description: finalDescription } }, finalName, finalDescription, t);

    return Product.findByPk(id, { include: FULL_PRODUCT_INCLUDE, order: IMAGE_ORDER, transaction: t });
  });

  invalidateProductCaches(updated?.slug);
  return applyLocaleToProduct(updated!, "vi", true);
}

export async function updateProductWithFiles(id: string, data: ProductUpdateWithFilesData, files: Express.Multer.File[]) {
  const existing = await Product.findByPk(id);
  if (!existing || existing.isDeleted) throw new ServiceError(404, "PRODUCT_NOT_FOUND", "Product not found");

  const parsedTranslations = parseTranslationPayload(data.translations);
  const { categoryIds, colorIds, productImages, translations: _t, keepExistingImages = true, ...baseData } = data;

  const updated = await sequelize.transaction(async (t) => {
    const viTranslation = parsedTranslations.vi;
    const finalName = viTranslation?.name?.trim() || data.name?.trim() || existing.name;
    const finalDescription = viTranslation?.description !== undefined ? viTranslation.description : data.description !== undefined ? data.description.trim() : existing.description;
    const imagePreset = await getProductImageProcessingOptions();

    if (files?.length) {
      let startingOrder = 0;
      if (keepExistingImages) {
        const maxOrder = await ProductImage.max("order", { where: { productId: id }, transaction: t });
        const parsed = Number(maxOrder);
        startingOrder = Number.isFinite(parsed) ? parsed + 1 : 0;
      } else {
        await ProductImage.destroy({ where: { productId: id }, transaction: t });
      }

      const imageData = await Promise.all(
        files.map(async (file, index) => {
          const processed = await processImage(file.buffer, file.originalname, imagePreset);
          const uploadResult = await googleDriveService.uploadFile(processed.buffer, processed.filename, "products");
          return { productId: id, url: uploadResult.url, altText: `${finalName} - Image ${index + 1}`, order: startingOrder + index };
        })
      );
      await ProductImage.bulkCreate(imageData, { transaction: t });
    }

    if (productImages?.length && (!files?.length)) {
      const sorted = (productImages as Array<{ order: number; url: string }>).sort((a, b) => a.order - b.order).map((img) => img.url);
      await ProductImage.destroy({ where: { productId: id }, transaction: t });
      await ProductImage.bulkCreate(sorted.map((url: string, i: number) => ({ productId: id, url, altText: finalName, order: i })), { transaction: t });
    }

    await existing.update({ ...baseData, name: finalName, description: finalDescription }, { transaction: t });

    if (categoryIds) {
      const cats = await Category.findAll({ where: { id: { [Op.in]: categoryIds }, isActive: true }, transaction: t });
      if (cats.length !== categoryIds.length) throw new ServiceError(400, "VALIDATION_ERROR", "One or more categories not found or inactive");
      await ProductCategory.destroy({ where: { productId: id }, transaction: t });
      await ProductCategory.bulkCreate(categoryIds.map((cid: string) => ({ productId: id, categoryId: cid })), { transaction: t });
    }

    if (colorIds) {
      const cols = await Color.findAll({ where: { id: { [Op.in]: colorIds }, isActive: true }, transaction: t });
      if (cols.length !== colorIds.length) throw new ServiceError(400, "VALIDATION_ERROR", "One or more colors not found or inactive");
      await ProductColor.destroy({ where: { productId: id }, transaction: t });
      await ProductColor.bulkCreate(colorIds.map((cid: string) => ({ productId: id, colorId: cid })), { transaction: t });
    }

    await upsertTranslations(id, { ...parsedTranslations, vi: { ...parsedTranslations.vi, name: finalName, description: finalDescription } }, finalName, finalDescription, t);

    return Product.findByPk(id, { include: FULL_PRODUCT_INCLUDE, order: IMAGE_ORDER, transaction: t });
  });

  invalidateProductCaches(updated?.slug);
  return applyLocaleToProduct(updated!, "vi", true);
}

export async function deleteProduct(id: string, adminId: string) {
  const product = await Product.findByPk(id);
  if (!product || product.isDeleted) throw new ServiceError(404, "PRODUCT_NOT_FOUND", "Product not found");
  await product.update({ isDeleted: true, deletedAt: new Date(), deletedByAdminId: adminId });
  invalidateProductCaches(product.slug);
}

export async function reactivateProduct(id: string) {
  const product = await Product.findByPk(id);
  if (!product) throw new ServiceError(404, "PRODUCT_NOT_FOUND", "Product not found");
  if (!product.isDeleted) throw new ServiceError(400, "PRODUCT_NOT_DELETED", "Product is not deleted");
  await product.update({ isDeleted: false, deletedAt: undefined, deletedByAdminId: undefined, isActive: true });
  invalidateProductCaches(product.slug);
  return product;
}

export async function updateStock(id: string, stockQuantity: number) {
  const product = await Product.findByPk(id);
  if (!product || product.isDeleted) throw new ServiceError(404, "PRODUCT_NOT_FOUND", "Product not found");
  const previousStock = product.stockQuantity;
  await product.update({ stockQuantity });
  invalidateProductCaches(product.slug);
  return { productId: id, stockQuantity, previousStock, message: "Product stock updated successfully" };
}

export async function toggleProductStatus(id: string) {
  const product = await Product.findByPk(id);
  if (!product || product.isDeleted) throw new ServiceError(404, "PRODUCT_NOT_FOUND", "Product not found");
  await product.update({ isActive: !product.isActive });
  invalidateProductCaches(product.slug);
  return { message: `Product ${product.isActive ? "activated" : "deactivated"} successfully`, isActive: product.isActive };
}

export async function searchProducts(filters: SearchFilters) {
  const { q = "", page = "1", limit = "20", categorySlug, colorSlug, capacitySlug, isActive = "true" } = filters;
  const pageNum = parseInt(page) || 1; const limitNum = parseInt(limit) || 20;
  const offset = (pageNum - 1) * limitNum;

  const where: WhereOptions = { isDeleted: false, isActive: isActive === "true" };
  if (q) Object.assign(where, { [Op.or]: [sequelizeWhere(sequelize.fn("unaccent", col("Product.name")), { [Op.iLike]: sequelize.fn("unaccent", `%${q}%`) as unknown as string }), { slug: { [Op.iLike]: `%${q}%` } }] });

  const include: IncludeOptions[] = [
    { model: Capacity, as: "capacity", where: capacitySlug ? { slug: capacitySlug } : undefined, attributes: ["id", "name", "slug", "volumeMl"] },
    { model: ProductCategory, as: "productCategories", include: [{ model: Category, as: "category", attributes: ["id", "name", "slug"] }] },
    { model: ProductColor, as: "productColors", include: [{ model: Color, as: "color", where: colorSlug ? { slug: colorSlug } : undefined, attributes: ["id", "name", "slug", "hexCode"] }] },
    { model: ProductImage, as: "productImages", attributes: ["id", "url", "altText"], order: [["order", "ASC"]], limit: 1 },
  ];

  if (categorySlug) {
    const catInclude = include.find((i) => i.as === "productCategories")!;
    catInclude.required = true;
    (catInclude.include![0] as IncludeOptions).where = { slug: categorySlug };
    (catInclude.include![0] as IncludeOptions).required = true;
  }

  const { count: totalCount, rows: products } = await Product.findAndCountAll({ where, include, order: [["name", "ASC"]], offset, limit: limitNum, distinct: true });
  const totalPages = Math.ceil(totalCount / limitNum);

  return { items: products, pagination: { current_page: pageNum, per_page: limitNum, total_pages: totalPages, total_items: totalCount, has_next: pageNum < totalPages, has_prev: pageNum > 1 } };
}

export async function findLowStockProducts(filters: LowStockFilters) {
  const { threshold = "1", page = "1", limit = "20" } = filters;
  const thresholdNum = parseInt(threshold) || 1; const pageNum = parseInt(page) || 1; const limitNum = parseInt(limit) || 20;
  const offset = (pageNum - 1) * limitNum;

  const { count: totalCount, rows: products } = await Product.findAndCountAll({
    where: { isDeleted: false, isActive: true, stockQuantity: { [Op.lte]: thresholdNum } },
    include: [
      { model: Capacity, as: "capacity", attributes: ["id", "name", "slug", "volumeMl"] },
      { model: ProductCategory, as: "productCategories", include: [{ model: Category, as: "category", attributes: ["id", "name", "slug"] }] },
      { model: ProductColor, as: "productColors", include: [{ model: Color, as: "color", attributes: ["id", "name", "slug", "hexCode"] }] },
      { model: ProductImage, as: "productImages", attributes: ["id", "url", "altText"], order: [["order", "ASC"]], limit: 1 },
    ],
    order: [["stockQuantity", "ASC"]],
    offset, limit: limitNum, distinct: true,
  });

  return { items: products, pagination: { current_page: pageNum, per_page: limitNum, total_pages: Math.ceil(totalCount / limitNum), total_items: totalCount, has_next: pageNum < Math.ceil(totalCount / limitNum), has_prev: pageNum > 1 } };
}

export async function findPublicProducts(filters: PublicProductFilters) {
  const {
    page = "1", limit = "20", search = "", category, categorySlug, color, colorSlug,
    capacity, capacitySlug, minCapacity, maxCapacity, isFeatured = "all", locale, sortBy = "createdAt", sortOrder = "desc",
  } = filters;

  const requestedLocale = normalizeLocale(locale);
  const sortByNorm = normalizeSortField(sortBy, PUBLIC_SORT_FIELDS, "createdAt");
  const sortOrderNorm = normalizeSortOrder(sortOrder, "desc");
  const pageNum = parseInt(page) || 1; const limitNum = parseInt(limit) || 20;
  const offset = (pageNum - 1) * limitNum;

  const where: WhereOptions = { isActive: true, isDeleted: false, stockQuantity: { [Op.gt]: 0 } };
  if (search) Object.assign(where, { [Op.or]: buildLocalizedSearchConditions(search) });
  if (isFeatured !== "all") (where as Record<string, unknown>)["isFeatured"] = isFeatured === "true";

  const categorySlugValue = category || categorySlug;
  const colorSlugValue = color || colorSlug;
  const capacitySlugValue = capacity || capacitySlug;

  const categoryWhere: WhereOptions = categorySlugValue ? { slug: categorySlugValue } : {};
  const colorWhere: WhereOptions = colorSlugValue ? { slug: colorSlugValue } : {};
  const capacityWhere = capacitySlugValue ? { slug: capacitySlugValue } : buildCapacityWhere(minCapacity, maxCapacity);

  const countInclude = buildCountInclude(categoryWhere, colorWhere, capacityWhere);
  const totalCount = await Product.count({ where, include: countInclude, distinct: true, col: "id" });

  const orderClauses: Order = [
    ...(sortByNorm === "isFeatured" && isFeatured !== "true" ? [["isFeatured", sortOrderNorm.toUpperCase()]] : isFeatured === "true" ? [["isFeatured", "DESC"]] : []),
    ...(sortByNorm === "isFeatured" ? [["createdAt", "DESC"]] : [[sortByNorm, sortOrderNorm.toUpperCase()]]),
  ] as Order;

  const idRows = await Product.findAll({ where, include: countInclude, attributes: ["id"], order: orderClauses, group: ["Product.id"], offset, limit: limitNum, raw: true, subQuery: false });
  const paginatedIds = (idRows as Array<{ id: string }>).map((r) => r.id);

  const productsUnsorted = await Product.findAll({
    where: { id: { [Op.in]: paginatedIds } },
    include: [
      { model: Capacity, as: "capacity", where: Object.keys(capacityWhere).length > 0 ? capacityWhere : undefined, required: Object.keys(capacityWhere).length > 0, attributes: ["id", "name", "slug", "volumeMl"] },
      { model: ProductCategory, as: "productCategories", include: [{ model: Category, as: "category", where: Object.keys(categoryWhere).length > 0 ? categoryWhere : undefined, required: Object.keys(categoryWhere).length > 0, attributes: ["id", "name", "slug"] }] },
      { model: ProductColor, as: "productColors", include: [{ model: Color, as: "color", where: Object.keys(colorWhere).length > 0 ? colorWhere : undefined, required: Object.keys(colorWhere).length > 0, attributes: ["id", "name", "slug", "hexCode"] }] },
      { model: ProductImage, as: "productImages", attributes: ["id", "url", "altText", "order"] },
      { model: ProductTranslation, as: "translations", attributes: ["locale", "name", "description", "metaTitle", "metaDescription"], required: false, where: { locale: { [Op.in]: getSearchableLocales(requestedLocale) } } },
    ],
    attributes: ["id", "name", "slug", "description", "stockQuantity", "unitPrice", "productUrl", "isVip", "isFeatured", "createdAt"],
    order: [[{ model: ProductImage, as: "productImages" }, "order", "ASC"]],
  });

  const productsMap = new Map(productsUnsorted.map((p) => [p.id, p]));
  const products = paginatedIds.map((id) => productsMap.get(id)).filter(Boolean) as typeof productsUnsorted;

  return {
    items: products.map((p) => applyLocaleToProduct(p, requestedLocale)),
    pagination: { current_page: pageNum, per_page: limitNum, total_pages: Math.ceil(totalCount / limitNum), total_items: totalCount, has_next: pageNum < Math.ceil(totalCount / limitNum), has_prev: pageNum > 1 },
  };
}

export async function findPublicProductByIdOrSlug(idOrSlug: string, locale?: string) {
  const requestedLocale = normalizeLocale(locale);
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idOrSlug);
  const whereCondition = isUUID ? { id: idOrSlug, isActive: true, isDeleted: false } : { slug: idOrSlug, isActive: true, isDeleted: false };

  const product = await Product.findOne({
    where: whereCondition,
    include: [
      { model: Capacity, as: "capacity", attributes: ["id", "name", "slug", "volumeMl"] },
      { model: ProductCategory, as: "productCategories", include: [{ model: Category, as: "category", attributes: ["id", "name", "slug"] }] },
      { model: ProductColor, as: "productColors", include: [{ model: Color, as: "color", attributes: ["id", "name", "slug", "hexCode"] }] },
      { model: ProductImage, as: "productImages", attributes: ["id", "url", "altText", "order"], order: [["order", "ASC"]] },
      { model: ProductTranslation, as: "translations", attributes: ["locale", "name", "description", "metaTitle", "metaDescription"], required: false, where: { locale: { [Op.in]: getSearchableLocales(requestedLocale) } } },
    ],
    attributes: ["id", "name", "slug", "description", "stockQuantity", "unitPrice", "productUrl", "isVip", "isFeatured", "createdAt"],
  });

  if (!product) throw new ServiceError(404, "PRODUCT_NOT_FOUND", "Product not found");
  return applyLocaleToProduct(product, requestedLocale);
}

export async function getFeaturedStats() {
  const [total, featured, active, activeFeatured] = await Promise.all([
    Product.count({ where: { isDeleted: false } }),
    Product.count({ where: { isFeatured: true, isDeleted: false } }),
    Product.count({ where: { isActive: true, isDeleted: false } }),
    Product.count({ where: { isFeatured: true, isActive: true, isDeleted: false } }),
  ]);

  return {
    total: { allProducts: total, activeProducts: active, featuredProducts: featured, activeFeaturedProducts: activeFeatured },
    percentages: {
      featuredOfTotal: total > 0 ? Math.round((featured / total) * 1000) / 10 : 0,
      featuredOfActive: active > 0 ? Math.round((activeFeatured / active) * 1000) / 10 : 0,
    },
    breakdown: { notFeatured: total - featured, inactiveFeatured: featured - activeFeatured },
  };
}

export async function reorderImages(productId: string, imageOrders: Array<{ id: string; order: number }>) {
  const product = await Product.findByPk(productId);
  if (!product || product.isDeleted) throw new ServiceError(404, "PRODUCT_NOT_FOUND", "Product not found");

  await sequelize.transaction(async (t) => {
    for (const imageOrder of imageOrders) {
      await ProductImage.update({ order: imageOrder.order }, { where: { id: imageOrder.id, productId }, transaction: t });
    }
  });

  return Product.findByPk(productId, {
    include: [{ model: ProductImage, as: "productImages", attributes: ["id", "url", "altText", "order"], order: [["order", "ASC"]] }],
  });
}
