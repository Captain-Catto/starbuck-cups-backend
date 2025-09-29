/**
 * Colors management controller
 * Handles CRUD operations for color entities
 */
import { Request, Response } from "express";
import { models } from "../models";

const { Color, AdminUser, ProductColor, Product } = models;

import { ResponseHelper } from "../types/api";
import { z } from "zod";
import { generateVietnameseSlug } from "../utils/vietnamese-slug";
import { Op } from "sequelize";

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

// Query validation schema
const getColorsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  isActive: z.enum(["true", "false", "all"]).default("all"),
  sortBy: z.enum(["name", "createdAt", "updatedAt"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
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
  sortBy: z.enum(["name", "createdAt", "updatedAt"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
});

/**
 * Get all colors with pagination and filtering
 */
export const getColors = async (req: Request, res: Response) => {
  try {
    const query = getColorsQuerySchema.parse(req.query);
    const {
      page,
      limit,
      search,
      isActive,
      sortBy = "createdAt",
      sortOrder,
    } = query;

    const offset = (page - 1) * limit;

    // Build where conditions
    const where: any = {};

    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { slug: { [Op.like]: `%${search}%` } },
        { hexCode: { [Op.like]: `%${search}%` } },
      ];
    }

    if (isActive !== "all") {
      where.isActive = isActive === "true";
    }

    // Get total count and colors (simplified version without subquery)
    const { count: total, rows: colors } = await Color.findAndCountAll({
      where,
      offset,
      limit,
      order: [[sortBy, sortOrder.toUpperCase()]],
      include: [
        {
          model: AdminUser,
          as: "createdByAdmin",
          attributes: ["username", "email"],
        },
      ],
    });

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
 * Get all colors for admin with product counts
 */
export const getColorsForAdmin = async (req: Request, res: Response) => {
  try {
    const query = getColorsQuerySchema.parse(req.query);
    const {
      page,
      limit,
      search,
      isActive,
      sortBy = "createdAt",
      sortOrder,
    } = query;

    const offset = (page - 1) * limit;

    // Build where conditions
    const where: any = {};

    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { slug: { [Op.like]: `%${search}%` } },
        { hexCode: { [Op.like]: `%${search}%` } },
      ];
    }

    if (isActive !== "all") {
      where.isActive = isActive === "true";
    }

    // Get total count and colors with product counts
    const { count: total, rows: colors } = await Color.findAndCountAll({
      where,
      offset,
      limit,
      order: [[sortBy, sortOrder.toUpperCase()]],
      include: [
        {
          model: AdminUser,
          as: "createdByAdmin",
          attributes: ["username", "email"],
        },
        {
          model: ProductColor,
          as: "productColors",
          attributes: ["id"],
        },
      ],
      distinct: true,
    });

    // Transform the data to match expected format
    const transformedColors = colors.map((color: any) => ({
      ...color.toJSON(),
      _count: {
        productColors: color.productColors ? color.productColors.length : 0,
      },
    }));

    const totalPages = Math.ceil(total / limit);

    return res.status(200).json(
      ResponseHelper.paginated(transformedColors, {
        current_page: page,
        per_page: limit,
        total_pages: totalPages,
        total_items: total,
        has_next: page < totalPages,
        has_prev: page > 1,
      })
    );
  } catch (error) {
    console.error("Get colors for admin error:", error);
    return res
      .status(500)
      .json(
        ResponseHelper.error(
          "Failed to retrieve colors for admin",
          "GET_COLORS_ADMIN_ERROR"
        )
      );
  }
};

/**
 * Get color by ID
 */
