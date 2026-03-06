import Font from "../models/font.model.js"

const parseWeights = (weights) => {
  if (!weights) return null
  if (Array.isArray(weights)) return weights.map(String)
  if (typeof weights === "string") {
    // Accept JSON array or comma-separated string
    try {
      const parsed = JSON.parse(weights)
      if (Array.isArray(parsed)) return parsed.map(String)
    } catch (_) {}
    return weights
      .split(",")
      .map((w) => w.trim())
      .filter(Boolean)
  }
  return null
}

// Default system fonts to seed
const DEFAULT_SYSTEM_FONTS = [
  { name: "Arial", family: "Arial", type: "system", sortOrder: 1 },
  { name: "Times New Roman", family: "Times New Roman", type: "system", sortOrder: 2 },
  { name: "Georgia", family: "Georgia", type: "system", sortOrder: 3 },
  { name: "Verdana", family: "Verdana", type: "system", sortOrder: 4 },
  { name: "Courier New", family: "Courier New", type: "system", sortOrder: 5 },
  { name: "Comic Sans MS", family: "Comic Sans MS", type: "system", sortOrder: 6 },
  { name: "Impact", family: "Impact", type: "system", sortOrder: 7 },
  { name: "Trebuchet MS", family: "Trebuchet MS", type: "system", sortOrder: 8 },
  { name: "Tahoma", family: "Tahoma", type: "system", sortOrder: 9 },
  { name: "Palatino", family: "Palatino Linotype, Palatino", type: "system", sortOrder: 10 },
  { name: "Garamond", family: "Garamond", type: "system", sortOrder: 11 },
  { name: "Lucida Console", family: "Lucida Console", type: "system", sortOrder: 12 },
]

// Default Google fonts to seed
const DEFAULT_GOOGLE_FONTS = [
  { name: "Roboto", family: "Roboto", type: "google", googleFontUrl: "https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap", sortOrder: 1 },
  { name: "Open Sans", family: "Open Sans", type: "google", googleFontUrl: "https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;700&display=swap", sortOrder: 2 },
  { name: "Lato", family: "Lato", type: "google", googleFontUrl: "https://fonts.googleapis.com/css2?family=Lato:wght@400;700&display=swap", sortOrder: 3 },
  { name: "Montserrat", family: "Montserrat", type: "google", googleFontUrl: "https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700&display=swap", sortOrder: 4 },
  { name: "Poppins", family: "Poppins", type: "google", googleFontUrl: "https://fonts.googleapis.com/css2?family=Poppins:wght@400;700&display=swap", sortOrder: 5 },
  { name: "Oswald", family: "Oswald", type: "google", googleFontUrl: "https://fonts.googleapis.com/css2?family=Oswald:wght@400;700&display=swap", sortOrder: 6 },
  { name: "Raleway", family: "Raleway", type: "google", googleFontUrl: "https://fonts.googleapis.com/css2?family=Raleway:wght@400;700&display=swap", sortOrder: 7 },
  { name: "Playfair Display", family: "Playfair Display", type: "google", googleFontUrl: "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&display=swap", sortOrder: 8 },
  { name: "Merriweather", family: "Merriweather", type: "google", googleFontUrl: "https://fonts.googleapis.com/css2?family=Merriweather:wght@400;700&display=swap", sortOrder: 9 },
  { name: "Dancing Script", family: "Dancing Script", type: "google", googleFontUrl: "https://fonts.googleapis.com/css2?family=Dancing+Script:wght@400;700&display=swap", sortOrder: 10 },
  { name: "Pacifico", family: "Pacifico", type: "google", googleFontUrl: "https://fonts.googleapis.com/css2?family=Pacifico&display=swap", sortOrder: 11 },
  { name: "Lobster", family: "Lobster", type: "google", googleFontUrl: "https://fonts.googleapis.com/css2?family=Lobster&display=swap", sortOrder: 12 },
  { name: "Great Vibes", family: "Great Vibes", type: "google", googleFontUrl: "https://fonts.googleapis.com/css2?family=Great+Vibes&display=swap", sortOrder: 13 },
  { name: "Caveat", family: "Caveat", type: "google", googleFontUrl: "https://fonts.googleapis.com/css2?family=Caveat:wght@400;700&display=swap", sortOrder: 14 },
  { name: "Satisfy", family: "Satisfy", type: "google", googleFontUrl: "https://fonts.googleapis.com/css2?family=Satisfy&display=swap", sortOrder: 15 },
  { name: "Permanent Marker", family: "Permanent Marker", type: "google", googleFontUrl: "https://fonts.googleapis.com/css2?family=Permanent+Marker&display=swap", sortOrder: 16 },
]

// Seed default fonts if none exist for a specific website
const seedDefaultFonts = async (websiteId) => {
  try {
    if (!websiteId) return
    const existingCount = await Font.countDocuments({ website: websiteId })
    if (existingCount === 0) {
      const fontsWithWebsite = [...DEFAULT_SYSTEM_FONTS, ...DEFAULT_GOOGLE_FONTS].map(f => ({
        ...f,
        website: websiteId
      }))
      await Font.insertMany(fontsWithWebsite)
      console.log(`Default fonts seeded successfully for website ${websiteId}`)
    }
  } catch (error) {
    console.error("Error seeding default fonts:", error)
  }
}

