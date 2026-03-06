import express from 'express';
import {
  createCompany,
  getCompanies,
  getCompanyById,
  getDefaultCompany,
  updateCompany,
  deleteCompany,
  hardDeleteCompany,
} from '../controllers/company.controller.js';
import { protect, adminOnly } from '../middlewares/auth.middleware.js';
import upload from '../middlewares/upload.middleware.js';
import { resolveTenant, requireTenant } from '../middlewares/tenant.middleware.js'; // Import tenant middleware

const router = express.Router();

// Apply tenant resolution middleware to all routes (supports both admin header and storefront domain)
router.use(resolveTenant);
router.use(requireTenant);

// Public routes (for storefront, will use resolveTenantFromDomain)
router.get('/', getCompanies);
router.get('/default', getDefaultCompany); // Public route to get default company for invoices
router.get('/:id', getCompanyById);

// Protected routes (require authentication and tenant context)
router.post('/', protect, adminOnly, upload.single('logo'), createCompany);
router.put('/:id', protect, adminOnly, upload.single('logo'), updateCompany);
router.delete('/:id', protect, adminOnly, deleteCompany);
router.delete('/:id/hard', protect, adminOnly, hardDeleteCompany);

export default router;