export const getColorById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const color = await Color.findByPk(id, {
      include: [
        {
          model: AdminUser,
          as: "createdByAdmin",
          attributes: ["username", "email"],
        },
        {
          model: ProductColor,
          as: "productColors",
          attributes: ["id"],
        },
      ],
    });

    if (!color) {
      return res
        .status(404)
        .json(ResponseHelper.error("Color not found", "COLOR_NOT_FOUND"));
    }

    // Transform the data to include product count
    const transformedColor = {
      ...color.toJSON(),
      _count: {
        productColors: color.productColors ? color.productColors.length : 0,
      },
    };

    return res.status(200).json(ResponseHelper.success(transformedColor));
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

    // Check if slug already exists
    const existingSlug = await Color.findOne({
      where: { slug: finalSlug },
    });

    if (existingSlug) {
      return res
        .status(409)
        .json(
          ResponseHelper.error(
            "Color with this slug already exists",
            "SLUG_EXISTS"
          )
        );
    }

    // Check if hex code already exists
    const existingHexCode = await Color.findOne({
      where: { hexCode },
    });

    if (existingHexCode) {
      return res
        .status(409)
        .json(
          ResponseHelper.error(
            "Color with this hex code already exists",
            "HEX_CODE_EXISTS"
          )
        );
    }

    // Create color
    const color = await Color.create({
      name,
      slug: finalSlug,
      hexCode,
      isActive: true,
      createdByAdminId: req.user.userId,
    });

    // Fetch created color with admin details
    const createdColor = await Color.findByPk(color.id, {
      include: [
        {
          model: AdminUser,
          as: "createdByAdmin",
          attributes: ["username", "email"],
        },
      ],
    });

    return res.status(201).json(ResponseHelper.success(createdColor));
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

    // Check if color exists
    const existingColor = await Color.findByPk(id);
    if (!existingColor) {
      return res
        .status(404)
        .json(ResponseHelper.error("Color not found", "COLOR_NOT_FOUND"));
    }

    const updateData = validationResult.data;

    // Generate slug if name is being updated and slug is not provided
    if (updateData.name && !updateData.slug) {
      updateData.slug = generateVietnameseSlug(updateData.name);
    }

    // Check for slug conflicts (excluding current color)
    if (updateData.slug) {
      const existingSlug = await Color.findOne({
        where: {
          slug: updateData.slug,
          id: { [Op.ne]: id },
        },
      });

      if (existingSlug) {
        return res
          .status(409)
          .json(
            ResponseHelper.error(
              "Color with this slug already exists",
              "SLUG_EXISTS"
            )
          );
      }
    }

    // Check for hex code conflicts (excluding current color)
    if (updateData.hexCode) {
      const existingHexCode = await Color.findOne({
        where: {
          hexCode: updateData.hexCode,
          id: { [Op.ne]: id },
        },
      });

      if (existingHexCode) {
        return res
          .status(409)
          .json(
            ResponseHelper.error(
              "Color with this hex code already exists",
              "HEX_CODE_EXISTS"
            )
          );
      }
    }

    // Update color
    await existingColor.update(updateData);

    // Fetch updated color with admin details
    const updatedColor = await Color.findByPk(id, {
      include: [
        {
          model: AdminUser,
          as: "createdByAdmin",
          attributes: ["username", "email"],
        },
      ],
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
 * Delete color (soft delete)
 */
export const deleteColor = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res
        .status(401)
        .json(ResponseHelper.error("Authentication required", "UNAUTHORIZED"));
    }

    const { id } = req.params;

    const color = await Color.findByPk(id);
    if (!color) {
      return res
        .status(404)
        .json(ResponseHelper.error("Color not found", "COLOR_NOT_FOUND"));
    }

    // Check if color is being used in any products
    const productColorCount = await ProductColor.count({
      where: { colorId: id },
    });

    console.log(`Color ${id} is used by ${productColorCount} products`);

    // Also check with raw query to be sure
    const [rawCount] =
      (await ProductColor.sequelize?.query(
        "SELECT COUNT(*) as count FROM product_colors WHERE color_id = $1",
        {
          bind: [id],
        }
      )) || [];
    console.log(`Raw count for color ${id}:`, rawCount);

    if (productColorCount > 0) {
      return res
        .status(409)
        .json(
          ResponseHelper.error(
            "Cannot delete color that is being used by products",
            "COLOR_IN_USE"
          )
        );
    }

    // Hard delete if no products are using this color
    console.log(`Deleting color ${id}...`);
    await color.destroy();
    console.log(`Color ${id} deleted successfully`);

    return res
      .status(200)
      .json(ResponseHelper.success({ message: "Color deleted successfully" }));
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
 * Toggle color active status
 */
export const toggleColorStatus = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res
        .status(401)
        .json(ResponseHelper.error("Authentication required", "UNAUTHORIZED"));
    }

    const { id } = req.params;

    const color = await Color.findByPk(id);
    if (!color) {
      return res
        .status(404)
        .json(ResponseHelper.error("Color not found", "COLOR_NOT_FOUND"));
    }

    // Toggle active status
    await color.update({
      isActive: !color.isActive,
    });

    // Fetch updated color with admin details
    const updatedColor = await Color.findByPk(id, {
      include: [
        {
          model: AdminUser,
          as: "createdByAdmin",
          attributes: ["username", "email"],
        },
      ],
    });

    return res.status(200).json(ResponseHelper.success(updatedColor));
  } catch (error) {
    console.error("Toggle color status error:", error);
    return res
      .status(500)
      .json(
        ResponseHelper.error(
          "Failed to toggle color status",
          "TOGGLE_COLOR_STATUS_ERROR"
        )
      );
  }
};

