import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      // Not required - auto-generated in pre-save hook
      default: null
    },
    user: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User",
      required: true
    },
    products: [
      {
        product: { 
          type: mongoose.Schema.Types.ObjectId, 
          ref: "Product",
          required: true
        },
        productName: { type: String },
        productImage: { type: String },
        quantity: { 
          type: Number, 
          required: true,
          min: 1
        },
        price: { 
          type: Number, 
          required: true,
          min: 0
        },
        subtotal: { 
          type: Number, 
          required: true,
          min: 0
        }
      },
    ],
    subtotal: {
      type: Number,
      required: true,
      min: 0
    },
    tax: {
      type: Number,
      default: 0,
      min: 0
    },
    shippingCharges: {
      type: Number,
      default: 0,
      min: 0
    },
    discount: {
      type: Number,
      default: 0,
      min: 0
    },
    couponCode: {
      type: String,
      default: null
    },
    couponId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Coupon",
      default: null
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0
    },
    // Optional: sales agent responsible for this order (for incentives)
    salesAgent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    shippingAddress: {
      name: { type: String, required: true },
      phone: { type: String },
      email: { type: String },
      street: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      zipCode: { type: String, required: true },
      country: { type: String, required: true }
    },
    billingAddress: {
      name: { type: String },
      phone: { type: String },
      email: { type: String },
      street: { type: String },
      city: { type: String },
      state: { type: String },
      zipCode: { type: String },
      country: { type: String }
    },
    paymentMethod: {
      type: String,
      enum: ["credit_card", "debit_card", "paypal", "cash_on_delivery", "bank_transfer", "other"],
      default: "credit_card"
    },
    paymentStatus: { 
      type: String, 
      enum: ["pending", "processing", "paid", "failed", "refunded", "cancelled", "advance_paid"],
      default: "pending" 
    },
    orderStatus: {
      type: String,
      enum: ["pending", "advance_paid", "confirmed", "processing", "shipped", "delivered", "cod_pending", "cancelled", "returned"],
      default: "pending"
    },
    razorpayOrderId: { type: String, default: null },
    razorpayPaymentId: { type: String, default: null },
    razorpaySignature: { type: String, default: null },
    advanceAmount: { type: Number, default: null },
    codAmount: { type: Number, default: null },
    // Courier Tracking Details
    courierName: {
      type: String,
      default: null,
      trim: true
    },
    courierServiceType: {
      type: String,
      default: null,
      trim: true
    },
    trackingNumber: {
      type: String,
      default: null,
      trim: true
    },
    trackingUrl: {
      type: String,
      default: null,
      trim: true
    },
    shipmentDate: {
      type: Date,
      default: null
    },
    estimatedDeliveryDate: {
      type: Date,
      default: null
    },
    notes: {
      type: String,
      default: null
    },
    adminNotes: {
      type: String,
      default: null
    },
    website: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Website',
      required: true,
      index: true
    },
    domain: {
      type: String,
      default: null,
      trim: true,
      lowercase: true
    },
    isActive: {
      type: Boolean,
      default: true
    },
    deleted: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

// Indexes for better query performance
// Order number should be unique per website (multi-tenancy)
orderSchema.index({ orderNumber: 1, website: 1 }, { unique: true });
orderSchema.index({ user: 1 });
orderSchema.index({ website: 1 });
orderSchema.index({ domain: 1 });
orderSchema.index({ paymentStatus: 1 });
orderSchema.index({ orderStatus: 1 });
orderSchema.index({ deleted: 1, isActive: 1 });
orderSchema.index({ createdAt: -1 });

// Generate unique order number before validation
// This runs before validation, ensuring orderNumber is always set for new orders
orderSchema.pre('validate', async function(next) {
  // Only generate if this is a new document and orderNumber is not set
  if (this.isNew && !this.orderNumber) {
    // Generate order number with timestamp and random number
    // Format: ORD-XXXXXXXX-RRRR (8-digit timestamp, 4-digit random)
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    this.orderNumber = `ORD-${timestamp}-${random}`;
    
    // Note: The unique index on { orderNumber: 1, website: 1 } will handle collisions
    // If a duplicate occurs, MongoDB will throw an error which we handle in the controller
  }
  next();
});

const Order = mongoose.model("Order", orderSchema);
export default Order;
