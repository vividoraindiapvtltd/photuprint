import express from 'express';
import { 
  getSleeveTypes, 
  getSleeveTypeById, 
  createSleeveType, 
  updateSleeveType, 
  deleteSleeveType, 
  hardDeleteSleeveType 
} from '../controllers/sleeveType.controller.js';
import { protect, adminOnly } from '../middlewares/auth.middleware.js';
import { resolveTenant, requireTenant } from '../middlewares/tenant.middleware.js';
import upload from '../middlewares/upload.middleware.js';

const router = express.Router();

// Apply tenant resolution middleware to all routes
router.use(resolveTenant);
router.use(requireTenant);

// Public routes
router.get('/', getSleeveTypes);
router.get('/:id', getSleeveTypeById);

// Protected routes (require authentication)
router.post('/', protect, adminOnly, upload.single('image'), createSleeveType);
router.put('/:id', protect, adminOnly, upload.single('image'), updateSleeveType);
router.delete('/:id', protect, adminOnly, deleteSleeveType);
router.delete('/:id/hard', protect, adminOnly, hardDeleteSleeveType);

export default router;
