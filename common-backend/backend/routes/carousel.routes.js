import express from "express"
import {
  getPublicSlides,
  getSettings,
  updateSettings,
  getSlides,
  getSlideById,
  createSlide,
  updateSlide,
  deleteSlide,
  reorderSlides,
  uploadImage,
} from "../controllers/carousel.controller.js"
import { protect, adminOnly } from "../middlewares/auth.middleware.js"
import { resolveTenant } from "../middlewares/tenant.middleware.js"
import upload from "../middlewares/upload.middleware.js"

const router = express.Router()
router.use(resolveTenant)

router.get("/public", getPublicSlides)

router.get("/settings", protect, adminOnly, getSettings)
router.put("/settings", protect, adminOnly, updateSettings)

router.get("/", protect, adminOnly, getSlides)
router.post("/", protect, adminOnly, createSlide)
router.post("/reorder", protect, adminOnly, reorderSlides)
router.post("/upload-image", protect, adminOnly, upload.single("image"), uploadImage)
router.get("/:id", protect, adminOnly, getSlideById)
router.put("/:id", protect, adminOnly, updateSlide)
router.delete("/:id", protect, adminOnly, deleteSlide)

export default router
