/**
 * Categories management controller
 * Handles CRUD operations for category entities with hierarchical support
 */
import { Request, Response } from "express";
import { PrismaClient } from "../generated/prisma";
import { ResponseHelper } from "../types/api";
import { z } from "zod";
import { generateVietnameseSlug } from "../utils/vietnamese-slug";

const prisma = new PrismaClient();

// Validation schemas
const createCategorySchema = z.object({
  name: z
    .string()
    .min(1, "Category name is required")
    .max(200, "Name too long"),
  slug: z.string().optional(),
  description: z.string().optional(),
  parentId: z.string().uuid().optional(),
});

const updateCategorySchema = createCategorySchema.partial();

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
  parentId: z.string().uuid().optional(),
  level: z.string().transform(Number).pipe(z.number().min(0).max(3)).optional(),
  sortBy: z.enum(["name", "createdAt", "updatedAt"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
  includeChildren: z
    .string()
    .transform((val) => val === "true")
    .optional(),
});

/**
 * Get all categories with pagination, filters and hierarchy
 */
export const getCategories = async (req: Request, res: Response) => {
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
      parentId,
      sortBy = "name",
      sortOrder = "asc",
      includeChildren = false,
    } = queryValidation.data;

    const offset = (page - 1) * limit;

    // Build where clause
    const where: any = {};
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
    if (parentId !== undefined) {
      where.parentId = parentId;
    }

    // Get total count and categories
    const [total, categories] = await Promise.all([
      prisma.category.count({ where }),
      prisma.category.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          createdByAdmin: {
            select: {
              username: true,
              email: true,
            },
          },
          parent: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          ...(includeChildren && {
            children: {
              select: {
                id: true,
                name: true,
                slug: true,
                isActive: true,
              },
              where: { isActive: true },
            },
          }),
          _count: {
            select: {
              productCategories: true,
              children: true,
            },
          },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return res.status(200).json(
      ResponseHelper.paginated(categories, {
        current_page: page,
        per_page: limit,
        total_pages: totalPages,
        total_items: total,
        has_next: page < totalPages,
        has_prev: page > 1,
      })
    );
  } catch (error) {
    console.error("Get categories error:", error);
    return res
      .status(500)
      .json(
        ResponseHelper.error(
          "Failed to retrieve categories",
          "GET_CATEGORIES_ERROR"
        )
      );
  }
};

/**
 * Get category hierarchy tree
 */
export const getCategoryTree = async (req: Request, res: Response) => {
  try {
    const { activeOnly = "true" } = req.query;

    const where: any = {};
    if (activeOnly === "true") {
      where.isActive = true;
    }

    // Get all categories and build tree
    const categories = await prisma.category.findMany({
      where,
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: {
            productCategories: true,
            children: true,
          },
        },
      },
    });

    // Build hierarchy
    const buildTree = (parentId: string | null): any[] => {
      return categories
        .filter((cat) => cat.parentId === parentId)
        .map((cat) => ({
          ...cat,
          children: buildTree(cat.id),
        }));
    };

    const tree = buildTree(null);

    return res.status(200).json(ResponseHelper.success(tree));
  } catch (error) {
    console.error("Get category tree error:", error);
    return res
      .status(500)
      .json(
        ResponseHelper.error(
          "Failed to retrieve category tree",
          "GET_CATEGORY_TREE_ERROR"
        )
      );
  }
};

/**
 * Get category by ID
 */
export const getCategoryById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const category = await prisma.category.findUnique({
      where: { id },
      include: {
        createdByAdmin: {
          select: {
            username: true,
            email: true,
          },
        },
        parent: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        children: {
          select: {
            id: true,
            name: true,
            slug: true,
            isActive: true,
          },
        },
        _count: {
          select: {
            productCategories: true,
            children: true,
          },
        },
      },
    });

    if (!category) {
      return res
        .status(404)
        .json(ResponseHelper.error("Category not found", "CATEGORY_NOT_FOUND"));
    }

    return res.status(200).json(ResponseHelper.success(category));
  } catch (error) {
    console.error("Get category error:", error);
    return res
      .status(500)
      .json(
        ResponseHelper.error(
          "Failed to retrieve category",
          "GET_CATEGORY_ERROR"
        )
      );
  }
};

/**
 * Create new category
 */
