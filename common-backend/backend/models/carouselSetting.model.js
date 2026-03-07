import mongoose from "mongoose"

const LAYOUTS = ["fullWidth", "cards2", "cards3", "cards4"]
const SLIDE_EFFECTS = ["fade", "slide", "zoom", "slideUp", "flip"]

const CAROUSEL_KEYS = ["hero", "featured", "promotions"]

/**
 * Carousel display layout and settings per website.
 * fullWidth = one full-width image per slide; cards2/cards3/cards4 = 2/3/4 images per row.
 * Multiple carousels per website via carouselKey (hero, featured, promotions).
 */
const carouselSettingSchema = new mongoose.Schema(
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
    name: { type: String, trim: true, default: "" },
    showDisplayName: { type: Boolean, default: true },
    layout: {
      type: String,
      enum: LAYOUTS,
      default: "fullWidth",
    },
    slideEffect: {
      type: String,
      enum: SLIDE_EFFECTS,
      default: "fade",
    },
    isActive: { type: Boolean, default: true },
    autoplay: { type: Boolean, default: true },
    autoplayInterval: { type: Number, default: 5 },
    transitionDuration: { type: Number, default: 0.5 },
    loop: { type: Boolean, default: true },
    showArrows: { type: Boolean, default: true },
    arrowsPosition: { type: String, enum: ["inside", "outside"], default: "inside" },
    showDots: { type: Boolean, default: true },
    dotsOutside: { type: Boolean, default: false },
    pauseOnHover: { type: Boolean, default: true },
    showSlideTitle: { type: Boolean, default: true },
    showSlideSubtitle: { type: Boolean, default: true },
    captionPosition: { type: String, enum: ["overlay", "below"], default: "overlay" },
    imageFit: { type: String, enum: ["cover", "contain"], default: "cover" },
    backgroundColor: { type: String, trim: true, default: "#111827" },
    displayNameColor: { type: String, trim: true, default: "#ffffff" },
    displayNameFontSize: { type: String, trim: true, default: "20px" },
    captionColor: { type: String, trim: true, default: "#ffffff" },
    captionSubtitleColor: { type: String, trim: true, default: "#e5e7eb" },
    captionTitleFontSize: { type: String, trim: true, default: "18px" },
    captionSubtitleFontSize: { type: String, trim: true, default: "14px" },
    captionOverlayOpacity: { type: Number, default: 0.8 },
  },
  { timestamps: true }
)

carouselSettingSchema.index({ website: 1, carouselKey: 1 }, { unique: true })

export const CAROUSEL_LAYOUTS = LAYOUTS
export const CAROUSEL_KEYS_LIST = CAROUSEL_KEYS
export const CAROUSEL_SLIDE_EFFECTS = SLIDE_EFFECTS
export default mongoose.model("CarouselSetting", carouselSettingSchema)
