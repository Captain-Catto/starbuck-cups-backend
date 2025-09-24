/**
 * Capacities management controller
 * Handles CRUD operations for capacity entities
 */
import { Request, Response } from "express";
import { PrismaClient } from "../generated/prisma";
import { ResponseHelper } from "../types/api";
import { z } from "zod";
import { generateVietnameseSlug } from "../utils/vietnamese-slug";

const prisma = new PrismaClient();

// Validation schemas
const createCapacitySchema = z.object({
  name: z
    .string()
    .min(1, "Capacity name is required")
    .max(100, "Name too long"),
  slug: z.string().optional(),
  volumeMl: z.number().int().positive("Volume must be positive"),
});

const updateCapacitySchema = createCapacitySchema.partial();

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
  sortBy: z.enum(["name", "volumeMl", "createdAt", "updatedAt"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
});

/**
 * Get all capacities with pagination and filters
 */
export const getCapacities = async (req: Request, res: Response) => {
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
      sortBy = "volumeMl",
      sortOrder = "asc",
    } = queryValidation.data;

    const offset = (page - 1) * limit;

    // Build where clause
    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { slug: { contains: search, mode: "insensitive" } },
      ];
    }
    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    // Get total count and capacities
    const [total, capacities] = await Promise.all([
      prisma.capacity.count({ where }),
      prisma.capacity.findMany({
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
          _count: {
            select: {
              products: true,
            },
          },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return res.status(200).json(
      ResponseHelper.paginated(capacities, {
        current_page: page,
        per_page: limit,
        total_pages: totalPages,
        total_items: total,
        has_next: page < totalPages,
        has_prev: page > 1,
      })
    );
  } catch (error) {
    console.error("Get capacities error:", error);
    return res
      .status(500)
      .json(
        ResponseHelper.error(
          "Failed to retrieve capacities",
          "GET_CAPACITIES_ERROR"
        )
      );
  }
};

/**
 * Get capacity by ID
 */
export const getCapacityById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const capacity = await prisma.capacity.findUnique({
      where: { id },
      include: {
        createdByAdmin: {
          select: {
            username: true,
            email: true,
          },
        },
        _count: {
          select: {
            products: true,
          },
        },
      },
    });

    if (!capacity) {
      return res
        .status(404)
        .json(ResponseHelper.error("Capacity not found", "CAPACITY_NOT_FOUND"));
    }

    return res.status(200).json(ResponseHelper.success(capacity));
  } catch (error) {
    console.error("Get capacity error:", error);
    return res
      .status(500)
      .json(
        ResponseHelper.error(
          "Failed to retrieve capacity",
          "GET_CAPACITY_ERROR"
        )
      );
  }
};

/**
 * Create new capacity
 */
export const createCapacity = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res
        .status(401)
        .json(ResponseHelper.error("Authentication required", "UNAUTHORIZED"));
    }

    // Validate input
    const validationResult = createCapacitySchema.safeParse(req.body);
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

    const { name, slug, volumeMl } = validationResult.data;

    // Generate slug if not provided
    const finalSlug = slug || generateVietnameseSlug(name);

    // Check for duplicate name, slug, or volume
    const existingCapacity = await prisma.capacity.findFirst({
      where: {
        OR: [
          { name: { equals: name, mode: "insensitive" } },
          { slug: { equals: finalSlug, mode: "insensitive" } },
          { volumeMl: volumeMl },
        ],
      },
    });

    if (existingCapacity) {
      let duplicateField = "volume";
      if (existingCapacity.name.toLowerCase() === name.toLowerCase()) {
        duplicateField = "name";
      } else if (
        existingCapacity.slug?.toLowerCase() === finalSlug.toLowerCase()
      ) {
        duplicateField = "slug";
      }
      return res
        .status(409)
        .json(
          ResponseHelper.error(
            `Capacity with this ${duplicateField} already exists`,
            "DUPLICATE_CAPACITY"
          )
        );
    }

    // Create capacity
    const capacity = await prisma.capacity.create({
      data: {
        name: name.trim(),
        slug: finalSlug,
        volumeMl,
        createdByAdminId: req.user.userId,
      },
      include: {
        createdByAdmin: {
          select: {
            username: true,
            email: true,
          },
        },
        _count: {
          select: {
            products: true,
          },
        },
      },
    });

    return res.status(201).json(ResponseHelper.success(capacity));
  } catch (error) {
    console.error("Create capacity error:", error);
    return res
      .status(500)
      .json(
        ResponseHelper.error(
          "Failed to create capacity",
          "CREATE_CAPACITY_ERROR"
        )
      );
  }
};