export const createCategory = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res
        .status(401)
        .json(ResponseHelper.error("Authentication required", "UNAUTHORIZED"));
    }

    // Validate input
    const validationResult = createCategorySchema.safeParse(req.body);
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

    const { name, slug, description, parentId } = validationResult.data;

    // Generate slug if not provided
    let finalSlug = slug || generateVietnameseSlug(name);

    // Check for duplicate slug
    let slugCounter = 0;
    let originalSlug = finalSlug;

    while (await prisma.category.findUnique({ where: { slug: finalSlug } })) {
      slugCounter++;
      finalSlug = `${originalSlug}-${slugCounter}`;
    }

    // Validate parent category if provided
    if (parentId) {
      const parentCategory = await prisma.category.findUnique({
        where: { id: parentId },
      });

      if (!parentCategory) {
        return res
          .status(400)
          .json(
            ResponseHelper.error(
              "Parent category not found",
              "PARENT_NOT_FOUND"
            )
          );
      }

      // Check hierarchy depth (max 3 levels: root -> level1 -> level2)
      const getDepth = async (categoryId: string): Promise<number> => {
        const category = await prisma.category.findUnique({
          where: { id: categoryId },
          select: { parentId: true },
        });

        if (!category || !category.parentId) {
          return 1;
        }

        return 1 + (await getDepth(category.parentId));
      };

      const depth = await getDepth(parentId);

      if (depth >= 3) {
        return res
          .status(400)
          .json(
            ResponseHelper.error(
              "Maximum category depth (3 levels) exceeded",
              "MAX_DEPTH_EXCEEDED"
            )
          );
      }
    }

    // Create category
    const category = await prisma.category.create({
      data: {
        name: name.trim(),
        slug: finalSlug,
        description: description?.trim(),
        parentId,
        createdByAdminId: req.user.userId,
      },
      include: {
        createdByAdmin: {
          select: {
            username: true,
            email: true,
          },
        },
        parent: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        _count: {
          select: {
            productCategories: true,
            children: true,
          },
        },
      },
    });

    return res.status(201).json(ResponseHelper.success(category));
  } catch (error) {
    console.error("Create category error:", error);
    return res
      .status(500)
      .json(
        ResponseHelper.error(
          "Failed to create category",
          "CREATE_CATEGORY_ERROR"
        )
      );
  }
};

/**
 * Update category
 */
export const updateCategory = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res
        .status(401)
        .json(ResponseHelper.error("Authentication required", "UNAUTHORIZED"));
    }

    const { id } = req.params;

    // Check if category exists
    const existingCategory = await prisma.category.findUnique({
      where: { id },
      include: {
        parent: true,
        children: true,
      },
    });

    if (!existingCategory) {
      return res
        .status(404)
        .json(ResponseHelper.error("Category not found", "CATEGORY_NOT_FOUND"));
    }

    // Validate input
    const validationResult = updateCategorySchema.safeParse(req.body);
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

    // Validate parent change
    if (updateData.parentId !== undefined) {
      // Cannot set self as parent
      if (updateData.parentId === id) {
        return res
          .status(400)
          .json(
            ResponseHelper.error(
              "Category cannot be its own parent",
              "INVALID_PARENT"
            )
          );
      }

      // If setting parent, validate it exists and check depth
      if (updateData.parentId) {
        const newParent = await prisma.category.findUnique({
          where: { id: updateData.parentId },
        });

        if (!newParent) {
          return res
            .status(400)
            .json(
              ResponseHelper.error(
                "Parent category not found",
                "PARENT_NOT_FOUND"
              )
            );
        }

        // Check if new parent would create circular reference
        const isDescendant = async (
          categoryId: string,
          potentialAncestorId: string
        ): Promise<boolean> => {
          const cat = await prisma.category.findUnique({
            where: { id: categoryId },
            select: { parentId: true },
          });

          if (!cat || !cat.parentId) return false;
          if (cat.parentId === potentialAncestorId) return true;
          return isDescendant(cat.parentId, potentialAncestorId);
        };

        if (await isDescendant(updateData.parentId, id)) {
          return res
            .status(400)
            .json(
              ResponseHelper.error(
                "Cannot create circular parent-child relationship",
                "CIRCULAR_REFERENCE"
              )
            );
        }

        // Check depth using helper function
        const getDepth = async (categoryId: string): Promise<number> => {
          const category = await prisma.category.findUnique({
            where: { id: categoryId },
            select: { parentId: true },
          });

          if (!category || !category.parentId) {
            return 1;
          }

          return 1 + (await getDepth(category.parentId));
        };

        const depth = await getDepth(updateData.parentId);

        if (depth >= 3) {
          return res
            .status(400)
            .json(
              ResponseHelper.error(
                "Maximum category depth (3 levels) exceeded",
                "MAX_DEPTH_EXCEEDED"
              )
            );
        }
      }
    }

    // Handle slug update
    if (updateData.name && !updateData.slug) {
      updateData.slug = generateVietnameseSlug(updateData.name);
    }

    // Check for duplicate slug if slug is being updated
    if (updateData.slug && updateData.slug !== existingCategory.slug) {
      let finalSlug = updateData.slug;
      let slugCounter = 0;
      let originalSlug = finalSlug;

      while (
        await prisma.category.findFirst({
          where: {
            slug: finalSlug,
            id: { not: id },
          },
        })
      ) {
        slugCounter++;
        finalSlug = `${originalSlug}-${slugCounter}`;
      }

      updateData.slug = finalSlug;
    }

    // Prepare update data
    const processedUpdateData: any = {};
    if (updateData.name) {
      processedUpdateData.name = updateData.name.trim();
    }
    if (updateData.slug) {
      processedUpdateData.slug = updateData.slug;
    }
    if (updateData.description !== undefined) {
      processedUpdateData.description = updateData.description?.trim() || null;
    }
    if (updateData.parentId !== undefined) {
      processedUpdateData.parentId = updateData.parentId;
    }

    // Update category
    const updatedCategory = await prisma.category.update({
      where: { id },
      data: processedUpdateData,
      include: {
        createdByAdmin: {
          select: {
            username: true,
            email: true,
          },
        },
        parent: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        children: {
          select: {
            id: true,
            name: true,
            slug: true,
            isActive: true,
          },
        },
        _count: {
          select: {
            productCategories: true,
            children: true,
          },
        },
      },
    });

    return res.status(200).json(ResponseHelper.success(updatedCategory));
  } catch (error) {
    console.error("Update category error:", error);
    return res
      .status(500)
      .json(
        ResponseHelper.error(
          "Failed to update category",
          "UPDATE_CATEGORY_ERROR"
        )
      );
  }
};

