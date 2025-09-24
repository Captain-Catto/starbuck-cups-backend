/**
 * Products management controller
 * Handles CRUD operations for product entities with soft delete and stock management
 */
import { Request, Response } from "express";
import { PrismaClient } from "../generated/prisma";
import { ResponseHelper } from "../types/api";
import { z } from "zod";
import { s3Service } from "../services/s3.service";
import { productImageService } from "../services/product-image.service";
import {
  meilisearchService,
  SearchableProduct,
} from "../services/meilisearch.service";
import { generateVietnameseSlug } from "../utils/vietnamese-slug";

const prisma = new PrismaClient();

// Helper function to generate SEO-friendly slug with Vietnamese support
const generateProductSlug = (
  name: string,
  colorName: string,
  capacityName: string
): string => {
  const combined = `${name} ${colorName} ${capacityName}`;
  return generateVietnameseSlug(combined);
};

// Helper function to transform product for Meilisearch
const transformProductForSearch = async (
  product: any
): Promise<SearchableProduct> => {
  // Get product images
  const images =
    product.productImages && product.productImages.length > 0
      ? product.productImages.map((img: any) => img.url)
      : [];

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description || "",
    stockQuantity: product.stockQuantity,
    isActive: product.isActive,
    categories: product.productCategories.map((pc: any) => ({
      id: pc.category.id,
      name: pc.category.name,
      slug: pc.category.slug,
    })),
    colors: product.productColors.map((pc: any) => ({
      id: pc.color.id,
      name: pc.color.name,
      slug: pc.color.slug,
      hexCode: pc.color.hexCode,
    })),
    capacity: {
      id: product.capacity.id,
      name: product.capacity.name,
      slug: product.capacity.slug,
      volumeMl: product.capacity.volumeMl,
    },
    images,
    productUrl: product.productUrl || "",
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  };
};

// Helper function to build Meilisearch filters from query parameters
const buildMeilisearchFilters = (params: {
  isActive?: boolean;
  isDeleted?: boolean;
  categorySlug?: string;
  colorSlug?: string;
  capacityMin?: number;
  capacityMax?: number;
  excludeProductId?: string;
  lowStock?: boolean;
  lowStockThreshold?: number;
}): string[] => {
  const filters: string[] = [];

  // Always filter active products for Meilisearch (deleted products are already removed from index)
  if (params.isActive !== undefined) {
    filters.push(`isActive = ${params.isActive}`);
  }

  if (params.categorySlug) {
    filters.push(`categories.slug = "${params.categorySlug}"`);
  }

  if (params.colorSlug) {
    filters.push(`colors.slug = "${params.colorSlug}"`);
  }

  // NOTE: Capacity range filtering is not supported in Meilisearch (capacity.volumeMl not filterable)
  // This filtering will be applied in PostgreSQL fallback

  if (params.excludeProductId) {
    filters.push(`id != "${params.excludeProductId}"`);
  }

  if (params.lowStock && params.lowStockThreshold) {
    filters.push(`stockQuantity <= ${params.lowStockThreshold}`);
  }

  return filters;
};

// Helper function to build Meilisearch sort from query parameters
const buildMeilisearchSort = (sortBy: string, sortOrder: string): string[] => {
  const sortField =
    sortBy === "createdAt"
      ? "createdAt"
      : sortBy === "updatedAt"
        ? "updatedAt"
        : sortBy === "name"
          ? "name"
          : sortBy === "stockQuantity"
            ? "stockQuantity"
            : "createdAt";

  return [`${sortField}:${sortOrder === "desc" ? "desc" : "asc"}`];
};

// Helper function to search products using Meilisearch
const searchProductsWithMeilisearch = async (params: {
  search?: string;
  page: number;
  limit: number;
  isActive?: boolean;
  categorySlug?: string;
  colorSlug?: string;
  capacityMin?: number;
  capacityMax?: number;
  lowStock?: boolean;
  lowStockThreshold?: number;
  sortBy: string;
  sortOrder: string;
}) => {
  const { search = "", page, limit, sortBy, sortOrder } = params;

  const offset = (page - 1) * limit;
  const filters = buildMeilisearchFilters(params);
  const sort = buildMeilisearchSort(sortBy, sortOrder);

  const facets = [
    "categories.name",
    "colors.name",
    "capacity.name",
    "isActive",
  ];

  const searchResult = await meilisearchService.searchProducts(search, {
    limit,
    offset,
    filters,
    sort,
    facets,
    highlightPreTag: "<mark>",
    highlightPostTag: "</mark>",
  });

  // Transform Meilisearch results to match expected format
  const transformedResults = searchResult.hits.map((hit: any) => ({
    id: hit.id,
    name: hit.name,
    slug: hit.slug,
    description: hit.description,
    stockQuantity: hit.stockQuantity,
    productUrl: hit.productUrl,
    isActive: hit.isActive,
    createdAt: hit.createdAt,
    updatedAt: hit.updatedAt,
    productImages: hit.images
      ? hit.images.map((url: string, index: number) => ({
          url,
          order: index + 1,
        }))
      : [],
    productCategories: hit.categories
      ? hit.categories.map((cat: any) => ({
          category: {
            id: cat.id,
            name: cat.name,
            slug: cat.slug,
          },
        }))
      : [],
    productColors: hit.colors
      ? hit.colors.map((color: any) => ({
          color: {
            id: color.id,
            name: color.name,
            slug: color.slug,
            hexCode: color.hexCode,
          },
        }))
      : [],
    capacity: {
      id: hit.capacity.id,
      name: hit.capacity.name,
      slug: hit.capacity.slug,
      volumeMl: hit.capacity.volumeMl,
    },
  }));

  return {
    products: transformedResults,
    total: searchResult.estimatedTotalHits,
    facets: searchResult.facetDistribution,
    processingTimeMs: searchResult.processingTimeMs,
  };
};

// Fallback function to search products using PostgreSQL
const searchProductsWithPostgreSQL = async (params: {
  search?: string;
  page: number;
  limit: number;
  isActive?: boolean;
  isDeleted?: boolean;
  categorySlug?: string;
  colorSlug?: string;
  capacityMin?: number;
  capacityMax?: number;
  lowStock?: boolean;
  lowStockThreshold?: number;
  sortBy: string;
  sortOrder: string;
}) => {
  const {
    search,
    page,
    limit,
    isActive,
    isDeleted = false,
    categorySlug,
    colorSlug,
    capacityMin,
    capacityMax,
    lowStock,
    lowStockThreshold = 10,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = params;

  const offset = (page - 1) * limit;

  // Build where clause
  const where: any = {
    isDeleted: isDeleted,
  };

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { slug: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
    ];
  }
  if (isActive !== undefined) {
    where.isActive = isActive;
  }
  if (categorySlug) {
    where.productCategories = {
      some: {
        category: { slug: categorySlug },
      },
    };
  }
  if (colorSlug) {
    where.productColors = {
      some: {
        color: { slug: colorSlug },
      },
    };
  }
  if (capacityMin !== undefined || capacityMax !== undefined) {
    const capacityFilter: any = {};
    if (capacityMin !== undefined) {
      capacityFilter.gte = capacityMin;
    }
    if (capacityMax !== undefined) {
      capacityFilter.lte = capacityMax;
    }
    where.capacity = {
      volumeMl: capacityFilter,
    };
  }
  if (lowStock) {
    where.stockQuantity = { lte: lowStockThreshold };
  }

  // Get total count and products
  const [total, products] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      skip: offset,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: {
        productCategories: {
          include: {
            category: {
              select: {
                id: true,
                name: true,
                slug: true,
                description: true,
              },
            },
          },
        },
        productColors: {
          include: {
            color: {
              select: {
                id: true,
                name: true,
                slug: true,
                hexCode: true,
              },
            },
          },
        },
        capacity: {
          select: {
            id: true,
            name: true,
            slug: true,
            volumeMl: true,
          },
        },
        productImages: {
          select: {
            id: true,
            url: true,
            order: true,
          },
          orderBy: {
            order: "asc",
          },
        },
      },
    }),
  ]);

  return {
    products,
    total,
    facets: null, // PostgreSQL doesn't provide facets
    processingTimeMs: 0,
  };
};

