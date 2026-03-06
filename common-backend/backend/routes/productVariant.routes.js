import express from "express"
import {
  createVariants,
  getProductVariants,
  getVariantById,
  updateVariant,
  updateVariantStock,
  updateVariantStatus,
  deleteVariant,
  hardDeleteVariant,
  bulkUpdateVariants
} from "../controllers/productVariant.controller.js"
import { protect, adminOnly } from "../middlewares/auth.middleware.js"
import { resolveTenantFromHeader, requireTenant } from "../middlewares/tenant.middleware.js"
import upload from "../middlewares/upload.middleware.js"

const router = express.Router()

// Apply tenant resolution middleware to all routes
router.use(resolveTenantFromHeader)

// All routes require authentication and admin access
router.use(protect)
router.use(adminOnly)

// Product-specific variant routes
router.post("/products/:productId/variants", requireTenant, createVariants)
router.get("/products/:productId/variants", requireTenant, getProductVariants)
router.put("/products/:productId/variants/bulk", requireTenant, bulkUpdateVariants)

// Individual variant routes
router.get("/variants/:variantId", requireTenant, getVariantById)
router.put(
  "/variants/:variantId",
  requireTenant,
  upload.fields([
    { name: "primaryImage", maxCount: 1 },
    { name: "images", maxCount: 5 }
  ]),
  updateVariant
)
router.patch("/variants/:variantId/stock", requireTenant, updateVariantStock)
router.patch("/variants/:variantId/status", requireTenant, updateVariantStatus)
router.delete("/variants/:variantId", requireTenant, deleteVariant)
router.delete("/variants/:variantId/hard", requireTenant, hardDeleteVariant)

export default router
