import mongoose from "mongoose"

const pinCodeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true }, // Removed unique: true - will use compound index with website
    description: { type: String, default: null },
    state: { type: String, default: null },
    district: { type: String, default: null },
    image: { type: String, default: null },
    isActive: { type: Boolean, default: true },
    deleted: { type: Boolean, default: false },
    // Multi-tenant: Website reference
    website: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Website',
      required: true,
      index: true
    }
  },
  {
    timestamps: true,
  }
)

// Multi-tenant: Compound unique index scoped by website
pinCodeSchema.index({ name: 1, website: 1 }, { unique: true, partialFilterExpression: { deleted: false } })

// Performance indexes
pinCodeSchema.index({ website: 1, deleted: 1, isActive: 1 })
pinCodeSchema.index({ website: 1, name: 1 })
pinCodeSchema.index({ website: 1, state: 1, district: 1 })
pinCodeSchema.index({ createdAt: -1 })

export default mongoose.model("PinCode", pinCodeSchema)
