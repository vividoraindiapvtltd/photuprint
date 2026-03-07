import React, { useState, useEffect, useMemo, useCallback, useRef } from "react"
import api from "../api/axios"
import { PageHeader, AlertMessage, ViewToggle, Pagination, EntityCard, EntityCardHeader, FormField, ActionButtons, SearchField, StatusFilter, DeleteConfirmationPopup, calculateStandardStatusCounts, filterEntitiesByStatus, generateEntityColor } from "../common"

const CategoryManager = () => {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [editingId, setEditingId] = useState(null)
  const initialFormData = {
    name: "",
    description: "",
    order: 0,
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
    categoryId: null,
    message: "",
    isPermanentDelete: false,
    action: "delete", // "delete" or "revert"
  })

  // Refs for scroll and focus functionality
  const formRef = useRef(null)
  const categoryNameInputRef = useRef(null)
  const imageInputRef = useRef(null)

  // Helper to force browsers to load the latest image after updates
  const addCacheBuster = (url, cacheBuster) => {
    if (!url) return url;
    // Avoid duplicating the cache-buster if it's already present
    if (url.includes('v=')) return url;
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}v=${cacheBuster}`;
  };

  // View mode and pagination states
  const [viewMode, setViewMode] = useState("card") // 'card' or 'list'
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(10) // For list view
  const [hasMoreCards, setHasMoreCards] = useState(true)
  const [displayedCards, setDisplayedCards] = useState([])

  // Validate image dimensions
  const validateImageDimensions = (file) => {
    return new Promise((resolve, reject) => {
      if (!file) {
        resolve({ isValid: true, error: "" });
        return;
      }

      // Check if it's an image file
      if (!file.type.startsWith('image/')) {
        resolve({ isValid: false, error: "Please select a valid image file" });
        return;
      }

      const img = new Image();
      const objectUrl = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        const maxDimension = 1200;
        
        if (img.width > maxDimension || img.height > maxDimension) {
          resolve({ 
            isValid: false, 
            error: `Image dimensions (${img.width}x${img.height}px) exceed the maximum allowed size of ${maxDimension}x${maxDimension}px. Please resize your image.` 
          });
        } else {
          resolve({ isValid: true, error: "" });
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve({ isValid: false, error: "Failed to load image. Please select a valid image file." });
      };

      img.src = objectUrl;
    });
  };

  const handleChange = async (e) => {
    const { name, value, type, checked, files } = e.target

    console.log("handleChange called:", { name, value, type, checked, files })

    if (type === "checkbox") {
      console.log(`Checkbox ${name} changed to:`, checked)
      console.log("Previous formData:", formData)
      const newFormData = { ...formData, [name]: checked }
      console.log("New formData:", newFormData)
      setFormData(newFormData)
    } else if (type === "file") {
      console.log(`File ${name} changed to:`, files[0])
      
      // Validate image dimensions if it's an image file
      if (files[0] && files[0].type.startsWith('image/')) {
        const validation = await validateImageDimensions(files[0]);
        if (!validation.isValid) {
          setError(validation.error);
          // Clear the file input
          e.target.value = '';
          return;
        }
      }
      
      setFormData({ ...formData, [name]: files[0] || null })
      // Clear any previous error if validation passes
      if (error && error.includes('dimensions')) {
        setError("");
      }
    } else {
      console.log(`Field ${name} changed to:`, value)
      setFormData({ ...formData, [name]: value })
    }
  }

  // Validate category name for duplicates
  const validateCategoryName = (name) => {
    if (!name || !name.trim()) {
      return { isValid: false, error: "Category Name is required" }
    }

    // Debug: Log the current categories state
    console.log("Validating category name:", name)
    console.log("Current categories:", categories)
    console.log("Editing ID:", editingId)

    // Check for duplicate names only against active, non-deleted categories (excluding current category being edited)
    const existingCategory = categories.find(
      (category) =>
        category.name.toLowerCase().trim() === name.toLowerCase().trim() &&
        category._id !== editingId &&
        category.isActive === true && // Only check against active categories
        !category.deleted // Exclude deleted categories
    )

    console.log("Found existing category:", existingCategory)

    if (existingCategory) {
      return { isValid: false, error: "Category name already exists" }
    }

    return { isValid: true, error: "" }
  }

  // Validate and Add / Update Category
  const handleSubmit = async (e) => {
    e.preventDefault()

    // Validate category name
    const nameValidation = validateCategoryName(formData.name)
    if (!nameValidation.isValid) {
      setError(nameValidation.error)
      return
    }

    try {
      setLoading(true)
      setSuccess("") // Clear any existing success message
      setError("") // Clear any existing error message

      let categoryData

      // Check if image is a File object (not a string URL from existing image)
      const hasNewImage = formData.image && formData.image instanceof File;
      
      if (hasNewImage) {
        // Use FormData for file upload
        categoryData = new FormData()
        categoryData.append("name", formData.name.trim())
        categoryData.append("description", formData.description.trim() || "")
        categoryData.append("order", String(formData.order != null ? formData.order : 0))
        // Convert boolean to string for FormData
        categoryData.append("isActive", formData.isActive ? "true" : "false")
        categoryData.append("image", formData.image)

        console.log("Sending FormData with isActive:", formData.isActive ? "true" : "false")
      } else {
        // Use JSON for better boolean handling
        categoryData = {
          name: formData.name.trim(),
          description: formData.description.trim() || "",
          order: formData.order != null && formData.order !== '' ? Number(formData.order) : 0,
          isActive: formData.isActive,
          // If editing and no new image, send null to remove image, or keep existing
          image: editingId && !currentImageUrl ? null : (currentImageUrl || null)
        }

        console.log("Sending JSON data with isActive:", formData.isActive)
      }

      if (editingId) {
        // Update category
        const updatedCategory = await api.put(`/categories/${editingId}`, categoryData)
        setSuccess(`✅ Category "${formData.name.trim()}" has been updated successfully!`)
      } else {
        // Create category
        const newCategory = await api.post("/categories", categoryData)
        setSuccess(`✅ Category "${formData.name.trim()}" has been created successfully!`)
      }

      // Refresh categories list
      await fetchCategories()
      
      // Reset form after successful submission (for both add and edit)
      resetForm()
    } catch (err) {
      if (err.response?.data?.msg === "Category name already exists") {
        setError("❌ Category name already exists. Please choose a different name.")
      } else {
        setError(`❌ Failed to ${editingId ? "update" : "create"} category. ${err.response?.data?.msg || "Please try again."}`)
      }
    } finally {
      setLoading(false)
    }
  }

  // Helper function to normalize image URL
  const normalizeImageUrl = (imageUrl) => {
    if (!imageUrl) return null;
    
    // If it's already a Cloudinary URL (starts with http/https), check for system paths
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      // Check if it's a system path incorrectly formatted
      if (imageUrl.includes('/backend/uploads/') || imageUrl.includes('/Users/')) {
        // Extract filename from system path
        const filename = imageUrl.split('/').pop();
        return `http://localhost:8080/uploads/${filename}`;
      }
      // Otherwise it's a valid Cloudinary URL, return as is
      return imageUrl;
    }
    
    // Handle old system paths that might be stored incorrectly
    if (imageUrl.includes('/backend/uploads/') || imageUrl.includes('/Users/')) {
      // Extract filename from system path
      const filename = imageUrl.split('/').pop();
      return `http://localhost:8080/uploads/${filename}`;
    }
    
    // Handle relative paths
    if (imageUrl.startsWith('/uploads/') || imageUrl.startsWith('/')) {
      return `http://localhost:8080${imageUrl}`;
    }
    
    // Relative path without leading slash
    return `http://localhost:8080/uploads/${imageUrl}`;
  };

  const resetForm = () => {
    setFormData(initialFormData)
    setCurrentImageUrl(null)
    setEditingId(null)
    setError("")
    // Clear file input
    if (imageInputRef.current) {
      imageInputRef.current.value = '';
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
      imageInputRef.current.value = '';
    }
  }

  // Edit category
  const handleEdit = (category) => {
    setFormData({
      ...initialFormData,
      name: category.name || "",
      description: category.description || "",
      order: category.order != null ? category.order : 0,
      image: null, // Reset image field for new file selection
      isActive: category.isActive !== undefined ? category.isActive : false,
    })
    // Only set currentImageUrl if category has a valid image
    const imageUrl = category.image && category.image.trim && category.image.trim() !== '' 
      ? normalizeImageUrl(category.image) 
      : null;
    setCurrentImageUrl(imageUrl && imageUrl.trim() !== '' ? imageUrl : null)
    setEditingId(category._id || category.id)
    setError("")
    setSuccess("")

    // Scroll to form and focus on category name input
    setTimeout(() => {
      if (formRef.current) {
        formRef.current.scrollIntoView({
          behavior: "smooth",
          block: "start",
        })
      }
      if (categoryNameInputRef.current) {
        categoryNameInputRef.current.focus()
      }
    }, 100)
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

  // Delete category
  const handleDelete = async (categoryId) => {
    // Find the category to check if it's already marked as deleted
    const category = categories.find((c) => c._id === categoryId)
    const isAlreadyDeleted = category?.deleted

    let message
    let isPermanentDelete = false

    if (isAlreadyDeleted) {
      message = "This category is already marked as deleted. Click OK to permanently remove it from the database. This action cannot be undone."
      isPermanentDelete = true
    } else {
      message = "This will mark the category as inactive and add a deleted flag. Click OK to continue."
      isPermanentDelete = false
    }

    setDeletePopup({
      isVisible: true,
      categoryId,
      message,
      isPermanentDelete,
      action: "delete",
    })
  }

  // Handle delete confirmation
  const handleDeleteConfirm = async () => {
    const { categoryId, isPermanentDelete } = deletePopup
    const category = categories.find((c) => c._id === categoryId)

    try {
      setLoading(true)
      setSuccess("") // Clear any existing success message
      setError("") // Clear any existing error message

      if (isPermanentDelete) {
        // Permanent deletion
        await api.delete(`/categories/${categoryId}/hard`)
        setSuccess(`🗑️ Category "${category.name}" has been permanently deleted from the database.`)
      } else {
        // Soft delete - mark as inactive and add deleted flag
        await api.delete(`/categories/${categoryId}`)
        setSuccess(`⏸️ Category "${category.name}" has been marked as deleted and inactive.`)
      }

      await fetchCategories()
    } catch (err) {
      const action = isPermanentDelete ? "permanently delete" : "mark as deleted"
      setError(`❌ Failed to ${action} category "${category.name}". ${err.response?.data?.msg || "Please try again."}`)
    } finally {
      setLoading(false)
      setDeletePopup({
        isVisible: false,
        categoryId: null,
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
      categoryId: null,
      message: "",
      isPermanentDelete: false,
      action: "delete",
    })
  }

  // Revert deleted category
  const handleRevert = async (categoryId) => {
    const category = categories.find((c) => c._id === categoryId)

    if (!category) {
      setError("Category not found")
      return
    }

    if (!category.deleted) {
      setError("This category is not deleted")
      return
    }

    setDeletePopup({
      isVisible: true,
      categoryId,
      message: `Are you sure you want to restore the category "${category.name}"? This will make it active again.`,
      isPermanentDelete: false,
      action: "revert",
    })
  }

  // Handle revert confirmation
  const handleRevertConfirm = async () => {
    const { categoryId } = deletePopup
    const category = categories.find((c) => c._id === categoryId)

    try {
      setLoading(true)
      setSuccess("")
      setError("")

      // Check if there's already an active or inactive category with the same name
      const existingCategory = categories.find(
        (c) =>
          c._id !== categoryId && // Exclude current category being reverted
          c.name.toLowerCase().trim() === category.name.toLowerCase().trim() && // Same name
          !c.deleted // Not deleted (active or inactive)
      )

      if (existingCategory) {
        const status = existingCategory.isActive ? "Active" : "Inactive"
        const suggestion = existingCategory.isActive ? `Consider deleting the active category "${existingCategory.name}" first, or use a different name for the restored category.` : `Consider deleting the inactive category "${existingCategory.name}" first, or use a different name for the restored category.`

        setError(`❌ Cannot restore category "${category.name}". A ${status.toLowerCase()} category with this name already exists. ${suggestion}`)
        setLoading(false)
        setDeletePopup({
          isVisible: false,
          categoryId: null,
          message: "",
          isPermanentDelete: false,
          action: "delete",
        })
        return
      }

      // Revert the category by setting deleted to false and isActive to true
      await api.put(`/categories/${categoryId}`, {
        name: category.name,
        description: category.description,
        isActive: true,
        deleted: false,
      })

      setSuccess(`✅ Category "${category.name}" has been restored and is now active!`)
      await fetchCategories()
    } catch (err) {
      setError(`❌ Failed to restore category "${category.name}". ${err.response?.data?.msg || "Please try again."}`)
    } finally {
      setLoading(false)
      setDeletePopup({
        isVisible: false,
        categoryId: null,
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
      categoryId: null,
      message: "",
      isPermanentDelete: false,
      action: "delete",
    })
  }

  // Fetch categories from backend
  const fetchCategories = async () => {
    try {
      setLoading(true)
      const response = await api.get("/categories")

      console.log("Raw categories response:", response.data)

      // Process categories to ensure proper image URLs
      const cacheBuster = Date.now()
      const processedCategories = response.data.map((category) => {
        let imageUrl = category.image

        // If image is a relative path, construct full URL
        if (imageUrl && !imageUrl.startsWith("http")) {
          // Check if it's a local upload path
          if (imageUrl.startsWith("/uploads/")) {
            imageUrl = `http://localhost:8080${imageUrl}`
          }
        }

        // Append cache-buster so updated images show immediately
        imageUrl = addCacheBuster(imageUrl, cacheBuster)

        // Debug: Log categoryId for each category
        console.log(`Category ${category.name}: categoryId = ${category.categoryId}, _id = ${category._id}, deleted = ${category.deleted}`)

        return {
          ...category,
          image: imageUrl,
        }
      })

      console.log("Processed categories:", processedCategories)
      console.log(
        "Categories with categoryId:",
        processedCategories.filter((cat) => cat.categoryId)
      )

      setCategories(processedCategories)
      setError("")
    } catch (err) {
      setError("Failed to fetch categories")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCategories()
  }, [])

  // Filter categories based on search query and status - memoized to prevent infinite loops
  const filteredCategories = useMemo(() => {
    let filtered = categories

    // Apply status filter using utility function
    filtered = filterEntitiesByStatus(filtered, statusFilter)

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      filtered = filtered.filter((category) => category.name.toLowerCase().includes(query) || (category.description && category.description.toLowerCase().includes(query)))
    }

    return filtered
  }, [categories, searchQuery, statusFilter])

  // Pagination calculations
  const totalPages = Math.ceil(filteredCategories.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentCategories = filteredCategories.slice(startIndex, endIndex)

  // Card lazy loading logic
  useEffect(() => {
    if (viewMode === "card" && filteredCategories.length > 0) {
      const initialCards = filteredCategories.slice(0, 12) // 12 cards per page
      setDisplayedCards(initialCards)
      setHasMoreCards(filteredCategories.length > 12)
      setCurrentPage(1)
    }
  }, [filteredCategories, viewMode])

  // Reset pagination when search query changes
  useEffect(() => {
    setCurrentPage(1)
    if (viewMode === "card") {
      const initialCards = filteredCategories.slice(0, 12)
      setDisplayedCards(initialCards)
      setHasMoreCards(filteredCategories.length > 12)
    }
  }, [searchQuery, viewMode, filteredCategories])

  // Handle page change for list view
  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  // Handle lazy loading for card view
  const handleLoadMoreCards = () => {
    const currentCardCount = displayedCards.length
    const nextCards = filteredCategories.slice(currentCardCount, currentCardCount + 12)

    if (nextCards.length > 0) {
      setDisplayedCards([...displayedCards, ...nextCards])
      setHasMoreCards(currentCardCount + nextCards.length < filteredCategories.length)
    } else {
      setHasMoreCards(false)
    }
  }

  // Reset pagination when view mode changes
  const handleViewModeChange = (mode) => {
    setViewMode(mode)
    setCurrentPage(1)
    if (mode === "card") {
      const initialCards = filteredCategories.slice(0, 12)
      setDisplayedCards(initialCards)
      setHasMoreCards(filteredCategories.length > 12)
    }
  }

  // Generate next category ID
  const generateNextCategoryId = useCallback(() => {
    if (categories.length === 0) {
      return "PPSCATNM1001"
    }

    // Find the highest existing category ID number
    const existingIds = categories
      .map((category) => category.categoryId)
      .filter((id) => id && id.startsWith("PPSCATNM"))
      .map((id) => {
        const match = id.match(/PPSCATNM(\d+)/)
        return match ? parseInt(match[1]) : 0
      })

    const maxNumber = existingIds.length > 0 ? Math.max(...existingIds) : 1000
    const nextNumber = maxNumber + 1
    return `PPSCATNM${nextNumber}`
  }, [categories])

  // Get current category ID for display
  const getCurrentCategoryId = useCallback(() => {
    if (editingId) {
      const category = categories.find((c) => c._id === editingId)
      return category?.categoryId || generateNextCategoryId()
    }
    return generateNextCategoryId()
  }, [editingId, categories, generateNextCategoryId])

  return (
    <div className="paddingAll20">
      {/* Header */}
      <PageHeader title="Category Management" subtitle="Manage your product categories and classifications" isEditing={!!editingId} editText="Edit Category" createText="Add New Category" />

      {/* Success/Error Messages */}
      <AlertMessage type="success" message={success} onClose={() => setSuccess("")} autoClose={true} />

      <AlertMessage type="error" message={error} onClose={() => setError("")} autoClose={true} />

      {/* Form */}
      <div className="brandFormContainer paddingAll32 appendBottom30" ref={formRef}>
        <form onSubmit={handleSubmit} className="brandForm">
          {/* Category ID Display Field */}
          <div className="makeFlex row gap10">
            <div className="fullWidth">
              <FormField
                type="text"
                name="categoryId"
                label="Category ID"
                value={getCurrentCategoryId()}
                onChange={() => {}} // No change handler - read-only
                placeholder="Category ID will be auto-generated"
                disabled={true}
                info="Category ID is automatically generated in the format PPSCATNM1001, PPSCATNM1002, etc. This field cannot be edited."
              />
            </div>
          </div>

          <div className="makeFlex row gap10">
            <div className="fullWidth">
              <FormField ref={categoryNameInputRef} type="text" name="name" label="Category Name" value={formData.name} onChange={handleChange} placeholder="Enter Category Name" required={true} />
            </div>
          </div>

          <div className="makeFlex row gap10">
            <div className="fullWidth">
              <FormField type="number" name="order" label="Display Order" value={formData.order != null ? formData.order : ""} onChange={handleChange} placeholder="0" min={0} step={1} info="Lower number appears first on homepage and listing (e.g. 0, 1, 2)" />
            </div>
          </div>

          <div className="makeFlex row gap10">
            <div className="fullWidth">
              <FormField 
                ref={imageInputRef}
                type="file" 
                name="image" 
                label="Category Image" 
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
                    alt="Current category image"
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
              <FormField type="textarea" name="description" label="Description" value={formData.description} onChange={handleChange} placeholder="Enter Category Description" rows={3} />
            </div>
          </div>

          <div className="makeFlex row gap10">
            <div className="makeFlex column flexOne appendBottom16">
              <label className="formLabel appendBottom10">Status:</label>
              <label className="formLabel appendBottom8 makeFlex gap10">
                <FormField type="checkbox" name="isActive" value={formData.isActive} onChange={handleChange} />
                Active
              </label>
              <p className="negativeMarginTop10">Check this box to keep the brand active, uncheck to mark as inactive</p>
            </div>
          </div>

          {/* Form Actions */}
          <div className="formActions paddingTop16">
            <button type="submit" disabled={loading} className="btnPrimary">
              {loading ? <span className="loadingSpinner">⏳</span> : <span>{editingId ? "Update Category" : "Add Category"}</span>}
            </button>

            {editingId && (
              <button type="button" onClick={resetForm} className="btnSecondary">
                Cancel
              </button>
            )}

            {!editingId && success && (
              <button type="button" onClick={clearForm} className="btnSecondary">
                Add Another Category
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Categories List */}
      <div className="brandsListContainer paddingAll32">
        <div className="listHeader makeFlex spaceBetween end appendBottom24">
          <div className="leftSection">
            <h2 className="listTitle font30 fontBold blackText appendBottom16">Categories ({filteredCategories.length})</h2>
            <StatusFilter statusFilter={statusFilter} onStatusChange={setStatusFilter} counts={calculateStandardStatusCounts(categories)} disabled={loading} />
          </div>
          <div className="rightSection makeFlex end gap10">
            <SearchField value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search categories..." disabled={loading} minWidth="250px" />
            {loading && <div className="loadingIndicator grayText">Loading...</div>}
            <ViewToggle viewMode={viewMode} onViewChange={handleViewModeChange} disabled={loading} />
          </div>
        </div>

        {filteredCategories.length === 0 && !loading ? (
          <div className="emptyState textCenter paddingAll60">
            <div className="emptyIcon appendBottom16">📁</div>
            <h3 className="font22 fontSemiBold grayText appendBottom8">No Categories Found</h3>
            <p className="font16 grayText">Start by adding your first category above</p>
            <div className="font14 grayText">
              <p>
                💡 <strong>Category ID Format:</strong> PPSCATNM1001, PPSCATNM1002, etc.
              </p>
              <p>Category IDs are automatically generated when you create a new category.</p>
            </div>
          </div>
        ) : (
          <>
            {/* Card View */}
            {viewMode === "card" && (
              <div className="brandsGrid">
                {displayedCards.map((category) => (
                  <EntityCard
                    key={category._id || category.id}
                    entity={category}
                    logoField="image"
                    nameField="name"
                    idField="_id"
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    loading={loading}
                    imagePlaceholderColor={generateEntityColor(category._id || category.id, category.name)}
                    renderHeader={(category) => (
                      <EntityCardHeader 
                        entity={category} 
                        imageField="image" 
                        titleField="name" 
                        dateField="createdAt" 
                        generateColor={generateEntityColor}
                        onImageClick={handleImageClick}
                      />
                    )}
                    renderDetails={(category) => {
                      return (
                        <>
                          <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                            <span className="detailLabel font14 fontSemiBold grayText textUppercase">Category ID:</span>
                            <span className="detailValue font14 blackText appendLeft6">{category.categoryId || "N/A"}</span>
                          </div>
                          <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                            <span className="detailLabel font14 fontSemiBold grayText textUppercase">Name:</span>
                            <span className="detailValue font14 blackText appendLeft6">{category.name}</span>
                          </div>
                          <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                            <span className="detailLabel font14 fontSemiBold grayText textUppercase">Display Order:</span>
                            <span className="detailValue font14 blackText appendLeft6">{category.order != null ? category.order : 0}</span>
                          </div>
                          {category.description && (
                            <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                              <span className="detailLabel font14 fontSemiBold grayText textUppercase">Description:</span>
                              <span className="detailValue font14 blackText appendLeft6">{category.description}</span>
                            </div>
                          )}
                          <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                            <span className="detailLabel font14 fontSemiBold grayText textUppercase">Status:</span>
                            <span className={`detailValue font14 ${category.deleted ? "deleted" : category.isActive ? "greenText" : "inactive"} appendLeft6`}>{category.deleted ? "Deleted" : category.isActive ? "Active" : "Inactive"}</span>
                          </div>
                        </>
                      )
                    }}
                    renderActions={(category) => <ActionButtons onEdit={category.deleted ? undefined : () => handleEdit(category)} onDelete={() => handleDelete(category._id || category.id)} onRevert={category.deleted ? () => handleRevert(category._id || category.id) : undefined} loading={loading} size="normal" editText="✏️ Edit" deleteText={category.deleted ? "🗑️ Final Del" : "🗑️ Delete"} revertText="🔄 Undelete" editTitle="Edit Category" deleteTitle={category.deleted ? "Permanently delete this category" : "Mark category as deleted"} revertTitle="Restore this category back to active" editDisabled={category.deleted} />}
                    className="categoryCard"
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
                        <th className="tableHeader">Category ID</th>
                        <th className="tableHeader">Name</th>
                        <th className="tableHeader">Order</th>
                        <th className="tableHeader">Description</th>
                        <th className="tableHeader">Status</th>
                        <th className="tableHeader">Created</th>
                        <th className="tableHeader">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentCategories.map((category) => (
                        <tr key={category._id} className="tableRow">
                          <td className="tableCell">
                            <div className="tableLogo">
                              {category.image ? (
                                <img 
                                  src={category.image} 
                                  alt={category.name} 
                                  className="tableLogoImage"
                                  style={{ cursor: 'pointer' }}
                                  onClick={() => handleImageClick(category.image)}
                                />
                              ) : (
                                <div className="tableLogoPlaceholder" style={{ backgroundColor: generateEntityColor(category._id || category.id, category.name) }}>
                                  {category.name.charAt(0).toUpperCase()}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="tableCell">
                            <span className="brandIdText">{category.categoryId || "N/A"}</span>
                          </td>
                          <td className="tableCell">
                            <span className="brandNameText">{category.name}</span>
                          </td>
                          <td className="tableCell">
                            <span className="brandIdText">{category.order != null ? category.order : 0}</span>
                          </td>
                          <td className="tableCell">
                            <span className="companyNameText" title={category.description}>
                              {category.description ? (category.description.length > 30 ? `${category.description.substring(0, 30)}...` : category.description) : "-"}
                            </span>
                          </td>
                          <td className="tableCell">
                            <span className={`statusText ${category.deleted ? "deleted" : category.isActive ? "active" : "inactive"}`}>{category.deleted ? "Deleted" : category.isActive ? "Active" : "Inactive"}</span>
                          </td>
                          <td className="tableCell">
                            <span className="dateText">{new Date(category.createdAt).toLocaleDateString()}</span>
                          </td>
                          <td className="tableCell">
                            <div className="tableActions makeFlex gap8">
                              <ActionButtons onEdit={category.deleted ? undefined : () => handleEdit(category)} onDelete={() => handleDelete(category._id || category.id)} onRevert={category.deleted ? () => handleRevert(category._id || category.id) : undefined} loading={loading} size="small" editText="✏️" deleteText="🗑️" revertText="🔄 Revert Back" editTitle="Edit Category" deleteTitle={category.deleted ? "Final Del" : "Delete Category"} revertTitle="Restore this category back to active" editDisabled={category.deleted} />
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

      <DeleteConfirmationPopup isVisible={deletePopup.isVisible} message={deletePopup.message} onConfirm={deletePopup.action === "delete" ? handleDeleteConfirm : handleRevertConfirm} onCancel={deletePopup.action === "delete" ? handleDeleteCancel : handleRevertCancel} confirmText={deletePopup.action === "delete" ? (deletePopup.isPermanentDelete ? "Final Del" : "Delete") : "Restore"} cancelText="Cancel" loading={loading} />
    </div>
  )
}

export default CategoryManager