import mongoose from "mongoose"

const gsmSchema = new mongoose.Schema(
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

gsmSchema.index({ name: 1, website: 1 }, { unique: true, partialFilterExpression: { deleted: false } })
gsmSchema.index({ website: 1, deleted: 1, isActive: 1 })
gsmSchema.index({ website: 1, name: 1 })
gsmSchema.index({ createdAt: -1 })

export default mongoose.model("Gsm", gsmSchema)
