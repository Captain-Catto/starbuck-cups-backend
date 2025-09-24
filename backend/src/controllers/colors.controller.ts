/**
 * Colors management controller
 * Handles CRUD operations for color entities
 */
import { Request, Response } from "express";
import { PrismaClient } from "../generated/prisma";
import { ResponseHelper } from "../types/api";
import { z } from "zod";
import { generateVietnameseSlug } from "../utils/vietnamese-slug";

const prisma = new PrismaClient();

// Validation schemas
const createColorSchema = z.object({
  name: z.string().min(1, "Color name is required").max(100, "Name too long"),
  slug: z.string().optional(),
  hexCode: z
    .string()
    .transform((val) => {
      // Normalize hex code
      let hex = val.trim().toUpperCase();

      // Add # if missing
      if (!hex.startsWith("#")) {
        hex = "#" + hex;
      }

      // Remove # for processing
      const hexDigits = hex.slice(1);

      // Pad with zeros if needed (e.g., #F -> #FF0000, #FFF -> #FFF000)
      let paddedHex = hexDigits;
      if (hexDigits.length === 1) {
        paddedHex = hexDigits + "00000";
      } else if (hexDigits.length === 2) {
        paddedHex = hexDigits + "0000";
      } else if (hexDigits.length === 3) {
        paddedHex = hexDigits + "000";
      } else if (hexDigits.length === 4) {
        paddedHex = hexDigits + "00";
      } else if (hexDigits.length === 5) {
        paddedHex = hexDigits + "0";
      }

      return "#" + paddedHex.slice(0, 6); // Ensure exactly 6 characters
    })
    .pipe(z.string().regex(/^#[0-9A-F]{6}$/i, "Invalid hex color code format")),
});

const updateColorSchema = createColorSchema.partial();

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
  sortBy: z.enum(["name", "createdAt", "updatedAt"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
});

/**
 * Get all colors with pagination and filters
 */
export const getColors = async (req: Request, res: Response) => {
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
      sortBy = "createdAt",
      sortOrder = "desc",
    } = queryValidation.data;

    const offset = (page - 1) * limit;

    // Build where clause
    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { slug: { contains: search, mode: "insensitive" } },
        { hexCode: { contains: search, mode: "insensitive" } },
      ];
    }
    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    // Get total count and colors
    const [total, colors] = await Promise.all([
      prisma.color.count({ where }),
      prisma.color.findMany({
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
              productColors: true,
            },
          },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return res.status(200).json(
      ResponseHelper.paginated(colors, {
        current_page: page,
        per_page: limit,
        total_pages: totalPages,
        total_items: total,
        has_next: page < totalPages,
        has_prev: page > 1,
      })
    );
  } catch (error) {
    console.error("Get colors error:", error);
    return res
      .status(500)
      .json(
        ResponseHelper.error("Failed to retrieve colors", "GET_COLORS_ERROR")
      );
  }
};

/**
 * Get color by ID
 */
export const getColorById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const color = await prisma.color.findUnique({
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
            productColors: true,
          },
        },
      },
    });

    if (!color) {
      return res
        .status(404)
        .json(ResponseHelper.error("Color not found", "COLOR_NOT_FOUND"));
    }

    return res.status(200).json(ResponseHelper.success(color));
  } catch (error) {
    console.error("Get color error:", error);
    return res
      .status(500)
      .json(
        ResponseHelper.error("Failed to retrieve color", "GET_COLOR_ERROR")
      );
  }
};

/**
 * Create new color
 */
