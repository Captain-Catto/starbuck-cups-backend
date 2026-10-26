import { Router } from "express";
import {
  getCustomerPhones,
  createCustomerPhone,
  updateCustomerPhone,
  deleteCustomerPhone,
  setMainPhone,
} from "../controllers/customerPhone.controller";
import { authenticateAdmin, requirePermission } from "../middleware/auth.middleware";
import { syncCustomer } from "../middleware/auto-sync.middleware";
import { PERMISSIONS } from "../constants/permissions";

const router = Router();

// All customer phone routes require admin authentication
router.use(authenticateAdmin);

// Customer phone routes
router.get("/customers/:customerId/phones", requirePermission(PERMISSIONS.CUSTOMERS_VIEW), getCustomerPhones);
router.post("/customers/:customerId/phones", requirePermission(PERMISSIONS.CUSTOMERS_MANAGE), syncCustomer.update(), createCustomerPhone);
router.put("/phones/:phoneId", requirePermission(PERMISSIONS.CUSTOMERS_MANAGE), syncCustomer.update(), updateCustomerPhone);
router.delete("/phones/:phoneId", requirePermission(PERMISSIONS.CUSTOMERS_MANAGE), syncCustomer.update(), deleteCustomerPhone);
router.put("/phones/:phoneId/set-main", requirePermission(PERMISSIONS.CUSTOMERS_MANAGE), syncCustomer.update(), setMainPhone);

export default router;
