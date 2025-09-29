/**
 * Capacities management controller
 * Handles CRUD operations for capacity entities
 */
import { Request, Response } from "express";
import { models } from "../models";

const { Capacity, AdminUser, Product } = models;

import { ResponseHelper } from "../types/api";
import { z } from "zod";
import { Op } from "sequelize";
import { generateVietnameseSlug } from "../utils/vietnamese-slug";

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
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { slug: { [Op.like]: `%${search}%` } },
      ];
    }
    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    // Get total count and capacities
    const [total, capacities] = await Promise.all([
      Capacity.count({ where }),
      Capacity.findAll({
        where,
        offset: offset,
        limit: limit,
        order: [[sortBy, sortOrder.toUpperCase()]],
        include: [
          {
            model: AdminUser,
            as: "createdByAdmin",
            attributes: ["username", "email"],
          },
        ],
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
 * Get all capacities for admin with product counts
 */
export const getCapacitiesForAdmin = async (req: Request, res: Response) => {
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
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { slug: { [Op.like]: `%${search}%` } },
      ];
    }
    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    // Get total count and capacities with product counts
    const [total, capacities] = await Promise.all([
      Capacity.count({ where }),
      Capacity.findAll({
        where,
        offset: offset,
        limit: limit,
        order: [[sortBy, sortOrder.toUpperCase()]],
        include: [
          {
            model: AdminUser,
            as: "createdByAdmin",
            attributes: ["username", "email"],
          },
          {
            model: Product,
            as: "products",
            attributes: ["id"],
          },
        ],
      }),
    ]);

    // Transform the data to match expected format
    const transformedCapacities = capacities.map((capacity: any) => ({
      ...capacity.toJSON(),
      _count: {
        products: capacity.products ? capacity.products.length : 0,
      },
    }));

    const totalPages = Math.ceil(total / limit);

    return res.status(200).json(
      ResponseHelper.paginated(transformedCapacities, {
        current_page: page,
        per_page: limit,
        total_pages: totalPages,
        total_items: total,
        has_next: page < totalPages,
        has_prev: page > 1,
      })
    );
  } catch (error) {
    console.error("Get capacities for admin error:", error);
    return res
      .status(500)
      .json(
        ResponseHelper.error(
          "Failed to retrieve capacities for admin",
          "GET_CAPACITIES_ADMIN_ERROR"
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

    const capacity = await Capacity.findOne({
      where: { id },
      include: [
        {
          model: AdminUser,
          as: "createdByAdmin",
          attributes: ["username", "email"],
        },
      ],
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
    const existingCapacity = await Capacity.findOne({
      where: {
        [Op.or]: [
          { name: { [Op.like]: name } },
          { slug: { [Op.like]: finalSlug } },
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
    const capacity = await Capacity.create({
      name: name.trim(),
      slug: finalSlug,
      volumeMl,
      isActive: true,
      createdByAdminId: req.user.userId,
    });

    // Fetch the created capacity with associations
    const createdCapacity = await Capacity.findOne({
      where: { id: capacity.id },
      include: [
        {
          model: AdminUser,
          as: "createdByAdmin",
          attributes: ["username", "email"],
        },
      ],
    });

    return res.status(201).json(ResponseHelper.success(createdCapacity));
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
    const existingCapacity = await Capacity.findOne({
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
        id: { [Op.ne]: id },
        [Op.or]: [],
      };

      if (updateData.name) {
        duplicateWhere[Op.or].push({
          name: { [Op.like]: updateData.name },
        });
      }
      if (updateData.slug) {
        duplicateWhere[Op.or].push({
          slug: { [Op.like]: updateData.slug },
        });
      }
      if (updateData.volumeMl) {
        duplicateWhere[Op.or].push({ volumeMl: updateData.volumeMl });
      }

      const duplicateCapacity = await Capacity.findOne({
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
    await Capacity.update(processedUpdateData, {
      where: { id },
    });

    // Fetch the updated capacity with associations
    const updatedCapacity = await Capacity.findOne({
      where: { id },
      include: [
        {
          model: AdminUser,
          as: "createdByAdmin",
          attributes: ["username", "email"],
        },
      ],
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

    const capacity = await Capacity.findOne({
      where: { id },
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

    await Capacity.update(
      { isActive: !capacity.isActive },
      {
        where: { id },
      }
    );

    // Fetch the updated capacity with associations
    const updatedCapacity = await Capacity.findOne({
      where: { id },
      include: [
        {
          model: AdminUser,
          as: "createdByAdmin",
          attributes: ["username", "email"],
        },
      ],
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

    const capacity = await Capacity.findOne({
      where: { id },
    });

    if (!capacity) {
      return res
        .status(404)
        .json(ResponseHelper.error("Capacity not found", "CAPACITY_NOT_FOUND"));
    }

    // Check if capacity is in use
    // Note: For now we'll skip the product count check since _count is Prisma-specific
    // You may need to implement a separate query to count related products

    // Delete capacity
    await Capacity.destroy({
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
        where[Op.or] = [
          { name: { [Op.like]: `%${query}%` } },
          { slug: { [Op.like]: `%${query}%` } },
        ];
      }
    }

    const capacities = await Capacity.findAll({
      where,
      attributes: ["id", "name", "slug", "volumeMl"],
      order: [["volumeMl", "ASC"]],
      limit: 50,
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
          [Op.or]: [{ id: id }, { slug: id }],
          isActive: true,
        }
      : {
          slug: id,
          isActive: true,
        };

    const capacity = await Capacity.findOne({
      where: whereClause,
      attributes: [
        "id",
        "name",
        "slug",
        "volumeMl",
        "isActive",
        "createdAt",
        "updatedAt",
      ],
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
        [Op.like]: `%${search}%`,
      };
    }

    // Build orderBy
    const orderBy: any = {};
    orderBy[sortBy] = sortOrder;

    const [items, totalItems] = await Promise.all([
      Capacity.findAll({
        where,
        attributes: [
          "id",
          "name",
          "slug",
          "volumeMl",
          "isActive",
          "createdAt",
          "updatedAt",
        ],
        order: [[sortBy, sortOrder.toUpperCase()]],
        offset: offset,
        limit: limit,
      }),
      Capacity.count({ where }),
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
