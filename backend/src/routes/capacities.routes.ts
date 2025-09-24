/**
 * Capacities management routes
 */
import { Router } from "express";
import {
  getCapacities,
  getCapacityById,
  createCapacity,
  updateCapacity,
  toggleCapacityStatus,
  deleteCapacity,
  searchCapacities,
  getPublicCapacities,
  getPublicCapacityById,
} from "../controllers/capacities.controller";
import { authenticate, requireAdmin } from "../middleware/auth.middleware";

const router = Router();

// Public routes (no authentication required) - MUST be before authenticated routes
/**
 * @swagger
 * /api/capacities/public:
 *   get:
 *     summary: Get capacities for public view
 *     tags: [Capacities]
 *     responses:
 *       200:
 *         description: Capacities retrieved successfully
 */
router.get("/public", getPublicCapacities);

/**
 * @swagger
 * /api/capacities/public/{id}:
 *   get:
 *     summary: Get capacity by ID or slug for public view
 *     tags: [Capacities]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Capacity ID or slug
 *     responses:
 *       200:
 *         description: Capacity retrieved successfully
 *       404:
 *         description: Capacity not found
 */
router.get("/public/:id", getPublicCapacityById);

/**
 * @swagger
 * components:
 *   schemas:
 *     Capacity:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         name:
 *           type: string
 *         volumeMl:
 *           type: integer
 *           minimum: 1
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
 *     CreateCapacityRequest:
 *       type: object
 *       required:
 *         - name
 *         - volumeMl
 *       properties:
 *         name:
 *           type: string
 *           minLength: 1
 *           maxLength: 100
 *           example: 'Medium (12oz)'
 *         volumeMl:
 *           type: integer
 *           minimum: 1
 *           example: 355
 *     UpdateCapacityRequest:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *           minLength: 1
 *           maxLength: 100
 *         volumeMl:
 *           type: integer
 *           minimum: 1
 */

/**
 * @swagger
 * /api/admin/capacities:
 *   get:
 *     summary: Get all capacities with pagination and filters
 *     tags: [Capacities]
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
 *         description: Search in name
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [name, volumeMl, createdAt, updatedAt]
 *         description: Sort by field
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *         description: Sort order
 *     responses:
 *       200:
 *         description: Capacities retrieved successfully
 */
router.get("/", authenticate, getCapacities);

/**
 * @swagger
 * /api/admin/capacities/search:
 *   get:
 *     summary: Search capacities for autocomplete
 *     tags: [Capacities]
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
 *         description: Only active capacities
 *     responses:
 *       200:
 *         description: Capacities found
 */
router.get("/search", authenticate, searchCapacities);

/**
 * @swagger
 * /api/admin/capacities/{id}:
 *   get:
 *     summary: Get capacity by ID
 *     tags: [Capacities]
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
 *         description: Capacity retrieved successfully
 *       404:
 *         description: Capacity not found
 */
router.get("/:id", authenticate, getCapacityById);

/**
 * @swagger
 * /api/admin/capacities:
 *   post:
 *     summary: Create new capacity
 *     tags: [Capacities]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateCapacityRequest'
 *     responses:
 *       201:
 *         description: Capacity created successfully
 *       409:
 *         description: Capacity with same name or volume already exists
 */
router.post("/", authenticate, requireAdmin, createCapacity);

/**
 * @swagger
 * /api/admin/capacities/{id}:
 *   put:
 *     summary: Update capacity
 *     tags: [Capacities]
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
 *             $ref: '#/components/schemas/UpdateCapacityRequest'
 *     responses:
 *       200:
 *         description: Capacity updated successfully
 *       404:
 *         description: Capacity not found
 *       409:
 *         description: Capacity with same name or volume already exists
 */
router.put("/:id", authenticate, requireAdmin, updateCapacity);

/**
 * @swagger
 * /api/admin/capacities/{id}/toggle-status:
 *   patch:
 *     summary: Toggle capacity active status
 *     tags: [Capacities]
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
 *         description: Capacity status toggled successfully
 *       404:
 *         description: Capacity not found
 *       409:
 *         description: Cannot deactivate capacity that is in use
 */
router.patch(
  "/:id/toggle-status",
  authenticate,
  requireAdmin,
  toggleCapacityStatus
);

/**
 * @swagger
 * /api/admin/capacities/{id}:
 *   delete:
 *     summary: Delete capacity
 *     tags: [Capacities]
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
 *         description: Capacity deleted successfully
 *       404:
 *         description: Capacity not found
 *       409:
 *         description: Cannot delete capacity that is in use
 */
router.delete("/:id", authenticate, requireAdmin, deleteCapacity);

export default router;
