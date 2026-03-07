import VariationSetting from "../models/variationSetting.model.js"
import Category from "../models/category.model.js"
import Subcategory from "../models/subcategory.model.js"

/**
 * Get all variation settings
 * GET /api/variation-settings
 */
export const getVariationSettings = async (req, res) => {
  try {
    if (!req.websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }

    const settings = await VariationSetting.find({
      website: req.websiteId,
      deleted: false
    })
      .populate("category", "name categoryId")
      .populate("subcategory", "name subcategoryId")
      .sort({ createdAt: -1 })

    res.json(settings)
  } catch (error) {
    console.error("Error fetching variation settings:", error)
    res.status(500).json({ msg: "Failed to fetch variation settings", error: error.message })
  }
}

/**
 * Get variation setting by ID
 * GET /api/variation-settings/:id
 */
export const getVariationSettingById = async (req, res) => {
  try {
    if (!req.websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }

    const setting = await VariationSetting.findOne({
      _id: req.params.id,
      website: req.websiteId,
      deleted: false
    })
      .populate("category", "name categoryId")
      .populate("subcategory", "name subcategoryId")

    if (!setting) {
      return res.status(404).json({ msg: "Variation setting not found" })
    }

    res.json(setting)
  } catch (error) {
    console.error("Error fetching variation setting:", error)
    res.status(500).json({ msg: "Failed to fetch variation setting", error: error.message })
  }
}

/**
 * Check if category/subcategory supports variations
 * GET /api/variation-settings/check
 * Query params: categoryId, subcategoryId
 */
export const checkVariationSupport = async (req, res) => {
  try {
    if (!req.websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }

    const { categoryId, subcategoryId } = req.query

    if (!categoryId) {
      return res.status(400).json({ msg: "categoryId is required" })
    }

    // Check for subcategory-specific setting first
    if (subcategoryId) {
      const subcategorySetting = await VariationSetting.findOne({
        subcategory: subcategoryId,
        website: req.websiteId,
        deleted: false,
        enabled: true
      })

      if (subcategorySetting) {
        return res.json({ supportsVariations: true, level: "subcategory" })
      }
    }

    // Check for category-level setting
    const categorySetting = await VariationSetting.findOne({
      category: categoryId,
      subcategory: null,
      website: req.websiteId,
      deleted: false,
      enabled: true
    })

    if (categorySetting) {
      return res.json({ supportsVariations: true, level: "category" })
    }

    res.json({ supportsVariations: false, level: null })
  } catch (error) {
    console.error("Error checking variation support:", error)
    res.status(500).json({ msg: "Failed to check variation support", error: error.message })
  }
}

/**
 * Create variation setting
 * POST /api/variation-settings
 */
export const createVariationSetting = async (req, res) => {
  try {
    if (!req.websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }

    const { category, subcategory, enabled, variationBasis, displayBasis } = req.body

    // Validate that at least one of category or subcategory is provided
    if (!category && !subcategory) {
      return res.status(400).json({ msg: "Either category or subcategory must be provided" })
    }

    // Validate category exists if provided
    if (category) {
      const categoryExists = await Category.findOne({
        _id: category,
        website: req.websiteId,
        deleted: false
      })
      if (!categoryExists) {
        return res.status(404).json({ msg: "Category not found" })
      }
    }

    // Validate subcategory exists if provided
    if (subcategory) {
      const subcategoryExists = await Subcategory.findOne({
        _id: subcategory,
        website: req.websiteId,
        deleted: false
      })
      if (!subcategoryExists) {
        return res.status(404).json({ msg: "Subcategory not found" })
      }
    }

    // Check for existing setting
    const existingSetting = await VariationSetting.findOne({
      category: category || null,
      subcategory: subcategory || null,
      website: req.websiteId,
      deleted: false
    })

    if (existingSetting) {
      // Update existing setting
      existingSetting.enabled = enabled !== undefined ? enabled : true
      if (variationBasis !== undefined) existingSetting.variationBasis = variationBasis
      if (displayBasis !== undefined) existingSetting.displayBasis = displayBasis
      await existingSetting.save()

      const populated = await VariationSetting.findById(existingSetting._id)
        .populate("category", "name categoryId")
        .populate("subcategory", "name subcategoryId")

      return res.json({
        msg: "Variation setting updated successfully",
        setting: populated
      })
    }

    // Create new setting
    const setting = new VariationSetting({
      category: category || null,
      subcategory: subcategory || null,
      enabled: enabled !== undefined ? enabled : true,
      variationBasis: variationBasis || "size_and_color",
      displayBasis: displayBasis || "color_first",
      website: req.websiteId
    })

    await setting.save()

    const populated = await VariationSetting.findById(setting._id)
      .populate("category", "name categoryId")
      .populate("subcategory", "name subcategoryId")

    res.status(201).json({
      msg: "Variation setting created successfully",
      setting: populated
    })
  } catch (error) {
    console.error("Error creating variation setting:", error)
    
    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(400).json({
        msg: "A variation setting already exists for this category/subcategory combination"
      })
    }

    res.status(500).json({ msg: "Failed to create variation setting", error: error.message })
  }
}

