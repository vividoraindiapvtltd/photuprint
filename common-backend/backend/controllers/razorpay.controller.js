import Razorpay from "razorpay"
import crypto from "crypto"
import Order from "../models/order.model.js"
import User from "../models/user.model.js"
import { sendOrderConfirmationEmail } from "../utils/emailVerification.js"
import { sendOrderConfirmationSms } from "../utils/smsService.js"
import { scheduleReviewEmail } from "../utils/reviewEmailScheduler.js"

const RAZORPAY_KEY_ID = (process.env.RAZORPAY_KEY_ID || "").trim()
const RAZORPAY_KEY_SECRET = (process.env.RAZORPAY_KEY_SECRET || "").trim()

const COD_ADVANCE_PERCENT = 40

function getRazorpayInstance() {
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    throw new Error("Razorpay keys not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env")
  }
  return new Razorpay({ key_id: RAZORPAY_KEY_ID, key_secret: RAZORPAY_KEY_SECRET })
}

function verifyPaymentSignature(orderId, paymentId, signature) {
  const body = `${orderId}|${paymentId}`
  const expected = crypto.createHmac("sha256", RAZORPAY_KEY_SECRET).update(body).digest("hex")
  return expected === signature
}

/**
 * Convert amount to Razorpay subunits (paise for INR). Amount in rupees.
 */
function toSubunits(amount) {
  return Math.round(Number(amount) * 100)
}

/**
 * Get Razorpay key ID for frontend (public key, safe to expose)
 */
export const getRazorpayKey = async (req, res) => {
  try {
    if (!RAZORPAY_KEY_ID) {
      return res.status(503).json({ msg: "Payment gateway not configured", code: "PAYMENT_NOT_CONFIGURED" })
    }
    res.json({ key: RAZORPAY_KEY_ID })
  } catch (err) {
    console.error("getRazorpayKey error:", err)
    res.status(500).json({ msg: err.message })
  }
}

/**
 * Create Razorpay order for online payment or COD advance.
 * Body: { amount, currency, receipt, isCodAdvance?, orderData? }
 * For COD advance: amount = 40% of total, orderData = full order payload for later creation
 * SECURITY: When orderData is provided, backend recalculates amount and validates - never trust frontend amount.
 */
