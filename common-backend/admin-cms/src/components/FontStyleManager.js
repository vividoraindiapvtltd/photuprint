import React, { useState, useEffect, useCallback, useMemo, useRef } from "react"
import api from "../api/axios"
import {
  AlertMessage,
  ViewToggle,
  Pagination,
  EntityCard,
  ActionButtons,
  FormField,
  SearchField,
  StatusFilter,
  calculateStandardStatusCounts,
  filterEntitiesByStatus,
  DeleteConfirmationPopup,
  generateBrandColor,
} from "../common"

const FontStyleManager = () => {
  // Font states
  const [fonts, setFonts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  // Filter and view (same as BrandManager)
  const [typeFilter, setTypeFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [viewMode, setViewMode] = useState("card")
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(10)
  const [hasMoreCards, setHasMoreCards] = useState(false)
  const [displayedCards, setDisplayedCards] = useState([])

  // Upload tab state
  const [uploadForm, setUploadForm] = useState({
    name: "",
    family: "",
    weights: "400,700",
    previewText: "The quick brown fox jumps over the lazy dog",
    isActive: true,
    sortOrder: 0,
    file: null,
  })

  // Form state (inline like BrandManager; when set we show edit form in first container)
  const [editingFont, setEditingFont] = useState(null)
  const formRef = useRef(null)
  // Dropdown: which add form to show – "system_google" | "custom"
  const [addFontMode, setAddFontMode] = useState("system_google")
  const [formData, setFormData] = useState({
    name: "",
    family: "",
    type: "system",
    googleFontUrl: "",
    previewText: "The quick brown fox jumps over the lazy dog",
    isActive: true,
    sortOrder: 0,
  })

  // Delete/Restore confirmation (same pattern as BrandManager)
  const [deletePopup, setDeletePopup] = useState({
    isVisible: false,
    fontId: null,
    fontName: "",
    isPermanent: false,
    message: "",
    action: "delete", // "delete" | "revert"
  })

  const getPreviewUrl = (url) => {
    if (!url) return null
    if (url.startsWith("http://") || url.startsWith("https://")) return url
    if (url.startsWith("/uploads/")) return `${url}`
    return url
  }

  // Generate Google Fonts API v2 URL with all font weights (100–900)
  const getGoogleFontUrlWithAllWeights = (familyName) => {
    if (!familyName || !String(familyName).trim()) return ""
    const family = String(familyName).trim().replace(/ /g, "+")
    const weights = "100;200;300;400;500;600;700;800;900"
    return `https://fonts.googleapis.com/css2?family=${family}:wght@${weights}&display=swap`
  }

  // Load Google Fonts dynamically (each font with all weights 100–900)
  useEffect(() => {
    const googleFonts = fonts.filter((f) => f.type === "google" && f.isActive)
    if (googleFonts.length > 0) {
      const existingLink = document.querySelector('link[data-google-fonts-manager="true"]')
      const weights = "100;200;300;400;500;600;700;800;900"
      const familyParams = googleFonts.map((f) => {
        const family = (f.family || f.name || "").trim().replace(/ /g, "+")
        return family ? `${family}:wght@${weights}` : ""
      }).filter(Boolean).join("&family=")
      const googleFontsUrl = `https://fonts.googleapis.com/css2?family=${familyParams}&display=swap`

      if (existingLink) {
        if (existingLink.href !== googleFontsUrl) {
          existingLink.href = googleFontsUrl
        }
      } else {
        const link = document.createElement("link")
        link.href = googleFontsUrl
        link.rel = "stylesheet"
        link.setAttribute("data-google-fonts-manager", "true")
        document.head.appendChild(link)
      }
    }
  }, [fonts])

  // Load uploaded fonts dynamically via @font-face
  useEffect(() => {
    const uploadedFonts = fonts.filter((f) => f.type === "upload" && f.isActive && f.fileUrl)
    const existingStyle = document.querySelector('style[data-upload-fonts-manager="true"]')
    if (uploadedFonts.length === 0) {
      if (existingStyle) existingStyle.remove()
      return
    }

    const guessFormat = (fileUrl) => {
      const lower = String(fileUrl || "").toLowerCase()
      if (lower.endsWith(".woff2")) return "woff2"
      if (lower.endsWith(".woff")) return "woff"
      if (lower.endsWith(".ttf")) return "truetype"
      if (lower.endsWith(".otf")) return "opentype"
      return "woff2"
    }

    const css = uploadedFonts
      .map((f) => {
        const fileUrl = getPreviewUrl(f.fileUrl)
        const fmt = guessFormat(fileUrl)
        // family is what we use in fabric/text rendering
        const fam = (f.family || f.name || "").replace(/"/g, '\\"')
        if (!fileUrl || !fam) return ""
        return `@font-face{font-family:"${fam}";src:url("${fileUrl}") format("${fmt}");font-display:swap;}`
      })
      .filter(Boolean)
      .join("\n")

    if (existingStyle) {
      existingStyle.textContent = css
    } else {
      const style = document.createElement("style")
      style.setAttribute("data-upload-fonts-manager", "true")
      style.textContent = css
      document.head.appendChild(style)
    }
  }, [fonts])

  // Fetch fonts (same pattern as BrandManager: fetch all, filter client-side)
  const fetchFonts = useCallback(async () => {
    try {
      setLoading(true)
      const response = await api.get("/fonts?includeDeleted=true")
      setFonts(response.data || [])
      setError("")
    } catch (err) {
      console.error("Error fetching fonts:", err)
      setError("Failed to load fonts")
    } finally {
      setLoading(false)
    }
  }, [])

  // Filter fonts by type, status, search (client-side, same as BrandManager)
  const filteredFonts = useMemo(() => {
    let filtered = filterEntitiesByStatus(fonts, statusFilter)
    if (typeFilter !== "all") filtered = filtered.filter((f) => f.type === typeFilter)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      filtered = filtered.filter((f) => (f.name && f.name.toLowerCase().includes(q)) || (f.family && f.family.toLowerCase().includes(q)))
    }
    return filtered
  }, [fonts, typeFilter, statusFilter, searchQuery])

  // Pagination (list view)
  const totalPages = Math.ceil(filteredFonts.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const currentFonts = filteredFonts.slice(startIndex, startIndex + itemsPerPage)

  // Card lazy loading (same as BrandManager)
  useEffect(() => {
    if (viewMode === "card" && filteredFonts.length > 0) {
      setDisplayedCards(filteredFonts.slice(0, 16))
      setHasMoreCards(filteredFonts.length > 16)
      setCurrentPage(1)
    }
  }, [filteredFonts, viewMode])

  const handleLoadMoreCards = useCallback(() => {
    setDisplayedCards((prev) => {
      const next = filteredFonts.slice(0, prev.length + 16)
      setHasMoreCards(next.length < filteredFonts.length)
      return next
    })
  }, [filteredFonts])

  const handleViewModeChange = useCallback((newMode) => {
    setViewMode(newMode)
    setCurrentPage(1)
  }, [])

  const handlePageChange = useCallback((page) => {
    setCurrentPage(page)
  }, [])

  useEffect(() => {
    fetchFonts()
  }, [fetchFonts])

  // Handle form input changes (auto-fill Google Font URL with all weights when type is Google)
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData((prev) => {
      const next = { ...prev, [name]: type === "checkbox" ? checked : value }
      if (next.type === "google" && (next.name || next.family)) {
        next.googleFontUrl = getGoogleFontUrlWithAllWeights(next.family || next.name)
      }
      return next
    })
  }

  const handleUploadInputChange = (e) => {
    const { name, value, type, checked, files } = e.target
    setUploadForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : type === "file" ? (files && files[0] ? files[0] : null) : value,
    }))
  }

  const handleUploadSubmit = async (e) => {
    e.preventDefault()
    setError("")
    setSuccess("")

    try {
      if (!uploadForm.name.trim()) {
        setError("Font name is required")
        return
      }
      if (!uploadForm.file) {
        setError("Please choose a font file (.ttf, .otf, .woff, .woff2)")
        return
      }

      const fd = new FormData()
      fd.append("name", uploadForm.name.trim())
      fd.append("family", (uploadForm.family || uploadForm.name).trim())
      fd.append("weights", uploadForm.weights || "400,700")
      fd.append("previewText", uploadForm.previewText || "")
      fd.append("isActive", String(uploadForm.isActive))
      fd.append("sortOrder", String(uploadForm.sortOrder || 0))
      fd.append("fontFile", uploadForm.file)

      await api.post("/fonts/upload", fd)
      setSuccess("Font uploaded successfully!")
      setUploadForm((prev) => ({ ...prev, name: "", family: "", file: null }))
      fetchFonts()
      setTimeout(() => setSuccess(""), 3000)
    } catch (err) {
      console.error("Error uploading font:", err)
      setError(err.response?.data?.message || "Failed to upload font")
    }
  }

  // Open form for creating new font (clear edit state)
  const handleAddNew = () => {
    setEditingFont(null)
    setFormData({
      name: "",
      family: "",
      type: "system",
      googleFontUrl: "",
      previewText: "The quick brown fox jumps over the lazy dog",
      isActive: true,
      sortOrder: 0,
    })
  }

  // Open form for editing font (scroll to first container)
  const handleEdit = (font) => {
    setEditingFont(font)
    const familyOrName = font.family || font.name
    const googleFontUrl =
      font.type === "google" && familyOrName
        ? getGoogleFontUrlWithAllWeights(familyOrName)
        : (font.googleFontUrl || "")
    setFormData({
      name: font.name,
      family: font.family,
      type: font.type,
      googleFontUrl,
      previewText: font.previewText || "The quick brown fox jumps over the lazy dog",
      isActive: font.isActive,
      sortOrder: font.sortOrder || 0,
    })
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100)
  }

  const handleCancel = () => {
    setEditingFont(null)
  }

  // Handle form submission (system/Google add or edit)
  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")
    setSuccess("")
    try {
      const family = formData.family || formData.name
      const payload = {
        ...formData,
        family,
        googleFontUrl:
          formData.type === "google" && family
            ? getGoogleFontUrlWithAllWeights(family)
            : formData.googleFontUrl,
      }
      if (editingFont) {
        await api.put(`/fonts/${editingFont._id}`, payload)
        setSuccess("Font updated successfully!")
      } else {
        await api.post("/fonts", payload)
        setSuccess("Font created successfully!")
      }
      setEditingFont(null)
      fetchFonts()
      setTimeout(() => setSuccess(""), 3000)
    } catch (err) {
      console.error("Error saving font:", err)
      setError(err.response?.data?.message || "Failed to save font")
    }
  }

  // Toggle font status
  const handleToggleStatus = async (font) => {
    try {
      await api.patch(`/fonts/${font._id}/toggle-status`)
      fetchFonts()
      setSuccess(`Font ${font.isActive ? "deactivated" : "activated"} successfully!`)
      setTimeout(() => setSuccess(""), 3000)
    } catch (err) {
      console.error("Error toggling status:", err)
      setError("Failed to toggle font status")
    }
  }

  // Delete font (soft or permanent when already deleted – same pattern as BrandManager)
  const handleDelete = (font) => {
    const isPermanent = !!font.deleted
    setDeletePopup({
      isVisible: true,
      fontId: font._id,
      fontName: font.name,
      isPermanent,
      message: isPermanent
        ? `This font is already marked as deleted. Click OK to permanently remove it from the database. This action cannot be undone.`
        : `Are you sure you want to delete the font "${font.name}"? This will mark it as inactive and deleted.`,
      action: "delete",
    })
  }

  const handleRevert = (font) => {
    setDeletePopup({
      isVisible: true,
      fontId: font._id,
      fontName: font.name,
      isPermanent: false,
      message: `Are you sure you want to restore the font "${font.name}"? This will make it active again.`,
      action: "revert",
    })
  }

  const handleRevertConfirm = async () => {
    try {
      await api.patch(`/fonts/${deletePopup.fontId}/restore`)
      setSuccess("Font restored successfully!")
      setDeletePopup({ isVisible: false, fontId: null, fontName: "", isPermanent: false, message: "", action: "delete" })
      fetchFonts()
      setTimeout(() => setSuccess(""), 3000)
    } catch (err) {
      setError(err.response?.data?.message || "Failed to restore font")
    }
  }

  const handleDeleteCancel = () => {
    setDeletePopup({ isVisible: false, fontId: null, fontName: "", isPermanent: false, message: "", action: "delete" })
  }

  // Confirm delete
  const confirmDelete = async () => {
    try {
      if (deletePopup.isPermanent) {
        await api.delete(`/fonts/${deletePopup.fontId}/permanent`)
        setSuccess("Font permanently deleted!")
      } else {
        await api.delete(`/fonts/${deletePopup.fontId}`)
        setSuccess("Font deleted successfully!")
      }
      setDeletePopup({ isVisible: false, fontId: null, fontName: "", isPermanent: false, message: "", action: "delete" })
      fetchFonts()
      setTimeout(() => setSuccess(""), 3000)
    } catch (err) {
      console.error("Error deleting font:", err)
      setError("Failed to delete font")
    }
  }

  // Render fonts list (second container – card view + list view, same as BrandManager)
  const renderFontsList = () => (
    <div className="brandsListContainer paddingAll32">
        <div className="listHeader makeFlex spaceBetween end appendBottom24">
          <div className="leftSection">
            <h2 className="listTitle font30 fontBold blackText appendBottom16">Fonts ({filteredFonts.length})</h2>
            <StatusFilter
              statusFilter={statusFilter}
              onStatusChange={setStatusFilter}
              counts={calculateStandardStatusCounts(fonts)}
              disabled={loading}
            />
          </div>
          <div className="rightSection makeFlex end gap10 alignCenter">
            <label className="font14 fontSemiBold grayText">Type:</label>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="formSelect" style={{ minWidth: 140 }}>
              <option value="all">All Types</option>
              <option value="system">System</option>
              <option value="google">Google</option>
              <option value="upload">Uploaded</option>
            </select>
            <SearchField
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search fonts..."
              disabled={loading}
              minWidth="250px"
            />
            {loading && <div className="loadingIndicator grayText">Loading...</div>}
            <ViewToggle viewMode={viewMode} onViewChange={handleViewModeChange} disabled={loading} />
          </div>
        </div>

        {filteredFonts.length === 0 && !loading ? (
          <div className="emptyState textCenter paddingAll60">
            <div className="emptyIcon appendBottom16">🔤</div>
            <h3 className="font22 fontSemiBold grayText appendBottom8">No Fonts Found</h3>
            <p className="font16 grayText appendBottom16">Add system/Google fonts above or use the Upload Fonts tab</p>
          </div>
        ) : (
          <>
            {viewMode === "card" && (
              <div className="brandsGrid">
                {displayedCards.map((font) => (
                  <EntityCard
                    key={font._id}
                    entity={font}
                    nameField="name"
                    idField="_id"
                    onEdit={handleEdit}
                    onDelete={(id) => { const f = filteredFonts.find((x) => x._id === id); if (f) handleDelete(f) }}
                    loading={loading}
                    imagePlaceholderColor={generateBrandColor(font._id, font.name)}
                    showImage={false}
                    renderHeader={() => (
                      <div className="entityCardHeader makeFlex top gap10 appendBottom20">
                        <div className="entityLogo">
                          <div
                            className="entityLogoPlaceholder"
                            style={{ backgroundColor: generateBrandColor(font._id, font.name) }}
                          >
                            {(font.name || "?").charAt(0).toUpperCase()}
                          </div>
                        </div>
                        <div className="entityInfo flexOne">
                          <h3 className="entityName font20 fontBold blackText appendBottom4">{font.name}</h3>
                          <p
                            className="font14 grayText appendBottom4"
                            style={{ fontFamily: font.family || font.name, minHeight: 20 }}
                          >
                            {font.previewText || "The quick brown fox jumps over the lazy dog"}
                          </p>
                        </div>
                      </div>
                    )}
                    renderDetails={(f) => (
                      <>
                        <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                          <span className="detailLabel font14 fontSemiBold grayText textUppercase">Type:</span>
                          <span className="detailValue font14 blackText appendLeft6">{f.type}</span>
                        </div>
                        <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                          <span className="detailLabel font14 fontSemiBold grayText textUppercase">Family:</span>
                          <span className="detailValue font14 blackText appendLeft6">{f.family}</span>
                        </div>
                        <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                          <span className="detailLabel font14 fontSemiBold grayText textUppercase">Status:</span>
                          <span className={`detailValue font14 ${f.deleted ? "deleted" : f.isActive ? "greenText" : "inactive"} appendLeft6`}>
                            {f.deleted ? "Deleted" : f.isActive ? "Active" : "Inactive"}
                          </span>
                        </div>
                      </>
                    )}
                    renderActions={(f) => (
                      <ActionButtons
                        onEdit={f.deleted ? undefined : () => handleEdit(f)}
                        onDelete={() => handleDelete(f)}
                        onRevert={f.deleted ? () => handleRevert(f) : undefined}
                        loading={loading}
                        size="normal"
                        editText="✏️ Edit"
                        deleteText={f.deleted ? "🗑️ Final Del" : "🗑️ Delete"}
                        revertText="🔄 Revert Back"
                        editTitle="Edit Font"
                        deleteTitle={f.deleted ? "Final Del" : "Mark font as deleted"}
                        revertTitle="Restore this font"
                        editDisabled={f.deleted}
                      />
                    )}
                    className="brandCard"
                  />
                ))}
                {hasMoreCards && (
                  <div className="loadMoreContainer textCenter paddingAll20">
                    <button type="button" className="btnPrimary" onClick={handleLoadMoreCards} disabled={loading}>
                      {loading ? <span className="loadingSpinner">⏳</span> : <span>Load More</span>}
                    </button>
                  </div>
                )}
              </div>
            )}

            {viewMode === "list" && (
              <div className="brandsListTable">
                <div className="tableContainer">
                  <table className="brandsTable">
                    <thead>
                      <tr>
                        <th className="tableHeader">Preview</th>
                        <th className="tableHeader">Name</th>
                        <th className="tableHeader">Type</th>
                        <th className="tableHeader">Family</th>
                        <th className="tableHeader">Status</th>
                        <th className="tableHeader">Created</th>
                        <th className="tableHeader">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentFonts.map((font) => (
                        <tr key={font._id} className="tableRow">
                          <td className="tableCell width10">
                            <div
                              className="font14 grayText"
                              style={{ fontFamily: font.family || font.name, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis" }}
                            >
                              {font.previewText || "The quick brown fox..."}
                            </div>
                          </td>
                          <td className="tableCell width15 font14 blackText">{font.name}</td>
                          <td className="tableCell width10 font14 blackText">{font.type}</td>
                          <td className="tableCell width20 font14 blackText">{font.family}</td>
                          <td className="tableCell width10 font14 blackText">
                            <span className={`statusText ${font.deleted ? "deleted" : font.isActive ? "active" : "inactive"}`}>
                              {font.deleted ? "Deleted" : font.isActive ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td className="tableCell width10 font14 blackText">{font.createdAt ? new Date(font.createdAt).toLocaleDateString() : "—"}</td>
                          <td className="tableCell width15">
                            <div className="tableActions makeFlex gap8">
                              <ActionButtons
                                onEdit={font.deleted ? undefined : () => handleEdit(font)}
                                onDelete={() => handleDelete(font)}
                                onRevert={font.deleted ? () => handleRevert(font) : undefined}
                                loading={loading}
                                size="small"
                                editText="✏️"
                                deleteText={font.deleted ? "🗑️ Final Del" : "🗑️ Delete"}
                                revertText="🔄 Revert"
                                editTitle="Edit Font"
                                deleteTitle={font.deleted ? "Final Del" : "Delete"}
                                revertTitle="Restore"
                                editDisabled={font.deleted}
                              />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {totalPages > 1 && (
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={handlePageChange}
                    disabled={loading}
                    showGoToPage={true}
                  />
                )}
              </div>
            )}
          </>
        )}
      </div>
  )

  // First container: forms (add system/Google, upload custom, or edit form when editingFont) – same layout as BrandManager
  const renderFormsContainer = () => (
    <div className="brandFormContainer paddingAll32 appendBottom30" ref={formRef}>
      {editingFont ? (
        /* Edit font (system/Google or upload – metadata only) */
        <form onSubmit={handleSubmit} className="brandForm">
          <h3 className="font22 fontBold blackText appendBottom16" style={{ borderBottom: "2px solid #444", paddingBottom: 12 }}>
            Edit Font: {editingFont.name}
          </h3>
          <div className="makeFlex row gap10 appendBottom16">
            <div className="flexOne">
              <FormField type="text" name="name" label="Font Name *" value={formData.name} onChange={handleInputChange} placeholder="e.g., Roboto" required />
            </div>
            <div className="flexOne">
              <FormField type="text" name="family" label="Font Family" value={formData.family} onChange={handleInputChange} placeholder="CSS font-family" />
            </div>
          </div>
          {(editingFont.type === "system" || editingFont.type === "google") && (
            <div className="makeFlex row gap10 appendBottom16">
              <div style={{ width: "25%" }}>
                <FormField type="select" name="type" label="Type" value={formData.type} onChange={handleInputChange} options={[{ value: "system", label: "System" }, { value: "google", label: "Google" }]} />
              </div>
              {formData.type === "google" && (
                <div className="flexOne">
                  <FormField type="text" name="googleFontUrl" label="Google Font URL (auto: all weights 100–900)" value={formData.googleFontUrl} onChange={handleInputChange} placeholder="Auto-filled from font name" />
                </div>
              )}
            </div>
          )}
          <div className="makeFlex row gap10 appendBottom16">
            <div className="fullWidth">
              <FormField type="text" name="previewText" label="Preview Text" value={formData.previewText} onChange={handleInputChange} />
            </div>
          </div>
          <div className="makeFlex row gap10 appendBottom16">
            <div className="widthHalf">
              <FormField type="number" name="sortOrder" label="Sort Order" value={formData.sortOrder} onChange={handleInputChange} min={0} />
            </div>
          </div>
          <div className="makeFlex row gap10 appendBottom16">
            <label className="makeFlex gap10">
              <input type="checkbox" name="isActive" checked={formData.isActive} onChange={handleInputChange} />
              <span className="font14">Active</span>
            </label>
          </div>
          <div className="formActions paddingTop16 makeFlex gap10">
            <button type="submit" disabled={loading} className="btnPrimary">{loading ? "⏳" : "Update Font"}</button>
            <button type="button" onClick={handleCancel} className="btnSecondary">Cancel</button>
          </div>
        </form>
      ) : (
        <>
          {/* Add font – same structure and styles as Font Name (FormField) */}
          <div className="formField formFieldLabelTop appendBottom16">
            <label className="formLabel">Add font</label>
            <select
              value={addFontMode}
              onChange={(e) => setAddFontMode(e.target.value)}
              className="formSelect"
              style={{ minWidth: 220 }}
            >
              <option value="system_google">Add system and google font</option>
              <option value="custom">Custom font</option>
            </select>
          </div>

          {addFontMode === "system_google" ? (
            <form onSubmit={handleSubmit} className="brandForm">
              <h3 className="font22 fontBold blackText appendBottom16" style={{ borderBottom: "2px solid #444", paddingBottom: 12 }}>
                Add System or Google Font
              </h3>
              <div className="makeFlex row gap10 appendBottom16">
                <div className="flexOne">
                  <FormField type="text" name="name" label="Font Name *" value={formData.name} onChange={handleInputChange} placeholder="e.g., Roboto, Arial" required />
                </div>
                <div className="flexOne">
                  <FormField type="text" name="family" label="Font Family" value={formData.family} onChange={handleInputChange} placeholder="Defaults to name" />
                </div>
              </div>
              <div className="makeFlex row gap10 appendBottom16">
                <div className="widthHalf">
                  <FormField type="select" name="type" label="Type *" value={formData.type} onChange={handleInputChange} options={[{ value: "system", label: "System" }, { value: "google", label: "Google" }]} />
                </div>
                {formData.type === "google" && (
                  <div className="flexOne">
                    <FormField type="text" name="googleFontUrl" label="Google Font URL (auto: all weights 100–900)" value={formData.googleFontUrl} onChange={handleInputChange} placeholder="Auto-filled from font name" />
                  </div>
                )}
              </div>
              <div className="makeFlex row gap10 appendBottom16">
                <div className="fullWidth">
                  <FormField type="text" name="previewText" label="Preview Text" value={formData.previewText} onChange={handleInputChange} />
                </div>
              </div>
              <div className="makeFlex row gap10 appendBottom16">
                <div className="widthHalf">
                  <FormField type="number" name="sortOrder" label="Sort Order" value={formData.sortOrder} onChange={handleInputChange} min={0} />
                </div>
              </div>
              <div className="makeFlex row gap10 appendBottom16">
                <label className="makeFlex gap10">
                  <input type="checkbox" name="isActive" checked={formData.isActive} onChange={handleInputChange} />
                  <span className="font14">Active</span>
                </label>
              </div>
              <div className="formActions paddingTop16">
                <button type="submit" disabled={loading} className="btnPrimary">{loading ? "⏳" : "Create Font"}</button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleUploadSubmit} className="brandForm">
              <h3 className="font22 fontBold blackText appendBottom16" style={{ borderBottom: "2px solid #444", paddingBottom: 12 }}>
                Upload Custom Font
              </h3>
              <p className="font14 grayText appendBottom16">Upload .ttf, .otf, .woff, or .woff2 for PixelCraft templates.</p>
              <div className="makeFlex row gap10 appendBottom16">
                <div className="flexOne">
                  <FormField type="text" name="name" label="Font Name *" value={uploadForm.name} onChange={handleUploadInputChange} placeholder="e.g., MyBrand Sans" />
                </div>
                <div className="flexOne">
                  <FormField type="text" name="family" label="Font Family" value={uploadForm.family} onChange={handleUploadInputChange} placeholder="Defaults to name" />
                </div>
              </div>
              <div className="makeFlex row gap10 appendBottom16">
                <div className="flexOne">
                  <FormField type="text" name="weights" label="Weights" value={uploadForm.weights} onChange={handleUploadInputChange} placeholder="400,700" />
                </div>
                <div className="flexOne">
                  <FormField type="number" name="sortOrder" label="Sort Order" value={uploadForm.sortOrder} onChange={handleUploadInputChange} min={0} />
                </div>
              </div>
              <div className="makeFlex row gap10 appendBottom16">
                <div className="fullWidth">
                  <FormField type="text" name="previewText" label="Preview Text" value={uploadForm.previewText} onChange={handleUploadInputChange} />
                </div>
              </div>
              <div className="makeFlex row gap10 appendBottom16">
                <div className="fullWidth">
                  <label className="formLabel appendBottom8">Font File *</label>
                  <input type="file" name="file" accept=".ttf,.otf,.woff,.woff2" onChange={handleUploadInputChange} className="fullWidth" />
                  <p className="font12 grayText appendTop4">Supported: .ttf, .otf, .woff, .woff2</p>
                </div>
              </div>
              <div className="makeFlex row gap10 appendBottom16">
                <label className="makeFlex gap10">
                  <input type="checkbox" name="isActive" checked={uploadForm.isActive} onChange={handleUploadInputChange} />
                  <span className="font14">Active</span>
                </label>
              </div>
              <div className="formActions paddingTop16">
                <button type="submit" disabled={loading} className="btnPrimary">{loading ? "⏳" : "Upload Font"}</button>
              </div>
            </form>
          )}
        </>
      )}
    </div>
  )

  return (
    <div className="paddingAll20">
      <AlertMessage type="success" message={success} onClose={() => setSuccess("")} autoClose={true} />
      <AlertMessage type="error" message={error} onClose={() => setError("")} autoClose={true} />

      {/* First container: Add/Upload/Edit font forms (same as BrandManager form container) */}
      {renderFormsContainer()}

      {/* Second container: View fonts – card/list (same as BrandManager list container) */}
      {renderFontsList()}

      <DeleteConfirmationPopup
        isVisible={deletePopup.isVisible}
        message={deletePopup.message}
        onConfirm={deletePopup.action === "revert" ? handleRevertConfirm : confirmDelete}
        onCancel={handleDeleteCancel}
        confirmText={deletePopup.action === "revert" ? "Restore" : deletePopup.isPermanent ? "Final Del" : "Delete"}
        cancelText="Cancel"
        loading={loading}
      />
    </div>
  )
}

export default FontStyleManager
