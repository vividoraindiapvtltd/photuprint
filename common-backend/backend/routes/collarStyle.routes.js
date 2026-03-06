import express from 'express';
import { 
  createCollarStyle, 
  getCollarStyles, 
  getCollarStyleById, 
  updateCollarStyle, 
  deleteCollarStyle, 
  hardDeleteCollarStyle,
  revertCollarStyle
} from '../controllers/collarStyle.controller.js';
import { protect, adminOnly } from '../middlewares/auth.middleware.js';
import { resolveTenantFromHeader, requireTenant } from '../middlewares/tenant.middleware.js';

const router = express.Router();

// Apply tenant resolution middleware to all routes (supports both admin header and storefront domain)
router.use(resolveTenantFromHeader);
router.use(requireTenant);

// Public routes
router.get('/', getCollarStyles);
router.get('/:id', getCollarStyleById);

// Protected routes (require authentication)
router.post('/', protect, adminOnly, createCollarStyle);
router.put('/:id', protect, adminOnly, updateCollarStyle);
router.delete('/:id', protect, adminOnly, deleteCollarStyle);
router.delete('/:id/hard', protect, adminOnly, hardDeleteCollarStyle);
router.put('/:id/revert', protect, adminOnly, revertCollarStyle);

export default router; 