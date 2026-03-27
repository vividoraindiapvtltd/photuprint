import FooterSection from "../models/footerSection.model.js"
import FooterTheme from "../models/footerTheme.model.js"
import { tenantCloudinaryUpload } from "../utils/cloudinary.js"

/**
 * Footer Section Controller
 * Manages dynamic footer sections for storefront homepage.
 * Multi-tenant: scoped by website
 */

/** Sanitize config so subdocuments pass schema validation (no empty required fields). */
function sanitizeFooterConfig(type, config) {
  const out = { ...config }
  if (type === "links" && Array.isArray(out.links)) {
    out.links = out.links
      .filter((l) => l && String(l.label || "").trim() && String(l.url || "").trim())
      .map((l, i) => ({
        label: String(l.label).trim(),
        url: String(l.url).trim(),
        iconUrl: String(l.iconUrl || "").trim() || undefined,
        openInNewTab: !!l.openInNewTab,
        displayOrder: typeof l.displayOrder === "number" ? l.displayOrder : i,
      }))
  }
  if (type === "social" && Array.isArray(out.platforms)) {
    out.platforms = out.platforms
      .filter((p) => p && p.platform && String(p.url || "").trim())
      .map((p, i) => ({
        platform: p.platform,
        url: String(p.url).trim(),
        displayOrder: typeof p.displayOrder === "number" ? p.displayOrder : i,
      }))
  }
  if (type === "payment" && Array.isArray(out.icons)) {
    out.icons = out.icons
      .filter((i) => i && String(i.name || "").trim())
      .map((i, idx) => ({
        name: String(i.name).trim(),
        iconUrl: String(i.iconUrl || "").trim() || undefined,
        displayOrder: typeof i.displayOrder === "number" ? i.displayOrder : idx,
      }))
  }
  return out
}

// ============================================================================
// PUBLIC API (storefront)
// ============================================================================

