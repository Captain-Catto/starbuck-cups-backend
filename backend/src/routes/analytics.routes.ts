import express from "express";
import { analyticsController } from "../controllers/analytics.controller";
import { authenticateWithAutoRefresh, requireAdmin, rateLimitAnalytics } from "../middleware/auth.middleware";

const router = express.Router();

// Public endpoints for tracking (no authentication required, rate limited)
router.post("/product-click", rateLimitAnalytics, (req, res) =>
  analyticsController.trackProductClick(req, res)
);
router.post("/add-to-cart-click", rateLimitAnalytics, (req, res) =>
  analyticsController.trackAddToCartClick(req, res)
);

// Admin-only endpoints for viewing analytics
router.get("/product/:productId", authenticateWithAutoRefresh, requireAdmin, (req, res) =>
  analyticsController.getProductAnalytics(req, res)
);
router.get("/top-clicked", authenticateWithAutoRefresh, requireAdmin, (req, res) =>
  analyticsController.getTopClickedProducts(req, res)
);
router.get("/top-added-to-cart", authenticateWithAutoRefresh, requireAdmin, (req, res) =>
  analyticsController.getTopAddedToCartProducts(req, res)
);
router.get("/top-conversion", authenticateWithAutoRefresh, requireAdmin, (req, res) =>
  analyticsController.getTopConversionProducts(req, res)
);
router.get("/summary", authenticateWithAutoRefresh, requireAdmin, (req, res) =>
  analyticsController.getAnalyticsSummary(req, res)
);
router.post("/bulk", authenticateWithAutoRefresh, requireAdmin, (req, res) =>
  analyticsController.getBulkProductAnalytics(req, res)
);

export default router;