// Helper function to sync product to Meilisearch
const syncProductToMeilisearch = async (productId: string): Promise<void> => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        productCategories: {
          include: {
            category: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
        productColors: {
          include: {
            color: {
              select: {
                id: true,
                name: true,
                slug: true,
                hexCode: true,
              },
            },
          },
        },
        capacity: {
          select: {
            id: true,
            name: true,
            slug: true,
            volumeMl: true,
          },
        },
        productImages: {
          select: {
            url: true,
            order: true,
          },
          orderBy: {
            order: "asc",
          },
        },
      },
    });

    if (product && !product.isDeleted) {
      const searchableProduct = await transformProductForSearch(product);
      await meilisearchService.indexProducts([searchableProduct]);
      console.log(`✅ Product ${productId} synced to Meilisearch`);
    } else {
      // Product deleted or not found, remove from Meilisearch
      await meilisearchService.deleteProduct(productId);
      console.log(`🗑️ Product ${productId} removed from Meilisearch`);
    }
  } catch (error) {
    console.error(
      `❌ Failed to sync product ${productId} to Meilisearch:`,
      error
    );
    // Don't throw error to avoid breaking the main operation
  }
};

// Validation schemas
const imageWithOrderSchema = z.object({
  url: z.string().url("Invalid image URL"),
  order: z.number().int().min(0, "Order must be non-negative"),
});

const createProductSchema = z.object({
  name: z.string().min(1, "Product name is required").max(255, "Name too long"),
  slug: z.string().optional(),
  description: z.string().optional(),
  capacityId: z.string().uuid("Invalid capacity ID"),
  colorIds: z
    .array(z.string().uuid("Invalid color ID"))
    .min(1, "At least one color is required"),
  categoryIds: z
    .array(z.string().uuid("Invalid category ID"))
    .min(1, "At least one category is required"),
  stockQuantity: z
    .number()
    .int()
    .min(0, "Stock quantity cannot be negative")
    .optional(),
  productImages: z
    .array(imageWithOrderSchema)
    .min(1, "At least one image is required"),
  productUrl: z
    .string()
    .optional()
    .refine((url) => !url || url === "" || /^https?:\/\//.test(url), {
      message: "Invalid product URL",
    }),
});

const updateProductSchema = z.object({
  name: z
    .string()
    .min(1, "Product name is required")
    .max(255, "Name too long")
    .optional(),
  slug: z.string().optional(),
  description: z.string().optional(),
  capacityId: z.string().uuid("Invalid capacity ID").optional(),
  colorIds: z.array(z.string().uuid("Invalid color ID")).optional(),
  categoryIds: z.array(z.string().uuid("Invalid category ID")).optional(),
  stockQuantity: z
    .number()
    .int()
    .min(0, "Stock quantity cannot be negative")
    .optional(),
  // For updates, productImages can be either array of strings (for reordering) or array of objects (for creation)
  productImages: z
    .union([
      z.array(z.string().url("Invalid image URL")), // For reordering - array of URL strings
      z.array(imageWithOrderSchema), // For creation with file uploads - array of objects
    ])
    .optional(),
  productUrl: z
    .union([z.string().url("Invalid product URL"), z.literal("")])
    .optional(),
  isActive: z.boolean().optional(),
});

const stockUpdateSchema = z.object({
  quantity: z.number().int(),
  operation: z.enum(["set", "add", "subtract"]),
  reason: z.string().optional(),
});

const querySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().min(1)).optional(),
  limit: z
    .string()
    .transform(Number)
    .pipe(z.number().min(1).max(100))
    .optional(),
  search: z.string().optional(),
  isActive: z
    .string()
    .transform((val) => val === "true")
    .optional(),
  isDeleted: z
    .string()
    .transform((val) => val === "true")
    .optional(),
  categoryIds: z
    .string()
    .optional()
    .transform((val) => (val ? val.split(",") : undefined)),
  colorIds: z
    .string()
    .optional()
    .transform((val) => (val ? val.split(",") : undefined)),
  capacityId: z.string().uuid().optional(),
  categorySlug: z.string().optional(),
  colorSlug: z.string().optional(),
  capacitySlug: z.string().optional(),
  capacityMin: z.string().transform(Number).pipe(z.number().min(0)).optional(),
  capacityMax: z.string().transform(Number).pipe(z.number().min(0)).optional(),
  lowStock: z
    .string()
    .transform((val) => val === "true")
    .optional(),
  lowStockThreshold: z
    .string()
    .transform(Number)
    .pipe(z.number().min(0))
    .optional(),
  sortBy: z
    .enum([
      "name",
      "stockQuantity",
      "createdAt",
      "updatedAt",
      "price-asc",
      "price-desc",
    ])
    .optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
});

// Specific schema for public product queries
const publicQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().min(1)).optional(),
  limit: z
    .string()
    .transform(Number)
    .pipe(z.number().min(1).max(100))
    .optional(),
  search: z.string().optional(),
  category: z.string().optional(), // Only use 'category' parameter for slug or UUID
  categoryIds: z
    .string()
    .optional()
    .transform((val) => (val ? val.split(",") : undefined)),
  color: z.string().optional(), // Color slug
  capacityMin: z.string().transform(Number).pipe(z.number().min(0)).optional(),
  capacityMax: z.string().transform(Number).pipe(z.number().min(0)).optional(),
  excludeProductId: z.string().uuid().optional(), // Exclude a specific product (for related products)
  sortBy: z.enum(["name", "createdAt", "updatedAt"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
  inStock: z
    .string()
    .transform((val) => val === "true")
    .optional(),
});

/**
 * Get all products with pagination and filters
 */
