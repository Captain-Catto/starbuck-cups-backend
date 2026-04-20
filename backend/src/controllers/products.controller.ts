import { logger } from "@/utils/logger";
/**
 * Products management controller - COMPLETE VERSION
 * Handles CRUD operations for product entities with soft delete and stock management
 * All Prisma syntax converted to Sequelize
 */
import { Request, Response } from "express";
import {
  Product,
  ProductLocale,
  ProductTranslation,
  ProductCategory,
  ProductColor,
  ProductImage,
  Category,
  Color,
  Capacity,
} from "../models";
import { ResponseHelper } from "../types/api";
import { z } from "zod";
// import { s3Service } from "../services/s3.service"; // LEGACY S3 - Switched to Google Drive
import { googleDriveService } from "../services/google-drive.service"; // OAuth2 - Required for Gmail free accounts
// import { googleDriveSAService } from "../services/google-drive-sa.service"; // Service Account requires Google Workspace
import { processImage } from "../services/image-processing.service";
import { productImageService } from "../services/product-image.service";
// import {
//   meilisearchService,
//   SearchableProduct,
// } from "../services/meilisearch.service"; // TEMPORARILY DISABLED
import { generateVietnameseSlug } from "../utils/vietnamese-slug";
import { sequelize } from "../config/database";
import { Op, col, where as sequelizeWhere } from "sequelize";
import { getProductImageProcessingOptions } from "../services/watermark-settings.service";
import { clearCachePrefix } from "../middleware/redis-cache.middleware";

/**
 * Clear all product-related caches (Redis) and trigger frontend revalidation
 */
const invalidateProductCaches = async (): Promise<void> => {
  try {
    await Promise.all([
      clearCachePrefix("/api/products"),
      clearCachePrefix("/api/admin/products"),
    ]);

    // Trigger Next.js on-demand revalidation
    const frontendUrl = process.env.FRONTEND_URL;
    const revalidateSecret = process.env.REVALIDATE_SECRET;
    if (frontendUrl && revalidateSecret) {
      fetch(`${frontendUrl}/api/revalidate?secret=${revalidateSecret}&tag=products`).catch((err) => {
        logger.error("Failed to trigger frontend revalidation:", err);
      });
    }
  } catch (error) {
    logger.error("Failed to invalidate product caches:", error);
  }
};

const SUPPORTED_LOCALES = ["vi", "en", "zh"] as const;
type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
type TranslationPayload = {
  name?: string;
  description?: string;
  metaTitle?: string;
  metaDescription?: string;
};

const ADMIN_SORT_FIELDS = new Set([
  "name",
  "stockQuantity",
  "createdAt",
  "updatedAt",
  "isFeatured",
]);

const PUBLIC_SORT_FIELDS = new Set([
  "name",
  "createdAt",
  "isFeatured",
]);

// Helper function to generate SEO-friendly slug with Vietnamese support
// Only uses product name — short, clean URLs better for SEO
const generateProductSlug = (name: string): string => {
  return generateVietnameseSlug(name);
};

const normalizeLocale = (rawLocale?: string): SupportedLocale => {
  if (!rawLocale) return "vi";
  const normalized = rawLocale.trim().toLowerCase();
  if (normalized.startsWith("en")) return "en";
  if (normalized.startsWith("zh")) return "zh";
  return "vi";
};

const getSearchableLocales = (locale: SupportedLocale): SupportedLocale[] => {
  if (locale === "vi") return ["vi"];
  return [locale, "vi"];
};

const buildLocalizedSearchConditions = (
  keyword: string,
  includeSlug = false
) => {
  const likeKeyword = `%${keyword}%`;
  const escapedLike = sequelize.escape(likeKeyword);
  const conditions: any[] = [
    sequelizeWhere(
      sequelize.fn("unaccent", col("Product.name")),
      { [Op.iLike]: sequelize.fn("unaccent", likeKeyword) as any }
    ),
    // Use a correlated subquery instead of a JOIN column reference to avoid
    // GROUP BY / LEFT JOIN conflicts in the paginated id-fetch query.
    sequelize.literal(`EXISTS (
      SELECT 1 FROM product_translations AS "pt_search"
      WHERE "pt_search"."product_id" = "Product"."id"
      AND unaccent("pt_search"."name") ILIKE unaccent(${escapedLike})
    )`),
  ];

  if (includeSlug) {
    conditions.push({ slug: { [Op.iLike]: likeKeyword } });
  }

  return conditions;
};

const normalizeSortField = (
  rawSortBy: unknown,
  allowedFields: Set<string>,
  fallback: string
): string => {
  const sortBy = typeof rawSortBy === "string" ? rawSortBy : fallback;
  return allowedFields.has(sortBy) ? sortBy : fallback;
};

const normalizeSortOrder = (
  rawSortOrder: unknown,
  fallback: "asc" | "desc" = "desc"
): "asc" | "desc" => {
  if (typeof rawSortOrder !== "string") return fallback;
  const normalized = rawSortOrder.toLowerCase();
  return normalized === "asc" || normalized === "desc" ? normalized : fallback;
};

const toTranslationMap = (translations: any[] = []) => {
  return Object.fromEntries(
    translations.map((translation) => [
      translation.locale,
      {
        locale: translation.locale,
        name: translation.name,
        description: translation.description || "",
        metaTitle: translation.metaTitle || "",
        metaDescription: translation.metaDescription || "",
      },
    ])
  ) as Partial<
    Record<
      SupportedLocale,
      {
        locale: SupportedLocale;
        name: string;
        description: string;
        metaTitle: string;
        metaDescription: string;
      }
    >
  >;
};

const applyLocaleToProduct = (
  product: any,
  locale: SupportedLocale,
  includeTranslationsMap = false
) => {
  const plainProduct = typeof product.toJSON === "function" ? product.toJSON() : product;
  const translationMap = toTranslationMap(plainProduct.translations);
  const localized = translationMap[locale] || translationMap.vi;
  const { translations: _translations, ...restProduct } = plainProduct;

  const transformed = {
    ...restProduct,
    name: localized?.name ?? plainProduct.name,
    description: localized?.description ?? plainProduct.description ?? "",
    metaTitle: localized?.metaTitle ?? translationMap.vi?.metaTitle ?? "",
    metaDescription:
      localized?.metaDescription ?? translationMap.vi?.metaDescription ?? "",
  };

  if (includeTranslationsMap) {
    return {
      ...transformed,
      translations: translationMap,
    };
  }

  return transformed;
};

const parseTranslationPayload = (
  translations?: unknown
): Partial<Record<SupportedLocale, TranslationPayload>> => {
  if (!translations) return {};

  let parsedInput: unknown = translations;
  if (typeof parsedInput === "string") {
    try {
      parsedInput = JSON.parse(parsedInput);
    } catch {
      return {};
    }
  }

  if (
    typeof parsedInput !== "object" ||
    parsedInput === null ||
    Array.isArray(parsedInput)
  ) {
    return {};
  }

  const translationObject = parsedInput as Record<string, TranslationPayload>;

  const parsed: Partial<Record<SupportedLocale, TranslationPayload>> = {};
  for (const locale of SUPPORTED_LOCALES) {
    const value = translationObject[locale];
    if (!value) continue;

    parsed[locale] = {
      name: value.name?.trim(),
      description: value.description?.trim(),
      metaTitle: value.metaTitle?.trim(),
      metaDescription: value.metaDescription?.trim(),
    };
  }

  return parsed;
};

// Validation schemas
const translationEntrySchema = z
  .object({
    name: z.string().min(1, "Translation name is required").max(255).optional(),
    description: z.string().optional(),
    metaTitle: z.string().max(300).optional(),
    metaDescription: z.string().optional(),
  })
  .optional();

const translationsSchema = z
  .object({
    vi: translationEntrySchema,
    en: translationEntrySchema,
    zh: translationEntrySchema,
  })
  .optional();

