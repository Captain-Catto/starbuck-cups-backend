/**
 * Products management routes
 */
import { Router } from "express";
import {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  updateProductWithFiles,
  deleteProduct,
  reactivateProduct,
  updateProductStock,
  toggleProductStatus,
  searchProducts,
  getLowStockProducts,
  getPublicProducts,
  getPublicProductById,
  reorderProductImages,
} from "../controllers/products.controller";
import {
  authenticateWithAutoRefresh,
  requireAdmin,
  requireStaff,
} from "../middleware/auth.middleware";
// Removed authenticateWithAutoRefresh - using authenticateWithAutoRefresh instead
import {
  uploadMultiple,
  handleMulterError,
} from "../middleware/upload.middleware";
import { syncProduct } from "../middleware/auto-sync.middleware";

const router = Router();

// Public routes (no authentication required) - MUST be before authenticated routes
/**
 * @swagger
 * /api/products/public:
 *   get:
 *     summary: Get products for public view
 *     tags: [Products]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 12
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: categoryId
 *         schema:
 *           type: string
 *       - in: query
 *         name: colorId
 *         schema:
 *           type: string
 *       - in: query
 *         name: capacityId
 *         schema:
 *           type: string
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [name, price-asc, price-desc]
 *     responses:
 *       200:
 *         description: Products retrieved successfully
 */
// Public route (no auth required)
router.get("/", getPublicProducts);
router.get("/public", getPublicProducts);

/**
 * @swagger
 * /api/products/public/{id}:
 *   get:
 *     summary: Get product by ID for public view
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Product ID or slug
 *     responses:
 *       200:
 *         description: Product retrieved successfully
 *       404:
 *         description: Product not found
 */
// Public product by ID/slug route
router.get("/public/:id", getPublicProductById);

/**
 * @swagger
 * /api/products/{id}:
 *   get:
 *     summary: Get product by ID for public view (alternative route)
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Product ID or slug
 *     responses:
 *       200:
 *         description: Product retrieved successfully
 *       404:
 *         description: Product not found
 */
// Public product routes (must be at the end to avoid conflicts)
router.get("/:id", getPublicProductById);

/**
 * @swagger
 * components:
 *   schemas:
 *     Product:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         slug:
 *           type: string
 *         name:
 *           type: string
 *         description:
 *           type: string
 *         capacity:
 *           $ref: '#/components/schemas/Capacity'
 *         color:
 *           $ref: '#/components/schemas/Color'
 *         category:
 *           $ref: '#/components/schemas/Category'
 *         stockQuantity:
 *           type: integer
 *           minimum: 0
 *         images:
 *           type: array
 *           items:
 *             type: string
 *             format: uri
 *         productUrl:
 *           type: string
 *           format: uri
 *         isActive:
 *           type: boolean
 *         isDeleted:
 *           type: boolean
 *         deletedAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         deletedByAdmin:
 *           type: object
 *           nullable: true
 *           properties:
 *             username:
 *               type: string
 *             email:
 *               type: string
 *         isLowStock:
 *           type: boolean
 *         stockStatus:
 *           type: string
 *           enum: [in_stock, low_stock, out_of_stock]
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *         _count:
 *           type: object
 *           properties:
 *             orderItems:
 *               type: integer
 *     CreateProductRequest:
 *       type: object
 *       required:
 *         - name
 *         - capacityId
 *         - colorId
 *         - categoryId
 *         - images
 *       properties:
 *         name:
 *           type: string
 *           minLength: 1
 *           maxLength: 255
 *           example: 'Classic Coffee Mug'
 *         slug:
 *           type: string
 *           example: 'classic-coffee-mug-white-medium'
 *         description:
 *           type: string
 *           example: 'Simple and elegant ceramic coffee mug'
 *         capacityId:
 *           type: string
 *           format: uuid
 *         colorId:
 *           type: string
 *           format: uuid
 *         categoryId:
 *           type: string
 *           format: uuid
 *         stockQuantity:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *         images:
 *           type: array
 *           items:
 *             type: string
 *             format: uri
 *           example: ['https://example.com/image1.jpg']
 *         productUrl:
 *           type: string
 *           format: uri
 *     UpdateProductRequest:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *           minLength: 1
 *           maxLength: 255
 *         slug:
 *           type: string
 *         description:
 *           type: string
 *         capacityId:
 *           type: string
 *           format: uuid
 *         colorId:
 *           type: string
 *           format: uuid
 *         categoryId:
 *           type: string
 *           format: uuid
 *         stockQuantity:
 *           type: integer
 *           minimum: 0
 *         images:
 *           type: array
 *           items:
 *             type: string
 *             format: uri
 *         productUrl:
 *           type: string
 *           format: uri
 *     StockUpdateRequest:
 *       type: object
 *       required:
 *         - quantity
 *         - operation
 *       properties:
 *         quantity:
 *           type: integer
 *           example: 10
 *         operation:
 *           type: string
 *           enum: [set, add, subtract]
 *           example: 'add'
 *         reason:
 *           type: string
 *           example: 'New shipment received'
 */

