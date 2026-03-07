import express from 'express';
import { getDashboardStats } from '../controllers/dashboard.controller.js';
import { protect, adminOnly } from '../middlewares/auth.middleware.js';
import { resolveTenantFromHeader } from '../middlewares/tenant.middleware.js';

const router = express.Router();

// Get dashboard statistics (admin only).
// Order: protect first so unauthenticated requests get 401 without running tenant resolution.
router.get('/stats', protect, adminOnly, resolveTenantFromHeader, getDashboardStats);

export default router;
