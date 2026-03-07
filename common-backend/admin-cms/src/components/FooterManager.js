import React, { useState, useEffect, useCallback, useMemo, useRef } from "react"
import api, { getUploadBaseURL } from "../api/axios"
import { useAuth } from "../context/AuthContext"
import {
  PageHeader,
  AlertMessage,
  FormField,
  DeleteConfirmationPopup,
  SearchField,
  StatusFilter,
  ActionButtons,
  ViewToggle,
  EntityCard,
  EntityCardHeader,
  calculateStandardStatusCounts,
  filterEntitiesByStatus,
  generateBrandColor,
} from "../common"
import RichTextEditor from "./CKEditor"

const SECTION_TYPES = [
  { value: "links", label: "Links Column" },
  { value: "contact", label: "Contact Info" },
  { value: "newsletter", label: "Newsletter" },
  { value: "social", label: "Social Links" },
  { value: "about", label: "About Us" },
  { value: "logo", label: "Logo" },
  { value: "payment", label: "Payment Icons" },
  { value: "copyright", label: "Copyright" },
  { value: "custom", label: "Custom HTML" },
]

const DISPLAY_LAYOUT_OPTIONS = [
  { value: "fullWidth", label: "Full width" },
  { value: "cols4", label: "4 columns" },
  { value: "cols3", label: "3 columns" },
  { value: "cols2", label: "2 columns" },
]

const SOCIAL_PLATFORMS = [
  "facebook", "instagram", "twitter", "youtube", "linkedin", "pinterest", "tiktok", "whatsapp", "other",
]

