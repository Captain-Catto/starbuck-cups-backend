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
  getCustomersForSelect,
} from "../controllers/customers.controller";
import {
  authenticateWithAutoRefresh,
  requireAdmin,
} from "../middleware/auth.middleware";

const router = express.Router();

// Customer routes
router.get("/", authenticateWithAutoRefresh, getCustomers);
router.get("/search", authenticateWithAutoRefresh, searchCustomers);
router.get("/:id", authenticateWithAutoRefresh, getCustomerById);
router.get("/:id/orders", authenticateWithAutoRefresh, getCustomerOrders);
router.post("/", authenticateWithAutoRefresh, requireAdmin, createCustomer);
router.put("/:id", authenticateWithAutoRefresh, requireAdmin, updateCustomer);
router.delete(
  "/:id",
  authenticateWithAutoRefresh,
  requireAdmin,
  deleteCustomer
);

// Customer address routes
router.post(
  "/:customerId/addresses",
  authenticateWithAutoRefresh,
  requireAdmin,
  addCustomerAddress
);
router.put(
  "/:customerId/addresses/:addressId",
  authenticateWithAutoRefresh,
  requireAdmin,
  updateCustomerAddress
);
router.put(
  "/:customerId/addresses/:addressId/set-default",
  authenticateWithAutoRefresh,
  requireAdmin,
  setDefaultAddress
);
router.delete(
  "/:customerId/addresses/:addressId",
  authenticateWithAutoRefresh,
  requireAdmin,
  deleteCustomerAddress
);

export default router;
