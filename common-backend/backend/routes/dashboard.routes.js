import express from 'express';
import { getDashboardStats } from '../controllers/dashboard.controller.js';
import { protect, adminOnly } from '../middlewares/auth.middleware.js';
import { resolveTenant } from '../middlewares/tenant.middleware.js';

const router = express.Router();

// Apply tenant resolution middleware
router.use(resolveTenant);

// Get dashboard statistics (admin only)
router.get('/stats', protect, adminOnly, getDashboardStats);

export default router;
