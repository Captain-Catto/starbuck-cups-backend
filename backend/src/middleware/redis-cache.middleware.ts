import { logger } from "@/utils/logger";
import { Request, Response, NextFunction } from "express";
import { createClient } from "redis";

const isRedisEnabled = process.env.REDIS_ENABLED === "true" || (process.env.NODE_ENV === "production" && process.env.REDIS_ENABLED !== "false");

export let redisClient: ReturnType<typeof createClient> | null = null;

if (isRedisEnabled) {
  redisClient = createClient({
    url: process.env.REDIS_URL || "redis://localhost:6379",
  });

  redisClient.on("error", (err: Error) => logger.error("Redis Cache Client Error", err));
  redisClient.connect().catch(logger.error);
}

// Cache entry format: "<staleAtMs>|<raw JSON body string>".
// Storing the body as a pre-serialized string means a HIT costs one
// slice + Number() instead of JSON.parse-ing the whole response tree
// and re-stringifying it in res.send.
function encodeEntry(staleAt: number, body: unknown): string {
  return `${staleAt}|${JSON.stringify(body)}`;
}

function decodeEntry(raw: string): { staleAt: number; body: string } | null {
  const sep = raw.indexOf("|");
  if (sep <= 0) return null;
  const staleAt = Number(raw.slice(0, sep));
  if (!Number.isFinite(staleAt)) return null; // legacy/corrupt entry
  return { staleAt, body: raw.slice(sep + 1) };
}

function sendCachedBody(
  res: Response,
  body: string,
  cacheStatus: string,
  maxAgeSec: number,
  swrSec: number
): void {
  res.setHeader("X-Cache", cacheStatus);
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", `public, max-age=${maxAgeSec}, stale-while-revalidate=${swrSec}`);
  res.send(body);
}

/**
 * Middleware to cache API responses in Redis with Stale-While-Revalidate.
 * @param durationInSeconds How long to keep the cache fresh. Default: 300s (5 minutes)
 */
export const redisCacheMiddleware = (durationInSeconds: number = 300) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (req.method !== "GET") {
      return next();
    }

    // Skip caching if Redis is not enabled or not connected/ready
    if (!isRedisEnabled || !redisClient || !redisClient.isOpen || !redisClient.isReady) {
      return next();
    }

    // Skip caching for authenticated admin users
    if (req.user) {
      return next();
    }

    const key = `api_cache:${req.originalUrl || req.url}`;
    const lockKey = `lock:${key}`;
    const swrSec = durationInSeconds * 10;

    try {
      const cachedString = await redisClient.get(key);
      const cached = cachedString ? decodeEntry(cachedString) : null;

      if (cached) {
        const now = Date.now();

        // 1. Fresh cache -> Return immediately
        if (cached.staleAt > now) {
          sendCachedBody(res, cached.body, "HIT", Math.floor((cached.staleAt - now) / 1000), swrSec);
          return;
        }

        // 2. Stale cache -> SWR: serve immediately, refresh in background
        sendCachedBody(res, cached.body, "STALE", 0, swrSec);

        // Only allow one background refresh at a time per cache key
        const acquired = await redisClient.set(lockKey, "1", { NX: true, EX: 30 });
        if (!acquired) return;

        res.status = () => res;
        res.setHeader = () => res;
        res.send = () => res;
        res.end = () => res;
        res.sendStatus = () => res;
        res.json = (body: unknown) => {
          const b = body as Record<string, unknown>;
          if (b && b["success"] === true) {
            redisClient!.setEx(key, swrSec, encodeEntry(Date.now() + durationInSeconds * 1000, b))
              .then(() => redisClient!.del(lockKey))
              .catch((err: unknown) => logger.error("Redis Cache SWR Set Error:", err));
          } else {
            redisClient!.del(lockKey).catch(() => {});
          }
          return res;
        };

        next();
        return;
      }

      // 3. Cache MISS -> single-flight: first request computes, concurrent
      // requests briefly poll for the filled cache instead of all hitting
      // the database at once (stampede after invalidation/cold start).
      const missLockAcquired = await redisClient.set(lockKey, "1", { NX: true, EX: 10 });
      if (!missLockAcquired) {
        for (let i = 0; i < 3; i++) {
          await new Promise((resolve) => setTimeout(resolve, 100));
          const filledRaw = await redisClient.get(key);
          const filled = filledRaw ? decodeEntry(filledRaw) : null;
          if (filled) {
            const now = Date.now();
            sendCachedBody(
              res,
              filled.body,
              "HIT",
              Math.max(0, Math.floor((filled.staleAt - now) / 1000)),
              swrSec
            );
            return;
          }
        }
        // Cache still empty after waiting — fall through and compute anyway
        // rather than hard-blocking the user.
      }

      res.setHeader("X-Cache", "MISS");

      const originalJson = res.json.bind(res);
      res.json = (body: unknown) => {
        const b = body as Record<string, unknown>;
        if (b && b["success"] === true) {
          redisClient!.setEx(key, swrSec, encodeEntry(Date.now() + durationInSeconds * 1000, b)).catch((err: unknown) => {
            logger.error("Redis Cache Set Error:", err);
          });
          res.setHeader("Cache-Control", `public, max-age=${durationInSeconds}, stale-while-revalidate=${swrSec}`);
        }
        if (missLockAcquired) {
          redisClient!.del(lockKey).catch(() => {});
        }
        return originalJson(body);
      };

      next();
    } catch (error) {
      logger.error("Redis Cache Middleware Error:", error);
      next();
    }
  };
};

/**
 * Route middleware: after a successful mutation response, clear the cached
 * GET responses for the given URL prefixes so public pages see the change
 * without waiting for TTL expiry.
 */
export const invalidateCachePrefixOnSuccess = (...prefixes: string[]) => {
  return (_req: Request, res: Response, next: NextFunction): void => {
    const originalJson = res.json.bind(res);
    res.json = (body: unknown) => {
      const b = body as Record<string, unknown>;
      if (b && b["success"] === true) {
        for (const prefix of prefixes) {
          clearCachePrefix(prefix).catch(() => {});
        }
      }
      return originalJson(body);
    };
    next();
  };
};

/**
 * Clear cache keys matching a prefix using SCAN (non-blocking, safe for production).
 */
export const clearCachePrefix = async (prefix: string): Promise<void> => {
  if (!isRedisEnabled || !redisClient || !redisClient.isOpen || !redisClient.isReady) {
    return;
  }
  try {
    const pattern = `api_cache:${prefix}*`;
    let cursor = "0";
    const keysToDelete: string[] = [];

    do {
      const reply = await redisClient.scan(cursor, { MATCH: pattern, COUNT: 100 });
      cursor = reply.cursor;
      keysToDelete.push(...reply.keys);
    } while (cursor !== "0");

    if (keysToDelete.length > 0) {
      await redisClient.del(keysToDelete);
      logger.info(`Cleared ${keysToDelete.length} cache keys for prefix: ${prefix}`);
    }
  } catch (error) {
    logger.error("Failed to clear cache prefix:", error);
  }
};
