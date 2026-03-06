import Element from "../models/element.model.js"

export const getElements = async (req, res) => {
  try {
    if (!req.websiteId) {
      return res.status(400).json({ msg: "Website context is missing" })
    }
    const { search, type, includeDeleted = "false" } = req.query
    const query = { website: req.websiteId }
    if (includeDeleted === "false") query.deleted = false
    if (type) query.type = type
    if (search) query.name = { $regex: search, $options: "i" }
    const elements = await Element.find(query).sort({ createdAt: -1 })
    res.json(elements)
  } catch (error) {
    console.error("Error fetching elements:", error)
    res.status(500).json({ msg: "Failed to fetch elements" })
  }
}

export const getElementById = async (req, res) => {
  try {
    if (!req.websiteId) {
      return res.status(400).json({ msg: "Website context is missing" })
    }
    const el = await Element.findOne({ _id: req.params.id, website: req.websiteId })
    if (!el) return res.status(404).json({ msg: "Element not found" })
    res.json(el)
  } catch (error) {
    console.error("Error fetching element:", error)
    res.status(500).json({ msg: "Failed to fetch element" })
  }
}

export const createElement = async (req, res) => {
  try {
    if (!req.websiteId) {
      return res.status(400).json({ msg: "Website context is missing" })
    }
    const { name, type, description, isActive } = req.body
    if (!name || !name.trim()) {
      return res.status(400).json({ msg: "Element name is required" })
    }
    const imageUrl = req.file?.path
      ? `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`
      : null
    const element = await Element.create({
      name: name.trim(),
      type: type === "text" || type === "image" || type === "shape" ? type : "image",
      description: description ? description.trim() : "",
      image: imageUrl,
      website: req.websiteId,
      isActive: isActive !== "false" && isActive !== false,
    })
    res.status(201).json(element)
  } catch (error) {
    console.error("Error creating element:", error)
    res.status(500).json({ msg: "Failed to create element" })
  }
}

export const updateElement = async (req, res) => {
  try {
    if (!req.websiteId) {
      return res.status(400).json({ msg: "Website context is missing" })
    }
    const el = await Element.findOne({ _id: req.params.id, website: req.websiteId })
    if (!el) return res.status(404).json({ msg: "Element not found" })
    const { name, type, description, isActive } = req.body || {}
    if (name !== undefined) {
      const trimmed = (name || "").trim()
      if (!trimmed) return res.status(400).json({ msg: "Element name cannot be empty" })
      el.name = trimmed
    }
    if (type !== undefined && ["text", "image", "shape"].includes(type)) el.type = type
    if (description !== undefined) el.description = (description || "").trim()
    if (isActive !== undefined) el.isActive = isActive === true || isActive === "true"
    if (req.file?.path) el.image = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`
    await el.save()
    res.json(el)
  } catch (error) {
    console.error("Error updating element:", error)
    res.status(500).json({ msg: "Failed to update element" })
  }
}

export const deleteElement = async (req, res) => {
  try {
    if (!req.websiteId) {
      return res.status(400).json({ msg: "Website context is missing" })
    }
    const el = await Element.findOne({ _id: req.params.id, website: req.websiteId })
    if (!el) return res.status(404).json({ msg: "Element not found" })
    el.deleted = true
    el.isActive = false
    await el.save()
    res.json({ msg: "Element deleted successfully" })
  } catch (error) {
    console.error("Error deleting element:", error)
    res.status(500).json({ msg: "Failed to delete element" })
  }
}
