import mongoose from "mongoose"

const shippingRateSchema = new mongoose.Schema(
  {
    zone: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ShippingZone",
      required: true
    },
    minWeight: {
      type: Number,
      required: true,
      default: 0
    },
    maxWeight: {
      type: Number,
      required: true
    },
    rate: {
      type: Number,
      required: true,
      min: 0
    },
    additionalWeight: {
      type: Number,
      default: 500
    },
    additionalRate: {
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
      index: true
    }
  },
  {
    timestamps: true
  }
)

// Indexes
shippingRateSchema.index({ zone: 1, website: 1, deleted: 1, isActive: 1 })
shippingRateSchema.index({ website: 1, deleted: 1, isActive: 1 })
shippingRateSchema.index({ minWeight: 1, maxWeight: 1 })

export default mongoose.model("ShippingRate", shippingRateSchema)
