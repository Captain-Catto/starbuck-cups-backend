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

const router = Router();

// Public
router.get("/public", getPublicNewsList);
router.get("/public/:slug", getPublicNewsBySlug);

// Admin (protected)
router.get("/admin", authenticateWithAutoRefresh, requireAdmin, getAdminNewsList);
router.get("/admin/:id", authenticateWithAutoRefresh, requireAdmin, getAdminNewsById);
router.post("/admin", authenticateWithAutoRefresh, requireAdmin, createNews);
router.put("/admin/:id", authenticateWithAutoRefresh, requireAdmin, updateNews);
router.delete("/admin/:id", authenticateWithAutoRefresh, requireAdmin, deleteNews);
router.patch("/admin/:id/status", authenticateWithAutoRefresh, requireAdmin, toggleNewsStatus);

export default router;
