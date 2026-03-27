import PinCode from "../models/pinCode.model.js"
import { tenantCloudinaryUpload } from "../utils/cloudinary.js"

// Get all pin codes
export const getPinCodes = async (req, res) => {
  try {
    // Multi-tenant: Filter by website
    if (!req.websiteId) {
      return res.status(400).json({ msg: 'Website context is missing' });
    }
console.log("Fetching pin codes with query:", req.query)
    const { search, isActive, showInactive = "true", includeDeleted = "true" } = req.query
    let query = {
      website: req.websiteId, // Multi-tenant: Set website
      // Filter by tenant website
    };

    // Always include deleted pin codes by default, but allow filtering
    if (includeDeleted === "false") {
      query.deleted = false
    }

    if (showInactive === "false") {
      query.isActive = true
    } else if (isActive !== undefined) {
      query.isActive = isActive === "true"
    }

    if (search) {
      query.$or = [{ name: { $regex: search, $options: "i" } }, { description: { $regex: search, $options: "i" } }, { state: { $regex: search, $options: "i" } }, { district: { $regex: search, $options: "i" } }]
    }

    console.log("MongoDB query:", JSON.stringify(query, null, 2))
    const pinCodes = await PinCode.find(query).sort({ createdAt: -1 })
    console.log(`Found ${pinCodes.length} pin codes`)
    res.json(pinCodes)
  } catch (error) {
    console.error("Error fetching pin codes:", error)
    console.error("Error stack:", error.stack)
    res.status(500).json({ msg: "Failed to fetch pin codes", error: error.message })
  }
}

// Get single pin code by ID
export const getPinCodeById = async (req, res) => {
  try {
    // Multi-tenant: Filter by website
    if (!req.websiteId) {
      return res.status(400).json({ msg: 'Website context is missing' });
    }
const pinCode = await PinCode.findOne({ _id: req.params.id, website: req.websiteId })
    if (!pinCode) {
      return res.status(404).json({ msg: "Pin code not found" })
    }
    res.json(pinCode)
  } catch (error) {
    console.error("Error fetching pin code:", error)
    res.status(500).json({ msg: "Failed to fetch pin code" })
  }
}

// Create new pin code
export const createPinCode = async (req, res) => {
  try {
    console.log("Create pin code request body:", req.body)
    console.log("Uploaded file:", req.file)

    const { name, description, state, district } = req.body
    let { isActive = true } = req.body

    // Convert string "true"/"false" to boolean (for FormData)
    if (typeof isActive === "string") {
      isActive = isActive === "true"
    }

    console.log("Processed isActive value:", isActive, "Type:", typeof isActive)

    if (!name || !name.trim()) {
      return res.status(400).json({ msg: "Pin code name is required" })
    }

    // Check if pin code with same name already exists within the same website
    const existingPinCode = await PinCode.findOne({
      name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
      website: req.websiteId,
      deleted: false
    })

    if (existingPinCode) {
      return res.status(400).json({ msg: "Pin code name already exists" })
    }

    // Handle image upload
    let imageUrl = null
    if (req.file) {
      imageUrl = await tenantCloudinaryUpload(req.websiteId, req.file, { folder: "photuprint/pincodes" })
    }

    const pinCode = new PinCode({
      name: name.trim(),
      description: description?.trim() || null,
      state: state?.trim() || null,
      district: district?.trim() || null,
      image: imageUrl,
      isActive,
      website: req.websiteId // Multi-tenant: Set website
    })

    const savedPinCode = await pinCode.save()
    res.status(201).json(savedPinCode)
  } catch (error) {
    console.error("Error creating pin code:", error)
    if (error.code === 11000) {
      return res.status(400).json({ msg: "Pin code name already exists" })
    }
    res.status(500).json({ msg: "Failed to create pin code" })
  }
}

// Update pin code
export const updatePinCode = async (req, res) => {
  try {
    console.log("Update pin code request body:", req.body)

    const { name, description, state, district } = req.body
    let { isActive } = req.body

    // Convert string "true"/"false" to boolean (for FormData)
    if (typeof isActive === "string") {
      isActive = isActive === "true"
    }

    console.log("Processed isActive value:", isActive, "Type:", typeof isActive)

    // Check if pin code exists
    const pinCode = await PinCode.findOne({ _id: req.params.id, website: req.websiteId })
    if (!pinCode) {
      return res.status(404).json({ msg: "Pin code not found" })
    }

    // Check for duplicate names (excluding current pin code) within the same website
    if (name && name.trim() !== pinCode.name) {
      const existingPinCode = await PinCode.findOne({
        $and: [
          { _id: { $ne: req.params.id } }, 
          { name: { $regex: new RegExp(`^${name.trim()}$`, "i") } },
          { website: req.websiteId },
          { deleted: false }
        ]
      })

      if (existingPinCode) {
        return res.status(400).json({ msg: "Pin code name already exists" })
      }
    }

    // Update fields
    if (name && name.trim() !== pinCode.name) {
      pinCode.name = name.trim()
    }

    if (description !== undefined) {
      pinCode.description = description?.trim() || null
    }

    if (state !== undefined) {
      pinCode.state = state?.trim() || null
    }

    if (district !== undefined) {
      pinCode.district = district?.trim() || null
    }

    if (isActive !== undefined) {
      pinCode.isActive = isActive
    }

    // Handle deleted field update (for reverting deleted pin codes)
    if (req.body.deleted !== undefined) {
      pinCode.deleted = req.body.deleted
    }

    // Handle image upload
    if (req.file) {
      pinCode.image = await tenantCloudinaryUpload(req.websiteId, req.file, { folder: "photuprint/pincodes" })
    }

    const updatedPinCode = await pinCode.save()
    res.json(updatedPinCode)
  } catch (error) {
    console.error("Error updating pin code:", error)
    if (error.code === 11000) {
      return res.status(400).json({ msg: "Pin code name already exists" })
    }
    res.status(500).json({ msg: "Failed to update pin code" })
  }
}

// Delete pin code (soft delete)
export const deletePinCode = async (req, res) => {
  try {
    const pinCode = await PinCode.findOne({ _id: req.params.id, website: req.websiteId })
    if (!pinCode) {
      return res.status(404).json({ msg: "Pin code not found" })
    }

    // Soft delete: mark as inactive and set deleted flag
    pinCode.isActive = false
    pinCode.deleted = true
    await pinCode.save()

    res.json({ msg: "Pin code deleted successfully" })
  } catch (error) {
    console.error("Error deleting pin code:", error)
    res.status(500).json({ msg: "Failed to delete pin code" })
  }
}

// Hard delete pin code
export const hardDeletePinCode = async (req, res) => {
  try {
    const pinCode = await PinCode.findOneAndDelete({ _id: req.params.id, website: req.websiteId })
    if (!pinCode) {
      return res.status(404).json({ msg: "Pin code not found" })
    }

    res.json({ msg: "Pin code permanently deleted" })
  } catch (error) {
    console.error("Error deleting pin code:", error)
    res.status(500).json({ msg: "Failed to delete pin code" })
  }
}
