import express from 'express';
import { 
  createCategory, 
  getCategories, 
  getCategoryById, 
  updateCategory, 
  deleteCategory, 
  hardDeleteCategory 
} from '../controllers/category.controller.js';
import upload from '../middlewares/upload.middleware.js';
import { resolveTenantFromHeader, requireTenant } from '../middlewares/tenant.middleware.js';

const router = express.Router();

// Apply tenant resolution middleware to all routes
router.use(resolveTenantFromHeader);
router.use(requireTenant);

// Public routes
router.get('/', getCategories);
router.get('/:id', getCategoryById);

// Protected routes (require authentication)
router.post('/', upload.single('image'), createCategory);
router.put('/:id', upload.single('image'), updateCategory);
router.delete('/:id', deleteCategory);
router.delete('/:id/hard', hardDeleteCategory);

export default router;
