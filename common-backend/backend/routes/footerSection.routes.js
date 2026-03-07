import express from "express"
import {
  getPublicSections,
  getSections,
  getSectionById,
  createSection,
  updateSection,
  deleteSection,
  reorderSections,
  uploadLogo,
  uploadLinkIcon,
  getFooterThemes,
  getFooterThemeById,
  createFooterTheme,
  updateFooterTheme,
  deleteFooterTheme,
  setActiveFooterTheme,
} from "../controllers/footerSection.controller.js"
import { protect, adminOnly } from "../middlewares/auth.middleware.js"
import { resolveTenant } from "../middlewares/tenant.middleware.js"
import upload from "../middlewares/upload.middleware.js"

const router = express.Router()
router.use(resolveTenant)

// Public (storefront)
router.get("/public", getPublicSections)

// Admin
router.get("/", protect, adminOnly, getSections)
router.post("/", protect, adminOnly, createSection)
router.post("/reorder", protect, adminOnly, reorderSections)
router.post("/upload-logo", protect, adminOnly, upload.single("logo"), uploadLogo)
router.post("/upload-link-icon", protect, adminOnly, upload.single("icon"), uploadLinkIcon)
router.get("/theme", protect, adminOnly, getFooterThemes)
router.get("/theme/:themeId", protect, adminOnly, getFooterThemeById)
router.post("/theme", protect, adminOnly, createFooterTheme)
router.put("/theme/:themeId/activate", protect, adminOnly, setActiveFooterTheme)
router.put("/theme/:themeId", protect, adminOnly, updateFooterTheme)
router.delete("/theme/:themeId", protect, adminOnly, deleteFooterTheme)
router.get("/:id", protect, adminOnly, getSectionById)
router.put("/:id", protect, adminOnly, updateSection)
router.delete("/:id", protect, adminOnly, deleteSection)

export default router
