import { Request, Response } from "express";
import { PromotionalBanner, AdminUser } from "../models";
import { z } from "zod";
import { Op } from "sequelize";
import { sequelize } from "../config/database";

// Validation schemas
const createPromotionalBannerSchema = z.object({
  title: z.string().min(1).max(255),
  highlightText: z.string().max(255).optional().nullable(),
  highlightColor: z.string().max(50).optional().nullable(),
  description: z.string().min(1),
  buttonText: z.string().min(1).max(100),
  buttonLink: z.string().min(1).max(500),
  priority: z.number().int().min(0).optional(),
  validFrom: z.string().optional().nullable(),
  validUntil: z.string().optional().nullable(),
});

const updatePromotionalBannerSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  highlightText: z.string().max(255).optional().nullable(),
  highlightColor: z.string().max(50).optional().nullable(),
  description: z.string().min(1).optional(),
  buttonText: z.string().min(1).max(100).optional(),
  buttonLink: z.string().min(1).max(500).optional(),
  isActive: z.boolean().optional(),
  priority: z.number().int().min(0).optional(),
  validFrom: z.string().optional().nullable(),
  validUntil: z.string().optional().nullable(),
});

/**
 * Get active promotional banner (public endpoint)
 * Returns the highest priority active banner within valid date range
 */
export const getActivePromotionalBanner = async (
  req: Request,
  res: Response
) => {
  try {
    const now = new Date();

    const banner = await PromotionalBanner.findOne({
      where: {
        isActive: true,
        [Op.or]: [
          {
            validFrom: null,
            validUntil: null,
          },
          {
            validFrom: { [Op.lte]: now },
            validUntil: { [Op.gte]: now },
          },
          {
            validFrom: { [Op.lte]: now },
            validUntil: null,
          },
          {
            validFrom: null,
            validUntil: { [Op.gte]: now },
          },
        ],
      },
      order: [
        ["priority", "DESC"],
        ["createdAt", "DESC"],
      ],
      attributes: [
        "id",
        "title",
        "highlightText",
        "highlightColor",
        "description",
        "buttonText",
        "buttonLink",
        "priority",
        "createdAt",
        "updatedAt",
      ],
    });

    res.json({
      success: true,
      data: banner,
    });
  } catch (error: any) {
    console.error("Error fetching active promotional banner:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch promotional banner",
      error: error?.message || "Unknown error",
    });
  }
};

/**
 * Get all promotional banners for admin (includes inactive)
 */
export const getAdminPromotionalBanners = async (
  req: Request,
  res: Response
) => {
  try {
    const banners = await PromotionalBanner.findAll({
      order: [
        ["priority", "DESC"],
        ["createdAt", "DESC"],
      ],
      include: [
        {
          model: AdminUser,
          as: "createdByAdmin",
          attributes: ["id", "username"],
        },
      ],
    });

    res.json({
      success: true,
      data: banners,
    });
  } catch (error: any) {
    console.error("Error fetching admin promotional banners:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch promotional banners",
      error: error?.message || "Unknown error",
    });
  }
};

/**
 * Get single promotional banner by ID
 */
export const getPromotionalBannerById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const banner = await PromotionalBanner.findByPk(id, {
      include: [
        {
          model: AdminUser,
          as: "createdByAdmin",
          attributes: ["id", "username"],
        },
      ],
    });

    if (!banner) {
      return res.status(404).json({
        success: false,
        message: "Promotional banner not found",
      });
    }

    return res.json({
      success: true,
      data: banner,
    });
  } catch (error: any) {
    console.error("Error fetching promotional banner:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch promotional banner",
      error: error?.message || "Unknown error",
    });
  }
};

/**
 * Create new promotional banner
 */
export const createPromotionalBanner = async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validatedData = createPromotionalBannerSchema.parse(req.body);

    // Get admin ID from request (set by auth middleware)
    const adminId = (req as any).user?.userId;
    if (!adminId) {
      return res.status(401).json({
        success: false,
        message: "Admin authentication required",
      });
    }

    // Create promotional banner record
    const banner = await PromotionalBanner.create({
      title: validatedData.title,
      highlightText: validatedData.highlightText || null,
      description: validatedData.description,
      buttonText: validatedData.buttonText,
      buttonLink: validatedData.buttonLink,
      priority: validatedData.priority || 0,
      validFrom: validatedData.validFrom
        ? new Date(validatedData.validFrom)
        : null,
      validUntil: validatedData.validUntil
        ? new Date(validatedData.validUntil)
        : null,
      isActive: true,
      createdByAdminId: adminId,
    });

    // Fetch the created record with associations
    const createdBanner = await PromotionalBanner.findByPk(banner.id, {
      include: [
        {
          model: AdminUser,
          as: "createdByAdmin",
          attributes: ["id", "username"],
        },
      ],
    });

    return res.status(201).json({
      success: true,
      message: "Promotional banner created successfully",
      data: createdBanner,
    });
  } catch (error: any) {
    console.error("Error creating promotional banner:", error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: error.issues,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create promotional banner",
      error: error?.message || "Unknown error",
    });
  }
};

/**
 * Update promotional banner
 */
export const updatePromotionalBanner = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Validate request body
    const validatedData = updatePromotionalBannerSchema.parse(req.body);

    // Check if promotional banner exists
    const existingBanner = await PromotionalBanner.findByPk(id);

    if (!existingBanner) {
      return res.status(404).json({
        success: false,
        message: "Promotional banner not found",
      });
    }

    // Prepare update data
    const updateData: any = { ...validatedData };

    // Handle date fields
    if (validatedData.validFrom !== undefined) {
      updateData.validFrom = validatedData.validFrom
        ? new Date(validatedData.validFrom)
        : null;
    }
    if (validatedData.validUntil !== undefined) {
      updateData.validUntil = validatedData.validUntil
        ? new Date(validatedData.validUntil)
        : null;
    }

    // Update promotional banner record
    await existingBanner.update(updateData);

    // Fetch the updated record with associations
    const updatedBanner = await PromotionalBanner.findByPk(id, {
      include: [
        {
          model: AdminUser,
          as: "createdByAdmin",
          attributes: ["id", "username"],
        },
      ],
    });

    return res.json({
      success: true,
      message: "Promotional banner updated successfully",
      data: updatedBanner,
    });
  } catch (error: any) {
    console.error("Error updating promotional banner:", error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: error.issues,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to update promotional banner",
      error: error?.message || "Unknown error",
    });
  }
};

/**
 * Delete promotional banner
 */
export const deletePromotionalBanner = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if promotional banner exists
    const existingBanner = await PromotionalBanner.findByPk(id);

    if (!existingBanner) {
      return res.status(404).json({
        success: false,
        message: "Promotional banner not found",
      });
    }

    // Delete promotional banner record
    await existingBanner.destroy();

    return res.json({
      success: true,
      message: "Promotional banner deleted successfully",
    });
  } catch (error: any) {
    console.error("Error deleting promotional banner:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete promotional banner",
      error: error?.message || "Unknown error",
    });
  }
};