const createProductSchema = z.object({
  name: z.string().min(1, "Product name is required").max(255),
  slug: z.string().optional(),
  description: z.string().optional(),
  capacityId: z.string().uuid("Invalid capacity ID").optional().nullable()
    .or(z.literal("")).transform(val => val === "" ? null : val),
  stockQuantity: z.coerce
    .number()
    .int()
    .nonnegative("Stock quantity must be non-negative"),
  unitPrice: z.coerce
    .number()
    .nonnegative("Unit price must be non-negative")
    .optional()
    .default(0),
  productUrl: z.string().url().optional().or(z.literal("")),
  isVip: z.boolean().optional().default(false),
  isFeatured: z.boolean().optional().default(false),
  categoryIds: z
    .array(z.string().uuid())
    .min(1, "At least one category is required"),
  colorIds: z.array(z.string().uuid()).optional().default([]),
  productImages: z
    .array(
      z.object({
        url: z.string().url(),
        order: z.number().int().nonnegative(),
      })
    )
    .optional()
    .default([]),
  translations: translationsSchema,
});

const updateProductSchema = createProductSchema.partial().extend({
  isActive: z.boolean().optional(),
});

const updateStockSchema = z.object({
  stockQuantity: z.coerce
    .number()
    .int()
    .nonnegative("Stock quantity must be non-negative"),
});

const reorderImagesSchema = z.object({
  imageOrders: z.array(
    z.object({
      id: z.string().uuid(),
      order: z.coerce.number().int().nonnegative(),
    })
  ),
});

/**
 * Get all products with advanced filtering and pagination
 */
export const getProducts = async (req: Request, res: Response) => {
  try {
    const {
      page = "1",
      limit = "20",
      search = "",
      isActive = "all",
      isDeleted = "false",
      isFeatured = "all",
      categorySlug,
      colorSlug,
      minCapacity,
      maxCapacity,
      locale,
      sortBy = "createdAt",
      sortOrder = "desc",
      lowStock = "false",
      lowStockThreshold = "1",
    } = req.query;
    const requestedLocale = normalizeLocale(locale as string | undefined);
    const normalizedSortBy = normalizeSortField(
      sortBy,
      ADMIN_SORT_FIELDS,
      "createdAt"
    );
    const normalizedSortOrder = normalizeSortOrder(sortOrder, "desc");

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;
    const threshold = parseInt(lowStockThreshold as string);

    const where: any = {};

    // Basic filters
    if (isDeleted === "false") {
      where.isDeleted = false;
    } else if (isDeleted === "true") {
      where.isDeleted = true;
    }

    if (isActive !== "all") {
      where.isActive = isActive === "true";
    }

    if (isFeatured !== "all") {
      where.isFeatured = isFeatured === "true";
    }

    // Search functionality
    if (search) {
      where[Op.or] = buildLocalizedSearchConditions(search as string, true);
    }

    // Low stock filter
    if (lowStock === "true") {
      where.stockQuantity = { [Op.lte]: threshold };
    }

    // Category filtering
    const categoryWhere: any = {};
    if (categorySlug) {
      categoryWhere.slug = categorySlug;
    }

    // Color filtering
    const colorWhere: any = {};
    if (colorSlug) {
      colorWhere.slug = colorSlug;
    }

    // Capacity filtering by min/max volume
    const capacityWhere: any = {};
    if (minCapacity || maxCapacity) {
      if (minCapacity && maxCapacity) {
        capacityWhere.volumeMl = {
          [Op.between]: [
            parseInt(minCapacity as string),
            parseInt(maxCapacity as string),
          ],
        };
      } else if (minCapacity) {
        capacityWhere.volumeMl = { [Op.gte]: parseInt(minCapacity as string) };
      } else if (maxCapacity) {
        capacityWhere.volumeMl = { [Op.lte]: parseInt(maxCapacity as string) };
      }
    }

    // Build common include configuration for counting
    const countInclude = [
      {
        model: Capacity,
        as: "capacity",
        where: Object.keys(capacityWhere).length > 0 ? capacityWhere : undefined,
        required: Object.keys(capacityWhere).length > 0,
        attributes: [],
      },
      {
        model: ProductCategory,
        as: "productCategories",
        attributes: [],
        ...(Object.keys(categoryWhere).length > 0 && {
          required: true,
          include: [
            {
              model: Category,
              as: "category",
              where: categoryWhere,
              required: true,
              attributes: [],
            },
          ],
        }),
      },
      {
        model: ProductColor,
        as: "productColors",
        attributes: [],
        ...(Object.keys(colorWhere).length > 0 && {
          required: true,
          include: [
            {
              model: Color,
              as: "color",
              where: colorWhere,
              required: true,
              attributes: [],
            },
          ],
        }),
      },
    ];

    // translations join no longer needed for search filtering —
    // correlated subquery in buildLocalizedSearchConditions handles it.

    // Determine sort order - featured products first when filtering
    const orderClauses: any[] = [];
    if (isFeatured === "true") {
      orderClauses.push(["isFeatured", "DESC"]);
    }
    // If sorting by isFeatured, use createdAt DESC as secondary sort instead of duplicate
    if (normalizedSortBy === "isFeatured") {
      orderClauses.push(["createdAt", "DESC"]);
    } else {
      orderClauses.push([normalizedSortBy, normalizedSortOrder.toUpperCase()]);
    }

    const totalCount = await Product.count({
      where,
      include: countInclude,
      distinct: true,
      col: "id",
    });

    // Single query with GROUP BY to deduplicate JOINed rows
    const idRows = await Product.findAll({
      where,
      include: countInclude,
      attributes: ["id"],
      order: orderClauses,
      group: ["Product.id"],
      offset,
      limit: limitNum,
      raw: true,
      subQuery: false,
    });

    const paginatedProductIds = (idRows as Array<{ id: string }>).map(
      (row) => row.id
    );

    // Now fetch the full product details for these specific IDs
    const productsUnsorted = await Product.findAll({
      where: {
        id: { [Op.in]: paginatedProductIds },
      },
      include: [
        {
          model: Capacity,
          as: "capacity",
          attributes: ["id", "name", "slug", "volumeMl"],
        },
        {
          model: ProductCategory,
          as: "productCategories",
          include: [
            {
              model: Category,
              as: "category",
              attributes: ["id", "name", "slug"],
            },
          ],
        },
        {
          model: ProductColor,
          as: "productColors",
          include: [
            {
              model: Color,
              as: "color",
              attributes: ["id", "name", "slug", "hexCode"],
            },
          ],
        },
        {
          model: ProductImage,
          as: "productImages",
          attributes: ["id", "url", "altText", "order"],
        },
        {
          model: ProductTranslation,
          as: "translations",
          attributes: [
            "locale",
            "name",
            "description",
            "metaTitle",
            "metaDescription",
          ],
          required: false,
        },
      ],
      order: [
        [{ model: ProductImage, as: "productImages" }, "order", "ASC"],
      ],
    });

    // Sort products according to the original paginated order
    const productsMap = new Map(productsUnsorted.map(p => [p.id, p]));
    const products = paginatedProductIds
      .map((id) => productsMap.get(id)!)
      .filter(Boolean)
      .map((product) => applyLocaleToProduct(product, requestedLocale, true));

    const totalPages = Math.ceil(totalCount / limitNum);

    return res.status(200).json(
      ResponseHelper.paginated(products, {
        current_page: pageNum,
        per_page: limitNum,
        total_pages: totalPages,
        total_items: totalCount,
        has_next: pageNum < totalPages,
        has_prev: pageNum > 1,
      })
    );
  } catch (error) {
    logger.error("Get products error:", error);
    return res
      .status(500)
      .json(
        ResponseHelper.error(
          "Failed to retrieve products",
          "GET_PRODUCTS_ERROR"
        )
      );
  }
};

/**
 * Get product by ID with full details
 */
