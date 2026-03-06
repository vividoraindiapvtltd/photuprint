import express from "express"
import { getTemplates, getTemplateById, getTemplatesByCategory, createTemplate, updateTemplate, updateTemplateFields, deleteTemplate, updateTemplateStatus } from "../controllers/template.controller.js"
import { protect, adminOnly } from "../middlewares/auth.middleware.js"
import upload from "../middlewares/upload.middleware.js"
import { resolveTenantFromHeader, requireTenant } from "../middlewares/tenant.middleware.js"

const router = express.Router()

// Resolve tenant from X-Website-Id header so req.websiteId is set before requireTenant
router.use(resolveTenantFromHeader)
router.use(requireTenant)

// Protected admin routes - define POST before GET /:id to avoid route conflicts
router.post(
  "/",
  protect,
  adminOnly,
  upload.fields([
    { name: "backgroundImages", maxCount: 20 }, // Allow up to 20 background images
    { name: "logoImages", maxCount: 20 }, // Allow up to 20 logo images
    { name: "previewImage", maxCount: 1 },
  ]),
  createTemplate
)

// Public routes (for frontend) – disable caching so Products template tab always gets fresh data
const noCache = (req, res, next) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, private")
  res.set("Pragma", "no-cache")
  next()
}
router.get("/", noCache, getTemplates)
router.get("/category/:categoryId", noCache, getTemplatesByCategory)
router.get("/:id", noCache, getTemplateById)

// PATCH for scalar-only updates (name, description, categoryId, isActive) - no multer, JSON body
router.patch("/:id/fields", protect, adminOnly, updateTemplateFields)

router.put(
  "/:id",
  protect,
  adminOnly,
  upload.fields([
    { name: "backgroundImages", maxCount: 20 }, // Allow up to 20 background images
    { name: "logoImages", maxCount: 20 }, // Allow up to 20 logo images
    { name: "previewImage", maxCount: 1 },
  ]),
  updateTemplate
)

router.patch("/:id/status", protect, adminOnly, updateTemplateStatus)
router.delete("/:id", protect, adminOnly, deleteTemplate)

export default router