/**
 * @swagger
 * /api/admin/products:
 *   get:
 *     summary: Get all products with pagination and filters
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *         description: Items per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search in name, slug and description
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *       - in: query
 *         name: isDeleted
 *         schema:
 *           type: boolean
 *         description: Include deleted products
 *       - in: query
 *         name: categoryId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by category
 *       - in: query
 *         name: colorId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by color
 *       - in: query
 *         name: capacityId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by capacity
 *       - in: query
 *         name: lowStock
 *         schema:
 *           type: boolean
 *         description: Only low stock products
 *       - in: query
 *         name: lowStockThreshold
 *         schema:
 *           type: integer
 *           minimum: 0
 *         description: Low stock threshold (default 10)
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [name, stockQuantity, createdAt, updatedAt]
 *         description: Sort by field
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *         description: Sort order
 *     responses:
 *       200:
 *         description: Products retrieved successfully
 */
// Admin route (auth required) - moved to after public routes
// router.get("/", authenticateWithAutoRefresh, getProducts);

/**
 * @swagger
 * /api/admin/products/low-stock:
 *   get:
 *     summary: Get low stock products alert
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: threshold
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 10
 *         description: Stock threshold for low stock alert
 *     responses:
 *       200:
 *         description: Low stock products retrieved successfully
 */
router.get("/low-stock", authenticateWithAutoRefresh, getLowStockProducts);

/**
 * @swagger
 * /api/admin/products/search:
 *   get:
 *     summary: Search products for autocomplete
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Search query
 *       - in: query
 *         name: active
 *         schema:
 *           type: boolean
 *         description: Only active products
 *       - in: query
 *         name: includeDeleted
 *         schema:
 *           type: boolean
 *         description: Include deleted products
 *     responses:
 *       200:
 *         description: Products found
 */
router.get("/search", authenticateWithAutoRefresh, searchProducts);

/**
 * @swagger
 * /api/admin/products/{id}:
 *   get:
 *     summary: Get product by ID
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: includeDeleted
 *         schema:
 *           type: boolean
 *         description: Include deleted products
 *     responses:
 *       200:
 *         description: Product retrieved successfully
 *       404:
 *         description: Product not found
 */
router.get("/:id", authenticateWithAutoRefresh, getProductById);

/**
 * @swagger
 * /api/admin/products:
 *   post:
 *     summary: Create new product with image upload
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - capacityId
 *               - colorId
 *               - categoryId
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 255
 *                 example: 'Classic Coffee Mug'
 *               slug:
 *                 type: string
 *                 example: 'classic-coffee-mug-white-medium'
 *               description:
 *                 type: string
 *                 example: 'Simple and elegant ceramic coffee mug'
 *               capacityId:
 *                 type: string
 *                 format: uuid
 *               colorId:
 *                 type: string
 *                 format: uuid
 *               categoryId:
 *                 type: string
 *                 format: uuid
 *               stockQuantity:
 *                 type: integer
 *                 minimum: 0
 *                 default: 0
 *               productUrl:
 *                 type: string
 *                 format: uri
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Product images to upload to AWS S3
 *     responses:
 *       201:
 *         description: Product created successfully with images uploaded to AWS S3
 *       400:
 *         description: Validation failed, invalid file type, or upload error
 */
router.post(
  "/",
  authenticateWithAutoRefresh,
  requireAdmin,
  uploadMultiple("images", 10),
  handleMulterError,
  syncProduct.create(),
  createProduct
);

/**
 * @swagger
 * /api/admin/products/{id}:
 *   put:
 *     summary: Update product
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateProductRequest'
 *     responses:
 *       200:
 *         description: Product updated successfully
 *       404:
 *         description: Product not found
 *       409:
 *         description: Slug conflict
 */
router.put(
  "/:id",
  authenticateWithAutoRefresh,
  requireAdmin,
  syncProduct.update(),
  updateProduct
);

