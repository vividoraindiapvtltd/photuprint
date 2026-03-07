import express from "express"
import { protect, optionalAuth } from "../middlewares/auth.middleware.js"
import { resolveTenant } from "../middlewares/tenant.middleware.js"
import {
  addToWishlist,
  removeFromWishlist,
  getWishlist,
  checkInWishlist,
  clearWishlist,
} from "../controllers/wishlist.controller.js"

const router = express.Router()

// All routes require tenant (X-Website-Id or domain)
router.use(resolveTenant)

// GET /api/wishlist/check/:productId - check if product is in wishlist (optional auth, returns false if not logged in)
router.get("/check/:productId", optionalAuth, checkInWishlist)

// Protected routes below
router.use(protect)

// POST /api/wishlist - add product to wishlist
router.post("/", addToWishlist)

// GET /api/wishlist - get current user's wishlist
router.get("/", getWishlist)

// DELETE /api/wishlist/:productId - remove product from wishlist
router.delete("/:productId", removeFromWishlist)

// DELETE /api/wishlist - clear entire wishlist
router.delete("/", clearWishlist)

export default router
