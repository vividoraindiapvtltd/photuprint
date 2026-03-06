import express from "express"
import {
  // Section CRUD
  getSections,
  getSectionById,
  createSection,
  updateSection,
  deleteSection,
  restoreSection,
  hardDeleteSection,
  // Section ordering and status
  toggleSectionStatus,
  reorderSections,
  // Product management within sections
  addProductsToSection,
  removeProductFromSection,
  reorderSectionProducts,
  updateSectionProducts,
  // Preview and publishing
  saveDraft,
  publishSection,
  discardDraft,
  // Public API
  getPublicSections,
  getProductsByTag,
  // Product tag management
  updateProductTags,
  bulkUpdateProductTags,
  // Statistics
  getSectionStats,
  getAvailableProducts,
} from "../controllers/homepageSection.controller.js"
import { protect, adminOnly, optionalAuth } from "../middlewares/auth.middleware.js"
import { resolveTenant, skipTenant } from "../middlewares/tenant.middleware.js"

const router = express.Router()

// Apply tenant resolution middleware to admin routes
// Public routes will use skipTenant or resolveTenant individually

// ============================================================================
// PUBLIC ROUTES (Frontend Homepage) - MUST BE DEFINED FIRST
// ============================================================================

/**
 * GET /api/homepage-sections
 * Get all sections (accessible to everyone - logged in and non-logged in users)
 * Query params: status, type, search, showInactive, includeDeleted, includeProducts, sortBy, sortOrder, page, limit
 * Note: Non-admin users (including non-authenticated) can only see active, non-deleted sections
 *       (showInactive and includeDeleted are ignored for non-admin users)
 */
router.get("/", skipTenant, optionalAuth, getSections)

/**
 * GET /api/homepage-sections/public
 * Get active homepage sections with products for public display
 * Query params: type (optional)
 */
router.get("/public", skipTenant, optionalAuth, getPublicSections)

/**
 * GET /api/homepage-sections/products-by-tag
 * Get products by homepage tag (featured, hot, newArrival, bestseller, onSale)
 * Query params: tag (required), limit, page
 */
router.get("/products-by-tag", skipTenant, optionalAuth, getProductsByTag)

// ============================================================================
// ADMIN ROUTES - Section Management
// ============================================================================

/**
 * GET /api/homepage-sections/admin/stats
 * Get statistics for homepage sections
 */
router.get("/admin/stats", resolveTenant, protect, adminOnly, getSectionStats)

/**
 * GET /api/homepage-sections/admin/available-products
 * Get products available to add to sections
 * Query params: search, category, subcategory, excludeSection, page, limit
 */
router.get("/admin/available-products", resolveTenant, protect, adminOnly, getAvailableProducts)

/**
 * POST /api/homepage-sections/admin/reorder
 * Bulk reorder sections
 * Body: { sections: [{ id, displayOrder }] }
 */
router.post("/admin/reorder", resolveTenant, protect, adminOnly, reorderSections)

/**
 * POST /api/homepage-sections/admin/bulk-product-tags
 * Bulk update product homepage tags
 * Body: { productIds: [], tags: { featured, hot, newArrival, bestseller, onSale } }
 */
router.post("/admin/bulk-product-tags", resolveTenant, protect, adminOnly, bulkUpdateProductTags)

/**
 * POST /api/homepage-sections
 * Create a new homepage section
 */
router.post("/", resolveTenant, protect, adminOnly, createSection)

/**
 * GET /api/homepage-sections/:id
 * Get a single section by ID
 */
router.get("/:id", resolveTenant, protect, adminOnly, getSectionById)

/**
 * PUT /api/homepage-sections/:id
 * Update a section
 */
router.put("/:id", resolveTenant, protect, adminOnly, updateSection)

/**
 * DELETE /api/homepage-sections/:id
 * Soft delete a section
 */
router.delete("/:id", resolveTenant, protect, adminOnly, deleteSection)

/**
 * POST /api/homepage-sections/:id/restore
 * Restore a soft-deleted section
 */
router.post("/:id/restore", resolveTenant, protect, adminOnly, restoreSection)

/**
 * DELETE /api/homepage-sections/:id/hard
 * Permanently delete a section
 */
router.delete("/:id/hard", resolveTenant, protect, adminOnly, hardDeleteSection)

// ============================================================================
// ADMIN ROUTES - Section Status and Ordering
// ============================================================================

/**
 * POST /api/homepage-sections/:id/toggle-status
 * Toggle section active status
 */
router.post("/:id/toggle-status", resolveTenant, protect, adminOnly, toggleSectionStatus)

// ============================================================================
// ADMIN ROUTES - Product Management within Sections
// ============================================================================

/**
 * POST /api/homepage-sections/:id/products
 * Add products to a section
 * Body: { productIds: [] }
 */
router.post("/:id/products", resolveTenant, protect, adminOnly, addProductsToSection)

/**
 * PUT /api/homepage-sections/:id/products
 * Update/replace all products in a section
 * Body: { products: [{ productId, displayOrder }] }
 */
router.put("/:id/products", resolveTenant, protect, adminOnly, updateSectionProducts)

/**
 * DELETE /api/homepage-sections/:id/products/:productId
 * Remove a product from a section
 */
router.delete("/:id/products/:productId", resolveTenant, protect, adminOnly, removeProductFromSection)

/**
 * POST /api/homepage-sections/:id/products/reorder
 * Reorder products within a section
 * Body: { products: [{ productId, displayOrder }] }
 */
router.post("/:id/products/reorder", resolveTenant, protect, adminOnly, reorderSectionProducts)

// ============================================================================
// ADMIN ROUTES - Preview and Publishing
// ============================================================================

/**
 * POST /api/homepage-sections/:id/draft
 * Save draft changes for preview
 * Body: { draftData: {} }
 */
router.post("/:id/draft", resolveTenant, protect, adminOnly, saveDraft)

/**
 * POST /api/homepage-sections/:id/publish
 * Publish section (apply draft if exists, set as active)
 */
router.post("/:id/publish", resolveTenant, protect, adminOnly, publishSection)

/**
 * POST /api/homepage-sections/:id/discard-draft
 * Discard draft changes
 */
router.post("/:id/discard-draft", resolveTenant, protect, adminOnly, discardDraft)

// ============================================================================
// ADMIN ROUTES - Product Tag Management
// ============================================================================

/**
 * PUT /api/homepage-sections/products/:productId/tags
 * Update homepage tags for a single product
 * Body: { featured, hot, newArrival, bestseller, onSale }
 */
router.put("/products/:productId/tags", resolveTenant, protect, adminOnly, updateProductTags)

export default router
