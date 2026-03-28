import Capacity from "../models/capacity.model.js"

export const getCapacities = async (req, res) => {
  try {
    if (!req.websiteId) {
      return res.status(400).json({ msg: "Website context is missing" })
    }
    const { search, isActive, includeDeleted = "true" } = req.query
    let query = { website: req.websiteId }

    if (includeDeleted === "false") {
      query.deleted = false
    }

    if (isActive !== undefined) {
      query.isActive = isActive === "true"
    }

    if (search) {
      query.name = { $regex: search, $options: "i" }
    }

    const capacities = await Capacity.find(query).sort({ createdAt: -1 })
    res.json(capacities)
  } catch (error) {
    console.error("Error fetching capacities:", error)
    res.status(500).json({ msg: "Failed to fetch capacities" })
  }
}

export const getCapacityById = async (req, res) => {
  try {
    if (!req.websiteId) {
      return res.status(400).json({ msg: "Website context is missing" })
    }
    const row = await Capacity.findOne({ _id: req.params.id, website: req.websiteId })
    if (!row) {
      return res.status(404).json({ msg: "Capacity not found" })
    }
    res.json(row)
  } catch (error) {
    console.error("Error fetching capacity:", error)
    res.status(500).json({ msg: "Failed to fetch capacity" })
  }
}

export const createCapacity = async (req, res) => {
  try {
    const { name, description } = req.body
    let { isActive = true } = req.body

    if (typeof isActive === "string") {
      isActive = isActive === "true"
    }

    if (!name || !name.trim()) {
      return res.status(400).json({ msg: "Capacity name is required" })
    }

    const existing = await Capacity.findOne({
      name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
      website: req.websiteId,
      deleted: false,
    })

    if (existing) {
      return res.status(400).json({ msg: "Capacity name already exists" })
    }

    const row = new Capacity({
      name: name.trim(),
      description: description?.trim() || null,
      isActive,
      website: req.websiteId,
    })

    const saved = await row.save()
    res.status(201).json(saved)
  } catch (error) {
    console.error("Error creating capacity:", error)
    if (error.code === 11000) {
      res.status(400).json({ msg: "Capacity name already exists" })
    } else {
      res.status(500).json({ msg: "Failed to create capacity" })
    }
  }
}

export const updateCapacity = async (req, res) => {
  try {
    const { name, description } = req.body
    let { isActive, deleted } = req.body

    if (typeof isActive === "string") {
      isActive = isActive === "true"
    }
    if (typeof deleted === "string") {
      deleted = deleted === "true"
    }

    const row = await Capacity.findOne({ _id: req.params.id, website: req.websiteId })
    if (!row) {
      return res.status(404).json({ msg: "Capacity not found" })
    }

    if (name && name.trim() !== row.name) {
      const existing = await Capacity.findOne({
        name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
        _id: { $ne: req.params.id },
        website: req.websiteId,
        deleted: false,
      })

      if (existing) {
        return res.status(400).json({ msg: "Capacity name already exists" })
      }
    }

    if (name && name.trim() !== row.name) {
      row.name = name.trim()
    }

    if (description !== undefined) {
      row.description = description?.trim() || null
    }

    if (isActive !== undefined) {
      row.isActive = isActive
    }

    if (req.body.deleted !== undefined) {
      row.deleted = req.body.deleted
    }

    const updated = await row.save()
    res.json(updated)
  } catch (error) {
    console.error("Error updating capacity:", error)
    if (error.code === 11000) {
      res.status(400).json({ msg: "Capacity name already exists" })
    } else {
      res.status(500).json({ msg: "Failed to update capacity" })
    }
  }
}

export const deleteCapacity = async (req, res) => {
  try {
    const row = await Capacity.findOne({ _id: req.params.id, website: req.websiteId })
    if (!row) {
      return res.status(404).json({ msg: "Capacity not found" })
    }

    row.isActive = false
    row.deleted = true
    await row.save()

    res.json({ msg: "Capacity deleted successfully" })
  } catch (error) {
    console.error("Error deleting capacity:", error)
    res.status(500).json({ msg: "Failed to delete capacity" })
  }
}

export const hardDeleteCapacity = async (req, res) => {
  try {
    const row = await Capacity.findOneAndDelete({ _id: req.params.id, website: req.websiteId })
    if (!row) {
      return res.status(404).json({ msg: "Capacity not found" })
    }

    res.json({ msg: "Capacity permanently deleted" })
  } catch (error) {
    console.error("Error hard deleting capacity:", error)
    res.status(500).json({ msg: "Failed to delete capacity" })
  }
}
