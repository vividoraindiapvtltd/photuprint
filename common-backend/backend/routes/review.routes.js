import express from "express"
import { getReviews, getReviewById, createReview, updateReview, updateReviewStatus, deleteReview, hardDeleteReview } from "../controllers/review.controller.js"
import { protect, adminOnly, optionalAuth } from "../middlewares/auth.middleware.js"
import upload from "../middlewares/upload.middleware.js"
import { resolveTenant } from "../middlewares/tenant.middleware.js"

const router = express.Router()

// Apply tenant resolution middleware (works for both admin and storefront)
router.use(resolveTenant)

// Public routes (filtered to show only approved reviews for non-authenticated users)
// Admin users will see all reviews based on filters
router.get("/", optionalAuth, getReviews)

// Create review - Requires authentication (only logged in users can submit reviews)
router.post(
  "/",
  protect, // Require authentication
  upload.fields([
    { name: "avatar", maxCount: 1 },
    { name: "productImage", maxCount: 1 }, // Backward compatibility
    { name: "productImages", maxCount: 6 }, // Multiple product images (up to 6)
  ]),
  createReview
)

// Admin-only routes - Specific routes first (before generic :id routes)
router.patch("/:id/status", protect, adminOnly, updateReviewStatus)
router.delete("/:id/hard", protect, adminOnly, hardDeleteReview)

// Generic routes (must come after specific routes)
router.get("/:id", getReviewById)
router.put(
  "/:id",
  protect,
  adminOnly,
  upload.fields([
    { name: "avatar", maxCount: 1 },
    { name: "productImage", maxCount: 1 }, // Backward compatibility
    { name: "productImages", maxCount: 6 }, // Multiple product images (up to 6)
  ]),
  updateReview
)
router.delete("/:id", protect, adminOnly, deleteReview)

export default router