/**
 * Toggle category active status
 */
export const toggleCategoryStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const category = await prisma.category.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            productCategories: true,
            children: true,
          },
        },
      },
    });

    if (!category) {
      return res
        .status(404)
        .json(ResponseHelper.error("Category not found", "CATEGORY_NOT_FOUND"));
    }

    // If deactivating, check if category is in use
    // Note: Temporarily disabled to allow deactivating category even when in use
    /*
    if (
      category.isActive &&
      (category._count.productCategories > 0 || category._count.children > 0)
    ) {
      return res
        .status(409)
        .json(
          ResponseHelper.error(
            `Cannot deactivate category that is used by ${category._count.productCategories} product(s) and has ${category._count.children} subcategory(ies)`,
            "CATEGORY_IN_USE"
          )
        );
    }
    */

    const updatedCategory = await prisma.category.update({
      where: { id },
      data: { isActive: !category.isActive },
      include: {
        createdByAdmin: {
          select: {
            username: true,
            email: true,
          },
        },
        parent: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        _count: {
          select: {
            productCategories: true,
            children: true,
          },
        },
      },
    });

    return res.status(200).json(ResponseHelper.success(updatedCategory));
  } catch (error) {
    console.error("Toggle category status error:", error);
    return res
      .status(500)
      .json(
        ResponseHelper.error(
          "Failed to toggle category status",
          "TOGGLE_CATEGORY_ERROR"
        )
      );
  }
};

/**
 * Delete category
 */
export const deleteCategory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const category = await prisma.category.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            productCategories: true,
            children: true,
          },
        },
      },
    });

    if (!category) {
      return res
        .status(404)
        .json(ResponseHelper.error("Category not found", "CATEGORY_NOT_FOUND"));
    }

    // Check if category is in use
    if (category._count.productCategories > 0 || category._count.children > 0) {
      return res
        .status(409)
        .json(
          ResponseHelper.error(
            `Không thể xoá danh mục có ${category._count.productCategories} sản phẩm và ${category._count.children} danh mục con. Hãy xem xét việc tắt danh mục thay vì xoá.`,
            "CATEGORY_IN_USE"
          )
        );
    }

    // Delete category
    await prisma.category.delete({
      where: { id },
    });

    return res.status(200).json(
      ResponseHelper.success(null, {
        message: "Category deleted successfully",
      })
    );
  } catch (error) {
    console.error("Delete category error:", error);
    return res
      .status(500)
      .json(
        ResponseHelper.error(
          "Failed to delete category",
          "DELETE_CATEGORY_ERROR"
        )
      );
  }
};

/**
 * Search categories for autocomplete
 */
