import express from 'express';
import { 
  getBrands, 
  getBrandById, 
  createBrand, 
  updateBrand, 
  deleteBrand, 
  hardDeleteBrand 
} from '../controllers/brand.controller.js';
import upload from '../middlewares/upload.middleware.js';
import { resolveTenant, requireTenant } from '../middlewares/tenant.middleware.js';
import { protect, adminOnly } from '../middlewares/auth.middleware.js';

const router = express.Router();

// Apply tenant resolution middleware to all routes (supports both admin header and storefront domain)
router.use(resolveTenant);
router.use(requireTenant);

// Public routes (for storefront, will use resolveTenantFromDomain)
router.get('/', getBrands);
router.get('/:id', getBrandById);

// Protected routes (require authentication)
// For admin CMS: requires admin role
// For storefront: requires authentication (but not necessarily admin role)
router.post('/', protect, upload.single('logo'), createBrand);
router.put('/:id', protect, upload.single('logo'), updateBrand);
router.delete('/:id', protect, adminOnly, deleteBrand);
router.delete('/:id/hard', protect, adminOnly, hardDeleteBrand);

export default router; 