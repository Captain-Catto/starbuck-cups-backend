import { Op, WhereOptions } from "sequelize";
import { sequelize } from "../config/database";
import { AdminRole as LegacyRole } from "../models/AdminUser";
import { models } from "../models";
import { hashPassword, validatePassword } from "../utils/password";
import { invalidateAdminUserCache } from "../utils/admin-user-cache";
import { ServiceError } from "../utils/service-error";

const { AdminUser, AdminRefreshToken, AdminRole } = models;

const PUBLIC_ATTRIBUTES = [
  "id", "username", "email", "role", "roleId", "isActive", "mustChangePassword", "lastLoginAt", "createdAt", "updatedAt",
];

const ROLE_INCLUDE = [{ model: AdminRole, as: "adminRole", attributes: ["id", "name", "key"] }];

// The role column predates configurable roles; keep it aligned so older code paths stay valid
const legacyRoleFor = (key: string | null): LegacyRole => (key as LegacyRole) ?? LegacyRole.STAFF;

async function findRoleOrThrow(roleId: string) {
  const role = await AdminRole.findByPk(roleId, { attributes: ["id", "key"] });
  if (!role) throw new ServiceError(400, "ROLE_NOT_FOUND", "Vai trò không tồn tại");
  return role;
}

export interface AdminUserFilters {
  page?: string;
  limit?: string;
  search?: string;
  roleId?: string;
  isActive?: string;
}

export interface CreateAdminUserData {
  username: string;
  email: string;
  roleId: string;
  password: string;
}

export interface UpdateAdminUserData {
  username?: string;
  email?: string;
  roleId?: string;
  isActive?: boolean;
}

function assertStrongPassword(password: string) {
  const validation = validatePassword(password);
  if (!validation.valid) {
    throw new ServiceError(400, "WEAK_PASSWORD", validation.errors.join(". "));
  }
}

async function revokeSessions(userId: string) {
  await AdminRefreshToken.destroy({ where: { adminUserId: userId } });
  await AdminUser.update(
    { refreshTokenHash: null as unknown as undefined, refreshTokenExpiresAt: null as unknown as undefined },
    { where: { id: userId } }
  );
  await invalidateAdminUserCache(userId);
}

async function countActiveSuperAdmins(excludeId?: string) {
  return AdminUser.count({
    where: {
      role: LegacyRole.SUPER_ADMIN,
      isActive: true,
      ...(excludeId && { id: { [Op.ne]: excludeId } }),
    },
  });
}

export async function listAdminUsers(filters: AdminUserFilters) {
  const { page = "1", limit = "20", search = "", roleId, isActive } = filters;
  const pageNum = Math.max(parseInt(page) || 1, 1);
  const limitNum = Math.min(Math.max(parseInt(limit) || 20, 1), 100);

  const where: WhereOptions = {};
  if (roleId) (where as Record<string, unknown>)["roleId"] = roleId;
  if (isActive === "true" || isActive === "false") (where as Record<string, unknown>)["isActive"] = isActive === "true";
  if (search.trim()) {
    Object.assign(where, {
      [Op.or]: [
        { username: { [Op.iLike]: `%${search.trim()}%` } },
        { email: { [Op.iLike]: `%${search.trim()}%` } },
      ],
    });
  }

  const { rows, count } = await AdminUser.findAndCountAll({
    where,
    attributes: PUBLIC_ATTRIBUTES,
    include: ROLE_INCLUDE,
    order: [["createdAt", "DESC"]],
    limit: limitNum,
    offset: (pageNum - 1) * limitNum,
  });

  const totalPages = Math.ceil(count / limitNum);
  return {
    items: rows,
    pagination: { current_page: pageNum, per_page: limitNum, total_pages: totalPages, total_items: count, has_next: pageNum < totalPages, has_prev: pageNum > 1 },
  };
}

