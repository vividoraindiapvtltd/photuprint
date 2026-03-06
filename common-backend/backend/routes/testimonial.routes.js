import express from "express"
import {
  getTestimonials,
  getTestimonialById,
  createTestimonial,
  updateTestimonial,
  updateTestimonialStatus,
  bulkUpdateStatus,
  importTestimonials,
  deleteTestimonial,
  restoreTestimonial,
  hardDeleteTestimonial,
  getTestimonialStats,
  toggleFeatured,
} from "../controllers/testimonial.controller.js"
import { protect, adminOnly, optionalAuth } from "../middlewares/auth.middleware.js"
import upload from "../middlewares/upload.middleware.js"
import { resolveTenant } from "../middlewares/tenant.middleware.js"

const router = express.Router()

// Apply tenant resolution middleware
router.use(resolveTenant)

// ============================================
// PUBLIC ROUTES (approved testimonials only)
// ============================================

// Get all approved testimonials (public facing)
router.get("/", optionalAuth, getTestimonials)

// Get single testimonial by ID
router.get("/:id", optionalAuth, getTestimonialById)

// ============================================
// PROTECTED ROUTES (logged in users)
// ============================================

// Submit a testimonial (requires authentication)
router.post(
  "/",
  protect,
  upload.fields([{ name: "photo", maxCount: 1 }]),
  createTestimonial
)

// ============================================
// ADMIN-ONLY ROUTES
// ============================================

// Statistics endpoint (must be before :id routes)
router.get("/admin/stats", protect, adminOnly, getTestimonialStats)

// Bulk operations
router.post("/admin/bulk-status", protect, adminOnly, bulkUpdateStatus)

// Import testimonials from CSV/JSON data
router.post("/admin/import", protect, adminOnly, importTestimonials)

// Status update (approve/reject)
router.patch("/:id/status", protect, adminOnly, updateTestimonialStatus)

// Toggle featured status
router.patch("/:id/featured", protect, adminOnly, toggleFeatured)

// Restore soft-deleted testimonial
router.patch("/:id/restore", protect, adminOnly, restoreTestimonial)

// Update testimonial
router.put(
  "/:id",
  protect,
  adminOnly,
  upload.fields([{ name: "photo", maxCount: 1 }]),
  updateTestimonial
)

// Soft delete
router.delete("/:id", protect, adminOnly, deleteTestimonial)

// Hard delete (permanent)
router.delete("/:id/hard", protect, adminOnly, hardDeleteTestimonial)

export default router