const FooterManager = () => {
  const { selectedWebsite } = useAuth()
  const [sections, setSections] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [editingId, setEditingId] = useState(null)
  const [statusFilter, setStatusFilter] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [viewMode, setViewMode] = useState("card")
  const [deletePopup, setDeletePopup] = useState({ isVisible: false, id: null, message: "" })
  const [imagePopup, setImagePopup] = useState({ isVisible: false, imageUrl: null })
  const [footerColumns, setFooterColumns] = useState(4)
  const formRef = useRef(null)

  const handleImageClick = (imageUrl) => {
    if (imageUrl) setImagePopup({ isVisible: true, imageUrl })
  }
  const handleCloseImagePopup = () => setImagePopup({ isVisible: false, imageUrl: null })

  const initialForm = {
    type: "links",
    title: "",
    displayOrder: 0,
    columnIndex: 0,
    displayLayout: "cols4",
    isActive: true,
    config: {
      links: [],
      address: "",
      phone: "",
      email: "",
      description: "",
      logoUrl: "",
      logoLinkUrl: "",
      logoAlt: "",
      logoTitle: "",
      placeholder: "Enter your email",
      buttonText: "Subscribe",
      successMessage: "Thank you for subscribing!",
      platforms: [],
      icons: [],
      text: "",
      html: "",
    },
  }
  const [formData, setFormData] = useState(initialForm)

  const fetchSections = useCallback(async () => {
    if (!selectedWebsite?._id) {
      setSections([])
      setError("Please select a website first.")
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      setError("")
      const [sectionsRes, themesRes] = await Promise.all([
        api.get("/footer-sections?showInactive=true"),
        api.get("/footer-sections/theme").catch(() => ({ data: [] })),
      ])
      setSections(sectionsRes.data.sections || [])
      const themes = Array.isArray(themesRes.data) ? themesRes.data : []
      const active = themes.find((t) => t.isActive)
      setFooterColumns([2, 3, 4].includes(Number(active?.footerColumns)) ? Number(active.footerColumns) : 4)
    } catch (err) {
      const msg = err.response?.data?.msg || err.message || "Failed to load footer sections."
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [selectedWebsite?._id])

  useEffect(() => {
    fetchSections()
  }, [fetchSections])

  const resetForm = () => {
    setEditingId(null)
    setFormData(initialForm)
  }

  const handleEdit = (section) => {
    setEditingId(section._id)
    setError("")
    setSuccess("")
    const layout = ["fullWidth", "cols4", "cols3", "cols2"].includes(section.displayLayout) ? section.displayLayout : "cols4"
    const numCols = layout === "cols2" ? 2 : layout === "cols3" ? 3 : 4
    const colIndex = section.columnIndex != null ? section.columnIndex : 0
    setFormData({
      type: section.type || "links",
      title: section.title || "",
      displayOrder: section.displayOrder ?? 0,
      columnIndex: layout === "fullWidth" ? 0 : Math.min(colIndex, numCols - 1),
      displayLayout: layout,
      isActive: section.isActive !== false,
      config: {
        links: (section.config?.links || []).map((l) => ({ ...l, iconUrl: l.iconUrl || "" })),
        address: section.config?.address || "",
        phone: section.config?.phone || "",
        email: section.config?.email || "",
        description: section.config?.description || "",
        logoUrl: section.config?.logoUrl || "",
        logoLinkUrl: section.config?.logoLinkUrl || "",
        logoAlt: section.config?.logoAlt || "",
        logoTitle: section.config?.logoTitle || "",
        placeholder: section.config?.placeholder || "Enter your email",
        buttonText: section.config?.buttonText || "Subscribe",
        successMessage: section.config?.successMessage || "Thank you for subscribing!",
        platforms: (section.config?.platforms || []).map((p) => ({ ...p })),
        icons: (section.config?.icons || []).map((i) => ({ ...i })),
        text: section.config?.text || "",
        html: section.config?.html || "",
      },
    })
    setTimeout(() => {
      if (formRef.current) {
        formRef.current.scrollIntoView({ behavior: "smooth", block: "start" })
      }
    }, 100)
  }

  const filteredSections = useMemo(() => {
    let filtered = filterEntitiesByStatus(sections, statusFilter)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      filtered = filtered.filter(
        (s) =>
          (s.title || "").toLowerCase().includes(q) ||
          typeLabel(s.type).toLowerCase().includes(q)
      )
    }
    return filtered.sort((a, b) => {
      const ca = a.columnIndex ?? 0
      const cb = b.columnIndex ?? 0
      if (ca !== cb) return ca - cb
      return (a.displayOrder ?? 0) - (b.displayOrder ?? 0)
    })
  }, [sections, statusFilter, searchQuery])

  // Column layout preview: same grouping as public API (active sections only)
  const columnsPreview = useMemo(() => {
    const active = sections.filter((s) => s.isActive)
    const numCols = Math.max(1, Math.min(4, footerColumns))
    const columnSections = active.filter((s) => s.displayLayout !== "fullWidth")
    return Array.from({ length: numCols }, (_, i) =>
      columnSections
        .filter((s) => Math.min(s.columnIndex ?? 0, numCols - 1) === i)
        .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
    )
  }, [sections, footerColumns])

  const handleViewModeChange = (mode) => setViewMode(mode)

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      setError("")
      setSuccess("")
      const payload = {
        type: formData.type,
        title: formData.title,
        displayOrder: formData.displayOrder,
        columnIndex: formData.columnIndex != null ? formData.columnIndex : 0,
        displayLayout: formData.displayLayout || "cols4",
        isActive: formData.isActive,
        config: {},
      }
      if (formData.type === "links") payload.config.links = formData.config.links
      if (formData.type === "contact") {
        payload.config.address = formData.config.address
        payload.config.phone = formData.config.phone
        payload.config.email = formData.config.email
      }
      if (formData.type === "newsletter") {
        payload.config.placeholder = formData.config.placeholder
        payload.config.buttonText = formData.config.buttonText
        payload.config.successMessage = formData.config.successMessage
      }
      if (formData.type === "social") payload.config.platforms = formData.config.platforms
      if (formData.type === "about") payload.config.description = formData.config.description
      if (formData.type === "logo") {
        payload.config.logoUrl = formData.config.logoUrl
        payload.config.logoLinkUrl = formData.config.logoLinkUrl
        payload.config.logoAlt = formData.config.logoAlt
        payload.config.logoTitle = formData.config.logoTitle
      }
      if (formData.type === "payment") payload.config.icons = formData.config.icons
      if (formData.type === "copyright") payload.config.text = formData.config.text
      if (formData.type === "custom") payload.config.html = formData.config.html

      if (editingId) {
        await api.put(`/footer-sections/${editingId}`, payload)
        setSuccess("Section updated.")
      } else {
        await api.post("/footer-sections", payload)
        setSuccess("Section added.")
      }
      resetForm()
      fetchSections()
    } catch (err) {
      setError(err.response?.data?.msg || "Failed to save.")
    }
  }

  const handleDelete = async () => {
    if (!deletePopup.id) return
    try {
      await api.delete(`/footer-sections/${deletePopup.id}`)
      setSuccess("Section deleted.")
      setDeletePopup({ isVisible: false, id: null, message: "" })
      fetchSections()
    } catch (err) {
      setError(err.response?.data?.msg || "Failed to delete.")
    }
  }

  const addLink = () => {
    setFormData((prev) => ({
      ...prev,
      config: {
        ...prev.config,
        links: [...(prev.config.links || []), { label: "", url: "", iconUrl: "", openInNewTab: false, displayOrder: prev.config.links?.length || 0 }],
      },
    }))
  }
  const updateLink = (i, field, value) => {
    const links = [...(formData.config.links || [])]
    links[i] = { ...links[i], [field]: value }
    setFormData((prev) => ({ ...prev, config: { ...prev.config, links } }))
  }
  const removeLink = (i) => {
    const links = (formData.config.links || []).filter((_, j) => j !== i)
    setFormData((prev) => ({ ...prev, config: { ...prev.config, links } }))
  }

  const addPlatform = () => {
    setFormData((prev) => ({
      ...prev,
      config: {
        ...prev.config,
        platforms: [...(prev.config.platforms || []), { platform: "facebook", url: "", displayOrder: prev.config.platforms?.length || 0 }],
      },
    }))
  }
  const updatePlatform = (i, field, value) => {
    const platforms = [...(formData.config.platforms || [])]
    platforms[i] = { ...platforms[i], [field]: value }
    setFormData((prev) => ({ ...prev, config: { ...prev.config, platforms } }))
  }
  const removePlatform = (i) => {
    const platforms = (formData.config.platforms || []).filter((_, j) => j !== i)
    setFormData((prev) => ({ ...prev, config: { ...prev.config, platforms } }))
  }

  const addPaymentIcon = () => {
    setFormData((prev) => ({
      ...prev,
      config: {
        ...prev.config,
        icons: [...(prev.config.icons || []), { name: "", iconUrl: "", displayOrder: prev.config.icons?.length || 0 }],
      },
    }))
  }
  const updateIcon = (i, field, value) => {
    const icons = [...(formData.config.icons || [])]
    icons[i] = { ...icons[i], [field]: value }
    setFormData((prev) => ({ ...prev, config: { ...prev.config, icons } }))
  }
  const removeIcon = (i) => {
    const icons = (formData.config.icons || []).filter((_, j) => j !== i)
    setFormData((prev) => ({ ...prev, config: { ...prev.config, icons } }))
  }

  const typeLabel = (v) => SECTION_TYPES.find((t) => t.value === v)?.label || v

  return (
    <div className="paddingAll20">
      <PageHeader
        title="Footer Management"
        subtitle="Manage dynamic footer sections for the storefront homepage"
        isEditing={!!editingId}
        editText="Edit Section"
        createText="Add New Section"
      />

      <AlertMessage type="success" message={success} onClose={() => setSuccess("")} autoClose={true} />
      <AlertMessage type="error" message={error} onClose={() => setError("")} autoClose={true} />

      {/* Form */}
      <div className="brandFormContainer paddingAll32 appendBottom30" ref={formRef}>
        <form onSubmit={handleSubmit} className="brandForm">
          <div className="makeFlex row gap10 appendBottom16">
            <div className="flexOne">
              <FormField
                label="Type"
                required
                type="select"
                name="type"
                value={formData.type}
                onChange={(e) => setFormData((p) => ({ ...p, type: e.target.value }))}
                options={SECTION_TYPES}
              />
            </div>
          </div>
          <div className="makeFlex row gap10 appendBottom16">
            <div className="fullWidth">
              <FormField
                label="Title"
                type="text"
                name="title"
                value={formData.title}
                onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))}
                placeholder="e.g. Quick Links"
              />
            </div>
          </div>
          <div className="makeFlex row gap10 appendBottom16">
            <div className="flexOne">
              <FormField
                label="Display layout"
                type="select"
                name="displayLayout"
                value={formData.displayLayout}
                onChange={(e) => {
                  const layout = e.target.value
                  const numCols = layout === "cols2" ? 2 : layout === "cols3" ? 3 : 4
                  setFormData((p) => ({
                    ...p,
                    displayLayout: layout,
                    columnIndex: Math.min(p.columnIndex ?? 0, numCols - 1),
                  }))
                }}
                options={DISPLAY_LAYOUT_OPTIONS}
              />
            </div>
          </div>
          {formData.displayLayout === "fullWidth" && (
            <div className="makeFlex row gap10 appendBottom16">
              <div className="widthHalf">
                <FormField
                  label="Display order"
                  type="number"
                  name="displayOrder"
                  value={formData.displayOrder}
                  onChange={(e) => setFormData((p) => ({ ...p, displayOrder: parseInt(e.target.value, 10) || 0 }))}
                  min={0}
                />
              </div>
              <p className="font14 grayText" style={{ alignSelf: "center" }}>Lower numbers show first (e.g. 0 = top).</p>
            </div>
          )}
          {formData.displayLayout !== "fullWidth" && (() => {
            const numColsFromLayout = formData.displayLayout === "cols2" ? 2 : formData.displayLayout === "cols3" ? 3 : 4
            const columnOptions = Array.from({ length: numColsFromLayout }, (_, i) => ({ value: String(i), label: `Column ${i + 1}` }))
            return (
              <>
                <div className="makeFlex row gap10 appendBottom16">
                  <div className="widthHalf">
                    <FormField
                      label="Column"
                      type="select"
                      name="columnIndex"
                      value={String(Math.min(formData.columnIndex ?? 0, numColsFromLayout - 1))}
                      onChange={(e) => setFormData((p) => ({ ...p, columnIndex: parseInt(e.target.value, 10) || 0 }))}
                      options={columnOptions}
                    />
                  </div>
                  <div className="widthHalf">
                    <FormField
                      label="Order in column"
                      type="number"
                      name="displayOrder"
                      value={formData.displayOrder}
                      onChange={(e) => setFormData((p) => ({ ...p, displayOrder: parseInt(e.target.value, 10) || 0 }))}
                      min={0}
                    />
                  </div>
                </div>
                <p className="font14 grayText appendBottom16">Choose Column (1–{numColsFromLayout}) and Order in column. Lower numbers show first in that column. Multiple sections in the same column stack vertically; all columns sit in one row on the storefront.</p>
              </>
            )
          })()}

          {/* Type-specific config */}
          {formData.type === "links" && (
            <div className="appendBottom16" style={{ display: "flex", flexDirection: "column", gap: 10, flexWrap: "nowrap", width: "100%" }}>
              <span className="formLabel">Links</span>
              <span role="button" onClick={addLink} className="font14 fontSemiBold cursorPointer hoverUnderline" style={{ color: "#0891b2", whiteSpace: "nowrap" }} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && addLink()}>
                + Add Link
              </span>
              {(formData.config.links || []).map((link, i) => (
                <div key={i} className="border rounded paddingAll12" style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%", flexShrink: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, width: "100%" }}>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={async (e) => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        try {
                          const fd = new FormData()
                          fd.append("icon", file)
                          const res = await api.post("/footer-sections/upload-link-icon", fd)
                          if (res.data?.iconUrl) updateLink(i, "iconUrl", res.data.iconUrl)
                        } catch (err) {
                          setError(err.response?.data?.msg || "Icon upload failed.")
                        }
                        e.target.value = ""
                      }}
                      className="formInput"
                      style={{ width: "50%" }}
                    />
                    <input
                      placeholder="Icon URL"
                      value={link.iconUrl || ""}
                      onChange={(e) => updateLink(i, "iconUrl", e.target.value)}
                      className="formInput"
                      style={{ width: "50%" }}
                    />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", width: "100%" }}>
                    <input
                      placeholder="Label"
                      value={link.label}
                      onChange={(e) => updateLink(i, "label", e.target.value)}
                      className="formInput"
                      style={{ width: "30%", minWidth: 120 }}
                    />
                    <input
                      placeholder="URL"
                      value={link.url}
                      onChange={(e) => updateLink(i, "url", e.target.value)}
                      className="formInput"
                      style={{ width: "60%", minWidth: 160 }}
                    />
                    <label className="makeFlex gap10 alignCenter font12">
                      <input type="checkbox" checked={!!link.openInNewTab} onChange={(e) => updateLink(i, "openInNewTab", e.target.checked)} />
                      New tab
                    </label>
                    <span role="button" onClick={() => removeLink(i)} className="font14 grayText cursorPointer" style={{ fontSize: "1.2em" }} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && removeLink(i)} title="Remove">
                      ×
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {formData.type === "contact" && (
            <div className="appendBottom16" style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%" }}>
                <FormField
                  label="Address"
                  type="textarea"
                  name="address"
                  value={formData.config.address}
                  onChange={(e) => setFormData((p) => ({ ...p, config: { ...p.config, address: e.target.value } }))}
                  rows={2}
                />
                <div style={{ display: "flex", gap: 10, width: "100%" }}>
                  <div style={{ width: "50%" }}>
                    <FormField
                      label="Phone"
                      type="text"
                      name="phone"
                      value={formData.config.phone}
                      onChange={(e) => setFormData((p) => ({ ...p, config: { ...p.config, phone: e.target.value } }))}
                    />
                  </div>
                  <div style={{ width: "50%" }}>
                    <FormField
                      label="Email"
                      type="email"
                      name="email"
                      value={formData.config.email}
                      onChange={(e) => setFormData((p) => ({ ...p, config: { ...p.config, email: e.target.value } }))}
                    />
                  </div>
                </div>
            </div>
          )}

          {formData.type === "newsletter" && (
            <div className="makeFlex column gap10 appendBottom16">
                <FormField
                  label="Placeholder"
                  type="text"
                  name="placeholder"
                  value={formData.config.placeholder}
                  onChange={(e) => setFormData((p) => ({ ...p, config: { ...p.config, placeholder: e.target.value } }))}
                />
                <FormField
                  label="Button Text"
                  type="text"
                  name="buttonText"
                  value={formData.config.buttonText}
                  onChange={(e) => setFormData((p) => ({ ...p, config: { ...p.config, buttonText: e.target.value } }))}
                />
                <FormField
                  label="Success Message"
                  type="text"
                  name="successMessage"
                  value={formData.config.successMessage}
                  onChange={(e) => setFormData((p) => ({ ...p, config: { ...p.config, successMessage: e.target.value } }))}
                />
            </div>
          )}

          {formData.type === "social" && (
            <div className="appendBottom16" style={{ display: "flex", flexDirection: "column", gap: 10, flexWrap: "nowrap", width: "100%" }}>
              <span className="formLabel">Platforms</span>
              <span role="button" onClick={addPlatform} className="font14 fontSemiBold cursorPointer hoverUnderline" style={{ color: "#0891b2", whiteSpace: "nowrap" }} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && addPlatform()}>
                + Add
              </span>
              {(formData.config.platforms || []).map((p, i) => (
                <div key={i} className="border rounded paddingAll12" style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", flexShrink: 0 }}>
                  <select
                    value={p.platform}
                    onChange={(e) => updatePlatform(i, "platform", e.target.value)}
                    className="formSelect"
                    style={{ width: "30%" }}
                  >
                    {SOCIAL_PLATFORMS.map((plat) => (
                      <option key={plat} value={plat}>
                        {plat}
                      </option>
                    ))}
                  </select>
                  <input
                    placeholder="URL"
                    value={p.url}
                    onChange={(e) => updatePlatform(i, "url", e.target.value)}
                    className="formInput"
                    style={{ width: "60%" }}
                  />
                  <span role="button" onClick={() => removePlatform(i)} className="font14 grayText cursorPointer" style={{ fontSize: "1.2em" }} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && removePlatform(i)} title="Remove">
                    ×
                  </span>
                </div>
              ))}
            </div>
          )}

          {formData.type === "about" && (
            <div className="makeFlex column gap10 appendBottom16" style={{ width: "100%", maxWidth: "100%" }}>
              <div className="appendBottom16" style={{ width: "100%" }}>
                <label className="formLabel appendBottom8 block">Description</label>
                <div style={{ width: "100%" }}>
                  <RichTextEditor
                    name="description"
                    value={formData.config.description || ""}
                    onChange={(e) => setFormData((p) => ({ ...p, config: { ...p.config, description: e.target.value } }))}
                    placeholder="About us text (supports paragraphs, lists, bold, etc.)"
                  />
                </div>
              </div>
            </div>
          )}

          {formData.type === "logo" && (
            <div className="makeFlex column gap10 appendBottom16" style={{ width: "100%" }}>
              <div>
                <label className="formLabel appendBottom8 block">Upload logo</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    try {
                      const fd = new FormData()
                      fd.append("logo", file)
                      const res = await api.post("/footer-sections/upload-logo", fd)
                      if (res.data?.logoUrl) {
                        setFormData((p) => ({ ...p, config: { ...p.config, logoUrl: res.data.logoUrl } }))
                      }
                    } catch (err) {
                      setError(err.response?.data?.msg || "Upload failed.")
                    }
                    e.target.value = ""
                  }}
                  className="formInput"
                />
              </div>
              <FormField
                label="Logo image URL"
                type="text"
                name="logoUrl"
                value={formData.config.logoUrl || ""}
                onChange={(e) => setFormData((p) => ({ ...p, config: { ...p.config, logoUrl: e.target.value } }))}
                placeholder="Or paste image URL (e.g. https://...)"
              />
              <FormField
                label="Link URL"
                type="text"
                name="logoLinkUrl"
                value={formData.config.logoLinkUrl || ""}
                onChange={(e) => setFormData((p) => ({ ...p, config: { ...p.config, logoLinkUrl: e.target.value } }))}
                placeholder="URL when logo is clicked (e.g. https://...)"
              />
              <FormField
                label="Alt text"
                type="text"
                name="logoAlt"
                value={formData.config.logoAlt || ""}
                onChange={(e) => setFormData((p) => ({ ...p, config: { ...p.config, logoAlt: e.target.value } }))}
                placeholder="Accessibility / fallback text for the image"
              />
              <FormField
                label="Title"
                type="text"
                name="logoTitle"
                value={formData.config.logoTitle || ""}
                onChange={(e) => setFormData((p) => ({ ...p, config: { ...p.config, logoTitle: e.target.value } }))}
                placeholder="Tooltip text on hover"
              />
            </div>
          )}

          {formData.type === "payment" && (
            <div className="appendBottom16" style={{ display: "flex", flexDirection: "column", gap: 10, flexWrap: "nowrap", width: "100%" }}>
              <span className="formLabel">Payment Icons</span>
              <span role="button" onClick={addPaymentIcon} className="font14 fontSemiBold cursorPointer hoverUnderline" style={{ color: "#0891b2", whiteSpace: "nowrap" }} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && addPaymentIcon()}>
                + Add
              </span>
              {(formData.config.icons || []).map((icon, i) => (
                <div key={i} className="border rounded paddingAll12" style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", flexShrink: 0 }}>
                  <input
                    placeholder="Name (e.g. Visa)"
                    value={icon.name}
                    onChange={(e) => updateIcon(i, "name", e.target.value)}
                    className="formInput"
                    style={{ width: "30%" }}
                  />
                  <input
                    placeholder="Icon URL"
                    value={icon.iconUrl}
                    onChange={(e) => updateIcon(i, "iconUrl", e.target.value)}
                    className="formInput"
                    style={{ width: "60%" }}
                  />
                  <span role="button" onClick={() => removeIcon(i)} className="font14 grayText cursorPointer" style={{ fontSize: "1.2em" }} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && removeIcon(i)} title="Remove">
                    ×
                  </span>
                </div>
              ))}
            </div>
          )}

          {formData.type === "copyright" && (
            <div className="appendBottom16">
              <FormField
                label="Copyright Text"
                type="text"
                name="copyrightText"
                value={formData.config.text}
                onChange={(e) => setFormData((p) => ({ ...p, config: { ...p.config, text: e.target.value } }))}
                placeholder="© 2024 Company Name. All rights reserved."
              />
            </div>
          )}

          {formData.type === "custom" && (
            <div className="appendBottom16">
              <FormField
                label="HTML"
                type="textarea"
                name="html"
                value={formData.config.html}
                onChange={(e) => setFormData((p) => ({ ...p, config: { ...p.config, html: e.target.value } }))}
                rows={6}
                placeholder="<p>Custom HTML content</p>"
              />
            </div>
          )}

          <div className="makeFlex row gap10 appendBottom16">
            <div className="fullWidth makeFlex column">
              <label className="formLabel appendBottom10">Status:</label>
              <label className="formLabel appendBottom8 makeFlex gap10">
                <FormField
                  type="checkbox"
                  name="isActive"
                  value={formData.isActive}
                  onChange={(e) => setFormData((p) => ({ ...p, isActive: e.target.checked }))}
                />
                Active
              </label>
              <p className="negativeMarginTop10">Check to keep this section visible on the storefront</p>
            </div>
          </div>

          <div className="formActions paddingTop16">
            <button type="submit" disabled={loading} className="btnPrimary">
              {loading ? <span className="loadingSpinner">⏳</span> : <span>{editingId ? "Update Section" : "Create Section"}</span>}
            </button>
            {editingId && (
              <button type="button" onClick={resetForm} className="btnSecondary">
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Sections List */}
      <div className="brandsListContainer paddingAll32">
        <div className="listHeader makeFlex spaceBetween end appendBottom24">
          <div className="leftSection">
            <h2 className="listTitle font30 fontBold blackText appendBottom16">Footer Sections ({filteredSections.length})</h2>
            <StatusFilter
              statusFilter={statusFilter}
              onStatusChange={setStatusFilter}
              counts={calculateStandardStatusCounts(sections)}
              disabled={loading}
              statusOptions={[
                { key: "all", label: "All", count: sections.length, color: "black" },
                { key: "active", label: "Active", count: sections.filter((s) => s.isActive).length, color: "green" },
                { key: "inactive", label: "Inactive", count: sections.filter((s) => !s.isActive).length, color: "gray" },
              ]}
            />
          </div>
          <div className="rightSection makeFlex end gap10">
            <SearchField
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search sections..."
              disabled={loading}
              minWidth="250px"
            />
            {loading && <div className="loadingIndicator grayText">Loading...</div>}
            <ViewToggle viewMode={viewMode} onViewChange={handleViewModeChange} disabled={loading} />
          </div>
        </div>

        {/* Column layout preview: how storefront will render columns */}
        {columnsPreview.some((col) => col.length > 0) && (
          <div className="appendBottom24 paddingAll16" style={{ background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
            <div className="font14 fontSemiBold grayText appendBottom12">Column layout (storefront preview)</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
              {columnsPreview.map((colSections, i) => (
                <div
                  key={i}
                  style={{
                    flex: `1 1 ${100 / columnsPreview.length}%`,
                    minWidth: 120,
                    padding: 12,
                    background: "#fff",
                    borderRadius: 6,
                    border: "1px solid #e2e8f0",
                  }}
                >
                  <div className="font12 fontSemiBold grayText appendBottom8">Column {i + 1}</div>
                  {colSections.length === 0 ? (
                    <div className="font12 grayText">—</div>
                  ) : (
                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                      {colSections.map((s) => (
                        <li key={s._id} className="font12 appendBottom4">
                          {s.title || typeLabel(s.type)}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {filteredSections.length === 0 && !loading ? (
          <div className="emptyState textCenter paddingAll60">
            <div className="emptyIcon appendBottom16">📄</div>
            <h3 className="font22 fontSemiBold grayText appendBottom8">No Footer Sections Found</h3>
            <p className="font16 grayText appendBottom16">Start by adding your first section above</p>
            <p className="font14 grayText">Add Links, Contact, Newsletter, Social, About, Payment, Copyright, or Custom HTML sections.</p>
          </div>
        ) : (
          <>
            {/* Card View */}
            {viewMode === "card" && (
              <div className="brandsGrid">
                {filteredSections.map((s) => {
                  return (
                  <div
                    key={s._id}
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      if (e.target.closest(".entityLogo img")) return
                      handleEdit(s)
                    }}
                    onKeyDown={(e) => e.key === "Enter" && handleEdit(s)}
                    style={{ cursor: "pointer" }}
                    className="brandCardWrapper"
                  >
                  <EntityCard
                    entity={s}
                    idField="_id"
                    onEdit={handleEdit}
                    onDelete={(id) => setDeletePopup({ isVisible: true, id, message: `Delete "${s.title || typeLabel(s.type)}"?` })}
                    loading={loading}
                    imagePlaceholderColor={generateBrandColor(s._id, s.title || typeLabel(s.type))}
                    renderHeader={(section) => (
                      <EntityCardHeader
                        entity={{ ...section, logo: section.type === "logo" && section.config?.logoUrl ? (section.config.logoUrl.startsWith("http") ? section.config.logoUrl : getUploadBaseURL() + (section.config.logoUrl.startsWith("/") ? section.config.logoUrl : "/" + section.config.logoUrl)) : null, name: section.title || typeLabel(section.type) }}
                        imageField="logo"
                        titleField="name"
                        dateField="createdAt"
                        generateColor={generateBrandColor}
                        imagePlaceholderColor={generateBrandColor(section._id, section.title || typeLabel(section.type))}
                        onImageClick={handleImageClick}
                      />
                    )}
                    renderDetails={(section) => {
                      const links = (section.config?.links || []).sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
                      const platforms = (section.config?.platforms || []).sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
                      const linkCls = "detailValue font12 blackText appendLeft0"
                      const linkStyle = { textDecoration: "underline" }
                      return (
                        <>
                          <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                            <span className="detailLabel font14 fontSemiBold grayText textUppercase">Column:</span>
                            <span className="detailValue font14 blackText appendLeft6">{section.displayLayout === "fullWidth" ? "Full width" : `Column ${(section.columnIndex ?? 0) + 1}`}</span>
                          </div>
                          <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                            <span className="detailLabel font14 fontSemiBold grayText textUppercase">Order:</span>
                            <span className="detailValue font14 blackText appendLeft6">{section.displayOrder ?? 0}</span>
                          </div>
                          <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                            <span className="detailLabel font14 fontSemiBold grayText textUppercase">Type:</span>
                            <span className="detailValue font14 blackText appendLeft6">{typeLabel(section.type)}</span>
                          </div>
                          {links.length > 0 && (
                            <div className="brandDetail paddingTop8 paddingBottom8">
                              <span className="detailLabel font14 fontSemiBold grayText textUppercase appendBottom8 block">Links:</span>
                              <div className="makeFlex column gap4">
                                {links.map((link, i) => (
                                  <a key={i} href={link.url} target={link.openInNewTab ? "_blank" : undefined} rel={link.openInNewTab ? "noopener noreferrer" : undefined} className={linkCls} style={linkStyle} title={link.url}>
                                    {link.label || "(no label)"}
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}
                          {section.type === "contact" && (section.config?.phone || section.config?.email) && (
                            <div className="brandDetail paddingTop8 paddingBottom8">
                              <span className="detailLabel font14 fontSemiBold grayText textUppercase appendBottom8 block">Contact:</span>
                              <div className="makeFlex column gap4">
                                {section.config?.phone && (
                                  <a href={`tel:${section.config.phone}`} className={linkCls} style={linkStyle}>{section.config.phone}</a>
                                )}
                                {section.config?.email && (
                                  <a href={`mailto:${section.config.email}`} className={linkCls} style={linkStyle}>{section.config.email}</a>
                                )}
                              </div>
                            </div>
                          )}
                          {platforms.length > 0 && (
                            <div className="brandDetail paddingTop8 paddingBottom8">
                              <span className="detailLabel font14 fontSemiBold grayText textUppercase appendBottom8 block">Social:</span>
                              <div className="makeFlex column gap4">
                                {platforms.map((p, i) => (
                                  <a key={i} href={p.url} target="_blank" rel="noopener noreferrer" className={linkCls} style={linkStyle} title={p.url}>
                                    {p.platform}: {p.url ? (p.url.length > 40 ? p.url.slice(0, 40) + "…" : p.url) : "(no url)"}
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}
                          <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                            <span className="detailLabel font14 fontSemiBold grayText textUppercase">Status:</span>
                            <span className={`detailValue font14 ${section.isActive ? "greenText" : "grayText"} appendLeft6`}>
                              {section.isActive ? "Active" : "Inactive"}
                            </span>
                          </div>
                        </>
                      )
                    }}
                    renderActions={(section) => (
                      <div onClick={(e) => e.stopPropagation()}>
                        <ActionButtons
                          onEdit={() => handleEdit(section)}
                          onDelete={() => setDeletePopup({ isVisible: true, id: section._id, message: `Delete "${section.title || typeLabel(section.type)}"?` })}
                          loading={loading}
                          size="normal"
                          editText="✏️ Edit"
                          deleteText="🗑️ Delete"
                        />
                      </div>
                    )}
                    className="brandCard"
                  />
                  </div>
                )})
              }
              </div>
            )}

            {/* List View */}
            {viewMode === "list" && (
              <div className="brandsListTable">
                <div className="tableContainer">
                  <table className="brandsTable">
                    <thead>
                      <tr>
                        <th className="tableHeader">Column</th>
                        <th className="tableHeader">Order</th>
                        <th className="tableHeader">Title</th>
                        <th className="tableHeader">Type</th>
                        <th className="tableHeader">Status</th>
                        <th className="tableHeader">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSections.map((s) => (
                        <tr key={s._id} className={!s.isActive ? "rowInactive" : ""}>
                          <td className="tableCell">{s.displayLayout === "fullWidth" ? "Full width" : (s.columnIndex ?? 0) + 1}</td>
                          <td className="tableCell">{s.displayOrder ?? 0}</td>
                          <td className="tableCell fontSemiBold">{s.title || typeLabel(s.type)}</td>
                          <td className="tableCell">{typeLabel(s.type)}</td>
                          <td className="tableCell">
                            <span className={s.isActive ? "greenText" : "grayText"}>{s.isActive ? "Active" : "Inactive"}</span>
                          </td>
                          <td className="tableCell">
                            <ActionButtons
                              onEdit={() => handleEdit(s)}
                              onDelete={() => setDeletePopup({ isVisible: true, id: s._id, message: `Delete "${s.title || typeLabel(s.type)}"?` })}
                              loading={loading}
                              size="normal"
                              editText="✏️ Edit"
                              deleteText="🗑️ Delete"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Image popup (logo click in card view) */}
      {imagePopup.isVisible && (
        <div
          className="imagePopupOverlay"
          onClick={handleCloseImagePopup}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10000,
            cursor: "pointer",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "relative",
              maxWidth: "90vw",
              maxHeight: "90vh",
              backgroundColor: "white",
              borderRadius: "8px",
              padding: "20px",
              boxShadow: "0 4px 20px rgba(0, 0, 0, 0.3)",
            }}
          >
            <button
              type="button"
              onClick={handleCloseImagePopup}
              style={{
                position: "absolute",
                top: "10px",
                right: "10px",
                background: "#ff4444",
                color: "white",
                border: "none",
                borderRadius: "50%",
                width: "30px",
                height: "30px",
                fontSize: "20px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 10001,
              }}
              aria-label="Close"
            >
              ×
            </button>
            <img
              src={imagePopup.imageUrl}
              alt="Logo"
              style={{
                maxWidth: "100%",
                maxHeight: "85vh",
                objectFit: "contain",
                display: "block",
              }}
              onError={(e) => {
                e.target.style.display = "none"
              }}
            />
          </div>
        </div>
      )}

      <DeleteConfirmationPopup
        isVisible={deletePopup.isVisible}
        message={deletePopup.message}
        onConfirm={handleDelete}
        onCancel={() => setDeletePopup({ isVisible: false, id: null, message: "" })}
      />
    </div>
  )
}

export default FooterManager
