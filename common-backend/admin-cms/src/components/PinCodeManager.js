import React, { useState, useEffect, useMemo, useCallback, useRef } from "react"
import api from "../api/axios"
import { PageHeader, AlertMessage, ViewToggle, Pagination, EntityCard, EntityCardHeader, FormField, ActionButtons, SearchField, StatusFilter, DeleteConfirmationPopup, calculateStandardStatusCounts, filterEntitiesByStatus, generateEntityColor } from "../common"

const PinCodeManager = () => {
  const [pinCodes, setPinCodes] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [editingId, setEditingId] = useState(null)
  const initialFormData = {
    name: "",
    description: "",
    state: "",
    district: "",
    image: null,
    isActive: false,
  }

  const [formData, setFormData] = useState(initialFormData)
  const [searchQuery, setSearchQuery] = useState("") // Search query state
  const [statusFilter, setStatusFilter] = useState("all") // 'all', 'active', 'inactive', 'deleted'

  // Pincode API states
  const [pincodeLoading, setPincodeLoading] = useState(false)
  const [citySuggestions, setCitySuggestions] = useState([])
  const [showCitySuggestions, setShowCitySuggestions] = useState(false)
  const pincodeTimeoutRef = useRef(null)

  // Delete confirmation popup state
  const [deletePopup, setDeletePopup] = useState({
    isVisible: false,
    pinCodeId: null,
    message: "",
    isPermanentDelete: false,
    action: "delete", // "delete" or "revert"
  })

  // Refs for scroll and focus functionality
  const formRef = useRef(null)
  const pinCodeNameInputRef = useRef(null)

  // View mode and pagination states
  const [viewMode, setViewMode] = useState("card") // 'card' or 'list'
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(10) // For list view
  const [hasMoreCards, setHasMoreCards] = useState(true)
  const [displayedCards, setDisplayedCards] = useState([])

  const handleChange = (e) => {
    const { name, value, type, checked, files } = e.target

    if (type === "checkbox") {
      setFormData({ ...formData, [name]: checked })
    } else if (type === "file") {
      setFormData({ ...formData, [name]: files[0] || null })
    } else {
      setFormData({ ...formData, [name]: value })

      // Auto-fetch state and district when pincode is entered
      if (name === "name" && value.trim().length === 6) {
        fetchPincodeDetails(value.trim())
      } else if (name === "name" && value.trim().length !== 6) {
        // Clear state and district if pincode is not 6 digits
        setFormData((prev) => ({ ...prev, state: "", district: "" }))
        setCitySuggestions([])
      }
    }
  }

  // Fetch pincode details from public API
  const fetchPincodeDetails = async (pincode) => {
    // Clear previous timeout
    if (pincodeTimeoutRef.current) {
      clearTimeout(pincodeTimeoutRef.current)
    }

    // Debounce the API call
    pincodeTimeoutRef.current = setTimeout(async () => {
      if (!pincode || pincode.length !== 6) {
        return
      }

      try {
        setPincodeLoading(true)
        const response = await fetch(`https://api.postalpincode.in/pincode/${pincode}`)
        const data = await response.json()

        if (data && data[0] && data[0].Status === "Success" && data[0].PostOffice && data[0].PostOffice.length > 0) {
          const postOffice = data[0].PostOffice[0]
          const state = postOffice.State || ""
          const district = postOffice.District || ""

          // Extract unique cities from all post offices
          const cities = [...new Set(data[0].PostOffice.map((po) => po.Name || "").filter(Boolean))]

          setFormData((prev) => ({
            ...prev,
            state: state,
            district: district,
          }))
          setCitySuggestions(cities)
        } else {
          // Clear if no data found
          setFormData((prev) => ({ ...prev, state: "", district: "" }))
          setCitySuggestions([])
        }
      } catch (error) {
        console.error("Error fetching pincode details:", error)
        setFormData((prev) => ({ ...prev, state: "", district: "" }))
        setCitySuggestions([])
      } finally {
        setPincodeLoading(false)
      }
    }, 500) // 500ms debounce
  }

  // Handle city selection
  const handleCitySelect = (city) => {
    setFormData((prev) => ({
      ...prev,
      description: prev.description ? `${prev.description}, ${city}` : city,
    }))
    setShowCitySuggestions(false)
  }

  // Validate pin code name for duplicates
  const validatePinCodeName = (name) => {
    if (!name || !name.trim()) {
      return { isValid: false, error: "Pin Code Name is required" }
    }

    // Check for duplicate names only against active, non-deleted pin codes (excluding current pin code being edited)
    const existingPinCode = pinCodes.find(
      (pinCode) =>
        pinCode.name.toLowerCase().trim() === name.toLowerCase().trim() &&
        pinCode._id !== editingId &&
        pinCode.isActive === true && // Only check against active pin codes
        !pinCode.deleted // Exclude deleted pin codes
    )

    if (existingPinCode) {
      return { isValid: false, error: "Pin code name already exists" }
    }

    return { isValid: true, error: "" }
  }

  // Validate and Add / Update Pin Code
  const handleSubmit = async (e) => {
    e.preventDefault()

    // Validate pin code name
    const nameValidation = validatePinCodeName(formData.name)
    if (!nameValidation.isValid) {
      setError(nameValidation.error)
      return
    }

    try {
      setLoading(true)
      setSuccess("") // Clear any existing success message
      setError("") // Clear any existing error message

      let pinCodeData

      if (formData.image) {
        // Use FormData for file upload
        pinCodeData = new FormData()
        pinCodeData.append("name", formData.name.trim())
        pinCodeData.append("description", formData.description.trim() || "")
        pinCodeData.append("state", formData.state.trim() || "")
        pinCodeData.append("district", formData.district.trim() || "")
        pinCodeData.append("isActive", formData.isActive ? "true" : "false")
        pinCodeData.append("image", formData.image)
      } else {
        // Use JSON for better boolean handling
        pinCodeData = {
          name: formData.name.trim(),
          description: formData.description.trim() || "",
          state: formData.state.trim() || "",
          district: formData.district.trim() || "",
          isActive: formData.isActive,
        }
      }

      if (editingId) {
        // Update pin code
        await api.put(`/pin-codes/${editingId}`, pinCodeData)
        setSuccess(`✅ Pin Code "${formData.name.trim()}" has been updated successfully!`)
      } else {
        // Create pin code
        await api.post("/pin-codes", pinCodeData)
        setSuccess(`✅ Pin Code "${formData.name.trim()}" has been created successfully!`)
      }

      // Refresh pin codes list
      await fetchPinCodes()
      // Don't call resetForm() here - let AlertMessage handle the lifecycle
    } catch (err) {
      if (err.response?.data?.msg === "Pin code name already exists") {
        setError("❌ Pin code name already exists. Please choose a different name.")
      } else {
        setError(`❌ Failed to ${editingId ? "update" : "create"} pin code. ${err.response?.data?.msg || "Please try again."}`)
      }
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData(initialFormData)
    setEditingId(null)
    setError("")
    setCitySuggestions([])
    setShowCitySuggestions(false)
    // Don't clear success message here - let AlertMessage handle it
    // setSuccess("");
  }

  // Clear form after successful operations
  const clearForm = () => {
    setFormData(initialFormData)
    setEditingId(null)
    setError("")
    setSuccess("")
    setCitySuggestions([])
    setShowCitySuggestions(false)
  }

  // Edit pin code
  const handleEdit = (pinCode) => {
    setFormData({
      ...initialFormData,
      name: pinCode.name || "",
      description: pinCode.description || "",
      state: pinCode.state || "",
      district: pinCode.district || "",
      image: pinCode.image || null, // Preserve existing image
      isActive: pinCode.isActive !== undefined ? pinCode.isActive : false,
    })
    setEditingId(pinCode._id || pinCode.id)
    setError("")
    setSuccess("")
    setCitySuggestions([])
    setShowCitySuggestions(false)

    // Scroll to form and focus on pin code name input
    setTimeout(() => {
      if (formRef.current) {
        formRef.current.scrollIntoView({
          behavior: "smooth",
          block: "start",
        })
      }
      if (pinCodeNameInputRef.current) {
        pinCodeNameInputRef.current.focus()
      }
    }, 100)
  }

  // Delete pin code
  const handleDelete = async (pinCodeId) => {
    // Find the pin code to check if it's already marked as deleted
    const pinCode = pinCodes.find((p) => p._id === pinCodeId)
    const isAlreadyDeleted = pinCode?.deleted

    let message
    let isPermanentDelete = false

    if (isAlreadyDeleted) {
      message = "This pin code is already marked as deleted. Click OK to permanently remove it from the database. This action cannot be undone."
      isPermanentDelete = true
    } else {
      message = "This will mark the pin code as inactive and add a deleted flag. Click OK to continue."
      isPermanentDelete = false
    }

    setDeletePopup({
      isVisible: true,
      pinCodeId,
      message,
      isPermanentDelete,
      action: "delete",
    })
  }

  // Handle delete confirmation
  const handleDeleteConfirm = async () => {
    const { pinCodeId, isPermanentDelete } = deletePopup
    const pinCode = pinCodes.find((p) => p._id === pinCodeId)

    try {
      setLoading(true)
      setSuccess("") // Clear any existing success message
      setError("") // Clear any existing error message

      if (isPermanentDelete) {
        // Permanent deletion
        await api.delete(`/pin-codes/${pinCodeId}/hard`)
        setSuccess(`🗑️ Pin Code "${pinCode.name}" has been permanently deleted from the database.`)
      } else {
        // Soft delete - mark as inactive and add deleted flag
        await api.delete(`/pin-codes/${pinCodeId}`)
        setSuccess(`⏸️ Pin Code "${pinCode.name}" has been marked as deleted and inactive.`)
      }

      await fetchPinCodes()
    } catch (err) {
      const action = isPermanentDelete ? "permanently delete" : "mark as deleted"
      setError(`❌ Failed to ${action} pin code "${pinCode.name}". ${err.response?.data?.msg || "Please try again."}`)
    } finally {
      setLoading(false)
      setDeletePopup({
        isVisible: false,
        pinCodeId: null,
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
      pinCodeId: null,
      message: "",
      isPermanentDelete: false,
      action: "delete",
    })
  }

  // Revert deleted pin code
  const handleRevert = async (pinCodeId) => {
    const pinCode = pinCodes.find((p) => p._id === pinCodeId)

    if (!pinCode) {
      setError("Pin code not found")
      return
    }

    if (!pinCode.deleted) {
      setError("This pin code is not deleted")
      return
    }

    setDeletePopup({
      isVisible: true,
      pinCodeId,
      message: `Are you sure you want to restore the pin code "${pinCode.name}"? This will make it active again.`,
      isPermanentDelete: false,
      action: "revert",
    })
  }

  // Handle revert confirmation
  const handleRevertConfirm = async () => {
    const { pinCodeId } = deletePopup
    const pinCode = pinCodes.find((p) => p._id === pinCodeId)

    try {
      setLoading(true)
      setSuccess("")
      setError("")

      // Check if there's already an active or inactive pin code with the same name
      const existingPinCode = pinCodes.find(
        (p) =>
          p._id !== pinCodeId && // Exclude current pin code being reverted
          p.name.toLowerCase().trim() === pinCode.name.toLowerCase().trim() && // Same name
          !p.deleted // Not deleted (active or inactive)
      )

      if (existingPinCode) {
        const status = existingPinCode.isActive ? "Active" : "Inactive"
        const suggestion = existingPinCode.isActive ? `Consider deleting the active pin code "${existingPinCode.name}" first, or use a different name for the restored pin code.` : `Consider deleting the inactive pin code "${existingPinCode.name}" first, or use a different name for the restored pin code.`

        setError(`❌ Cannot restore pin code "${pinCode.name}". A ${status.toLowerCase()} pin code with this name already exists. ${suggestion}`)
        setLoading(false)
        setDeletePopup({
          isVisible: false,
          pinCodeId: null,
          message: "",
          isPermanentDelete: false,
          action: "delete",
        })
        return
      }

      // Revert the pin code by setting deleted to false and isActive to true
      await api.put(`/pin-codes/${pinCodeId}`, {
        name: pinCode.name,
        description: pinCode.description,
        isActive: true,
        deleted: false,
      })

      setSuccess(`✅ Pin Code "${pinCode.name}" has been restored and is now active!`)
      await fetchPinCodes()
    } catch (err) {
      setError(`❌ Failed to restore pin code "${pinCode.name}". ${err.response?.data?.msg || "Please try again."}`)
    } finally {
      setLoading(false)
      setDeletePopup({
        isVisible: false,
        pinCodeId: null,
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
      pinCodeId: null,
      message: "",
      isPermanentDelete: false,
      action: "delete",
    })
  }

  // Fetch pin codes from backend
  const fetchPinCodes = async () => {
    try {
      setLoading(true)
      const response = await api.get("/pin-codes?showInactive=true&includeDeleted=true")

      // Process pin codes to ensure proper image URLs
      const processedPinCodes = response.data.map((pinCode) => {
        let imageUrl = pinCode.image

        // If image is a relative path, construct full URL
        if (imageUrl && !imageUrl.startsWith("http")) {
          // Check if it's a local upload path
          if (imageUrl.startsWith("/uploads/")) {
            imageUrl = `${imageUrl}`
          }
        }

        return {
          ...pinCode,
          image: imageUrl,
        }
      })

      setPinCodes(processedPinCodes)
      setError("")
    } catch (err) {
      console.error("Error fetching pin codes:", err)
      const errorMessage = err.response?.data?.msg || err.response?.data?.error || err.message || "Failed to fetch pin codes"
      setError(`Failed to fetch pin codes: ${errorMessage}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPinCodes()
  }, [])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (pincodeTimeoutRef.current) {
        clearTimeout(pincodeTimeoutRef.current)
      }
    }
  }, [])

  // Close city suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showCitySuggestions && !event.target.closest(".citySuggestionsDropdown") && !event.target.closest('textarea[name="description"]')) {
        setShowCitySuggestions(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [showCitySuggestions])

  // Filter pin codes based on search query and status
  const filteredPinCodes = useMemo(() => {
    let filtered = pinCodes

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      filtered = filtered.filter((pinCode) => pinCode.name.toLowerCase().includes(query) || (pinCode.description && pinCode.description.toLowerCase().includes(query)) || (pinCode.state && pinCode.state.toLowerCase().includes(query)) || (pinCode.district && pinCode.district.toLowerCase().includes(query)))
    }

    // Apply status filter
    filtered = filterEntitiesByStatus(filtered, statusFilter)

    return filtered
  }, [pinCodes, searchQuery, statusFilter])

  // Pagination calculations
  const totalPages = Math.ceil(filteredPinCodes.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentPinCodes = filteredPinCodes.slice(startIndex, endIndex)

  // Card lazy loading logic
  useEffect(() => {
    if (viewMode === "card") {
      const initialCards = filteredPinCodes.slice(0, 12)
      setDisplayedCards(initialCards)
      setHasMoreCards(filteredPinCodes.length > 12)
      setCurrentPage(1)
    }
  }, [viewMode, filteredPinCodes])

  // Reset pagination when search query changes
  const resetPaginationForSearch = useCallback(() => {
    setCurrentPage(1)
    if (viewMode === "card") {
      const initialCards = filteredPinCodes.slice(0, 12)
      setDisplayedCards(initialCards)
      setHasMoreCards(filteredPinCodes.length > 12)
    }
  }, [viewMode, filteredPinCodes.length])

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
      const nextCards = filteredPinCodes.slice(currentCardCount, currentCardCount + 12)

      if (nextCards.length > 0) {
        setHasMoreCards(currentCardCount + nextCards.length < filteredPinCodes.length)
        return [...prevCards, ...nextCards]
      } else {
        setHasMoreCards(false)
        return prevCards
      }
    })
  }, [filteredPinCodes])

  // Reset pagination when view mode changes
  const handleViewModeChange = useCallback(
    (mode) => {
      setViewMode(mode)
      setCurrentPage(1)
      if (mode === "card") {
        const initialCards = filteredPinCodes.slice(0, 12)
        setDisplayedCards(initialCards)
        setHasMoreCards(filteredPinCodes.length > 12)
      }
    },
    [filteredPinCodes.length]
  )

  const handleCancel = () => {
    resetForm()
  }

  return (
    <div className="paddingAll20">
      {/* Header */}
      <PageHeader title="Pin Code Management" subtitle="Manage your product pin codes and classifications" isEditing={!!editingId} editText="Edit Pin Code" createText="Add New Pin Code" />

      {/* Success/Error Messages */}
      <AlertMessage type="success" message={success} onClose={() => setSuccess("")} autoClose={true} />

      <AlertMessage type="error" message={error} onClose={() => setError("")} autoClose={true} />

      {/* Form */}
      <div className="brandFormContainer paddingAll32 appendBottom30" ref={formRef}>
        <form onSubmit={handleSubmit} className="brandForm">
          <div className="makeFlex row gap10">
            <div className="fullWidth">
              <FormField ref={pinCodeNameInputRef} type="text" name="name" label="Pin Code" value={formData.name} onChange={handleChange} placeholder="Enter 6-digit Pin Code (e.g., 110001)" required={true} numeric={true} maxLength={6} info={pincodeLoading ? "Fetching details..." : "Enter 6-digit pincode to auto-fetch state and district"} />
            </div>
          </div>

          <div className="makeFlex row gap10">
            <div className="widthHalf">
              <FormField type="text" name="state" label="State" value={formData.state} onChange={handleChange} placeholder="State will be auto-filled" disabled={true} info="Auto-filled from pincode" />
            </div>
            <div className="widthHalf">
              <FormField type="text" name="district" label="District" value={formData.district} onChange={handleChange} placeholder="District will be auto-filled" disabled={true} info="Auto-filled from pincode" />
            </div>
          </div>

          <div className="makeFlex row gap10">
            <div className="fullWidth">
              <FormField type="file" name="image" label="Pin Code Image" onChange={handleChange} accept="image/*" info="Supported formats: JPG, PNG, GIF (Max size: 5MB)" />
              {/* Show current image if editing */}
              {editingId && formData.image && typeof formData.image === "string" && (
                <div className="currentImageInfo paddingTop8">
                  <p className="font12 grayText">Current image:</p>
                  <img
                    src={formData.image}
                    alt="Current pin code image"
                    className="currentImagePreview"
                    style={{
                      maxWidth: "100px",
                      maxHeight: "100px",
                      objectFit: "cover",
                      borderRadius: "4px",
                      marginTop: "4px",
                    }}
                    onError={(e) => {
                      console.error("Current image failed to load:", formData.image)
                      e.target.style.display = "none"
                    }}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="makeFlex row gap10">
            <div className="fullWidth" style={{ position: "relative" }}>
              <FormField type="textarea" name="description" label="Description / Cities" value={formData.description} onChange={handleChange} onFocus={() => citySuggestions.length > 0 && setShowCitySuggestions(true)} placeholder="Enter description or select cities from suggestions below" rows={3} info="You can type manually or select from city suggestions" />

              {/* City Suggestions Dropdown */}
              {showCitySuggestions && citySuggestions.length > 0 && (
                <div
                  className="citySuggestionsDropdown"
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    right: 0,
                    backgroundColor: "white",
                    border: "1px solid #ddd",
                    borderRadius: "4px",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                    maxHeight: "200px",
                    overflowY: "auto",
                    zIndex: 1000,
                    marginTop: "4px",
                  }}
                >
                  <div
                    style={{
                      padding: "8px 12px",
                      fontSize: "12px",
                      fontWeight: "bold",
                      color: "#666",
                      borderBottom: "1px solid #eee",
                      backgroundColor: "#f5f5f5",
                    }}
                  >
                    City Suggestions (Click to add):
                  </div>
                  {citySuggestions.map((city, index) => (
                    <div
                      key={index}
                      onClick={() => handleCitySelect(city)}
                      style={{
                        padding: "10px 12px",
                        cursor: "pointer",
                        borderBottom: index < citySuggestions.length - 1 ? "1px solid #eee" : "none",
                        transition: "background-color 0.2s",
                      }}
                      onMouseEnter={(e) => (e.target.style.backgroundColor = "#f0f0f0")}
                      onMouseLeave={(e) => (e.target.style.backgroundColor = "white")}
                    >
                      {city}
                    </div>
                  ))}
                  <div
                    onClick={() => setShowCitySuggestions(false)}
                    style={{
                      padding: "8px 12px",
                      fontSize: "12px",
                      textAlign: "center",
                      color: "#666",
                      cursor: "pointer",
                      borderTop: "1px solid #eee",
                      backgroundColor: "#f5f5f5",
                    }}
                  >
                    Close
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="makeFlex row gap10">
            <div className="makeFlex column flexOne appendBottom16">
              <label className="formLabel appendBottom10">Status:</label>
              <label className="formLabel appendBottom8 makeFlex gap10">
                <FormField type="checkbox" name="isActive" value={formData.isActive} onChange={handleChange} />
                Active
              </label>
              <p className="negativeMarginTop10">Check this box to keep the pin code active, uncheck to mark as inactive</p>
            </div>
          </div>

          {/* Form Actions */}
          <div className="formActions paddingTop16">
            <button type="submit" disabled={loading} className="btnPrimary">
              {loading ? <span className="loadingSpinner">⏳</span> : <span>{editingId ? "Update Pin Code" : "Add Pin Code"}</span>}
            </button>

            {editingId && (
              <button type="button" onClick={handleCancel} className="btnSecondary">
                Cancel
              </button>
            )}

            {!editingId && success && (
              <button type="button" onClick={clearForm} className="btnSecondary">
                Add Another Pin Code
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Pin Codes List */}
      <div className="brandsListContainer paddingAll32">
        <div className="listHeader makeFlex spaceBetween end appendBottom24">
          <div className="leftSection">
            <h2 className="listTitle font30 fontBold blackText appendBottom16">Pin Codes ({filteredPinCodes.length})</h2>
            <StatusFilter statusFilter={statusFilter} onStatusChange={setStatusFilter} counts={calculateStandardStatusCounts(pinCodes)} disabled={loading} />
          </div>
          <div className="rightSection makeFlex end gap10">
            <SearchField value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search pin codes..." disabled={loading} minWidth="250px" />
            {loading && <div className="loadingIndicator grayText">Loading...</div>}
            <ViewToggle viewMode={viewMode} onViewChange={handleViewModeChange} disabled={loading} />
          </div>
        </div>

        {filteredPinCodes.length === 0 && !loading ? (
          <div className="emptyState textCenter paddingAll60">
            <div className="emptyIcon appendBottom16">📍</div>
            <h3 className="font22 fontSemiBold grayText appendBottom8">No Pin Codes Found</h3>
            <p className="font16 grayText">Start by adding your first pin code above</p>
          </div>
        ) : (
          <>
            {/* Card View */}
            {viewMode === "card" && (
              <div className="brandsGrid">
                {displayedCards.map((pinCode) => (
                  <EntityCard
                    key={pinCode._id || pinCode.id}
                    entity={pinCode}
                    logoField="image"
                    nameField="name"
                    idField="_id"
                    onEdit={pinCode.deleted ? undefined : handleEdit}
                    onDelete={handleDelete}
                    onRevert={pinCode.deleted ? () => handleRevert(pinCode._id || pinCode.id) : undefined}
                    loading={loading}
                    imagePlaceholderColor={generateEntityColor(pinCode._id || pinCode.id, pinCode.name)}
                    renderHeader={(pinCode) => <EntityCardHeader entity={pinCode} imageField="image" titleField="name" dateField="createdAt" generateColor={generateEntityColor} />}
                    renderDetails={(pinCode) => {
                      return (
                        <>
                          <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                            <span className="detailLabel font14 fontSemiBold grayText textUppercase">Pin Code ID:</span>
                            <span className="detailValue font14 blackText appendLeft6">{pinCode._id || "N/A"}</span>
                          </div>
                          <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                            <span className="detailLabel font14 fontSemiBold grayText textUppercase">Name:</span>
                            <span className="detailValue font14 blackText appendLeft6">{pinCode.name}</span>
                          </div>
                          {pinCode.state && (
                            <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                              <span className="detailLabel font14 fontSemiBold grayText textUppercase">State:</span>
                              <span className="detailValue font14 blackText appendLeft6">{pinCode.state}</span>
                            </div>
                          )}
                          {pinCode.district && (
                            <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                              <span className="detailLabel font14 fontSemiBold grayText textUppercase">District:</span>
                              <span className="detailValue font14 blackText appendLeft6">{pinCode.district}</span>
                            </div>
                          )}
                          {pinCode.description && (
                            <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                              <span className="detailLabel font14 fontSemiBold grayText textUppercase">Description:</span>
                              <span className="detailValue font14 blackText appendLeft6">{pinCode.description}</span>
                            </div>
                          )}
                          <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                            <span className="detailLabel font14 fontSemiBold grayText textUppercase">Status:</span>
                            <span className={`detailValue font14 ${pinCode.deleted ? "deleted" : pinCode.isActive ? "greenText" : "inactive"} appendLeft6`}>{pinCode.deleted ? "Deleted" : pinCode.isActive ? "Active" : "Inactive"}</span>
                          </div>
                        </>
                      )
                    }}
                    renderActions={(pinCode) => <ActionButtons onEdit={pinCode.deleted ? undefined : () => handleEdit(pinCode)} onDelete={() => handleDelete(pinCode._id || pinCode.id)} onRevert={pinCode.deleted ? () => handleRevert(pinCode._id || pinCode.id) : undefined} loading={loading} size="normal" editText="✏️ Edit" deleteText={pinCode.deleted ? "🗑️ Final Del" : "🗑️ Delete"} revertText="🔄 Undelete" editTitle="Edit Pin Code" deleteTitle={pinCode.deleted ? "Final Del" : "Delete Pin Code"} revertTitle="Restore Pin Code" />}
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
                        <th className="tableHeader">State</th>
                        <th className="tableHeader">District</th>
                        <th className="tableHeader">Description</th>
                        <th className="tableHeader">Status</th>
                        <th className="tableHeader">Created</th>
                        <th className="tableHeader">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentPinCodes.map((pinCode) => (
                        <tr key={pinCode._id || pinCode.id} className="tableRow">
                          <td className="tableCell">
                            {pinCode.image ? (
                              <img
                                src={pinCode.image}
                                alt={pinCode.name}
                                className="tableImage"
                                style={{
                                  width: "40px",
                                  height: "40px",
                                  objectFit: "cover",
                                  borderRadius: "4px",
                                }}
                                onError={(e) => {
                                  console.error("Image failed to load:", pinCode.image)
                                  e.target.style.display = "none"
                                }}
                              />
                            ) : (
                              <div
                                className="tableImagePlaceholder"
                                style={{
                                  width: "40px",
                                  height: "40px",
                                  backgroundColor: generateEntityColor(pinCode._id || pinCode.id, pinCode.name),
                                  borderRadius: "4px",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  color: "white",
                                  fontSize: "12px",
                                  fontWeight: "bold",
                                }}
                              >
                                {pinCode.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </td>
                          <td className="tableCell">
                            <span className="brandNameText">{pinCode.name}</span>
                          </td>
                          <td className="tableCell">
                            <span className="addressText" title={pinCode.state}>
                              {pinCode.state || "-"}
                            </span>
                          </td>
                          <td className="tableCell">
                            <span className="addressText" title={pinCode.district}>
                              {pinCode.district || "-"}
                            </span>
                          </td>
                          <td className="tableCell">
                            <span className="addressText" title={pinCode.description}>
                              {pinCode.description ? (pinCode.description.length > 30 ? `${pinCode.description.substring(0, 30)}...` : pinCode.description) : "-"}
                            </span>
                          </td>
                          <td className="tableCell">
                            <span className={`statusText ${pinCode.deleted ? "deleted" : pinCode.isActive ? "active" : "inactive"}`}>{pinCode.deleted ? "Deleted" : pinCode.isActive ? "Active" : "Inactive"}</span>
                          </td>
                          <td className="tableCell">
                            <span className="dateText">{new Date(pinCode.createdAt).toLocaleDateString()}</span>
                          </td>
                          <td className="tableCell">
                            <div className="tableActions makeFlex gap8">
                              <ActionButtons onEdit={pinCode.deleted ? undefined : () => handleEdit(pinCode)} onDelete={() => handleDelete(pinCode._id || pinCode.id)} onRevert={pinCode.deleted ? () => handleRevert(pinCode._id || pinCode.id) : undefined} loading={loading} size="small" editText="✏️" deleteText={pinCode.deleted ? "🗑️" : "🗑️"} revertText="🔄" editTitle="Edit Pin Code" deleteTitle={pinCode.deleted ? "Final Del" : "Delete Pin Code"} revertTitle="Restore Pin Code" />
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

      {/* Delete Confirmation Popup */}
      <DeleteConfirmationPopup isVisible={deletePopup.isVisible} message={deletePopup.message} onConfirm={deletePopup.action === "delete" ? handleDeleteConfirm : handleRevertConfirm} onCancel={deletePopup.action === "delete" ? handleDeleteCancel : handleRevertCancel} action={deletePopup.action} isPermanentDelete={deletePopup.isPermanentDelete} />
    </div>
  )
}

export default PinCodeManager
