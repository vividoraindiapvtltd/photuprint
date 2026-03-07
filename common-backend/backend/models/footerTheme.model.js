import mongoose from "mongoose"

/**
 * Footer theme/customization. Multiple themes per website; one can be active.
 * Storefront uses the theme where isActive === true for the website.
 */
const footerThemeSchema = new mongoose.Schema(
  {
    website: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Website",
      required: true,
      index: true,
    },
    name: { type: String, trim: true }, // e.g. "Dark", "Light" (optional label)
    // Section/footer background (e.g. #111827, #1f2937)
    backgroundColor: { type: String, trim: true },
    // Section title
    titleFontSize: { type: String, trim: true },   // e.g. 14px, 1rem, 16px
    titleColor: { type: String, trim: true },     // e.g. #ffffff
    // Link text (links section + any clickable text)
    linkFontSize: { type: String, trim: true },
    linkColor: { type: String, trim: true },
    linkHoverColor: { type: String, trim: true },
    // Body/description text (about, contact, copyright, etc.)
    bodyTextSize: { type: String, trim: true },
    bodyTextColor: { type: String, trim: true },
    // Text box / input (e.g. newsletter email field)
    inputBackgroundColor: { type: String, trim: true },
    inputTextColor: { type: String, trim: true },
    inputBorderColor: { type: String, trim: true },
    inputBorderRadius: { type: String, trim: true },
    // Subscribe button (newsletter)
    subscribeButtonBackgroundColor: { type: String, trim: true },
    subscribeButtonTextColor: { type: String, trim: true },
    subscribeButtonBorderColor: { type: String, trim: true },
    subscribeButtonBorderRadius: { type: String, trim: true },
    // Social media icon color
    socialIconColor: { type: String, trim: true },
    // Divider between sections
    dividerColor: { type: String, trim: true },
    dividerThickness: { type: String, trim: true },  // e.g. 1px, 2px
    // Number of footer columns (2, 3, or 4). When 2 or 3, sections use columnIndex + displayOrder (stacked per column).
    footerColumns: { type: Number, default: 4, enum: [2, 3, 4] },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
)

export default mongoose.model("FooterTheme", footerThemeSchema)
