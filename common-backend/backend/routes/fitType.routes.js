import express from 'express';
import { 
  createFitType, 
  getFitTypes, 
  getFitTypeById, 
  updateFitType, 
  deleteFitType, 
  hardDeleteFitType 
} from '../controllers/fitType.controller.js';
import { protect, adminOnly } from '../middlewares/auth.middleware.js';
import { resolveTenantFromHeader, requireTenant } from '../middlewares/tenant.middleware.js';

const router = express.Router();

// Apply tenant resolution middleware to all routes (supports both admin header and storefront domain)
router.use(resolveTenantFromHeader);
router.use(requireTenant);

// Public routes
router.get('/', getFitTypes);
router.get('/:id', getFitTypeById);

// Protected routes (require authentication)
router.post('/', protect, adminOnly, createFitType);
router.put('/:id', protect, adminOnly, updateFitType);
router.delete('/:id', protect, adminOnly, deleteFitType);
router.delete('/:id/hard', protect, adminOnly, hardDeleteFitType);

export default router;