/**
 * Update capacity
 */
export const updateCapacity = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res
        .status(401)
        .json(ResponseHelper.error("Authentication required", "UNAUTHORIZED"));
    }

    const { id } = req.params;

    // Check if capacity exists
    const existingCapacity = await prisma.capacity.findUnique({
      where: { id },
    });

    if (!existingCapacity) {
      return res
        .status(404)
        .json(ResponseHelper.error("Capacity not found", "CAPACITY_NOT_FOUND"));
    }

    // Validate input
    const validationResult = updateCapacitySchema.safeParse(req.body);
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

    // Check for duplicates if name, slug, or volumeMl is being updated
    if (updateData.name || updateData.slug || updateData.volumeMl) {
      const duplicateWhere: any = {
        id: { not: id },
        OR: [],
      };

      if (updateData.name) {
        duplicateWhere.OR.push({
          name: { equals: updateData.name, mode: "insensitive" },
        });
      }
      if (updateData.slug) {
        duplicateWhere.OR.push({
          slug: { equals: updateData.slug, mode: "insensitive" },
        });
      }
      if (updateData.volumeMl) {
        duplicateWhere.OR.push({ volumeMl: updateData.volumeMl });
      }

      const duplicateCapacity = await prisma.capacity.findFirst({
        where: duplicateWhere,
      });

      if (duplicateCapacity) {
        let duplicateField = "volume";
        if (
          duplicateCapacity.name.toLowerCase() ===
          updateData.name?.toLowerCase()
        ) {
          duplicateField = "name";
        } else if (
          duplicateCapacity.slug?.toLowerCase() ===
          updateData.slug?.toLowerCase()
        ) {
          duplicateField = "slug";
        }
        return res
          .status(409)
          .json(
            ResponseHelper.error(
              `Capacity with this ${duplicateField} already exists`,
              "DUPLICATE_CAPACITY"
            )
          );
      }
    }

    // Prepare update data
    const processedUpdateData: any = {};
    if (updateData.name) {
      processedUpdateData.name = updateData.name.trim();
      // Auto-generate slug from name if slug not provided
      if (!updateData.slug) {
        processedUpdateData.slug = generateVietnameseSlug(updateData.name);
      }
    }
    if (updateData.slug) {
      processedUpdateData.slug = updateData.slug.trim();
    }
    if (updateData.volumeMl) {
      processedUpdateData.volumeMl = updateData.volumeMl;
    }

    // Update capacity
    const updatedCapacity = await prisma.capacity.update({
      where: { id },
      data: processedUpdateData,
      include: {
        createdByAdmin: {
          select: {
            username: true,
            email: true,
          },
        },
        _count: {
          select: {
            products: true,
          },
        },
      },
    });

    return res.status(200).json(ResponseHelper.success(updatedCapacity));
  } catch (error) {
    console.error("Update capacity error:", error);
    return res
      .status(500)
      .json(
        ResponseHelper.error(
          "Failed to update capacity",
          "UPDATE_CAPACITY_ERROR"
        )
      );
  }
};

/**
 * Toggle capacity active status
 */
export const toggleCapacityStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const capacity = await prisma.capacity.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            products: true,
          },
        },
      },
    });

    if (!capacity) {
      return res
        .status(404)
        .json(ResponseHelper.error("Capacity not found", "CAPACITY_NOT_FOUND"));
    }

    // If deactivating, check if capacity is in use
    // Note: Temporarily disabled to allow deactivating capacity even when in use
    /*
    if (capacity.isActive && capacity._count.products > 0) {
      return res
        .status(409)
        .json(
          ResponseHelper.error(
            `Cannot deactivate capacity that is used by ${capacity._count.products} product(s)`,
            "CAPACITY_IN_USE"
          )
        );
    }
    */

    const updatedCapacity = await prisma.capacity.update({
      where: { id },
      data: { isActive: !capacity.isActive },
      include: {
        createdByAdmin: {
          select: {
            username: true,
            email: true,
          },
        },
        _count: {
          select: {
            products: true,
          },
        },
      },
    });

    return res.status(200).json(ResponseHelper.success(updatedCapacity));
  } catch (error) {
    console.error("Toggle capacity status error:", error);
    return res
      .status(500)
      .json(
        ResponseHelper.error(
          "Failed to toggle capacity status",
          "TOGGLE_CAPACITY_ERROR"
        )
      );
  }
};

