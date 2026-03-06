import FooterSection from "../models/footerSection.model.js"

/**
 * Footer Section Controller
 * Manages dynamic footer sections for storefront homepage.
 * Multi-tenant: scoped by website
 */

// ============================================================================
// PUBLIC API (storefront)
// ============================================================================

export const getPublicSections = async (req, res) => {
  try {
    const websiteId = req.websiteId || req.tenant?._id

    if (!websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }

    const sections = await FooterSection.find({
      website: websiteId,
      isActive: true,
    })
      .sort({ displayOrder: 1 })
      .lean()

    res.json({ sections })
  } catch (error) {
    console.error("Error fetching public footer sections:", error)
    res.status(500).json({ msg: "Server error", error: error.message })
  }
}

// ============================================================================
// ADMIN CRUD
// ============================================================================

export const getSections = async (req, res) => {
  try {
    const websiteId = req.websiteId || req.tenant?._id

    if (!websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }

    const { type, showInactive = "true", sortBy = "displayOrder", sortOrder = "asc" } = req.query

    const query = { website: websiteId }
    if (showInactive !== "true") {
      query.isActive = true
    }
    if (type && type !== "all") {
      query.type = type
    }

    const sort = {}
    sort[sortBy] = sortOrder === "desc" ? -1 : 1

    const sections = await FooterSection.find(query).sort(sort).lean()

    res.json({ sections })
  } catch (error) {
    console.error("Error fetching footer sections:", error)
    res.status(500).json({ msg: "Server error", error: error.message })
  }
}

export const getSectionById = async (req, res) => {
  try {
    const websiteId = req.websiteId || req.tenant?._id
    const { id } = req.params

    if (!websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }

    const section = await FooterSection.findOne({ _id: id, website: websiteId }).lean()

    if (!section) {
      return res.status(404).json({ msg: "Footer section not found" })
    }

    res.json(section)
  } catch (error) {
    console.error("Error fetching footer section:", error)
    res.status(500).json({ msg: "Server error", error: error.message })
  }
}

export const createSection = async (req, res) => {
  try {
    const websiteId = req.websiteId || req.tenant?._id

    if (!websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }

    const { type, title, displayOrder, isActive, config } = req.body

    const maxOrder = await FooterSection.findOne({ website: websiteId }).sort({ displayOrder: -1 }).select("displayOrder")
    const order = displayOrder ?? (maxOrder ? maxOrder.displayOrder + 1 : 0)

    const section = new FooterSection({
      website: websiteId,
      type: type || "links",
      title: title || "",
      displayOrder: order,
      isActive: isActive !== false,
      config: config || {},
    })

    await section.save()
    res.status(201).json(section)
  } catch (error) {
    console.error("Error creating footer section:", error)
    res.status(500).json({ msg: "Server error", error: error.message })
  }
}

export const updateSection = async (req, res) => {
  try {
    const websiteId = req.websiteId || req.tenant?._id
    const { id } = req.params

    if (!websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }

    const section = await FooterSection.findOne({ _id: id, website: websiteId })

    if (!section) {
      return res.status(404).json({ msg: "Footer section not found" })
    }

    const { type, title, displayOrder, isActive, config } = req.body

    if (type !== undefined) section.type = type
    if (title !== undefined) section.title = title
    if (displayOrder !== undefined) section.displayOrder = displayOrder
    if (isActive !== undefined) section.isActive = isActive
    if (config !== undefined) section.config = { ...section.config, ...config }

    await section.save()
    res.json(section)
  } catch (error) {
    console.error("Error updating footer section:", error)
    res.status(500).json({ msg: "Server error", error: error.message })
  }
}

export const deleteSection = async (req, res) => {
  try {
    const websiteId = req.websiteId || req.tenant?._id
    const { id } = req.params

    if (!websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }

    const section = await FooterSection.findOneAndDelete({ _id: id, website: websiteId })

    if (!section) {
      return res.status(404).json({ msg: "Footer section not found" })
    }

    res.json({ msg: "Section deleted", id })
  } catch (error) {
    console.error("Error deleting footer section:", error)
    res.status(500).json({ msg: "Server error", error: error.message })
  }
}

export const reorderSections = async (req, res) => {
  try {
    const websiteId = req.websiteId || req.tenant?._id
    const { sections } = req.body

    if (!websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }

    if (!Array.isArray(sections) || sections.length === 0) {
      return res.status(400).json({ msg: "sections array is required" })
    }

    const ops = sections.map(({ id, displayOrder }) => ({
      updateOne: {
        filter: { _id: id, website: websiteId },
        update: { displayOrder },
      },
    }))

    await FooterSection.bulkWrite(ops)
    const updated = await FooterSection.find({ website: websiteId }).sort({ displayOrder: 1 }).lean()
    res.json({ sections: updated })
  } catch (error) {
    console.error("Error reordering footer sections:", error)
    res.status(500).json({ msg: "Server error", error: error.message })
  }
}
