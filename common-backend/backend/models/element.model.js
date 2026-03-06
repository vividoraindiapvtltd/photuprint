import mongoose from "mongoose"

const elementSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    type: { type: String, enum: ["text", "image", "shape"], default: "image" },
    description: { type: String, default: "" },
    image: { type: String, default: null },
    isActive: { type: Boolean, default: true },
    deleted: { type: Boolean, default: false },
    website: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Website",
      required: true,
      index: true,
    },
  },
  { timestamps: true }
)

elementSchema.index({ website: 1, deleted: 1, isActive: 1 })
elementSchema.index({ website: 1, name: 1 })

export default mongoose.model("Element", elementSchema)