export const getProductById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const locale = normalizeLocale(req.query.locale as string | undefined);

    const product = await Product.findByPk(id, {
      include: [
        {
          model: Capacity,
          as: "capacity",
          attributes: ["id", "name", "slug", "volumeMl"],
        },
        {
          model: ProductCategory,
          as: "productCategories",
          include: [
            {
              model: Category,
              as: "category",
              attributes: ["id", "name", "slug"],
            },
          ],
        },
        {
          model: ProductColor,
          as: "productColors",
          include: [
            {
              model: Color,
              as: "color",
              attributes: ["id", "name", "slug", "hexCode"],
            },
          ],
        },
        {
          model: ProductImage,
          as: "productImages",
          attributes: ["id", "url", "altText", "order"],
        },
        {
          model: ProductTranslation,
          as: "translations",
          attributes: [
            "locale",
            "name",
            "description",
            "metaTitle",
            "metaDescription",
          ],
          required: false,
        },
      ],
      order: [[{ model: ProductImage, as: "productImages" }, "order", "ASC"]],
    });

    if (!product || product.isDeleted) {
      return res
        .status(404)
        .json(ResponseHelper.error("Product not found", "PRODUCT_NOT_FOUND"));
    }

    return res
      .status(200)
      .json(ResponseHelper.success(applyLocaleToProduct(product, locale, true)));
  } catch (error) {
    logger.error("Get product error:", error);
    return res
      .status(500)
      .json(
        ResponseHelper.error("Failed to retrieve product", "GET_PRODUCT_ERROR")
      );
  }
};

/**
 * Create new product
 */
export const createProduct = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res
        .status(401)
        .json(ResponseHelper.error("Authentication required", "UNAUTHORIZED"));
    }

    const validationResult = createProductSchema.safeParse(req.body);
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

    const {
      name,
      slug,
      description,
      capacityId,
      stockQuantity,
      unitPrice,
      productUrl,
      isVip,
      isFeatured,
      categoryIds,
      colorIds,
      productImages,
      translations,
    } = validationResult.data;
    const parsedTranslations = parseTranslationPayload(
      translations as Record<string, TranslationPayload>
    );
    const viTranslation = parsedTranslations.vi;
    const canonicalName = viTranslation?.name?.trim() || name.trim();
    const canonicalDescription =
      viTranslation?.description !== undefined
        ? viTranslation.description
        : description?.trim();

    // Sort images by order and extract URLs
    const imagesToProcess = productImages
      .sort((a, b) => a.order - b.order)
      .map((img) => img.url);

    // Create product in transaction
    const result = await sequelize.transaction(async (t) => {
      // Verify references exist and are active
      const [capacity, colors, categories] = await Promise.all([
        capacityId ? Capacity.findOne({
          where: { id: capacityId, isActive: true },
          transaction: t,
        }) : Promise.resolve(null),
        colorIds?.length ? Color.findAll({
          where: { id: { [Op.in]: colorIds }, isActive: true },
          transaction: t,
        }) : Promise.resolve([]),
        Category.findAll({
          where: { id: { [Op.in]: categoryIds }, isActive: true },
          transaction: t,
        }),
      ]);

      if (capacityId && !capacity) {
        throw new Error("Capacity not found or inactive");
      }
      if (colorIds && colors.length !== colorIds.length) {
        throw new Error("One or more colors not found or inactive");
      }
      if (categories.length !== categoryIds.length) {
        throw new Error("One or more categories not found or inactive");
      }

      // Generate slug from product name only (short, SEO-friendly)
      const finalSlug = slug?.trim() || generateProductSlug(canonicalName);

      if (!finalSlug) {
        throw new Error("Cannot generate slug from product name");
      }

      // Check for duplicate slug — throw error so admin can choose a different name
      const existingWithSlug = await Product.findOne({ where: { slug: finalSlug }, transaction: t });
      if (existingWithSlug) {
        throw new Error(`DUPLICATE_SLUG:${finalSlug}`);
      }

      // Create product
      const product = await Product.create(
        {
          name: canonicalName,
          slug: finalSlug,
          description: canonicalDescription,
          capacityId,
          stockQuantity,
          unitPrice,
          productUrl,
          isVip: Boolean(isVip),
          isFeatured: Boolean(isFeatured),
          isActive: true,
          isDeleted: false,
          createdByAdminId: req.user!.userId,
        },
        { transaction: t }
      );

      // Create product-category relationships
      await ProductCategory.bulkCreate(
        categoryIds.map((categoryId) => ({
          productId: product.id,
          categoryId,
        })),
        { transaction: t }
      );

      // Create product-color relationships
      await ProductColor.bulkCreate(
        colorIds.map((colorId) => ({
          productId: product.id,
          colorId,
        })),
        { transaction: t }
      );

      // Create product images if provided
      if (imagesToProcess && imagesToProcess.length > 0) {
        await ProductImage.bulkCreate(
          imagesToProcess.map((imageUrl, index) => ({
            productId: product.id,
            url: imageUrl,
            altText: canonicalName,
            order: index,
          })),
          { transaction: t }
        );
      }

      const translationsToPersist: Partial<
        Record<SupportedLocale, TranslationPayload>
      > = {
        ...parsedTranslations,
        vi: {
          ...parsedTranslations.vi,
          name: canonicalName,
          description: canonicalDescription,
        },
      };

      const translationRows = Object.entries(translationsToPersist)
        .filter((entry): entry is [SupportedLocale, TranslationPayload] =>
          SUPPORTED_LOCALES.includes(entry[0] as SupportedLocale)
        )
        .map(([locale, value]) => {
          const hasAnyData =
            Boolean(value.name?.trim()) ||
            value.description !== undefined ||
            Boolean(value.metaTitle?.trim()) ||
            Boolean(value.metaDescription?.trim());
          if (!hasAnyData) return null;

          return {
            productId: product.id,
            locale,
            name: value.name?.trim() || canonicalName,
            description:
              value.description !== undefined
                ? value.description
                : canonicalDescription,
            metaTitle: value.metaTitle?.trim() || undefined,
            metaDescription: value.metaDescription?.trim() || undefined,
          };
        })
        .filter(Boolean) as Array<{
        productId: string;
        locale: SupportedLocale;
        name: string;
        description?: string;
        metaTitle?: string;
        metaDescription?: string;
      }>;

      if (translationRows.length > 0) {
        await ProductTranslation.bulkCreate(translationRows, { transaction: t });
      }

      return product;
    });

    // Fetch complete product with associations
    const createdProduct = await Product.findByPk(result.id, {
      include: [
        {
          model: Capacity,
          as: "capacity",
          attributes: ["id", "name", "slug", "volumeMl"],
        },
        {
          model: ProductCategory,
          as: "productCategories",
          include: [
            {
              model: Category,
              as: "category",
              attributes: ["id", "name", "slug"],
            },
          ],
        },
        {
          model: ProductColor,
          as: "productColors",
          include: [
            {
              model: Color,
              as: "color",
              attributes: ["id", "name", "slug", "hexCode"],
            },
          ],
        },
        {
          model: ProductImage,
          as: "productImages",
          attributes: ["id", "url", "altText", "order"],
          order: [["order", "ASC"]],
        },
        {
          model: ProductTranslation,
          as: "translations",
          attributes: [
            "locale",
            "name",
            "description",
            "metaTitle",
            "metaDescription",
          ],
          required: false,
        },
      ],
    });

    // Invalidate caches so customers see the new product immediately
    invalidateProductCaches();

    return res
      .status(201)
      .json(ResponseHelper.success(applyLocaleToProduct(createdProduct, "vi", true)));
  } catch (error: any) {
    logger.error("Create product error:", error);

    if (
      error.message.includes("not found") ||
      error.message.includes("inactive")
    ) {
      return res
        .status(400)
        .json(ResponseHelper.error(error.message, "VALIDATION_ERROR"));
    }

    if (error.message.startsWith("DUPLICATE_SLUG:")) {
      const slug = error.message.replace("DUPLICATE_SLUG:", "");
      return res.status(409).json(
        ResponseHelper.error(
          `Sản phẩm với tên này đã tồn tại (slug: "${slug}"). Vui lòng đổi tên sản phẩm.`,
          "DUPLICATE_SLUG"
        )
      );
    }

    return res
      .status(500)
      .json(
        ResponseHelper.error("Failed to create product", "CREATE_PRODUCT_ERROR")
      );
  }
};

