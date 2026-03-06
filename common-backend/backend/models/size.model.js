import mongoose from "mongoose"

const sizeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true }, // Removed unique: true - will use compound index with website
    initial: { type: String, required: true }, // Removed unique: true - will use compound index with website
    dimensions: String, // Optional, like "10x10"
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

// Multi-tenant: Compound unique indexes scoped by website
sizeSchema.index({ name: 1, website: 1 }, { unique: true, partialFilterExpression: { deleted: false } })
sizeSchema.index({ initial: 1, website: 1 }, { unique: true, partialFilterExpression: { deleted: false } })

// Performance indexes
sizeSchema.index({ website: 1, deleted: 1, isActive: 1 })
sizeSchema.index({ website: 1, name: 1, dimensions: 1 })
sizeSchema.index({ createdAt: -1 })

export default mongoose.model("Size", sizeSchema)