export const getProducts = async (req: Request, res: Response) => {
  try {
    // Validate query parameters
    const queryValidation = querySchema.safeParse(req.query);
    if (!queryValidation.success) {
      return res
        .status(400)
        .json(
          ResponseHelper.error(
            "Invalid query parameters",
            "VALIDATION_ERROR",
            queryValidation.error.issues
          )
        );
    }

    const {
      page = 1,
      limit = 20,
      search,
      isActive,
      isDeleted = false,
      categoryIds,
      colorIds,
      capacityId,
      categorySlug,
      colorSlug,
      capacitySlug,
      capacityMin,
      capacityMax,
      lowStock,
      lowStockThreshold = 10,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = queryValidation.data;

    // Handle ID to slug conversion for Meilisearch filters
    let resolvedCategorySlug = categorySlug;
    let resolvedColorSlug = colorSlug;
    let resolvedCapacitySlug = capacitySlug;

    // Convert category ID to slug for Meilisearch
    if (categoryIds && categoryIds.length > 0 && !categorySlug) {
      const category = await prisma.category.findUnique({
        where: { id: categoryIds[0], isActive: true },
        select: { slug: true },
      });
      if (category) {
        resolvedCategorySlug = category.slug;
      }
    }

    // Convert color ID to slug for Meilisearch
    if (colorIds && colorIds.length > 0 && !colorSlug) {
      const color = await prisma.color.findUnique({
        where: { id: colorIds[0], isActive: true },
        select: { slug: true },
      });
      if (color) {
        resolvedColorSlug = color.slug;
      }
    }

    // Convert capacity ID to slug for Meilisearch and resolve range for PostgreSQL
    let resolvedCapacityMin = capacityMin;
    let resolvedCapacityMax = capacityMax;

    if (capacityId && !capacitySlug) {
      const capacity = await prisma.capacity.findUnique({
        where: { id: capacityId, isActive: true },
        select: { slug: true, volumeMl: true },
      });
      if (capacity) {
        resolvedCapacitySlug = capacity.slug;
        // For exact capacity match, set min and max to the same value
        resolvedCapacityMin = capacity.volumeMl;
        resolvedCapacityMax = capacity.volumeMl;
      }
    } else if (capacitySlug && !capacityMin && !capacityMax) {
      // Convert capacitySlug to range for filtering
      const capacity = await prisma.capacity.findUnique({
        where: { slug: capacitySlug, isActive: true },
        select: { volumeMl: true },
      });
      if (capacity) {
        // For exact capacity match, set min and max to the same value
        resolvedCapacityMin = capacity.volumeMl;
        resolvedCapacityMax = capacity.volumeMl;
      }
    }

    // Try Meilisearch first, fallback to PostgreSQL
    let searchResult;
    let usedMeilisearch = false;

    try {
      // If capacity range filtering is requested, use PostgreSQL fallback
      // because Meilisearch doesn't support capacity.volumeMl filtering
      if (
        resolvedCapacityMin !== undefined ||
        resolvedCapacityMax !== undefined
      ) {
        console.log("🔄 Using PostgreSQL for capacity range filtering");
        throw new Error(
          "Using PostgreSQL fallback for capacity range filtering"
        );
      }

      // Use Meilisearch for faster search
      console.log("🔍 Using Meilisearch for product search");
      searchResult = await searchProductsWithMeilisearch({
        search,
        page,
        limit,
        isActive,
        categorySlug: resolvedCategorySlug,
        colorSlug: resolvedColorSlug,
        capacityMin: resolvedCapacityMin,
        capacityMax: resolvedCapacityMax,
        lowStock,
        lowStockThreshold,
        sortBy,
        sortOrder,
      });
      usedMeilisearch = true;
      console.log(
        `✅ Meilisearch returned ${searchResult.products.length} products in ${searchResult.processingTimeMs}ms`
      );
    } catch (meilisearchError) {
      console.warn(
        "⚠️ Meilisearch failed, falling back to PostgreSQL:",
        meilisearchError
      );

      // Fallback to PostgreSQL
      searchResult = await searchProductsWithPostgreSQL({
        search,
        page,
        limit,
        isActive,
        isDeleted,
        categorySlug: resolvedCategorySlug,
        colorSlug: resolvedColorSlug,
        capacityMin: resolvedCapacityMin,
        capacityMax: resolvedCapacityMax,
        lowStock,
        lowStockThreshold,
        sortBy,
        sortOrder,
      });
      console.log(
        `✅ PostgreSQL fallback returned ${searchResult.products.length} products`
      );
    }

    const { products, total, facets, processingTimeMs } = searchResult;

    const totalPages = Math.ceil(total / limit);

    // Add low stock alerts and merge images
    const productsWithAlerts = products.map((product) => {
      // Merge productImages into images array, fallback to existing JSON images
      const images =
        product.productImages && product.productImages.length > 0
          ? product.productImages.map((img: any) => img.url)
          : [];

      return {
        ...product,
        images, // Override with merged images
        isLowStock: product.stockQuantity <= lowStockThreshold,
        stockStatus:
          product.stockQuantity === 0
            ? "out_of_stock"
            : product.stockQuantity <= lowStockThreshold
              ? "low_stock"
              : "in_stock",
      };
    });

    // Enhanced response with search metadata
    const responseData = ResponseHelper.paginated(productsWithAlerts, {
      current_page: page,
      per_page: limit,
      total_pages: totalPages,
      total_items: total,
      has_next: page < totalPages,
      has_prev: page > 1,
    });

    // Add search metadata when using Meilisearch
    if (usedMeilisearch) {
      (responseData as any).search_metadata = {
        engine: "meilisearch",
        processing_time_ms: processingTimeMs,
        facets: facets || {},
        query: search || "",
      };
    } else {
      (responseData as any).search_metadata = {
        engine: "postgresql",
        processing_time_ms: 0,
        query: search || "",
      };
    }

    return res.status(200).json(responseData);
  } catch (error) {
    console.error("Get products error:", error);
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
 * Get product by ID
 */
export const getProductById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { includeDeleted = "false" } = req.query;

    const where: any = { id };
    if (includeDeleted !== "true") {
      where.isDeleted = false;
    }

    const product = await prisma.product.findUnique({
      where,
      include: {
        capacity: true,
        productColors: {
          include: {
            color: true,
          },
        },
        productCategories: {
          include: {
            category: {
              include: {
                parent: {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                  },
                },
              },
            },
          },
        },
        productImages: {
          select: {
            url: true,
            order: true,
          },
          orderBy: {
            order: "asc",
          },
        },
        deletedByAdmin: {
          select: {
            username: true,
            email: true,
          },
        },
        _count: {
          select: {
            orderItems: true,
          },
        },
      },
    });

    if (!product) {
      return res
        .status(404)
        .json(ResponseHelper.error("Product not found", "PRODUCT_NOT_FOUND"));
    }

    // Merge productImages into images array, fallback to existing JSON images
    const images =
      product.productImages && product.productImages.length > 0
        ? product.productImages.map((img) => img.url)
        : [];

    // Add stock status
    const productWithStatus = {
      ...product,
      images, // Override with merged images
      isLowStock: product.stockQuantity <= 1,
      stockStatus:
        product.stockQuantity === 0
          ? "out_of_stock"
          : product.stockQuantity <= 1
            ? "low_stock"
            : "in_stock",
    };

    return res.status(200).json(ResponseHelper.success(productWithStatus));
  } catch (error) {
    console.error("Get product error:", error);
    return res
      .status(500)
      .json(
        ResponseHelper.error("Failed to retrieve product", "GET_PRODUCT_ERROR")
      );
  }
};

/**
 * Create new product with file upload and transaction rollback
 */
