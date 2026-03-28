/**
 * Creates a paid + delivered dummy order on a website that has cashback rules,
 * then runs the same cashback credit path as production (delivery → wallet ledger).
 *
 * Usage (from common-backend):
 *   node backend/scripts/seed-dummy-order-with-cashback.js
 *
 * Optional env:
 *   WEBSITE_ID=<24-char hex>  — must match the site where you created cashback rules
 *   USER_ID=<24-char hex>     — customer to credit (default: latest customer)
 */
import mongoose from "mongoose"
import dotenv from "dotenv"
import path from "path"
import { fileURLToPath } from "url"

import { DB_NAME } from "../constants.js"
import Website from "../models/website.model.js"
import User from "../models/user.model.js"
import Product from "../models/product.model.js"
import Order from "../models/order.model.js"
import * as cashbackService from "../services/cashback.service.js"
import * as walletLedger from "../services/walletLedger.service.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({
  path: path.join(__dirname, "..", ".env"),
})

function requireEnv(name) {
  const v = process.env[name]
  if (!v) throw new Error(`Missing required env var: ${name}`)
  return v
}

async function main() {
  const uri = requireEnv("MONGODB_URI")

  await mongoose.connect(uri, {
    dbName: DB_NAME,
    writeConcern: { w: 1, j: false },
  })

  let websiteId = process.env.WEBSITE_ID?.trim()
  if (websiteId) {
    const w = await Website.findById(websiteId)
    if (!w) throw new Error(`No website for WEBSITE_ID=${websiteId}`)
  } else {
    const w = await Website.findOne({ deleted: false, isActive: true }).sort({ createdAt: 1 })
    if (!w) throw new Error("No active website. Set WEBSITE_ID or create a website.")
    websiteId = w._id.toString()
    console.log(`Using website: ${w.name} (${websiteId})`)
  }

  let user
  if (process.env.USER_ID?.trim()) {
    user = await User.findById(process.env.USER_ID.trim())
    if (!user) throw new Error("USER_ID not found")
  } else {
    user =
      (await User.findOne({ deleted: false, isActive: true, role: "customer" }).sort({ createdAt: -1 })) ||
      (await User.findOne({ deleted: false }).sort({ createdAt: -1 }))
  }
  if (!user) throw new Error("No users found.")

  const product = await Product.findOne({
    website: websiteId,
    deleted: false,
    isActive: true,
    price: { $gt: 0 },
  }).sort({ createdAt: -1 })

  if (!product) {
    throw new Error(
      `No priced product for this website (${websiteId}). Add a product or set WEBSITE_ID to a site that has catalog.`
    )
  }

  const qty = 2
  const unitPrice = Number(product.discountedPrice ?? product.price ?? 0)
  const itemsSubtotal = unitPrice * qty
  const tax = 0
  const shippingCharges = 0
  const discount = 0
  const totalAmount = itemsSubtotal + tax + shippingCharges - discount

  const addr = user.address || {}
  const shippingAddress = {
    name: user.name || "Cashback test customer",
    phone: user.phone || null,
    email: user.email || null,
    street: addr.street || "123 Test Street",
    city: addr.city || "Mumbai",
    state: addr.state || "Maharashtra",
    zipCode: addr.zipCode || "400001",
    country: addr.country || "India",
  }

  const order = await Order.create({
    user: user._id,
    website: websiteId,
    products: [
      {
        product: product._id,
        productName: product.name,
        productImage: product.mainImage || product.images?.[0] || null,
        quantity: qty,
        price: unitPrice,
        subtotal: itemsSubtotal,
      },
    ],
    subtotal: itemsSubtotal,
    tax,
    shippingCharges,
    discount,
    totalAmount,
    shippingAddress,
    billingAddress: shippingAddress,
    paymentMethod: "credit_card",
    paymentStatus: "paid",
    orderStatus: "delivered",
    notes: "Dummy order — cashback applied by seed-dummy-order-with-cashback.js",
    adminNotes: "Seeded for wallet/cashback testing",
    isActive: true,
    deleted: false,
  })

  const credit = await cashbackService.creditCashbackOnDelivered(order._id)

  const balance = await walletLedger.getBalance(user._id, websiteId)

  console.log("\n✅ Order created and cashback job run\n")
  console.log({
    orderId: order._id.toString(),
    orderNumber: order.orderNumber,
    websiteId,
    userEmail: user.email,
    product: product.name,
    subtotal: itemsSubtotal,
    cashbackResult: credit,
    walletBalanceAfter: balance,
  })

  if (!credit.ok) {
    console.warn("Cashback did not complete:", credit.msg || credit)
  }
}

main()
  .then(async () => {
    await mongoose.disconnect()
    process.exit(0)
  })
  .catch(async (err) => {
    console.error("❌", err?.message || err)
    try {
      await mongoose.disconnect()
    } catch {
      // ignore
    }
    process.exit(1)
  })
