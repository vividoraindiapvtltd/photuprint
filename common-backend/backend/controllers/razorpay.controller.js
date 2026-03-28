import Razorpay from "razorpay"
import crypto from "crypto"
import Order from "../models/order.model.js"
import User from "../models/user.model.js"
import { recalculateOrderDataWithVolumePricing } from "../utils/orderCheckoutRecalc.js"
import { sendOrderConfirmationEmail } from "../utils/emailVerification.js"
import { sendOrderConfirmationSms } from "../utils/smsService.js"
import { scheduleReviewEmail } from "../utils/reviewEmailScheduler.js"
import { getWebsiteCredentials } from "../utils/websiteCredentials.js"

const COD_ADVANCE_PERCENT = 40

function getRazorpayInstance(keyId, keySecret) {
  if (!keyId || !keySecret) {
    throw new Error("Razorpay keys not configured. Set RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET in .env or in the website settings.")
  }
  return new Razorpay({ key_id: keyId, key_secret: keySecret })
}

function verifyPaymentSignature(orderId, paymentId, signature, keySecret) {
  const body = `${orderId}|${paymentId}`
  const expected = crypto.createHmac("sha256", keySecret).update(body).digest("hex")
  return expected === signature
}

function toSubunits(amount) {
  return Math.round(Number(amount) * 100)
}

/**
 * Get Razorpay key ID for frontend (public key, safe to expose).
 * Resolves per-website key if configured, otherwise falls back to env.
 */
export const getRazorpayKey = async (req, res) => {
  try {
    const creds = await getWebsiteCredentials(req.websiteId)
    if (!creds.razorpayKeyId) {
      return res.status(503).json({ msg: "Payment gateway not configured", code: "PAYMENT_NOT_CONFIGURED" })
    }
    res.json({ key: creds.razorpayKeyId })
  } catch (err) {
    console.error("getRazorpayKey error:", err)
    res.status(500).json({ msg: err.message })
  }
}

/**
 * Create Razorpay order for online payment or COD advance.
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

    const creds = await getWebsiteCredentials(req.websiteId)

    const { amount, currency = "INR", receipt, isCodAdvance = false, orderData } = req.body
    const isCod = !!isCodAdvance

    let amountNum = Number(amount)
    if (!amountNum || amountNum <= 0) {
      return res.status(400).json({ msg: "Valid amount is required" })
    }

    if (orderData?.products && Array.isArray(orderData.products) && orderData.products.length > 0) {
      let recalced
      try {
        recalced = await recalculateOrderDataWithVolumePricing(orderData, req.websiteId)
      } catch (e) {
        console.error("[createRazorpayOrder] Pricing error:", e)
        return res.status(400).json({
          msg: e.message || "Unable to calculate order total",
          code: "PRICING_ERROR",
        })
      }
      const totalAmount = recalced.totalAmount
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

    const instance = getRazorpayInstance(creds.razorpayKeyId, creds.razorpayKeySecret)
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
      key: creds.razorpayKeyId,
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

    const creds = await getWebsiteCredentials(req.websiteId)

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderData } = req.body

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ msg: "Payment verification data is required", code: "MISSING_PAYMENT_DATA" })
    }

    const isValid = verifyPaymentSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature, creds.razorpayKeySecret)
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

    if (!shippingAddress || !shippingAddress.name || !shippingAddress.street || !shippingAddress.city || !shippingAddress.state || !shippingAddress.zipCode || !shippingAddress.country) {
      return res.status(400).json({ msg: "Complete shipping address is required" })
    }

    const userExists = await User.findById(userId)
    if (!userExists) {
      return res.status(400).json({ msg: "User not found" })
    }

    let recalced
    try {
      recalced = await recalculateOrderDataWithVolumePricing(orderData, req.websiteId)
    } catch (e) {
      console.error("[verifyPayment] Pricing error:", e)
      return res.status(400).json({ msg: e.message || "Unable to calculate order total", code: "PRICING_ERROR" })
    }

    const calculatedSubtotal = recalced.subtotal
    const totalAmount = recalced.totalAmount
    const advanceAmount = isCodAdvance ? Math.round(totalAmount * (COD_ADVANCE_PERCENT / 100)) : totalAmount
    const codAmount = isCodAdvance ? totalAmount - advanceAmount : 0

    const enhancedProducts = recalced.products

    const orderPayload = {
      user: userId,
      products: enhancedProducts,
      subtotal: calculatedSubtotal,
      tax: recalced.tax,
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

    const orderForNotify = populatedOrder?.toObject ? { ...populatedOrder.toObject(), user: populatedOrder.user } : { ...populatedOrder, user: populatedOrder?.user }
    Promise.all([
      sendOrderConfirmationEmail(orderForNotify),
      sendOrderConfirmationSms(orderForNotify),
    ]).catch((err) => console.error("[verifyPayment] Notification error:", err.message))

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
