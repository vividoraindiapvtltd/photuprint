import express from 'express';
import { 
  getPatterns, 
  getPatternById, 
  createPattern, 
  updatePattern, 
  deletePattern, 
  hardDeletePattern 
} from '../controllers/pattern.controller.js';
import { protect, adminOnly } from '../middlewares/auth.middleware.js';
import { resolveTenant, requireTenant } from '../middlewares/tenant.middleware.js';
import upload from '../middlewares/upload.middleware.js';

const router = express.Router();

// Apply tenant resolution middleware to all routes
router.use(resolveTenant);
router.use(requireTenant);

// Public routes
router.get('/', getPatterns);
router.get('/:id', getPatternById);

// Protected routes (require authentication)
router.post('/', protect, adminOnly, upload.single('image'), createPattern);
router.put('/:id', protect, adminOnly, upload.single('image'), updatePattern);
router.delete('/:id', protect, adminOnly, deletePattern);
router.delete('/:id/hard', protect, adminOnly, hardDeletePattern);

export default router;
