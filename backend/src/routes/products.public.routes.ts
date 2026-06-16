/**
 * Public product routes — no authentication, Redis-cached.
 * Mounted at /api/products
 */
import { Router } from "express";
import {
  getPublicProducts,
  getPublicProductById,
} from "../controllers/products.controller";
import { redisCacheMiddleware } from "../middleware/redis-cache.middleware";

const router = Router();

// GET /api/products?page=&limit=&search=&categoryId=&colorId=&capacityId=&isFeatured=&sortBy=
router.get("/", redisCacheMiddleware(300), getPublicProducts);
router.get("/public", redisCacheMiddleware(300), getPublicProducts);

// GET /api/products/public/:id — accepts product id or slug
router.get("/public/:id", redisCacheMiddleware(600), getPublicProductById);

// GET /api/products/:id — accepts product id or slug (must stay last: catch-all param route)
router.get("/:id", redisCacheMiddleware(600), getPublicProductById);

export default router;