/**
 * Update product with file uploads
 */
export const updateProductWithFiles = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res
        .status(401)
        .json(ResponseHelper.error("Authentication required", "UNAUTHORIZED"));
    }

    const { id } = req.params;
    const files = req.files as Express.Multer.File[];

    // Check if product exists
    const existingProduct = await Product.findByPk(id);
    if (!existingProduct || existingProduct.isDeleted) {
      return res
        .status(404)
        .json(ResponseHelper.error("Product not found", "PRODUCT_NOT_FOUND"));
    }

    const parsedBody = { ...(req.body as Record<string, unknown>) };

    const parseJsonField = <T>(
      value: unknown,
      fallback: T
    ): T => {
      if (value === undefined || value === null || value === "") return fallback;
      if (typeof value !== "string") return value as T;
      try {
        return JSON.parse(value) as T;
      } catch {
        return fallback;
      }
    };

    if (Object.prototype.hasOwnProperty.call(parsedBody, "categoryIds")) {
      parsedBody.categoryIds = parseJsonField<string[]>(
        parsedBody.categoryIds,
        []
      );
    }
    if (Object.prototype.hasOwnProperty.call(parsedBody, "colorIds")) {
      parsedBody.colorIds = parseJsonField<string[]>(parsedBody.colorIds, []);
    }
    if (Object.prototype.hasOwnProperty.call(parsedBody, "productImages")) {
      parsedBody.productImages = parseJsonField<
        Array<{ url: string; order: number }>
      >(parsedBody.productImages, []);
    }
    if (Object.prototype.hasOwnProperty.call(parsedBody, "translations")) {
      parsedBody.translations = parseJsonField<
        Record<string, TranslationPayload>
      >(parsedBody.translations, {});
    }

    if (parsedBody.stockQuantity !== undefined) {
      parsedBody.stockQuantity = Number(parsedBody.stockQuantity);
    }
    if (parsedBody.unitPrice !== undefined) {
      parsedBody.unitPrice = Number(parsedBody.unitPrice);
    }
    if (parsedBody.isActive !== undefined) {
      parsedBody.isActive = parsedBody.isActive === "true" || parsedBody.isActive === true;
    }
    if (parsedBody.isVip !== undefined) {
      parsedBody.isVip = parsedBody.isVip === "true" || parsedBody.isVip === true;
    }
    if (parsedBody.isFeatured !== undefined) {
      parsedBody.isFeatured =
        parsedBody.isFeatured === "true" || parsedBody.isFeatured === true;
    }
    const keepExistingImages =
      parsedBody.keepExistingImages === undefined
        ? true
        : parsedBody.keepExistingImages === true ||
          parsedBody.keepExistingImages === "true";

    const validationResult = updateProductSchema.safeParse(parsedBody);
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

    const updateData = validationResult.data;
    const parsedTranslations = parseTranslationPayload(
      (updateData as any).translations as Record<string, TranslationPayload>
    );
    const {
      categoryIds: categoryIdsUpdate,
      colorIds: colorIdsUpdate,
      productImages: productImagesUpdate,
      translations: _translationsUpdate,
      ...baseUpdateData
    } = updateData as any;

    // Update product in transaction
    const updatedProduct = await sequelize.transaction(async (t) => {
      const viTranslation = parsedTranslations.vi;
      const finalName = viTranslation?.name?.trim() || updateData.name?.trim() || existingProduct.name;
      const finalDescription =
        viTranslation?.description !== undefined
          ? viTranslation.description
          : updateData.description !== undefined
          ? updateData.description.trim()
          : existingProduct.description;
      const imagePreset = await getProductImageProcessingOptions();

      // Handle file uploads if present
      if (files && files.length > 0) {
        let startingOrder = 0;
        if (keepExistingImages) {
          const maxExistingOrder = await ProductImage.max("order", {
            where: { productId: id },
            transaction: t,
          });
          const parsedMaxOrder = Number(maxExistingOrder);
          startingOrder = Number.isFinite(parsedMaxOrder)
            ? parsedMaxOrder + 1
            : 0;
        } else {
          await ProductImage.destroy({
            where: { productId: id },
            transaction: t,
          });
        }

        const uploadPromises = files.map(async (file, index) => {
          // Resize & convert to AVIF before uploading
          const processed = await processImage(
            file.buffer,
            file.originalname,
            imagePreset
          );

          const uploadResult = await googleDriveService.uploadFile(
            processed.buffer,
            processed.filename,
            "products"
          );
          return {
            productId: id,
            url: uploadResult.url,
            altText: `${finalName} - Image ${index + 1}`,
            order: startingOrder + index,
          };
        });

        const imageData = await Promise.all(uploadPromises);
        await ProductImage.bulkCreate(imageData, { transaction: t });
      }

      // Handle explicit productImages update if provided from client payload
      const imagesToProcess = productImagesUpdate
        ? productImagesUpdate
            .sort(
              (a: { order: number }, b: { order: number }) => a.order - b.order
            )
            .map((img: { url: string }) => img.url)
        : [];

      if (
        imagesToProcess &&
        imagesToProcess.length > 0 &&
        (!files || files.length === 0)
      ) {
        await ProductImage.destroy({
          where: { productId: id },
          transaction: t,
        });

        await ProductImage.bulkCreate(
          imagesToProcess.map((imageUrl: string, index: number) => ({
            productId: id,
            url: imageUrl,
            altText: finalName,
            order: index,
          })),
          { transaction: t }
        );
      }

      // Update basic product fields
      await existingProduct.update(
        {
          ...baseUpdateData,
          name: finalName,
          description: finalDescription,
        },
        { transaction: t }
      );

      // Update category relationships if provided
      if (categoryIdsUpdate) {
        const categories = await Category.findAll({
          where: { id: { [Op.in]: categoryIdsUpdate }, isActive: true },
          transaction: t,
        });

        if (categories.length !== categoryIdsUpdate.length) {
          throw new Error("One or more categories not found or inactive");
        }

        await ProductCategory.destroy({
          where: { productId: id },
          transaction: t,
        });

        await ProductCategory.bulkCreate(
          categoryIdsUpdate.map((categoryId: string) => ({
            productId: id,
            categoryId,
          })),
          { transaction: t }
        );
      }

      // Update color relationships if provided
      if (colorIdsUpdate) {
        const colors = await Color.findAll({
          where: { id: { [Op.in]: colorIdsUpdate }, isActive: true },
          transaction: t,
        });

        if (colors.length !== colorIdsUpdate.length) {
          throw new Error("One or more colors not found or inactive");
        }

        await ProductColor.destroy({
          where: { productId: id },
          transaction: t,
        });

        await ProductColor.bulkCreate(
          colorIdsUpdate.map((colorId: string) => ({
            productId: id,
            colorId,
          })),
          { transaction: t }
        );
      }

      const existingTranslations = await ProductTranslation.findAll({
        where: { productId: id },
        transaction: t,
      });
      const existingTranslationMap = new Map(
        existingTranslations.map((translation) => [translation.locale, translation])
      );
      const translationsToPersist: Partial<
        Record<SupportedLocale, TranslationPayload>
      > = {
        ...parsedTranslations,
        vi: {
          ...parsedTranslations.vi,
          name: finalName,
          description: finalDescription,
        },
      };

      for (const locale of SUPPORTED_LOCALES) {
        const incoming = translationsToPersist[locale];
        if (!incoming) continue;

        const hasAnyIncomingValue =
          incoming.name !== undefined ||
          incoming.description !== undefined ||
          incoming.metaTitle !== undefined ||
          incoming.metaDescription !== undefined;
        if (!hasAnyIncomingValue) continue;

        const currentTranslation = existingTranslationMap.get(locale);
        const nextName = incoming.name?.trim() || currentTranslation?.name || finalName;
        const nextDescription =
          incoming.description !== undefined
            ? incoming.description
            : currentTranslation?.description ||
              (locale === "vi" ? finalDescription : undefined);
        const nextMetaTitle =
          incoming.metaTitle !== undefined
            ? incoming.metaTitle?.trim() || undefined
            : currentTranslation?.metaTitle;
        const nextMetaDescription =
          incoming.metaDescription !== undefined
            ? incoming.metaDescription?.trim() || undefined
            : currentTranslation?.metaDescription;

        if (currentTranslation) {
          await currentTranslation.update(
            {
              name: nextName,
              description: nextDescription,
              metaTitle: nextMetaTitle,
              metaDescription: nextMetaDescription,
            },
            { transaction: t }
          );
        } else {
          await ProductTranslation.create(
            {
              productId: id,
              locale,
              name: nextName,
              description: nextDescription,
              metaTitle: nextMetaTitle,
              metaDescription: nextMetaDescription,
            },
            { transaction: t }
          );
        }
      }

      return Product.findByPk(id, {
        include: [
          {
            model: Capacity,
            as: "capacity",
            attributes: ["id", "name", "slug", "volumeMl"],
          },
          {
            model: ProductCategory,
            as: "productCategories",
            include: [
              {
                model: Category,
                as: "category",
                attributes: ["id", "name", "slug"],
              },
            ],
          },
          {
            model: ProductColor,
            as: "productColors",
            include: [
              {
                model: Color,
                as: "color",
                attributes: ["id", "name", "slug", "hexCode"],
              },
            ],
          },
          {
            model: ProductImage,
            as: "productImages",
            attributes: ["id", "url", "altText", "order"],
            order: [["order", "ASC"]],
          },
          {
            model: ProductTranslation,
            as: "translations",
            attributes: [
              "locale",
              "name",
              "description",
              "metaTitle",
              "metaDescription",
            ],
            required: false,
          },
        ],
        transaction: t,
      });
    });

    // Invalidate caches so customers see the update immediately
    invalidateProductCaches();

    return res
      .status(200)
      .json(ResponseHelper.success(applyLocaleToProduct(updatedProduct, "vi", true)));
  } catch (error: any) {
    logger.error("Update product with files error:", error);

    if (
      error.message.includes("not found") ||
      error.message.includes("inactive")
    ) {
      return res
        .status(400)
        .json(ResponseHelper.error(error.message, "VALIDATION_ERROR"));
    }

    return res
      .status(500)
      .json(
        ResponseHelper.error("Failed to update product", "UPDATE_PRODUCT_ERROR")
      );
  }
};

