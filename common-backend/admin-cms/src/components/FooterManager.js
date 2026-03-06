import React, { useState, useEffect, useCallback, useMemo, useRef } from "react"
import api from "../api/axios"
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

const SECTION_TYPES = [
  { value: "links", label: "Links Column" },
  { value: "contact", label: "Contact Info" },
  { value: "newsletter", label: "Newsletter" },
  { value: "social", label: "Social Links" },
  { value: "about", label: "About Us" },
  { value: "payment", label: "Payment Icons" },
  { value: "copyright", label: "Copyright" },
  { value: "custom", label: "Custom HTML" },
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
  const formRef = useRef(null)

  const initialForm = {
    type: "links",
    title: "",
    displayOrder: 0,
    isActive: true,
    config: {
      links: [],
      address: "",
      phone: "",
      email: "",
      description: "",
      logoUrl: "",
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
      const res = await api.get("/footer-sections?showInactive=true")
      setSections(res.data.sections || [])
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
    setFormData({
      type: section.type || "links",
      title: section.title || "",
      displayOrder: section.displayOrder ?? 0,
      isActive: section.isActive !== false,
      config: {
        links: (section.config?.links || []).map((l) => ({ ...l })),
        address: section.config?.address || "",
        phone: section.config?.phone || "",
        email: section.config?.email || "",
        description: section.config?.description || "",
        logoUrl: section.config?.logoUrl || "",
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
    return filtered.sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
  }, [sections, statusFilter, searchQuery])

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
      if (formData.type === "about") {
        payload.config.description = formData.config.description
        payload.config.logoUrl = formData.config.logoUrl
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
        links: [...(prev.config.links || []), { label: "", url: "", openInNewTab: false, displayOrder: prev.config.links?.length || 0 }],
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
            <div className="widthHalf">
              <FormField
                label="Display Order"
                type="number"
                name="displayOrder"
                value={formData.displayOrder}
                onChange={(e) => setFormData((p) => ({ ...p, displayOrder: parseInt(e.target.value, 10) || 0 }))}
                min={0}
              />
            </div>
          </div>

          {/* Type-specific config */}
          {formData.type === "links" && (
            <div className="appendBottom16" style={{ display: "flex", flexDirection: "column", gap: 10, flexWrap: "nowrap", width: "100%" }}>
              <span className="formLabel">Links</span>
              <span role="button" onClick={addLink} className="font14 fontSemiBold cursorPointer hoverUnderline" style={{ color: "#0891b2", whiteSpace: "nowrap" }} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && addLink()}>
                + Add Link
              </span>
              {(formData.config.links || []).map((link, i) => (
                <div key={i} className="border rounded paddingAll12" style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", flexShrink: 0 }}>
                  <input
                    placeholder="Label"
                    value={link.label}
                    onChange={(e) => updateLink(i, "label", e.target.value)}
                    className="formInput"
                    style={{ width: "30%" }}
                  />
                  <input
                    placeholder="URL"
                    value={link.url}
                    onChange={(e) => updateLink(i, "url", e.target.value)}
                    className="formInput"
                    style={{ width: "60%" }}
                  />
                  <label className="makeFlex gap10 alignCenter font12">
                    <input type="checkbox" checked={!!link.openInNewTab} onChange={(e) => updateLink(i, "openInNewTab", e.target.checked)} />
                    New tab
                  </label>
                  <span role="button" onClick={() => removeLink(i)} className="font14 grayText cursorPointer" style={{ fontSize: "1.2em" }} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && removeLink(i)} title="Remove">
                    ×
                  </span>
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
            <div className="makeFlex column gap10 appendBottom16">
                <FormField
                  label="Description"
                  type="textarea"
                  name="description"
                  value={formData.config.description}
                  onChange={(e) => setFormData((p) => ({ ...p, config: { ...p.config, description: e.target.value } }))}
                  rows={3}
                />
                <FormField
                  label="Logo URL"
                  type="text"
                  name="logoUrl"
                  value={formData.config.logoUrl}
                  onChange={(e) => setFormData((p) => ({ ...p, config: { ...p.config, logoUrl: e.target.value } }))}
                  placeholder="https://..."
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
                {filteredSections.map((s) => (
                  <EntityCard
                    key={s._id}
                    entity={s}
                    idField="_id"
                    onEdit={handleEdit}
                    onDelete={(id) => setDeletePopup({ isVisible: true, id, message: `Delete "${s.title || typeLabel(s.type)}"?` })}
                    loading={loading}
                    imagePlaceholderColor={generateBrandColor(s._id, s.title || typeLabel(s.type))}
                    renderHeader={(section) => (
                      <EntityCardHeader
                        entity={{ ...section, logo: null, name: section.title || typeLabel(section.type) }}
                        imageField="logo"
                        titleField="name"
                        dateField="createdAt"
                        generateColor={generateBrandColor}
                        imagePlaceholderColor={generateBrandColor(section._id, section.title || typeLabel(section.type))}
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
                      <ActionButtons
                        onEdit={() => handleEdit(section)}
                        onDelete={() => setDeletePopup({ isVisible: true, id: section._id, message: `Delete "${section.title || typeLabel(section.type)}"?` })}
                        loading={loading}
                        size="normal"
                        editText="✏️ Edit"
                        deleteText="🗑️ Delete"
                      />
                    )}
                    className="brandCard"
                  />
                ))}
              </div>
            )}

            {/* List View */}
            {viewMode === "list" && (
              <div className="brandsListTable">
                <div className="tableContainer">
                  <table className="brandsTable">
                    <thead>
                      <tr>
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