export const searchCategories = async (req: Request, res: Response) => {
  try {
    const { q: query = "", active = "true", parentId } = req.query;

    const where: any = {
      isActive: active === "true",
    };

    if (query) {
      where.OR = [
        { name: { contains: query as string, mode: "insensitive" } },
        { slug: { contains: query as string, mode: "insensitive" } },
      ];
    }

    if (parentId) {
      where.parentId = parentId as string;
    }

    const categories = await prisma.category.findMany({
      where,
      select: {
        id: true,
        name: true,
        slug: true,
        parentId: true,
        parent: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { name: "asc" },
      take: 50,
    });

    return res.status(200).json(ResponseHelper.success(categories));
  } catch (error) {
    console.error("Search categories error:", error);
    return res
      .status(500)
      .json(
        ResponseHelper.error(
          "Failed to search categories",
          "SEARCH_CATEGORIES_ERROR"
        )
      );
  }
};

// ============================================================================
// PUBLIC CONTROLLERS (No authentication required)
// ============================================================================

/**
 * Get categories for public view (customers)
 * Only returns active categories
 */
export const getPublicCategories = async (req: Request, res: Response) => {
  try {
    const validation = querySchema.safeParse(req.query);
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

    const { page = 1, limit = 20, search, parentId } = validation.data;
    const offset = (page - 1) * limit;

    // Build where clause for public categories (only active)
    const where: any = {
      isActive: true,
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    if (parentId !== undefined) {
      where.parentId = parentId;
    }

    const [items, totalItems] = await Promise.all([
      prisma.category.findMany({
        where,
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          parentId: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          parent: {
            select: {
              id: true,
              name: true,
              slug: true,
              isActive: true,
            },
          },
          children: {
            where: {
              isActive: true,
            },
            select: {
              id: true,
              name: true,
              slug: true,
              isActive: true,
            },
          },
          _count: {
            select: {
              productCategories: {
                where: {
                  product: {
                    isActive: true,
                  },
                },
              },
              children: {
                where: {
                  isActive: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: offset,
        take: limit,
      }),
      prisma.category.count({ where }),
    ]);

    const totalPages = Math.ceil(totalItems / limit);

    return res.status(200).json(
      ResponseHelper.paginated(items, {
        current_page: page,
        per_page: limit,
        total_pages: totalPages,
        total_items: totalItems,
        has_next: page < totalPages,
        has_prev: page > 1,
      })
    );
  } catch (error) {
    console.error("Get public categories error:", error);
    return res
      .status(500)
      .json(
        ResponseHelper.error(
          "Failed to get categories",
          "GET_PUBLIC_CATEGORIES_ERROR"
        )
      );
  }
};

/**
 * Get category tree for public view
 * Only returns active categories
 */
export const getPublicCategoryTree = async (req: Request, res: Response) => {
  try {
    const categories = await prisma.category.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        parentId: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        children: {
          where: {
            isActive: true,
          },
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            parentId: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
            children: {
              where: {
                isActive: true,
              },
              select: {
                id: true,
                name: true,
                slug: true,
                description: true,
                parentId: true,
                isActive: true,
                createdAt: true,
                updatedAt: true,
              },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    });

    return res.status(200).json(ResponseHelper.success(categories));
  } catch (error) {
    console.error("Get public category tree error:", error);
    return res
      .status(500)
      .json(
        ResponseHelper.error(
          "Failed to get category tree",
          "GET_PUBLIC_CATEGORY_TREE_ERROR"
        )
      );
  }
};

/**
 * Get category by ID or slug for public view
 */
export const getPublicCategoryById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if the parameter is a valid UUID
    const isUUID =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id
      );

    // Build the where clause based on whether it's a UUID or slug
    const whereClause = isUUID
      ? {
          OR: [{ id: id }, { slug: id }],
          isActive: true,
        }
      : {
          slug: id,
          isActive: true,
        };

    // Try to find by ID first, then by slug
    const category = await prisma.category.findFirst({
      where: whereClause,
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        parentId: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        parent: {
          select: {
            id: true,
            name: true,
            slug: true,
            isActive: true,
          },
        },
        children: {
          where: {
            isActive: true,
          },
          select: {
            id: true,
            name: true,
            slug: true,
            isActive: true,
          },
        },
        _count: {
          select: {
            productCategories: {
              where: {
                product: {
                  isActive: true,
                },
              },
            },
            children: {
              where: {
                isActive: true,
              },
            },
          },
        },
      },
    });

    if (!category) {
      return res
        .status(404)
        .json(ResponseHelper.error("Category not found", "CATEGORY_NOT_FOUND"));
    }

    return res.status(200).json(ResponseHelper.success(category));
  } catch (error) {
    console.error("Get public category by ID error:", error);
    return res
      .status(500)
      .json(
        ResponseHelper.error(
          "Failed to get category",
          "GET_PUBLIC_CATEGORY_ERROR"
        )
      );
  }
};
