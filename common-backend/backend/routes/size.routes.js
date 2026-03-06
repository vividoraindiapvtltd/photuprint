import express from "express"
import { createSize, getSizes, getSizeById, updateSize, deleteSize, hardDeleteSize } from "../controllers/size.controller.js"
import { protect, adminOnly } from "../middlewares/auth.middleware.js"
import { resolveTenant, requireTenant } from "../middlewares/tenant.middleware.js"
import upload from "../middlewares/upload.middleware.js"

const router = express.Router()

// Apply tenant resolution middleware to all routes
router.use(resolveTenant)
router.use(requireTenant)

// Public routes
router.get("/", getSizes)
router.get("/:id", getSizeById)

// Protected routes (require authentication)
router.post("/", protect, adminOnly, upload.single("image"), createSize)
router.put("/:id", protect, adminOnly, upload.single("image"), updateSize)
router.delete("/:id", protect, adminOnly, deleteSize)
router.delete("/:id/hard", protect, adminOnly, hardDeleteSize)

export default router