/**
 * Update product basic info
 */
export const updateProduct = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res
        .status(401)
        .json(ResponseHelper.error("Authentication required", "UNAUTHORIZED"));
    }

    const { id } = req.params;

    const validationResult = updateProductSchema.safeParse(req.body);
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

    // Check if product exists
    const existingProduct = await Product.findByPk(id);
    if (!existingProduct || existingProduct.isDeleted) {
      return res
        .status(404)
        .json(ResponseHelper.error("Product not found", "PRODUCT_NOT_FOUND"));
    }

    const updateData = validationResult.data;
    const parsedTranslations = parseTranslationPayload(
      (updateData as any).translations as Record<string, TranslationPayload>
    );
    const {
      categoryIds: categoryIdsUpdate,
      colorIds: colorIdsUpdate,
      productImages: productImagesUpdate,
      translations: _translationsUpdate,
      ...baseUpdateData
    } = updateData as any;

    // Update product in transaction
    const updatedProduct = await sequelize.transaction(async (t) => {
      const viTranslation = parsedTranslations.vi;
      const finalName = viTranslation?.name?.trim() || updateData.name?.trim() || existingProduct.name;
      const finalDescription =
        viTranslation?.description !== undefined
          ? viTranslation.description
          : updateData.description !== undefined
          ? updateData.description.trim()
          : existingProduct.description;

      let finalSlug = existingProduct.slug;
      const requestedSlug = updateData.slug?.trim();

      // If name or slug is being updated, regenerate slug
      if (requestedSlug || finalName !== existingProduct.name) {
        if (requestedSlug) {
          finalSlug = requestedSlug;
        }

        if (!requestedSlug) {
          finalSlug = generateProductSlug(finalName);
        }

        if (!finalSlug) {
          finalSlug = existingProduct.slug;
        }

        // Check for slug conflicts — notify admin instead of silently auto-incrementing
        const conflicting = await Product.findOne({
          where: { slug: finalSlug, id: { [Op.ne]: id } },
          transaction: t,
        });
        if (conflicting) {
          throw new Error(`DUPLICATE_SLUG:${finalSlug}`);
        }
      }

      // Update basic product fields
      await existingProduct.update(
        {
          ...baseUpdateData,
          slug: finalSlug,
          name: finalName,
          description: finalDescription,
        },
        { transaction: t }
      );

      // Update category relationships if provided
      if (categoryIdsUpdate) {
        // Verify categories exist and are active
        const categories = await Category.findAll({
          where: { id: { [Op.in]: categoryIdsUpdate }, isActive: true },
          transaction: t,
        });

        if (categories.length !== categoryIdsUpdate.length) {
          throw new Error("One or more categories not found or inactive");
        }

        // Remove existing category relationships
        await ProductCategory.destroy({
          where: { productId: id },
          transaction: t,
        });

        // Create new category relationships
        await ProductCategory.bulkCreate(
          categoryIdsUpdate.map((categoryId: string) => ({
            productId: id,
            categoryId,
          })),
          { transaction: t }
        );
      }

      // Update color relationships if provided
      if (colorIdsUpdate) {
        // Verify colors exist and are active
        const colors = await Color.findAll({
          where: { id: { [Op.in]: colorIdsUpdate }, isActive: true },
          transaction: t,
        });

        if (colors.length !== colorIdsUpdate.length) {
          throw new Error("One or more colors not found or inactive");
        }

        // Remove existing color relationships
        await ProductColor.destroy({
          where: { productId: id },
          transaction: t,
        });

        // Create new color relationships
        await ProductColor.bulkCreate(
          colorIdsUpdate.map((colorId: string) => ({
            productId: id,
            colorId,
          })),
          { transaction: t }
        );
      }

      // Handle productImages update if provided
      const imagesToProcess = productImagesUpdate
        ? productImagesUpdate
            .sort(
              (a: { order: number }, b: { order: number }) => a.order - b.order
            )
            .map((img: { url: string }) => img.url)
        : [];

      if (imagesToProcess && imagesToProcess.length > 0) {
        // Remove existing product images
        await ProductImage.destroy({
          where: { productId: id },
          transaction: t,
        });

          // Create new product images
          await ProductImage.bulkCreate(
            imagesToProcess.map((imageUrl: string, index: number) => ({
              productId: id,
              url: imageUrl,
              altText: finalName,
              order: index,
            })),
            { transaction: t }
          );
      }

      // Upsert product translations
      const existingTranslations = await ProductTranslation.findAll({
        where: { productId: id },
        transaction: t,
      });
      const existingTranslationMap = new Map(
        existingTranslations.map((translation) => [translation.locale, translation])
      );

      const translationsToPersist: Partial<
        Record<SupportedLocale, TranslationPayload>
      > = {
        ...parsedTranslations,
        vi: {
          ...parsedTranslations.vi,
          name: finalName,
          description: finalDescription,
        },
      };

      for (const locale of SUPPORTED_LOCALES) {
        const incoming = translationsToPersist[locale];
        if (!incoming) continue;

        const hasAnyIncomingValue =
          incoming.name !== undefined ||
          incoming.description !== undefined ||
          incoming.metaTitle !== undefined ||
          incoming.metaDescription !== undefined;
        if (!hasAnyIncomingValue) continue;

        const currentTranslation = existingTranslationMap.get(locale);
        const nextName = incoming.name?.trim() || currentTranslation?.name || finalName;
        const nextDescription =
          incoming.description !== undefined
            ? incoming.description
            : currentTranslation?.description ||
              (locale === "vi" ? finalDescription : undefined);
        const nextMetaTitle =
          incoming.metaTitle !== undefined
            ? incoming.metaTitle?.trim() || undefined
            : currentTranslation?.metaTitle;
        const nextMetaDescription =
          incoming.metaDescription !== undefined
            ? incoming.metaDescription?.trim() || undefined
            : currentTranslation?.metaDescription;

        if (currentTranslation) {
          await currentTranslation.update(
            {
              name: nextName,
              description: nextDescription,
              metaTitle: nextMetaTitle,
              metaDescription: nextMetaDescription,
            },
            { transaction: t }
          );
        } else {
          await ProductTranslation.create(
            {
              productId: id,
              locale,
              name: nextName,
              description: nextDescription,
              metaTitle: nextMetaTitle,
              metaDescription: nextMetaDescription,
            },
            { transaction: t }
          );
        }
      }

      return Product.findByPk(id, {
        include: [
          {
            model: Capacity,
            as: "capacity",
            attributes: ["id", "name", "slug", "volumeMl"],
          },
          {
            model: ProductCategory,
            as: "productCategories",
            include: [
              {
                model: Category,
                as: "category",
                attributes: ["id", "name", "slug"],
              },
            ],
          },
          {
            model: ProductColor,
            as: "productColors",
            include: [
              {
                model: Color,
                as: "color",
                attributes: ["id", "name", "slug", "hexCode"],
              },
            ],
          },
          {
            model: ProductImage,
            as: "productImages",
            attributes: ["id", "url", "altText", "order"],
            order: [["order", "ASC"]],
          },
          {
            model: ProductTranslation,
            as: "translations",
            attributes: [
              "locale",
              "name",
              "description",
              "metaTitle",
              "metaDescription",
            ],
            required: false,
          },
        ],
        transaction: t,
      });
    });

    // Invalidate caches so customers see the update immediately
    invalidateProductCaches();

    return res
      .status(200)
      .json(ResponseHelper.success(applyLocaleToProduct(updatedProduct, "vi", true)));
  } catch (error: any) {
    logger.error("Update product error:", error);

    if (
      error.message.includes("not found") ||
      error.message.includes("inactive")
    ) {
      return res
        .status(400)
        .json(ResponseHelper.error(error.message, "VALIDATION_ERROR"));
    }

    return res
      .status(500)
      .json(
        ResponseHelper.error("Failed to update product", "UPDATE_PRODUCT_ERROR")
      );
  }
};

