import express from 'express';
import {
  createWebsite,
  getWebsites,
  getWebsiteById,
  getWebsiteByDomain,
  updateWebsite,
  deleteWebsite,
  hardDeleteWebsite,
} from '../controllers/website.controller.js';
import { protect, adminOnly } from '../middlewares/auth.middleware.js';

const router = express.Router();

// Public routes
router.get('/', getWebsites);
router.get('/domain/:domain', getWebsiteByDomain); // Get website by domain (for frontend)
router.get('/:id', getWebsiteById);

// Protected routes (require authentication)
router.post('/', protect, adminOnly, createWebsite);
router.put('/:id', protect, adminOnly, updateWebsite);
router.delete('/:id', protect, adminOnly, deleteWebsite);
router.delete('/:id/hard', protect, adminOnly, hardDeleteWebsite);

export default router;