/**
 * Update variation setting
 * PUT /api/variation-settings/:id
 */
export const updateVariationSetting = async (req, res) => {
  try {
    if (!req.websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }

    const { enabled, variationBasis, displayBasis } = req.body

    const setting = await VariationSetting.findOne({
      _id: req.params.id,
      website: req.websiteId,
      deleted: false
    })

    if (!setting) {
      return res.status(404).json({ msg: "Variation setting not found" })
    }

    if (enabled !== undefined) setting.enabled = enabled
    if (variationBasis !== undefined) setting.variationBasis = variationBasis
    if (displayBasis !== undefined) setting.displayBasis = displayBasis

    await setting.save()

    const populated = await VariationSetting.findById(setting._id)
      .populate("category", "name categoryId")
      .populate("subcategory", "name subcategoryId")

    res.json({
      msg: "Variation setting updated successfully",
      setting: populated
    })
  } catch (error) {
    console.error("Error updating variation setting:", error)
    res.status(500).json({ msg: "Failed to update variation setting", error: error.message })
  }
}

/**
 * Delete variation setting (soft delete)
 * DELETE /api/variation-settings/:id
 */
export const deleteVariationSetting = async (req, res) => {
  try {
    if (!req.websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }

    const setting = await VariationSetting.findOne({
      _id: req.params.id,
      website: req.websiteId,
      deleted: false
    })

    if (!setting) {
      return res.status(404).json({ msg: "Variation setting not found" })
    }

    setting.deleted = true
    await setting.save()

    res.json({ msg: "Variation setting deleted successfully" })
  } catch (error) {
    console.error("Error deleting variation setting:", error)
    res.status(500).json({ msg: "Failed to delete variation setting", error: error.message })
  }
}

/**
 * Bulk create/update variation settings
 * POST /api/variation-settings/bulk
 */
export const bulkUpdateVariationSettings = async (req, res) => {
  try {
    if (!req.websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }

    const { settings } = req.body // Array of { category, subcategory, enabled, variationBasis, displayBasis }

    if (!Array.isArray(settings)) {
      return res.status(400).json({ msg: "Settings must be an array" })
    }

    const results = []
    const errors = []

    for (const item of settings) {
      try {
        const { category, subcategory, enabled, variationBasis, displayBasis } = item

        if (!category && !subcategory) {
          errors.push({ item, error: "Either category or subcategory must be provided" })
          continue
        }

        // Check for existing setting
        const existingSetting = await VariationSetting.findOne({
          category: category || null,
          subcategory: subcategory || null,
          website: req.websiteId,
          deleted: false
        })

        if (existingSetting) {
          existingSetting.enabled = enabled !== undefined ? enabled : true
          if (variationBasis !== undefined) existingSetting.variationBasis = variationBasis
          if (displayBasis !== undefined) existingSetting.displayBasis = displayBasis
          await existingSetting.save()
          results.push({ setting: existingSetting, action: "updated" })
        } else {
          const newSetting = new VariationSetting({
            category: category || null,
            subcategory: subcategory || null,
            enabled: enabled !== undefined ? enabled : true,
            variationBasis: variationBasis || "size_and_color",
            displayBasis: displayBasis || "color_first",
            website: req.websiteId
          })
          await newSetting.save()
          results.push({ setting: newSetting, action: "created" })
        }
      } catch (error) {
        errors.push({ item, error: error.message })
      }
    }

    res.json({
      msg: `Processed ${results.length} setting(s)`,
      results,
      errors: errors.length > 0 ? errors : undefined
    })
  } catch (error) {
    console.error("Error bulk updating variation settings:", error)
    res.status(500).json({ msg: "Failed to bulk update variation settings", error: error.message })
  }
}
