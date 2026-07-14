import { Router } from "express";
import {
  getPublicNewsList,
  getPublicNewsBySlug,
  getAdminNewsList,
  getAdminNewsById,
  createNews,
  updateNews,
  deleteNews,
  toggleNewsStatus,
} from "../controllers/news.controller";
import { authenticateWithAutoRefresh, requireAdmin } from "../middleware/auth.middleware";
import {
  redisCacheMiddleware,
  invalidateCachePrefixOnSuccess,
} from "../middleware/redis-cache.middleware";

const router = Router();

const invalidateNewsCache = invalidateCachePrefixOnSuccess("/api/news");

// Public — note: caching the slug route makes the views counter approximate,
// which it already is (the Next.js layer caches this endpoint for 10 minutes).
router.get("/public", redisCacheMiddleware(600), getPublicNewsList);
router.get("/public/:slug", redisCacheMiddleware(600), getPublicNewsBySlug);

// Admin (protected)
router.get("/admin", authenticateWithAutoRefresh, requireAdmin, getAdminNewsList);
router.get("/admin/:id", authenticateWithAutoRefresh, requireAdmin, getAdminNewsById);
router.post("/admin", authenticateWithAutoRefresh, requireAdmin, invalidateNewsCache, createNews);
router.put("/admin/:id", authenticateWithAutoRefresh, requireAdmin, invalidateNewsCache, updateNews);
router.delete("/admin/:id", authenticateWithAutoRefresh, requireAdmin, invalidateNewsCache, deleteNews);
router.patch("/admin/:id/status", authenticateWithAutoRefresh, requireAdmin, invalidateNewsCache, toggleNewsStatus);

export default router;