export const createProduct = async (req: Request, res: Response) => {
  let uploadedKeys: string[] = [];

  try {
    console.log("[DEBUG] createProduct - Request received");
    console.log(
      "[DEBUG] createProduct - req.body:",
      JSON.stringify(req.body, null, 2)
    );
    console.log("[DEBUG] createProduct - req.files:", req.files);

    if (!req.user) {
      return res
        .status(401)
        .json(ResponseHelper.error("Authentication required", "UNAUTHORIZED"));
    }

    // Parse form data for validation (FormData sends everything as strings)
    const formBody = { ...req.body };

    // Convert string numbers to actual numbers
    if (formBody.stockQuantity !== undefined) {
      const stockNum = parseInt(formBody.stockQuantity);
      formBody.stockQuantity = isNaN(stockNum) ? 0 : stockNum;
    }

    // Handle empty productUrl
    if (formBody.productUrl === "") {
      delete formBody.productUrl;
    }

    // Parse images field if it's a JSON string (from frontend)
    if (formBody.images && typeof formBody.images === "string") {
      try {
        formBody.images = JSON.parse(formBody.images);
      } catch (error) {
        console.error("Error parsing images JSON:", error);
        formBody.images = [];
      }
    }

    // Validate input with images field
    const validationResult = createProductSchema.safeParse(formBody);

    console.log("[DEBUG] createProduct - validation result:", validationResult);

    if (!validationResult.success) {
      console.log(
        "[DEBUG] createProduct - validation errors:",
        validationResult.error.issues
      );
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
      colorIds,
      categoryIds,
      stockQuantity = 0,
      productUrl,
      productImages: payloadImages = [],
    } = validationResult.data;

    // Get uploaded files (for multipart/form-data requests)
    const uploadedFiles = req.files as Express.Multer.File[] | undefined;
    let imageData: { url: string; order: number }[] = [];

    // Step 1: Handle images (either from uploads or JSON payload)
    if (uploadedFiles && uploadedFiles.length > 0) {
      // Legacy file upload flow
      try {
        // Validate image files
        for (const file of uploadedFiles) {
          if (!s3Service.isValidImageType(file.originalname)) {
            return res
              .status(400)
              .json(
                ResponseHelper.error(
                  `Invalid file type: ${file.originalname}. Only images are allowed.`,
                  "INVALID_FILE_TYPE"
                )
              );
          }
        }

        const files = uploadedFiles.map((file) => ({
          buffer: file.buffer,
          filename: file.originalname,
        }));

        const uploadResults = await s3Service.uploadFiles(files, "products");
        uploadedKeys = uploadResults.map((result) => result.key);

        // Create imageData with order (for legacy file upload)
        imageData = uploadResults.map((result, index) => ({
          url: result.url,
          order: index,
        }));
      } catch (uploadError) {
        console.error("File upload error:", uploadError);
        return res
          .status(500)
          .json(
            ResponseHelper.error("Failed to upload images", "UPLOAD_ERROR")
          );
      }
    } else if (payloadImages && payloadImages.length > 0) {
      // New flow: images with order from JSON payload
      console.log("[DEBUG] Using JSON payload images:", payloadImages);
      imageData = payloadImages;
    } else {
      // No images provided - this should be caught by validation but add extra check
      return res
        .status(400)
        .json(
          ResponseHelper.error(
            "At least one image is required to create a product",
            "NO_IMAGES_PROVIDED"
          )
        );
    }

    // Step 2: Create product in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Verify references exist and are active
      const [capacity, colors, categories] = await Promise.all([
        tx.capacity.findUnique({ where: { id: capacityId, isActive: true } }),
        tx.color.findMany({ where: { id: { in: colorIds }, isActive: true } }),
        tx.category.findMany({
          where: { id: { in: categoryIds }, isActive: true },
        }),
      ]);

      if (!capacity) {
        throw new Error("Capacity not found or inactive");
      }
      if (colors.length !== colorIds.length) {
        throw new Error("One or more colors not found or inactive");
      }
      if (categories.length !== categoryIds.length) {
        throw new Error("One or more categories not found or inactive");
      }

      // Generate slug if not provided
      let finalSlug =
        slug || generateProductSlug(name, colors[0].name, capacity.name);

      // Check for duplicate slug and resolve conflicts
      let slugCounter = 0;
      let originalSlug = finalSlug;

      while (await tx.product.findUnique({ where: { slug: finalSlug } })) {
        slugCounter++;
        finalSlug = `${originalSlug}-${slugCounter}`;
      }

      // Create product (images now stored in ProductImage table only)
      const product = await tx.product.create({
        data: {
          name: name.trim(),
          slug: finalSlug,
          description: description?.trim(),
          capacityId,
          stockQuantity,
          productUrl,
        },
        include: {
          capacity: true,
          productCategories: {
            include: {
              category: true,
            },
          },
          productColors: {
            include: {
              color: true,
            },
          },
          productImages: {
            select: {
              url: true,
              order: true,
            },
            orderBy: {
              order: "asc",
            },
          },
          _count: {
            select: {
              orderItems: true,
            },
          },
        },
      });

      // Create ProductCategory relationships
      const productCategoryData = categoryIds.map((categoryId) => ({
        productId: product.id,
        categoryId,
      }));
      await tx.productCategory.createMany({
        data: productCategoryData,
      });

      // Create ProductColor relationships
      const productColorData = colorIds.map((colorId) => ({
        productId: product.id,
        colorId,
      }));
      await tx.productColor.createMany({
        data: productColorData,
      });

      // Create ProductImage records if images were provided
      console.log("[DEBUG] imageData before ProductImage creation:", imageData);
      if (imageData.length > 0) {
        const sortedImages = imageData.sort((a, b) => a.order - b.order);
        console.log("[DEBUG] sortedImages:", sortedImages);

        const productImageData = sortedImages.map((img) => ({
          productId: product.id,
          url: img.url,
          order: img.order,
        }));
        console.log("[DEBUG] productImageData to create:", productImageData);

        await tx.productImage.createMany({
          data: productImageData,
        });
        console.log("[DEBUG] ProductImage records created successfully");
      } else {
        console.log("[DEBUG] No imageData to create ProductImage records");
      }

      return product;
    });

    // Step 3: Success - merge productImages and return product with status
    const mergedImages =
      result.productImages && result.productImages.length > 0
        ? result.productImages.map((img) => img.url)
        : Array.isArray(result.productImages)
          ? result.productImages
          : [];

    const productWithStatus = {
      ...result,
      images: mergedImages, // Override with merged images
      isLowStock: result.stockQuantity <= 1,
      stockStatus:
        result.stockQuantity === 0
          ? "out_of_stock"
          : result.stockQuantity <= 1
            ? "low_stock"
            : "in_stock",
    };

    // Sync to Meilisearch in background
    syncProductToMeilisearch(result.id).catch(console.error);

    return res.status(201).json(ResponseHelper.success(productWithStatus));
  } catch (error) {
    console.error("Create product error:", error);

    // Step 4: Cleanup uploaded images if product creation failed
    if (uploadedKeys.length > 0) {
      try {
        await s3Service.deleteFiles(uploadedKeys);
        console.log("Cleaned up uploaded files after product creation failure");
      } catch (cleanupError) {
        console.error("Error cleaning up uploaded files:", cleanupError);
      }
    }

    return res
      .status(500)
      .json(
        ResponseHelper.error(
          error instanceof Error ? error.message : "Failed to create product",
          "CREATE_PRODUCT_ERROR"
        )
      );
  }
};

/**
 * Update product with file uploads (with transaction)
 */
export const updateProductWithFiles = async (req: Request, res: Response) => {
  let uploadedKeys: string[] = [];

  try {
    if (!req.user) {
      return res
        .status(401)
        .json(ResponseHelper.error("Authentication required", "UNAUTHORIZED"));
    }

    const { id } = req.params;

    // Check if product exists and not deleted
    const existingProduct = await prisma.product.findUnique({
      where: { id, isDeleted: false },
      include: {
        capacity: true,
        productImages: {
          orderBy: { order: "asc" },
        },
        productColors: {
          include: {
            color: true,
          },
        },
        productCategories: {
          include: {
            category: true,
          },
        },
      },
    });

    if (!existingProduct) {
      return res
        .status(404)
        .json(ResponseHelper.error("Product not found", "PRODUCT_NOT_FOUND"));
    }

    // Parse form data for validation (FormData sends everything as strings)
    const formBody = { ...req.body };

    // Convert string numbers to actual numbers
    if (formBody.stockQuantity !== undefined) {
      const stockNum = parseInt(formBody.stockQuantity);
      formBody.stockQuantity = isNaN(stockNum) ? 0 : stockNum;
    }

    // Handle empty productUrl
    if (formBody.productUrl === "") {
      delete formBody.productUrl; // Remove empty string so validation doesn't fail
    }

    console.log("Parsed form body:", formBody);

    // Validate input
    const formValidationResult = updateProductSchema.safeParse(formBody);
    if (!formValidationResult.success) {
      console.error("Validation errors:", formValidationResult.error.issues);
      return res
        .status(400)
        .json(
          ResponseHelper.error(
            "Validation failed",
            "VALIDATION_ERROR",
            formValidationResult.error.issues
          )
        );
    }

    const updateData = formValidationResult.data;

    // Get uploaded files
    const uploadedFiles = req.files as Express.Multer.File[] | undefined;
    const keepExistingImages = req.body.keepExistingImages === "true";

    let newImageUrls: string[] = [];
    let uploadedKeys: string[] = [];

    // Start transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Upload new files to S3 if any
      if (uploadedFiles && uploadedFiles.length > 0) {
        try {
          const files = uploadedFiles.map((file) => ({
            buffer: file.buffer,
            filename: file.originalname,
          }));

          const uploadResults = await s3Service.uploadFiles(files, "products");
          newImageUrls = uploadResults.map((result) => result.url);
          uploadedKeys = uploadResults.map((result) => result.key);
        } catch (uploadError) {
          console.error("File upload error:", uploadError);
          throw new Error("Failed to upload images");
        }
      }

      // 2. Prepare final images array
      let finalImages: string[] = [];
      if (keepExistingImages) {
        // Keep existing images and add new ones
        const existingImages =
          existingProduct.productImages &&
          existingProduct.productImages.length > 0
            ? existingProduct.productImages.map((img) => img.url)
            : [];
        finalImages = [...existingImages, ...newImageUrls];
      } else {
        // Replace all images with new ones (or empty if no new images)
        finalImages = newImageUrls;
      }

      // 3. Verify new references if being updated
      if (
        updateData.capacityId &&
        updateData.capacityId !== existingProduct.capacityId
      ) {
        const capacity = await tx.capacity.findUnique({
          where: { id: updateData.capacityId, isActive: true },
        });
        if (!capacity) {
          throw new Error("Capacity not found or inactive");
        }
      }

      // Validate colorIds if provided
      if (updateData.colorIds && updateData.colorIds.length > 0) {
        const colors = await tx.color.findMany({
          where: { id: { in: updateData.colorIds }, isActive: true },
        });
        if (colors.length !== updateData.colorIds.length) {
          throw new Error("One or more colors not found or inactive");
        }
      }

      // Validate categoryIds if provided
      if (updateData.categoryIds && updateData.categoryIds.length > 0) {
        const categories = await tx.category.findMany({
          where: { id: { in: updateData.categoryIds }, isActive: true },
        });
        if (categories.length !== updateData.categoryIds.length) {
          throw new Error("One or more categories not found or inactive");
        }
      }

      // 4. Handle slug regeneration
      let finalSlug = updateData.slug;

      if ((updateData.name || updateData.capacityId) && !updateData.slug) {
        const newCapacity = updateData.capacityId
          ? await tx.capacity.findUnique({
              where: { id: updateData.capacityId },
            })
          : existingProduct.capacity;

        if (newCapacity) {
          // For products with multiple colors, use first color for slug generation
          const primaryColor = existingProduct.productColors?.[0]?.color || {
            name: "default",
          };

          finalSlug = generateProductSlug(
            updateData.name || existingProduct.name,
            primaryColor.name,
            newCapacity.name
          );

          if (finalSlug !== existingProduct.slug) {
            let slugCounter = 0;
            let originalSlug = finalSlug;

            while (
              await tx.product.findFirst({
                where: {
                  slug: finalSlug,
                  id: { not: id },
                },
              })
            ) {
              slugCounter++;
              finalSlug = `${originalSlug}-${slugCounter}`;
            }
          }
        }
      } else if (updateData.slug && updateData.slug !== existingProduct.slug) {
        const existingSlugProduct = await tx.product.findFirst({
          where: {
            slug: updateData.slug,
            id: { not: id },
          },
        });

        if (existingSlugProduct) {
          throw new Error("Product with this slug already exists");
        }
        finalSlug = updateData.slug;
      }

      // 5. Prepare update data
      const processedUpdateData: any = {};
      if (updateData.name) processedUpdateData.name = updateData.name.trim();
      if (finalSlug) processedUpdateData.slug = finalSlug;
      if (updateData.description !== undefined) {
        processedUpdateData.description = updateData.description?.trim() || "";
      }
      if (updateData.capacityId)
        processedUpdateData.capacityId = updateData.capacityId;
      if (updateData.stockQuantity !== undefined) {
        processedUpdateData.stockQuantity = updateData.stockQuantity;
      }
      // Always update images (either with new ones or empty array)
      processedUpdateData.images = finalImages;
      if (updateData.productUrl !== undefined) {
        processedUpdateData.productUrl = updateData.productUrl || "";
      }

      // 6. Update product in transaction
      const updatedProduct = await tx.product.update({
        where: { id },
        data: processedUpdateData,
        include: {
          capacity: true,
          productColors: {
            include: {
              color: true,
            },
          },
          productCategories: {
            include: {
              category: true,
            },
          },
          _count: {
            select: {
              orderItems: true,
            },
          },
        },
      });

      return updatedProduct;
    });

    // 7. If we reach here, transaction was successful
    // Delete old images if not keeping them
    if (
      !keepExistingImages &&
      existingProduct.productImages &&
      existingProduct.productImages.length > 0
    ) {
      try {
        // Extract S3 keys from existing image URLs and delete them
        const oldKeys = s3Service.extractKeysFromUrls(
          existingProduct.productImages.map((img) => img.url)
        );

        if (oldKeys.length > 0) {
          await s3Service.deleteFiles(oldKeys);
          console.log(
            `Successfully deleted ${oldKeys.length} old images from S3`
          );
        }
      } catch (deleteError) {
        // Log error but don't fail the update since DB is already updated
        console.error("Error deleting old images:", deleteError);
      }
    }

    const productWithStatus = {
      ...result,
      isLowStock: result.stockQuantity <= 1,
      stockStatus:
        result.stockQuantity === 0
          ? "out_of_stock"
          : result.stockQuantity <= 1
            ? "low_stock"
            : "in_stock",
    };

    // Sync to Meilisearch in background
    syncProductToMeilisearch(result.id).catch(console.error);

    return res.status(200).json(ResponseHelper.success(productWithStatus));
  } catch (error) {
    console.error("Update product with files error:", error);

    // Cleanup uploaded files if transaction failed
    if (uploadedKeys.length > 0) {
      try {
        await s3Service.deleteFiles(uploadedKeys);
        console.log("Cleaned up uploaded files after transaction failure");
      } catch (cleanupError) {
        console.error("Error cleaning up uploaded files:", cleanupError);
      }
    }

    return res
      .status(500)
      .json(
        ResponseHelper.error(
          error instanceof Error ? error.message : "Failed to update product",
          "UPDATE_PRODUCT_ERROR"
        )
      );
  }
};

