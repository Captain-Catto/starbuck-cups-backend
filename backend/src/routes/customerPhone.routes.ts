import { Router } from "express";
import {
  getCustomerPhones,
  createCustomerPhone,
  updateCustomerPhone,
  deleteCustomerPhone,
  setMainPhone,
} from "../controllers/customerPhone.controller";
import { authenticateAdmin } from "../middleware/auth.middleware";

const router = Router();

// All customer phone routes require admin authentication
router.use(authenticateAdmin);

// Customer phone routes
router.get("/customers/:customerId/phones", getCustomerPhones);
router.post("/customers/:customerId/phones", createCustomerPhone);
router.put("/phones/:phoneId", updateCustomerPhone);
router.delete("/phones/:phoneId", deleteCustomerPhone);
router.put("/phones/:phoneId/set-main", setMainPhone);

export default router;