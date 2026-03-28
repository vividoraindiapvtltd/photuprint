import mongoose from "mongoose"

const capacitySchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String, default: null },
    isActive: { type: Boolean, default: true },
    deleted: { type: Boolean, default: false },
    website: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Website",
      required: true,
      index: true,
    },
  },
  { timestamps: true },
)

capacitySchema.index({ name: 1, website: 1 }, { unique: true, partialFilterExpression: { deleted: false } })
capacitySchema.index({ website: 1, deleted: 1, isActive: 1 })
capacitySchema.index({ website: 1, name: 1 })
capacitySchema.index({ createdAt: -1 })

export default mongoose.model("Capacity", capacitySchema)
