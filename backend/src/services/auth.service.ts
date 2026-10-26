import { Op } from "sequelize";
import { models } from "../models";
import { hashPassword, comparePassword, validatePassword } from "../utils/password";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  hashRefreshToken,
  getRefreshTokenExpiration,
} from "../utils/jwt";
import { ServiceError } from "../utils/service-error";
import { invalidateAdminUserCache } from "../utils/admin-user-cache";
import { resolvePermissions } from "./admin-role.service";

const { AdminUser, AdminRefreshToken, AdminRole } = models;

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.COOKIE_SECURE === "true",
  sameSite: (process.env.COOKIE_SAME_SITE as "strict" | "lax" | "none") || "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: "/",
  domain: process.env.COOKIE_DOMAIN || undefined,
};

export { COOKIE_OPTIONS };

export const EXPOSE_REFRESH_TOKEN = () => process.env.EXPOSE_REFRESH_TOKEN === "true";

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * A rotated refresh token stays valid for this long, so two requests fired at the same
 * moment from one browser (e.g. refresh + session check) don't invalidate each other.
 */
const ROTATION_GRACE_MS = 30 * 1000;
/** Rotated tokens are kept this long before being cleaned up. */
const ROTATED_RETENTION_MS = 5 * 60 * 1000;

const truncateUserAgent = (ua?: string) => (ua ? ua.slice(0, 255) : null);

/** Creates a refresh token for ONE device/session; other sessions of the user are untouched. */
async function issueRefreshToken(userId: string, userAgent?: string) {
  const refreshToken = generateRefreshToken({ userId, tokenVersion: 1 });
  await AdminRefreshToken.create({
    adminUserId: userId,
    tokenHash: hashRefreshToken(refreshToken),
    expiresAt: getRefreshTokenExpiration(),
    userAgent: truncateUserAgent(userAgent),
  });
  return refreshToken;
}

async function pruneRefreshTokens(userId: string) {
  const now = Date.now();
  await AdminRefreshToken.destroy({
    where: {
      adminUserId: userId,
      [Op.or]: [
        { expiresAt: { [Op.lt]: new Date(now) } },
        { replacedAt: { [Op.lt]: new Date(now - ROTATED_RETENTION_MS) } },
      ],
    },
  });
}

/**
 * Validates a refresh token against the per-session table. Falls back to the legacy
 * single hash on admin_users so sessions created before this change keep working once.
 */
async function verifyStoredToken(userId: string, token: string) {
  const user = await AdminUser.findOne({
    where: { id: userId },
    attributes: ["id", "email", "username", "role", "roleId", "isActive", "mustChangePassword", "refreshTokenHash", "refreshTokenExpiresAt"],
  });
  if (!user || !user.isActive) throw new ServiceError(401, "INVALID_SESSION", "Invalid session");

  const hash = hashRefreshToken(token);
  const row = await AdminRefreshToken.findOne({ where: { adminUserId: userId, tokenHash: hash } });

  if (row) {
    if (row.expiresAt < new Date()) throw new ServiceError(401, "SESSION_EXPIRED", "Session expired");
    if (row.replacedAt && Date.now() - row.replacedAt.getTime() > ROTATION_GRACE_MS) {
      throw new ServiceError(401, "INVALID_SESSION", "Invalid session");
    }
    return { user, row, legacy: false as const };
  }

  if (user.refreshTokenHash && user.refreshTokenHash === hash) {
    if (!user.refreshTokenExpiresAt || user.refreshTokenExpiresAt < new Date()) {
      throw new ServiceError(401, "SESSION_EXPIRED", "Session expired");
    }
    return { user, row: null, legacy: true as const };
  }

  throw new ServiceError(401, "INVALID_SESSION", "Invalid session");
}

/** Marks the presented token as rotated and issues its replacement for the same device. */
async function rotateRefreshToken(
  userId: string,
  current: { row: InstanceType<typeof AdminRefreshToken> | null; legacy: boolean },
  userAgent?: string
) {
  if (current.row && !current.row.replacedAt) {
    await current.row.update({ replacedAt: new Date() });
  }
  if (current.legacy) {
    // Migrate this device off the legacy column without touching other sessions.
    await AdminUser.update({ refreshTokenHash: null as unknown as undefined, refreshTokenExpiresAt: null as unknown as undefined }, { where: { id: userId } });
  }
  const newToken = await issueRefreshToken(userId, userAgent);
  await pruneRefreshTokens(userId);
  return newToken;
}

// ── Auth user payload ─────────────────────────────────────────────────────────

/**
 * The account as the admin frontend sees it. `permissions` drive what the UI shows; the API
 * re-checks them from the database on every request, so this is never trusted for access control.
 */
export async function buildAuthUser(user: InstanceType<typeof AdminUser>) {
  const role = user.roleId ? await AdminRole.findByPk(user.roleId, { attributes: ["id", "name", "key"] }) : null;
  return {
    id: user.id,
    email: user.email,
    name: user.username,
    role: user.role,
    roleId: user.roleId ?? null,
    roleName: role?.name ?? user.role,
    permissions: await resolvePermissions(user.roleId, user.role),
    mustChangePassword: user.mustChangePassword,
  };
}

// ── Service methods ───────────────────────────────────────────────────────────

