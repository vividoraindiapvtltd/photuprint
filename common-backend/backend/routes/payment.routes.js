import express from "express"
import { getRazorpayKey, createRazorpayOrder, verifyPaymentAndCreateOrder } from "../controllers/razorpay.controller.js"
import { protect } from "../middlewares/auth.middleware.js"
import { resolveTenant, requireTenant } from "../middlewares/tenant.middleware.js"

const router = express.Router()

// Public: Get Razorpay key for frontend (no auth needed for key)
router.get("/razorpay-key", getRazorpayKey)

// Protected: Create Razorpay order (requires auth + tenant)
router.post("/razorpay/create-order", protect, resolveTenant, requireTenant, createRazorpayOrder)

// Protected: Verify payment and create order
router.post("/razorpay/verify", protect, resolveTenant, requireTenant, verifyPaymentAndCreateOrder)

export default router
