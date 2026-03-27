import Size from "../models/size.model.js"
import { tenantCloudinaryUpload } from "../utils/cloudinary.js"

// Get all sizes
export const getSizes = async (req, res) => {
  try {
    // Multi-tenant: Require website context
    if (!req.websiteId) {
      return res.status(400).json({ msg: 'Website context is missing' });
    }

    const { search, isActive, showInactive = "true", includeDeleted = "true" } = req.query
    let query = {
      website: req.websiteId // Multi-tenant: Filter by website
    }

    // Always include deleted sizes by default, but allow filtering
    if (includeDeleted === "false") {
      query.deleted = false
    }

    if (showInactive === "false") {
      query.isActive = true
    } else if (isActive !== undefined) {
      query.isActive = isActive === "true"
    }

    if (search) {
      query.$or = [{ name: { $regex: search, $options: "i" } }, { initial: { $regex: search, $options: "i" } }, { description: { $regex: search, $options: "i" } }]
    }

    const sizes = await Size.find(query).sort({ createdAt: -1 })
    res.json(sizes)
  } catch (error) {
    console.error("Error fetching sizes:", error)
    res.status(500).json({ msg: "Failed to fetch sizes" })
  }
}

// Get single size by ID
export const getSizeById = async (req, res) => {
  try {
    // Multi-tenant: Require website context
    if (!req.websiteId) {
      return res.status(400).json({ msg: 'Website context is missing' });
    }

    const size = await Size.findOne({ _id: req.params.id, website: req.websiteId })
    if (!size) {
      return res.status(404).json({ msg: "Size not found" })
    }
    res.json(size)
  } catch (error) {
    console.error("Error fetching size:", error)
    res.status(500).json({ msg: "Failed to fetch size" })
  }
}

// Create new size
export const createSize = async (req, res) => {
  try {
    // Multi-tenant: Require website context
    if (!req.websiteId) {
      return res.status(400).json({ msg: 'Website context is missing. Please select a website first.' });
    }

    console.log("Create size request body:", req.body)
    console.log("Uploaded file:", req.file)

    const { name, initial, description, dimensions } = req.body
    let { isActive = true } = req.body

    // Convert string "true"/"false" to boolean (for FormData)
    if (typeof isActive === "string") {
      isActive = isActive === "true"
    }

    if (!name || !name.trim()) {
      return res.status(400).json({ msg: "Size name is required" })
    }

    // Check if size with same name already exists within the same website
    const existingSizeByName = await Size.findOne({
      name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
      website: req.websiteId,
      deleted: { $ne: true }
    })

    if (existingSizeByName) {
      return res.status(400).json({ msg: "Size name already exists" })
    }

    // Check if size with same initial already exists (only when initial is provided)
    const initialTrimmed = (initial && typeof initial === "string" && initial.trim()) ? initial.trim() : null
    if (initialTrimmed) {
      const existingSizeByInitial = await Size.findOne({
        initial: { $regex: new RegExp(`^${initialTrimmed}$`, "i") },
        website: req.websiteId,
        deleted: { $ne: true }
      })
      if (existingSizeByInitial) {
        return res.status(400).json({ msg: "Size initial already exists" })
      }
    }

    // Handle image upload
    let imageUrl = null
    if (req.file) {
      imageUrl = await tenantCloudinaryUpload(req.websiteId, req.file, { folder: "photuprint/sizes" })
    }

    const size = new Size({
      name: name.trim(),
      initial: initialTrimmed,
      dimensions: dimensions?.trim() || null,
      description: description?.trim() || null,
      image: imageUrl,
      isActive,
      website: req.websiteId // Multi-tenant: Set website
    })

    const savedSize = await size.save()
    res.status(201).json(savedSize)
  } catch (error) {
    console.error("Error creating size:", error)
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0]
      return res.status(400).json({ msg: `Size ${field} already exists` })
    }
    res.status(500).json({ msg: "Failed to create size", error: error.message })
  }
}