export const createColor = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res
        .status(401)
        .json(ResponseHelper.error("Authentication required", "UNAUTHORIZED"));
    }

    // Validate input
    const validationResult = createColorSchema.safeParse(req.body);
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

    const { name, slug, hexCode } = validationResult.data;

    // Generate slug if not provided
    const finalSlug = slug || generateVietnameseSlug(name);

    // Check for duplicate name, slug, or hex code
    const existingColor = await prisma.color.findFirst({
      where: {
        OR: [
          { name: { equals: name, mode: "insensitive" } },
          { slug: { equals: finalSlug, mode: "insensitive" } },
          { hexCode: { equals: hexCode, mode: "insensitive" } },
        ],
      },
    });

    if (existingColor) {
      let duplicateField = "hex code";
      if (existingColor.name.toLowerCase() === name.toLowerCase()) {
        duplicateField = "name";
      } else if (
        existingColor.slug?.toLowerCase() === finalSlug.toLowerCase()
      ) {
        duplicateField = "slug";
      }
      return res
        .status(409)
        .json(
          ResponseHelper.error(
            `Color with this ${duplicateField} already exists`,
            "DUPLICATE_COLOR"
          )
        );
    }

    // Create color
    const color = await prisma.color.create({
      data: {
        name: name.trim(),
        slug: finalSlug,
        hexCode: hexCode.toUpperCase(),
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
            productColors: true,
          },
        },
      },
    });

    return res.status(201).json(ResponseHelper.success(color));
  } catch (error) {
    console.error("Create color error:", error);
    return res
      .status(500)
      .json(
        ResponseHelper.error("Failed to create color", "CREATE_COLOR_ERROR")
      );
  }
};

/**
 * Update color
 */
export const updateColor = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res
        .status(401)
        .json(ResponseHelper.error("Authentication required", "UNAUTHORIZED"));
    }

    const { id } = req.params;

    // Check if color exists
    const existingColor = await prisma.color.findUnique({
      where: { id },
    });

    if (!existingColor) {
      return res
        .status(404)
        .json(ResponseHelper.error("Color not found", "COLOR_NOT_FOUND"));
    }

    // Validate input
    const validationResult = updateColorSchema.safeParse(req.body);
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

    // Check for duplicates if name, slug, or hexCode is being updated
    if (updateData.name || updateData.slug || updateData.hexCode) {
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
      if (updateData.hexCode) {
        duplicateWhere.OR.push({
          hexCode: { equals: updateData.hexCode, mode: "insensitive" },
        });
      }

      const duplicateColor = await prisma.color.findFirst({
        where: duplicateWhere,
      });

      if (duplicateColor) {
        let duplicateField = "hex code";
        if (
          duplicateColor.name.toLowerCase() === updateData.name?.toLowerCase()
        ) {
          duplicateField = "name";
        } else if (
          duplicateColor.slug?.toLowerCase() === updateData.slug?.toLowerCase()
        ) {
          duplicateField = "slug";
        }
        return res
          .status(409)
          .json(
            ResponseHelper.error(
              `Color with this ${duplicateField} already exists`,
              "DUPLICATE_COLOR"
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
    if (updateData.hexCode) {
      processedUpdateData.hexCode = updateData.hexCode.toUpperCase();
    }

    // Update color
    const updatedColor = await prisma.color.update({
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
            productColors: true,
          },
        },
      },
    });

    return res.status(200).json(ResponseHelper.success(updatedColor));
  } catch (error) {
    console.error("Update color error:", error);
    return res
      .status(500)
      .json(
        ResponseHelper.error("Failed to update color", "UPDATE_COLOR_ERROR")
      );
  }
};

/**
 * Toggle color active status
 */
export const toggleColorStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const color = await prisma.color.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            productColors: true,
          },
        },
      },
    });

    if (!color) {
      return res
        .status(404)
        .json(ResponseHelper.error("Color not found", "COLOR_NOT_FOUND"));
    }

    // Allow deactivating colors even when in use (products keep their color reference)
    // Note: Deactivated colors won't appear in new product creation but existing products retain their color
    // if (color.isActive && color._count.productColors > 0) {
    //   return res
    //     .status(409)
    //     .json(
    //       ResponseHelper.error(
    //         `Cannot deactivate color that is used by ${color._count.productColors} product(s)`,
    //         "COLOR_IN_USE"
    //       )
    //     );
    // }

    const updatedColor = await prisma.color.update({
      where: { id },
      data: { isActive: !color.isActive },
      include: {
        createdByAdmin: {
          select: {
            username: true,
            email: true,
          },
        },
        _count: {
          select: {
            productColors: true,
          },
        },
      },
    });

    return res.status(200).json(ResponseHelper.success(updatedColor));
  } catch (error) {
    console.error("Toggle color status error:", error);
    return res
      .status(500)
      .json(
        ResponseHelper.error(
          "Failed to toggle color status",
          "TOGGLE_COLOR_ERROR"
        )
      );
  }
};