export async function adminLogin(email: string, password: string, userAgent?: string) {
  const user = await AdminUser.findOne({ where: { email: email.toLowerCase() } });

  if (!user) throw new ServiceError(401, "INVALID_CREDENTIALS", "Invalid email or password");
  if (!user.isActive) throw new ServiceError(401, "ACCOUNT_DEACTIVATED", "Account is deactivated");
  if (!["SUPER_ADMIN", "ADMIN", "STAFF"].includes(user.role)) {
    throw new ServiceError(403, "ACCESS_DENIED", "Access denied. Admin privileges required.");
  }
  if (!(await comparePassword(password, user.passwordHash))) {
    throw new ServiceError(401, "INVALID_CREDENTIALS", "Invalid email or password");
  }

  await user.update({ lastLoginAt: new Date() });

  const accessToken = generateAccessToken({ userId: user.id, email: user.email, role: user.role, username: user.username });
  const refreshToken = await issueRefreshToken(user.id, userAgent);

  return {
    user: await buildAuthUser(user),
    token: accessToken,
    refreshToken,
  };
}

export async function login(email: string, password: string, userAgent?: string) {
  const user = await AdminUser.findOne({ where: { email: email.toLowerCase() } });

  if (!user) throw new ServiceError(401, "INVALID_CREDENTIALS", "Invalid email or password");
  if (!user.isActive) throw new ServiceError(401, "ACCOUNT_DEACTIVATED", "Account is deactivated");
  if (!(await comparePassword(password, user.passwordHash))) {
    throw new ServiceError(401, "INVALID_CREDENTIALS", "Invalid email or password");
  }

  await user.update({ lastLoginAt: new Date() });

  const accessToken = generateAccessToken({ userId: user.id, email: user.email, role: user.role, username: user.username });
  const refreshToken = await issueRefreshToken(user.id, userAgent);

  return {
    user: { id: user.id, email: user.email, username: user.username, role: user.role },
    accessToken,
    refreshToken,
  };
}

export async function refreshAccessToken(token: string) {
  const decoded = verifyRefreshToken(token);
  const { user } = await verifyStoredToken(decoded.userId, token);

  const accessToken = generateAccessToken({ userId: user.id, email: user.email, role: user.role, username: user.username });
  return { accessToken };
}

export async function adminRefreshToken(token: string, userAgent?: string) {
  const payload = verifyRefreshToken(token);
  if (!payload) throw new ServiceError(401, "INVALID_REFRESH_TOKEN", "Invalid refresh token");

  const stored = await verifyStoredToken(payload.userId, token);
  const { user } = stored;

  const accessToken = generateAccessToken({ userId: user.id, email: user.email, role: user.role, username: user.username });
  const newRefreshToken = await rotateRefreshToken(user.id, stored, userAgent);

  return {
    token: accessToken,
    user: await buildAuthUser(user),
    refreshToken: newRefreshToken,
  };
}

export async function checkAdminSession(token: string, userAgent?: string) {
  const payload = verifyRefreshToken(token);
  const stored = await verifyStoredToken(payload.userId, token);
  const { user } = stored;

  const accessToken = generateAccessToken({ userId: user.id, email: user.email, role: user.role, username: user.username });
  const newRefreshToken = await rotateRefreshToken(user.id, stored, userAgent);

  return {
    user: await buildAuthUser(user),
    token: accessToken,
    newRefreshToken,
  };
}

/**
 * Ends ONE session (the device presenting `token`). Other devices stay logged in.
 * Without a token there is no way to know which session to end, so nothing is revoked.
 */
export async function logoutUser(userId: string, token?: string) {
  if (!token) return;
  const hash = hashRefreshToken(token);
  await AdminRefreshToken.destroy({ where: { adminUserId: userId, tokenHash: hash } });

  const user = await AdminUser.findByPk(userId, { attributes: ["id", "refreshTokenHash"] });
  if (user?.refreshTokenHash === hash) {
    await AdminUser.update({ refreshTokenHash: null as unknown as undefined, refreshTokenExpiresAt: null as unknown as undefined }, { where: { id: userId } });
  }
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string) {
  const passwordValidation = validatePassword(newPassword);
  if (!passwordValidation.valid) {
    throw new ServiceError(400, "WEAK_PASSWORD", "Password does not meet requirements");
  }

  const user = await AdminUser.findOne({ where: { id: userId } });
  if (!user) throw new ServiceError(404, "USER_NOT_FOUND", "User not found");

  if (!(await comparePassword(currentPassword, user.passwordHash))) {
    throw new ServiceError(400, "INCORRECT_PASSWORD", "Current password is incorrect");
  }

  const hashedPassword = await hashPassword(newPassword);
  await AdminUser.update({ passwordHash: hashedPassword, mustChangePassword: false, updatedAt: new Date() }, { where: { id: userId } });
  await invalidateAdminUserCache(userId);
}

export async function getUserById(userId: string, attributes?: string[]) {
  const user = await AdminUser.findOne({
    where: { id: userId },
    attributes: attributes || ["id", "email", "username", "role", "isActive", "lastLoginAt", "createdAt"],
  });
  if (!user) throw new ServiceError(404, "USER_NOT_FOUND", "User not found");
  if (!user.isActive) throw new ServiceError(401, "ACCOUNT_DEACTIVATED", "Account is deactivated");
  return user;
}

export async function getAdminUserById(userId: string) {
  const user = await AdminUser.findOne({
    where: { id: userId },
    attributes: ["id", "email", "username", "role", "roleId", "isActive", "mustChangePassword"],
  });
  if (!user) throw new ServiceError(404, "ADMIN_NOT_FOUND", "Admin user not found");
  if (!user.isActive) throw new ServiceError(403, "ACCOUNT_DEACTIVATED", "Admin account is deactivated");
  return user;
}
