import express from "express"
import {
  createWidth,
  getWidths,
  getWidthById,
  updateWidth,
  deleteWidth,
  hardDeleteWidth,
} from "../controllers/width.controller.js"
import { protect, adminOnly } from "../middlewares/auth.middleware.js"
import { resolveTenantFromHeader, requireTenant } from "../middlewares/tenant.middleware.js"

const router = express.Router()

// Apply tenant resolution middleware to all routes
router.use(resolveTenantFromHeader)
router.use(requireTenant)

// Public routes
router.get("/", getWidths)
router.get("/:id", getWidthById)

// Protected routes (require authentication)
router.post("/", protect, adminOnly, createWidth)
router.put("/:id", protect, adminOnly, updateWidth)
router.delete("/:id", protect, adminOnly, deleteWidth)
router.delete("/:id/hard", protect, adminOnly, hardDeleteWidth)

export default router
