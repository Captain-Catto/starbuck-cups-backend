import express from "express";
import { analyticsController } from "../controllers/analytics.controller";
import { authenticateWithAutoRefresh, requirePermission, rateLimitAnalytics } from "../middleware/auth.middleware";
import { PERMISSIONS } from "../constants/permissions";

const router = express.Router();

// Public endpoints for tracking (no authentication required, rate limited)
router.post("/product-click", rateLimitAnalytics, (req, res) =>
  analyticsController.trackProductClick(req, res)
);
router.post("/add-to-cart-click", rateLimitAnalytics, (req, res) =>
  analyticsController.trackAddToCartClick(req, res)
);

// Admin-only endpoints for viewing analytics
router.get("/product/:productId", authenticateWithAutoRefresh, requirePermission(PERMISSIONS.DASHBOARD_VIEW), (req, res) =>
  analyticsController.getProductAnalytics(req, res)
);
router.get("/top-clicked", authenticateWithAutoRefresh, requirePermission(PERMISSIONS.DASHBOARD_VIEW), (req, res) =>
  analyticsController.getTopClickedProducts(req, res)
);
router.get("/top-added-to-cart", authenticateWithAutoRefresh, requirePermission(PERMISSIONS.DASHBOARD_VIEW), (req, res) =>
  analyticsController.getTopAddedToCartProducts(req, res)
);
router.get("/top-conversion", authenticateWithAutoRefresh, requirePermission(PERMISSIONS.DASHBOARD_VIEW), (req, res) =>
  analyticsController.getTopConversionProducts(req, res)
);
router.get("/summary", authenticateWithAutoRefresh, requirePermission(PERMISSIONS.DASHBOARD_VIEW), (req, res) =>
  analyticsController.getAnalyticsSummary(req, res)
);
router.post("/bulk", authenticateWithAutoRefresh, requirePermission(PERMISSIONS.DASHBOARD_VIEW), (req, res) =>
  analyticsController.getBulkProductAnalytics(req, res)
);

export default router;
