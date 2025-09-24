import { Request, Response } from "express";
import { PrismaClient } from "../generated/prisma";
import { s3Service } from "../services/s3.service";
import { z } from "zod";
import multer from "multer";

const prisma = new PrismaClient();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || "5242880"), // 5MB default
  },
  fileFilter: (req, file, cb) => {
    if (!s3Service.isValidImageType(file.originalname)) {
      return cb(new Error("Only image files are allowed"));
    }
    cb(null, true);
  },
});

// Validation schemas
const createHeroImageSchema = z.object({
  title: z.string().min(1).max(255),
  altText: z.string().min(1).max(255),
  order: z.number().int().min(0).optional(),
});

const updateHeroImageSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  altText: z.string().min(1).max(255).optional(),
  order: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

/**
 * Get all hero images (public endpoint)
 */
export const getHeroImages = async (req: Request, res: Response) => {
  try {
    const heroImages = await prisma.heroImage.findMany({
      where: { isActive: true },
      orderBy: { order: "asc" },
      select: {
        id: true,
        title: true,
        imageUrl: true,
        altText: true,
        order: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json({
      success: true,
      data: heroImages,
    });
  } catch (error: any) {
    console.error("Error fetching hero images:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch hero images",
      error: error?.message || "Unknown error",
    });
  }
};

/**
 * Get all hero images for admin (includes inactive)
 */
export const getAdminHeroImages = async (req: Request, res: Response) => {
  try {
    const heroImages = await prisma.heroImage.findMany({
      orderBy: { order: "asc" },
      include: {
        createdByAdmin: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });

    res.json({
      success: true,
      data: heroImages,
    });
  } catch (error: any) {
    console.error("Error fetching admin hero images:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch hero images",
      error: error?.message || "Unknown error",
    });
  }
};

/**
 * Get single hero image by ID
 */
export const getHeroImageById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const heroImage = await prisma.heroImage.findUnique({
      where: { id },
      include: {
        createdByAdmin: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });

    if (!heroImage) {
      return res.status(404).json({
        success: false,
        message: "Hero image not found",
      });
    }

    return res.json({
      success: true,
      data: heroImage,
    });
  } catch (error: any) {
    console.error("Error fetching hero image:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch hero image",
      error: error?.message || "Unknown error",
    });
  }
};

/**
 * Create new hero image with upload
 */
export const createHeroImage = async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validatedData = createHeroImageSchema.parse({
      title: req.body.title,
      altText: req.body.altText,
      order: req.body.order ? parseInt(req.body.order) : undefined,
    });

    // Check if file was uploaded
    const file = req.file as Express.Multer.File;
    if (!file) {
      return res.status(400).json({
        success: false,
        message: "Image file is required",
      });
    }

    // Upload image to S3
    const uploadResult = await s3Service.uploadFile(
      file.buffer,
      file.originalname,
      "hero-images"
    );

    // Get admin ID from request (set by auth middleware)
    const adminId = (req as any).user?.userId;
    if (!adminId) {
      return res.status(401).json({
        success: false,
        message: "Admin authentication required",
      });
    }

    // Get the next order number (max order + 1)
    const maxOrderResult = await prisma.heroImage.aggregate({
      _max: {
        order: true,
      },
    });
    const nextOrder = (maxOrderResult._max.order || 0) + 1;

    // Create hero image record
    const heroImage = await prisma.heroImage.create({
      data: {
        title: validatedData.title,
        imageUrl: uploadResult.url,
        altText: validatedData.altText,
        order: nextOrder,
        createdByAdminId: adminId,
      },
      include: {
        createdByAdmin: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });

    return res.status(201).json({
      success: true,
      message: "Hero image created successfully",
      data: heroImage,
    });
  } catch (error: any) {
    console.error("Error creating hero image:", error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: error.issues,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create hero image",
      error: error?.message || "Unknown error",
    });
  }
};

/**
 * Update hero image
 */
export const updateHeroImage = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Validate request body
    const validatedData = updateHeroImageSchema.parse({
      title: req.body.title,
      altText: req.body.altText,
      order: req.body.order ? parseInt(req.body.order) : undefined,
      isActive:
        req.body.isActive !== undefined
          ? req.body.isActive === "true"
          : undefined,
    });

    // Check if hero image exists
    const existingHeroImage = await prisma.heroImage.findUnique({
      where: { id },
    });

    if (!existingHeroImage) {
      return res.status(404).json({
        success: false,
        message: "Hero image not found",
      });
    }

    let imageUrl = existingHeroImage.imageUrl;

    // Handle image upload if new file provided
    const file = req.file as Express.Multer.File;
    if (file) {
      // Upload new image to S3
      const uploadResult = await s3Service.uploadFile(
        file.buffer,
        file.originalname,
        "hero-images"
      );

      // Delete old image from S3
      const oldKey = s3Service.extractKeyFromUrl(existingHeroImage.imageUrl);
      if (oldKey) {
        await s3Service.deleteFile(oldKey);
      }

      imageUrl = uploadResult.url;
    }

    // Update hero image record
    const updatedHeroImage = await prisma.heroImage.update({
      where: { id },
      data: {
        ...validatedData,
        imageUrl,
      },
      include: {
        createdByAdmin: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });

    return res.json({
      success: true,
      message: "Hero image updated successfully",
      data: updatedHeroImage,
    });
  } catch (error: any) {
    console.error("Error updating hero image:", error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: error.issues,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to update hero image",
      error: error?.message || "Unknown error",
    });
  }
};

/**
 * Delete hero image
 */
export const deleteHeroImage = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if hero image exists
    const existingHeroImage = await prisma.heroImage.findUnique({
      where: { id },
    });

    if (!existingHeroImage) {
      return res.status(404).json({
        success: false,
        message: "Hero image not found",
      });
    }

    // Delete image from S3
    const imageKey = s3Service.extractKeyFromUrl(existingHeroImage.imageUrl);
    if (imageKey) {
      await s3Service.deleteFile(imageKey);
    }

    // Delete hero image record
    await prisma.heroImage.delete({
      where: { id },
    });

    return res.json({
      success: true,
      message: "Hero image deleted successfully",
    });
  } catch (error: any) {
    console.error("Error deleting hero image:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete hero image",
      error: error?.message || "Unknown error",
    });
  }
};

/**
 * Reorder hero images
 */
export const reorderHeroImages = async (req: Request, res: Response) => {
  try {
    const { imageOrders } = req.body;

    if (!Array.isArray(imageOrders)) {
      return res.status(400).json({
        success: false,
        message: "imageOrders must be an array",
      });
    }

    // Validate each order item
    const orderSchema = z.object({
      id: z.string().uuid(),
      order: z.number().int().min(0),
    });

    const validatedOrders = imageOrders.map((item) => orderSchema.parse(item));

    // Update all orders in a transaction
    await prisma.$transaction(
      validatedOrders.map((item) =>
        prisma.heroImage.update({
          where: { id: item.id },
          data: { order: item.order },
        })
      )
    );

    return res.json({
      success: true,
      message: "Hero images reordered successfully",
    });
  } catch (error: any) {
    console.error("Error reordering hero images:", error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: error.issues,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to reorder hero images",
      error: error?.message || "Unknown error",
    });
  }
};

// Export multer middleware
export const uploadMiddleware = upload.single("image");
