import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

import { DB_NAME } from "../constants.js";
import User from "../models/user.model.js";
import Product from "../models/product.model.js";
import Order from "../models/order.model.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
  path: path.join(__dirname, "..", ".env"),
});

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function makeOrderNumber() {
  const timestamp = Date.now().toString().slice(-8);
  const random = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, "0");
  return `ORD-SEED-${timestamp}-${random}`;
}

async function main() {
  const uri = requireEnv("MONGODB_URI");

  await mongoose.connect(uri, {
    dbName: DB_NAME,
    writeConcern: { w: 1, j: false },
  });

  // Pick a user (prefer a customer, then any user)
  const user =
    (await User.findOne({ deleted: false, isActive: true, role: "customer" }).sort({ createdAt: -1 })) ||
    (await User.findOne({ deleted: false }).sort({ createdAt: -1 }));

  if (!user) {
    throw new Error("No users found. Create a user first (or run backend/seed.js to create admin).");
  }

  // Pick a product (active, non-deleted) — website comes from product for multi-tenant orders
  const product = await Product.findOne({ deleted: false, isActive: true }).sort({ createdAt: -1 });
  if (!product) {
    throw new Error("No products found. Create at least one product first.");
  }
  const websiteId = product.website;
  if (!websiteId) {
    throw new Error("Product has no website set; cannot create a valid order.");
  }

  const qty = 2;
  const unitPrice = Number(product.discountedPrice ?? product.price ?? 0);
  const itemsSubtotal = unitPrice * qty;
  const tax = 180;
  const shippingCharges = 50;
  const discount = 0;
  const totalAmount = itemsSubtotal + tax + shippingCharges - discount;

  const addr = user.address || {};
  const shippingAddress = {
    name: user.name || "Test Customer",
    phone: user.phone || null,
    street: addr.street || "123 Test Street",
    city: addr.city || "Mumbai",
    state: addr.state || "Maharashtra",
    zipCode: addr.zipCode || "400001",
    country: addr.country || "India",
  };

  const order = await Order.create({
    orderNumber: makeOrderNumber(),
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
    couponCode: null,
    couponId: null,
    totalAmount,
    shippingAddress,
    billingAddress: shippingAddress,
    paymentMethod: "credit_card",
    paymentStatus: "paid",
    orderStatus: "confirmed",
    trackingNumber: null,
    trackingUrl: null,
    notes: "Dummy order inserted by seed script for testing.",
    adminNotes: "Seeded order",
    isActive: true,
    deleted: false,
  });

  console.log("✅ Dummy order created");
  console.log({
    id: order._id.toString(),
    orderNumber: order.orderNumber,
    user: user.email,
    product: product.name,
    totalAmount: order.totalAmount,
  });
}

main()
  .then(async () => {
    await mongoose.disconnect();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("❌ Failed to seed dummy order:", err?.message || err);
    try {
      await mongoose.disconnect();
    } catch {}
    process.exit(1);
  });

