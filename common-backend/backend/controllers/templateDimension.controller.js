import TemplateDimension, { UNITS } from "../models/templateDimension.model.js"

export const getTemplateDimensions = async (req, res) => {
  try {
    if (!req.websiteId) {
      return res.status(400).json({ msg: "Website context is missing" })
    }
    const { search, includeDeleted = "false" } = req.query
    // Include dimensions for this website OR legacy dimensions without website field
    const query = {
      $or: [
        { website: req.websiteId },
        { website: { $exists: false } },
        { website: null }
      ]
    }
    if (includeDeleted === "false") query.deleted = false
    if (search) query.name = { $regex: search, $options: "i" }
    const list = await TemplateDimension.find(query).sort({ name: 1 })
    res.json(list)
  } catch (error) {
    console.error("Error fetching template dimensions:", error)
    res.status(500).json({ msg: "Failed to fetch template dimensions" })
  }
}

export const getTemplateDimensionById = async (req, res) => {
  try {
    if (!req.websiteId) {
      return res.status(400).json({ msg: "Website context is missing" })
    }
    // Try by website first, then check for legacy dimensions without website
    let doc = await TemplateDimension.findOne({
      _id: req.params.id,
      website: req.websiteId,
    })
    if (!doc) {
      doc = await TemplateDimension.findOne({
        _id: req.params.id,
        $or: [{ website: { $exists: false } }, { website: null }]
      })
      // Assign website to legacy dimension for future tenant isolation
      if (doc) {
        doc.website = req.websiteId
        await doc.save()
      }
    }
    if (!doc) return res.status(404).json({ msg: "Template dimension not found" })
    res.json(doc)
  } catch (error) {
    console.error("Error fetching template dimension:", error)
    res.status(500).json({ msg: "Failed to fetch template dimension" })
  }
}

export const createTemplateDimension = async (req, res) => {
  try {
    if (!req.websiteId) {
      return res.status(400).json({ msg: "Website context is missing" })
    }
    const { name, slug, description, width, height, unit, dpi, bleed, safeAreaInset, shape, isActive } = req.body || {}
    if (!name || !name.trim()) {
      return res.status(400).json({ msg: "Name is required" })
    }
    const w = Number(width)
    const h = Number(height)
    if (Number.isNaN(w) || w <= 0 || Number.isNaN(h) || h <= 0) {
      return res.status(400).json({ msg: "Width and height must be positive numbers" })
    }
    const doc = await TemplateDimension.create({
      name: name.trim(),
      slug: (slug || "").trim(),
      description: (description || "").trim(),
      width: w,
      height: h,
      unit: UNITS.includes(unit) ? unit : "mm",
      dpi: Math.min(600, Math.max(72, Number(dpi) || 300)),
      bleed: Number(bleed) || 0,
      safeAreaInset: Number(safeAreaInset) || 0,
      shape: ["rectangle", "oval", "square", "custom"].includes(shape) ? shape : "rectangle",
      isActive: isActive !== "false" && isActive !== false,
      website: req.websiteId,
    })
    res.status(201).json(doc)
  } catch (error) {
    console.error("Error creating template dimension:", error)
    res.status(500).json({ msg: "Failed to create template dimension" })
  }
}

export const updateTemplateDimension = async (req, res) => {
  try {
    if (!req.websiteId) {
      return res.status(400).json({ msg: "Website context is missing" })
    }
    const doc = await TemplateDimension.findOne({
      _id: req.params.id,
      website: req.websiteId,
    })
    if (!doc) return res.status(404).json({ msg: "Template dimension not found" })
    const { name, slug, description, width, height, unit, dpi, bleed, safeAreaInset, shape, isActive } = req.body || {}
    if (name !== undefined) doc.name = (name || "").trim()
    if (slug !== undefined) doc.slug = (slug || "").trim()
    if (description !== undefined) doc.description = (description || "").trim()
    if (width !== undefined) {
      const w = Number(width)
      if (!Number.isNaN(w) && w > 0) doc.width = w
    }
    if (height !== undefined) {
      const h = Number(height)
      if (!Number.isNaN(h) && h > 0) doc.height = h
    }
    if (unit !== undefined) doc.unit = UNITS.includes(unit) ? unit : "mm"
    if (dpi !== undefined) doc.dpi = Math.min(600, Math.max(72, Number(dpi) || 300))
    if (bleed !== undefined) doc.bleed = Number(bleed) || 0
    if (safeAreaInset !== undefined) doc.safeAreaInset = Number(safeAreaInset) || 0
    if (shape !== undefined) doc.shape = shape || "rectangle"
    if (isActive !== undefined) doc.isActive = isActive !== "false" && isActive !== false
    await doc.save()
    res.json(doc)
  } catch (error) {
    console.error("Error updating template dimension:", error)
    res.status(500).json({ msg: "Failed to update template dimension" })
  }
}

export const deleteTemplateDimension = async (req, res) => {
  try {
    if (!req.websiteId) {
      return res.status(400).json({ msg: "Website context is missing" })
    }
    const doc = await TemplateDimension.findOne({
      _id: req.params.id,
      website: req.websiteId,
    })
    if (!doc) return res.status(404).json({ msg: "Template dimension not found" })
    doc.deleted = true
    doc.isActive = false
    await doc.save()
    res.json({ msg: "Template dimension deleted successfully" })
  } catch (error) {
    console.error("Error deleting template dimension:", error)
    res.status(500).json({ msg: "Failed to delete template dimension" })
  }
}
