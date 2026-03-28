import Color from "../models/color.model.js"
import { uploadLocalFileToCloudinary, removeLocalFiles } from "../utils/cloudinaryUpload.js"

// Get all colors
export const getColors = async (req, res) => {
  try {
    // Multi-tenant: Filter by website
    if (!req.websiteId) {
      return res.status(400).json({ msg: 'Website context is missing' });
    }
const { search, isActive, showInactive = "true", includeDeleted = "true" } = req.query
    let query = {
      website: req.websiteId, // Multi-tenant: Set website
      // Filter by tenant website
    };

    // Always include deleted colors by default, but allow filtering
    if (includeDeleted === "false") {
      query.deleted = false
    }

    if (showInactive === "false") {
      query.isActive = true
    } else if (isActive !== undefined) {
      query.isActive = isActive === "true"
    }

    if (search) {
      query.name = { $regex: search, $options: "i" }
    }

    const colors = await Color.find(query).sort({ createdAt: -1 })
    res.json(colors)
  } catch (error) {
    console.error("Error fetching colors:", error)
    res.status(500).json({ msg: "Failed to fetch colors" })
  }
}

// Get single color by ID
export const getColorById = async (req, res) => {
  try {
    // Multi-tenant: Filter by website
    if (!req.websiteId) {
      return res.status(400).json({ msg: 'Website context is missing' });
    }
const color = await Color.findOne({ _id: req.params.id, website: req.websiteId })
    if (!color) {
      return res.status(404).json({ msg: "Color not found" })
    }
    res.json(color)
  } catch (error) {
    console.error("Error fetching color:", error)
    res.status(500).json({ msg: "Failed to fetch color" })
  }
}

// Create new color
export const createColor = async (req, res) => {
  try {
    // Multi-tenant: Require website context
    if (!req.websiteId) {
      return res.status(400).json({ msg: 'Website context is missing. Please select a website first.' });
    }

    const { name, code, isActive } = req.body

    if (!name || !name.trim()) {
      return res.status(400).json({ msg: "Color name is required" })
    }

    // Check if color with same name already exists within the same website
    const existingColor = await Color.findOne({
      name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
      website: req.websiteId,
      deleted: { $ne: true }
    })

    if (existingColor) {
      return res.status(400).json({ msg: "Color name already exists" })
    }

    let imageUrl = null
    if (req.file) {
      try {
        imageUrl = await uploadLocalFileToCloudinary(req.file.path, { folder: "photuprint/colors" })
      } catch (e) {
        removeLocalFiles([req.file])
        return res.status(503).json({ msg: e.message || "Image upload failed. Configure Cloudinary." })
      }
    }

    const color = new Color({
      name: name.trim(),
      code: (code && typeof code === "string" && code.trim()) ? code.trim() : null,
      image: imageUrl,
      isActive: isActive === "true" ? true : isActive === true ? true : false,
      website: req.websiteId // Multi-tenant: Set website
    })

    const savedColor = await color.save()
    res.status(201).json(savedColor)
  } catch (error) {
    console.error("Error creating color:", error)
    // Handle specific errors
    if (error.code === 11000) {
      // Duplicate key error
      return res.status(400).json({ msg: "A color with this name or code already exists" })
    }
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(e => e.message)
      return res.status(400).json({ msg: messages.join(', ') })
    }
    res.status(500).json({ msg: "Failed to create color", error: error.message })
  }
}

// Update color
export const updateColor = async (req, res) => {
  try {
    // Multi-tenant: Require website context
    if (!req.websiteId) {
      return res.status(400).json({ msg: 'Website context is missing. Please select a website first.' });
    }

    const { name, code, isActive } = req.body

    // Check if color exists
    const color = await Color.findOne({ _id: req.params.id, website: req.websiteId })
    if (!color) {
      return res.status(404).json({ msg: "Color not found" })
    }

    // Check for duplicate names (excluding current color) within the same website
    if (name && name.trim() !== color.name) {
      const existingColor = await Color.findOne({
        $and: [
          { _id: { $ne: req.params.id } }, 
          { name: { $regex: new RegExp(`^${name.trim()}$`, "i") } },
          { website: req.websiteId },
          { deleted: { $ne: true } }
        ]
      })

      if (existingColor) {
        return res.status(400).json({ msg: "Color name already exists" })
      }
    }

    if (req.file) {
      try {
        color.image = await uploadLocalFileToCloudinary(req.file.path, { folder: "photuprint/colors" })
      } catch (e) {
        removeLocalFiles([req.file])
        return res.status(503).json({ msg: e.message || "Image upload failed. Configure Cloudinary." })
      }
    }

    // Update fields
    if (name && name.trim() !== color.name) {
      color.name = name.trim()
    }

    if (code !== undefined) {
      color.code = (code && typeof code === "string" && code.trim()) ? code.trim() : null
    }

    if (isActive !== undefined) {
      color.isActive = isActive === "true" ? true : isActive === true ? true : false
    }

    const updatedColor = await color.save()
    res.json(updatedColor)
  } catch (error) {
    console.error("Error updating color:", error)
    res.status(500).json({ msg: "Failed to update color" })
  }
}

// Delete color (soft delete)
export const deleteColor = async (req, res) => {
  try {
    // Multi-tenant: Require website context
    if (!req.websiteId) {
      return res.status(400).json({ msg: 'Website context is missing. Please select a website first.' });
    }

    const color = await Color.findOne({ _id: req.params.id, website: req.websiteId })
    if (!color) {
      return res.status(404).json({ msg: "Color not found" })
    }

    // Mark as deleted and inactive
    color.isActive = false
    color.deleted = true
    await color.save()

    res.json({ msg: "Color marked as deleted and inactive" })
  } catch (error) {
    console.error("Error deleting color:", error)
    res.status(500).json({ msg: "Failed to delete color" })
  }
}

// Hard delete color
export const hardDeleteColor = async (req, res) => {
  try {
    // Multi-tenant: Require website context
    if (!req.websiteId) {
      return res.status(400).json({ msg: 'Website context is missing. Please select a website first.' });
    }

    const color = await Color.findOneAndDelete({ _id: req.params.id, website: req.websiteId })
    if (!color) {
      return res.status(404).json({ msg: "Color not found" })
    }

    res.json({ msg: "Color permanently deleted" })
  } catch (error) {
    console.error("Error deleting color:", error)
    res.status(500).json({ msg: "Failed to delete color" })
  }
}