/**
 * Delete product (soft delete)
 */
export const deleteProduct = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res
        .status(401)
        .json(ResponseHelper.error("Authentication required", "UNAUTHORIZED"));
    }

    const { id } = req.params;

    const product = await Product.findByPk(id);
    if (!product || product.isDeleted) {
      return res
        .status(404)
        .json(ResponseHelper.error("Product not found", "PRODUCT_NOT_FOUND"));
    }

    // Soft delete
    await product.update({
      isDeleted: true,
      deletedAt: new Date(),
      deletedByAdminId: req.user.userId,
    });

    // Invalidate caches so customers no longer see the deleted product
    invalidateProductCaches();

    return res
      .status(200)
      .json(
        ResponseHelper.success({ message: "Product deleted successfully" })
      );
  } catch (error) {
    logger.error("Delete product error:", error);
    return res
      .status(500)
      .json(
        ResponseHelper.error("Failed to delete product", "DELETE_PRODUCT_ERROR")
      );
  }
};

/**
 * Reactivate deleted product
 */
export const reactivateProduct = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res
        .status(401)
        .json(ResponseHelper.error("Authentication required", "UNAUTHORIZED"));
    }

    const { id } = req.params;

    const product = await Product.findByPk(id);
    if (!product) {
      return res
        .status(404)
        .json(ResponseHelper.error("Product not found", "PRODUCT_NOT_FOUND"));
    }

    if (!product.isDeleted) {
      return res
        .status(400)
        .json(
          ResponseHelper.error("Product is not deleted", "PRODUCT_NOT_DELETED")
        );
    }

    // Reactivate product
    await product.update({
      isDeleted: false,
      deletedAt: undefined,
      deletedByAdminId: undefined,
      isActive: true,
    });

    // Invalidate caches so customers see the reactivated product
    invalidateProductCaches();

    return res.status(200).json(
      ResponseHelper.success({
        message: "Product reactivated successfully",
        product,
      })
    );
  } catch (error) {
    logger.error("Reactivate product error:", error);
    return res
      .status(500)
      .json(
        ResponseHelper.error(
          "Failed to reactivate product",
          "REACTIVATE_PRODUCT_ERROR"
        )
      );
  }
};

/**
 * Update product stock quantity
 */
export const updateProductStock = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res
        .status(401)
        .json(ResponseHelper.error("Authentication required", "UNAUTHORIZED"));
    }

    const { id } = req.params;

    const validationResult = updateStockSchema.safeParse(req.body);
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

    const { stockQuantity } = validationResult.data;

    const product = await Product.findByPk(id);
    if (!product || product.isDeleted) {
      return res
        .status(404)
        .json(ResponseHelper.error("Product not found", "PRODUCT_NOT_FOUND"));
    }

    // Update stock quantity
    await product.update({ stockQuantity });

    // Invalidate caches so stock changes reflect immediately
    invalidateProductCaches();

    return res.status(200).json(
      ResponseHelper.success({
        message: "Product stock updated successfully",
        productId: id,
        stockQuantity,
        previousStock: product.stockQuantity,
      })
    );
  } catch (error) {
    logger.error("Update product stock error:", error);
    return res
      .status(500)
      .json(
        ResponseHelper.error(
          "Failed to update product stock",
          "UPDATE_PRODUCT_STOCK_ERROR"
        )
      );
  }
};

/**
 * Toggle product active status
 */
export const toggleProductStatus = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res
        .status(401)
        .json(ResponseHelper.error("Authentication required", "UNAUTHORIZED"));
    }

    const { id } = req.params;

    const product = await Product.findByPk(id);
    if (!product || product.isDeleted) {
      return res
        .status(404)
        .json(ResponseHelper.error("Product not found", "PRODUCT_NOT_FOUND"));
    }

    await product.update({
      isActive: !product.isActive,
    });

    // Invalidate caches so status change reflects immediately
    invalidateProductCaches();

    return res.status(200).json(
      ResponseHelper.success({
        message: `Product ${
          product.isActive ? "activated" : "deactivated"
        } successfully`,
        isActive: product.isActive,
      })
    );
  } catch (error) {
    logger.error("Toggle product status error:", error);
    return res
      .status(500)
      .json(
        ResponseHelper.error(
          "Failed to toggle product status",
          "TOGGLE_PRODUCT_STATUS_ERROR"
        )
      );
  }
};

/**
 * Search products (fallback to database if MeiliSearch disabled)
 */
