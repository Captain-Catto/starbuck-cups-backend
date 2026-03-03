import { Router } from "express";
import {
  getCustomerPhones,
  createCustomerPhone,
  updateCustomerPhone,
  deleteCustomerPhone,
  setMainPhone,
} from "../controllers/customerPhone.controller";
import { authenticateAdmin } from "../middleware/auth.middleware";
import { syncCustomer } from "../middleware/auto-sync.middleware";

const router = Router();

// All customer phone routes require admin authentication
router.use(authenticateAdmin);

// Customer phone routes
router.get("/customers/:customerId/phones", getCustomerPhones);
router.post("/customers/:customerId/phones", syncCustomer.update(), createCustomerPhone);
router.put("/phones/:phoneId", syncCustomer.update(), updateCustomerPhone);
router.delete("/phones/:phoneId", syncCustomer.update(), deleteCustomerPhone);
router.put("/phones/:phoneId/set-main", syncCustomer.update(), setMainPhone);

export default router;
