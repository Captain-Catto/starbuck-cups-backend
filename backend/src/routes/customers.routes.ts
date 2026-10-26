import express from "express";
import {
  getCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  addCustomerAddress,
  updateCustomerAddress,
  deleteCustomerAddress,
  setDefaultAddress,
  searchCustomers,
  getCustomerOrders,
} from "../controllers/customers.controller";
import {
  authenticateWithAutoRefresh,
  requirePermission,
} from "../middleware/auth.middleware";
import { syncCustomer } from "../middleware/auto-sync.middleware";
import { PERMISSIONS } from "../constants/permissions";

const router = express.Router();

// Customer routes
router.get("/", authenticateWithAutoRefresh, requirePermission(PERMISSIONS.CUSTOMERS_VIEW), getCustomers);
router.get("/search", authenticateWithAutoRefresh, requirePermission(PERMISSIONS.CUSTOMERS_VIEW), searchCustomers);
router.get("/:id", authenticateWithAutoRefresh, requirePermission(PERMISSIONS.CUSTOMERS_VIEW), getCustomerById);
router.get("/:id/orders", authenticateWithAutoRefresh, requirePermission(PERMISSIONS.CUSTOMERS_VIEW), getCustomerOrders);
router.post(
  "/",
  authenticateWithAutoRefresh,
  requirePermission(PERMISSIONS.CUSTOMERS_MANAGE),
  syncCustomer.create(),
  createCustomer
);
router.put(
  "/:id",
  authenticateWithAutoRefresh,
  requirePermission(PERMISSIONS.CUSTOMERS_MANAGE),
  syncCustomer.update(),
  updateCustomer
);
router.delete(
  "/:id",
  authenticateWithAutoRefresh,
  requirePermission(PERMISSIONS.CUSTOMERS_MANAGE),
  syncCustomer.delete(),
  deleteCustomer
);

// Customer address routes
router.post(
  "/:customerId/addresses",
  authenticateWithAutoRefresh,
  requirePermission(PERMISSIONS.CUSTOMERS_MANAGE),
  addCustomerAddress
);
router.put(
  "/:customerId/addresses/:addressId",
  authenticateWithAutoRefresh,
  requirePermission(PERMISSIONS.CUSTOMERS_MANAGE),
  updateCustomerAddress
);
router.put(
  "/:customerId/addresses/:addressId/set-default",
  authenticateWithAutoRefresh,
  requirePermission(PERMISSIONS.CUSTOMERS_MANAGE),
  setDefaultAddress
);
router.delete(
  "/:customerId/addresses/:addressId",
  authenticateWithAutoRefresh,
  requirePermission(PERMISSIONS.CUSTOMERS_MANAGE),
  deleteCustomerAddress
);

export default router;