export async function createAdminUser(data: CreateAdminUserData) {
  assertStrongPassword(data.password);

  const email = data.email.trim().toLowerCase();
  const username = data.username.trim();

  const existing = await AdminUser.findOne({
    where: { [Op.or]: [{ email }, { username }] },
    attributes: ["id", "email", "username"],
  });
  if (existing) {
    throw new ServiceError(
      409,
      existing.email === email ? "EMAIL_TAKEN" : "USERNAME_TAKEN",
      existing.email === email ? "Email đã được sử dụng" : "Tên đăng nhập đã được sử dụng"
    );
  }

  const role = await findRoleOrThrow(data.roleId);
  const created = await AdminUser.create({
    username,
    email,
    role: legacyRoleFor(role.key),
    roleId: role.id,
    passwordHash: await hashPassword(data.password),
    isActive: true,
    mustChangePassword: true,
  });
  return AdminUser.findByPk(created.id, { attributes: PUBLIC_ATTRIBUTES, include: ROLE_INCLUDE });
}

export async function updateAdminUser(actorId: string, id: string, data: UpdateAdminUserData) {
  const target = await AdminUser.findByPk(id);
  if (!target) throw new ServiceError(404, "ADMIN_USER_NOT_FOUND", "Không tìm thấy tài khoản");

  const roleChanging = data.roleId !== undefined && data.roleId !== target.roleId;
  const deactivating = data.isActive === false && target.isActive;

  if (id === actorId && (roleChanging || deactivating)) {
    throw new ServiceError(400, "SELF_MODIFY_FORBIDDEN", "Không thể tự đổi vai trò hoặc khóa tài khoản của chính mình");
  }

  if (target.role === LegacyRole.SUPER_ADMIN && target.isActive && (roleChanging || deactivating)) {
    if ((await countActiveSuperAdmins(id)) === 0) {
      throw new ServiceError(400, "LAST_SUPER_ADMIN", "Phải còn ít nhất một Super Admin đang hoạt động");
    }
  }

  const patch: Record<string, unknown> = {};
  if (data.username !== undefined && data.username.trim() !== target.username) {
    const username = data.username.trim();
    if (await AdminUser.findOne({ where: { username, id: { [Op.ne]: id } }, attributes: ["id"] })) {
      throw new ServiceError(409, "USERNAME_TAKEN", "Tên đăng nhập đã được sử dụng");
    }
    patch.username = username;
  }
  if (data.email !== undefined && data.email.trim().toLowerCase() !== target.email) {
    const email = data.email.trim().toLowerCase();
    if (await AdminUser.findOne({ where: { email, id: { [Op.ne]: id } }, attributes: ["id"] })) {
      throw new ServiceError(409, "EMAIL_TAKEN", "Email đã được sử dụng");
    }
    patch.email = email;
  }
  if (roleChanging) {
    const role = await findRoleOrThrow(data.roleId as string);
    patch.roleId = role.id;
    patch.role = legacyRoleFor(role.key);
  }
  if (data.isActive !== undefined) patch.isActive = data.isActive;

  await target.update(patch);

  // The role and active flag are read on every request, so make sessions pick them up right away
  if (roleChanging || deactivating) await revokeSessions(id);
  else await invalidateAdminUserCache(id);

  return AdminUser.findByPk(id, { attributes: PUBLIC_ATTRIBUTES, include: ROLE_INCLUDE });
}

export async function resetAdminUserPassword(actorId: string, id: string, password: string) {
  if (id === actorId) {
    throw new ServiceError(400, "SELF_MODIFY_FORBIDDEN", "Hãy dùng chức năng đổi mật khẩu cho tài khoản của chính mình");
  }
  assertStrongPassword(password);

  const target = await AdminUser.findByPk(id, { attributes: ["id"] });
  if (!target) throw new ServiceError(404, "ADMIN_USER_NOT_FOUND", "Không tìm thấy tài khoản");

  await sequelize.transaction(async (t) => {
    await AdminUser.update(
      { passwordHash: await hashPassword(password), mustChangePassword: true },
      { where: { id }, transaction: t }
    );
  });
  await revokeSessions(id);
}
