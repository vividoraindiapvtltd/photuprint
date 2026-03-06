import mongoose from "mongoose"

/**
 * VariationSetting Model
 * Stores which categories and subcategories support product variations
 */
const variationSettingSchema = new mongoose.Schema(
  {
    // Category reference (optional - can be set at category level)
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
      index: true
    },
    
    // Subcategory reference (optional - can be set at subcategory level)
    subcategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subcategory",
      default: null,
      index: true
    },
    
    // Enable variations for this category/subcategory
    enabled: {
      type: Boolean,
      default: true
    },
    
    // Multi-tenant: Website reference
    website: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Website',
      required: true,
      index: true
    },
    
    // Soft delete
    deleted: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
)

// Compound index: Only one active setting per category/subcategory per website
variationSettingSchema.index(
  { category: 1, subcategory: 1, website: 1, deleted: 1 },
  { unique: true, partialFilterExpression: { deleted: false } }
)

// Index for quick lookups
variationSettingSchema.index({ website: 1, enabled: 1, deleted: 1 })
variationSettingSchema.index({ category: 1, website: 1, deleted: 1 })
variationSettingSchema.index({ subcategory: 1, website: 1, deleted: 1 })

export default mongoose.model("VariationSetting", variationSettingSchema)
