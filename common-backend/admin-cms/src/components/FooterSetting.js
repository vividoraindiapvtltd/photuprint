import React, { useState, useEffect, useCallback, useRef } from "react"
import api from "../api/axios"
import { useAuth } from "../context/AuthContext"
import { PageHeader, AlertMessage, FormField, EntityCard, EntityCardHeader, ActionButtons, DeleteConfirmationPopup } from "../common"

// Blank form state for creating a new theme (form stays blank by default)
const BLANK_THEME_FORM = {
  _id: null,
  name: "",
  createdAt: null,
  updatedAt: null,
  backgroundColor: "",
  titleFontSize: "",
  titleColor: "",
  linkFontSize: "",
  linkColor: "",
  linkHoverColor: "",
  bodyTextSize: "",
  bodyTextColor: "",
  inputBackgroundColor: "",
  inputTextColor: "",
  inputBorderColor: "",
  inputBorderRadius: "",
  subscribeButtonBackgroundColor: "",
  subscribeButtonTextColor: "",
  subscribeButtonBorderColor: "",
  subscribeButtonBorderRadius: "",
  socialIconColor: "",
  dividerColor: "",
  dividerThickness: "",
  footerColumns: 4,
  isActive: true,
}

// Parse "14px" -> 14, "" -> "" for numeric display
const parsePxValue = (str) => {
  if (!str || typeof str !== "string") return ""
  const num = str.replace(/px$/i, "").trim()
  if (num === "" || isNaN(Number(num))) return ""
  return Number(num)
}

// Numeric field with "px" shown after the text box (value stored as e.g. "14px")
const NumericPxField = ({ label, name, value, onChange, min = 1, max }) => {
  const numValue = parsePxValue(value)
  const handleChange = (e) => {
    const v = e.target.value
    const next = v === "" ? "" : `${v}px`
    onChange({ target: { name, value: next, type: "text" } })
  }
  return (
    <div className="makeFlex column appendBottom16">
      <label className="formLabel appendBottom8" htmlFor={`field-${name}`}>{label}</label>
      <div className="makeFlex alignCenter gap8">
        <input
          type="number"
          id={`field-${name}`}
          name={name}
          value={numValue}
          onChange={handleChange}
          min={min}
          max={max}
          className="formInput"
          style={{ width: "100%" }}
          placeholder="e.g. 14"
        />
        <span className="font14 grayText">px</span>
      </div>
    </div>
  )
}

// Color field: label + color picker (palette) + optional hex text
const ColorField = ({ label, value, onChange, placeholder = "#000000" }) => {
  const hex = value && value.trim() !== "" ? value : placeholder
  const safeHex = hex.startsWith("#") && /^#[0-9A-Fa-f]{6}$/.test(hex) ? hex : "#111827"
  return (
    <div className="makeFlex column appendBottom16">
      <label className="formLabel appendBottom8">{label}</label>
      <div className="makeFlex alignCenter gap10">
        <input
          type="color"
          value={safeHex}
          onChange={(e) => onChange(e.target.value)}
          className="formInput"
          style={{ width: 40, height: 36, padding: 2, cursor: "pointer" }}
          title="Choose color"
        />
        <input
          type="text"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="formInput"
          style={{ flex: 1, minWidth: 100 }}
        />
      </div>
    </div>
  )
}

