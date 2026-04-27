import { logger } from "@/utils/logger";
import { Request, Response, NextFunction } from "express";
import { createClient } from "redis";
import { ResponseHelper } from "../types/api";

const redisClient = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
});

redisClient.on("error", (err) => logger.error("Redis Cache Client Error", err));
redisClient.connect().catch(logger.error);

/**
 * Middleware to cache API responses in Redis with Stale-While-Revalidate.
 * @param durationInSeconds How long to keep the cache fresh. Default: 300s (5 minutes)
 */
export const redisCacheMiddleware = (durationInSeconds: number = 300) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (req.method !== "GET") {
      return next();
    }

    // Skip caching for authenticated admin users
    if (req.user) {
      return next();
    }

    const key = `api_cache:${req.originalUrl || req.url}`;

    try {
      const cachedString = await redisClient.get(key);

      if (cachedString) {
        const cached = JSON.parse(cachedString);
        const now = Date.now();

        // 1. Fresh cache -> Return immediately
        if (cached._staleAt > now) {
          res.setHeader("X-Cache", "HIT");
          res.setHeader("Content-Type", "application/json");
          const remainingSec = Math.floor((cached._staleAt - now) / 1000);
          res.setHeader("Cache-Control", `public, max-age=${remainingSec}, stale-while-revalidate=${durationInSeconds * 10}`);
          res.send(cached.data);
          return;
        }

        // 2. Stale cache -> SWR: serve immediately, refresh in background
        res.setHeader("X-Cache", "STALE");
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Cache-Control", `public, max-age=0, stale-while-revalidate=${durationInSeconds * 10}`);
        res.send(cached.data);

        // Only allow one background refresh at a time per cache key
        const lockKey = `lock:${key}`;
        const acquired = await redisClient.set(lockKey, "1", { NX: true, EX: 30 });
        if (!acquired) return;

        res.status = () => res;
        res.setHeader = () => res;
        res.json = (body: any) => {
          if (body && body.success === true) {
            const cacheData = {
              _staleAt: Date.now() + durationInSeconds * 1000,
              data: body,
            };
            redisClient.setEx(key, durationInSeconds * 10, JSON.stringify(cacheData))
              .then(() => redisClient.del(lockKey))
              .catch((err) => logger.error("Redis Cache SWR Set Error:", err));
          } else {
            redisClient.del(lockKey).catch(() => {});
          }
          return res as any;
        };

        next();
        return;
      }

      // 3. Cache MISS -> Wait for controller, then cache
      res.setHeader("X-Cache", "MISS");

      const originalJson = res.json.bind(res);
      res.json = (body: any) => {
        if (body && body.success === true) {
          const cacheData = {
            _staleAt: Date.now() + durationInSeconds * 1000,
            data: body,
          };
          redisClient.setEx(key, durationInSeconds * 10, JSON.stringify(cacheData)).catch((err) => {
            logger.error("Redis Cache Set Error:", err);
          });
          res.setHeader("Cache-Control", `public, max-age=${durationInSeconds}, stale-while-revalidate=${durationInSeconds * 10}`);
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
 * Clear cache keys matching a prefix using SCAN (non-blocking, safe for production).
 */
export const clearCachePrefix = async (prefix: string): Promise<void> => {
  try {
    const pattern = `api_cache:${prefix}*`;
    let cursor = 0;
    const keysToDelete: string[] = [];

    do {
      const reply = await redisClient.scan(cursor, { MATCH: pattern, COUNT: 100 });
      cursor = reply.cursor;
      keysToDelete.push(...reply.keys);
    } while (cursor !== 0);

    if (keysToDelete.length > 0) {
      await redisClient.del(keysToDelete);
      logger.info(`Cleared ${keysToDelete.length} cache keys for prefix: ${prefix}`);
    }
  } catch (error) {
    logger.error("Failed to clear cache prefix:", error);
  }
};