/**
 * Update product (original version without file upload)
 */
export const updateProduct = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res
        .status(401)
        .json(ResponseHelper.error("Authentication required", "UNAUTHORIZED"));
    }

    const { id } = req.params;

    // Parse request body and ensure proper types
    const formBody = { ...req.body };

    // Convert string numbers to actual numbers (for both FormData and JSON)
    if (formBody.stockQuantity !== undefined) {
      if (typeof formBody.stockQuantity === "string") {
        const stockNum = parseInt(formBody.stockQuantity);
        formBody.stockQuantity = isNaN(stockNum) ? 0 : stockNum;
      } else if (typeof formBody.stockQuantity === "number") {
        // Already a number, keep as is
        formBody.stockQuantity = formBody.stockQuantity;
      } else {
        // Default fallback
        formBody.stockQuantity = 0;
      }
    }

    // Clean up productUrl - remove if empty string
    if (formBody.productUrl === "") {
      delete formBody.productUrl;
    }

    // Validate input
    const validationResult = updateProductSchema.safeParse(formBody);
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

    // Check if product exists and not deleted
    const existingProduct = await prisma.product.findUnique({
      where: { id, isDeleted: false },
      include: {
        capacity: true,
        productColors: {
          include: {
            color: true,
          },
        },
        productCategories: {
          include: {
            category: true,
          },
        },
      },
    });

    if (!existingProduct) {
      return res
        .status(404)
        .json(ResponseHelper.error("Product not found", "PRODUCT_NOT_FOUND"));
    }

    // Verify new references if being updated
    if (
      updateData.capacityId &&
      updateData.capacityId !== existingProduct.capacityId
    ) {
      const capacity = await prisma.capacity.findUnique({
        where: { id: updateData.capacityId, isActive: true },
      });
      if (!capacity) {
        return res
          .status(400)
          .json(
            ResponseHelper.error(
              "Capacity not found or inactive",
              "INVALID_CAPACITY"
            )
          );
      }
    }

    // Validate colorIds if provided
    if (updateData.colorIds && updateData.colorIds.length > 0) {
      const colors = await prisma.color.findMany({
        where: { id: { in: updateData.colorIds }, isActive: true },
      });
      if (colors.length !== updateData.colorIds.length) {
        return res
          .status(400)
          .json(
            ResponseHelper.error(
              "One or more colors not found or inactive",
              "INVALID_COLOR"
            )
          );
      }
    }

    // Validate categoryIds if provided
    if (updateData.categoryIds && updateData.categoryIds.length > 0) {
      const categories = await prisma.category.findMany({
        where: { id: { in: updateData.categoryIds }, isActive: true },
      });
      if (categories.length !== updateData.categoryIds.length) {
        return res
          .status(400)
          .json(
            ResponseHelper.error(
              "One or more categories not found or inactive",
              "INVALID_CATEGORY"
            )
          );
      }
    }

    // Handle slug regeneration if name or capacity changed
    let finalSlug = updateData.slug;

    if ((updateData.name || updateData.capacityId) && !updateData.slug) {
      // Get updated references for slug generation
      const newCapacity = updateData.capacityId
        ? await prisma.capacity.findUnique({
            where: { id: updateData.capacityId },
          })
        : existingProduct.capacity;

      if (newCapacity) {
        // For products with multiple colors, use first color for slug generation
        const primaryColor = existingProduct.productColors?.[0]?.color || {
          name: "default",
        };

        finalSlug = generateProductSlug(
          updateData.name || existingProduct.name,
          primaryColor.name,
          newCapacity.name
        );

        // Check for slug conflicts
        if (finalSlug !== existingProduct.slug) {
          let slugCounter = 0;
          let originalSlug = finalSlug;

          while (
            await prisma.product.findFirst({
              where: {
                slug: finalSlug,
                id: { not: id },
              },
            })
          ) {
            slugCounter++;
            finalSlug = `${originalSlug}-${slugCounter}`;
          }
        }
      }
    } else if (updateData.slug && updateData.slug !== existingProduct.slug) {
      // Check for manual slug conflicts
      const existingSlugProduct = await prisma.product.findFirst({
        where: {
          slug: updateData.slug,
          id: { not: id },
        },
      });

      if (existingSlugProduct) {
        return res
          .status(409)
          .json(
            ResponseHelper.error(
              "Product with this slug already exists",
              "DUPLICATE_SLUG"
            )
          );
      }
      finalSlug = updateData.slug;
    }

    // Prepare update data
    const processedUpdateData: any = {};
    if (updateData.name) processedUpdateData.name = updateData.name.trim();
    if (finalSlug) processedUpdateData.slug = finalSlug;
    if (updateData.description !== undefined) {
      processedUpdateData.description = updateData.description?.trim() || null;
    }
    if (updateData.capacityId)
      processedUpdateData.capacityId = updateData.capacityId;
    if (updateData.stockQuantity !== undefined)
      processedUpdateData.stockQuantity = updateData.stockQuantity;
    if (updateData.productImages) {
      console.log("🔄 [updateProduct] Images reorder detected:");
      console.log(
        "📊 [updateProduct] New images order:",
        updateData.productImages
      );
      // Don't store in legacy images field since we removed it from the schema
      // The image reordering will be handled after the product update
    }
    if (updateData.productUrl !== undefined)
      processedUpdateData.productUrl = updateData.productUrl;

    // Handle relationships updates within a transaction
    const updatedProduct = await prisma.$transaction(async (tx) => {
      // Update categories if provided
      if (updateData.categoryIds) {
        // Delete existing categories
        await tx.productCategory.deleteMany({
          where: { productId: id },
        });

        // Create new categories
        if (updateData.categoryIds.length > 0) {
          const productCategoryData = updateData.categoryIds.map(
            (categoryId) => ({
              productId: id,
              categoryId,
            })
          );
          await tx.productCategory.createMany({
            data: productCategoryData,
          });
        }
      }

      // Update colors if provided
      if (updateData.colorIds) {
        // Delete existing colors
        await tx.productColor.deleteMany({
          where: { productId: id },
        });

        // Create new colors
        if (updateData.colorIds.length > 0) {
          const productColorData = updateData.colorIds.map((colorId) => ({
            productId: id,
            colorId,
          }));
          await tx.productColor.createMany({
            data: productColorData,
          });
        }
      }

      // Update product basic fields
      return await tx.product.update({
        where: { id },
        data: processedUpdateData,
        include: {
          capacity: true,
          productColors: {
            include: {
              color: true,
            },
          },
          productCategories: {
            include: {
              category: true,
            },
          },
          productImages: {
            orderBy: { order: "asc" },
            select: {
              url: true,
              order: true,
            },
          },
          _count: {
            select: {
              orderItems: true,
            },
          },
        },
      });
    });

    // Handle image reordering if images array is provided
    if (updateData.productImages && Array.isArray(updateData.productImages)) {
      console.log(
        "🔄 [updateProduct] Updating ProductImage table with new order"
      );
      console.log(
        "📊 [updateProduct] Images to reorder:",
        updateData.productImages
      );

      try {
        // Convert to string array if needed
        const imageUrls: string[] = updateData.productImages.map((img: any) =>
          typeof img === "string" ? img : img.url
        );

        await productImageService.reorderImages(id, imageUrls);
        console.log(
          "✅ [updateProduct] ProductImage reordering completed successfully"
        );
      } catch (imageError) {
        console.error(
          "❌ [updateProduct] Error reordering images:",
          imageError
        );
        // Don't fail the entire update for image reordering issues
      }
    }

    const productWithStatus = {
      ...updatedProduct,
      images: updatedProduct.productImages.map((img) => img.url), // Map ProductImage to images array for backward compatibility
      isLowStock: updatedProduct.stockQuantity <= 1,
      stockStatus:
        updatedProduct.stockQuantity === 0
          ? "out_of_stock"
          : updatedProduct.stockQuantity <= 1
            ? "low_stock"
            : "in_stock",
    };

    return res.status(200).json(ResponseHelper.success(productWithStatus));
  } catch (error) {
    console.error("Update product error:", error);
    return res
      .status(500)
      .json(
        ResponseHelper.error("Failed to update product", "UPDATE_PRODUCT_ERROR")
      );
  }
};

