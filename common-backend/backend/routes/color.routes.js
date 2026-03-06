import express from 'express';
import { 
  createColor, 
  getColors, 
  getColorById, 
  updateColor, 
  deleteColor, 
  hardDeleteColor 
} from '../controllers/color.controller.js';
import upload from '../middlewares/upload.middleware.js';
import { protect, adminOnly } from '../middlewares/auth.middleware.js';
import { resolveTenant, requireTenant } from '../middlewares/tenant.middleware.js';

const router = express.Router();

// Apply tenant resolution middleware to all routes (supports both admin header and storefront domain)
router.use(resolveTenant);
router.use(requireTenant);

// Public routes
router.get('/', getColors);
router.get('/:id', getColorById);

// Protected routes (require authentication)
router.post('/', protect, adminOnly, upload.single('image'), createColor);
router.put('/:id', protect, adminOnly, upload.single('image'), updateColor);
router.delete('/:id', protect, adminOnly, deleteColor);
router.delete('/:id/hard', protect, adminOnly, hardDeleteColor);

export default router;
