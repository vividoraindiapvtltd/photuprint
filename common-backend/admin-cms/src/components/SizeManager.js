import React, { useState, useEffect, useMemo, useCallback, useRef } from "react"
import api from "../api/axios"
import { PageHeader, AlertMessage, ViewToggle, Pagination, EntityCard, EntityCardHeader, FormField, ActionButtons, SearchField, StatusFilter, DeleteConfirmationPopup, calculateStandardStatusCounts, filterEntitiesByStatus, generateEntityColor } from "../common"

const SizeManager = () => {
  const [sizes, setSizes] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [editingId, setEditingId] = useState(null)
  const initialFormData = {
    name: "",
    initial: "",
    description: "",
    image: null,
    isActive: false,
  }

  const [formData, setFormData] = useState(initialFormData)
  const [currentImageUrl, setCurrentImageUrl] = useState(null)
  const [searchQuery, setSearchQuery] = useState("") // Search query state
  const [statusFilter, setStatusFilter] = useState("all") // 'all', 'active', 'inactive', 'deleted'

  // Image popup state
  const [imagePopup, setImagePopup] = useState({
    isVisible: false,
    imageUrl: null
  })

  // Delete confirmation popup state
  const [deletePopup, setDeletePopup] = useState({
    isVisible: false,
    sizeId: null,
    message: "",
    isPermanentDelete: false,
    action: "delete", // "delete" or "revert"
  })

  // Refs for scroll and focus functionality
  const formRef = useRef(null)
  const sizeNameInputRef = useRef(null)
  const imageInputRef = useRef(null)

  // View mode and pagination states
  const [viewMode, setViewMode] = useState("card") // 'card' or 'list'
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(10) // For list view
  const [hasMoreCards, setHasMoreCards] = useState(true)
  const [displayedCards, setDisplayedCards] = useState([])

  // Validate image dimensions (max 1200x1200px)
  const validateImageDimensions = (file) => {
    return new Promise((resolve, reject) => {
      if (!file) {
        resolve({ isValid: true, error: "" })
        return
      }

      // Check if it's an image file
      if (!file.type.startsWith('image/')) {
        resolve({ isValid: false, error: "Please select a valid image file" })
        return
      }

      const img = new Image()
      const objectUrl = URL.createObjectURL(file)

      img.onload = () => {
        URL.revokeObjectURL(objectUrl)
        const maxDimension = 1200
        
        if (img.width > maxDimension || img.height > maxDimension) {
          resolve({ 
            isValid: false, 
            error: `Image dimensions (${img.width}x${img.height}px) exceed the maximum allowed size of ${maxDimension}x${maxDimension}px. Please resize your image.` 
          })
        } else {
          resolve({ isValid: true, error: "" })
        }
      }

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl)
        resolve({ isValid: false, error: "Failed to load image. Please select a valid image file." })
      }

      img.src = objectUrl
    })
  }

  // Helper function to normalize image URL
  const normalizeImageUrl = (imageUrl) => {
    if (!imageUrl) return null
    
    // If it's already a Cloudinary URL (starts with http/https), check for system paths
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      // Check if it's a system path incorrectly formatted
      if (imageUrl.includes('/backend/uploads/') || imageUrl.includes('/Users/')) {
        // Extract filename from system path
        const filename = imageUrl.split('/').pop()
        return `/uploads/${filename}`
      }
      // Otherwise it's a valid Cloudinary URL, return as is
      return imageUrl
    }
    
    // Handle old system paths that might be stored incorrectly
    if (imageUrl.includes('/backend/uploads/') || imageUrl.includes('/Users/')) {
      // Extract filename from system path
      const filename = imageUrl.split('/').pop()
      return `/uploads/${filename}`
    }
    
    // Handle relative paths
    if (imageUrl.startsWith('/uploads/') || imageUrl.startsWith('/')) {
      return `${imageUrl}`
    }
    
    // Relative path without leading slash
    return `/uploads/${imageUrl}`
  }

  const handleChange = async (e) => {
    const { name, value, type, checked, files } = e.target

    if (type === "checkbox") {
      setFormData({ ...formData, [name]: checked })
    } else if (type === "file") {
      // Validate image dimensions if it's an image file
      if (files[0] && files[0].type.startsWith('image/')) {
        const validation = await validateImageDimensions(files[0])
        if (!validation.isValid) {
          setError(validation.error)
          // Clear the file input
          e.target.value = ''
          return
        }
      }
      
      setFormData({ ...formData, [name]: files[0] || null })
      // Clear any previous error if validation passes
      if (error && error.includes('dimensions')) {
        setError("")
      }
    } else {
      setFormData({ ...formData, [name]: value })
    }
  }

  // Validate size name for duplicates
  const validateSizeName = (name) => {
    if (!name || !name.trim()) {
      return { isValid: false, error: "Size Name is required" }
    }

    // Check for duplicate names only against active, non-deleted sizes (excluding current size being edited)
    const existingSize = sizes.find(
      (size) =>
        size.name &&
        size.name.toLowerCase().trim() === name.toLowerCase().trim() &&
        size._id !== editingId &&
        size.isActive === true && // Only check against active sizes
        !size.deleted // Exclude deleted sizes
    )

    if (existingSize) {
      return { isValid: false, error: "Size name already exists" }
    }

    return { isValid: true, error: "" }
  }

  // Validate size initial for duplicates
  const validateSizeInitial = (initial) => {
    if (!initial || !initial.trim()) {
      return { isValid: true, error: "" }
    }

    // Check for duplicate initials only against active, non-deleted sizes (excluding current size being edited)
    const existingSize = sizes.find(
      (size) =>
        size.initial &&
        size.initial.toLowerCase().trim() === initial.toLowerCase().trim() &&
        size._id !== editingId &&
        size.isActive === true && // Only check against active sizes
        !size.deleted // Exclude deleted sizes
    )

    if (existingSize) {
      return { isValid: false, error: "Size initial already exists" }
    }

    return { isValid: true, error: "" }
  }

  // Validate and Add / Update Size
  const handleSubmit = async (e) => {
    e.preventDefault()

    // Validate size name
    const nameValidation = validateSizeName(formData.name)
    if (!nameValidation.isValid) {
      setError(nameValidation.error)
      return
    }

    // Validate size initial
    const initialValidation = validateSizeInitial(formData.initial)
    if (!initialValidation.isValid) {
      setError(initialValidation.error)
      return
    }

    try {
      setLoading(true)
      setSuccess("") // Clear any existing success message
      setError("") // Clear any existing error message

      let sizeData
      
      // Check if image is a File object (not a string URL from existing image)
      const hasNewImage = formData.image && formData.image instanceof File
      
      if (hasNewImage) {
        // Use FormData for file upload
        sizeData = new FormData()
        sizeData.append("name", formData.name.trim())
        sizeData.append("initial", formData.initial.trim())
        sizeData.append("description", formData.description.trim() || "")
        sizeData.append("isActive", formData.isActive ? "true" : "false")
        sizeData.append("image", formData.image)
      } else {
        // Use JSON for better boolean handling
        sizeData = {
          name: formData.name.trim(),
          initial: formData.initial.trim(),
          description: formData.description.trim() || "",
          isActive: formData.isActive,
          // If editing and no new image, send null to remove image, or keep existing
          image: editingId && !currentImageUrl ? null : (currentImageUrl || null)
        }
      }

      if (editingId) {
        // Update size
        await api.put(`/sizes/${editingId}`, sizeData)
        setSuccess(`✅ Size "${formData.name.trim()}" has been updated successfully!`)
      } else {
        // Create size
        await api.post("/sizes", sizeData)
        setSuccess(`✅ Size "${formData.name.trim()}" has been created successfully!`)
      }

      // Refresh sizes list
      await fetchSizes()
      
      // Reset form after successful submission (for both add and edit)
      resetForm()
      
    } catch (err) {
      console.error('Error submitting size:', err)
      if (err.response?.data?.msg?.includes('already exists')) {
        setError(`❌ ${err.response.data.msg}`)
      } else {
        const errorMsg = err.response?.data?.msg || err.message || 'Please try again.'
        setError(`❌ Failed to ${editingId ? "update" : "create"} size. ${errorMsg}`)
      }
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData(initialFormData)
    setCurrentImageUrl(null)
    setEditingId(null)
    setError("")
    // Clear file input
    if (imageInputRef.current) {
      imageInputRef.current.value = ''
    }
    // Don't clear success message here - let AlertMessage handle it
    // setSuccess("");
  }

  // Clear form after successful operations
  const clearForm = () => {
    setFormData(initialFormData)
    setCurrentImageUrl(null)
    setEditingId(null)
    setError("")
    setSuccess("")
    // Clear file input
    if (imageInputRef.current) {
      imageInputRef.current.value = ''
    }
  }

  // Edit size
  const handleEdit = (size) => {
    setFormData({
      ...initialFormData,
      name: size.name || "",
      initial: size.initial || "",
      description: size.description || "",
      image: null, // Reset image field for new file selection
      isActive: size.isActive !== undefined ? size.isActive : false,
    })
    // Only set currentImageUrl if size has a valid image
    const imageUrl = size.image && size.image.trim && size.image.trim() !== '' 
      ? normalizeImageUrl(size.image) 
      : null
    setCurrentImageUrl(imageUrl && imageUrl.trim() !== '' ? imageUrl : null)
    setEditingId(size._id || size.id)
    setError("")
    setSuccess("")

    // Scroll to form and focus on size name input
    setTimeout(() => {
      if (formRef.current) {
        formRef.current.scrollIntoView({
          behavior: "smooth",
          block: "start",
        })
      }
      if (sizeNameInputRef.current) {
        sizeNameInputRef.current.focus()
      }
    }, 100)
  }

  // Delete size
  const handleDelete = async (sizeId) => {
    // Find the size to check if it's already marked as deleted
    const size = sizes.find((s) => s._id === sizeId)
    const isAlreadyDeleted = size?.deleted

    let message
    let isPermanentDelete = false

    if (isAlreadyDeleted) {
      message = "This size is already marked as deleted. Click OK to permanently remove it from the database. This action cannot be undone."
      isPermanentDelete = true
    } else {
      message = "This will mark the size as inactive and add a deleted flag. Click OK to continue."
      isPermanentDelete = false
    }

    setDeletePopup({
      isVisible: true,
      sizeId,
      message,
      isPermanentDelete,
      action: "delete",
    })
  }

  // Handle delete confirmation
  const handleDeleteConfirm = async () => {
    const { sizeId, isPermanentDelete } = deletePopup
    const size = sizes.find((s) => s._id === sizeId)

    try {
      setLoading(true)
      setSuccess("") // Clear any existing success message
      setError("") // Clear any existing error message

      if (isPermanentDelete) {
        // Permanent deletion
        await api.delete(`/sizes/${sizeId}/hard`)
        setSuccess(`🗑️ Size "${size.name}" has been permanently deleted from the database.`)
      } else {
        // Soft delete - mark as inactive and add deleted flag
        await api.delete(`/sizes/${sizeId}`)
        setSuccess(`⏸️ Size "${size.name}" has been marked as deleted and inactive.`)
      }

      await fetchSizes()
    } catch (err) {
      const action = isPermanentDelete ? "permanently delete" : "mark as deleted"
      setError(`❌ Failed to ${action} size "${size.name}". ${err.response?.data?.msg || "Please try again."}`)
    } finally {
      setLoading(false)
      setDeletePopup({
        isVisible: false,
        sizeId: null,
        message: "",
        isPermanentDelete: false,
        action: "delete",
      })
    }
  }

  // Handle delete cancellation
  const handleDeleteCancel = () => {
    setDeletePopup({
      isVisible: false,
      sizeId: null,
      message: "",
      isPermanentDelete: false,
      action: "delete",
    })
  }

  // Revert deleted size
  const handleRevert = async (sizeId) => {
    const size = sizes.find((s) => s._id === sizeId)

    if (!size) {
      setError("Size not found")
      return
    }

    if (!size.deleted) {
      setError("This size is not deleted")
      return
    }

    setDeletePopup({
      isVisible: true,
      sizeId,
      message: `Are you sure you want to restore the size "${size.name}"? This will make it active again.`,
      isPermanentDelete: false,
      action: "revert",
    })
  }

  // Handle revert confirmation
  const handleRevertConfirm = async () => {
    const { sizeId } = deletePopup
    const size = sizes.find((s) => s._id === sizeId)

    try {
      setLoading(true)
      setSuccess("")
      setError("")

      // Check if there's already an active or inactive size with the same name or initial
      const existingSize = sizes.find(
        (s) =>
          s._id !== sizeId && // Exclude current size being reverted
          ((s.name && size.name && s.name.toLowerCase().trim() === size.name.toLowerCase().trim()) || (s.initial && size.initial && s.initial.toLowerCase().trim() === size.initial.toLowerCase().trim())) && // Same name or initial
          !s.deleted // Not deleted (active or inactive)
      )

      if (existingSize) {
        const status = existingSize.isActive ? "Active" : "Inactive"
        const conflict = existingSize.name && size.name && existingSize.name.toLowerCase().trim() === size.name.toLowerCase().trim() ? "name" : "initial"
        const suggestion = existingSize.isActive ? `Consider deleting the active size "${existingSize.name}" first, or use a different ${conflict} for the restored size.` : `Consider deleting the inactive size "${existingSize.name}" first, or use a different ${conflict} for the restored size.`

        setError(`❌ Cannot restore size "${size.name}". A ${status.toLowerCase()} size with this ${conflict} already exists. ${suggestion}`)
        setLoading(false)
        setDeletePopup({
          isVisible: false,
          sizeId: null,
          message: "",
          isPermanentDelete: false,
          action: "delete",
        })
        return
      }

      // Revert the size by setting deleted to false and isActive to true
      await api.put(`/sizes/${sizeId}`, {
        name: size.name,
        initial: size.initial,
        description: size.description,
        isActive: true,
        deleted: false,
      })

      setSuccess(`✅ Size "${size.name}" has been restored and is now active!`)
      await fetchSizes()
    } catch (err) {
      setError(`❌ Failed to restore size "${size.name}". ${err.response?.data?.msg || "Please try again."}`)
    } finally {
      setLoading(false)
      setDeletePopup({
        isVisible: false,
        sizeId: null,
        message: "",
        isPermanentDelete: false,
        action: "delete",
      })
    }
  }

  // Handle revert cancellation
  const handleRevertCancel = () => {
    setDeletePopup({
      isVisible: false,
      sizeId: null,
      message: "",
      isPermanentDelete: false,
      action: "delete",
    })
  }

  // Fetch sizes from backend
  const fetchSizes = async () => {
    try {
      setLoading(true)
      const response = await api.get("/sizes?showInactive=true&includeDeleted=true")

      // Process sizes to ensure proper image URLs
      const processedSizes = response.data.map((size) => {
        let imageUrl = size.image
        
        if (imageUrl) {
          // Use normalizeImageUrl to handle all URL formats
          imageUrl = normalizeImageUrl(imageUrl)
        }

        return {
          ...size,
          image: imageUrl,
        }
      })

      setSizes(processedSizes)
      setError("")
    } catch (err) {
      setError("Failed to fetch sizes")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSizes()
  }, [])

  // Filter sizes based on search query and status
  const filteredSizes = useMemo(() => {
    let filtered = sizes

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      filtered = filtered.filter((size) => (size.name && size.name.toLowerCase().includes(query)) || (size.initial && size.initial.toLowerCase().includes(query)) || (size.description && size.description.toLowerCase().includes(query)))
    }

    // Apply status filter
    filtered = filterEntitiesByStatus(filtered, statusFilter)

    return filtered
  }, [sizes, searchQuery, statusFilter])

  // Pagination calculations
  const totalPages = Math.ceil(filteredSizes.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentSizes = filteredSizes.slice(startIndex, endIndex)

  // Card lazy loading logic
  useEffect(() => {
    if (viewMode === "card") {
      const initialCards = filteredSizes.slice(0, 12)
      setDisplayedCards(initialCards)
      setHasMoreCards(filteredSizes.length > 12)
      setCurrentPage(1)
    }
  }, [viewMode, filteredSizes])

  // Reset pagination when search query changes
  const resetPaginationForSearch = useCallback(() => {
    setCurrentPage(1)
    if (viewMode === "card") {
      const initialCards = filteredSizes.slice(0, 12)
      setDisplayedCards(initialCards)
      setHasMoreCards(filteredSizes.length > 12)
    }
  }, [viewMode, filteredSizes.length])

  useEffect(() => {
    resetPaginationForSearch()
  }, [searchQuery, resetPaginationForSearch])

  // Handle page change for list view
  const handlePageChange = useCallback((pageNumber) => {
    setCurrentPage(pageNumber)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }, [])

  // Handle lazy loading for card view
  const handleLoadMoreCards = useCallback(() => {
    setDisplayedCards((prevCards) => {
      const currentCardCount = prevCards.length
      const nextCards = filteredSizes.slice(currentCardCount, currentCardCount + 12)

      if (nextCards.length > 0) {
        setHasMoreCards(currentCardCount + nextCards.length < filteredSizes.length)
        return [...prevCards, ...nextCards]
      } else {
        setHasMoreCards(false)
        return prevCards
      }
    })
  }, [filteredSizes])

  // Reset pagination when view mode changes
  const handleViewModeChange = useCallback(
    (mode) => {
      setViewMode(mode)
      setCurrentPage(1)
      if (mode === "card") {
        const initialCards = filteredSizes.slice(0, 12)
        setDisplayedCards(initialCards)
        setHasMoreCards(filteredSizes.length > 12)
      }
    },
    [filteredSizes.length]
  )

  const handleCancel = () => {
    resetForm()
  }

  // Handle remove image
  const handleRemoveImage = () => {
    setFormData({ ...formData, image: null })
    setCurrentImageUrl(null)
    if (imageInputRef.current) {
      imageInputRef.current.value = ''
    }
  }

  // Handle image click to show popup
  const handleImageClick = (imageUrl) => {
    if (imageUrl) {
      setImagePopup({
        isVisible: true,
        imageUrl: imageUrl
      })
    }
  }

  // Handle close image popup
  const handleCloseImagePopup = () => {
    setImagePopup({
      isVisible: false,
      imageUrl: null
    })
  }

  return (
    <div className="paddingAll20">
      {/* Header */}
      <PageHeader title="Size Management" subtitle="Manage your product sizes and classifications" isEditing={!!editingId} editText="Edit Size" createText="Add New Size" />

      {/* Success/Error Messages */}
      <AlertMessage type="success" message={success} onClose={() => setSuccess("")} autoClose={true} />

      <AlertMessage type="error" message={error} onClose={() => setError("")} autoClose={true} />

      {/* Form */}
      <div className="brandFormContainer paddingAll32 appendBottom30" ref={formRef}>
        <form onSubmit={handleSubmit} className="brandForm">
          <div className="makeFlex row gap10">
            <div className="fullWidth">
              <FormField ref={sizeNameInputRef} type="text" name="name" label="Size Name" value={formData.name} onChange={handleChange} placeholder="Enter Size Name (e.g., Small, Medium, Large)" required={true} />
            </div>
          </div>

          <div className="makeFlex row gap10">
            <div className="fullWidth">
              <FormField type="text" name="initial" label="Size Initial (optional)" value={formData.initial} onChange={handleChange} placeholder="Enter Size Initial (e.g., S, M, L)" required={false} maxLength={3} />
            </div>
          </div>

          <div className="makeFlex row gap10">
            <div className="fullWidth">
              <FormField 
                ref={imageInputRef}
                type="file" 
                name="image" 
                label="Size Image" 
                onChange={handleChange} 
                accept="image/*" 
                info="Supported formats: JPG, PNG, GIF, WEBP (Max size: 5MB, Max dimensions: 1200x1200px)" 
              />
              {/* Show current image if editing and image exists */}
              {editingId && currentImageUrl && typeof currentImageUrl === 'string' && currentImageUrl.trim() !== '' && currentImageUrl !== 'null' && currentImageUrl !== 'undefined' && currentImageUrl.length > 0 && (
                <div className="currentImageInfo paddingTop8">
                  <p className="font14 textUppercase blackText fontSemiBold" style={{ marginBottom: '10px' }}>Current image:</p>
                  <img
                    src={currentImageUrl}
                    alt="Current size image"
                    className="currentImagePreview"
                    style={{
                      maxWidth: "120px",
                      maxHeight: "120px",
                      objectFit: "cover",
                      borderRadius: "5px",
                      marginTop: "8px",
                      cursor: "pointer",
                    }}
                    onClick={() => handleImageClick(currentImageUrl)}
                    onError={(e) => {
                      console.error("Current image failed to load:", currentImageUrl)
                      e.target.style.display = "none"
                    }}
                  />
                  <div>
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className="btnSecondary"
                      style={{
                        padding: '4px',
                        fontSize: '12px',
                        backgroundColor: '#ff4444',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        marginTop: '10px',
                      }}
                    >
                      Remove Image
                    </button>
                  </div>
                </div>
              )}
              {/* Show remove button for newly selected image */}
              {!editingId && formData.image && formData.image instanceof File && (
                <div className="paddingTop8">
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    className="btnSecondary"
                    style={{
                      padding: '4px 12px',
                      fontSize: '12px',
                      backgroundColor: '#ff4444',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    Remove Selected Image
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="makeFlex row gap10">
            <div className="fullWidth">
              <FormField type="textarea" name="description" label="Description" value={formData.description} onChange={handleChange} placeholder="Enter Size Description" rows={3} />
            </div>
          </div>

          <div className="makeFlex row gap10">
            <div className="makeFlex column flexOne appendBottom16">
              <label className="formLabel appendBottom10">Status:</label>
              <label className="formLabel appendBottom8 makeFlex gap10">
                <FormField type="checkbox" name="isActive" value={formData.isActive} onChange={handleChange} />
                Active
              </label>
              <p className="negativeMarginTop10">Check this box to keep the size active, uncheck to mark as inactive</p>
            </div>
          </div>

          {/* Form Actions */}
          <div className="formActions paddingTop16">
            <button type="submit" disabled={loading} className="btnPrimary">
              {loading ? <span className="loadingSpinner">⏳</span> : <span>{editingId ? "Update Size" : "Add Size"}</span>}
            </button>

            {(editingId || (!editingId && (formData.name || formData.initial || formData.description || formData.image || currentImageUrl))) && (
              <button type="button" onClick={handleCancel} className="btnSecondary">
                Cancel
              </button>
            )}

            {!editingId && success && (
              <button type="button" onClick={clearForm} className="btnSecondary">
                Add Another Size
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Sizes List */}
      <div className="brandsListContainer paddingAll32">
        <div className="listHeader makeFlex spaceBetween end appendBottom24">
          <div className="leftSection">
            <h2 className="listTitle font30 fontBold blackText appendBottom16">Sizes ({filteredSizes.length})</h2>
            <StatusFilter statusFilter={statusFilter} onStatusChange={setStatusFilter} counts={calculateStandardStatusCounts(sizes)} disabled={loading} />
          </div>
          <div className="rightSection makeFlex end gap10">
            <SearchField value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search sizes..." disabled={loading} minWidth="250px" />
            {loading && <div className="loadingIndicator grayText">Loading...</div>}
            <ViewToggle viewMode={viewMode} onViewChange={handleViewModeChange} disabled={loading} />
          </div>
        </div>

        {filteredSizes.length === 0 && !loading ? (
          <div className="emptyState textCenter paddingAll60">
            <div className="emptyIcon appendBottom16">📏</div>
            <h3 className="font22 fontSemiBold grayText appendBottom8">No Sizes Found</h3>
            <p className="font16 grayText">Start by adding your first size above</p>
          </div>
        ) : (
          <>
            {/* Card View */}
            {viewMode === "card" && (
              <div className="brandsGrid">
                {displayedCards.map((size) => (
                  <EntityCard
                    key={size._id || size.id}
                    entity={size}
                    logoField="image"
                    nameField="name"
                    idField="_id"
                    onEdit={size.deleted ? undefined : handleEdit}
                    onDelete={handleDelete}
                    onRevert={size.deleted ? () => handleRevert(size._id || size.id) : undefined}
                    loading={loading}
                    imagePlaceholderColor={generateEntityColor(size._id || size.id, size.name)}
                    renderHeader={(size) => <EntityCardHeader entity={size} imageField="image" titleField="name" dateField="createdAt" generateColor={generateEntityColor} onImageClick={handleImageClick} />}
                    renderDetails={(size) => {
                      return (
                        <>
                          <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                            <span className="detailLabel font14 fontSemiBold grayText textUppercase">Size ID:</span>
                            <span className="detailValue font14 blackText appendLeft6">{size._id || "N/A"}</span>
                          </div>
                          <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                            <span className="detailLabel font14 fontSemiBold grayText textUppercase">Name:</span>
                            <span className="detailValue font14 blackText appendLeft6">{size.name}</span>
                          </div>
                          <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                            <span className="detailLabel font14 fontSemiBold grayText textUppercase">Initial:</span>
                            <span className="detailValue font14 blackText appendLeft6">{size.initial}</span>
                          </div>
                          {size.description && (
                            <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                              <span className="detailLabel font14 fontSemiBold grayText textUppercase">Description:</span>
                              <span className="detailValue font14 blackText appendLeft6">{size.description}</span>
                            </div>
                          )}
                          <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                            <span className="detailLabel font14 fontSemiBold grayText textUppercase">Status:</span>
                            <span className={`detailValue font14 ${size.deleted ? "deleted" : size.isActive ? "greenText" : "inactive"} appendLeft6`}>{size.deleted ? "Deleted" : size.isActive ? "Active" : "Inactive"}</span>
                          </div>
                        </>
                      )
                    }}
                    renderActions={(size) => <ActionButtons onEdit={size.deleted ? undefined : () => handleEdit(size)} onDelete={() => handleDelete(size._id || size.id)} onRevert={size.deleted ? () => handleRevert(size._id || size.id) : undefined} loading={loading} size="normal" editText="✏️ Edit" deleteText={size.deleted ? "🗑️ Final Del" : "🗑️ Delete"} revertText="🔄 Undelete" editTitle="Edit Size" deleteTitle={size.deleted ? "Final Del" : "Delete Size"} revertTitle="Restore Size" />}
                    className="brandCard"
                  />
                ))}
                {hasMoreCards && (
                  <div className="loadMoreContainer textCenter paddingAll20">
                    <button onClick={handleLoadMoreCards} className="btnPrimary" disabled={loading}>
                      {loading ? <span className="loadingSpinner">⏳</span> : <span>Load More</span>}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* List View */}
            {viewMode === "list" && (
              <div className="brandsListTable">
                <div className="tableContainer">
                  <table className="brandsTable">
                    <thead>
                      <tr>
                        <th className="tableHeader">Image</th>
                        <th className="tableHeader">Name</th>
                        <th className="tableHeader">Initial</th>
                        <th className="tableHeader">Description</th>
                        <th className="tableHeader">Status</th>
                        <th className="tableHeader">Created</th>
                        <th className="tableHeader">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentSizes.map((size) => (
                        <tr key={size._id || size.id} className="tableRow">
                          <td className="tableCell">
                            {size.image ? (
                              <img
                                src={size.image}
                                alt={size.name}
                                className="tableImage"
                                style={{
                                  width: "40px",
                                  height: "40px",
                                  objectFit: "cover",
                                  borderRadius: "4px",
                                  cursor: "pointer"
                                }}
                                onClick={() => handleImageClick(size.image)}
                                onError={(e) => {
                                  console.error("Image failed to load:", size.image)
                                  e.target.style.display = "none"
                                }}
                              />
                            ) : (
                              <div
                                className="tableImagePlaceholder"
                                style={{
                                  width: "40px",
                                  height: "40px",
                                  backgroundColor: generateEntityColor(size._id || size.id, size.name),
                                  borderRadius: "4px",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  color: "white",
                                  fontSize: "12px",
                                  fontWeight: "bold",
                                }}
                              >
                                {size.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </td>
                          <td className="tableCell">
                            <span className="brandNameText">{size.name}</span>
                          </td>
                          <td className="tableCell">
                            <span className="brandNameText">{size.initial}</span>
                          </td>
                          <td className="tableCell">
                            <span className="addressText" title={size.description}>
                              {size.description ? (size.description.length > 30 ? `${size.description.substring(0, 30)}...` : size.description) : "-"}
                            </span>
                          </td>
                          <td className="tableCell">
                            <span className={`statusText ${size.deleted ? "deleted" : size.isActive ? "active" : "inactive"}`}>{size.deleted ? "Deleted" : size.isActive ? "Active" : "Inactive"}</span>
                          </td>
                          <td className="tableCell">
                            <span className="dateText">{new Date(size.createdAt).toLocaleDateString()}</span>
                          </td>
                          <td className="tableCell">
                            <div className="tableActions makeFlex gap8">
                              <ActionButtons onEdit={size.deleted ? undefined : () => handleEdit(size)} onDelete={() => handleDelete(size._id || size.id)} onRevert={size.deleted ? () => handleRevert(size._id || size.id) : undefined} loading={loading} size="small" editText="✏️" deleteText={size.deleted ? "🗑️" : "🗑️"} revertText="🔄" editTitle="Edit Size" deleteTitle={size.deleted ? "Final Del" : "Delete Size"} revertTitle="Restore Size" />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {totalPages > 1 && <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={handlePageChange} disabled={loading} showGoToPage={true} />}
              </div>
            )}
          </>
        )}
      </div>

      {/* Image Popup */}
      {imagePopup.isVisible && (
        <div 
          className="imagePopupOverlay"
          onClick={handleCloseImagePopup}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            cursor: 'pointer'
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              maxWidth: '90vw',
              maxHeight: '90vh',
              backgroundColor: 'white',
              borderRadius: '8px',
              padding: '20px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
            }}
          >
            <button
              onClick={handleCloseImagePopup}
              style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                background: '#ff4444',
                color: 'white',
                border: 'none',
                borderRadius: '50%',
                width: '30px',
                height: '30px',
                fontSize: '20px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10001
              }}
              aria-label="Close image"
            >
              ×
            </button>
            <img
              src={imagePopup.imageUrl}
              alt="Full size preview"
              style={{
                maxWidth: '100%',
                maxHeight: '85vh',
                objectFit: 'contain',
                display: 'block'
              }}
              onError={(e) => {
                console.error("Image failed to load in popup:", imagePopup.imageUrl);
                e.target.style.display = 'none';
              }}
            />
          </div>
        </div>
      )}

      {/* Delete Confirmation Popup */}
      <DeleteConfirmationPopup isVisible={deletePopup.isVisible} message={deletePopup.message} onConfirm={deletePopup.action === "delete" ? handleDeleteConfirm : handleRevertConfirm} onCancel={deletePopup.action === "delete" ? handleDeleteCancel : handleRevertCancel} action={deletePopup.action} isPermanentDelete={deletePopup.isPermanentDelete} />
    </div>
  )
}

export default SizeManager
