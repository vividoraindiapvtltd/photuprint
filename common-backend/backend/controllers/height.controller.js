import Height from "../models/height.model.js"
import { removeLocalFile } from "../utils/fileCleanup.js"

// Get all heights
export const getHeights = async (req, res) => {
  try {
    // Multi-tenant: Filter by website
    if (!req.websiteId) {
      return res.status(400).json({ msg: 'Website context is missing' });
    }
    const { search, isActive, showInactive = "true", includeDeleted = "true" } = req.query
    let query = {
      website: req.websiteId, // Multi-tenant: Set website
    }

    // Always include deleted heights by default, but allow filtering
    if (includeDeleted === "false") {
      query.deleted = false
    }

    if (showInactive === "false") {
      query.isActive = true
    } else if (isActive !== undefined) {
      query.isActive = isActive === "true"
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { unit: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ]
    }

    const heights = await Height.find(query).sort({ createdAt: -1 })
    res.set("Cache-Control", "no-store, no-cache, must-revalidate");
    res.set("Pragma", "no-cache");
    res.json(heights)
  } catch (error) {
    console.error("Error fetching heights:", error)
    res.status(500).json({ msg: "Failed to fetch heights" })
  }
}

// Get single height by ID
export const getHeightById = async (req, res) => {
  try {
    // Multi-tenant: Filter by website
    if (!req.websiteId) {
      return res.status(400).json({ msg: 'Website context is missing' });
    }
    const height = await Height.findOne({ _id: req.params.id, website: req.websiteId })
    if (!height) {
      return res.status(404).json({ msg: "Height not found" })
    }
    res.json(height)
  } catch (error) {
    console.error("Error fetching height:", error)
    res.status(500).json({ msg: "Failed to fetch height" })
  }
}

// Create new height
export const createHeight = async (req, res) => {
  try {
    console.log("Create height request body:", req.body)
    console.log("Uploaded file:", req.file)

    const { name, unit, description } = req.body
    let { isActive = true } = req.body

    // Convert string "true"/"false" to boolean (for FormData)
    if (typeof isActive === "string") {
      isActive = isActive === "true"
    }

    if (!name || !name.trim()) {
      return res.status(400).json({ msg: "Height name is required" })
    }

    // Check if height with same name and unit already exists within the same website
    const existingHeight = await Height.findOne({
      name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
      unit: unit || 'centimeters',
      website: req.websiteId,
      deleted: false,
    })

    if (existingHeight) {
      return res.status(400).json({ msg: `Height value ${name.trim()} with unit ${unit || 'centimeters'} already exists` })
    }

    // Handle image upload
    let imageUrl = null
    if (req.file) {
      try {
        // Upload to Cloudinary
        const cloudinary = (await import("../utils/cloudinary.js")).default
        const result = await cloudinary.uploader.upload(req.file.path, {
          folder: "photuprint/heights",
          resource_type: "auto",
        })
        imageUrl = result.secure_url
        removeLocalFile(req.file.path)
        console.log("Image uploaded to Cloudinary:", imageUrl)
      } catch (uploadError) {
        console.error("Cloudinary upload failed:", uploadError)
        console.error("Upload error details:", {
          message: uploadError.message,
          http_code: uploadError.http_code,
          name: uploadError.name,
        })
        // Fallback to local storage
        imageUrl = `/uploads/${req.file.filename}`
        console.log("Using local storage path:", imageUrl)
      }
    }

    const height = new Height({
      name: name.trim(),
      unit: unit || 'centimeters',
      description: description?.trim() || null,
      image: imageUrl,
      isActive,
      website: req.websiteId // Multi-tenant: Set website
    })

    console.log("Saving height to database:", {
      name: height.name,
      description: height.description,
      image: height.image,
      isActive: height.isActive,
    })

    const savedHeight = await height.save()
    console.log("Height saved successfully:", savedHeight._id)
    res.status(201).json(savedHeight)
  } catch (error) {
    console.error("Error creating height:", error)
    console.error("Error details:", {
      message: error.message,
      code: error.code,
      name: error.name,
      stack: error.stack,
    })
    if (error.code === 11000) {
      return res.status(400).json({ msg: "Height name already exists" })
    }
    if (error.name === "ValidationError") {
      const validationErrors = Object.values(error.errors)
        .map((err) => err.message)
        .join(", ")
      return res.status(400).json({ msg: `Validation error: ${validationErrors}` })
    }
    res.status(500).json({ msg: "Failed to create height", error: error.message })
  }
}

