import mongoose from "mongoose"

const SHAPES = ["rectangle", "oval", "square", "custom"]
const UNITS = ["mm", "cm", "inch", "ft", "m"]

const templateDimensionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, default: "" },
    description: { type: String, default: "" },
    width: { type: Number, required: true },
    height: { type: Number, required: true },
    unit: { type: String, enum: UNITS, default: "mm" },
    dpi: { type: Number, default: 300 },
    bleed: { type: Number, default: 0 },
    safeAreaInset: { type: Number, default: 0 },
    shape: { type: String, enum: SHAPES, default: "rectangle" },
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

templateDimensionSchema.index({ website: 1, deleted: 1, isActive: 1 })
templateDimensionSchema.index({ website: 1, slug: 1 })
templateDimensionSchema.index({ website: 1, name: 1 })

export default mongoose.model("TemplateDimension", templateDimensionSchema)
export { SHAPES, UNITS }