export const getPublicSections = async (req, res) => {
  try {
    const websiteId = req.websiteId || req.tenant?._id

    if (!websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }

    const [sections, themeDoc] = await Promise.all([
      FooterSection.find({ website: websiteId, isActive: true })
        .sort({ columnIndex: 1, displayOrder: 1 })
        .lean(),
      FooterTheme.findOne({ website: websiteId, isActive: true }).lean(),
    ])

    const numColumns = Math.max(1, Math.min(4, themeDoc?.footerColumns != null ? themeDoc.footerColumns : 4))
    const sectionsWithLayout = sections.map((s) => ({
      ...s,
      displayLayout: ["fullWidth", "cols4", "cols3", "cols2"].includes(s.displayLayout) ? s.displayLayout : "cols4",
      columnIndex: s.columnIndex != null ? s.columnIndex : 0,
    }))

    const fullWidthSections = sectionsWithLayout
      .filter((s) => s.displayLayout === "fullWidth")
      .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))

    const columnSections = sectionsWithLayout.filter((s) => s.displayLayout !== "fullWidth")
    // Clamp columnIndex so sections with out-of-range column (e.g. after theme change) still appear in last column
    const columns = Array.from({ length: numColumns }, (_, i) =>
      columnSections
        .filter((s) => Math.min((s.columnIndex ?? 0), numColumns - 1) === i)
        .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
    )

    const theme = themeDoc
        ? {
            backgroundColor: themeDoc.backgroundColor,
            titleFontSize: themeDoc.titleFontSize,
            titleColor: themeDoc.titleColor,
            linkFontSize: themeDoc.linkFontSize,
            linkColor: themeDoc.linkColor,
            linkHoverColor: themeDoc.linkHoverColor,
            bodyTextSize: themeDoc.bodyTextSize,
            bodyTextColor: themeDoc.bodyTextColor,
            inputBackgroundColor: themeDoc.inputBackgroundColor,
            inputTextColor: themeDoc.inputTextColor,
            inputBorderColor: themeDoc.inputBorderColor,
            inputBorderRadius: themeDoc.inputBorderRadius,
            subscribeButtonBackgroundColor: themeDoc.subscribeButtonBackgroundColor,
            subscribeButtonTextColor: themeDoc.subscribeButtonTextColor,
            subscribeButtonBorderColor: themeDoc.subscribeButtonBorderColor,
            subscribeButtonBorderRadius: themeDoc.subscribeButtonBorderRadius,
            socialIconColor: themeDoc.socialIconColor,
            dividerColor: themeDoc.dividerColor,
            dividerThickness: themeDoc.dividerThickness,
            footerColumns: numColumns,
          }
        : {}

    res.json({
      sections: sectionsWithLayout,
      theme,
      fullWidthSections,
      columns,
    })
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

    const { type, title, displayOrder, displayLayout, columnIndex, isActive, config } = req.body

    const maxOrder = await FooterSection.findOne({ website: websiteId }).sort({ displayOrder: -1 }).select("displayOrder")
    const order = displayOrder ?? (maxOrder ? maxOrder.displayOrder + 1 : 0)
    const colIndex = columnIndex != null ? Math.max(0, parseInt(columnIndex, 10) || 0) : 0

    const layout = ["fullWidth", "cols4", "cols3", "cols2"].includes(displayLayout) ? displayLayout : "cols4"
    const sanitizedConfig = sanitizeFooterConfig(type || "links", config || {})
    const section = new FooterSection({
      website: websiteId,
      type: type || "links",
      title: title || "",
      displayOrder: order,
      columnIndex: colIndex,
      displayLayout: layout,
      isActive: isActive !== false,
      config: sanitizedConfig,
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

    const { type, title, displayOrder, displayLayout, columnIndex, isActive, config } = req.body

    if (type !== undefined) section.type = type
    if (title !== undefined) section.title = title
    if (displayOrder !== undefined) section.displayOrder = displayOrder
    if (displayLayout !== undefined) section.displayLayout = ["fullWidth", "cols4", "cols3", "cols2"].includes(displayLayout) ? displayLayout : "cols4"
    if (columnIndex !== undefined) section.columnIndex = Math.max(0, parseInt(columnIndex, 10) || 0)
    if (isActive !== undefined) section.isActive = isActive
    if (config !== undefined) {
      const sanitized = sanitizeFooterConfig(section.type, { ...section.config, ...config })
      section.config = sanitized
    }

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

/**
 * Upload logo image for footer logo section. Returns logoUrl.
 * Uses Cloudinary if configured; otherwise returns a local /uploads/ URL.
 */
export const uploadLogo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ msg: "No file uploaded" })
    }
    const websiteId = req.websiteId || req.tenant?._id
    const logoUrl = await tenantCloudinaryUpload(websiteId, req.file, {
      folder: "photuprint/footer",
      resource_type: "auto",
    })
    return res.json({ logoUrl: logoUrl || `/uploads/${req.file.filename}` })
  } catch (error) {
    console.error("Error uploading footer logo:", error)
    res.status(500).json({ msg: "Server error", error: error.message })
  }
}

/**
 * Upload icon image for footer link. Returns iconUrl.
 */
export const uploadLinkIcon = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ msg: "No file uploaded" })
    }
    const websiteId = req.websiteId || req.tenant?._id
    const iconUrl = await tenantCloudinaryUpload(websiteId, req.file, {
      folder: "photuprint/footer/link-icons",
      resource_type: "auto",
    })
    return res.json({ iconUrl: iconUrl || `/uploads/${req.file.filename}` })
  } catch (error) {
    console.error("Error uploading footer link icon:", error)
    res.status(500).json({ msg: "Server error", error: error.message })
  }
}

// ============================================================================
// FOOTER THEME (multiple per website, one active)
// ============================================================================

export const getFooterThemes = async (req, res) => {
  try {
    const websiteId = req.websiteId || req.tenant?._id
    if (!websiteId) return res.status(400).json({ msg: "Website context is required" })
    const themes = await FooterTheme.find({ website: websiteId }).sort({ createdAt: -1 }).lean()
    res.json(themes)
  } catch (error) {
    console.error("Error fetching footer themes:", error)
    res.status(500).json({ msg: "Server error", error: error.message })
  }
}