/**
 * Delete color (soft delete if in use)
 */
export const deleteColor = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const color = await prisma.color.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            productColors: true,
          },
        },
      },
    });

    if (!color) {
      return res
        .status(404)
        .json(ResponseHelper.error("Color not found", "COLOR_NOT_FOUND"));
    }

    // Check if color is in use
    if (color._count.productColors > 0) {
      return res
        .status(409)
        .json(
          ResponseHelper.error(
            `Cannot delete color that is used by ${color._count.productColors} product(s). Consider deactivating instead.`,
            "COLOR_IN_USE"
          )
        );
    }

    // Delete color
    await prisma.color.delete({
      where: { id },
    });

    return res
      .status(200)
      .json(
        ResponseHelper.success(null, { message: "Color deleted successfully" })
      );
  } catch (error) {
    console.error("Delete color error:", error);
    return res
      .status(500)
      .json(
        ResponseHelper.error("Failed to delete color", "DELETE_COLOR_ERROR")
      );
  }
};

/**
 * Search colors for autocomplete
 */
export const searchColors = async (req: Request, res: Response) => {
  try {
    const { q: query = "", active = "true" } = req.query;

    const where: any = {
      isActive: active === "true",
    };

    if (query) {
      where.OR = [
        { name: { contains: query as string, mode: "insensitive" } },
        { slug: { contains: query as string, mode: "insensitive" } },
        { hexCode: { contains: query as string, mode: "insensitive" } },
      ];
    }

    const colors = await prisma.color.findMany({
      where,
      select: {
        id: true,
        name: true,
        slug: true,
        hexCode: true,
      },
      orderBy: { name: "asc" },
      take: 50,
    });

    return res.status(200).json(ResponseHelper.success(colors));
  } catch (error) {
    console.error("Search colors error:", error);
    return res
      .status(500)
      .json(
        ResponseHelper.error("Failed to search colors", "SEARCH_COLORS_ERROR")
      );
  }
};

// ============================================================================
// PUBLIC CONTROLLERS (No authentication required)
// ============================================================================

/**
 * Get colors for public view (customers)
 * Only returns active colors
 */
/**
 * Get color by ID or slug for public view
 */
export const getPublicColorById = async (req: Request, res: Response) => {
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

    const color = await prisma.color.findFirst({
      where: whereClause,
      select: {
        id: true,
        name: true,
        slug: true,
        hexCode: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            productColors: {
              where: {
                product: {
                  isActive: true,
                },
              },
            },
          },
        },
      },
    });

    if (!color) {
      return res
        .status(404)
        .json(ResponseHelper.error("Color not found", "COLOR_NOT_FOUND"));
    }

    return res.status(200).json(ResponseHelper.success(color));
  } catch (error) {
    console.error("Get public color by id error:", error);
    return res
      .status(500)
      .json(
        ResponseHelper.error(
          "Failed to retrieve color",
          "GET_PUBLIC_COLOR_ERROR"
        )
      );
  }
};

export const getPublicColors = async (req: Request, res: Response) => {
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
      sortBy = "name",
      sortOrder = "asc",
    } = validation.data;
    const offset = (page - 1) * limit;

    // Build where clause for public colors (only active)
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
      prisma.color.findMany({
        where,
        select: {
          id: true,
          name: true,
          slug: true,
          hexCode: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              productColors: {
                where: {
                  product: {
                    isActive: true,
                  },
                },
              },
            },
          },
        },
        orderBy,
        skip: offset,
        take: limit,
      }),
      prisma.color.count({ where }),
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
    console.error("Get public colors error:", error);
    return res
      .status(500)
      .json(
        ResponseHelper.error("Failed to get colors", "GET_PUBLIC_COLORS_ERROR")
      );
  }
};
