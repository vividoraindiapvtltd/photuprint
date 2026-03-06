import express from 'express';
import { 
  getCoupons, 
  getCouponById, 
  createCoupon,
  updateCoupon,
  deleteCoupon,
  hardDeleteCoupon 
} from '../controllers/coupon.controller.js';
import { protect, adminOnly } from '../middlewares/auth.middleware.js';
import { resolveTenantFromHeader, requireTenant } from '../middlewares/tenant.middleware.js';

const router = express.Router();

// Apply tenant resolution middleware to all routes
router.use(resolveTenantFromHeader);
router.use(requireTenant);

router.get('/', getCoupons);
router.get('/:id', getCouponById);
router.post('/', protect, adminOnly, createCoupon);
router.put('/:id', protect, adminOnly, updateCoupon);
router.delete('/:id', protect, adminOnly, deleteCoupon);
router.delete('/:id/hard', protect, adminOnly, hardDeleteCoupon);

export default router;
