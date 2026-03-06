import express from 'express';
import { 
  createSubCategory, 
  getSubCategories, 
  getSubCategoryById, 
  updateSubCategory, 
  deleteSubCategory, 
  hardDeleteSubCategory,
  revertSubCategory,
  updateExistingSubcategoryIds
} from '../controllers/subcategory.controller.js';
import upload from '../middlewares/upload.middleware.js';
import { resolveTenantFromHeader, requireTenant } from '../middlewares/tenant.middleware.js';

const router = express.Router();

// Apply tenant resolution middleware to all routes
router.use(resolveTenantFromHeader);
router.use(requireTenant);

// Public routes
router.get('/', getSubCategories);
router.get('/:id', getSubCategoryById);
router.post('/update-ids', updateExistingSubcategoryIds);

// Protected routes (require authentication)
router.post('/', upload.single('image'), createSubCategory);
router.put('/:id', upload.single('image'), updateSubCategory);
router.delete('/:id', deleteSubCategory);
router.delete('/:id/hard', hardDeleteSubCategory);
router.put('/:id/revert', revertSubCategory);

export default router;