/**
 * Soft delete product
 */
export const deleteProduct = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res
        .status(401)
        .json(ResponseHelper.error("Authentication required", "UNAUTHORIZED"));
    }

    const { id } = req.params;

    const product = await prisma.product.findUnique({
      where: { id, isDeleted: false },
      include: {
        _count: {
          select: {
            orderItems: true,
          },
        },
      },
    });

    if (!product) {
      return res
        .status(404)
        .json(ResponseHelper.error("Product not found", "PRODUCT_NOT_FOUND"));
    }

    // Soft delete with order protection
    const updatedProduct = await prisma.product.update({
      where: { id },
      data: {
        isDeleted: true,
        isActive: false, // Also deactivate
        deletedAt: new Date(),
        deletedByAdminId: req.user.userId,
      },
      include: {
        deletedByAdmin: {
          select: {
            username: true,
            email: true,
          },
        },
        _count: {
          select: {
            orderItems: true,
          },
        },
      },
    });

    // Sync to Meilisearch in background (will remove from index since product is deleted)
    syncProductToMeilisearch(id).catch(console.error);

    return res.status(200).json(
      ResponseHelper.success(updatedProduct, {
        message: `Product soft deleted successfully. ${updatedProduct._count.orderItems} existing orders preserved.`,
      })
    );
  } catch (error) {
    console.error("Delete product error:", error);
    return res
      .status(500)
      .json(
        ResponseHelper.error("Failed to delete product", "DELETE_PRODUCT_ERROR")
      );
  }
};

/**
 * Reactivate soft deleted product
 */
export const reactivateProduct = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res
        .status(401)
        .json(ResponseHelper.error("Authentication required", "UNAUTHORIZED"));
    }

    const { id } = req.params;

    const product = await prisma.product.findUnique({
      where: { id, isDeleted: true },
      include: {
        productColors: {
          include: {
            color: true,
          },
        },
        productCategories: {
          include: {
            category: true,
          },
        },
      },
    });

    if (!product) {
      return res
        .status(404)
        .json(
          ResponseHelper.error("Deleted product not found", "PRODUCT_NOT_FOUND")
        );
    }

    // Verify capacity and related entities are still active
    const capacity = await prisma.capacity.findUnique({
      where: { id: product.capacityId, isActive: true },
    });

    const inactiveRefs = [];
    if (!capacity) inactiveRefs.push("capacity");

    // Check if any colors are inactive
    const inactiveColors = product.productColors.filter(
      (pc) => !pc.color.isActive
    );
    if (inactiveColors.length > 0) {
      inactiveRefs.push(
        `colors: ${inactiveColors.map((pc) => pc.color.name).join(", ")}`
      );
    }

    // Check if any categories are inactive
    const inactiveCategories = product.productCategories.filter(
      (pc) => !pc.category.isActive
    );
    if (inactiveCategories.length > 0) {
      inactiveRefs.push(
        `categories: ${inactiveCategories.map((pc) => pc.category.name).join(", ")}`
      );
    }

    if (inactiveRefs.length > 0) {
      return res
        .status(400)
        .json(
          ResponseHelper.error(
            `Cannot reactivate product. The following references are inactive: ${inactiveRefs.join(", ")}`,
            "INACTIVE_REFERENCES"
          )
        );
    }

    // Reactivate product
    const reactivatedProduct = await prisma.product.update({
      where: { id },
      data: {
        isDeleted: false,
        isActive: true,
        deletedAt: null,
        deletedByAdminId: null,
      },
      include: {
        capacity: true,
        productColors: {
          include: {
            color: true,
          },
        },
        productCategories: {
          include: {
            category: true,
          },
        },
        _count: {
          select: {
            orderItems: true,
          },
        },
      },
    });

    const productWithStatus = {
      ...reactivatedProduct,
      isLowStock: reactivatedProduct.stockQuantity <= 1,
      stockStatus:
        reactivatedProduct.stockQuantity === 0
          ? "out_of_stock"
          : reactivatedProduct.stockQuantity <= 1
            ? "low_stock"
            : "in_stock",
    };

    return res.status(200).json(
      ResponseHelper.success(productWithStatus, {
        message: "Product reactivated successfully",
      })
    );
  } catch (error) {
    console.error("Reactivate product error:", error);
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
 * Update product stock
 */
export const updateProductStock = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res
        .status(401)
        .json(ResponseHelper.error("Authentication required", "UNAUTHORIZED"));
    }

    const { id } = req.params;

    const product = await prisma.product.findUnique({
      where: { id, isDeleted: false },
    });

    if (!product) {
      return res
        .status(404)
        .json(ResponseHelper.error("Product not found", "PRODUCT_NOT_FOUND"));
    }

    // Validate input
    const validationResult = stockUpdateSchema.safeParse(req.body);
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

    const { quantity, operation, reason } = validationResult.data;

    let newStock: number;
    switch (operation) {
      case "set":
        newStock = quantity;
        break;
      case "add":
        newStock = product.stockQuantity + quantity;
        break;
      case "subtract":
        newStock = product.stockQuantity - quantity;
        break;
    }

    if (newStock < 0) {
      return res
        .status(400)
        .json(
          ResponseHelper.error(
            "Stock quantity cannot be negative",
            "INVALID_STOCK"
          )
        );
    }

    // Update stock
    const updatedProduct = await prisma.product.update({
      where: { id },
      data: { stockQuantity: newStock },
      include: {
        capacity: true,
        productColors: {
          include: {
            color: true,
          },
        },
        productCategories: {
          include: {
            category: true,
          },
        },
      },
    });

    const productWithStatus = {
      ...updatedProduct,
      isLowStock: updatedProduct.stockQuantity <= 1,
      stockStatus:
        updatedProduct.stockQuantity === 0
          ? "out_of_stock"
          : updatedProduct.stockQuantity <= 1
            ? "low_stock"
            : "in_stock",
      stockChange: {
        from: product.stockQuantity,
        to: newStock,
        operation,
        quantity,
        reason,
      },
    };

    // Sync to Meilisearch in background to update stock quantity
    syncProductToMeilisearch(id).catch(console.error);

    return res.status(200).json(ResponseHelper.success(productWithStatus));
  } catch (error) {
    console.error("Update stock error:", error);
    return res
      .status(500)
      .json(
        ResponseHelper.error("Failed to update stock", "UPDATE_STOCK_ERROR")
      );
  }
};

