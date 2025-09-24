/**
 * Authentication routes
 */
import { Router } from "express";
import {
  login,
  adminLogin,
  refreshToken,
  logout,
  changePassword,
  getProfile,
  verifyToken,
  adminVerifyToken,
  adminRefreshToken,
  adminLogout,
  adminSessionCheck,
} from "../controllers/auth.controller";
import { authenticate, rateLimitAuth } from "../middleware/auth.middleware";

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     LoginRequest:
 *       type: object
 *       required:
 *         - email
 *         - password
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *         password:
 *           type: string
 *           minLength: 1
 *     LoginResponse:
 *       type: object
 *       properties:
 *         user:
 *           type: object
 *           properties:
 *             id:
 *               type: string
 *             email:
 *               type: string
 *             username:
 *               type: string
 *             role:
 *               type: string
 *               enum: [SUPER_ADMIN, ADMIN, STAFF]
 *         accessToken:
 *           type: string
 *         refreshToken:
 *           type: string
 *     RefreshTokenRequest:
 *       type: object
 *       required:
 *         - refreshToken
 *       properties:
 *         refreshToken:
 *           type: string
 *     ChangePasswordRequest:
 *       type: object
 *       required:
 *         - currentPassword
 *         - newPassword
 *       properties:
 *         currentPassword:
 *           type: string
 *         newPassword:
 *           type: string
 *           minLength: 8
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 */

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: General admin user login
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/LoginResponse'
 *       401:
 *         description: Invalid credentials or inactive account
 *       429:
 *         description: Too many login attempts
 */
router.post("/login", rateLimitAuth, login);

/**
 * @swagger
 * /api/auth/admin/login:
 *   post:
 *     summary: Admin panel specific login with role verification
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Admin login successful
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/LoginResponse'
 *       401:
 *         description: Invalid credentials or inactive account
 *       403:
 *         description: Access denied - admin privileges required
 *       429:
 *         description: Too many login attempts
 */
router.post("/admin/login", rateLimitAuth, adminLogin);

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RefreshTokenRequest'
 *     responses:
 *       200:
 *         description: Token refreshed successfully
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
 *                         accessToken:
 *                           type: string
 *       401:
 *         description: Invalid or expired refresh token
 */
router.post("/refresh", refreshToken);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Logout user
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logged out successfully
 *       401:
 *         description: Authentication required
 */
router.post("/logout", authenticate, logout);

/**
 * @swagger
 * /api/auth/profile:
 *   get:
 *     summary: Get current user profile
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
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
 *                         id:
 *                           type: string
 *                         email:
 *                           type: string
 *                         username:
 *                           type: string
 *                         role:
 *                           type: string
 *                         lastLoginAt:
 *                           type: string
 *                           format: date-time
 *                         createdAt:
 *                           type: string
 *                           format: date-time
 *       401:
 *         description: Authentication required
 *       404:
 *         description: User not found
 */
router.get("/profile", authenticate, getProfile);

/**
 * @swagger
 * /api/auth/verify:
 *   get:
 *     summary: Verify JWT token and get user info
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Token is valid, user info returned
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
 *                         user:
 *                           type: object
 *                           properties:
 *                             id:
 *                               type: string
 *                             email:
 *                               type: string
 *                             name:
 *                               type: string
 *                             role:
 *                               type: string
 *                         message:
 *                           type: string
 *       401:
 *         description: Authentication required or token invalid
 *       404:
 *         description: User not found
 */
router.get("/verify", authenticate, verifyToken);

/**
 * @swagger
 * /api/auth/change-password:
 *   post:
 *     summary: Change user password
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ChangePasswordRequest'
 *     responses:
 *       200:
 *         description: Password changed successfully
 *       400:
 *         description: Validation failed or weak password
 *       401:
 *         description: Authentication required or incorrect current password
 *       404:
 *         description: User not found
 */
router.post("/change-password", authenticate, changePassword);

// ===========================
// ADMIN-SPECIFIC ROUTES
// ===========================

/**
 * @swagger
 * /auth/admin/verify:
 *   get:
 *     summary: Verify admin access token
 *     tags: [Admin Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Token is valid
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     email:
 *                       type: string
 *                     name:
 *                       type: string
 *                     role:
 *                       type: string
 *       401:
 *         description: Invalid or expired token
 */
router.get("/admin/verify", authenticate, adminVerifyToken);

/**
 * @swagger
 * /auth/admin/refresh:
 *   post:
 *     summary: Refresh admin access token
 *     tags: [Admin Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                 refreshToken:
 *                   type: string
 *                 user:
 *                   type: object
 *       401:
 *         description: Invalid refresh token
 */
router.post("/admin/refresh", adminRefreshToken);

/**
 * @swagger
 * /auth/admin/logout:
 *   post:
 *     summary: Logout admin user
 *     tags: [Admin Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logged out successfully
 *       401:
 *         description: Authentication required
 */
router.post("/admin/logout", authenticate, adminLogout);

/**
 * @swagger
 * /api/auth/admin/session:
 *   get:
 *     summary: Check admin session using refresh token from cookie
 *     tags: [Admin Authentication]
 *     responses:
 *       200:
 *         description: Session valid, returns new access token
 *       401:
 *         description: No valid session found
 */
router.get("/admin/session", adminSessionCheck);

export default router;