// Update size
export const updateSize = async (req, res) => {
  try {
    // Multi-tenant: Require website context
    if (!req.websiteId) {
      return res.status(400).json({ msg: 'Website context is missing. Please select a website first.' });
    }

    console.log("Update size request body:", req.body)

    const { name, initial, description, dimensions } = req.body
    let { isActive } = req.body

    // Convert string "true"/"false" to boolean (for FormData)
    if (typeof isActive === "string") {
      isActive = isActive === "true"
    }

    // Check if size exists within the same website
    const size = await Size.findOne({ _id: req.params.id, website: req.websiteId })
    if (!size) {
      return res.status(404).json({ msg: "Size not found" })
    }

    // Check for duplicate names within the same website (excluding current size)
    if (name && name.trim() !== size.name) {
      const existingSize = await Size.findOne({
        _id: { $ne: req.params.id },
        name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
        website: req.websiteId,
        deleted: { $ne: true }
      })

      if (existingSize) {
        return res.status(400).json({ msg: "Size name already exists" })
      }
    }

    // Check for duplicate initials within the same website (excluding current size)
    if (initial && initial.trim() !== size.initial) {
      const existingSize = await Size.findOne({
        _id: { $ne: req.params.id },
        initial: { $regex: new RegExp(`^${initial.trim()}$`, "i") },
        website: req.websiteId,
        deleted: { $ne: true }
      })

      if (existingSize) {
        return res.status(400).json({ msg: "Size initial already exists" })
      }
    }

    // Update fields
    if (name && name.trim() !== size.name) {
      size.name = name.trim()
    }

    if (initial && initial.trim() !== size.initial) {
      size.initial = initial.trim()
    }

    if (description !== undefined) {
      size.description = description?.trim() || null
    }

    if (dimensions !== undefined) {
      size.dimensions = dimensions?.trim() || null
    }

    if (isActive !== undefined) {
      size.isActive = isActive
    }

    // Handle deleted field update (for reverting deleted sizes)
    if (req.body.deleted !== undefined) {
      size.deleted = req.body.deleted
    }

    // Handle image upload
    if (req.file) {
      size.image = await tenantCloudinaryUpload(req.websiteId, req.file, { folder: "photuprint/sizes" })
    }

    const updatedSize = await size.save()
    res.json(updatedSize)
  } catch (error) {
    console.error("Error updating size:", error)
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0]
      return res.status(400).json({ msg: `Size ${field} already exists` })
    }
    res.status(500).json({ msg: "Failed to update size", error: error.message })
  }
}

// Delete size (soft delete)
export const deleteSize = async (req, res) => {
  try {
    // Multi-tenant: Require website context
    if (!req.websiteId) {
      return res.status(400).json({ msg: 'Website context is missing. Please select a website first.' });
    }

    const size = await Size.findOne({ _id: req.params.id, website: req.websiteId })
    if (!size) {
      return res.status(404).json({ msg: "Size not found" })
    }

    // Soft delete: mark as inactive and set deleted flag
    size.isActive = false
    size.deleted = true
    await size.save()

    res.json({ msg: "Size deleted successfully" })
  } catch (error) {
    console.error("Error deleting size:", error)
    res.status(500).json({ msg: "Failed to delete size" })
  }
}

// Hard delete size
export const hardDeleteSize = async (req, res) => {
  try {
    // Multi-tenant: Require website context
    if (!req.websiteId) {
      return res.status(400).json({ msg: 'Website context is missing. Please select a website first.' });
    }

    const size = await Size.findOneAndDelete({ _id: req.params.id, website: req.websiteId })
    if (!size) {
      return res.status(404).json({ msg: "Size not found" })
    }

    res.json({ msg: "Size permanently deleted" })
  } catch (error) {
    console.error("Error deleting size:", error)
    res.status(500).json({ msg: "Failed to delete size" })
  }
}