/**
 * Toggle product active status
 */
export const toggleProductStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const product = await prisma.product.findUnique({
      where: { id, isDeleted: false },
    });

    if (!product) {
      return res
        .status(404)
        .json(ResponseHelper.error("Product not found", "PRODUCT_NOT_FOUND"));
    }

    const updatedProduct = await prisma.product.update({
      where: { id },
      data: { isActive: !product.isActive },
      include: {
        capacity: true,
        productColors: {
          include: {
            color: true,
          },
        },
        productCategories: {
          include: {
            category: true,
          },
        },
        _count: {
          select: {
            orderItems: true,
          },
        },
      },
    });

    const productWithStatus = {
      ...updatedProduct,
      isLowStock: updatedProduct.stockQuantity <= 1,
      stockStatus:
        updatedProduct.stockQuantity === 0
          ? "out_of_stock"
          : updatedProduct.stockQuantity <= 1
            ? "low_stock"
            : "in_stock",
    };

    // Sync updated product to Meilisearch
    try {
      await syncProductToMeilisearch(id);
      console.log(`✅ Product ${id} status toggled and synced to Meilisearch`);
    } catch (meilisearchError) {
      console.error(
        `⚠️ Failed to sync product ${id} to Meilisearch:`,
        meilisearchError
      );
      // Don't fail the request if Meilisearch sync fails
    }

    return res.status(200).json(ResponseHelper.success(productWithStatus));
  } catch (error) {
    console.error("Toggle product status error:", error);
    return res
      .status(500)
      .json(
        ResponseHelper.error(
          "Failed to toggle product status",
          "TOGGLE_PRODUCT_ERROR"
        )
      );
  }
};

/**
 * Search products for autocomplete
 */