export const getFooterThemeById = async (req, res) => {
  try {
    const websiteId = req.websiteId || req.tenant?._id
    const { themeId } = req.params
    if (!websiteId) return res.status(400).json({ msg: "Website context is required" })
    const theme = await FooterTheme.findOne({ _id: themeId, website: websiteId }).lean()
    if (!theme) return res.status(404).json({ msg: "Footer theme not found" })
    res.json(theme)
  } catch (error) {
    console.error("Error fetching footer theme:", error)
    res.status(500).json({ msg: "Server error", error: error.message })
  }
}

export const createFooterTheme = async (req, res) => {
  try {
    const websiteId = req.websiteId || req.tenant?._id
    if (!websiteId) return res.status(400).json({ msg: "Website context is required" })
    const count = await FooterTheme.countDocuments({ website: websiteId })
    const isActive = count === 0
    const {
      name,
      backgroundColor,
      titleFontSize,
      titleColor,
      linkFontSize,
      linkColor,
      linkHoverColor,
      bodyTextSize,
      bodyTextColor,
      inputBackgroundColor,
      inputTextColor,
      inputBorderColor,
      inputBorderRadius,
      subscribeButtonBackgroundColor,
      subscribeButtonTextColor,
      subscribeButtonBorderColor,
      subscribeButtonBorderRadius,
      socialIconColor,
      dividerColor,
      dividerThickness,
      footerColumns,
      isActive: bodyActive,
    } = req.body
    const theme = await FooterTheme.create({
      website: websiteId,
      name: name || null,
      backgroundColor: backgroundColor || null,
      titleFontSize: titleFontSize || null,
      titleColor: titleColor || null,
      linkFontSize: linkFontSize || null,
      linkColor: linkColor || null,
      linkHoverColor: linkHoverColor || null,
      bodyTextSize: bodyTextSize || null,
      bodyTextColor: bodyTextColor || null,
      inputBackgroundColor: inputBackgroundColor || null,
      inputTextColor: inputTextColor || null,
      inputBorderColor: inputBorderColor || null,
      inputBorderRadius: inputBorderRadius || null,
      subscribeButtonBackgroundColor: subscribeButtonBackgroundColor || null,
      subscribeButtonTextColor: subscribeButtonTextColor || null,
      subscribeButtonBorderColor: subscribeButtonBorderColor || null,
      subscribeButtonBorderRadius: subscribeButtonBorderRadius || null,
      socialIconColor: socialIconColor || null,
      dividerColor: dividerColor || null,
      dividerThickness: dividerThickness || null,
      footerColumns: [2, 3, 4].includes(Number(footerColumns)) ? Number(footerColumns) : 4,
      isActive: bodyActive !== undefined ? bodyActive : isActive,
    })
    res.status(201).json(theme.toObject ? theme.toObject() : theme)
  } catch (error) {
    console.error("Error creating footer theme:", error)
    res.status(500).json({ msg: "Server error", error: error.message })
  }
}

