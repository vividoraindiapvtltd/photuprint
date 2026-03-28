import Gsm from "../models/gsm.model.js"

export const getGsms = async (req, res) => {
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

    const gsms = await Gsm.find(query).sort({ createdAt: -1 })
    res.json(gsms)
  } catch (error) {
    console.error("Error fetching GSM entries:", error)
    res.status(500).json({ msg: "Failed to fetch GSM entries" })
  }
}

export const getGsmById = async (req, res) => {
  try {
    if (!req.websiteId) {
      return res.status(400).json({ msg: "Website context is missing" })
    }
    const row = await Gsm.findOne({ _id: req.params.id, website: req.websiteId })
    if (!row) {
      return res.status(404).json({ msg: "GSM entry not found" })
    }
    res.json(row)
  } catch (error) {
    console.error("Error fetching GSM:", error)
    res.status(500).json({ msg: "Failed to fetch GSM entry" })
  }
}

export const createGsm = async (req, res) => {
  try {
    const { name, description } = req.body
    let { isActive = true } = req.body

    if (typeof isActive === "string") {
      isActive = isActive === "true"
    }

    if (!name || !name.trim()) {
      return res.status(400).json({ msg: "GSM name is required" })
    }

    const existing = await Gsm.findOne({
      name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
      website: req.websiteId,
      deleted: false,
    })

    if (existing) {
      return res.status(400).json({ msg: "GSM name already exists" })
    }

    const row = new Gsm({
      name: name.trim(),
      description: description?.trim() || null,
      isActive,
      website: req.websiteId,
    })

    const saved = await row.save()
    res.status(201).json(saved)
  } catch (error) {
    console.error("Error creating GSM:", error)
    if (error.code === 11000) {
      res.status(400).json({ msg: "GSM name already exists" })
    } else {
      res.status(500).json({ msg: "Failed to create GSM entry" })
    }
  }
}

export const updateGsm = async (req, res) => {
  try {
    const { name, description } = req.body
    let { isActive, deleted } = req.body

    if (typeof isActive === "string") {
      isActive = isActive === "true"
    }
    if (typeof deleted === "string") {
      deleted = deleted === "true"
    }

    const row = await Gsm.findOne({ _id: req.params.id, website: req.websiteId })
    if (!row) {
      return res.status(404).json({ msg: "GSM entry not found" })
    }

    if (name && name.trim() !== row.name) {
      const existing = await Gsm.findOne({
        name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
        _id: { $ne: req.params.id },
        website: req.websiteId,
        deleted: false,
      })

      if (existing) {
        return res.status(400).json({ msg: "GSM name already exists" })
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
    console.error("Error updating GSM:", error)
    if (error.code === 11000) {
      res.status(400).json({ msg: "GSM name already exists" })
    } else {
      res.status(500).json({ msg: "Failed to update GSM entry" })
    }
  }
}

export const deleteGsm = async (req, res) => {
  try {
    const row = await Gsm.findOne({ _id: req.params.id, website: req.websiteId })
    if (!row) {
      return res.status(404).json({ msg: "GSM entry not found" })
    }

    row.isActive = false
    row.deleted = true
    await row.save()

    res.json({ msg: "GSM entry deleted successfully" })
  } catch (error) {
    console.error("Error deleting GSM:", error)
    res.status(500).json({ msg: "Failed to delete GSM entry" })
  }
}

export const hardDeleteGsm = async (req, res) => {
  try {
    const row = await Gsm.findOneAndDelete({ _id: req.params.id, website: req.websiteId })
    if (!row) {
      return res.status(404).json({ msg: "GSM entry not found" })
    }

    res.json({ msg: "GSM entry permanently deleted" })
  } catch (error) {
    console.error("Error hard deleting GSM:", error)
    res.status(500).json({ msg: "Failed to delete GSM entry" })
  }
}