export const createRazorpayOrder = async (req, res) => {
  try {
    if (!req.websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }
    const userId = req.user?.id || req.user?._id
    if (!userId) {
      return res.status(401).json({ msg: "Not authorized" })
    }

    const { amount, currency = "INR", receipt, isCodAdvance = false, orderData } = req.body
    const isCod = !!isCodAdvance

    let amountNum = Number(amount)
    if (!amountNum || amountNum <= 0) {
      return res.status(400).json({ msg: "Valid amount is required" })
    }

    // Amount validation: recalculate from orderData when provided (do not trust frontend)
    if (orderData?.products && Array.isArray(orderData.products) && orderData.products.length > 0) {
      const calculatedSubtotal = orderData.subtotal ?? orderData.products.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 0), 0)
      const tax = orderData.tax ?? 0
      const shippingCharges = orderData.shippingCharges ?? 0
      const discount = orderData.discount ?? 0
      const giftWrapCharge = orderData.giftWrapCharge ?? 0
      const totalAmount = Math.max(0, Math.round(calculatedSubtotal + tax + shippingCharges - discount + giftWrapCharge))
      const expectedPayAmount = isCod ? Math.round(totalAmount * (COD_ADVANCE_PERCENT / 100)) : totalAmount
      if (Math.abs(amountNum - expectedPayAmount) > 1) {
        console.warn("[createRazorpayOrder] Amount mismatch: frontend=", amountNum, "calculated=", expectedPayAmount)
        return res.status(400).json({ msg: "Amount mismatch. Please refresh and try again.", code: "AMOUNT_MISMATCH" })
      }
      amountNum = expectedPayAmount
    }

    const subunits = toSubunits(amountNum)
    if (subunits < 100) {
      return res.status(400).json({ msg: "Minimum payment amount is ₹1" })
    }

    const instance = getRazorpayInstance()
    const receiptId = receipt || `rcpt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

    const order = await instance.orders.create({
      amount: subunits,
      currency,
      receipt: receiptId,
      notes: isCodAdvance ? { type: "cod_advance" } : {},
    })

    if (process.env.NODE_ENV !== "production") {
      console.log("[createRazorpayOrder] Order created:", order.id, "amount:", subunits, "paise")
    }

    res.json({
      orderId: order.id,
      amount: subunits,
      currency: order.currency,
      key: RAZORPAY_KEY_ID,
      isCodAdvance: !!isCodAdvance,
    })
  } catch (err) {
    console.error("createRazorpayOrder error:", err)
    if (err.message?.includes("not configured")) {
      return res.status(503).json({ msg: "Payment gateway not configured", code: "PAYMENT_NOT_CONFIGURED" })
    }
    const statusCode = err.statusCode || err.response?.status
    const razorpayError = err.error?.description || err.description || err.response?.data?.error?.description
    if (statusCode === 401 || /authentication failed|invalid key/i.test(String(razorpayError || err.message))) {
      return res.status(503).json({
        msg: "Razorpay authentication failed. Use valid test keys (rzp_test_...) from dashboard.razorpay.com → Settings → API Keys.",
        code: "PAYMENT_NOT_CONFIGURED",
      })
    }
    res.status(500).json({ msg: razorpayError || err.message || "Failed to create payment order" })
  }
}

/**
 * Verify payment and create/update order.
 * Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderData }
 * orderData: full order payload (products, addresses, etc.)
 */
export const verifyPaymentAndCreateOrder = async (req, res) => {
  try {
    if (!req.websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }
    const userId = req.user?.id || req.user?._id
    if (!userId) {
      return res.status(401).json({ msg: "Not authorized" })
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderData } = req.body

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ msg: "Payment verification data is required", code: "MISSING_PAYMENT_DATA" })
    }

    const isValid = verifyPaymentSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature)
    if (!isValid) {
      console.warn("[verifyPayment] Invalid signature for order:", razorpay_order_id)
      return res.status(400).json({ msg: "Invalid payment signature", code: "INVALID_SIGNATURE" })
    }

    if (!orderData || !orderData.products || !Array.isArray(orderData.products) || orderData.products.length === 0) {
      return res.status(400).json({ msg: "Order data is required" })
    }

    const {
      products,
      subtotal,
      tax = 0,
      shippingCharges = 0,
      discount = 0,
      couponCode,
      couponId,
      shippingAddress,
      billingAddress,
      paymentMethod,
      isCodAdvance,
      giftWrap,
      giftWrapCharge = 0,
      giftVoucherCode,
      tssMoney,
      tssPoints,
    } = orderData

    // Validate shipping address
    if (!shippingAddress || !shippingAddress.name || !shippingAddress.street || !shippingAddress.city || !shippingAddress.state || !shippingAddress.zipCode || !shippingAddress.country) {
      return res.status(400).json({ msg: "Complete shipping address is required" })
    }

    const userExists = await User.findById(userId)
    if (!userExists) {
      return res.status(400).json({ msg: "User not found" })
    }

    let calculatedSubtotal = subtotal
    if (!calculatedSubtotal) {
      calculatedSubtotal = products.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 0), 0)
    }

    const totalAmount = Math.max(0, Math.round(calculatedSubtotal + tax + shippingCharges - discount + (giftWrapCharge || 0)))
    const advanceAmount = isCodAdvance ? Math.round(totalAmount * (COD_ADVANCE_PERCENT / 100)) : totalAmount
    const codAmount = isCodAdvance ? totalAmount - advanceAmount : 0

    const enhancedProducts = products.map((item) => ({
      ...item,
      subtotal: (item.price || 0) * (item.quantity || 0),
    }))

    const orderPayload = {
      user: userId,
      products: enhancedProducts,
      subtotal: calculatedSubtotal,
      tax,
      shippingCharges,
      discount,
      couponCode: couponCode || null,
      couponId: couponId || null,
      totalAmount,
      shippingAddress,
      billingAddress: billingAddress || shippingAddress,
      paymentMethod: isCodAdvance ? "cash_on_delivery" : paymentMethod || "credit_card",
      paymentStatus: "paid",
      orderStatus: isCodAdvance ? "advance_paid" : "confirmed",
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
      advanceAmount: isCodAdvance ? advanceAmount : undefined,
      codAmount: isCodAdvance ? codAmount : undefined,
      website: req.websiteId,
      isActive: true,
      deleted: false,
    }

    const newOrder = new Order(orderPayload)
    const savedOrder = await newOrder.save()
    const populatedOrder = await Order.findById(savedOrder._id)
      .populate("user", "name email phone")
      .populate("products.product", "name images price")
      .populate("couponId", "code discountType discountValue")

    // Send order confirmation email and SMS (non-blocking)
    const orderForNotify = populatedOrder?.toObject ? { ...populatedOrder.toObject(), user: populatedOrder.user } : { ...populatedOrder, user: populatedOrder?.user }
    Promise.all([
      sendOrderConfirmationEmail(orderForNotify),
      sendOrderConfirmationSms(orderForNotify),
    ]).catch((err) => console.error("[verifyPayment] Notification error:", err.message))

    // Schedule product review email 1 day after order (non-blocking)
    scheduleReviewEmail(orderForNotify).catch((err) => console.error("[verifyPayment] Review email schedule error:", err.message))

    res.status(201).json(populatedOrder)
  } catch (err) {
    console.error("verifyPaymentAndCreateOrder error:", err)
    if (err.code === 11000) {
      return res.status(400).json({ msg: "Order number conflict. Please try again." })
    }
    res.status(500).json({ msg: err.message || "Failed to create order" })
  }
}
