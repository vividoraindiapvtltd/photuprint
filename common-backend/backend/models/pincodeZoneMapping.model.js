import mongoose from "mongoose"

const pincodeZoneMappingSchema = new mongoose.Schema(
  {
    pincode: {
      type: String,
      required: true,
      trim: true,
      match: /^[0-9]{6}$/
    },
    zone: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ShippingZone",
      required: true
    },
    state: {
      type: String,
      default: ""
    },
    city: {
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
pincodeZoneMappingSchema.index({ pincode: 1, website: 1 }, { unique: true, partialFilterExpression: { deleted: false } })

// Performance indexes
pincodeZoneMappingSchema.index({ website: 1, zone: 1, deleted: 1, isActive: 1 })
pincodeZoneMappingSchema.index({ website: 1, pincode: 1 })
pincodeZoneMappingSchema.index({ zone: 1 })

export default mongoose.model("PincodeZoneMapping", pincodeZoneMappingSchema)
