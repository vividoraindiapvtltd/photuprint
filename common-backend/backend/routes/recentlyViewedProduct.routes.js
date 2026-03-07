import express from "express"
import { protect } from "../middlewares/auth.middleware.js"
import { resolveTenant } from "../middlewares/tenant.middleware.js"
import { recordView, getRecent, clearRecent } from "../controllers/recentlyViewedProduct.controller.js"

const router = express.Router()

// All routes require tenant (X-Website-Id or domain) and authenticated user (personalized)
router.use(resolveTenant)
router.use(protect)

// POST /api/recently-viewed-products - record a product view (call from client when user views a product)
router.post("/", recordView)

// GET /api/recently-viewed-products - get current user's recently viewed products
router.get("/", getRecent)

// DELETE /api/recently-viewed-products - clear current user's recently viewed list
router.delete("/", clearRecent)

export default router
