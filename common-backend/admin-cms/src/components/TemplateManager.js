import React, { useState, useEffect, useMemo, useCallback, useRef } from "react"
import api from "../api/axios"
import { PageHeader, AlertMessage, ViewToggle, Pagination, EntityCard, FormField, SearchField, StatusFilter, DeleteConfirmationPopup, calculateStandardStatusCounts, filterEntitiesByStatus } from "../common"

const TemplateManager = () => {
  const [templates, setTemplates] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [editingId, setEditingId] = useState(null)

  const initialFormData = {
    name: "",
    description: "",
    categoryId: "",
    backgroundImages: [], // Array of files for background images
    logoImages: [], // Array of files for logo images
    textOption: false, // Toggle for text option (on/off)
    previewImage: null,
    isActive: false,
  }

  const [formData, setFormData] = useState(initialFormData)
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [existingBackgroundImages, setExistingBackgroundImages] = useState([]) // For displaying existing background images
  const [existingLogoImages, setExistingLogoImages] = useState([]) // For displaying existing logo images
  const [backgroundImagesToRemove, setBackgroundImagesToRemove] = useState([]) // Background images marked for removal
  const [logoImagesToRemove, setLogoImagesToRemove] = useState([]) // Logo images marked for removal
  const [existingPreviewImage, setExistingPreviewImage] = useState(null) // For displaying existing preview image

  // Delete confirmation popup state
  const [deletePopup, setDeletePopup] = useState({
    isVisible: false,
    templateId: null,
    message: "",
    isPermanentDelete: false,
    action: "delete",
  })

  // Refs
  const formRef = useRef(null)
  const nameInputRef = useRef(null)

  // View mode and pagination states
  const [viewMode, setViewMode] = useState("card")
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(10)
  const [hasMoreCards, setHasMoreCards] = useState(true)
  const [displayedCards, setDisplayedCards] = useState([])

  // Fetch categories for dropdown
  const fetchCategories = async () => {
    try {
      const response = await api.get("/categories?showInactive=true&includeDeleted=true")
      setCategories(response.data || [])
    } catch (err) {
      console.error("Error fetching categories:", err)
    }
  }

  // Fetch templates
  const fetchTemplates = async () => {
    try {
      setLoading(true)
      setError("") // Clear previous errors
      const params = {
        includeDeleted: statusFilter === "deleted" ? "true" : "false",
      }

      if (debouncedSearchQuery) {
        params.search = debouncedSearchQuery
      }

      if (categoryFilter !== "all") {
        params.categoryId = categoryFilter
      }

      if (statusFilter === "active") {
        params.isActive = "true"
      } else if (statusFilter === "inactive") {
        params.isActive = "false"
      }

      const response = await api.get("/templates", { params })
      setTemplates(response.data || [])
    } catch (err) {
      console.error("Error fetching templates:", err)
      const errorMessage = err.response?.data?.msg || err.message || "Failed to load templates"
      setError(`❌ ${errorMessage}. Please ensure the backend server is running and the /api/templates endpoint is available.`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCategories()
  }, [])

  useEffect(() => {
    fetchTemplates()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearchQuery, statusFilter, categoryFilter])

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery)
    }, 500)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const handleChange = (e) => {
    const { name, value, type, checked, files } = e.target

    if (type === "checkbox") {
      setFormData({ ...formData, [name]: checked })
    } else if (type === "file") {
      if (name === "backgroundImages" || name === "logoImages") {
        // Handle multiple files for image categories
        setFormData({ ...formData, [name]: Array.from(files || []) })
      } else {
        setFormData({ ...formData, [name]: files[0] || null })
      }
    } else {
      setFormData({ ...formData, [name]: value })
    }
  }

  const handleRemoveBackgroundImage = (index) => {
    const newFiles = [...formData.backgroundImages]
    newFiles.splice(index, 1)
    setFormData({ ...formData, backgroundImages: newFiles })
  }

  const handleRemoveLogoImage = (index) => {
    const newFiles = [...formData.logoImages]
    newFiles.splice(index, 1)
    setFormData({ ...formData, logoImages: newFiles })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!formData.name || !formData.name.trim()) {
      setError("Template name is required")
      return
    }

    if (!formData.categoryId) {
      setError("Category is required")
      return
    }

    // Require at least one image in any category
    if ((!formData.backgroundImages || formData.backgroundImages.length === 0) && (!formData.logoImages || formData.logoImages.length === 0) && (!editingId || (existingBackgroundImages.length === 0 && existingLogoImages.length === 0))) {
      setError("At least one template image is required (Background or Logo)")
      return
    }

    try {
      setLoading(true)
      setSuccess("")
      setError("")

      const templateData = new FormData()
      templateData.append("name", formData.name.trim())
      templateData.append("description", formData.description.trim() || "")
      templateData.append("categoryId", formData.categoryId)
      templateData.append("isActive", formData.isActive ? "true" : "false")

      // Append background images
      if (formData.backgroundImages && formData.backgroundImages.length > 0) {
        formData.backgroundImages.forEach((file) => {
          if (file instanceof File) {
            templateData.append("backgroundImages", file)
          }
        })
      }

      // Append logo images
      if (formData.logoImages && formData.logoImages.length > 0) {
        formData.logoImages.forEach((file) => {
          if (file instanceof File) {
            templateData.append("logoImages", file)
          }
        })
      }

      // Append text option toggle
      templateData.append("textOption", formData.textOption ? "true" : "false")

      // Append files to remove (for update operation)
      if (editingId) {
        if (backgroundImagesToRemove.length > 0) {
          templateData.append("removeBackgroundImages", JSON.stringify(backgroundImagesToRemove))
        }
        if (logoImagesToRemove.length > 0) {
          templateData.append("removeLogoImages", JSON.stringify(logoImagesToRemove))
        }
      }

      if (formData.previewImage) {
        templateData.append("previewImage", formData.previewImage)
      }

      const hasNewFiles =
        (formData.backgroundImages && formData.backgroundImages.length > 0) ||
        (formData.logoImages && formData.logoImages.length > 0) ||
        !!formData.previewImage
      const hasRemovals = backgroundImagesToRemove.length > 0 || logoImagesToRemove.length > 0
      const scalarOnlyUpdate = editingId && !hasNewFiles && !hasRemovals

      console.log("Submitting template:", {
        name: formData.name,
        categoryId: formData.categoryId,
        backgroundImagesCount: formData.backgroundImages?.length || 0,
        logoImagesCount: formData.logoImages?.length || 0,
        textOption: formData.textOption,
        hasPreviewImage: !!formData.previewImage,
        isActive: formData.isActive,
        editingId: editingId || "new",
        scalarOnlyUpdate,
      })

      if (editingId) {
        if (scalarOnlyUpdate) {
          await api.patch(`/templates/${editingId}/fields`, {
            name: formData.name.trim(),
            description: (formData.description || "").trim() || null,
            categoryId: formData.categoryId || undefined,
            isActive: formData.isActive,
            textOption: formData.textOption,
          })
          setSuccess(`✅ Template "${formData.name.trim()}" has been updated successfully!`)
        } else {
          await api.put(`/templates/${editingId}`, templateData)
          setSuccess(`✅ Template "${formData.name.trim()}" has been updated successfully!`)
        }
      } else {
        await api.post("/templates", templateData)
        setSuccess(`✅ Template "${formData.name.trim()}" has been created successfully!`)
      }

      await fetchTemplates()
      resetForm()
    } catch (err) {
      console.error("Error saving template:", err)
      console.error("Error response:", err.response?.data)
      console.error("Error status:", err.response?.status)

      // Get detailed error message
      let errorMessage = "Please try again."
      if (err.response?.data?.msg) {
        errorMessage = err.response.data.msg
      } else if (err.response?.data?.message) {
        errorMessage = err.response.data.message
      } else if (err.message) {
        errorMessage = err.message
      }

      setError(`❌ Failed to ${editingId ? "update" : "create"} template. ${errorMessage}`)
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData(initialFormData)
    setEditingId(null)
    setExistingBackgroundImages([])
    setExistingLogoImages([])
    setBackgroundImagesToRemove([])
    setLogoImagesToRemove([])
    setExistingPreviewImage(null)
    setError("")
  }

  // Handle removing existing images
  const handleRemoveExistingBackgroundImage = (fileUrl) => {
    if (backgroundImagesToRemove.includes(fileUrl)) {
      setBackgroundImagesToRemove(backgroundImagesToRemove.filter((url) => url !== fileUrl))
    } else {
      setBackgroundImagesToRemove([...backgroundImagesToRemove, fileUrl])
    }
  }

  const handleRemoveExistingLogoImage = (fileUrl) => {
    if (logoImagesToRemove.includes(fileUrl)) {
      setLogoImagesToRemove(logoImagesToRemove.filter((url) => url !== fileUrl))
    } else {
      setLogoImagesToRemove([...logoImagesToRemove, fileUrl])
    }
  }

  const handleEdit = (template) => {
    const raw =
      template.category?._id ?? template.categoryId?._id ?? template.categoryId ?? template.category
    const categoryId = raw != null ? String(raw) : ""

    setFormData({
      ...initialFormData,
      name: template.name || "",
      description: template.description || "",
      categoryId: categoryId,
      backgroundImages: [], // Don't pre-fill file inputs - new files will be added to existing
      logoImages: [],
      textOption: template.textOption !== undefined ? template.textOption : false,
      previewImage: null,
      isActive: template.isActive !== undefined ? template.isActive : false,
    })
    setEditingId(template._id || template.id)
    setExistingBackgroundImages(template.backgroundImages || []) // Set existing background images for display
    setExistingLogoImages(template.logoImages || []) // Set existing logo images for display
    setBackgroundImagesToRemove([]) // Reset files to remove
    setLogoImagesToRemove([])
    setExistingPreviewImage(template.previewImage || null) // Set existing preview
    setError("")
    setSuccess("")

    setTimeout(() => {
      if (formRef.current) {
        formRef.current.scrollIntoView({ behavior: "smooth", block: "start" })
      }
      if (nameInputRef.current) {
        nameInputRef.current.focus()
      }
    }, 100)
  }

  const handleDelete = (templateId) => {
    const template = templates.find((t) => t._id === templateId)
    const isDeleted = template?.deleted

    setDeletePopup({
      isVisible: true,
      templateId,
      message: isDeleted ? `Are you sure you want to permanently delete template "${template?.name}"? This action cannot be undone.` : `Are you sure you want to delete template "${template?.name}"?`,
      isPermanentDelete: isDeleted,
      action: isDeleted ? "permanent-delete" : "delete",
    })
  }

  const handleDeleteConfirm = async () => {
    const { templateId, isPermanentDelete } = deletePopup

    try {
      setLoading(true)
      setSuccess("")
      setError("")

      console.log("Deleting template:", templateId, "Permanent:", isPermanentDelete)
      const response = await api.delete(`/templates/${templateId}${isPermanentDelete ? "?permanent=true" : ""}`)
      console.log("Delete response:", response.data)

      setSuccess(`✅ Template has been ${isPermanentDelete ? "permanently deleted" : "deleted"} successfully!`)

      await fetchTemplates()
    } catch (err) {
      console.error("Delete error:", err)
      console.error("Error response:", err.response?.data)
      console.error("Error status:", err.response?.status)
      const errorMessage = err.response?.data?.msg || err.message || "Please try again."
      setError(`❌ Failed to delete template. ${errorMessage}`)
    } finally {
      setLoading(false)
      setDeletePopup({ isVisible: false, templateId: null, message: "", isPermanentDelete: false, action: "delete" })
    }
  }

  const handleDeleteCancel = () => {
    setDeletePopup({ isVisible: false, templateId: null, message: "", isPermanentDelete: false, action: "delete" })
  }

  // Filtered templates
  const filteredTemplates = useMemo(() => {
    let filtered = [...templates]

    if (statusFilter !== "all") {
      filtered = filterEntitiesByStatus(filtered, statusFilter)
    }

    return filtered
  }, [templates, statusFilter])

  // Status counts
  const statusCounts = useMemo(() => {
    return calculateStandardStatusCounts(templates)
  }, [templates])

  // Pagination for list view
  const totalPages = Math.ceil(filteredTemplates.length / itemsPerPage)
  const paginatedTemplates = useMemo(() => {
    if (viewMode === "list") {
      const start = (currentPage - 1) * itemsPerPage
      return filteredTemplates.slice(start, start + itemsPerPage)
    }
    return filteredTemplates
  }, [filteredTemplates, currentPage, itemsPerPage, viewMode])

  const handlePageChange = (page) => {
    setCurrentPage(page)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  // Card view infinite scroll
  const handleLoadMoreCards = useCallback(() => {
    const currentLength = displayedCards.length
    const nextBatch = filteredTemplates.slice(currentLength, currentLength + 10)

    if (nextBatch.length === 0) {
      setHasMoreCards(false)
      return
    }

    setDisplayedCards([...displayedCards, ...nextBatch])
  }, [displayedCards, filteredTemplates])

  useEffect(() => {
    if (viewMode === "card") {
      setDisplayedCards(filteredTemplates.slice(0, 10))
      setHasMoreCards(filteredTemplates.length > 10)
    } else {
      setCurrentPage(1)
    }
  }, [viewMode, filteredTemplates])

  const getCategoryName = (template) => {
    // Use direct categoryName field (fastest, stored in DB)
    if (template.categoryName) {
      return template.categoryName
    }
    // Fallback to populated category reference
    return template.category?.name || template.categoryId?.name || "Unknown Category"
  }

  return (
    <div className="paddingAll20">
      <PageHeader title="Template Manager" subtitle="Upload and manage one template per category with multiple template images. Each category can have one template with multiple design variations." />

      <AlertMessage
        error={error}
        success={success}
        onClose={() => {
          setError("")
          setSuccess("")
        }}
      />

      {/* Search and Filters */}
      <div className="brandFormContainer paddingAll32 appendBottom30">
        <div className="listHeader makeFlex spaceBetween alignCenter wrap gap10">
          <div className="leftSection">
            <SearchField value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search templates..." />
          </div>
          <div className="rightSection makeFlex gap10 wrap">
            <StatusFilter statusFilter={statusFilter} onStatusChange={setStatusFilter} statusCounts={statusCounts} />
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="formSelect" style={{ minWidth: "200px" }}>
              <option value="all">All Categories</option>
              {categories
                .filter((cat) => !cat.deleted)
                .map((cat) => {
                  const hasTemplate = templates.some((t) => (t.category?._id === cat._id || t.categoryId?._id === cat._id || t.categoryId === cat._id || t.category === cat._id) && !t.deleted)
                  return (
                    <option key={cat._id} value={cat._id}>
                      {cat.name} {hasTemplate && "(has template)"}
                    </option>
                  )
                })}
            </select>
            <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="brandFormContainer paddingAll32 appendBottom30" ref={formRef}>
        <h3 className="font20 fontBold appendBottom20">{editingId ? "Edit Template" : "Add New Template"}</h3>
        {!editingId && (
          <p className="font14 grayText appendBottom20" style={{ fontStyle: "italic" }}>
            💡 You can create multiple templates for the same category. Each template can have multiple template images for design variations.
          </p>
        )}
        {editingId && (
          <p className="font14 grayText appendBottom20" style={{ fontStyle: "italic" }}>
            💡 You can add more template images to this template. New images will be added to existing ones.
          </p>
        )}
        <form onSubmit={handleSubmit} className="brandForm">
          <FormField label="Template Name" name="name" type="text" value={formData.name} onChange={handleChange} required inputRef={nameInputRef} />
          <FormField label="Description" name="description" type="textarea" value={formData.description} onChange={handleChange} rows={3} />
          <FormField
            label="Category"
            name="categoryId"
            type="select"
            value={formData.categoryId}
            onChange={handleChange}
            required
            options={[
              { value: "", label: "Select Category" },
              ...categories
                .filter((cat) => !cat.deleted)
                .map((cat) => {
                  const templateCount = templates.filter((t) => (t.category?._id === cat._id || t.categoryId?._id === cat._id || t.categoryId === cat._id || t.category === cat._id) && !t.deleted && t._id !== editingId).length
                  return {
                    value: cat._id,
                    label: `${cat.name}${templateCount > 0 ? ` (${templateCount} template${templateCount > 1 ? "s" : ""} exist)` : ""}`,
                  }
                }),
            ]}
          />
          {/* Background Images Section */}
          <div className="formRow appendBottom20" style={{ border: "1px solid #e5e7eb", padding: "16px", borderRadius: "8px", backgroundColor: "#f9fafb" }}>
            <h4 className="font16 fontBold appendBottom12" style={{ color: "#1f2937" }}>
              1. Background Images
            </h4>
            {editingId && existingBackgroundImages.length > 0 && (
              <div className="appendBottom12">
                <label className="formLabel appendBottom8">Existing Background Images:</label>
                <p className="font12 grayText appendBottom8">Click on an image to mark it for removal (red border = will be removed)</p>
                <div className="makeFlex gap10 wrap">
                  {existingBackgroundImages.map((fileUrl, index) => {
                    const isMarkedForRemoval = backgroundImagesToRemove.includes(fileUrl)
                    return (
                      <div key={index} className={`relative border p-2 rounded-md cursor-pointer transition-all ${isMarkedForRemoval ? "opacity-50 border-red-500 bg-red-50" : "border-gray-300 hover:border-blue-400"}`} onClick={() => handleRemoveExistingBackgroundImage(fileUrl)} title={isMarkedForRemoval ? "Click to keep this file" : "Click to remove this file"}>
                        {fileUrl.includes("cloudinary.com") || fileUrl.startsWith("http") ? <img src={fileUrl} alt={`Background ${index + 1}`} className="w-20 h-20 object-cover rounded" /> : <img src={`http://localhost:8080${fileUrl}`} alt={`Background ${index + 1}`} className="w-20 h-20 object-cover rounded" />}
                        <div className={`absolute top-0 right-0 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold ${isMarkedForRemoval ? "bg-green-500 text-white" : "bg-red-500 text-white"}`}>{isMarkedForRemoval ? "✓" : "✕"}</div>
                        {isMarkedForRemoval && <div className="absolute bottom-0 left-0 right-0 bg-red-500 text-white text-xs text-center py-1 rounded-b">Will Remove</div>}
                      </div>
                    )
                  })}
                </div>
                {backgroundImagesToRemove.length > 0 && <p className="font12 text-red-600 appendTop8">⚠️ {backgroundImagesToRemove.length} background image(s) will be removed.</p>}
              </div>
            )}
            <FormField label="Upload Background Images" name="backgroundImages" type="file" onChange={handleChange} accept="image/*,.psd,.ai,.pdf" multiple info={editingId ? "Select multiple background images to add to existing ones" : "Upload multiple background images (images, PSD, AI, PDF). You can select multiple files at once."} />
            {formData.backgroundImages.length > 0 && (
              <div className="currentImageDisplay" style={{ marginTop: "10px" }}>
                <p className="font14 fontBold appendBottom8">New Background Images to Upload ({formData.backgroundImages.length}):</p>
                <div className="makeFlex wrap gap10">
                  {formData.backgroundImages.map((file, index) => (
                    <div key={index} className="makeFlex alignCenter gap5" style={{ padding: "5px 10px", background: "#f3f4f6", borderRadius: "4px" }}>
                      <span className="font12">{file.name}</span>
                      <button type="button" onClick={() => handleRemoveBackgroundImage(index)} className="btnDelete btnSmall" style={{ padding: "2px 6px", fontSize: "10px" }}>
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Logo Images Section */}
          <div className="formRow appendBottom20" style={{ border: "1px solid #e5e7eb", padding: "16px", borderRadius: "8px", backgroundColor: "#f9fafb" }}>
            <h4 className="font16 fontBold appendBottom12" style={{ color: "#1f2937" }}>
              2. Logo Images
            </h4>
            {editingId && existingLogoImages.length > 0 && (
              <div className="appendBottom12">
                <label className="formLabel appendBottom8">Existing Logo Images:</label>
                <p className="font12 grayText appendBottom8">Click on an image to mark it for removal (red border = will be removed)</p>
                <div className="makeFlex gap10 wrap">
                  {existingLogoImages.map((fileUrl, index) => {
                    const isMarkedForRemoval = logoImagesToRemove.includes(fileUrl)
                    return (
                      <div key={index} className={`relative border p-2 rounded-md cursor-pointer transition-all ${isMarkedForRemoval ? "opacity-50 border-red-500 bg-red-50" : "border-gray-300 hover:border-blue-400"}`} onClick={() => handleRemoveExistingLogoImage(fileUrl)} title={isMarkedForRemoval ? "Click to keep this file" : "Click to remove this file"}>
                        {fileUrl.includes("cloudinary.com") || fileUrl.startsWith("http") ? <img src={fileUrl} alt={`Logo ${index + 1}`} className="w-20 h-20 object-cover rounded" /> : <img src={`http://localhost:8080${fileUrl}`} alt={`Logo ${index + 1}`} className="w-20 h-20 object-cover rounded" />}
                        <div className={`absolute top-0 right-0 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold ${isMarkedForRemoval ? "bg-green-500 text-white" : "bg-red-500 text-white"}`}>{isMarkedForRemoval ? "✓" : "✕"}</div>
                        {isMarkedForRemoval && <div className="absolute bottom-0 left-0 right-0 bg-red-500 text-white text-xs text-center py-1 rounded-b">Will Remove</div>}
                      </div>
                    )
                  })}
                </div>
                {logoImagesToRemove.length > 0 && <p className="font12 text-red-600 appendTop8">⚠️ {logoImagesToRemove.length} logo image(s) will be removed.</p>}
              </div>
            )}
            <FormField label="Upload Logo Images" name="logoImages" type="file" onChange={handleChange} accept="image/*,.psd,.ai,.pdf" multiple info={editingId ? "Select multiple logo images to add to existing ones" : "Upload multiple logo images (images, PSD, AI, PDF). You can select multiple files at once."} />
            {formData.logoImages.length > 0 && (
              <div className="currentImageDisplay" style={{ marginTop: "10px" }}>
                <p className="font14 fontBold appendBottom8">New Logo Images to Upload ({formData.logoImages.length}):</p>
                <div className="makeFlex wrap gap10">
                  {formData.logoImages.map((file, index) => (
                    <div key={index} className="makeFlex alignCenter gap5" style={{ padding: "5px 10px", background: "#f3f4f6", borderRadius: "4px" }}>
                      <span className="font12">{file.name}</span>
                      <button type="button" onClick={() => handleRemoveLogoImage(index)} className="btnDelete btnSmall" style={{ padding: "2px 6px", fontSize: "10px" }}>
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Text Option Images Section */}
          <div className="formRow appendBottom20" style={{ border: "1px solid #e5e7eb", padding: "16px", borderRadius: "8px", backgroundColor: "#f9fafb" }}>
            <h4 className="font16 fontBold appendBottom12" style={{ color: "#1f2937" }}>
              3. Text Option
            </h4>
            <div className="formRow">
              <label className="formLabel" style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
                <input type="checkbox" name="textOption" checked={formData.textOption} onChange={handleChange} className="formCheckbox" style={{ width: "20px", height: "20px", cursor: "pointer" }} />
                <span style={{ fontSize: "14px", fontWeight: "500" }}>Enable Text Option</span>
              </label>
              <p className="font12 grayText appendTop8" style={{ marginLeft: "30px" }}>
                Toggle this option to enable/disable text customization for this template.
              </p>
            </div>
          </div>
          <FormField label="Preview Image" name="previewImage" type="file" onChange={handleChange} accept="image/*" info={editingId ? "Leave empty to keep current preview" : "Upload preview thumbnail (optional)"} />
          {editingId && existingPreviewImage && formData.previewImage === null && (
            <div className="currentImageDisplay" style={{ marginTop: "10px" }}>
              <p className="font14 fontBold appendBottom8">Current Preview Image:</p>
              {existingPreviewImage.includes("cloudinary.com") || existingPreviewImage.startsWith("http") ? <img src={existingPreviewImage} alt="Current preview" className="w-40 h-40 object-cover rounded border border-gray-300" /> : <img src={`http://localhost:8080${existingPreviewImage}`} alt="Current preview" className="w-40 h-40 object-cover rounded border border-gray-300" />}
            </div>
          )}
          <div className="formRow">
            <label className="formLabel">
              <input type="checkbox" name="isActive" checked={formData.isActive} onChange={handleChange} className="formCheckbox" />
              <span style={{ marginLeft: "8px" }}>Active</span>
            </label>
          </div>
          <div className="formActions paddingTop16">
            <button type="submit" disabled={loading} className="btnPrimary">
              {loading ? <span className="loadingSpinner">⏳</span> : <span>{editingId ? "Update Template" : "Add Template"}</span>}
            </button>
            {editingId && (
              <button type="button" onClick={resetForm} className="btnSecondary" disabled={loading}>
                Cancel
              </button>
            )}
            {!editingId && success && (
              <button type="button" onClick={resetForm} className="btnSecondary">
                Add Another Template
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Templates List */}
      {loading && templates.length === 0 ? (
        <div className="textCenter padding20">
          <p className="loadingIndicator">Loading templates...</p>
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="textCenter padding20">
          <p className="emptyState">No templates found</p>
        </div>
      ) : viewMode === "card" ? (
        <>
          <div className="brandsGrid">
            {displayedCards.map((template) => (
              <EntityCard
                key={template._id || template.id}
                entity={template}
                title={template.name}
                subtitle={getCategoryName(template)}
                status={template.deleted ? "deleted" : template.isActive ? "active" : "inactive"}
                renderDetails={() => (
                  <div>
                    <div className="brandDetail makeFlex spaceBetween">
                      <span className="detailLabel">Template ID:</span>
                      <span className="detailValue">{template.templateId || "N/A"}</span>
                    </div>
                    {template.description && (
                      <div className="brandDetail makeFlex spaceBetween">
                        <span className="detailLabel">Description:</span>
                        <span className="detailValue" style={{ maxWidth: "200px", textAlign: "right" }}>
                          {template.description}
                        </span>
                      </div>
                    )}
                    <div className="brandDetail makeFlex spaceBetween">
                      <span className="detailLabel">Images:</span>
                      <span className="detailValue">{(template.backgroundImages?.length || 0) + (template.logoImages?.length || 0)} image(s)</span>
                    </div>
                    {(template.backgroundImages?.length > 0 || template.logoImages?.length > 0) && (
                      <div className="brandDetail" style={{ marginTop: "8px" }}>
                        <p className="font12 grayText appendBottom4">Template Images:</p>
                        <div className="makeFlex wrap gap5">
                          {template.backgroundImages?.slice(0, 2).map((fileUrl, idx) => (
                            <img key={`bg-${idx}`} src={fileUrl} alt={`${template.name} Background ${idx + 1}`} style={{ width: "60px", height: "60px", objectFit: "cover", borderRadius: "4px", border: "1px solid #e5e7eb" }} />
                          ))}
                          {template.logoImages?.slice(0, 2).map((fileUrl, idx) => (
                            <img key={`logo-${idx}`} src={fileUrl} alt={`${template.name} Logo ${idx + 1}`} style={{ width: "60px", height: "60px", objectFit: "cover", borderRadius: "4px", border: "1px solid #e5e7eb" }} />
                          ))}
                        </div>
                        <p className="font11 grayText appendTop4">
                          Background: {template.backgroundImages?.length || 0} | Logo: {template.logoImages?.length || 0} | Text Option: {template.textOption ? "Enabled" : "Disabled"}
                        </p>
                      </div>
                    )}
                    {template.previewImage && (
                      <div className="brandDetail" style={{ marginTop: "8px" }}>
                        <p className="font12 grayText appendBottom4">Preview:</p>
                        <img src={template.previewImage} alt={template.name} style={{ width: "100%", maxHeight: "150px", objectFit: "contain", borderRadius: "8px" }} />
                      </div>
                    )}
                  </div>
                )}
                renderActions={(template) => (
                  <div className="entityCardActions makeFlex gap10 wrap">
                    <button onClick={() => handleEdit(template)} className="btnEdit flexOne" disabled={loading}>
                      ✏️ Edit
                    </button>
                    <button onClick={() => handleDelete(template._id || template.id)} className="btnDelete flexOne" disabled={loading}>
                      🗑️ Delete
                    </button>
                  </div>
                )}
              />
            ))}
          </div>
          {hasMoreCards && (
            <div className="textCenter paddingTop20">
              <button onClick={handleLoadMoreCards} className="btnSecondary" disabled={loading}>
                Load More Templates
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="brandsListTable">
            <div className="tableContainer">
              <table className="brandsTable">
                <thead>
                  <tr>
                    <th className="tableHeader">Template Name</th>
                    <th className="tableHeader">Category</th>
                    <th className="tableHeader">Template ID</th>
                    <th className="tableHeader">Images</th>
                    <th className="tableHeader">Status</th>
                    <th className="tableHeader">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedTemplates.map((template) => (
                    <tr key={template._id || template.id} className="tableRow">
                      <td className="tableCell">
                        <div className="makeFlex alignCenter gap10">
                          {template.previewImage && <img src={template.previewImage} alt={template.name} className="tableLogoImage" style={{ width: "40px", height: "40px", objectFit: "cover", borderRadius: "4px" }} />}
                          <span className="font14 fontBold">{template.name}</span>
                        </div>
                      </td>
                      <td className="tableCell">
                        <p className="font14">{getCategoryName(template)}</p>
                      </td>
                      <td className="tableCell">
                        <p className="font12">{template.templateId || "N/A"}</p>
                      </td>
                      <td className="tableCell">
                        <p className="font14">{(template.backgroundImages?.length || 0) + (template.logoImages?.length || 0)} image(s)</p>
                        <p className="font11 grayText">
                          Bg: {template.backgroundImages?.length || 0} | Logo: {template.logoImages?.length || 0} | Text Option: {template.textOption ? "On" : "Off"}
                        </p>
                      </td>
                      <td className="tableCell">
                        <span className={`statusText ${template.deleted ? "deleted" : template.isActive ? "active" : "inactive"}`}>{template.deleted ? "Deleted" : template.isActive ? "Active" : "Inactive"}</span>
                      </td>
                      <td>
                        <div className="makeFlex gap5">
                          <button onClick={() => handleEdit(template)} className="btnEdit btnSmall" disabled={loading} title="Edit">
                            ✏️
                          </button>
                          <button onClick={() => handleDelete(template._id || template.id)} className="btnDelete btnSmall" disabled={loading} title="Delete">
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {totalPages > 1 && (
            <div className="paddingTop20">
              <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={handlePageChange} />
            </div>
          )}
        </>
      )}

      <DeleteConfirmationPopup isVisible={deletePopup.isVisible} message={deletePopup.message} onConfirm={handleDeleteConfirm} onCancel={handleDeleteCancel} isPermanentDelete={deletePopup.isPermanentDelete} />
    </div>
  )
}

export default TemplateManager
