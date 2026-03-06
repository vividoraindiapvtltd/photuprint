import express from 'express';
import { 
  createCountry, 
  getCountries, 
  getCountryById, 
  updateCountry, 
  deleteCountry, 
  hardDeleteCountry 
} from '../controllers/country.controller.js';
import { protect, adminOnly } from '../middlewares/auth.middleware.js';
import { resolveTenantFromHeader, requireTenant } from '../middlewares/tenant.middleware.js';

const router = express.Router();

// Apply tenant resolution middleware to all routes (supports both admin header and storefront domain)
router.use(resolveTenantFromHeader);
router.use(requireTenant);

// Public routes
router.get('/', getCountries);
router.get('/:id', getCountryById);

// Protected routes (require authentication)
router.post('/', protect, adminOnly, createCountry);
router.put('/:id', protect, adminOnly, updateCountry);
router.delete('/:id', protect, adminOnly, deleteCountry);
router.delete('/:id/hard', protect, adminOnly, hardDeleteCountry);

export default router;
