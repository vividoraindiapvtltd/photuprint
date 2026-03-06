import express from 'express';
import {
  createGstSlab,
  getGstSlabs,
  getGstSlabById,
  updateGstSlab,
  deleteGstSlab,
  hardDeleteGstSlab,
} from '../controllers/gstSlab.controller.js';
import { protect, adminOnly } from '../middlewares/auth.middleware.js';
import { resolveTenant, requireTenant } from '../middlewares/tenant.middleware.js';

const router = express.Router();

// Apply tenant resolution middleware to all routes
router.use(resolveTenant);
router.use(requireTenant);

// Public routes
router.get('/', getGstSlabs);
router.get('/:id', getGstSlabById);

// Protected routes (require authentication)
router.post('/', protect, adminOnly, createGstSlab);
router.put('/:id', protect, adminOnly, updateGstSlab);
router.delete('/:id', protect, adminOnly, deleteGstSlab);
router.delete('/:id/hard', protect, adminOnly, hardDeleteGstSlab);

export default router;
