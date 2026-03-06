import mongoose from "mongoose"

const shippingConfigSchema = new mongoose.Schema(
  {
    codSurcharge: {
      type: Number,
      default: 0,
      min: 0
    },
    codSurchargeType: {
      type: String,
      enum: ["fixed", "percentage"],
      default: "fixed"
    },
    freeShippingThreshold: {
      type: Number,
      default: 0,
      min: 0
    },
    isActive: {
      type: Boolean,
      default: true
    },
    deleted: {
      type: Boolean,
      default: false
    },
    // Multi-tenant: Website reference
    website: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Website',
      required: true,
      unique: true,
      index: true
    }
  },
  {
    timestamps: true
  }
)

// Indexes
shippingConfigSchema.index({ website: 1, deleted: 1, isActive: 1 })

export default mongoose.model("ShippingConfig", shippingConfigSchema)
