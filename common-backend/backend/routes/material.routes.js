import express from 'express';
import { 
  getMaterials, 
  getMaterialById, 
  createMaterial, 
  updateMaterial, 
  deleteMaterial, 
  hardDeleteMaterial 
} from '../controllers/material.controller.js';
import { protect, adminOnly } from '../middlewares/auth.middleware.js';
import { resolveTenant, requireTenant } from '../middlewares/tenant.middleware.js';
import upload from '../middlewares/upload.middleware.js';

const router = express.Router();

// Apply tenant resolution middleware to all routes
router.use(resolveTenant);
router.use(requireTenant);

// Public routes
router.get('/', getMaterials);
router.get('/:id', getMaterialById);

// Protected routes (require authentication)
router.post('/', protect, adminOnly, upload.single('image'), createMaterial);
router.put('/:id', protect, adminOnly, upload.single('image'), updateMaterial);
router.delete('/:id', protect, adminOnly, deleteMaterial);
router.delete('/:id/hard', protect, adminOnly, hardDeleteMaterial);

export default router;
