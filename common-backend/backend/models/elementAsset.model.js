import mongoose from "mongoose"

const ORIENTATIONS = ["portrait", "landscape", "square", "any"]
const ANIMATIONS = ["none", "fade", "slide", "zoom", "spin", "bounce"]

const elementAssetSchema = new mongoose.Schema(
  {
    element: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Element",
      required: true,
      index: true,
    },
    image: { type: String, required: true },
    color: { type: String, default: "" },
    orientation: { type: String, enum: ORIENTATIONS, default: "any" },
    animation: { type: String, enum: ANIMATIONS, default: "none" },
    label: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
    website: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Website",
      required: true,
      index: true,
    },
  },
  { timestamps: true }
)

elementAssetSchema.index({ element: 1, website: 1 })
elementAssetSchema.index({ website: 1 })

export default mongoose.model("ElementAsset", elementAssetSchema)
export { ORIENTATIONS, ANIMATIONS }
