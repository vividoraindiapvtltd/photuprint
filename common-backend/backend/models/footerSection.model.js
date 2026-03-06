import mongoose from "mongoose"

/**
 * Footer Section Model
 *
 * Manages dynamic footer sections for the storefront homepage.
 * Supports: links, contact, newsletter, social, about, payment, copyright, custom.
 *
 * Multi-tenant: scoped by website
 */

// Sub-schema for link items
const footerLinkSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true },
    url: { type: String, required: true, trim: true },
    openInNewTab: { type: Boolean, default: false },
    displayOrder: { type: Number, default: 0 },
  },
  { _id: false }
)

// Sub-schema for social links
const socialLinkSchema = new mongoose.Schema(
  {
    platform: {
      type: String,
      required: true,
      enum: ["facebook", "instagram", "twitter", "youtube", "linkedin", "pinterest", "tiktok", "whatsapp", "other"],
    },
    url: { type: String, required: true, trim: true },
    displayOrder: { type: Number, default: 0 },
  },
  { _id: false }
)

// Sub-schema for payment/trust icons
const paymentIconSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    iconUrl: { type: String, trim: true },
    displayOrder: { type: Number, default: 0 },
  },
  { _id: false }
)

const footerSectionSchema = new mongoose.Schema(
  {
    website: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Website",
      required: true,
      index: true,
    },

    type: {
      type: String,
      enum: [
        "links",      // Column of links (Quick Links, Customer Service)
        "contact",     // Address, phone, email
        "newsletter",  // Email signup form
        "social",      // Social media icons
        "about",       // About us text + logo
        "payment",     // Payment method icons
        "copyright",   // Copyright text
        "custom",      // Custom HTML
      ],
      required: true,
    },

    title: {
      type: String,
      trim: true,
      maxlength: [100, "Title cannot exceed 100 characters"],
    },

    displayOrder: {
      type: Number,
      default: 0,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    // Type-specific config (mixed schema - only relevant fields used per type)
    config: {
      links: [footerLinkSchema],
      address: { type: String, trim: true },
      phone: { type: String, trim: true },
      email: { type: String, trim: true },
      description: { type: String, trim: true },
      logoUrl: { type: String, trim: true },
      placeholder: { type: String, trim: true },
      buttonText: { type: String, trim: true },
      successMessage: { type: String, trim: true },
      platforms: [socialLinkSchema],
      icons: [paymentIconSchema],
      text: { type: String, trim: true },
      html: { type: String, trim: true },
    },
  },
  { timestamps: true }
)

footerSectionSchema.index({ website: 1, displayOrder: 1 })
footerSectionSchema.index({ website: 1, isActive: 1 })

export default mongoose.model("FooterSection", footerSectionSchema)
