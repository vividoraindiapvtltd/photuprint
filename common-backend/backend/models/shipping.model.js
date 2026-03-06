import mongoose from "mongoose";

const shippingSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      default: null,
    },
    email: {
      type: String,
      default: null,
    },
    street: {
      type: String,
      required: true,
    },
    city: {
      type: String,
      required: true,
    },
    state: {
      type: String,
      required: true,
    },
    zipCode: {
      type: String,
      required: true,
    },
    country: {
      type: String,
      required: true,
      default: "India",
    },
    landmark: {
      type: String,
      default: null,
    },
    addressType: {
      type: String,
      enum: ["home", "work", "other"],
      default: "home",
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    deleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Indexes
shippingSchema.index({ user: 1 });
shippingSchema.index({ order: 1 });
shippingSchema.index({ zipCode: 1 });
shippingSchema.index({ deleted: 1, isActive: 1 });
shippingSchema.index({ user: 1, isDefault: 1 });

export default mongoose.model("Shipping", shippingSchema);