// Get all fonts
export const getAllFonts = async (req, res) => {
  try {
    // Multi-tenant: Require website context
    if (!req.websiteId) {
      return res.status(400).json({ message: "Website context is missing" })
    }

    // Seed default fonts if needed
    await seedDefaultFonts(req.websiteId)

    const { type, includeDeleted, activeOnly } = req.query

    let query = { website: req.websiteId }

    // Filter by type (system/google)
    if (type && type !== "all") {
      query.type = type
    }

    // Filter deleted
    if (includeDeleted !== "true") {
      query.deleted = { $ne: true }
    }

    // Filter active only
    if (activeOnly === "true") {
      query.isActive = true
    }

    const fonts = await Font.find(query).sort({ type: 1, sortOrder: 1, name: 1 })

    res.status(200).json(fonts)
  } catch (error) {
    console.error("Error fetching fonts:", error)
    res.status(500).json({ message: "Error fetching fonts", error: error.message })
  }
}

// Get active fonts (for template manager dropdown)
export const getActiveFonts = async (req, res) => {
  try {
    // Multi-tenant: Require website context
    if (!req.websiteId) {
      return res.status(400).json({ message: "Website context is missing" })
    }

    // Seed default fonts if needed
    await seedDefaultFonts(req.websiteId)

    const fonts = await Font.find({ website: req.websiteId, isActive: true, deleted: { $ne: true } }).sort({ type: 1, sortOrder: 1, name: 1 })

    // Group by type
    const systemFonts = fonts.filter((f) => f.type === "system")
    const googleFonts = fonts.filter((f) => f.type === "google")
    const uploadFonts = fonts.filter((f) => f.type === "upload")

    res.status(200).json({
      systemFonts,
      googleFonts,
      uploadFonts,
      all: fonts,
    })
  } catch (error) {
    console.error("Error fetching active fonts:", error)
    res.status(500).json({ message: "Error fetching fonts", error: error.message })
  }
}

// Get font by ID
export const getFontById = async (req, res) => {
  try {
    // Multi-tenant: Require website context
    if (!req.websiteId) {
      return res.status(400).json({ message: "Website context is missing" })
    }

    const font = await Font.findOne({ _id: req.params.id, website: req.websiteId })
    if (!font) {
      return res.status(404).json({ message: "Font not found" })
    }
    res.status(200).json(font)
  } catch (error) {
    console.error("Error fetching font:", error)
    res.status(500).json({ message: "Error fetching font", error: error.message })
  }
}

// Create new font
export const createFont = async (req, res) => {
  try {
    // Multi-tenant: Require website context
    if (!req.websiteId) {
      return res.status(400).json({ message: "Website context is missing" })
    }

    const { name, family, type, googleFontUrl, previewText, weights, isActive, sortOrder } = req.body

    // Check if font name already exists for this website
    const existingFont = await Font.findOne({ name, website: req.websiteId, deleted: { $ne: true } })
    if (existingFont) {
      return res.status(400).json({ message: "A font with this name already exists" })
    }

    const font = new Font({
      name,
      family: family || name,
      type,
      googleFontUrl: type === "google" ? googleFontUrl : null,
      previewText: previewText || "The quick brown fox jumps over the lazy dog",
      weights: parseWeights(weights) || ["400", "700"],
      isActive: isActive !== false,
      sortOrder: sortOrder || 0,
      website: req.websiteId,
    })

    await font.save()
    res.status(201).json(font)
  } catch (error) {
    console.error("Error creating font:", error)
    res.status(500).json({ message: "Error creating font", error: error.message })
  }
}

// Update font
export const updateFont = async (req, res) => {
  try {
    // Multi-tenant: Require website context
    if (!req.websiteId) {
      return res.status(400).json({ message: "Website context is missing" })
    }

    const { name, family, type, googleFontUrl, previewText, weights, isActive, sortOrder } = req.body

    const font = await Font.findOne({ _id: req.params.id, website: req.websiteId })
    if (!font) {
      return res.status(404).json({ message: "Font not found" })
    }

    // Check if new name conflicts with another font for this website
    if (name && name !== font.name) {
      const existingFont = await Font.findOne({ name, website: req.websiteId, _id: { $ne: font._id }, deleted: { $ne: true } })
      if (existingFont) {
        return res.status(400).json({ message: "A font with this name already exists" })
      }
    }

    // Update fields
    if (name) font.name = name
    if (family) font.family = family
    if (type) {
      font.type = type
      font.googleFontUrl = type === "google" ? googleFontUrl || font.googleFontUrl : null
    }
    if (previewText) font.previewText = previewText
    if (weights) font.weights = parseWeights(weights) || font.weights
    if (isActive !== undefined) font.isActive = isActive
    if (sortOrder !== undefined) font.sortOrder = sortOrder

    await font.save()
    res.status(200).json(font)
  } catch (error) {
    console.error("Error updating font:", error)
    res.status(500).json({ message: "Error updating font", error: error.message })
  }
}

