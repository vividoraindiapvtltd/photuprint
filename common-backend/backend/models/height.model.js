import mongoose from "mongoose"

const heightSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    unit: { type: String, enum: ['inches', 'centimeters', 'millimeters', 'feet', 'meters'], default: 'centimeters' },
    description: { type: String, default: null },
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

// Multi-tenant: Compound unique index for name + unit + website combination (only for non-deleted items)
heightSchema.index({ name: 1, unit: 1, website: 1 }, { unique: true, partialFilterExpression: { deleted: false } })

// Performance indexes
heightSchema.index({ website: 1, deleted: 1, isActive: 1 })
heightSchema.index({ website: 1, name: 1 })
heightSchema.index({ website: 1, unit: 1 })
heightSchema.index({ createdAt: -1 })

export default mongoose.model("Height", heightSchema)

