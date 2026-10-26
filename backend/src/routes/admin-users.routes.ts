/**
 * Admin account management — SUPER_ADMIN only.
 * Mounted at /api/admin/users
 */
import { Router } from "express";
import {
  listAdminUsers,
  createAdminUser,
  updateAdminUser,
  resetAdminUserPassword,
} from "../controllers/admin-users.controller";
import { authenticateWithAutoRefresh, requirePermission } from "../middleware/auth.middleware";
import { PERMISSIONS } from "../constants/permissions";

const router = Router();

router.use(authenticateWithAutoRefresh, requirePermission(PERMISSIONS.USERS_MANAGE));

router.get("/", listAdminUsers);
router.post("/", createAdminUser);
router.patch("/:id", updateAdminUser);
router.post("/:id/reset-password", resetAdminUserPassword);

export default router;
