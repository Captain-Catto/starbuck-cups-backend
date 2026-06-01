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

const { AdminUser } = models;

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

async function saveRefreshToken(userId: string, refreshToken: string) {
  const hash = hashRefreshToken(refreshToken);
  const expiresAt = getRefreshTokenExpiration();
  await AdminUser.update({ refreshTokenHash: hash, refreshTokenExpiresAt: expiresAt }, { where: { id: userId } });
}

async function verifyStoredToken(userId: string, token: string) {
  const user = await AdminUser.findOne({
    where: { id: userId },
    attributes: ["id", "email", "username", "role", "isActive", "refreshTokenHash", "refreshTokenExpiresAt"],
  });

  if (!user || !user.isActive) throw new ServiceError(401, "INVALID_SESSION", "Invalid session");
  if (!user.refreshTokenHash || user.refreshTokenHash !== hashRefreshToken(token)) {
    throw new ServiceError(401, "INVALID_SESSION", "Invalid session");
  }
  if (!user.refreshTokenExpiresAt || user.refreshTokenExpiresAt < new Date()) {
    throw new ServiceError(401, "SESSION_EXPIRED", "Session expired");
  }
  return user;
}

// ── Service methods ───────────────────────────────────────────────────────────

export async function adminLogin(email: string, password: string) {
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
  const refreshToken = generateRefreshToken({ userId: user.id, tokenVersion: 1 });
  await saveRefreshToken(user.id, refreshToken);

  return {
    user: { id: user.id, email: user.email, name: user.username, role: user.role },
    token: accessToken,
    refreshToken,
  };
}

export async function login(email: string, password: string) {
  const user = await AdminUser.findOne({ where: { email: email.toLowerCase() } });

  if (!user) throw new ServiceError(401, "INVALID_CREDENTIALS", "Invalid email or password");
  if (!user.isActive) throw new ServiceError(401, "ACCOUNT_DEACTIVATED", "Account is deactivated");
  if (!(await comparePassword(password, user.passwordHash))) {
    throw new ServiceError(401, "INVALID_CREDENTIALS", "Invalid email or password");
  }

  await user.update({ lastLoginAt: new Date() });

  const accessToken = generateAccessToken({ userId: user.id, email: user.email, role: user.role, username: user.username });
  const refreshToken = generateRefreshToken({ userId: user.id, tokenVersion: 1 });
  await saveRefreshToken(user.id, refreshToken);

  return {
    user: { id: user.id, email: user.email, username: user.username, role: user.role },
    accessToken,
    refreshToken,
  };
}

export async function refreshAccessToken(token: string) {
  const decoded = verifyRefreshToken(token);

  const user = await AdminUser.findOne({
    where: { id: decoded.userId },
    attributes: ["id", "email", "role", "username", "isActive", "refreshTokenHash", "refreshTokenExpiresAt"],
  });

  if (!user || !user.isActive) throw new ServiceError(401, "INVALID_REFRESH_TOKEN", "Invalid refresh token");
  if (!user.refreshTokenHash || user.refreshTokenHash !== hashRefreshToken(token)) {
    throw new ServiceError(401, "INVALID_REFRESH_TOKEN", "Invalid refresh token");
  }
  if (!user.refreshTokenExpiresAt || user.refreshTokenExpiresAt < new Date()) {
    throw new ServiceError(401, "REFRESH_TOKEN_EXPIRED", "Refresh token expired");
  }

  const accessToken = generateAccessToken({ userId: user.id, email: user.email, role: user.role, username: user.username });
  return { accessToken };
}

export async function adminRefreshToken(token: string) {
  const payload = verifyRefreshToken(token);
  if (!payload) throw new ServiceError(401, "INVALID_REFRESH_TOKEN", "Invalid refresh token");

  const user = await verifyStoredToken(payload.userId, token);

  const accessToken = generateAccessToken({ userId: user.id, email: user.email, role: user.role, username: user.username });
  const newRefreshToken = generateRefreshToken({ userId: user.id, tokenVersion: 0 });
  await saveRefreshToken(user.id, newRefreshToken);

  return {
    token: accessToken,
    user: { id: user.id, email: user.email, name: user.username, role: user.role },
    refreshToken: newRefreshToken,
  };
}

export async function checkAdminSession(token: string) {
  const payload = verifyRefreshToken(token);
  const user = await verifyStoredToken(payload.userId, token);

  const accessToken = generateAccessToken({ userId: user.id, email: user.email, role: user.role, username: user.username });
  const newRefreshToken = generateRefreshToken({ userId: user.id, tokenVersion: 0 });
  await saveRefreshToken(user.id, newRefreshToken);

  return {
    user: { id: user.id, email: user.email, name: user.username, role: user.role },
    token: accessToken,
    newRefreshToken,
  };
}

export async function logoutUser(userId: string) {
  const user = await AdminUser.findByPk(userId);
  if (user) {
    await user.update({ refreshTokenHash: undefined, refreshTokenExpiresAt: undefined });
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
  await AdminUser.update({ passwordHash: hashedPassword, updatedAt: new Date() }, { where: { id: userId } });
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
    attributes: ["id", "email", "username", "role", "isActive"],
  });
  if (!user) throw new ServiceError(404, "ADMIN_NOT_FOUND", "Admin user not found");
  if (!user.isActive) throw new ServiceError(403, "ACCOUNT_DEACTIVATED", "Admin account is deactivated");
  return user;
}
