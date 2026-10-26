import { Op } from "sequelize";
import { sequelize } from "../config/database";
import { models } from "../models";
import { redisClient } from "../middleware/redis-cache.middleware";
import { logger } from "@/utils/logger";
import { ServiceError } from "../utils/service-error";
import {
  ALL_PERMISSION_KEYS,
  GRANTABLE_PERMISSION_KEYS,
  PERMISSION_CATALOG,
  PERMISSION_MODULES,
  SYSTEM_ROLES,
} from "../constants/permissions";

const { AdminRole, AdminRolePermission, AdminUser } = models;

const SUPER_ADMIN_KEY = "SUPER_ADMIN";
const ROLE_CACHE_TTL_SECONDS = 300;
const roleCacheKey = (roleId: string) => `admin_role_perms:${roleId}`;

export interface RoleInput {
  name: string;
  description?: string | null;
  permissions: string[];
}

// ── Permission lookup (used on every authenticated admin request) ─────────────

export async function invalidateRoleCache(roleId: string): Promise<void> {
  if (!redisClient?.isReady) return;
  await redisClient.del(roleCacheKey(roleId)).catch(() => {});
}

/** Permissions of a role. SUPER_ADMIN always has the whole catalog, even if rows are missing. */
export async function getRolePermissions(roleId: string): Promise<string[]> {
  if (redisClient?.isReady) {
    const cached = await redisClient.get(roleCacheKey(roleId)).catch(() => null);
    if (cached) return JSON.parse(cached) as string[];
  }

  const role = await AdminRole.findByPk(roleId, { attributes: ["id", "key"] });
  if (!role) return [];

  const permissions =
    role.key === SUPER_ADMIN_KEY
      ? ALL_PERMISSION_KEYS
      : (await AdminRolePermission.findAll({ where: { roleId }, attributes: ["permission"] })).map((row) => row.permission);

  if (redisClient?.isReady) {
    redisClient.setEx(roleCacheKey(roleId), ROLE_CACHE_TTL_SECONDS, JSON.stringify(permissions)).catch(() => {});
  }
  return permissions;
}

/**
 * Permissions for an account. Accounts not yet linked to a role row (before the startup seed ran)
 * fall back to the built-in role matching their legacy role column.
 */
export async function resolvePermissions(roleId: string | null | undefined, legacyRole?: string): Promise<string[]> {
  if (roleId) return getRolePermissions(roleId);
  return SYSTEM_ROLES.find((r) => r.key === legacyRole)?.permissions ?? [];
}

// ── Startup seed ──────────────────────────────────────────────────────────────

/**
 * Creates the built-in roles on first run and links accounts to them via their legacy role
 * column. Idempotent: existing roles keep whatever permissions an admin has configured, except
 * SUPER_ADMIN, which is always kept at the full catalog.
 */
export async function ensureSystemRoles(): Promise<void> {
  for (const definition of SYSTEM_ROLES) {
    const [role, created] = await AdminRole.findOrCreate({
      where: { key: definition.key },
      defaults: { key: definition.key, name: definition.name, description: definition.description },
    });

    if (created) {
      await AdminRolePermission.bulkCreate(definition.permissions.map((permission) => ({ roleId: role.id, permission })));
    } else if (definition.key === SUPER_ADMIN_KEY) {
      const existing = new Set((await AdminRolePermission.findAll({ where: { roleId: role.id } })).map((r) => r.permission));
      const missing = ALL_PERMISSION_KEYS.filter((key) => !existing.has(key));
      if (missing.length) {
        await AdminRolePermission.bulkCreate(missing.map((permission) => ({ roleId: role.id, permission })));
        await invalidateRoleCache(role.id);
      }
    }

    const linked = await AdminUser.update(
      { roleId: role.id },
      { where: { roleId: { [Op.is]: null }, role: definition.key } as never }
    );
    if (linked[0]) logger.info(`Linked ${linked[0]} admin account(s) to role ${definition.key}`);
  }
}

// ── Role management ───────────────────────────────────────────────────────────

export function getPermissionCatalog() {
  return {
    modules: Object.entries(PERMISSION_MODULES).map(([key, label]) => ({ key, label })),
    permissions: PERMISSION_CATALOG,
  };
}

function serialize(role: InstanceType<typeof AdminRole>, permissions: string[], userCount: number) {
  return {
    id: role.id,
    key: role.key,
    name: role.name,
    description: role.description ?? null,
    isSystem: role.key !== null,
    permissions: role.key === SUPER_ADMIN_KEY ? ALL_PERMISSION_KEYS : permissions,
    userCount,
    createdAt: role.createdAt,
    updatedAt: role.updatedAt,
  };
}