export const searchProducts = async (req: Request, res: Response) => {
  try {
    const {
      q: query = "",
      active = "true",
      includeDeleted = "false",
    } = req.query;

    const where: any = {
      isActive: active === "true",
      isDeleted: includeDeleted === "true" ? undefined : false,
    };

    if (query) {
      where.OR = [
        { name: { contains: query as string, mode: "insensitive" } },
        { slug: { contains: query as string, mode: "insensitive" } },
      ];
    }

    const products = await prisma.product.findMany({
      where,
      select: {
        id: true,
        name: true,
        slug: true,
        stockQuantity: true,
        capacity: {
          select: {
            name: true,
          },
        },
        productColors: {
          select: {
            color: {
              select: {
                name: true,
                hexCode: true,
              },
            },
          },
        },
        productCategories: {
          select: {
            category: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: { name: "asc" },
      take: 50,
    });

    return res.status(200).json(ResponseHelper.success(products));
  } catch (error) {
    console.error("Search products error:", error);
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
 * Get low stock products alert
 */
export const getLowStockProducts = async (req: Request, res: Response) => {
  try {
    const { threshold = "10" } = req.query;
    const stockThreshold = parseInt(threshold as string);

    const lowStockProducts = await prisma.product.findMany({
      where: {
        isDeleted: false,
        isActive: true,
        stockQuantity: {
          lte: stockThreshold,
        },
      },
      include: {
        capacity: {
          select: {
            name: true,
          },
        },
        productColors: {
          include: {
            color: {
              select: {
                name: true,
                hexCode: true,
              },
            },
          },
        },
        productCategories: {
          include: {
            category: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: { stockQuantity: "asc" },
    });

    const productsWithStatus = lowStockProducts.map((product) => ({
      ...product,
      isLowStock: product.stockQuantity <= stockThreshold,
      stockStatus: product.stockQuantity === 0 ? "out_of_stock" : "low_stock",
      urgency:
        product.stockQuantity === 0
          ? "critical"
          : product.stockQuantity <= 1
            ? "high"
            : "medium",
    }));

    return res.status(200).json(
      ResponseHelper.success({
        products: productsWithStatus,
        summary: {
          total: productsWithStatus.length,
          outOfStock: productsWithStatus.filter((p) => p.stockQuantity === 0)
            .length,
          lowStock: productsWithStatus.filter(
            (p) => p.stockQuantity > 0 && p.stockQuantity <= stockThreshold
          ).length,
        },
      })
    );
  } catch (error) {
    console.error("Get low stock products error:", error);
    return res
      .status(500)
      .json(
        ResponseHelper.error(
          "Failed to get low stock products",
          "GET_LOW_STOCK_ERROR"
        )
      );
  }
};

// ============================================================================
// PUBLIC CONTROLLERS (No authentication required)
// ============================================================================

// Helper function to search public products with Meilisearch (with PostgreSQL fallback)
const searchPublicProductsWithMeilisearch = async (params: {
  search?: string;
  page: number;
  limit: number;
  category?: string;
  categoryIds?: string[];
  color?: string;
  capacityMin?: number;
  capacityMax?: number;
  excludeProductId?: string;
  sortBy?: string;
  sortOrder?: string;
  inStock?: boolean;
}) => {
  const {
    search,
    page,
    limit,
    category,
    categoryIds,
    color,
    capacityMin,
    capacityMax,
    excludeProductId,
    sortBy = "createdAt",
    sortOrder = "desc",
    inStock,
  } = params;

  try {
    // If capacity range filtering is requested, use PostgreSQL fallback
    // because Meilisearch doesn't support capacity.volumeMl filtering
    if (capacityMin !== undefined || capacityMax !== undefined) {
      console.log("🔄 Using PostgreSQL for capacity range filtering");
      throw new Error("Using PostgreSQL fallback for capacity range filtering");
    }

    // Build Meilisearch filter
    const filters = buildMeilisearchFilters({
      isActive: true,
      isDeleted: false,
      categorySlug:
        category &&
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          category
        )
          ? category
          : undefined,
      excludeProductId,
      colorSlug: color,
      capacityMin,
      capacityMax,
    });

    // Build Meilisearch sort
    const sort = buildMeilisearchSort(sortBy, sortOrder);

    console.log(
      `🔍 Searching public products with Meilisearch - Query: "${search}", Filters: ${filters}, Sort: ${sort}, Page: ${page}, Limit: ${limit}`
    );

    const searchResult = await meilisearchService.searchProducts(search || "", {
      limit,
      offset: (page - 1) * limit,
      filters,
      sort,
    });

    console.log(
      `✅ Meilisearch public search completed: ${searchResult.hits.length} results, ${searchResult.estimatedTotalHits} total`
    );

    // Transform Meilisearch results to match expected format
    const transformedResults = searchResult.hits.map((hit: any) => ({
      id: hit.id,
      name: hit.name,
      slug: hit.slug,
      description: hit.description,
      stockQuantity: hit.stockQuantity,
      productUrl: hit.productUrl,
      isActive: hit.isActive,
      createdAt: hit.createdAt,
      updatedAt: hit.updatedAt,
      productImages: hit.images
        ? hit.images.map((url: string, index: number) => ({
            url,
            order: index + 1,
          }))
        : [],
      productCategories: hit.categories
        ? hit.categories.map((cat: any) => ({
            category: {
              id: cat.id,
              name: cat.name,
              slug: cat.slug,
            },
          }))
        : [],
      productColors: hit.colors
        ? hit.colors.map((color: any) => ({
            color: {
              id: color.id,
              name: color.name,
              slug: color.slug,
              hexCode: color.hexCode,
            },
          }))
        : [],
      capacity: {
        id: hit.capacity.id,
        name: hit.capacity.name,
        slug: hit.capacity.slug,
        volumeMl: hit.capacity.volumeMl,
      },
    }));

    return {
      items: transformedResults,
      totalItems: searchResult.estimatedTotalHits || 0,
      searchMeta: {
        query: search,
        processingTimeMs: searchResult.processingTimeMs,
        source: "meilisearch",
      },
    };
  } catch (error) {
    console.error(
      "❌ Meilisearch public search error, falling back to PostgreSQL:",
      error
    );

    // Fallback to PostgreSQL search
    const where: any = {
      isActive: true,
      isDeleted: false,
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    // Handle filtering by slug or ID
    if (category) {
      if (
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          category
        )
      ) {
        where.productCategories = {
          some: {
            categoryId: category,
          },
        };
      } else {
        where.productCategories = {
          some: {
            category: { slug: category },
          },
        };
      }
    }

    if (categoryIds && categoryIds.length > 0) {
      where.productCategories = {
        some: {
          categoryId: { in: categoryIds },
        },
      };
    }

    if (inStock) {
      where.stockQuantity = { gt: 0 };
    }

    if (excludeProductId) {
      where.id = { not: excludeProductId };
    }

    // Capacity range filtering
    if (capacityMin !== undefined || capacityMax !== undefined) {
      const capacityFilter: any = {};
      if (capacityMin !== undefined) {
        capacityFilter.gte = capacityMin;
      }
      if (capacityMax !== undefined) {
        capacityFilter.lte = capacityMax;
      }
      where.capacity = {
        ...where.capacity,
        volumeMl: capacityFilter,
      };
    }

    const orderBy: any = { [sortBy]: sortOrder };
    const offset = (page - 1) * limit;

    const [items, totalItems] = await Promise.all([
      prisma.product.findMany({
        where,
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          stockQuantity: true,
          productUrl: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          productImages: {
            orderBy: { order: "asc" },
            select: {
              url: true,
              order: true,
            },
          },
          productCategories: {
            select: {
              category: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
            },
          },
          productColors: {
            select: {
              color: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  hexCode: true,
                },
              },
            },
          },
          capacity: {
            select: {
              id: true,
              name: true,
              slug: true,
              volumeMl: true,
            },
          },
        },
        orderBy,
        skip: offset,
        take: limit,
      }),
      prisma.product.count({ where }),
    ]);

    console.log(
      `📦 PostgreSQL fallback search completed: ${items.length} results, ${totalItems} total`
    );

    return {
      items,
      totalItems,
      searchMeta: {
        query: search,
        source: "postgresql",
      },
    };
  }
};

/**
 * Get products for public view (customers)
 * Only returns active products that are not deleted
 */
export const getPublicProducts = async (req: Request, res: Response) => {
  try {
    const validation = publicQuerySchema.safeParse(req.query);
    if (!validation.success) {
      return res
        .status(400)
        .json(
          ResponseHelper.error(
            "Invalid query parameters",
            "INVALID_QUERY",
            validation.error.issues
          )
        );
    }

    const {
      page = 1,
      limit = 12,
      search,
      category,
      categoryIds,
      color,
      capacityMin,
      capacityMax,
      excludeProductId,
      sortBy = "createdAt",
      sortOrder = "desc",
      inStock,
    } = validation.data;

    // Use Meilisearch for search (with PostgreSQL fallback)
    const { items, totalItems, searchMeta } =
      await searchPublicProductsWithMeilisearch({
        search,
        page,
        limit,
        category,
        categoryIds,
        color,
        capacityMin,
        capacityMax,
        excludeProductId,
        sortBy,
        sortOrder,
        inStock,
      });

    const totalPages = Math.ceil(totalItems / limit);

    return res.json(
      ResponseHelper.paginated(
        items,
        {
          current_page: page,
          per_page: limit,
          total_pages: totalPages,
          total_items: totalItems,
          has_next: page < totalPages,
          has_prev: page > 1,
        },
        {
          search: searchMeta,
        }
      )
    );
  } catch (error) {
    console.error("Get public products error:", error);
    return res
      .status(500)
      .json(
        ResponseHelper.error(
          "Failed to get products",
          "GET_PUBLIC_PRODUCTS_ERROR"
        )
      );
  }
};

/**
 * Get product by ID or slug for public view
 */
export const getPublicProductById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    console.log(`🔍 Looking for product with parameter: "${id}"`);

    // Check if the parameter is a valid UUID
    const isUUID =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id
      );

    console.log(`📋 Parameter is UUID: ${isUUID}`);

    // Build the where clause based on whether it's a UUID or slug
    const whereClause = isUUID
      ? {
          OR: [{ id: id }, { slug: id }],
          isActive: true,
          isDeleted: false,
        }
      : {
          slug: id,
          isActive: true,
          isDeleted: false,
        };

    console.log(`🔍 Search criteria:`, JSON.stringify(whereClause, null, 2));

    // Try to find by ID first, then by slug
    const product = await prisma.product.findFirst({
      where: whereClause,
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        stockQuantity: true,
        productUrl: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        productImages: {
          orderBy: { order: "asc" },
          select: {
            url: true,
            order: true,
          },
        },
        productCategories: {
          select: {
            category: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
        productColors: {
          select: {
            color: {
              select: {
                id: true,
                name: true,
                slug: true,
                hexCode: true,
              },
            },
          },
        },
        capacity: {
          select: {
            id: true,
            name: true,
            slug: true,
            volumeMl: true,
          },
        },
      },
    });

    console.log(
      `📦 Product query result:`,
      product ? "✅ Found" : "❌ Not found"
    );

    if (!product) {
      console.log(
        `❌ Product not found with criteria:`,
        JSON.stringify(whereClause, null, 2)
      );

      // Try to find the product without isActive/isDeleted filters to debug
      const debugProduct = await prisma.product.findFirst({
        where: isUUID ? { OR: [{ id: id }, { slug: id }] } : { slug: id },
        select: {
          id: true,
          name: true,
          slug: true,
          isActive: true,
          isDeleted: true,
        },
      });

      if (debugProduct) {
        console.log(`🔍 Found product but filtered out:`, debugProduct);
      } else {
        console.log(`🔍 Product completely not found in database`);
      }

      return res
        .status(404)
        .json(ResponseHelper.error("Product not found", "PRODUCT_NOT_FOUND"));
    }

    return res.json(ResponseHelper.success(product));
  } catch (error) {
    console.error("Get public product by ID error:", error);
    return res
      .status(500)
      .json(
        ResponseHelper.error(
          "Failed to get product",
          "GET_PUBLIC_PRODUCT_ERROR"
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

    // Validate input
    const reorderSchema = z.object({
      imageUrls: z.array(z.string().url("Invalid image URL")),
    });

    const validationResult = reorderSchema.safeParse(req.body);
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

    const { imageUrls } = validationResult.data;

    // Check if product exists
    const product = await prisma.product.findUnique({
      where: { id, isDeleted: false },
    });

    if (!product) {
      return res
        .status(404)
        .json(ResponseHelper.error("Product not found", "PRODUCT_NOT_FOUND"));
    }

    // Reorder images
    await productImageService.reorderImages(id, imageUrls);

    return res.json(
      ResponseHelper.success(
        { productId: id, imageUrls },
        { message: "Images reordered successfully" }
      )
    );
  } catch (error) {
    console.error("Reorder product images error:", error);
    return res
      .status(500)
      .json(
        ResponseHelper.error("Failed to reorder images", "REORDER_IMAGES_ERROR")
      );
  }
};