/**
 * Get active colors for public use
 */
export const getActiveColors = async (req: Request, res: Response) => {
  try {
    const colors = await Color.findAll({
      where: {
        isActive: true,
      },
      order: [["name", "ASC"]],
      attributes: ["id", "name", "slug", "hexCode"],
    });

    return res.status(200).json(ResponseHelper.success(colors));
  } catch (error) {
    console.error("Get active colors error:", error);
    return res
      .status(500)
      .json(
        ResponseHelper.error(
          "Failed to retrieve active colors",
          "GET_ACTIVE_COLORS_ERROR"
        )
      );
  }
};

/**
 * Search colors by query string
 */
export const searchColors = async (req: Request, res: Response) => {
  try {
    const { q: query = "", active = "true" } = req.query;

    const where: any = {
      isActive: active === "true",
    };

    if (query && typeof query === "string") {
      where[Op.or] = [
        { name: { [Op.like]: `%${query}%` } },
        { slug: { [Op.like]: `%${query}%` } },
        { hexCode: { [Op.like]: `%${query}%` } },
      ];
    }

    const colors = await Color.findAll({
      where,
      attributes: ["id", "name", "slug", "hexCode"],
      order: [["name", "ASC"]],
      limit: 50,
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
    const where: any = {
      isActive: true,
    };

    if (isUUID) {
      where[Op.or] = [{ id: id }, { slug: id }];
    } else {
      where.slug = id;
    }

    const color = await Color.findOne({
      where,
      attributes: [
        "id",
        "name",
        "slug",
        "hexCode",
        "isActive",
        "createdAt",
        "updatedAt",
      ],
      include: [
        {
          model: ProductColor,
          as: "productColors",
          attributes: [],
          include: [
            {
              model: Product,
              as: "product",
              where: { isActive: true },
              attributes: [],
              required: false,
            },
          ],
          required: false,
        },
      ],
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

/**
 * Get colors for public view (customers)
 * Only returns active colors
 */
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
        [Op.like]: `%${search}%`,
      };
    }

    // Build order
    const orderField = sortBy === "createdAt" ? "createdAt" : "name";
    const orderDirection = sortOrder.toUpperCase() as "ASC" | "DESC";

    const { count: totalItems, rows: items } = await Color.findAndCountAll({
      where,
      attributes: [
        "id",
        "name",
        "slug",
        "hexCode",
        "isActive",
        "createdAt",
        "updatedAt",
      ],
      include: [
        {
          model: ProductColor,
          as: "productColors",
          attributes: [],
          include: [
            {
              model: Product,
              as: "product",
              where: { isActive: true },
              attributes: [],
              required: false,
            },
          ],
          required: false,
        },
      ],
      order: [[orderField, orderDirection]],
      offset,
      limit,
    });

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
