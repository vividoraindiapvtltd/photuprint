import mongoose from "mongoose"

const fontSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    family: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ["system", "google", "upload"],
      required: true,
    },
    // For Google fonts, store the import URL
    googleFontUrl: {
      type: String,
      default: null,
    },
    // For uploaded fonts, store the file URL (served from /uploads)
    fileUrl: {
      type: String,
      default: null,
    },
    fileName: {
      type: String,
      default: null,
    },
    mimeType: {
      type: String,
      default: null,
    },
    format: {
      type: String,
      default: null,
    },
    // Preview text for displaying the font
    previewText: {
      type: String,
      default: "The quick brown fox jumps over the lazy dog",
    },
    // Font weights available
    weights: {
      type: [String],
      default: ["400", "700"],
    },
    // Is font active/available for use
    isActive: {
      type: Boolean,
      default: true,
    },
    // Sort order for display
    sortOrder: {
      type: Number,
      default: 0,
    },
    // Soft delete
    deleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    // Multi-tenant: Website reference
    website: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Website",
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
)

// Multi-tenant compound unique index - name unique per website
fontSchema.index({ name: 1, website: 1 }, { unique: true, partialFilterExpression: { deleted: false } })

// Index for faster queries
fontSchema.index({ website: 1, type: 1, isActive: 1 })
fontSchema.index({ website: 1, deleted: 1 })
fontSchema.index({ website: 1, sortOrder: 1, name: 1 })

const Font = mongoose.model("Font", fontSchema)

export default Font