export const searchProducts = async (req: Request, res: Response) => {
  try {
    const {
      q = "",
      page = "1",
      limit = "20",
      categorySlug,
      colorSlug,
      capacitySlug,
      isActive = "true",
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    const where: any = {
      isDeleted: false,
      isActive: isActive === "true",
    };

    if (q) {
      where[Op.or] = [
        sequelizeWhere(
          sequelize.fn("unaccent", col("Product.name")),
          { [Op.iLike]: sequelize.fn("unaccent", `%${q}%`) as any }
        ),
        { slug: { [Op.iLike]: `%${q}%` } },
      ];
    }

    // Category filtering
    const categoryWhere: any = {};
    if (categorySlug) {
      categoryWhere.slug = categorySlug;
    }

    // Color filtering
    const colorWhere: any = {};
    if (colorSlug) {
      colorWhere.slug = colorSlug;
    }

    // Capacity filtering
    const capacityWhere: any = {};
    if (capacitySlug) {
      capacityWhere.slug = capacitySlug;
    }

    const { count: totalCount, rows: products } = await Product.findAndCountAll(
      {
        where,
        include: [
          {
            model: Capacity,
            as: "capacity",
            where:
              Object.keys(capacityWhere).length > 0 ? capacityWhere : undefined,
            attributes: ["id", "name", "slug", "volumeMl"],
          },
          {
            model: ProductCategory,
            as: "productCategories",
            include: [
              {
                model: Category,
                as: "category",
                attributes: ["id", "name", "slug"],
              },
            ],
          },
          {
            model: ProductColor,
            as: "productColors",
            include: [
              {
                model: Color,
                as: "color",
                where:
                  Object.keys(colorWhere).length > 0 ? colorWhere : undefined,
                attributes: ["id", "name", "slug", "hexCode"],
              },
            ],
          },
          {
            model: ProductImage,
            as: "productImages",
            attributes: ["id", "url", "altText"],
            order: [["order", "ASC"]],
            limit: 1, // Only get the first image for search results
          },
        ],
        order: [
          ["name", "ASC"], // Sort by relevance (name match first)
        ],
        offset,
        limit: limitNum,
        distinct: true,
      }
    );

    const totalPages = Math.ceil(totalCount / limitNum);

    return res.status(200).json(
      ResponseHelper.paginated(products, {
        current_page: pageNum,
        per_page: limitNum,
        total_pages: totalPages,
        total_items: totalCount,
        has_next: pageNum < totalPages,
        has_prev: pageNum > 1,
      })
    );
  } catch (error) {
    logger.error("Search products error:", error);
    return res
      .status(500)
      .json(
        ResponseHelper.error(
          "Failed to search products",
          "SEARCH_PRODUCTS_ERROR"
        )
      );
  }
};

/**
 * Get low stock products
 */
export const getLowStockProducts = async (req: Request, res: Response) => {
  try {
    const { threshold = "1", page = "1", limit = "20" } = req.query;

    const thresholdNum = parseInt(threshold as string);
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    const { count: totalCount, rows: products } = await Product.findAndCountAll(
      {
        where: {
          isDeleted: false,
          isActive: true,
          stockQuantity: { [Op.lte]: thresholdNum },
        },
        include: [
          {
            model: Capacity,
            as: "capacity",
            attributes: ["id", "name", "slug", "volumeMl"],
          },
          {
            model: ProductCategory,
            as: "productCategories",
            include: [
              {
                model: Category,
                as: "category",
                attributes: ["id", "name", "slug"],
              },
            ],
          },
          {
            model: ProductColor,
            as: "productColors",
            include: [
              {
                model: Color,
                as: "color",
                attributes: ["id", "name", "slug", "hexCode"],
              },
            ],
          },
          {
            model: ProductImage,
            as: "productImages",
            attributes: ["id", "url", "altText"],
            order: [["order", "ASC"]],
            limit: 1,
          },
        ],
        order: [["stockQuantity", "ASC"]], // Show lowest stock first
        offset,
        limit: limitNum,
        distinct: true,
      }
    );

    const totalPages = Math.ceil(totalCount / limitNum);

    return res.status(200).json(
      ResponseHelper.paginated(products, {
        current_page: pageNum,
        per_page: limitNum,
        total_pages: totalPages,
        total_items: totalCount,
        has_next: pageNum < totalPages,
        has_prev: pageNum > 1,
      })
    );
  } catch (error) {
    logger.error("Get low stock products error:", error);
    return res
      .status(500)
      .json(
        ResponseHelper.error(
          "Failed to retrieve low stock products",
          "GET_LOW_STOCK_PRODUCTS_ERROR"
        )
      );
  }
};

/**
 * Get public products for frontend
 */
export const getPublicProducts = async (req: Request, res: Response) => {
  try {
    const {
      page = "1",
      limit = "20",
      search = "",
      category,
      categorySlug,
      color,
      colorSlug,
      capacity,
      capacitySlug,
      minCapacity,
      maxCapacity,
      isFeatured = "all",
      locale,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;
    const requestedLocale = normalizeLocale(locale as string | undefined);
    const normalizedSortBy = normalizeSortField(
      sortBy,
      PUBLIC_SORT_FIELDS,
      "createdAt"
    );
    const normalizedSortOrder = normalizeSortOrder(sortOrder, "desc");

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    const where: any = {
      isActive: true,
      isDeleted: false,
      stockQuantity: { [Op.gt]: 0 }, // Only show products in stock
    };

    if (search) {
      where[Op.or] = buildLocalizedSearchConditions(search as string);
    }

    if (isFeatured !== "all") {
      where.isFeatured = isFeatured === "true";
    }

    // Category filtering - support both 'category' and 'categorySlug' parameters
    const categoryWhere: any = {};
    const categorySlugValue = category || categorySlug;
    if (categorySlugValue) {
      categoryWhere.slug = categorySlugValue;
    }

    // Color filtering - support both 'color' and 'colorSlug' parameters
    const colorWhere: any = {};
    const colorSlugValue = color || colorSlug;
    if (colorSlugValue) {
      colorWhere.slug = colorSlugValue;
    }

    // Capacity filtering - support both 'capacity' and 'capacitySlug' parameters, or min/max volume
    const capacityWhere: any = {};
    const capacitySlugValue = capacity || capacitySlug;
    if (capacitySlugValue) {
      capacityWhere.slug = capacitySlugValue;
    } else if (minCapacity || maxCapacity) {
      // Filter by volume range
      if (minCapacity && maxCapacity) {
        capacityWhere.volumeMl = {
          [Op.between]: [
            parseInt(minCapacity as string),
            parseInt(maxCapacity as string),
          ],
        };
      } else if (minCapacity) {
        capacityWhere.volumeMl = { [Op.gte]: parseInt(minCapacity as string) };
      } else if (maxCapacity) {
        capacityWhere.volumeMl = { [Op.lte]: parseInt(maxCapacity as string) };
      }
    }

    // Build common include configuration for both count and findAll
    const countInclude = [
      {
        model: Capacity,
        as: "capacity",
        where:
          Object.keys(capacityWhere).length > 0 ? capacityWhere : undefined,
        required: Object.keys(capacityWhere).length > 0,
        attributes: [],
      },
      {
        model: ProductCategory,
        as: "productCategories",
        attributes: [],
        ...(Object.keys(categoryWhere).length > 0 && {
          required: true,
          include: [
            {
              model: Category,
              as: "category",
              where: categoryWhere,
              required: true,
              attributes: [],
            },
          ],
        }),
      },
      {
        model: ProductColor,
        as: "productColors",
        attributes: [],
        ...(Object.keys(colorWhere).length > 0 && {
          required: true,
          include: [
            {
              model: Color,
              as: "color",
              where: colorWhere,
              required: true,
              attributes: [],
            },
          ],
        }),
      },
    ];

    // translations join no longer needed for search filtering —
    // correlated subquery in buildLocalizedSearchConditions handles it.

    const totalCount = await Product.count({
      where,
      include: countInclude,
      distinct: true,
      col: "id",
    });

    const sortOrderClauses: any[] = [
      ...(normalizedSortBy === "isFeatured" && isFeatured !== "true"
        ? [["isFeatured", normalizedSortOrder.toUpperCase()] as any]
        : isFeatured === "true"
        ? [["isFeatured", "DESC"] as any]
        : []),
      ...(normalizedSortBy === "isFeatured"
        ? [["createdAt", "DESC"] as any]
        : [[normalizedSortBy, normalizedSortOrder.toUpperCase()] as any]),
    ];

    // Single query with GROUP BY to deduplicate JOINed rows
    const idRows = await Product.findAll({
      where,
      include: countInclude,
      attributes: ["id"],
      order: sortOrderClauses,
      group: ["Product.id"],
      offset,
      limit: limitNum,
      raw: true,
      subQuery: false,
    });

    const paginatedProductIds = (idRows as Array<{ id: string }>).map(
      (row) => row.id
    );

    const productsUnsorted = await Product.findAll({
      where: {
        id: { [Op.in]: paginatedProductIds },
      },
      include: [
        {
          model: Capacity,
          as: "capacity",
          where:
            Object.keys(capacityWhere).length > 0 ? capacityWhere : undefined,
          required: Object.keys(capacityWhere).length > 0,
          attributes: ["id", "name", "slug", "volumeMl"],
        },
        {
          model: ProductCategory,
          as: "productCategories",
          include: [
            {
              model: Category,
              as: "category",
              where:
                Object.keys(categoryWhere).length > 0
                  ? categoryWhere
                  : undefined,
              required: Object.keys(categoryWhere).length > 0,
              attributes: ["id", "name", "slug"],
            },
          ],
        },
        {
          model: ProductColor,
          as: "productColors",
          include: [
            {
              model: Color,
              as: "color",
              where:
                Object.keys(colorWhere).length > 0 ? colorWhere : undefined,
              required: Object.keys(colorWhere).length > 0,
              attributes: ["id", "name", "slug", "hexCode"],
            },
          ],
        },
        {
          model: ProductImage,
          as: "productImages",
          attributes: ["id", "url", "altText", "order"],
        },
        {
          model: ProductTranslation,
          as: "translations",
          attributes: [
            "locale",
            "name",
            "description",
            "metaTitle",
            "metaDescription",
          ],
          required: false,
          ...(search
            ? {
                where: {
                  locale: { [Op.in]: getSearchableLocales(requestedLocale) },
                },
              }
            : {}),
        },
      ],
      attributes: [
        "id",
        "name",
        "slug",
        "description",
        "stockQuantity",
        "unitPrice",
        "productUrl",
        "isVip",
        "isFeatured",
        "createdAt",
      ],
      order: [[{ model: ProductImage, as: "productImages" }, "order", "ASC"]],
    });

    const productsMap = new Map(productsUnsorted.map((product) => [product.id, product]));
    const products = paginatedProductIds
      .map((id) => productsMap.get(id))
      .filter(Boolean) as typeof productsUnsorted;

    const totalPages = Math.ceil(totalCount / limitNum);

    const localizedProducts = products.map((product) =>
      applyLocaleToProduct(product, requestedLocale)
    );

    return res.status(200).json(
      ResponseHelper.paginated(localizedProducts, {
        current_page: pageNum,
        per_page: limitNum,
        total_pages: totalPages,
        total_items: totalCount,
        has_next: pageNum < totalPages,
        has_prev: pageNum > 1,
      })
    );
  } catch (error) {
    logger.error("Get public products error:", error);
    return res
      .status(500)
      .json(
        ResponseHelper.error(
          "Failed to retrieve public products",
          "GET_PUBLIC_PRODUCTS_ERROR"
        )
      );
  }
};

/**
 * Get public product by ID or slug
 */
export const getPublicProductById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const locale = normalizeLocale(req.query.locale as string | undefined);

    // Check if the parameter is a valid UUID
    const isUUID =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        id
      );

    // Build where condition based on whether it's UUID or slug
    const whereCondition = isUUID
      ? { id, isActive: true, isDeleted: false }
      : { slug: id, isActive: true, isDeleted: false };

    let product = await Product.findOne({
      where: whereCondition,
      include: [
        {
          model: Capacity,
          as: "capacity",
          attributes: ["id", "name", "slug", "volumeMl"],
        },
        {
          model: ProductCategory,
          as: "productCategories",
          include: [
            {
              model: Category,
              as: "category",
              attributes: ["id", "name", "slug"],
            },
          ],
        },
        {
          model: ProductColor,
          as: "productColors",
          include: [
            {
              model: Color,
              as: "color",
              attributes: ["id", "name", "slug", "hexCode"],
            },
          ],
        },
        {
          model: ProductImage,
          as: "productImages",
          attributes: ["id", "url", "altText", "order"],
          order: [["order", "ASC"]],
        },
        {
          model: ProductTranslation,
          as: "translations",
          attributes: [
            "locale",
            "name",
            "description",
            "metaTitle",
            "metaDescription",
          ],
          required: false,
        },
      ],
      attributes: [
        "id",
        "name",
        "slug",
        "description",
        "stockQuantity",
        "unitPrice",
        "productUrl",
        "isVip",
        "isFeatured",
        "createdAt",
      ],
    });

    if (!product) {
      return res
        .status(404)
        .json(ResponseHelper.error("Product not found", "PRODUCT_NOT_FOUND"));
    }

    return res
      .status(200)
      .json(ResponseHelper.success(applyLocaleToProduct(product, locale)));
  } catch (error) {
    logger.error("Get public product error:", error);
    return res
      .status(500)
      .json(
        ResponseHelper.error(
          "Failed to retrieve product",
          "GET_PUBLIC_PRODUCT_ERROR"
        )
      );
  }
};

