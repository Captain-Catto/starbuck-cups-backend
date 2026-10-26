/**
 * Role and permission management.
 * Mounted at /api/admin/roles. Listing is shared with account management (the role picker).
 */
import { Router } from "express";
import {
  listRoles,
  getPermissionCatalog,
  createRole,
  updateRole,
  deleteRole,
} from "../controllers/admin-roles.controller";
import { authenticateWithAutoRefresh, requirePermission } from "../middleware/auth.middleware";
import { PERMISSIONS } from "../constants/permissions";

const router = Router();

router.use(authenticateWithAutoRefresh);

router.get("/", requirePermission(PERMISSIONS.ROLES_MANAGE, PERMISSIONS.USERS_MANAGE), listRoles);
router.get("/permissions", requirePermission(PERMISSIONS.ROLES_MANAGE), getPermissionCatalog);
router.post("/", requirePermission(PERMISSIONS.ROLES_MANAGE), createRole);
router.put("/:id", requirePermission(PERMISSIONS.ROLES_MANAGE), updateRole);
router.delete("/:id", requirePermission(PERMISSIONS.ROLES_MANAGE), deleteRole);

export default router;
