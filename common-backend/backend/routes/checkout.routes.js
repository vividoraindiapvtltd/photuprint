import express from "express"
import { createRazorpayOrder, verifyPaymentAndCreateOrder } from "../controllers/razorpay.controller.js"
import { protect } from "../middlewares/auth.middleware.js"
import { resolveTenant, requireTenant } from "../middlewares/tenant.middleware.js"

/**
 * Checkout API routes - Razorpay payment gateway
 * Mounted at /api so paths are: POST /api/create-order, POST /api/verify-payment
 */
const router = express.Router()

router.post("/create-order", protect, resolveTenant, requireTenant, createRazorpayOrder)
router.post("/verify-payment", protect, resolveTenant, requireTenant, verifyPaymentAndCreateOrder)

export default router
