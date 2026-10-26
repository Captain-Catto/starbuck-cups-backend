import { redisClient } from "../middleware/redis-cache.middleware";

export const ADMIN_USER_CACHE_TTL_SECONDS = 300;

export const adminUserCacheKey = (userId: string) => `admin_user:${userId}`;

/**
 * Drops the cached account row used by `authenticate`. Call it whenever a role, active flag or
 * password-change requirement changes, otherwise the old values keep applying for up to 5 minutes.
 */
export async function invalidateAdminUserCache(userId: string): Promise<void> {
  if (!redisClient?.isReady) return;
  await redisClient.del(adminUserCacheKey(userId)).catch(() => {});
}
