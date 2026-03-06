import express from "express"
import * as fontController from "../controllers/font.controller.js"
import { protect, adminOnly } from "../middlewares/auth.middleware.js"
import { resolveTenantFromHeader, requireTenant } from "../middlewares/tenant.middleware.js"
import upload from "../middlewares/upload.middleware.js"

const router = express.Router()

// Admin/CMS fonts are tenant-scoped via X-Website-Id
router.use(resolveTenantFromHeader)
router.use(requireTenant)

// Get all fonts (with filters)
router.get("/", protect, adminOnly, fontController.getAllFonts)

// Get active fonts only (grouped by type - for template manager)
router.get("/active", protect, adminOnly, fontController.getActiveFonts)

// Update sort order (bulk) - must be before :id routes
router.patch("/sort-order", protect, adminOnly, fontController.updateSortOrder)

// Get font by ID
router.get("/:id", protect, adminOnly, fontController.getFontById)

// Create new font
router.post("/", protect, adminOnly, fontController.createFont)

// Upload custom font file
router.post("/upload", protect, adminOnly, upload.single("fontFile"), fontController.uploadFont)

// Update font
router.put("/:id", protect, adminOnly, fontController.updateFont)

// Toggle font active status
router.patch("/:id/toggle-status", protect, adminOnly, fontController.toggleFontStatus)

// Soft delete font
router.delete("/:id", protect, adminOnly, fontController.deleteFont)

// Restore deleted font
router.patch("/:id/restore", protect, adminOnly, fontController.restoreFont)

// Permanently delete font
router.delete("/:id/permanent", protect, adminOnly, fontController.permanentDeleteFont)

export default router
