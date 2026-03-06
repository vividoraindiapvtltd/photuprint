import express from "express"
import {
  createHeight,
  getHeights,
  getHeightById,
  updateHeight,
  deleteHeight,
  hardDeleteHeight,
} from "../controllers/height.controller.js"
import { protect, adminOnly } from "../middlewares/auth.middleware.js"
import { resolveTenantFromHeader, requireTenant } from "../middlewares/tenant.middleware.js"
import upload from "../middlewares/upload.middleware.js"

const router = express.Router()

// Apply tenant resolution middleware to all routes
router.use(resolveTenantFromHeader)
router.use(requireTenant)

// Public routes
router.get("/", getHeights)
router.get("/:id", getHeightById)

// Protected routes (require authentication)
router.post("/", protect, adminOnly, upload.single("image"), createHeight)
router.put("/:id", protect, adminOnly, upload.single("image"), updateHeight)
router.delete("/:id", protect, adminOnly, deleteHeight)
router.delete("/:id/hard", protect, adminOnly, hardDeleteHeight)

export default router