export async function listRoles(search?: string) {
  const where = search?.trim() ? { name: { [Op.iLike]: `%${search.trim()}%` } } : {};
  const roles = await AdminRole.findAll({ where, order: [["createdAt", "ASC"]] });
  if (roles.length === 0) return [];

  const ids = roles.map((r) => r.id);
  const [permissionRows, userRows] = await Promise.all([
    AdminRolePermission.findAll({ where: { roleId: { [Op.in]: ids } } }),
    AdminUser.findAll({
      where: { roleId: { [Op.in]: ids } },
      attributes: ["roleId", [sequelize.fn("COUNT", sequelize.col("id")), "count"]],
      group: ["roleId"],
      raw: true,
    }) as unknown as Promise<Array<{ roleId: string; count: string }>>,
  ]);

  const byRole = new Map<string, string[]>();
  for (const row of permissionRows) byRole.set(row.roleId, [...(byRole.get(row.roleId) ?? []), row.permission]);
  const counts = new Map(userRows.map((row) => [row.roleId, Number(row.count)]));

  return roles.map((role) => serialize(role, byRole.get(role.id) ?? [], counts.get(role.id) ?? 0));
}

function validatePermissions(permissions: string[]) {
  const unique = [...new Set(permissions)];
  const unknown = unique.filter((key) => !ALL_PERMISSION_KEYS.includes(key));
  if (unknown.length) throw new ServiceError(400, "UNKNOWN_PERMISSION", `Quyền không tồn tại: ${unknown.join(", ")}`);

  const notGrantable = unique.filter((key) => !GRANTABLE_PERMISSION_KEYS.includes(key));
  if (notGrantable.length) {
    throw new ServiceError(400, "PERMISSION_NOT_GRANTABLE", "Quyền quản lý tài khoản và phân quyền chỉ dành cho Super Admin");
  }
  return unique;
}

async function assertNameFree(name: string, exceptId?: string) {
  const clash = await AdminRole.findOne({
    where: { name: { [Op.iLike]: name }, ...(exceptId && { id: { [Op.ne]: exceptId } }) },
    attributes: ["id"],
  });
  if (clash) throw new ServiceError(409, "ROLE_NAME_TAKEN", "Tên vai trò đã tồn tại");
}

export async function createRole(input: RoleInput) {
  const name = input.name.trim();
  const permissions = validatePermissions(input.permissions);
  await assertNameFree(name);

  const role = await sequelize.transaction(async (t) => {
    const created = await AdminRole.create({ name, description: input.description?.trim() || null }, { transaction: t });
    await AdminRolePermission.bulkCreate(permissions.map((permission) => ({ roleId: created.id, permission })), { transaction: t });
    return created;
  });
  return serialize(role, permissions, 0);
}

export async function updateRole(id: string, input: RoleInput) {
  const role = await AdminRole.findByPk(id);
  if (!role) throw new ServiceError(404, "ROLE_NOT_FOUND", "Không tìm thấy vai trò");

  const name = input.name.trim();
  await assertNameFree(name, id);

  const isSuper = role.key === SUPER_ADMIN_KEY;
  // Super Admin always keeps every permission; only its name and description can change
  const permissions = isSuper ? ALL_PERMISSION_KEYS : validatePermissions(input.permissions);

  await sequelize.transaction(async (t) => {
    await role.update({ name, description: input.description?.trim() || null }, { transaction: t });
    if (!isSuper) {
      await AdminRolePermission.destroy({ where: { roleId: id }, transaction: t });
      await AdminRolePermission.bulkCreate(permissions.map((permission) => ({ roleId: id, permission })), { transaction: t });
    }
  });
  await invalidateRoleCache(id);

  const userCount = await AdminUser.count({ where: { roleId: id } });
  return serialize(role, permissions, userCount);
}

export async function deleteRole(id: string) {
  const role = await AdminRole.findByPk(id);
  if (!role) throw new ServiceError(404, "ROLE_NOT_FOUND", "Không tìm thấy vai trò");
  if (role.key !== null) throw new ServiceError(400, "SYSTEM_ROLE", "Không thể xóa vai trò mẫu");

  const inUse = await AdminUser.count({ where: { roleId: id } });
  if (inUse > 0) {
    throw new ServiceError(409, "ROLE_IN_USE", `Vai trò đang được gán cho ${inUse} tài khoản, hãy chuyển họ sang vai trò khác trước`);
  }

  await role.destroy();
  await invalidateRoleCache(id);
}
