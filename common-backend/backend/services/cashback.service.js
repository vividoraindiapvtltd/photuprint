import Order from "../models/order.model.js"
import Product from "../models/product.model.js"
import CashbackRule from "../models/cashbackRule.model.js"
import WalletTransaction from "../models/walletTransaction.model.js"
import * as walletLedger from "./walletLedger.service.js"

function roundMoney(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100
}

/**
 * Resolve effective cashback % for a product line (product > category > default).
 */
export async function resolvePercentForProduct(websiteId, productId) {
  const rules = await CashbackRule.find({
    website: websiteId,
    isActive: true,
  })
    .sort({ priority: -1 })
    .lean()

  const product = await Product.findById(productId).select("category subcategory").lean()
  const categoryId = product?.category?.toString()

  const productRules = rules.filter(
    (r) => r.scope === "product" && r.product && r.product.toString() === productId.toString()
  )
  if (productRules.length) return { percent: productRules[0].percent, expiryDays: productRules[0].expiryDays, rule: productRules[0] }

  if (categoryId) {
    const catRules = rules.filter(
      (r) => r.scope === "category" && r.category && r.category.toString() === categoryId
    )
    if (catRules.length) return { percent: catRules[0].percent, expiryDays: catRules[0].expiryDays, rule: catRules[0] }
  }

  const defaults = rules.filter((r) => r.scope === "default")
  if (defaults.length) return { percent: defaults[0].percent, expiryDays: defaults[0].expiryDays, rule: defaults[0] }

  return { percent: 0, expiryDays: 90, rule: null }
}

/**
 * Cashback base = line subtotals after subtracting wallet share (proportional).
 */
export async function computeCashbackForOrder(order) {
  const websiteId = order.website
  const walletApplied = roundMoney(order.walletAmountApplied || 0)
  const subtotal = roundMoney(order.subtotal || 0)
  const walletRatio = subtotal > 0 ? Math.min(1, walletApplied / subtotal) : 0

  let totalCashback = 0
  let maxExpiryDays = 90
  const lines = order.products || []

  for (const line of lines) {
    const pid = line.product?._id || line.product
    if (!pid) continue
    const lineSub = roundMoney(line.subtotal || 0)
    const eligible = roundMoney(lineSub * (1 - walletRatio))
    const { percent, expiryDays } = await resolvePercentForProduct(websiteId, pid)
    if (expiryDays && expiryDays > maxExpiryDays) maxExpiryDays = expiryDays
    totalCashback += roundMoney((eligible * percent) / 100)
  }

  return { amount: roundMoney(totalCashback), expiryDays: maxExpiryDays }
}

const IDEMPOTENCY_DELIVERED = (orderId) => `cashback:delivered:${orderId}`
const IDEMPOTENCY_REVERSE = (orderId) => `cashback:reverse:${orderId}`

/**
 * Credit cashback when order is delivered. Idempotent.
 */
export async function creditCashbackOnDelivered(orderId) {
  const order = await Order.findById(orderId).populate("products.product", "category")
  if (!order) return { ok: false, msg: "Order not found" }
  if (order.orderStatus !== "delivered") {
    return { ok: false, msg: "Order is not delivered" }
  }
  if (order.cashbackCreditedAt) {
    return { ok: true, duplicate: true, amount: order.cashbackCreditedAmount }
  }

  const { amount, expiryDays } = await computeCashbackForOrder(order)
  if (amount <= 0) {
    order.cashbackCreditedAmount = 0
    order.cashbackCreditedAt = new Date()
    await order.save()
    return { ok: true, amount: 0, msg: "No cashback rule matched" }
  }

  const idem = IDEMPOTENCY_DELIVERED(order._id.toString())
  const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000)

  try {
    const { duplicate } = await walletLedger.creditWallet({
      userId: order.user,
      websiteId: order.website,
      amount,
      idempotencyKey: idem,
      reason: "cashback_order_delivered",
      orderId: order._id,
      expiresAt,
      meta: { orderNumber: order.orderNumber },
    })

    order.cashbackCreditedAmount = amount
    order.cashbackCreditedAt = new Date()
    order.cashbackExpiresAt = expiresAt
    await order.save()

    return { ok: true, duplicate, amount, expiresAt }
  } catch (e) {
    if (e.code === 11000) {
      const o = await Order.findById(orderId)
      return { ok: true, duplicate: true, amount: o?.cashbackCreditedAmount }
    }
    throw e
  }
}

/**
 * Reverse cashback when order is refunded — claw back up to credited amount (partial if low balance).
 */
export async function reverseCashbackForOrder(orderId) {
  const order = await Order.findById(orderId)
  if (!order) return { ok: false, msg: "Order not found" }
  const credited = roundMoney(order.cashbackCreditedAmount || 0)
  if (credited <= 0 || !order.cashbackCreditedAt) {
    return { ok: true, reversed: 0, msg: "No cashback to reverse" }
  }

  const idem = IDEMPOTENCY_REVERSE(order._id.toString())
  const existing = await WalletTransaction.findOne({ idempotencyKey: idem })
  if (existing) return { ok: true, duplicate: true, reversed: Math.abs(existing.amount) }

  const balance = await walletLedger.getBalance(order.user, order.website)
  const toReverse = roundMoney(Math.min(credited, balance))
  if (toReverse <= 0) {
    return { ok: true, reversed: 0, msg: "Insufficient wallet balance to reverse cashback" }
  }

  await walletLedger.debitWallet({
    userId: order.user,
    websiteId: order.website,
    amount: toReverse,
    idempotencyKey: idem,
    reason: "cashback_reversed_refund",
    orderId: order._id,
    meta: { originalCashback: credited },
  })

  order.cashbackCreditedAmount = roundMoney(Math.max(0, credited - toReverse))
  if (order.cashbackCreditedAmount === 0) {
    order.cashbackCreditedAt = null
    order.cashbackExpiresAt = null
  }
  await order.save()

  return { ok: true, reversed: toReverse }
}
