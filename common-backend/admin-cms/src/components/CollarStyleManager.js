import React, { useState, useEffect, useMemo, useCallback, useRef } from "react"
import api from "../api/axios"
import { PageHeader, AlertMessage, ViewToggle, Pagination, EntityCard, EntityCardHeader, FormField, ActionButtons, StickyHeaderWrapper, SearchField, StatusFilter, DeleteConfirmationPopup, calculateStandardStatusCounts, filterEntitiesByStatus, generateEntityColor } from "../common"

const CollarStyleManager = () => {
  const [collarStyles, setCollarStyles] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [editingId, setEditingId] = useState(null)
  const [viewMode, setViewMode] = useState("card") // 'card' or 'list'
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all") // 'all', 'active', 'inactive', 'deleted'

  // Delete confirmation popup state
  const [deletePopup, setDeletePopup] = useState({
    isVisible: false,
    collarStyleId: null,
    message: "",
    isPermanentDelete: false,
    action: "delete", // "delete" or "revert"
  })

  // Refs for scroll and focus functionality
  const formRef = useRef(null)
  const collarStyleNameInputRef = useRef(null)

  // Pagination and lazy loading states
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(10) // For list view
  const [hasMoreCards, setHasMoreCards] = useState(true)
  const [displayedCards, setDisplayedCards] = useState([])

  const initialFormData = {
    name: "",
    description: "",
    isActive: false, // Default to false for new collar styles
  }

  const [formData, setFormData] = useState(initialFormData)

  // Fetch collar styles from backend
  const fetchCollarStyles = async () => {
    try {
      setLoading(true)
      const response = await api.get("/collar-styles?showInactive=true&includeDeleted=true")
      setCollarStyles(response.data)
      setError("")
    } catch (err) {
      setError("Failed to fetch collar styles")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCollarStyles()
  }, [])

  // Filter collar styles based on search query and status - memoized to prevent infinite loops
  const filteredCollarStyles = useMemo(() => {
    let filtered = collarStyles

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      filtered = filtered.filter((collarStyle) => collarStyle.name.toLowerCase().includes(query) || (collarStyle.description && collarStyle.description.toLowerCase().includes(query)))
    }

    // Apply status filter
    filtered = filterEntitiesByStatus(filtered, statusFilter)

    return filtered
  }, [collarStyles, searchQuery, statusFilter])

  // Pagination calculations
  const totalPages = Math.ceil(filteredCollarStyles.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentCollarStyles = filteredCollarStyles.slice(startIndex, endIndex)

  // Card lazy loading logic - only run when viewMode changes or filteredCollarStyles change
  useEffect(() => {
    if (viewMode === "card") {
      const initialCards = filteredCollarStyles.slice(0, 12)
      setDisplayedCards(initialCards)
      setHasMoreCards(filteredCollarStyles.length > 12)
      setCurrentPage(1)
    }
  }, [viewMode, filteredCollarStyles]) // Include filteredCollarStyles but it's memoized

  // Reset pagination when search query changes - use callback to prevent infinite loops
  const resetPaginationForSearch = useCallback(() => {
    setCurrentPage(1)
    if (viewMode === "card") {
      const initialCards = filteredCollarStyles.slice(0, 12)
      setDisplayedCards(initialCards)
      setHasMoreCards(filteredCollarStyles.length > 12)
    }
  }, [viewMode, filteredCollarStyles.length])

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
      const nextCards = filteredCollarStyles.slice(currentCardCount, currentCardCount + 12)

      if (nextCards.length > 0) {
        setHasMoreCards(currentCardCount + nextCards.length < filteredCollarStyles.length)
        return [...prevCards, ...nextCards]
      } else {
        setHasMoreCards(false)
        return prevCards
      }
    })
  }, [filteredCollarStyles])

  // Reset pagination when view mode changes
  const handleViewModeChange = useCallback(
    (mode) => {
      setViewMode(mode)
      setCurrentPage(1)
      if (mode === "card") {
        const initialCards = filteredCollarStyles.slice(0, 12)
        setDisplayedCards(initialCards)
        setHasMoreCards(filteredCollarStyles.length > 12)
      }
    },
    [filteredCollarStyles.length]
  )

  // Generate next collar style ID
  const generateNextCollarStyleId = useCallback(() => {
    if (collarStyles.length === 0) {
      return "PPSCOLSTY1001"
    }

    // Find the highest existing collar style ID number
    const existingIds = collarStyles
      .map((collarStyle) => collarStyle.collarStyleId)
      .filter((id) => id && id.startsWith("PPSCOLSTY"))
      .map((id) => {
        const match = id.match(/PPSCOLSTY(\d+)/)
        return match ? parseInt(match[1]) : 0
      })

    const maxNumber = existingIds.length > 0 ? Math.max(...existingIds) : 1000
    const nextNumber = maxNumber + 1
    return `PPSCOLSTY${nextNumber}`
  }, [collarStyles])

  // Get current collar style ID for display
  const getCurrentCollarStyleId = useCallback(() => {
    if (editingId) {
      const collarStyle = collarStyles.find((c) => c._id === editingId)
      return collarStyle?.collarStyleId || generateNextCollarStyleId()
    }
    return generateNextCollarStyleId()
  }, [editingId, collarStyles, generateNextCollarStyleId])

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    if (type === "checkbox") {
      setFormData({ ...formData, [name]: checked })
    } else {
      setFormData({ ...formData, [name]: value })
    }
  }

  const resetForm = () => {
    setFormData(initialFormData)
    setEditingId(null)
    setError("")
    // Don't clear success message here - let AlertMessage handle it
    // setSuccess("");
  }

  // Clear form after successful operations
  const clearForm = () => {
    setFormData(initialFormData)
    setEditingId(null)
    setError("")
    setSuccess("")
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!formData.name.trim()) {
      setError("Collar Style Name is required")
      return
    }

    try {
      setLoading(true)
      setSuccess("") // Clear any existing success message
      setError("") // Clear any existing error message

      const collarStyleData = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        isActive: formData.isActive,
      }

      if (editingId) {
        // Update collar style
        await api.put(`/collar-styles/${editingId}`, collarStyleData)
        setSuccess("Collar Style updated successfully!")
        // Reset form after update
        resetForm()
      } else {
        // Create collar style
        await api.post("/collar-styles", collarStyleData)
        setSuccess("Collar Style created successfully!")
        // Reset form after create - clear fields for next entry
        setFormData(initialFormData)
      }

      // Refresh collar styles list
      await fetchCollarStyles()
    } catch (err) {
      setError(err.response?.data?.msg || "Failed to save collar style")
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (collarStyle) => {
    console.log("Editing collar style:", collarStyle)
    console.log("Collar style isActive value:", collarStyle.isActive, "Type:", typeof collarStyle.isActive)

    // Ensure isActive is a boolean - default to false if undefined
    const isActiveValue = collarStyle.isActive !== undefined ? Boolean(collarStyle.isActive) : false
    console.log("Setting isActive to:", isActiveValue, "Type:", typeof isActiveValue)

    setFormData({
      ...initialFormData,
      name: collarStyle.name || "",
      description: collarStyle.description || "",
      isActive: isActiveValue,
    })
    setEditingId(collarStyle._id)
    setError("")
    setSuccess("")

    // Scroll to form and focus on collar style name input
    setTimeout(() => {
      if (formRef.current) {
        formRef.current.scrollIntoView({
          behavior: "smooth",
          block: "start",
        })
      }
      if (collarStyleNameInputRef.current) {
        collarStyleNameInputRef.current.focus()
      }
    }, 100)
  }

  const handleDelete = (collarStyleId) => {
    // Find the collar style to check if it's already marked as deleted
    const collarStyle = collarStyles.find((c) => c._id === collarStyleId)
    const isAlreadyDeleted = collarStyle?.deleted

    let message
    let isPermanentDelete = false

    if (isAlreadyDeleted) {
      message = "This collar style is already marked as deleted. Click OK to permanently remove it from the database. This action cannot be undone."
      isPermanentDelete = true
    } else {
      message = "This will mark the collar style as inactive and add a deleted flag. Click OK to continue."
      isPermanentDelete = false
    }

    setDeletePopup({
      isVisible: true,
      collarStyleId,
      message,
      isPermanentDelete,
      action: "delete",
    })
  }

  // Handle delete confirmation
  const handleDeleteConfirm = async () => {
    const { collarStyleId, isPermanentDelete } = deletePopup
    const collarStyle = collarStyles.find((c) => c._id === collarStyleId)

    try {
      setLoading(true)
      setSuccess("") // Clear any existing success message
      setError("") // Clear any existing error message

      if (isPermanentDelete) {
        // Permanent deletion
        await api.delete(`/collar-styles/${collarStyleId}/hard`)
        setSuccess(`🗑️ Collar Style "${collarStyle.name}" has been permanently deleted from the database.`)
      } else {
        // Soft delete - mark as inactive and add deleted flag
        await api.delete(`/collar-styles/${collarStyleId}`)
        setSuccess(`⏸️ Collar Style "${collarStyle.name}" has been marked as deleted and inactive.`)
      }

      await fetchCollarStyles()
    } catch (err) {
      const action = isPermanentDelete ? "permanently delete" : "mark as deleted"
      setError(`❌ Failed to ${action} collar style "${collarStyle.name}". ${err.response?.data?.msg || "Please try again."}`)
    } finally {
      setLoading(false)
      setDeletePopup({
        isVisible: false,
        collarStyleId: null,
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
      collarStyleId: null,
      message: "",
      isPermanentDelete: false,
      action: "delete",
    })
  }

  // Revert deleted collar style
  const handleRevert = async (collarStyleId) => {
    const collarStyle = collarStyles.find((c) => c._id === collarStyleId)

    if (!collarStyle) {
      setError("Collar style not found")
      return
    }

    if (!collarStyle.deleted) {
      setError("This collar style is not deleted")
      return
    }

    setDeletePopup({
      isVisible: true,
      collarStyleId,
      message: `Are you sure you want to restore the collar style "${collarStyle.name}"? This will make it active again.`,
      isPermanentDelete: false,
      action: "revert",
    })
  }

  // Handle revert confirmation
  const handleRevertConfirm = async () => {
    const { collarStyleId } = deletePopup
    const collarStyle = collarStyles.find((c) => c._id === collarStyleId)

    try {
      setLoading(true)
      setSuccess("")
      setError("")

      // Use the revert API endpoint
      await api.put(`/collar-styles/${collarStyleId}/revert`)

      setSuccess(`✅ Collar Style "${collarStyle.name}" has been restored and is now active!`)
      await fetchCollarStyles()
    } catch (err) {
      setError(`❌ Failed to restore collar style "${collarStyle.name}". ${err.response?.data?.msg || "Please try again."}`)
    } finally {
      setLoading(false)
      setDeletePopup({
        isVisible: false,
        collarStyleId: null,
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
      collarStyleId: null,
      message: "",
      isPermanentDelete: false,
      action: "delete",
    })
  }

  const handleCancel = () => {
    resetForm()
  }

  // Get status information for display
  const getStatusInfo = (collarStyle) => {
    if (collarStyle.deleted) {
      return { text: "Deleted", className: "deleted" }
    }
    return collarStyle.isActive ? { text: "Active", className: "active" } : { text: "Inactive", className: "inactive" }
  }

  return (
    <div className="paddingAll20">
      {/* Header */}
      <StickyHeaderWrapper>
        <PageHeader title="Collar Style Management" subtitle="Manage your product collar styles and classifications" isEditing={!!editingId} editText="Edit Collar Style" createText="Add New Collar Style" />
      </StickyHeaderWrapper>

      {/* Success/Error Messages */}
      <AlertMessage type="success" message={success} onClose={() => setSuccess("")} autoClose={true} />

      <AlertMessage type="error" message={error} onClose={() => setError("")} autoClose={true} />

      {/* Collar Style Form */}
      <div className="brandFormContainer paddingAll32 appendBottom30" ref={formRef}>
        <form onSubmit={handleSubmit} className="brandForm">
          {/* Collar Style ID Display Field */}
          <div className="makeFlex row gap10">
            <div className="fullWidth">
              <FormField
                type="text"
                name="collarStyleId"
                label="Collar Style ID"
                value={getCurrentCollarStyleId()}
                onChange={() => {}} // No change handler - read-only
                placeholder="Collar Style ID will be auto-generated"
                disabled={true}
                info="Collar Style ID is automatically generated in the format PPSCOLSTY1001, PPSCOLSTY1002, etc. This field cannot be edited."
              />
            </div>
          </div>

          <div className="makeFlex row gap10">
            <div className="fullWidth">
              <FormField ref={collarStyleNameInputRef} type="text" name="name" label="Collar Style Name" value={formData.name} onChange={handleChange} placeholder="Enter Collar Style Name (e.g., Mandarin Collar)" required={true} />
            </div>
          </div>

          <div className="makeFlex row gap10">
            <div className="fullWidth">
              <FormField type="textarea" name="description" label="Description" value={formData.description} onChange={handleChange} placeholder="Enter Collar Style Description" rows={3} />
            </div>
          </div>

          <div className="makeFlex row gap10">
            <div className="makeFlex column flexOne appendBottom16">
              <label className="formLabel appendBottom10">Status:</label>
              <label className="formLabel appendBottom8 makeFlex gap10">
                <FormField type="checkbox" name="isActive" value={formData.isActive} onChange={handleChange} />
                Active
              </label>
              <p className="negativeMarginTop10">Check this box to keep the collar style active, uncheck to mark as inactive</p>
            </div>
          </div>

          {/* Form Actions */}
          <div className="formActions paddingTop16">
            <button type="submit" disabled={loading} className="btnPrimary">
              {loading ? <span className="loadingSpinner">⏳</span> : <span>{editingId ? "Update Collar Style" : "Add Collar Style"}</span>}
            </button>

            {editingId && (
              <button type="button" onClick={handleCancel} className="btnSecondary">
                Cancel
              </button>
            )}

            {!editingId && success && (
              <button type="button" onClick={clearForm} className="btnSecondary">
                Add Another Collar Style
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Collar Styles List */}
      <div className="brandsListContainer paddingAll32">
        <div className="listHeader makeFlex spaceBetween alignCenter appendBottom24">
          <div className="leftSection">
            <h2 className="listTitle font30 fontBold blackText">Collar Styles ({filteredCollarStyles.length})</h2>
            <StatusFilter statusFilter={statusFilter} onStatusChange={setStatusFilter} counts={calculateStandardStatusCounts(collarStyles)} disabled={loading} />
          </div>
          <div className="rightSection makeFlex alignCenter gap16">
            {/* Search Input */}
            <SearchField value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search collar styles..." disabled={loading} minWidth="250px" onClear={() => setSearchQuery("")} />
            {loading && <div className="loadingIndicator grayText">Loading...</div>}
            <ViewToggle viewMode={viewMode} onViewChange={handleViewModeChange} disabled={loading} />
          </div>
        </div>

        {filteredCollarStyles.length === 0 && !loading ? (
          <div className="emptyState textCenter paddingAll60">
            <div className="emptyIcon appendBottom16">👔</div>
            <h3 className="font22 fontSemiBold grayText appendBottom8">No Collar Styles Found</h3>
            <p className="font16 grayText">Start by adding your first collar style above</p>
          </div>
        ) : (
          <>
            {/* Card View */}
            {viewMode === "card" && (
              <div className="brandsGrid">
                {displayedCards.map((collarStyle) => {
                  const statusInfo = getStatusInfo(collarStyle)
                  return (
                    <EntityCard
                      key={collarStyle._id}
                      entity={collarStyle}
                      logoField="image"
                      nameField="name"
                      idField="_id"
                      onEdit={collarStyle.deleted ? undefined : handleEdit}
                      onDelete={handleDelete}
                      onRevert={collarStyle.deleted ? () => handleRevert(collarStyle._id) : undefined}
                      loading={loading}
                      imagePlaceholderColor={generateEntityColor(collarStyle._id, collarStyle.name)}
                      renderHeader={(collarStyle) => <EntityCardHeader entity={collarStyle} imageField="image" titleField="name" dateField="createdAt" generateColor={generateEntityColor} />}
                      renderDetails={(collarStyle) => (
                        <>
                          <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                            <span className="detailLabel font14 fontSemiBold grayText textUppercase">Collar Style ID:</span>
                            <span className="detailValue font14 blackText appendLeft6">{collarStyle.collarStyleId || generateNextCollarStyleId()}</span>
                          </div>
                          <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                            <span className="detailLabel font14 fontSemiBold grayText textUppercase">Name:</span>
                            <span className="detailValue font14 blackText appendLeft6">{collarStyle.name}</span>
                          </div>
                          {collarStyle.description && (
                            <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                              <span className="detailLabel font14 fontSemiBold grayText textUppercase">Description:</span>
                              <span className="detailValue font14 blackText appendLeft6">{collarStyle.description}</span>
                            </div>
                          )}
                          <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                            <span className="detailLabel font14 fontSemiBold grayText textUppercase">Status:</span>
                            <span className={`detailValue font14 ${statusInfo.className === "active" ? "greenText" : statusInfo.className === "deleted" ? "redText" : "orangeText"} appendLeft6`}>{statusInfo.text}</span>
                          </div>
                        </>
                      )}
                      renderActions={(collarStyle) => <ActionButtons onEdit={collarStyle.deleted ? undefined : () => handleEdit(collarStyle)} onDelete={() => handleDelete(collarStyle._id)} onRevert={collarStyle.deleted ? () => handleRevert(collarStyle._id) : undefined} loading={loading} size="normal" deleteText={collarStyle.deleted ? "🗑️ Final Del" : "🗑️ Delete"} deleteTitle={collarStyle.deleted ? "Permanently delete this collar style" : "Mark collar style as deleted"} revertText="🔄 Restore" revertTitle="Restore this deleted collar style" />}
                      className="brandCard"
                    />
                  )
                })}
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
                        <th className="tableHeader">Collar Style ID</th>
                        <th className="tableHeader">Name</th>
                        <th className="tableHeader">Description</th>
                        <th className="tableHeader">Status</th>
                        <th className="tableHeader">Created</th>
                        <th className="tableHeader">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentCollarStyles.map((collarStyle) => {
                        const statusInfo = getStatusInfo(collarStyle)
                        return (
                          <tr key={collarStyle._id} className="tableRow">
                            <td className="tableCell">
                              <span className="brandNameText">{collarStyle.collarStyleId || generateNextCollarStyleId()}</span>
                            </td>
                            <td className="tableCell">
                              <span className="brandNameText">{collarStyle.name}</span>
                            </td>
                            <td className="tableCell">
                              <span className="addressText" title={collarStyle.description}>
                                {collarStyle.description ? (collarStyle.description.length > 30 ? `${collarStyle.description.substring(0, 30)}...` : collarStyle.description) : "-"}
                              </span>
                            </td>
                            <td className="tableCell">
                              <span className={`statusText ${statusInfo.className}`}>{statusInfo.text}</span>
                            </td>
                            <td className="tableCell">
                              <span className="dateText">{new Date(collarStyle.createdAt).toLocaleDateString()}</span>
                            </td>
                            <td className="tableCell">
                              <div className="tableActions makeFlex gap8">
                                <ActionButtons onEdit={collarStyle.deleted ? undefined : () => handleEdit(collarStyle)} onDelete={() => handleDelete(collarStyle._id)} onRevert={collarStyle.deleted ? () => handleRevert(collarStyle._id) : undefined} loading={loading} size="small" editText="✏️" deleteText={collarStyle.deleted ? "🗑️" : "🗑️"} revertText="🔄" editTitle="Edit Collar Style" deleteTitle={collarStyle.deleted ? "Final Del" : "Delete Collar Style"} revertTitle="Restore Collar Style" />
                              </div>
                            </td>
                          </tr>
                        )
                      })}
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

export default CollarStyleManager
