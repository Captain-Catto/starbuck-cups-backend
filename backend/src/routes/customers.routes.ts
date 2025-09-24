import express from 'express';
import {
  getCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  addCustomerAddress,
  updateCustomerAddress,
  deleteCustomerAddress,
  setDefaultCustomerAddress,
  searchCustomers,
  getCustomerOrders,
} from '../controllers/customers.controller';
import { authenticate, requireAdmin } from '../middleware/auth.middleware';

const router = express.Router();

// Customer routes
router.get('/', authenticate, getCustomers);
router.get('/search', authenticate, searchCustomers);
router.get('/:id', authenticate, getCustomerById);
router.get('/:id/orders', authenticate, getCustomerOrders);
router.post('/', authenticate, requireAdmin, createCustomer);
router.put('/:id', authenticate, requireAdmin, updateCustomer);
router.delete('/:id', authenticate, requireAdmin, deleteCustomer);

// Customer address routes
router.post('/:customerId/addresses', authenticate, requireAdmin, addCustomerAddress);
router.put('/:customerId/addresses/:addressId', authenticate, requireAdmin, updateCustomerAddress);
router.put('/:customerId/addresses/:addressId/set-default', authenticate, requireAdmin, setDefaultCustomerAddress);
router.delete('/:customerId/addresses/:addressId', authenticate, requireAdmin, deleteCustomerAddress);

export default router;