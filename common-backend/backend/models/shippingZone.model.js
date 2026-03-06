import mongoose from "mongoose"

const shippingZoneSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      enum: ["Local", "Zonal", "Metro", "Rest of India", "Remote/North East/J&K"]
    },
    description: {
      type: String,
      default: ""
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

// Multi-tenant: Compound unique index scoped by website
shippingZoneSchema.index({ name: 1, website: 1 }, { unique: true, partialFilterExpression: { deleted: false } })

// Performance indexes
shippingZoneSchema.index({ website: 1, deleted: 1, isActive: 1 })
shippingZoneSchema.index({ website: 1, name: 1 })

export default mongoose.model("ShippingZone", shippingZoneSchema)