// Toggle font active status
export const toggleFontStatus = async (req, res) => {
  try {
    // Multi-tenant: Require website context
    if (!req.websiteId) {
      return res.status(400).json({ message: "Website context is missing" })
    }

    const font = await Font.findOne({ _id: req.params.id, website: req.websiteId })
    if (!font) {
      return res.status(404).json({ message: "Font not found" })
    }

    font.isActive = !font.isActive
    await font.save()

    res.status(200).json(font)
  } catch (error) {
    console.error("Error toggling font status:", error)
    res.status(500).json({ message: "Error toggling font status", error: error.message })
  }
}

// Soft delete font
export const deleteFont = async (req, res) => {
  try {
    // Multi-tenant: Require website context
    if (!req.websiteId) {
      return res.status(400).json({ message: "Website context is missing" })
    }

    const font = await Font.findOne({ _id: req.params.id, website: req.websiteId })
    if (!font) {
      return res.status(404).json({ message: "Font not found" })
    }

    font.deleted = true
    font.deletedAt = new Date()
    await font.save()

    res.status(200).json({ message: "Font deleted successfully" })
  } catch (error) {
    console.error("Error deleting font:", error)
    res.status(500).json({ message: "Error deleting font", error: error.message })
  }
}

// Restore deleted font
export const restoreFont = async (req, res) => {
  try {
    // Multi-tenant: Require website context
    if (!req.websiteId) {
      return res.status(400).json({ message: "Website context is missing" })
    }

    const font = await Font.findOne({ _id: req.params.id, website: req.websiteId })
    if (!font) {
      return res.status(404).json({ message: "Font not found" })
    }

    font.deleted = false
    font.deletedAt = null
    await font.save()

    res.status(200).json(font)
  } catch (error) {
    console.error("Error restoring font:", error)
    res.status(500).json({ message: "Error restoring font", error: error.message })
  }
}

// Permanently delete font
export const permanentDeleteFont = async (req, res) => {
  try {
    // Multi-tenant: Require website context
    if (!req.websiteId) {
      return res.status(400).json({ message: "Website context is missing" })
    }

    const font = await Font.findOneAndDelete({ _id: req.params.id, website: req.websiteId })
    if (!font) {
      return res.status(404).json({ message: "Font not found" })
    }

    res.status(200).json({ message: "Font permanently deleted" })
  } catch (error) {
    console.error("Error permanently deleting font:", error)
    res.status(500).json({ message: "Error permanently deleting font", error: error.message })
  }
}

// Upload a custom font file (creates a font with type="upload")
export const uploadFont = async (req, res) => {
  try {
    // Multi-tenant: Require website context
    if (!req.websiteId) {
      return res.status(400).json({ message: "Website context is missing" })
    }

    const { name, family, previewText, weights, isActive, sortOrder } = req.body || {}

    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: "Font name is required" })
    }
    if (!req.file) {
      return res.status(400).json({ message: "Font file is required" })
    }

    const trimmedName = String(name).trim()
    const existingFont = await Font.findOne({ name: trimmedName, website: req.websiteId, deleted: { $ne: true } })
    if (existingFont) {
      return res.status(400).json({ message: "A font with this name already exists" })
    }

    const ext = (req.file.originalname || "").split(".").pop()?.toLowerCase() || null
    const fileUrl = `/uploads/${req.file.filename}`

    const font = new Font({
      name: trimmedName,
      family: (family && String(family).trim()) || trimmedName,
      type: "upload",
      fileUrl,
      fileName: req.file.originalname || req.file.filename,
      mimeType: req.file.mimetype || null,
      format: ext,
      previewText: previewText || "The quick brown fox jumps over the lazy dog",
      weights: parseWeights(weights) || ["400", "700"],
      isActive: isActive !== false,
      sortOrder: sortOrder || 0,
      website: req.websiteId,
    })

    await font.save()
    return res.status(201).json(font)
  } catch (error) {
    console.error("Error uploading font:", error)
    return res.status(500).json({ message: "Error uploading font", error: error.message })
  }
}

// Bulk update sort order
export const updateSortOrder = async (req, res) => {
  try {
    // Multi-tenant: Require website context
    if (!req.websiteId) {
      return res.status(400).json({ message: "Website context is missing" })
    }

    const { fonts } = req.body // Array of { id, sortOrder }

    if (!Array.isArray(fonts)) {
      return res.status(400).json({ message: "Invalid request body" })
    }

    const bulkOps = fonts.map((f) => ({
      updateOne: {
        filter: { _id: f.id, website: req.websiteId },
        update: { $set: { sortOrder: f.sortOrder } },
      },
    }))

    await Font.bulkWrite(bulkOps)

    res.status(200).json({ message: "Sort order updated successfully" })
  } catch (error) {
    console.error("Error updating sort order:", error)
    res.status(500).json({ message: "Error updating sort order", error: error.message })
  }
}
