import Width from "../models/width.model.js"

// Get all widths
export const getWidths = async (req, res) => {
  try {
    // Multi-tenant: Filter by website
    if (!req.websiteId) {
      return res.status(400).json({ msg: 'Website context is missing' });
    }
    const { search, isActive, showInactive = "true", includeDeleted = "true" } = req.query
    let query = {
      website: req.websiteId, // Multi-tenant: Set website
    }

    // Always include deleted widths by default, but allow filtering
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

    const widths = await Width.find(query).sort({ createdAt: -1 })
    res.json(widths)
  } catch (error) {
    console.error("Error fetching widths:", error)
    res.status(500).json({ msg: "Failed to fetch widths" })
  }
}

// Get single width by ID
export const getWidthById = async (req, res) => {
  try {
    const width = await Width.findById(req.params.id)
    if (!width) {
      return res.status(404).json({ msg: "Width not found" })
    }
    res.json(width)
  } catch (error) {
    console.error("Error fetching width:", error)
    res.status(500).json({ msg: "Failed to fetch width" })
  }
}

// Create new width
export const createWidth = async (req, res) => {
  try {
    console.log("Create width request body:", req.body)

    const { name, unit, description } = req.body
    let { isActive = true } = req.body

    // Convert string "true"/"false" to boolean (for FormData)
    if (typeof isActive === "string") {
      isActive = isActive === "true"
    }

    if (name === undefined || isNaN(name)) {
      return res.status(400).json({ msg: "Width value must be a number" })
    }

    // Check if width with same name and unit already exists
    const existingWidth = await Width.findOne({
      name: Number(name),
      unit: unit || 'centimeters',
      deleted: false,
    })

    if (existingWidth) {
      return res.status(400).json({ msg: `Width value ${name} with unit ${unit || 'centimeters'} already exists` })
    }

    const width = new Width({
      name: Number(name),
      unit: unit || 'centimeters',
      description: description?.trim() || null,
      isActive,
      website: req.websiteId // Multi-tenant: Set website
    })

    console.log("Saving width to database:", {
      name: width.name,
      unit: width.unit,
      description: width.description,
      isActive: width.isActive,
    })

    const savedWidth = await width.save()
    console.log("Width saved successfully:", savedWidth._id)
    res.status(201).json(savedWidth)
  } catch (error) {
    console.error("Error creating width:", error)
    console.error("Error details:", {
      message: error.message,
      code: error.code,
      name: error.name,
      stack: error.stack,
    })
    if (error.code === 11000) {
      return res.status(400).json({ msg: "Width name already exists" })
    }
    if (error.name === "ValidationError") {
      const validationErrors = Object.values(error.errors)
        .map((err) => err.message)
        .join(", ")
      return res.status(400).json({ msg: `Validation error: ${validationErrors}` })
    }
    res.status(500).json({ msg: "Failed to create width", error: error.message })
  }
}

// Update width
export const updateWidth = async (req, res) => {
  try {
    console.log("Update width request body:", req.body)

    const { name, unit, description, isActive, deleted } = req.body

    const width = await Width.findById(req.params.id)
    if (!width) {
      return res.status(404).json({ msg: "Width not found" })
    }

    // Check for duplicate names with same unit (excluding current width)
    if (name !== undefined || unit !== undefined) {
      const checkName = name !== undefined ? Number(name) : width.name
      const checkUnit = unit !== undefined ? unit : width.unit
      
      // Only check if name or unit is actually changing
      if (checkName !== width.name || checkUnit !== width.unit) {
        const existingWidth = await Width.findOne({
          _id: { $ne: req.params.id },
          name: checkName,
          unit: checkUnit,
          deleted: false
        })

        if (existingWidth) {
          return res.status(400).json({ 
            msg: `Width value ${checkName} with unit ${checkUnit} already exists` 
          })
        }
      }
    }

    if (name !== undefined) width.name = Number(name)
    if (unit !== undefined) width.unit = unit
    if (description !== undefined) width.description = description
    if (isActive !== undefined) width.isActive = isActive
    if (deleted !== undefined) width.deleted = deleted

    const updatedWidth = await width.save()
    res.json(updatedWidth)
  } catch (error) {
    console.error("Error updating width:", error)
    if (error.code === 11000) {
      return res.status(400).json({ msg: "Width name already exists" })
    }
    res.status(500).json({ msg: "Failed to update width", error: error.message })
  }
}

// Delete width (soft delete)
export const deleteWidth = async (req, res) => {
  try {
    const width = await Width.findById(req.params.id)
    if (!width) {
      return res.status(404).json({ msg: "Width not found" })
    }

    // Soft delete: mark as inactive and set deleted flag
    width.isActive = false
    width.deleted = true
    await width.save()

    res.json({ msg: "Width deleted successfully" })
  } catch (error) {
    console.error("Error deleting width:", error)
    res.status(500).json({ msg: "Failed to delete width" })
  }
}

// Hard delete width
export const hardDeleteWidth = async (req, res) => {
  try {
    const width = await Width.findByIdAndDelete(req.params.id)
    if (!width) {
      return res.status(404).json({ msg: "Width not found" })
    }

    res.json({ msg: "Width permanently deleted" })
  } catch (error) {
    console.error("Error deleting width:", error)
    res.status(500).json({ msg: "Failed to delete width" })
  }
}
