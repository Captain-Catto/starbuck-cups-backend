/**
 * Categories management routes
 */
import { Router } from "express";
import {
  getCategories,
  getCategoryTree,
  getCategoryById,
  createCategory,
  updateCategory,
  toggleCategoryStatus,
  deleteCategory,
  searchCategories,
  getPublicCategories,
  getPublicCategoryTree,
  getPublicCategoryById,
} from "../controllers/categories.controller";
import { authenticate, requireAdmin } from "../middleware/auth.middleware";

const router = Router();

// Public routes (no authentication required) - MUST be before authenticated routes
/**
 * @swagger
 * /api/categories/public:
 *   get:
 *     summary: Get categories for public view
 *     tags: [Categories]
 *     responses:
 *       200:
 *         description: Categories retrieved successfully
 */
router.get("/public", getPublicCategories);

/**
 * @swagger
 * /api/categories/public/tree:
 *   get:
 *     summary: Get category tree for public view
 *     tags: [Categories]
 *     responses:
 *       200:
 *         description: Category tree retrieved successfully
 */
router.get("/public/tree", getPublicCategoryTree);

/**
 * @swagger
 * /api/categories/public/{id}:
 *   get:
 *     summary: Get category by ID for public view
 *     tags: [Categories]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Category ID or slug
 *     responses:
 *       200:
 *         description: Category retrieved successfully
 *       404:
 *         description: Category not found
 */
router.get("/public/:id", getPublicCategoryById);

/**
 * @swagger
 * components:
 *   schemas:
 *     Category:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         name:
 *           type: string
 *         slug:
 *           type: string
 *         description:
 *           type: string
 *         parentId:
 *           type: string
 *           format: uuid
 *           nullable: true
 *         isActive:
 *           type: boolean
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *         createdByAdmin:
 *           type: object
 *           properties:
 *             username:
 *               type: string
 *             email:
 *               type: string
 *         parent:
 *           type: object
 *           nullable: true
 *           properties:
 *             id:
 *               type: string
 *             name:
 *               type: string
 *             slug:
 *               type: string
 *         children:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *               name:
 *                 type: string
 *               slug:
 *                 type: string
 *               isActive:
 *                 type: boolean
 *         _count:
 *           type: object
 *           properties:
 *             products:
 *               type: integer
 *             children:
 *               type: integer
 *     CreateCategoryRequest:
 *       type: object
 *       required:
 *         - name
 *       properties:
 *         name:
 *           type: string
 *           minLength: 1
 *           maxLength: 200
 *           example: 'Coffee Mugs'
 *         slug:
 *           type: string
 *           example: 'coffee-mugs'
 *         description:
 *           type: string
 *           example: 'Traditional coffee mugs for hot beverages'
 *         parentId:
 *           type: string
 *           format: uuid
 *           nullable: true
 *     UpdateCategoryRequest:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *           minLength: 1
 *           maxLength: 200
 *         slug:
 *           type: string
 *         description:
 *           type: string
 *         parentId:
 *           type: string
 *           format: uuid
 *           nullable: true
 */

/**
 * @swagger
 * /api/admin/categories:
 *   get:
 *     summary: Get all categories with pagination and filters
 *     tags: [Categories]
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
 *         name: parentId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by parent category
 *       - in: query
 *         name: includeChildren
 *         schema:
 *           type: boolean
 *         description: Include child categories
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [name, createdAt, updatedAt]
 *         description: Sort by field
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *         description: Sort order
 *     responses:
 *       200:
 *         description: Categories retrieved successfully
 */
router.get("/", authenticate, getCategories);

/**
 * @swagger
 * /api/admin/categories/tree:
 *   get:
 *     summary: Get category hierarchy tree
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: activeOnly
 *         schema:
 *           type: boolean
 *         description: Only active categories
 *     responses:
 *       200:
 *         description: Category tree retrieved successfully
 */
router.get("/tree", authenticate, getCategoryTree);

/**
 * @swagger
 * /api/admin/categories/search:
 *   get:
 *     summary: Search categories for autocomplete
 *     tags: [Categories]
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
 *         description: Only active categories
 *       - in: query
 *         name: parentId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by parent category
 *     responses:
 *       200:
 *         description: Categories found
 */
router.get("/search", authenticate, searchCategories);

/**
 * @swagger
 * /api/admin/categories/{id}:
 *   get:
 *     summary: Get category by ID
 *     tags: [Categories]
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
 *         description: Category retrieved successfully
 *       404:
 *         description: Category not found
 */
router.get("/:id", authenticate, getCategoryById);

/**
 * @swagger
 * /api/admin/categories:
 *   post:
 *     summary: Create new category
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateCategoryRequest'
 *     responses:
 *       201:
 *         description: Category created successfully
 *       400:
 *         description: Validation failed or max depth exceeded
 */
router.post("/", authenticate, requireAdmin, createCategory);

/**
 * @swagger
 * /api/admin/categories/{id}:
 *   put:
 *     summary: Update category
 *     tags: [Categories]
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
 *             $ref: '#/components/schemas/UpdateCategoryRequest'
 *     responses:
 *       200:
 *         description: Category updated successfully
 *       404:
 *         description: Category not found
 *       400:
 *         description: Validation failed or circular reference detected
 */
router.put("/:id", authenticate, requireAdmin, updateCategory);

/**
 * @swagger
 * /api/admin/categories/{id}/toggle-status:
 *   patch:
 *     summary: Toggle category active status
 *     tags: [Categories]
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
 *         description: Category status toggled successfully
 *       404:
 *         description: Category not found
 *       409:
 *         description: Cannot deactivate category that is in use
 */
router.patch(
  "/:id/toggle-status",
  authenticate,
  requireAdmin,
  toggleCategoryStatus
);

/**
 * @swagger
 * /api/admin/categories/{id}:
 *   delete:
 *     summary: Delete category
 *     tags: [Categories]
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
 *         description: Category deleted successfully
 *       404:
 *         description: Category not found
 *       409:
 *         description: Cannot delete category that is in use
 */
router.delete("/:id", authenticate, requireAdmin, deleteCategory);

export default router;