/**
 * @swagger
 * /api/admin/products/{id}/upload:
 *   put:
 *     summary: Update product with file uploads
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               capacityId:
 *                 type: string
 *                 format: uuid
 *               colorId:
 *                 type: string
 *                 format: uuid
 *               categoryId:
 *                 type: string
 *                 format: uuid
 *               stockQuantity:
 *                 type: integer
 *               productUrl:
 *                 type: string
 *               keepExistingImages:
 *                 type: boolean
 *                 description: Whether to keep existing images or replace them
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: New images to upload
 *     responses:
 *       200:
 *         description: Product updated successfully with uploaded images
 *       404:
 *         description: Product not found
 *       400:
 *         description: Validation failed or upload error
 */
router.put(
  "/:id/upload",
  authenticateWithAutoRefresh,
  requireAdmin,
  uploadMultiple("images", 10),
  handleMulterError,
  syncProduct.update(),
  updateProductWithFiles
);

/**
 * @swagger
 * /api/admin/products/{id}/stock:
 *   patch:
 *     summary: Update product stock
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/StockUpdateRequest'
 *     responses:
 *       200:
 *         description: Stock updated successfully
 *       400:
 *         description: Invalid stock operation
 *       404:
 *         description: Product not found
 */
router.patch("/:id/stock", authenticateWithAutoRefresh, requireAdmin, updateProductStock);

/**
 * @swagger
 * /api/admin/products/{id}/toggle-status:
 *   patch:
 *     summary: Toggle product active status
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Product status toggled successfully
 *       404:
 *         description: Product not found
 */
router.patch(
  "/:id/toggle-status",
  authenticateWithAutoRefresh,
  requireAdmin,
  toggleProductStatus
);

/**
 * @swagger
 * /api/admin/products/{id}/reactivate:
 *   patch:
 *     summary: Reactivate soft deleted product
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Product reactivated successfully
 *       400:
 *         description: Cannot reactivate due to inactive references
 *       404:
 *         description: Deleted product not found
 */
router.patch("/:id/reactivate", authenticateWithAutoRefresh, requireAdmin, reactivateProduct);

/**
 * @swagger
 * /api/admin/products/{id}:
 *   delete:
 *     summary: Soft delete product
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Product soft deleted successfully
 *       404:
 *         description: Product not found
 */
router.delete(
  "/:id",
  authenticateWithAutoRefresh,
  requireAdmin,
  syncProduct.delete(),
  deleteProduct
);

/**
 * @swagger
 * /api/admin/products/{id}/reorder-images:
 *   patch:
 *     summary: Reorder product images
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - imageUrls
 *             properties:
 *               imageUrls:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uri
 *     responses:
 *       200:
 *         description: Images reordered successfully
 *       400:
 *         description: Validation failed
 *       404:
 *         description: Product not found
 */
router.patch(
  "/:id/reorder-images",
  authenticateWithAutoRefresh,
  requireAdmin,
  reorderProductImages
);

// Create separate router for admin endpoints
export const adminProductsRouter = Router();

// Admin routes (require authentication)
adminProductsRouter.get("/", authenticateWithAutoRefresh, getProducts);
adminProductsRouter.get(
  "/low-stock",
  authenticateWithAutoRefresh,
  getLowStockProducts
);
adminProductsRouter.get("/search", authenticateWithAutoRefresh, searchProducts);
adminProductsRouter.get("/:id", authenticateWithAutoRefresh, getProductById);
adminProductsRouter.post(
  "/",
  authenticateWithAutoRefresh,
  requireAdmin,
  uploadMultiple("images", 10),
  handleMulterError,
  syncProduct.create(),
  createProduct
);
adminProductsRouter.put(
  "/:id",
  authenticateWithAutoRefresh,
  requireAdmin,
  syncProduct.update(),
  updateProduct
);
adminProductsRouter.put(
  "/:id/upload",
  authenticateWithAutoRefresh,
  requireAdmin,
  uploadMultiple("images", 10),
  handleMulterError,
  syncProduct.update(),
  updateProductWithFiles
);
adminProductsRouter.patch(
  "/:id/stock",
  authenticateWithAutoRefresh,
  requireStaff,
  updateProductStock
);
adminProductsRouter.patch(
  "/:id/toggle-status",
  authenticateWithAutoRefresh,
  requireAdmin,
  toggleProductStatus
);
adminProductsRouter.patch(
  "/:id/reactivate",
  authenticateWithAutoRefresh,
  requireAdmin,
  reactivateProduct
);
adminProductsRouter.delete(
  "/:id",
  authenticateWithAutoRefresh,
  requireAdmin,
  syncProduct.delete(),
  deleteProduct
);
adminProductsRouter.patch(
  "/:id/reorder-images",
  authenticateWithAutoRefresh,
  requireAdmin,
  reorderProductImages
);

export default router;