/**
 * Delete capacity
 */
export const deleteCapacity = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const capacity = await prisma.capacity.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            products: true,
          },
        },
      },
    });

    if (!capacity) {
      return res
        .status(404)
        .json(ResponseHelper.error("Capacity not found", "CAPACITY_NOT_FOUND"));
    }

    // Check if capacity is in use
    if (capacity._count.products > 0) {
      return res
        .status(409)
        .json(
          ResponseHelper.error(
            `Cannot delete capacity that is used by ${capacity._count.products} product(s). Consider deactivating instead.`,
            "CAPACITY_IN_USE"
          )
        );
    }

    // Delete capacity
    await prisma.capacity.delete({
      where: { id },
    });

    return res.status(200).json(
      ResponseHelper.success(null, {
        message: "Capacity deleted successfully",
      })
    );
  } catch (error) {
    console.error("Delete capacity error:", error);
    return res
      .status(500)
      .json(
        ResponseHelper.error(
          "Failed to delete capacity",
          "DELETE_CAPACITY_ERROR"
        )
      );
  }
};

/**
 * Search capacities for autocomplete
 */
export const searchCapacities = async (req: Request, res: Response) => {
  try {
    const { q: query = "", active = "true" } = req.query;

    const where: any = {
      isActive: active === "true",
    };

    if (query) {
      const numericQuery = Number(query);
      if (!isNaN(numericQuery)) {
        // If query is numeric, search in volumeMl
        where.volumeMl = numericQuery;
      } else {
        // If query is text, search in name
        where.OR = [
          { name: { contains: query as string, mode: "insensitive" } },
          { slug: { contains: query as string, mode: "insensitive" } },
        ];
      }
    }

    const capacities = await prisma.capacity.findMany({
      where,
      select: {
        id: true,
        name: true,
        slug: true,
        volumeMl: true,
      },
      orderBy: { volumeMl: "asc" },
      take: 50,
    });

    return res.status(200).json(ResponseHelper.success(capacities));
  } catch (error) {
    console.error("Search capacities error:", error);
    return res
      .status(500)
      .json(
        ResponseHelper.error(
          "Failed to search capacities",
          "SEARCH_CAPACITIES_ERROR"
        )
      );
  }
};

// ============================================================================
// PUBLIC CONTROLLERS (No authentication required)
// ============================================================================

/**
 * Get capacities for public view (customers)
 * Only returns active capacities
 */
/**
 * Get capacity by ID or slug for public view
 */
export const getPublicCapacityById = async (req: Request, res: Response) => {
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

    const capacity = await prisma.capacity.findFirst({
      where: whereClause,
      select: {
        id: true,
        name: true,
        slug: true,
        volumeMl: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            products: {
              where: {
                isActive: true,
              },
            },
          },
        },
      },
    });

    if (!capacity) {
      return res
        .status(404)
        .json(ResponseHelper.error("Capacity not found", "CAPACITY_NOT_FOUND"));
    }

    return res.status(200).json(ResponseHelper.success(capacity));
  } catch (error) {
    console.error("Get public capacity by id error:", error);
    return res
      .status(500)
      .json(
        ResponseHelper.error(
          "Failed to retrieve capacity",
          "GET_PUBLIC_CAPACITY_ERROR"
        )
      );
  }
};

export const getPublicCapacities = async (req: Request, res: Response) => {
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

    const {
      page = 1,
      limit = 50,
      search,
      sortBy = "volumeMl",
      sortOrder = "asc",
    } = validation.data;
    const offset = (page - 1) * limit;

    // Build where clause for public capacities (only active)
    const where: any = {
      isActive: true,
    };

    if (search) {
      where.name = {
        contains: search,
        mode: "insensitive",
      };
    }

    // Build orderBy
    const orderBy: any = {};
    orderBy[sortBy] = sortOrder;

    const [items, totalItems] = await Promise.all([
      prisma.capacity.findMany({
        where,
        select: {
          id: true,
          name: true,
          slug: true,
          volumeMl: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              products: {
                where: {
                  isActive: true,
                },
              },
            },
          },
        },
        orderBy,
        skip: offset,
        take: limit,
      }),
      prisma.capacity.count({ where }),
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
    console.error("Get public capacities error:", error);
    return res
      .status(500)
      .json(
        ResponseHelper.error(
          "Failed to get capacities",
          "GET_PUBLIC_CAPACITIES_ERROR"
        )
      );
  }
};
