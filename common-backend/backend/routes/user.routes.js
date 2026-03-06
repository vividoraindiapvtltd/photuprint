import express from 'express';
import {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  hardDeleteUser
} from '../controllers/user.controller.js';
import { protect, adminOnly } from '../middlewares/auth.middleware.js';
import { optionalTenant } from '../middlewares/tenant.middleware.js';

const router = express.Router();

// Public routes (if needed for registration)
// router.post('/', createUser); // Keep this public if registration needs it

// Protected admin routes
// optionalTenant now resolves tenant from header if present, or allows super admin to proceed without it
router.get('/', protect, adminOnly, optionalTenant, getUsers);
router.get('/:id', protect, adminOnly, optionalTenant, getUserById);
router.post('/', protect, adminOnly, optionalTenant, createUser);
router.put('/:id', protect, adminOnly, optionalTenant, updateUser);
router.delete('/:id', protect, adminOnly, optionalTenant, deleteUser);
router.delete('/:id/hard', protect, adminOnly, optionalTenant, hardDeleteUser);

export default router;
