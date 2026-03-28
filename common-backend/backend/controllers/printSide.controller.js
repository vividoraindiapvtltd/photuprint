import PrintSide from "../models/printSide.model.js"
import { uploadLocalFileToCloudinary, removeLocalFiles } from "../utils/cloudinaryUpload.js"

export const getPrintSides = async (req, res) => {
  try {
    if (!req.websiteId) {
      return res.status(400).json({ msg: "Website context is missing" })
    }
    const { search, isActive, includeDeleted = "true" } = req.query
    const query = { website: req.websiteId }
    if (includeDeleted === "false") query.deleted = false
    if (isActive !== undefined) query.isActive = isActive === "true"
    if (search) query.name = { $regex: search, $options: "i" }
    const list = await PrintSide.find(query).sort({ sortOrder: 1, name: 1 })
    res.json(list)
  } catch (error) {
    console.error("Error fetching print sides:", error)
    res.status(500).json({ msg: "Failed to fetch print sides" })
  }
}

export const getPrintSideById = async (req, res) => {
  try {
    if (!req.websiteId) {
      return res.status(400).json({ msg: "Website context is missing" })
    }
    const doc = await PrintSide.findOne({ _id: req.params.id, website: req.websiteId })
    if (!doc) return res.status(404).json({ msg: "Print side not found" })
    res.json(doc)
  } catch (error) {
    console.error("Error fetching print side:", error)
    res.status(500).json({ msg: "Failed to fetch print side" })
  }
}

export const createPrintSide = async (req, res) => {
  try {
    if (!req.websiteId) {
      return res.status(400).json({ msg: "Website context is missing" })
    }
    const { name, description } = req.body
    let { isActive = true, sortOrder = 0 } = req.body
    if (typeof isActive === "string") isActive = isActive === "true"
    sortOrder = Number(sortOrder)
    if (!Number.isFinite(sortOrder)) sortOrder = 0
    if (!name || !name.trim()) {
      return res.status(400).json({ msg: "Print side name is required" })
    }
    const existing = await PrintSide.findOne({
      name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
      website: req.websiteId,
      deleted: false,
    })
    if (existing) {
      return res.status(400).json({ msg: "Print side name already exists" })
    }
    let imageUrl = null
    if (req.file) {
      try {
        imageUrl = await uploadLocalFileToCloudinary(req.file.path, { folder: "photuprint/print-sides" })
      } catch (e) {
        removeLocalFiles([req.file])
        return res.status(503).json({ msg: e.message || "Image upload failed. Configure Cloudinary." })
      }
    }
    const doc = await PrintSide.create({
      name: name.trim(),
      description: description?.trim() || null,
      image: imageUrl,
      sortOrder,
      isActive,
      website: req.websiteId,
    })
    res.status(201).json(doc)
  } catch (error) {
    console.error("Error creating print side:", error)
    if (error.code === 11000) {
      res.status(400).json({ msg: "Print side name already exists" })
    } else {
      res.status(500).json({ msg: "Failed to create print side" })
    }
  }
}

export const updatePrintSide = async (req, res) => {
  try {
    if (!req.websiteId) {
      return res.status(400).json({ msg: "Website context is missing" })
    }
    const { name, description, sortOrder } = req.body
    let { isActive, deleted } = req.body
    if (typeof isActive === "string") isActive = isActive === "true"
    if (typeof deleted === "string") deleted = deleted === "true"
    const doc = await PrintSide.findOne({ _id: req.params.id, website: req.websiteId })
    if (!doc) return res.status(404).json({ msg: "Print side not found" })
    if (name && name.trim() !== doc.name) {
      const existing = await PrintSide.findOne({
        name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
        _id: { $ne: req.params.id },
        website: req.websiteId,
        deleted: false,
      })
      if (existing) {
        return res.status(400).json({ msg: "Print side name already exists" })
      }
      doc.name = name.trim()
    }
    if (description !== undefined) doc.description = description?.trim() || null
    if (req.file) {
      try {
        doc.image = await uploadLocalFileToCloudinary(req.file.path, { folder: "photuprint/print-sides" })
      } catch (e) {
        removeLocalFiles([req.file])
        return res.status(503).json({ msg: e.message || "Image upload failed. Configure Cloudinary." })
      }
    } else if (req.body.removeImage === "true" || req.body.removeImage === true) {
      doc.image = null
    }
    if (sortOrder !== undefined) {
      const n = Number(sortOrder)
      doc.sortOrder = Number.isFinite(n) ? n : doc.sortOrder
    }
    if (isActive !== undefined) doc.isActive = isActive
    if (req.body.deleted !== undefined) doc.deleted = req.body.deleted
    await doc.save()
    res.json(doc)
  } catch (error) {
    console.error("Error updating print side:", error)
    if (error.code === 11000) {
      res.status(400).json({ msg: "Print side name already exists" })
    } else {
      res.status(500).json({ msg: "Failed to update print side" })
    }
  }
}

export const deletePrintSide = async (req, res) => {
  try {
    const doc = await PrintSide.findOne({ _id: req.params.id, website: req.websiteId })
    if (!doc) return res.status(404).json({ msg: "Print side not found" })
    doc.isActive = false
    doc.deleted = true
    await doc.save()
    res.json({ msg: "Print side deleted successfully" })
  } catch (error) {
    console.error("Error deleting print side:", error)
    res.status(500).json({ msg: "Failed to delete print side" })
  }
}

export const hardDeletePrintSide = async (req, res) => {
  try {
    const doc = await PrintSide.findOneAndDelete({ _id: req.params.id, website: req.websiteId })
    if (!doc) return res.status(404).json({ msg: "Print side not found" })
    res.json({ msg: "Print side permanently deleted" })
  } catch (error) {
    console.error("Error hard deleting print side:", error)
    res.status(500).json({ msg: "Failed to delete print side" })
  }
}
