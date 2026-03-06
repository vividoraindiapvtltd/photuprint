import PrintingType from "../models/printingType.model.js"

export const getPrintingTypes = async (req, res) => {
  try {
    if (!req.websiteId) {
      return res.status(400).json({ msg: "Website context is missing" })
    }
    const { search, isActive, includeDeleted = "true" } = req.query
    const query = { website: req.websiteId }
    if (includeDeleted === "false") query.deleted = false
    if (isActive !== undefined) query.isActive = isActive === "true"
    if (search) query.name = { $regex: search, $options: "i" }
    const list = await PrintingType.find(query).sort({ createdAt: -1 })
    res.json(list)
  } catch (error) {
    console.error("Error fetching printing types:", error)
    res.status(500).json({ msg: "Failed to fetch printing types" })
  }
}

export const getPrintingTypeById = async (req, res) => {
  try {
    if (!req.websiteId) {
      return res.status(400).json({ msg: "Website context is missing" })
    }
    const doc = await PrintingType.findOne({ _id: req.params.id, website: req.websiteId })
    if (!doc) return res.status(404).json({ msg: "Printing type not found" })
    res.json(doc)
  } catch (error) {
    console.error("Error fetching printing type:", error)
    res.status(500).json({ msg: "Failed to fetch printing type" })
  }
}

export const createPrintingType = async (req, res) => {
  try {
    if (!req.websiteId) {
      return res.status(400).json({ msg: "Website context is missing" })
    }
    const { name, description } = req.body
    let { isActive = true } = req.body
    if (typeof isActive === "string") isActive = isActive === "true"
    if (!name || !name.trim()) {
      return res.status(400).json({ msg: "Printing type name is required" })
    }
    const existing = await PrintingType.findOne({
      name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
      website: req.websiteId,
      deleted: false,
    })
    if (existing) {
      return res.status(400).json({ msg: "Printing type name already exists" })
    }
    const doc = await PrintingType.create({
      name: name.trim(),
      description: description?.trim() || null,
      isActive,
      website: req.websiteId,
    })
    res.status(201).json(doc)
  } catch (error) {
    console.error("Error creating printing type:", error)
    if (error.code === 11000) {
      res.status(400).json({ msg: "Printing type name already exists" })
    } else {
      res.status(500).json({ msg: "Failed to create printing type" })
    }
  }
}

export const updatePrintingType = async (req, res) => {
  try {
    if (!req.websiteId) {
      return res.status(400).json({ msg: "Website context is missing" })
    }
    const { name, description } = req.body
    let { isActive, deleted } = req.body
    if (typeof isActive === "string") isActive = isActive === "true"
    if (typeof deleted === "string") deleted = deleted === "true"
    const doc = await PrintingType.findOne({ _id: req.params.id, website: req.websiteId })
    if (!doc) return res.status(404).json({ msg: "Printing type not found" })
    if (name && name.trim() !== doc.name) {
      const existing = await PrintingType.findOne({
        name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
        _id: { $ne: req.params.id },
        website: req.websiteId,
        deleted: false,
      })
      if (existing) {
        return res.status(400).json({ msg: "Printing type name already exists" })
      }
      doc.name = name.trim()
    }
    if (description !== undefined) doc.description = description?.trim() || null
    if (isActive !== undefined) doc.isActive = isActive
    if (req.body.deleted !== undefined) doc.deleted = req.body.deleted
    await doc.save()
    res.json(doc)
  } catch (error) {
    console.error("Error updating printing type:", error)
    if (error.code === 11000) {
      res.status(400).json({ msg: "Printing type name already exists" })
    } else {
      res.status(500).json({ msg: "Failed to update printing type" })
    }
  }
}

export const deletePrintingType = async (req, res) => {
  try {
    const doc = await PrintingType.findOne({ _id: req.params.id, website: req.websiteId })
    if (!doc) return res.status(404).json({ msg: "Printing type not found" })
    doc.isActive = false
    doc.deleted = true
    await doc.save()
    res.json({ msg: "Printing type deleted successfully" })
  } catch (error) {
    console.error("Error deleting printing type:", error)
    res.status(500).json({ msg: "Failed to delete printing type" })
  }
}

export const hardDeletePrintingType = async (req, res) => {
  try {
    const doc = await PrintingType.findOneAndDelete({ _id: req.params.id, website: req.websiteId })
    if (!doc) return res.status(404).json({ msg: "Printing type not found" })
    res.json({ msg: "Printing type permanently deleted" })
  } catch (error) {
    console.error("Error hard deleting printing type:", error)
    res.status(500).json({ msg: "Failed to delete printing type" })
  }
}