// Update height
export const updateHeight = async (req, res) => {
  try {
    console.log("Update height request body:", req.body)

    const { name, unit, description } = req.body
    let { isActive } = req.body

    // Convert string "true"/"false" to boolean (for FormData)
    if (typeof isActive === "string") {
      isActive = isActive === "true"
    }

    // Check if height exists within the same website
    const height = await Height.findOne({ _id: req.params.id, website: req.websiteId })
    if (!height) {
      return res.status(404).json({ msg: "Height not found" })
    }

    // Check for duplicate names with same unit (excluding current height)
    if (name && name.trim() !== height.name) {
      const existingHeight = await Height.findOne({
        $and: [
          { _id: { $ne: req.params.id } },
          { name: { $regex: new RegExp(`^${name.trim()}$`, "i") } },
          { unit: unit || height.unit || 'centimeters' },
          { deleted: false },
        ],
      })

      if (existingHeight) {
        return res.status(400).json({ msg: `Height value ${name.trim()} with unit ${unit || height.unit || 'centimeters'} already exists` })
      }
    }
    
    // Check for duplicate when unit changes but name stays the same
    if (unit && unit !== height.unit && name && name.trim() === height.name) {
      const existingHeight = await Height.findOne({
        $and: [
          { _id: { $ne: req.params.id } },
          { name: { $regex: new RegExp(`^${name.trim()}$`, "i") } },
          { unit: unit },
          { deleted: false },
        ],
      })

      if (existingHeight) {
        return res.status(400).json({ msg: `Height value ${name.trim()} with unit ${unit} already exists` })
      }
    }

    // Update fields
    if (name && name.trim() !== height.name) {
      height.name = name.trim()
    }

    if (unit !== undefined) {
      height.unit = unit
    }

    if (description !== undefined) {
      height.description = description?.trim() || null
    }

    if (isActive !== undefined) {
      height.isActive = isActive
    }

    // Handle deleted field update (for reverting deleted heights)
    if (req.body.deleted !== undefined) {
      height.deleted = req.body.deleted
    }

    // Handle image upload
    if (req.file) {
      try {
        // Upload to Cloudinary
        const cloudinary = (await import("../utils/cloudinary.js")).default
        const result = await cloudinary.uploader.upload(req.file.path, {
          folder: "photuprint/heights",
          resource_type: "auto",
        })
        height.image = result.secure_url
        removeLocalFile(req.file.path)
        console.log("Image updated in Cloudinary:", height.image)
      } catch (uploadError) {
        console.error("Cloudinary upload failed:", uploadError)
        // Fallback to local storage
        height.image = `/uploads/${req.file.filename}`
      }
    }

    const updatedHeight = await height.save()
    res.json(updatedHeight)
  } catch (error) {
    console.error("Error updating height:", error)
    if (error.code === 11000) {
      return res.status(400).json({ msg: "Height name already exists" })
    }
    res.status(500).json({ msg: "Failed to update height", error: error.message })
  }
}

// Delete height (soft delete)
export const deleteHeight = async (req, res) => {
  try {
    const height = await Height.findById(req.params.id)
    if (!height) {
      return res.status(404).json({ msg: "Height not found" })
    }

    // Soft delete: mark as inactive and set deleted flag
    height.isActive = false
    height.deleted = true
    await height.save()

    res.json({ msg: "Height deleted successfully" })
  } catch (error) {
    console.error("Error deleting height:", error)
    res.status(500).json({ msg: "Failed to delete height" })
  }
}

// Hard delete height
export const hardDeleteHeight = async (req, res) => {
  try {
    const height = await Height.findByIdAndDelete(req.params.id)
    if (!height) {
      return res.status(404).json({ msg: "Height not found" })
    }

    res.json({ msg: "Height permanently deleted" })
  } catch (error) {
    console.error("Error deleting height:", error)
    res.status(500).json({ msg: "Failed to delete height" })
  }
}

