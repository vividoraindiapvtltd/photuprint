import express from 'express';
import {
  getUsers,
  getProfile,
  updateMyProfile,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  hardDeleteUser
} from '../controllers/user.controller.js';
import { protect, adminOnly, optionalAuth } from '../middlewares/auth.middleware.js';
import { optionalTenant } from '../middlewares/tenant.middleware.js';

const router = express.Router();

// Public routes (if needed for registration)
// router.post('/', createUser); // Keep this public if registration needs it

// Current user's profile (optionalAuth: no token → { user: null }; with token → user object)
router.get('/profile', optionalAuth, getProfile);
// Update current user's profile (name, phone, address) - storefront
router.put('/profile', protect, updateMyProfile);

// Protected admin routes
// optionalTenant now resolves tenant from header if present, or allows super admin to proceed without it
router.get('/', protect, adminOnly, optionalTenant, getUsers);
router.get('/:id', protect, adminOnly, optionalTenant, getUserById);
router.post('/', protect, adminOnly, optionalTenant, createUser);
router.put('/:id', protect, adminOnly, optionalTenant, updateUser);
router.delete('/:id', protect, adminOnly, optionalTenant, deleteUser);
router.delete('/:id/hard', protect, adminOnly, optionalTenant, hardDeleteUser);

export default router;
