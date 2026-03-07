import mongoose from "mongoose"

const CAROUSEL_KEYS = ["hero", "featured", "promotions"]

/**
 * Full-width carousel slide for storefront.
 * Multi-tenant: scoped by website + carouselKey.
 */
const carouselSlideSchema = new mongoose.Schema(
  {
    website: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Website",
      required: true,
      index: true,
    },
    carouselKey: {
      type: String,
      trim: true,
      default: "hero",
      enum: CAROUSEL_KEYS,
      index: true,
    },
    imageUrl: { type: String, trim: true, default: "" },
    title: { type: String, trim: true, default: "" },
    subtitle: { type: String, trim: true, default: "" },
    linkUrl: { type: String, trim: true, default: "" },
    openInNewTab: { type: Boolean, default: false },
    displayOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
)

carouselSlideSchema.index({ website: 1, carouselKey: 1, displayOrder: 1 })
carouselSlideSchema.index({ website: 1, carouselKey: 1, isActive: 1 })

export default mongoose.model("CarouselSlide", carouselSlideSchema)
