import { Request, Response, NextFunction } from "express";
import { createClient } from "redis";
import { ResponseHelper } from "../types/api";

const redisClient = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
});

redisClient.on("error", (err) => console.error("Redis Cache Client Error", err));
redisClient.connect().catch(console.error);

/**
 * Middleware to cache API responses in Redis
 * @param durationInSeconds How long to keep the cache. Default: 300s (5 minutes)
 */
export const redisCacheMiddleware = (durationInSeconds: number = 300) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Only cache GET requests
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
          res.send(cached.data);
          return;
        }

        // 2. Stale cache -> SWR (Stale-While-Revalidate)
        res.setHeader("X-Cache", "STALE");
        res.setHeader("Content-Type", "application/json");
        res.send(cached.data);

        // Mutate response object to capture the background fetch without sending headers
        res.status = () => res;
        res.setHeader = () => res;
        res.json = (body: any) => {
          if (body && body.success === true) {
            const cacheData = {
              _staleAt: Date.now() + durationInSeconds * 1000,
              data: body
            };
            // Keep stale cache in Redis for 10x the duration
            redisClient.setEx(key, durationInSeconds * 10, JSON.stringify(cacheData)).catch(err => {
              console.error("Redis Cache SWR Set Error:", err);
            });
          }
          return res as any;
        };

        // Trigger the controller to fetch fresh data in the background
        next();
        return;
      }

      // 3. Cache MISS -> Wait for controller
      res.setHeader("X-Cache", "MISS");
      
      const originalJson = res.json.bind(res);
      res.json = (body: any) => {
        if (body && body.success === true) {
          const cacheData = {
            _staleAt: Date.now() + durationInSeconds * 1000,
            data: body
          };
          redisClient.setEx(key, durationInSeconds * 10, JSON.stringify(cacheData)).catch(err => {
            console.error("Redis Cache Set Error:", err);
          });
        }
        return originalJson(body);
      };

      next();
    } catch (error) {
      console.error("Redis Cache Middleware Error:", error);
      next(); // Continue without caching if Redis fails
    }
  };
};

/**
 * Utility to clear cache for specific prefixes (e.g., when a product is updated)
 */
export const clearCachePrefix = async (prefix: string): Promise<void> => {
  try {
    const keys = await redisClient.keys(`api_cache:${prefix}*`);
    if (keys.length > 0) {
      await redisClient.del(keys);
    }
  } catch (error) {
    console.error("Failed to clear cache prefix:", error);
  }
};
