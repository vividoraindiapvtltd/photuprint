import Product from "../models/product.model.js"
import { getVolumeAdjustedUnitPrice } from "./quantityTierPricing.js"

const GST_RATE_PERCENT = 18
function isBillingStateDelhi(state) {
  if (!state || typeof state !== "string") return false
  const s = state.trim().toLowerCase()
  return s === "delhi" || s.includes("national capital") || s.startsWith("nct")
}

function computeGstBreakdown(taxableValue, state) {
  if (taxableValue <= 0) {
    return { tax: 0, cgst: 0, sgst: 0, igst: 0 }
  }
  if (isBillingStateDelhi(state)) {
    const half = Math.round((taxableValue * (GST_RATE_PERCENT / 2)) / 100)
    return { tax: half * 2, cgst: half, sgst: half, igst: 0 }
  }
  const igst = Math.round((taxableValue * GST_RATE_PERCENT) / 100)
  return { tax: igst, cgst: 0, sgst: 0, igst }
}

/**
 * Recompute unit price and line subtotal from catalog (volume tiers).
 */
export async function enhanceOrderProductsWithVolumePricing(products, websiteId) {
  if (!products?.length) {
    return { products: [], subtotal: 0 }
  }
  const productIds = [...new Set(products.map((p) => p.product).filter(Boolean))]
  const docs = await Product.find({
    _id: { $in: productIds },
    website: websiteId,
    deleted: { $ne: true },
  }).lean()
  const byId = new Map(docs.map((p) => [String(p._id), p]))

  const enhancedProducts = []
  for (const item of products) {
    const pid = item.product
    if (!pid) throw new Error("Product ID is required for all order lines")
    const doc = byId.get(String(pid))
    if (!doc) throw new Error(`Product not found or not available: ${pid}`)
    const qty = Math.max(1, Math.floor(Number(item.quantity) || 1))
    const unitPrice = getVolumeAdjustedUnitPrice(doc, qty)
    const lineSubtotal = unitPrice * qty
    enhancedProducts.push({
      ...item,
      product: pid,
      productName: item.productName ?? doc.name,
      productImage: item.productImage ?? doc.mainImage ?? null,
      quantity: qty,
      price: unitPrice,
      subtotal: lineSubtotal,
    })
  }
  const subtotal = enhancedProducts.reduce((sum, line) => sum + (line.subtotal || 0), 0)
  return { products: enhancedProducts, subtotal }
}

/**
 * Recompute line unit prices from catalog (volume tiers), then subtotal, GST, and total.
 * Coupon discount and shipping/gift amounts are taken from orderData as sent by client.
 */
export async function recalculateOrderDataWithVolumePricing(orderData, websiteId) {
  if (!orderData?.products || !Array.isArray(orderData.products) || orderData.products.length === 0) {
    return { ...orderData, totalAmount: 0 }
  }

  const discount = Number(orderData.discount) || 0
  const shippingCharges = Number(orderData.shippingCharges) || 0
  const giftWrapCharge = Number(orderData.giftWrapCharge) || 0
  const billingState =
    orderData.billingAddress?.state?.trim() ||
    orderData.shippingAddress?.state?.trim() ||
    ""

  const { products: enhancedProducts, subtotal } = await enhanceOrderProductsWithVolumePricing(
    orderData.products,
    websiteId
  )
  const taxableValue = Math.max(0, subtotal - discount + giftWrapCharge + shippingCharges)
  const gst = computeGstBreakdown(taxableValue, billingState)
  const totalAmount = Math.max(0, Math.round(taxableValue + gst.tax))

  return {
    ...orderData,
    products: enhancedProducts,
    subtotal,
    tax: gst.tax,
    cgst: gst.cgst,
    sgst: gst.sgst,
    igst: gst.igst,
    totalAmount,
  }
}
