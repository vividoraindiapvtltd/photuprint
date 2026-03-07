import express from 'express';
import {
  getOrders,
  getMyOrders,
  getOrderById,
  createOrder,
  updateOrder,
  cancelMyOrder,
  deleteOrder,
  hardDeleteOrder
} from '../controllers/order.controller.js';
import { protect, adminOnly } from '../middlewares/auth.middleware.js';
import { resolveTenantFromHeader, requireTenant } from '../middlewares/tenant.middleware.js';

const router = express.Router();

// Apply tenant resolution middleware to all routes (after auth)
router.use(protect);
router.use(resolveTenantFromHeader);
router.use(requireTenant);

// Protected routes – specific paths before /:id
// Current user's orders (for account/profile page)
router.get('/my-orders', getMyOrders);
// User cancel own order (pending/confirmed only)
router.post('/:id/cancel', cancelMyOrder);

// Get all orders - admin only
router.get('/', adminOnly, getOrders);
// Get single order - admin only
router.get('/:id', adminOnly, getOrderById);
// Create order - can be used by authenticated users or admin
router.post('/', createOrder);
// Update order - admin only
router.put('/:id', adminOnly, updateOrder);
// Delete order (soft delete) - admin only
router.delete('/:id', adminOnly, deleteOrder);
// Hard delete order - admin only
router.delete('/:id/hard', adminOnly, hardDeleteOrder);

export default router;
