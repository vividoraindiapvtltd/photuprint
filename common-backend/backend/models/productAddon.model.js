import mongoose from "mongoose"

/** Master list of product add-ons (e.g. zipper options) managed per website. */
const productAddonSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String, default: null },
    image: { type: String, default: null },
    sortOrder: { type: Number, default: 0 },
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

productAddonSchema.index({ name: 1, website: 1 }, { unique: true, partialFilterExpression: { deleted: false } })
productAddonSchema.index({ website: 1, deleted: 1, isActive: 1 })
productAddonSchema.index({ website: 1, sortOrder: 1, name: 1 })

export default mongoose.model("ProductAddon", productAddonSchema)
