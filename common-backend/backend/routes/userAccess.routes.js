import express from "express"
import {
  // Permission management
  getAllPermissions,
  seedPermissions,
  createPermission,
  deletePermission,
  
  // Staff user management
  getStaffUsers,
  getStaffUserById,
  createStaffUser,
  updateStaffUser,
  updateUserPermissions,
  toggleUserStatus,
  deleteStaffUser,
  restoreStaffUser,
  hardDeleteStaffUser,
  resetUserPassword,
  unlockUserAccount,
  
  // Statistics & current user
  getUserAccessStats,
  getCurrentUserPermissions,
  
  // Customer promotion
  getCustomers,
  promoteToStaff,
  
  // Website access
  getMyAccessibleWebsites,
  updateUserWebsiteAccess
} from "../controllers/userAccess.controller.js"

import { protect, adminOnly } from "../middlewares/auth.middleware.js"
import { optionalTenant } from "../middlewares/tenant.middleware.js"
import { requirePermission, requireSuperAdmin, requireAnyPermission } from "../middlewares/permission.middleware.js"

const router = express.Router()

/**
 * User Access Management Routes
 * 
 * All routes require authentication.
 * Most routes require super_admin or user_access_manage permission.
 * 
 * NOTE: Permission routes don't need tenant context as permissions are global.
 * User management routes use optionalTenant for multi-tenant filtering.
 */

// ============================================================================
// CURRENT USER PERMISSIONS (for frontend) - No tenant required
// ============================================================================

// Get current user's permissions (any authenticated user)
router.get(
  "/my-permissions",
  protect,
  getCurrentUserPermissions
)

// ============================================================================
// PERMISSION MANAGEMENT - Global routes (no tenant required)
// ============================================================================

// Get all permissions (admin+ can view) - Permissions are global
router.get(
  "/permissions",
  protect,
  adminOnly,
  getAllPermissions
)

// Seed default permissions (super admin only)
router.post(
  "/permissions/seed",
  protect,
  requireSuperAdmin,
  seedPermissions
)

// Create custom permission (super admin only)
router.post(
  "/permissions",
  protect,
  requireSuperAdmin,
  createPermission
)

// Delete permission (super admin only)
router.delete(
  "/permissions/:permId",
  protect,
  requireSuperAdmin,
  deletePermission
)

// ============================================================================
// STAFF USER MANAGEMENT - Requires tenant context
// ============================================================================

// Get user access statistics
router.get(
  "/stats",
  protect,
  adminOnly,
  optionalTenant,
  getUserAccessStats
)

// Get all staff users
router.get(
  "/users",
  protect,
  adminOnly,
  optionalTenant,
  getStaffUsers
)

// Create staff user
router.post(
  "/users",
  protect,
  adminOnly,
  optionalTenant,
  createStaffUser
)

// Get single staff user - must be after /users to avoid matching
router.get(
  "/users/:id",
  protect,
  adminOnly,
  optionalTenant,
  getStaffUserById
)

// Update staff user
router.put(
  "/users/:id",
  protect,
  adminOnly,
  optionalTenant,
  updateStaffUser
)

// Update user permissions only
router.put(
  "/users/:id/permissions",
  protect,
  adminOnly,
  optionalTenant,
  updateUserPermissions
)

// Toggle user active status
router.patch(
  "/users/:id/toggle-status",
  protect,
  adminOnly,
  optionalTenant,
  toggleUserStatus
)

// Soft delete staff user
router.delete(
  "/users/:id",
  protect,
  adminOnly,
  optionalTenant,
  deleteStaffUser
)

// Restore deleted staff user
router.patch(
  "/users/:id/restore",
  protect,
  adminOnly,
  optionalTenant,
  restoreStaffUser
)

// Hard delete staff user (permanent)
router.delete(
  "/users/:id/permanent",
  protect,
  requireSuperAdmin,
  optionalTenant,
  hardDeleteStaffUser
)

// Reset user password
router.patch(
  "/users/:id/reset-password",
  protect,
  adminOnly,
  optionalTenant,
  resetUserPassword
)

// Unlock locked account
router.patch(
  "/users/:id/unlock",
  protect,
  adminOnly,
  optionalTenant,
  unlockUserAccount
)

// ============================================================================
// CUSTOMER PROMOTION (Upgrade to Staff)
// ============================================================================

// Get customers who can be promoted to staff
router.get(
  "/customers",
  protect,
  adminOnly,
  getCustomers
)

// Promote a customer to staff role
router.post(
  "/customers/:id/promote",
  protect,
  adminOnly,
  promoteToStaff
)

// ============================================================================
// WEBSITE ACCESS
// ============================================================================

// Get current user's accessible websites (for website selection page)
router.get(
  "/my-websites",
  protect,
  getMyAccessibleWebsites
)

// Update user's website access
router.put(
  "/users/:id/websites",
  protect,
  adminOnly,
  updateUserWebsiteAccess
)

export default router
