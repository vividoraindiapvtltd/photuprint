import express from "express"
import {
  getPublicSections,
  getSections,
  getSectionById,
  createSection,
  updateSection,
  deleteSection,
  reorderSections,
} from "../controllers/footerSection.controller.js"
import { protect, adminOnly } from "../middlewares/auth.middleware.js"
import { resolveTenant } from "../middlewares/tenant.middleware.js"

const router = express.Router()
router.use(resolveTenant)

// Public (storefront)
router.get("/public", getPublicSections)

// Admin
router.get("/", protect, adminOnly, getSections)
router.post("/", protect, adminOnly, createSection)
router.post("/reorder", protect, adminOnly, reorderSections)
router.get("/:id", protect, adminOnly, getSectionById)
router.put("/:id", protect, adminOnly, updateSection)
router.delete("/:id", protect, adminOnly, deleteSection)

export default router
