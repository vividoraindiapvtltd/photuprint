import mongoose from "mongoose"

const widthSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    unit: { type: String, enum: ['inches', 'centimeters', 'millimeters', 'feet', 'meters'], default: 'centimeters' },
    description: { type: String, default: null },
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

// Multi-tenant: Create compound unique index for name + unit + website combination (only for non-deleted items)
widthSchema.index({ name: 1, unit: 1, website: 1 }, { unique: true, partialFilterExpression: { deleted: false } })

// Performance indexes
widthSchema.index({ website: 1, deleted: 1, isActive: 1 })
widthSchema.index({ website: 1, name: 1 })
widthSchema.index({ website: 1, unit: 1 })
widthSchema.index({ createdAt: -1 })

export default mongoose.model("Width", widthSchema)