export const updateFooterTheme = async (req, res) => {
  try {
    const websiteId = req.websiteId || req.tenant?._id
    const { themeId } = req.params
    if (!websiteId) return res.status(400).json({ msg: "Website context is required" })
    const {
      name,
      backgroundColor,
      titleFontSize,
      titleColor,
      linkFontSize,
      linkColor,
      linkHoverColor,
      bodyTextSize,
      bodyTextColor,
      inputBackgroundColor,
      inputTextColor,
      inputBorderColor,
      inputBorderRadius,
      subscribeButtonBackgroundColor,
      subscribeButtonTextColor,
      subscribeButtonBorderColor,
      subscribeButtonBorderRadius,
      socialIconColor,
      dividerColor,
      dividerThickness,
      footerColumns,
      isActive,
    } = req.body
    const update = {}
    if (name !== undefined) update.name = name || null
    if (backgroundColor !== undefined) update.backgroundColor = backgroundColor || null
    if (titleFontSize !== undefined) update.titleFontSize = titleFontSize || null
    if (titleColor !== undefined) update.titleColor = titleColor || null
    if (linkFontSize !== undefined) update.linkFontSize = linkFontSize || null
    if (linkColor !== undefined) update.linkColor = linkColor || null
    if (linkHoverColor !== undefined) update.linkHoverColor = linkHoverColor || null
    if (bodyTextSize !== undefined) update.bodyTextSize = bodyTextSize || null
    if (bodyTextColor !== undefined) update.bodyTextColor = bodyTextColor || null
    if (inputBackgroundColor !== undefined) update.inputBackgroundColor = inputBackgroundColor || null
    if (inputTextColor !== undefined) update.inputTextColor = inputTextColor || null
    if (inputBorderColor !== undefined) update.inputBorderColor = inputBorderColor || null
    if (inputBorderRadius !== undefined) update.inputBorderRadius = inputBorderRadius || null
    if (subscribeButtonBackgroundColor !== undefined) update.subscribeButtonBackgroundColor = subscribeButtonBackgroundColor || null
    if (subscribeButtonTextColor !== undefined) update.subscribeButtonTextColor = subscribeButtonTextColor || null
    if (subscribeButtonBorderColor !== undefined) update.subscribeButtonBorderColor = subscribeButtonBorderColor || null
    if (subscribeButtonBorderRadius !== undefined) update.subscribeButtonBorderRadius = subscribeButtonBorderRadius || null
    if (socialIconColor !== undefined) update.socialIconColor = socialIconColor || null
    if (dividerColor !== undefined) update.dividerColor = dividerColor || null
    if (dividerThickness !== undefined) update.dividerThickness = dividerThickness || null
    if (footerColumns !== undefined && [2, 3, 4].includes(Number(footerColumns))) update.footerColumns = Number(footerColumns)
    if (isActive !== undefined) update.isActive = isActive

    const theme = await FooterTheme.findOneAndUpdate(
      { _id: themeId, website: websiteId },
      { $set: update },
      { new: true }
    ).lean()
    if (!theme) return res.status(404).json({ msg: "Footer theme not found" })
    res.json(theme)
  } catch (error) {
    console.error("Error updating footer theme:", error)
    res.status(500).json({ msg: "Server error", error: error.message })
  }
}

export const deleteFooterTheme = async (req, res) => {
  try {
    const websiteId = req.websiteId || req.tenant?._id
    const { themeId } = req.params
    if (!websiteId) return res.status(400).json({ msg: "Website context is required" })
    const theme = await FooterTheme.findOne({ _id: themeId, website: websiteId })
    if (!theme) return res.status(404).json({ msg: "Footer theme not found" })
    const wasActive = theme.isActive
    await FooterTheme.deleteOne({ _id: themeId, website: websiteId })
    if (wasActive) {
      const next = await FooterTheme.findOne({ website: websiteId }).sort({ createdAt: -1 })
      if (next) {
        await FooterTheme.updateOne({ _id: next._id }, { $set: { isActive: true } })
      }
    }
    res.json({ msg: "Footer theme deleted" })
  } catch (error) {
    console.error("Error deleting footer theme:", error)
    res.status(500).json({ msg: "Server error", error: error.message })
  }
}

export const setActiveFooterTheme = async (req, res) => {
  try {
    const websiteId = req.websiteId || req.tenant?._id
    const { themeId } = req.params
    if (!websiteId) return res.status(400).json({ msg: "Website context is required" })
    const theme = await FooterTheme.findOne({ _id: themeId, website: websiteId })
    if (!theme) return res.status(404).json({ msg: "Footer theme not found" })
    await FooterTheme.updateMany({ website: websiteId }, { $set: { isActive: false } })
    await FooterTheme.updateOne({ _id: themeId, website: websiteId }, { $set: { isActive: true } })
    const updated = await FooterTheme.findById(themeId).lean()
    res.json(updated)
  } catch (error) {
    console.error("Error setting active footer theme:", error)
    res.status(500).json({ msg: "Server error", error: error.message })
  }
}
