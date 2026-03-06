import express from "express"
import { createPinCode, getPinCodes, getPinCodeById, updatePinCode, deletePinCode, hardDeletePinCode } from "../controllers/pinCode.controller.js"
import { protect, adminOnly } from "../middlewares/auth.middleware.js"
import { resolveTenantFromHeader, requireTenant } from "../middlewares/tenant.middleware.js"
import upload from "../middlewares/upload.middleware.js"

const router = express.Router()

// Apply tenant resolution middleware to all routes
router.use(resolveTenantFromHeader)
router.use(requireTenant)

// Public routes
router.get("/", getPinCodes)
router.get("/:id", getPinCodeById)

// Protected routes (require authentication)
router.post("/", protect, adminOnly, upload.single("image"), createPinCode)
router.put("/:id", protect, adminOnly, upload.single("image"), updatePinCode)
router.delete("/:id", protect, adminOnly, deletePinCode)
router.delete("/:id/hard", protect, adminOnly, hardDeletePinCode)

export default router
