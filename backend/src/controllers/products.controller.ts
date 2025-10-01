/**
 * Products management controller - COMPLETE VERSION
 * Handles CRUD operations for product entities with soft delete and stock management
 * All Prisma syntax converted to Sequelize
 */
import { Request, Response } from "express";
import {
  Product,
  ProductCategory,
  ProductColor,
  ProductImage,
  Category,
  Color,
  Capacity,
} from "../models";
import { ResponseHelper } from "../types/api";
import { z } from "zod";
import { s3Service } from "../services/s3.service";
import { productImageService } from "../services/product-image.service";
// import {
//   meilisearchService,
//   SearchableProduct,
// } from "../services/meilisearch.service"; // TEMPORARILY DISABLED
import { generateVietnameseSlug } from "../utils/vietnamese-slug";
import { sequelize } from "../config/database";
import { Op } from "sequelize";

// Helper function to generate SEO-friendly slug with Vietnamese support
const generateProductSlug = (
  name: string,
  colorName: string,
  capacityName: string
): string => {
  const combined = `${name} ${colorName} ${capacityName}`;
  return generateVietnameseSlug(combined);
};

// Validation schemas
const createProductSchema = z.object({
  name: z.string().min(1, "Product name is required").max(255),
  slug: z.string().optional(),
  description: z.string().optional(),
  capacityId: z.string().uuid("Invalid capacity ID"),
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
  categoryIds: z
    .array(z.string().uuid())
    .min(1, "At least one category is required"),
  colorIds: z.array(z.string().uuid()).min(1, "At least one color is required"),
  productImages: z
    .array(
      z.object({
        url: z.string().url(),
        order: z.number().int().nonnegative(),
      })
    )
    .optional()
    .default([]),
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
      colorSlug,
      minCapacity,
      maxCapacity,
      sortBy = "createdAt",
      sortOrder = "desc",
      lowStock = "false",
      lowStockThreshold = "1",
    } = req.query;

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

    // Search functionality
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { slug: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } },
      ];
    }

    // Low stock filter
    if (lowStock === "true") {
      where.stockQuantity = { [Op.lte]: threshold };
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
          [Op.between]: [parseInt(minCapacity as string), parseInt(maxCapacity as string)]
        };
      } else if (minCapacity) {
        capacityWhere.volumeMl = { [Op.gte]: parseInt(minCapacity as string) };
      } else if (maxCapacity) {
        capacityWhere.volumeMl = { [Op.lte]: parseInt(maxCapacity as string) };
      }
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
            attributes: ["id", "url", "altText", "order"],
          },
        ],
        order: [
          [sortBy as string, (sortOrder as string).toUpperCase()],
          [{ model: ProductImage, as: "productImages" }, "order", "ASC"],
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
 * Get product by ID with full details
 */
export const getProductById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

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
      ],
      order: [[{ model: ProductImage, as: "productImages" }, "order", "ASC"]],
    });

    if (!product || product.isDeleted) {
      return res
        .status(404)
        .json(ResponseHelper.error("Product not found", "PRODUCT_NOT_FOUND"));
    }

    return res.status(200).json(ResponseHelper.success(product));
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
      categoryIds,
      colorIds,
      productImages,
    } = validationResult.data;

    // Sort images by order and extract URLs
    const imagesToProcess = productImages
      .sort((a, b) => a.order - b.order)
      .map((img) => img.url);

    // Create product in transaction
    const result = await sequelize.transaction(async (t) => {
      // Verify references exist and are active
      const [capacity, colors, categories] = await Promise.all([
        Capacity.findOne({
          where: { id: capacityId, isActive: true },
          transaction: t,
        }),
        Color.findAll({
          where: { id: { [Op.in]: colorIds }, isActive: true },
          transaction: t,
        }),
        Category.findAll({
          where: { id: { [Op.in]: categoryIds }, isActive: true },
          transaction: t,
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

      while (
        await Product.findOne({ where: { slug: finalSlug }, transaction: t })
      ) {
        slugCounter++;
        finalSlug = `${originalSlug}-${slugCounter}`;
      }

      // Create product
      const product = await Product.create(
        {
          name: name.trim(),
          slug: finalSlug,
          description: description?.trim(),
          capacityId,
          stockQuantity,
          unitPrice,
          productUrl,
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
            altText: name,
            order: index,
          })),
          { transaction: t }
        );
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
      ],
    });

    return res.status(201).json(ResponseHelper.success(createdProduct));
  } catch (error: any) {
    console.error("Create product error:", error);

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

    const updateData = validationResult.data;

    // Update product in transaction
    const updatedProduct = await sequelize.transaction(async (t) => {
      // Handle file uploads if present
      if (files && files.length > 0) {
        const uploadPromises = files.map(async (file, index) => {
          const uploadResult = await s3Service.uploadFile(
            file.buffer,
            "products"
          );
          return {
            productId: id,
            url: uploadResult.url,
            altText: `${existingProduct.name} - Image ${index + 1}`,
            order: index,
          };
        });

        const imageData = await Promise.all(uploadPromises);
        await ProductImage.bulkCreate(imageData, { transaction: t });
      }

      // Update basic product fields
      await existingProduct.update(
        {
          ...updateData,
          name: updateData.name?.trim() || existingProduct.name,
          description:
            updateData.description?.trim() || existingProduct.description,
        },
        { transaction: t }
      );

      // Update category relationships if provided
      if (updateData.categoryIds) {
        const categories = await Category.findAll({
          where: { id: { [Op.in]: updateData.categoryIds }, isActive: true },
          transaction: t,
        });

        if (categories.length !== updateData.categoryIds.length) {
          throw new Error("One or more categories not found or inactive");
        }

        await ProductCategory.destroy({
          where: { productId: id },
          transaction: t,
        });

        await ProductCategory.bulkCreate(
          updateData.categoryIds.map((categoryId) => ({
            productId: id,
            categoryId,
          })),
          { transaction: t }
        );
      }

      // Update color relationships if provided
      if (updateData.colorIds) {
        const colors = await Color.findAll({
          where: { id: { [Op.in]: updateData.colorIds }, isActive: true },
          transaction: t,
        });

        if (colors.length !== updateData.colorIds.length) {
          throw new Error("One or more colors not found or inactive");
        }

        await ProductColor.destroy({
          where: { productId: id },
          transaction: t,
        });

        await ProductColor.bulkCreate(
          updateData.colorIds.map((colorId) => ({
            productId: id,
            colorId,
          })),
          { transaction: t }
        );
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
        ],
        transaction: t,
      });
    });

    return res.status(200).json(ResponseHelper.success(updatedProduct));
  } catch (error: any) {
    console.error("Update product with files error:", error);

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

    // Update product in transaction
    const updatedProduct = await sequelize.transaction(async (t) => {
      let finalSlug = existingProduct.slug;

      // If name is being updated, regenerate slug
      if (updateData.name && updateData.name !== existingProduct.name) {
        // Get current capacity and first color for slug generation
        const [capacity, firstColor] = await Promise.all([
          Capacity.findByPk(
            updateData.capacityId || existingProduct.capacityId,
            { transaction: t }
          ),
          ProductColor.findOne({
            where: { productId: id },
            include: [{ model: Color, as: "color" }],
            transaction: t,
          }),
        ]);

        if (capacity && firstColor?.color) {
          finalSlug = generateProductSlug(
            updateData.name,
            firstColor.color.name,
            capacity.name
          );

          // Check for slug conflicts
          let slugCounter = 0;
          let originalSlug = finalSlug;
          while (
            await Product.findOne({
              where: { slug: finalSlug, id: { [Op.ne]: id } },
              transaction: t,
            })
          ) {
            slugCounter++;
            finalSlug = `${originalSlug}-${slugCounter}`;
          }
        }
      }

      // Update basic product fields
      await existingProduct.update(
        {
          ...updateData,
          slug: finalSlug,
          name: updateData.name?.trim() || existingProduct.name,
          description:
            updateData.description?.trim() || existingProduct.description,
        },
        { transaction: t }
      );

      // Update category relationships if provided
      if (updateData.categoryIds) {
        // Verify categories exist and are active
        const categories = await Category.findAll({
          where: { id: { [Op.in]: updateData.categoryIds }, isActive: true },
          transaction: t,
        });

        if (categories.length !== updateData.categoryIds.length) {
          throw new Error("One or more categories not found or inactive");
        }

        // Remove existing category relationships
        await ProductCategory.destroy({
          where: { productId: id },
          transaction: t,
        });

        // Create new category relationships
        await ProductCategory.bulkCreate(
          updateData.categoryIds.map((categoryId) => ({
            productId: id,
            categoryId,
          })),
          { transaction: t }
        );
      }

      // Update color relationships if provided
      if (updateData.colorIds) {
        // Verify colors exist and are active
        const colors = await Color.findAll({
          where: { id: { [Op.in]: updateData.colorIds }, isActive: true },
          transaction: t,
        });

        if (colors.length !== updateData.colorIds.length) {
          throw new Error("One or more colors not found or inactive");
        }

        // Remove existing color relationships
        await ProductColor.destroy({
          where: { productId: id },
          transaction: t,
        });

        // Create new color relationships
        await ProductColor.bulkCreate(
          updateData.colorIds.map((colorId) => ({
            productId: id,
            colorId,
          })),
          { transaction: t }
        );
      }

      // Handle productImages update if provided
      const imagesToProcess = updateData.productImages
        ? updateData.productImages
            .sort((a, b) => a.order - b.order)
            .map((img) => img.url)
        : [];

      if (imagesToProcess && imagesToProcess.length > 0) {
        // Remove existing product images
        await ProductImage.destroy({
          where: { productId: id },
          transaction: t,
        });

        // Create new product images
        await ProductImage.bulkCreate(
          imagesToProcess.map((imageUrl, index) => ({
            productId: id,
            url: imageUrl,
            altText: updateData.name || existingProduct.name,
            order: index,
          })),
          { transaction: t }
        );
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
        ],
        transaction: t,
      });
    });

    return res.status(200).json(ResponseHelper.success(updatedProduct));
  } catch (error: any) {
    console.error("Update product error:", error);

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

    return res
      .status(200)
      .json(
        ResponseHelper.success({ message: "Product deleted successfully" })
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

    return res.status(200).json(
      ResponseHelper.success({
        message: "Product reactivated successfully",
        product,
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

    return res.status(200).json(
      ResponseHelper.success({
        message: "Product stock updated successfully",
        productId: id,
        stockQuantity,
        previousStock: product.stockQuantity,
      })
    );
  } catch (error) {
    console.error("Update product stock error:", error);
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

    return res.status(200).json(
      ResponseHelper.success({
        message: `Product ${product.isActive ? "activated" : "deactivated"} successfully`,
        isActive: product.isActive,
      })
    );
  } catch (error) {
    console.error("Toggle product status error:", error);
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
        { name: { [Op.like]: `%${q}%` } },
        { description: { [Op.like]: `%${q}%` } },
        { slug: { [Op.like]: `%${q}%` } },
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
    console.error("Get low stock products error:", error);
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
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    const where: any = {
      isActive: true,
      isDeleted: false,
      stockQuantity: { [Op.gt]: 0 }, // Only show products in stock
    };

    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } },
      ];
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

    // Capacity filtering - support both 'capacity' and 'capacitySlug' parameters
    const capacityWhere: any = {};
    const capacitySlugValue = capacity || capacitySlug;
    if (capacitySlugValue) {
      capacityWhere.slug = capacitySlugValue;
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
            attributes: ["id", "url", "altText", "order"],
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
          "createdAt",
        ], // Limited attributes for public
        order: [
          [sortBy as string, (sortOrder as string).toUpperCase()],
          [{ model: ProductImage, as: "productImages" }, "order", "ASC"],
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
    console.error("Get public products error:", error);
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
      ],
      attributes: [
        "id",
        "name",
        "slug",
        "description",
        "stockQuantity",
        "unitPrice",
        "productUrl",
        "createdAt",
      ],
    });

    if (!product) {
      return res
        .status(404)
        .json(ResponseHelper.error("Product not found", "PRODUCT_NOT_FOUND"));
    }

    return res.status(200).json(ResponseHelper.success(product));
  } catch (error) {
    console.error("Get public product error:", error);
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
    console.error("Reorder product images error:", error);
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
