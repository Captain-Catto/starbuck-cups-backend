/**
 * Colors management routes
 */
import { Router } from "express";
import {
  getColors,
  getColorById,
  createColor,
  updateColor,
  toggleColorStatus,
  deleteColor,
  searchColors,
  getPublicColors,
  getPublicColorById,
} from "../controllers/colors.controller";
import { authenticateWithAutoRefresh, requireAdmin } from "../middleware/auth.middleware";

const router = Router();

// Public routes (no authentication required) - MUST be before authenticated routes
/**
 * @swagger
 * /api/colors/public:
 *   get:
 *     summary: Get colors for public view
 *     tags: [Colors]
 *     responses:
 *       200:
 *         description: Colors retrieved successfully
 */
router.get("/public", getPublicColors);

/**
 * @swagger
 * /api/colors/public/{id}:
 *   get:
 *     summary: Get color by ID or slug for public view
 *     tags: [Colors]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Color ID or slug
 *     responses:
 *       200:
 *         description: Color retrieved successfully
 *       404:
 *         description: Color not found
 */
router.get("/public/:id", getPublicColorById);

/**
 * @swagger
 * components:
 *   schemas:
 *     Color:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         name:
 *           type: string
 *         hexCode:
 *           type: string
 *           pattern: '^#[0-9A-F]{6}$'
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
 *         _count:
 *           type: object
 *           properties:
 *             products:
 *               type: integer
 *     CreateColorRequest:
 *       type: object
 *       required:
 *         - name
 *         - hexCode
 *       properties:
 *         name:
 *           type: string
 *           minLength: 1
 *           maxLength: 100
 *         hexCode:
 *           type: string
 *           pattern: '^#[0-9A-F]{6}$'
 *           example: '#FF0000'
 *     UpdateColorRequest:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *           minLength: 1
 *           maxLength: 100
 *         hexCode:
 *           type: string
 *           pattern: '^#[0-9A-F]{6}$'
 *           example: '#FF0000'
 */

/**
 * @swagger
 * /api/admin/colors:
 *   get:
 *     summary: Get all colors with pagination and filters
 *     tags: [Colors]
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
 *         description: Search in name and hex code
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filter by active status
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
 *         description: Colors retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         items:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/Color'
 *                         pagination:
 *                           $ref: '#/components/schemas/PaginationMeta'
 */
router.get("/", authenticateWithAutoRefresh, getColors);

/**
 * @swagger
 * /api/admin/colors/search:
 *   get:
 *     summary: Search colors for autocomplete
 *     tags: [Colors]
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
 *         description: Only active colors
 *     responses:
 *       200:
 *         description: Colors found
 */
router.get("/search", authenticateWithAutoRefresh, searchColors);

/**
 * @swagger
 * /api/admin/colors/{id}:
 *   get:
 *     summary: Get color by ID
 *     tags: [Colors]
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
 *         description: Color retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Color'
 *       404:
 *         description: Color not found
 */
router.get("/:id", authenticateWithAutoRefresh, getColorById);

/**
 * @swagger
 * /api/admin/colors:
 *   post:
 *     summary: Create new color
 *     tags: [Colors]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateColorRequest'
 *     responses:
 *       201:
 *         description: Color created successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Color'
 *       409:
 *         description: Color with same name or hex code already exists
 */
router.post("/", authenticateWithAutoRefresh, requireAdmin, createColor);

/**
 * @swagger
 * /api/admin/colors/{id}:
 *   put:
 *     summary: Update color
 *     tags: [Colors]
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
 *             $ref: '#/components/schemas/UpdateColorRequest'
 *     responses:
 *       200:
 *         description: Color updated successfully
 *       404:
 *         description: Color not found
 *       409:
 *         description: Color with same name or hex code already exists
 */
router.put("/:id", authenticateWithAutoRefresh, requireAdmin, updateColor);

/**
 * @swagger
 * /api/admin/colors/{id}/toggle-status:
 *   patch:
 *     summary: Toggle color active status
 *     tags: [Colors]
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
 *         description: Color status toggled successfully
 *       404:
 *         description: Color not found
 *       409:
 *         description: Cannot deactivate color that is in use
 */
router.patch(
  "/:id/toggle-status",
  authenticateWithAutoRefresh,
  requireAdmin,
  toggleColorStatus
);

/**
 * @swagger
 * /api/admin/colors/{id}:
 *   delete:
 *     summary: Delete color
 *     tags: [Colors]
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
 *         description: Color deleted successfully
 *       404:
 *         description: Color not found
 *       409:
 *         description: Cannot delete color that is in use
 */
router.delete("/:id", authenticateWithAutoRefresh, requireAdmin, deleteColor);

export default router;