/**
 * Get featured products statistics
 */
export const getFeaturedProductsStats = async (req: Request, res: Response) => {
  try {
    const [totalProducts, featuredProducts, activeProducts, activeFeaturedProducts] =
      await Promise.all([
        Product.count({ where: { isDeleted: false } }),
        Product.count({ where: { isFeatured: true, isDeleted: false } }),
        Product.count({ where: { isActive: true, isDeleted: false } }),
        Product.count({ where: { isFeatured: true, isActive: true, isDeleted: false } }),
      ]);

    const featuredPercentage = totalProducts > 0
      ? Math.round((featuredProducts / totalProducts) * 1000) / 10
      : 0;

    const activeFeaturedPercentage = activeProducts > 0
      ? Math.round((activeFeaturedProducts / activeProducts) * 1000) / 10
      : 0;

    const stats = {
      total: {
        allProducts: totalProducts,
        activeProducts: activeProducts,
        featuredProducts: featuredProducts,
        activeFeaturedProducts: activeFeaturedProducts,
      },
      percentages: {
        featuredOfTotal: featuredPercentage,
        featuredOfActive: activeFeaturedPercentage,
      },
      breakdown: {
        notFeatured: totalProducts - featuredProducts,
        inactiveFeatured: featuredProducts - activeFeaturedProducts,
      },
    };

    return res.status(200).json(ResponseHelper.success(stats));
  } catch (error) {
    logger.error("Get featured products stats error:", error);
    return res
      .status(500)
      .json(
        ResponseHelper.error(
          "Failed to retrieve featured products statistics",
          "GET_FEATURED_STATS_ERROR"
        )
      );
  }
};

/**
 * Reorder product images
 */
export const reorderProductImages = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res
        .status(401)
        .json(ResponseHelper.error("Authentication required", "UNAUTHORIZED"));
    }

    const { id } = req.params;

    const validationResult = reorderImagesSchema.safeParse(req.body);
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

    const { imageOrders } = validationResult.data;

    // Check if product exists
    const product = await Product.findByPk(id);
    if (!product || product.isDeleted) {
      return res
        .status(404)
        .json(ResponseHelper.error("Product not found", "PRODUCT_NOT_FOUND"));
    }

    // Update image orders in transaction
    await sequelize.transaction(async (t) => {
      for (const imageOrder of imageOrders) {
        await ProductImage.update(
          { order: imageOrder.order },
          {
            where: {
              id: imageOrder.id,
              productId: id,
            },
            transaction: t,
          }
        );
      }
    });

    // Fetch updated product with reordered images
    const updatedProduct = await Product.findByPk(id, {
      include: [
        {
          model: ProductImage,
          as: "productImages",
          attributes: ["id", "url", "altText", "order"],
          order: [["order", "ASC"]],
        },
      ],
    });

    return res.status(200).json(
      ResponseHelper.success({
        message: "Product images reordered successfully",
        product: updatedProduct,
      })
    );
  } catch (error) {
    logger.error("Reorder product images error:", error);
    return res
      .status(500)
      .json(
        ResponseHelper.error(
          "Failed to reorder product images",
          "REORDER_PRODUCT_IMAGES_ERROR"
        )
      );
  }
};
