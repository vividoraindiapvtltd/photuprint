import ElementAsset from "../models/elementAsset.model.js"
import Element from "../models/element.model.js"

const imageUrlFromFile = (req) => {
  if (!req.file?.filename) return null
  return `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`
}

export const getElementAssets = async (req, res) => {
  try {
    if (!req.websiteId) {
      return res.status(400).json({ msg: "Website context is missing" })
    }
    const { elementId } = req.query
    const query = { website: req.websiteId }
    if (elementId && elementId !== "all") {
      const exists = await Element.findOne({ _id: elementId, website: req.websiteId })
      if (!exists) {
        return res.status(404).json({ msg: "Element not found" })
      }
      query.element = elementId
    }
    const assets = await ElementAsset.find(query)
      .populate("element", "name type")
      .sort({ createdAt: -1 })
    res.json(assets)
  } catch (error) {
    console.error("Error fetching element assets:", error)
    res.status(500).json({ msg: "Failed to fetch element assets" })
  }
}

export const getElementAssetById = async (req, res) => {
  try {
    if (!req.websiteId) {
      return res.status(400).json({ msg: "Website context is missing" })
    }
    const asset = await ElementAsset.findOne({
      _id: req.params.id,
      website: req.websiteId,
    }).populate("element", "name type")
    if (!asset) return res.status(404).json({ msg: "Asset not found" })
    res.json(asset)
  } catch (error) {
    console.error("Error fetching element asset:", error)
    res.status(500).json({ msg: "Failed to fetch element asset" })
  }
}

export const createElementAsset = async (req, res) => {
  try {
    if (!req.websiteId) {
      return res.status(400).json({ msg: "Website context is missing" })
    }
    const { elementId, color, orientation, animation, label, isActive } = req.body || {}
    if (!elementId) {
      return res.status(400).json({ msg: "elementId is required" })
    }
    const el = await Element.findOne({ _id: elementId, website: req.websiteId })
    if (!el) return res.status(404).json({ msg: "Element not found" })
    const imageUrl = imageUrlFromFile(req)
    if (!imageUrl) {
      return res.status(400).json({ msg: "Image file is required" })
    }
    const asset = await ElementAsset.create({
      element: elementId,
      image: imageUrl,
      color: (color || "").trim(),
      orientation: orientation || "any",
      animation: animation || "none",
      label: (label || "").trim(),
      isActive: isActive !== "false" && isActive !== false,
      website: req.websiteId,
    })
    res.status(201).json(asset)
  } catch (error) {
    console.error("Error creating element asset:", error)
    res.status(500).json({ msg: "Failed to create element asset" })
  }
}

export const updateElementAsset = async (req, res) => {
  try {
    if (!req.websiteId) {
      return res.status(400).json({ msg: "Website context is missing" })
    }
    const asset = await ElementAsset.findOne({
      _id: req.params.id,
      website: req.websiteId,
    })
    if (!asset) return res.status(404).json({ msg: "Asset not found" })
    const { color, orientation, animation, label, isActive } = req.body || {}
    if (color !== undefined) asset.color = (color || "").trim()
    if (orientation !== undefined) asset.orientation = orientation || "any"
    if (animation !== undefined) asset.animation = animation || "none"
    if (label !== undefined) asset.label = (label || "").trim()
    if (isActive !== undefined) asset.isActive = isActive !== "false" && isActive !== false
    if (req.file?.filename) {
      asset.image = imageUrlFromFile(req)
    }
    await asset.save()
    res.json(asset)
  } catch (error) {
    console.error("Error updating element asset:", error)
    res.status(500).json({ msg: "Failed to update element asset" })
  }
}

export const deleteElementAsset = async (req, res) => {
  try {
    if (!req.websiteId) {
      return res.status(400).json({ msg: "Website context is missing" })
    }
    const asset = await ElementAsset.findOne({
      _id: req.params.id,
      website: req.websiteId,
    })
    if (!asset) return res.status(404).json({ msg: "Asset not found" })
    await ElementAsset.deleteOne({ _id: asset._id })
    res.json({ msg: "Asset deleted successfully" })
  } catch (error) {
    console.error("Error deleting element asset:", error)
    res.status(500).json({ msg: "Failed to delete element asset" })
  }
}