const FooterSetting = () => {
  const { selectedWebsite } = useAuth()
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [themes, setThemes] = useState([])
  const [themeData, setThemeData] = useState(() => ({ ...BLANK_THEME_FORM }))
  const [editingId, setEditingId] = useState(null)
  const [themeSaving, setThemeSaving] = useState(false)
  const [themeDeleting, setThemeDeleting] = useState(false)
  const [activatingId, setActivatingId] = useState(null)
  const [deletePopup, setDeletePopup] = useState({ isVisible: false, themeId: null })
  const [showForm, setShowForm] = useState(false)
  const formRef = useRef(null)

  const scrollToForm = () => {
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
    }, 50)
  }

  const handleAddTheme = () => {
    setThemeData({ ...BLANK_THEME_FORM })
    setEditingId(null)
    setShowForm(true)
    scrollToForm()
  }

  const handleEditTheme = (theme) => {
    setThemeData({
      _id: theme._id,
      name: theme.name || "",
      createdAt: theme.createdAt || null,
      updatedAt: theme.updatedAt || null,
      backgroundColor: theme.backgroundColor || "",
      titleFontSize: theme.titleFontSize || "",
      titleColor: theme.titleColor || "",
      linkFontSize: theme.linkFontSize || "",
      linkColor: theme.linkColor || "",
      linkHoverColor: theme.linkHoverColor || "",
      bodyTextSize: theme.bodyTextSize || "",
      bodyTextColor: theme.bodyTextColor || "",
      inputBackgroundColor: theme.inputBackgroundColor || "",
      inputTextColor: theme.inputTextColor || "",
      inputBorderColor: theme.inputBorderColor || "",
      inputBorderRadius: theme.inputBorderRadius || "",
      subscribeButtonBackgroundColor: theme.subscribeButtonBackgroundColor || "",
      subscribeButtonTextColor: theme.subscribeButtonTextColor || "",
      subscribeButtonBorderColor: theme.subscribeButtonBorderColor || "",
      subscribeButtonBorderRadius: theme.subscribeButtonBorderRadius || "",
      socialIconColor: theme.socialIconColor || "",
      dividerColor: theme.dividerColor || "",
      dividerThickness: theme.dividerThickness || "",
      footerColumns: [2, 3, 4].includes(Number(theme.footerColumns)) ? Number(theme.footerColumns) : 4,
      isActive: theme.isActive !== false,
    })
    setEditingId(theme._id)
    setShowForm(true)
    scrollToForm()
  }

  const handleDeleteTheme = (themeId) => {
    setDeletePopup({
      isVisible: true,
      themeId,
      message: "Are you sure you want to delete this footer theme?",
    })
  }

  const handleDeleteConfirm = async () => {
    const { themeId } = deletePopup
    if (!themeId) return
    try {
      setThemeDeleting(true)
      await api.delete(`/footer-sections/theme/${themeId}`)
      setSuccess("Footer theme deleted.")
      setDeletePopup({ isVisible: false, themeId: null })
      if (editingId === themeId) {
        setThemeData({ ...BLANK_THEME_FORM })
        setEditingId(null)
        setShowForm(false)
      }
      fetchThemes()
    } catch (err) {
      setError(err.response?.data?.msg || "Failed to delete footer theme.")
    } finally {
      setThemeDeleting(false)
    }
  }

  const handleDeleteCancel = () => {
    setDeletePopup({ isVisible: false, themeId: null })
  }

  const handleSetActive = async (themeId) => {
    try {
      setActivatingId(themeId)
      await api.put(`/footer-sections/theme/${themeId}/activate`)
      setSuccess("Active theme updated.")
      fetchThemes()
    } catch (err) {
      setError(err.response?.data?.msg || "Failed to set active theme.")
    } finally {
      setActivatingId(null)
    }
  }

  const handleDeactivate = async (themeId) => {
    try {
      setActivatingId(themeId)
      await api.put(`/footer-sections/theme/${themeId}`, { isActive: false })
      setSuccess("Theme set to inactive.")
      fetchThemes()
    } catch (err) {
      setError(err.response?.data?.msg || "Failed to deactivate theme.")
    } finally {
      setActivatingId(null)
    }
  }

  const fetchThemes = useCallback(async () => {
    if (!selectedWebsite?._id) return
    try {
      const res = await api.get("/footer-sections/theme")
      setThemes(Array.isArray(res.data) ? res.data : [])
    } catch {
      setThemes([])
    }
  }, [selectedWebsite?._id])

  useEffect(() => {
    fetchThemes()
  }, [fetchThemes])

  const handleChange = (e) => {
    const { name, type, value, checked } = e.target
    setThemeData((p) => ({
      ...p,
      [name]: type === "checkbox" ? checked : value,
    }))
  }

  const handleSaveTheme = async (e) => {
    e.preventDefault()
    if (!selectedWebsite?._id) {
      setError("Please select a website first.")
      return
    }
    const payload = {
      name: themeData.name || undefined,
      backgroundColor: themeData.backgroundColor || undefined,
      titleFontSize: themeData.titleFontSize || undefined,
      titleColor: themeData.titleColor || undefined,
      linkFontSize: themeData.linkFontSize || undefined,
      linkColor: themeData.linkColor || undefined,
      linkHoverColor: themeData.linkHoverColor || undefined,
      bodyTextSize: themeData.bodyTextSize || undefined,
      bodyTextColor: themeData.bodyTextColor || undefined,
      inputBackgroundColor: themeData.inputBackgroundColor || undefined,
      inputTextColor: themeData.inputTextColor || undefined,
      inputBorderColor: themeData.inputBorderColor || undefined,
      inputBorderRadius: themeData.inputBorderRadius || undefined,
      subscribeButtonBackgroundColor: themeData.subscribeButtonBackgroundColor || undefined,
      subscribeButtonTextColor: themeData.subscribeButtonTextColor || undefined,
      subscribeButtonBorderColor: themeData.subscribeButtonBorderColor || undefined,
      subscribeButtonBorderRadius: themeData.subscribeButtonBorderRadius || undefined,
      socialIconColor: themeData.socialIconColor || undefined,
      dividerColor: themeData.dividerColor || undefined,
      dividerThickness: themeData.dividerThickness || undefined,
      footerColumns: [2, 3, 4].includes(Number(themeData.footerColumns)) ? Number(themeData.footerColumns) : undefined,
    }
    try {
      setThemeSaving(true)
      setError("")
      if (editingId) {
        await api.put(`/footer-sections/theme/${editingId}`, payload)
        setSuccess("Footer theme updated.")
      } else {
        await api.post("/footer-sections/theme", payload)
        setSuccess("Footer theme created.")
      }
      setThemeData({ ...BLANK_THEME_FORM })
      setEditingId(null)
      setShowForm(false)
      fetchThemes()
    } catch (err) {
      setError(err.response?.data?.msg || "Failed to create/update footer theme.")
    } finally {
      setThemeSaving(false)
    }
  }

  return (
    <div className="paddingAll20">
      <PageHeader
        title="Footer Setting"
        subtitle="Customize footer appearance: background, section titles, link and body text size and colors"
      />

      <AlertMessage type="success" message={success} onClose={() => setSuccess("")} autoClose={true} />
      <AlertMessage type="error" message={error} onClose={() => setError("")} autoClose={true} />

      {!selectedWebsite?._id ? (
        <div className="brandFormContainer paddingAll32">
          <p className="grayText">Please select a website first to manage footer style.</p>
        </div>
      ) : (
        <>
          {/* Section 1: Form – shown when adding new theme or when a custom theme exists (edit). */}
          {showForm && (
          <div className="brandFormContainer paddingAll32 appendBottom30" ref={formRef}>
            <h3 className="font18 fontSemiBold blackText appendBottom16">{editingId ? "Edit footer theme" : "Create footer theme"}</h3>
            <form onSubmit={handleSaveTheme} className="brandForm">
            <div className="makeFlex row gap10 appendBottom16">
              <div className="widthHalf">
                <FormField
                  label="Theme name (optional)"
                  type="text"
                  name="name"
                  value={themeData.name || ""}
                  onChange={handleChange}
                  placeholder="e.g. Dark, Light"
                />
              </div>
            </div>
            {/* Row 1: Background color */}
            <div className="makeFlex row gap10 appendBottom16">
              <div className="fullWidth">
                <ColorField
                  label="Background color"
                  value={themeData.backgroundColor}
                  onChange={(v) => setThemeData((p) => ({ ...p, backgroundColor: v }))}
                  placeholder="#111827"
                />
              </div>
            </div>

            {/* Row 2: Title font size (50%) + Title color (50%) */}
            <div className="makeFlex row gap10 appendBottom16">
              <div className="widthHalf">
                <NumericPxField
                  label="Title font size"
                  name="titleFontSize"
                  value={themeData.titleFontSize}
                  onChange={handleChange}
                />
              </div>
              <div className="widthHalf">
                <ColorField
                  label="Title color"
                  value={themeData.titleColor}
                  onChange={(v) => setThemeData((p) => ({ ...p, titleColor: v }))}
                  placeholder="#ffffff"
                />
              </div>
            </div>

            {/* Row 3: Link font size, Link color, Link hover color */}
            <div className="makeFlex row gap10 appendBottom16">
              <div className="flexOne" style={{ minWidth: 0 }}>
                <NumericPxField
                  label="Link font size"
                  name="linkFontSize"
                  value={themeData.linkFontSize}
                  onChange={handleChange}
                />
              </div>
              <div className="flexOne" style={{ minWidth: 0 }}>
                <ColorField
                  label="Link color"
                  value={themeData.linkColor}
                  onChange={(v) => setThemeData((p) => ({ ...p, linkColor: v }))}
                  placeholder="#9ca3af"
                />
              </div>
              <div className="flexOne" style={{ minWidth: 0 }}>
                <ColorField
                  label="Link hover color"
                  value={themeData.linkHoverColor}
                  onChange={(v) => setThemeData((p) => ({ ...p, linkHoverColor: v }))}
                  placeholder="#ffffff"
                />
              </div>
            </div>

            {/* Row 4: Body text size, Body text color */}
            <div className="makeFlex row gap10 appendBottom16">
              <div className="widthHalf">
                <NumericPxField
                  label="Body text size"
                  name="bodyTextSize"
                  value={themeData.bodyTextSize}
                  onChange={handleChange}
                />
              </div>
              <div className="widthHalf">
                <ColorField
                  label="Body text color"
                  value={themeData.bodyTextColor}
                  onChange={(v) => setThemeData((p) => ({ ...p, bodyTextColor: v }))}
                  placeholder="#9ca3af"
                />
              </div>
            </div>

            {/* Row: Text box theme (e.g. newsletter input) */}
            <div className="makeFlex row gap10 appendBottom16">
              <div className="widthHalf">
                <ColorField
                  label="Text box background"
                  value={themeData.inputBackgroundColor}
                  onChange={(v) => setThemeData((p) => ({ ...p, inputBackgroundColor: v }))}
                  placeholder="#1f2937"
                />
              </div>
              <div className="widthHalf">
                <ColorField
                  label="Text box text color"
                  value={themeData.inputTextColor}
                  onChange={(v) => setThemeData((p) => ({ ...p, inputTextColor: v }))}
                  placeholder="#ffffff"
                />
              </div>
            </div>
            <div className="makeFlex row gap10 appendBottom16">
              <div className="widthHalf">
                <ColorField
                  label="Text box border color"
                  value={themeData.inputBorderColor}
                  onChange={(v) => setThemeData((p) => ({ ...p, inputBorderColor: v }))}
                  placeholder="#4b5563"
                />
              </div>
              <div className="widthHalf">
                <NumericPxField
                  label="Text box border radius"
                  name="inputBorderRadius"
                  value={themeData.inputBorderRadius}
                  onChange={handleChange}
                  min={0}
                />
              </div>
            </div>
            <div className="makeFlex row gap10 appendBottom16">
              <div className="widthHalf">
                <ColorField
                  label="Social media icon color"
                  value={themeData.socialIconColor}
                  onChange={(v) => setThemeData((p) => ({ ...p, socialIconColor: v }))}
                  placeholder="#9ca3af"
                />
              </div>
            </div>

            {/* Row: Subscribe button theme */}
            <div className="makeFlex row gap10 appendBottom16">
              <div className="widthHalf">
                <ColorField
                  label="Subscribe button background"
                  value={themeData.subscribeButtonBackgroundColor}
                  onChange={(v) => setThemeData((p) => ({ ...p, subscribeButtonBackgroundColor: v }))}
                  placeholder="#ffffff"
                />
              </div>
              <div className="widthHalf">
                <ColorField
                  label="Subscribe button text color"
                  value={themeData.subscribeButtonTextColor}
                  onChange={(v) => setThemeData((p) => ({ ...p, subscribeButtonTextColor: v }))}
                  placeholder="#111827"
                />
              </div>
            </div>
            <div className="makeFlex row gap10 appendBottom16">
              <div className="widthHalf">
                <ColorField
                  label="Subscribe button border color"
                  value={themeData.subscribeButtonBorderColor}
                  onChange={(v) => setThemeData((p) => ({ ...p, subscribeButtonBorderColor: v }))}
                  placeholder="#e5e7eb"
                />
              </div>
              <div className="widthHalf">
                <NumericPxField
                  label="Subscribe button border radius"
                  name="subscribeButtonBorderRadius"
                  value={themeData.subscribeButtonBorderRadius}
                  onChange={handleChange}
                  min={0}
                />
              </div>
            </div>

            {/* Row 5: Divider color, Divider thickness */}
            <div className="makeFlex row gap10 appendBottom16">
              <div className="widthHalf">
                <ColorField
                  label="Divider color"
                  value={themeData.dividerColor}
                  onChange={(v) => setThemeData((p) => ({ ...p, dividerColor: v }))}
                  placeholder="#374151"
                />
              </div>
              <div className="widthHalf">
                <NumericPxField
                  label="Divider thickness"
                  name="dividerThickness"
                  value={themeData.dividerThickness}
                  onChange={handleChange}
                  min={0}
                />
              </div>
            </div>

            <div className="makeFlex row gap10 appendBottom16">
              <div className="widthHalf">
                <FormField
                  label="Footer columns"
                  type="select"
                  name="footerColumns"
                  value={String(themeData.footerColumns ?? 4)}
                  onChange={handleChange}
                  options={[
                    { value: "2", label: "2 columns" },
                    { value: "3", label: "3 columns" },
                    { value: "4", label: "4 columns (e.g. 2 sections in column 1, rest in same row)" },
                  ]}
                />
              </div>
            </div>
            <p className="font14 grayText appendBottom16">Assign each section to a column and order in Footer Manager. You can put multiple sections in one column (e.g. Column 1: two sections stacked; Columns 2–4 in the same row). Use &quot;Set active&quot; on a theme card to apply it on the storefront. Only one theme can be active at a time.</p>

            <button
              type="submit"
              className="btnPrimary"
              disabled={themeSaving}
              style={{ paddingLeft: 24, paddingRight: 24, minWidth: 220 }}
            >
              {themeSaving ? "Saving..." : editingId ? "Update footer theme" : "Create footer theme"}
            </button>
          </form>
          </div>
          )}

          {/* Section 2: Card/List view – multiple footer themes */}
          <div className="brandsListContainer paddingAll32">
            <div className="listHeader makeFlex spaceBetween end appendBottom24">
              <div className="leftSection">
                <h2 className="listTitle font30 fontBold blackText appendBottom16">
                  Footer themes ({themes.length})
                </h2>
              </div>
              <div className="rightSection makeFlex end gap10">
                <button
                  type="button"
                  className="btnPrimary"
                  onClick={handleAddTheme}
                  disabled={themeSaving}
                  title="Create a new footer theme"
                >
                  ➕ Add new footer theme
                </button>
              </div>
            </div>

            {themes.length === 0 ? (
              <div className="emptyState textCenter paddingAll60">
                <div className="emptyIcon appendBottom16">🎨</div>
                <h3 className="font22 fontSemiBold grayText appendBottom8">No footer themes yet</h3>
                <p className="font16 grayText appendBottom16">Create a footer theme to customize the storefront footer. The first theme you create will be set as active.</p>
                <button type="button" className="btnPrimary" onClick={handleAddTheme}>
                  ➕ Add new footer theme
                </button>
              </div>
            ) : (
              <div className="brandsGrid">
                {themes.map((theme) => (
                  <EntityCard
                    key={theme._id}
                    entity={{
                      ...theme,
                      name: theme.name || "Footer theme",
                      createdAt: theme.updatedAt || theme.createdAt,
                    }}
                    logoField="logo"
                    nameField="name"
                    idField="_id"
                    onEdit={() => handleEditTheme(theme)}
                    onDelete={() => handleDeleteTheme(theme._id)}
                    imagePlaceholderColor={theme.backgroundColor || "#6b7280"}
                    renderHeader={(entity) => (
                      <EntityCardHeader
                        entity={entity}
                        imageField="logo"
                        titleField="name"
                        dateField="createdAt"
                        imagePlaceholderColor={theme.backgroundColor || "#6b7280"}
                      />
                    )}
                    renderDetails={(entity) => (
                      <>
                        <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                          <span className="detailLabel font14 fontSemiBold grayText textUppercase">Status:</span>
                          <span className={`detailValue font14 appendLeft6 ${entity.isActive ? "greenText" : "inactive"}`}>
                            {entity.isActive ? "Active" : "Inactive"}
                          </span>
                        </div>
                        <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                          <span className="detailLabel font14 fontSemiBold grayText textUppercase">Background:</span>
                          <span className="detailValue font14 blackText appendLeft6">{entity.backgroundColor || "—"}</span>
                        </div>
                        <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                          <span className="detailLabel font14 fontSemiBold grayText textUppercase">Title:</span>
                          <span className="detailValue font14 blackText appendLeft6">{entity.titleFontSize || "—"} / {entity.titleColor || "—"}</span>
                        </div>
                        <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                          <span className="detailLabel font14 fontSemiBold grayText textUppercase">Text box / Social:</span>
                          <span className="detailValue font14 blackText appendLeft6">{entity.inputBackgroundColor ? "Input ✓" : "—"} / {entity.socialIconColor || "—"}</span>
                        </div>
                        <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                          <span className="detailLabel font14 fontSemiBold grayText textUppercase">Divider:</span>
                          <span className="detailValue font14 blackText appendLeft6">{entity.dividerColor || "—"} {entity.dividerThickness ? `· ${entity.dividerThickness}` : ""}</span>
                        </div>
                      </>
                    )}
                    renderActions={() => (
                      <div className="entityCardActions makeFlex gap10 flexWrap wrap">
                        {theme.isActive ? (
                          <button
                            type="button"
                            className="btnWarning"
                            onClick={() => handleDeactivate(theme._id)}
                            disabled={activatingId !== null}
                            title="Set this theme to inactive"
                          >
                            {activatingId === theme._id ? "..." : "Deactivate"}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btnSuccess"
                            onClick={() => handleSetActive(theme._id)}
                            disabled={activatingId !== null}
                            title="Apply this theme on the storefront"
                          >
                            {activatingId === theme._id ? "..." : "Set active"}
                          </button>
                        )}
                        <ActionButtons
                          onEdit={() => handleEditTheme(theme)}
                          onDelete={() => handleDeleteTheme(theme._id)}
                          loading={themeSaving || themeDeleting}
                          size="normal"
                          editText="✏️ Edit"
                          deleteText="🗑️ Delete"
                          editTitle="Edit footer theme"
                          deleteTitle="Delete footer theme"
                        />
                      </div>
                    )}
                    className="brandCard"
                  />
                ))}
              </div>
            )}
          </div>

          <DeleteConfirmationPopup
            isVisible={deletePopup.isVisible}
            message={deletePopup.message}
            onConfirm={handleDeleteConfirm}
            onCancel={handleDeleteCancel}
            confirmButtonText="Delete"
          />
        </>
      )}
    </div>
  )
}

export default FooterSetting
