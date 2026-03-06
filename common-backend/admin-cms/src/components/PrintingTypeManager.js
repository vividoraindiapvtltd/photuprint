import React, { useState, useEffect, useMemo, useCallback, useRef } from "react"
import api from "../api/axios"
import {
  PageHeader,
  AlertMessage,
  ViewToggle,
  Pagination,
  EntityCard,
  EntityCardHeader,
  FormField,
  ActionButtons,
  SearchField,
  StatusFilter,
  DeleteConfirmationPopup,
  calculateStandardStatusCounts,
  filterEntitiesByStatus,
  generateBrandColor,
} from "../common"

const PrintingTypeManager = () => {
  const [printingTypes, setPrintingTypes] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [editingId, setEditingId] = useState(null)
  const [viewMode, setViewMode] = useState("card")
  const [statusFilter, setStatusFilter] = useState("all")
  const [deletePopup, setDeletePopup] = useState({
    isVisible: false,
    printingTypeId: null,
    message: "",
    isPermanentDelete: false,
    action: "delete",
  })
  const formRef = useRef(null)
  const nameInputRef = useRef(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(10)
  const [hasMoreCards, setHasMoreCards] = useState(true)
  const [displayedCards, setDisplayedCards] = useState([])

  const initialFormData = { name: "", description: "", isActive: false }
  const [formData, setFormData] = useState(initialFormData)
  const [searchQuery, setSearchQuery] = useState("")

  const validateName = (name) => {
    if (!name || !name.trim()) return { isValid: false, error: "Printing type name is required" }
    const existing = printingTypes.find(
      (p) =>
        p.name.toLowerCase().trim() === name.toLowerCase().trim() &&
        p._id !== editingId &&
        p.isActive === true &&
        !p.deleted
    )
    if (existing) return { isValid: false, error: "Printing type name already exists" }
    return { isValid: true, error: "" }
  }

  const fetchPrintingTypes = async () => {
    try {
      setLoading(true)
      const res = await api.get("/printing-types?showInactive=true&includeDeleted=true")
      setPrintingTypes(res.data || [])
      setError("")
    } catch (err) {
      setError("Failed to fetch printing types")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPrintingTypes()
  }, [])

  const filteredPrintingTypes = useMemo(() => {
    let filtered = printingTypes
    if (searchQuery?.trim()) {
      const q = searchQuery.toLowerCase().trim()
      filtered = filtered.filter(
        (p) =>
          (p.name && p.name.toLowerCase().includes(q)) ||
          (p.description && p.description.toLowerCase().includes(q))
      )
    }
    return filterEntitiesByStatus(filtered, statusFilter)
  }, [printingTypes, searchQuery, statusFilter])

  const totalPages = Math.ceil(filteredPrintingTypes.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const currentPrintingTypes = filteredPrintingTypes.slice(startIndex, startIndex + itemsPerPage)

  useEffect(() => {
    if (viewMode === "card" && filteredPrintingTypes.length > 0) {
      setDisplayedCards(filteredPrintingTypes.slice(0, 12))
      setHasMoreCards(filteredPrintingTypes.length > 12)
      setCurrentPage(1)
    }
  }, [filteredPrintingTypes, viewMode])

  const resetPaginationForSearch = useCallback(() => {
    setCurrentPage(1)
    if (viewMode === "card") {
      setDisplayedCards(filteredPrintingTypes.slice(0, 12))
      setHasMoreCards(filteredPrintingTypes.length > 12)
    }
  }, [viewMode, filteredPrintingTypes.length])

  useEffect(() => {
    resetPaginationForSearch()
  }, [searchQuery, resetPaginationForSearch])

  const handlePageChange = useCallback((pageNumber) => {
    setCurrentPage(pageNumber)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }, [])

  const handleLoadMoreCards = useCallback(() => {
    setDisplayedCards((prev) => {
      const next = filteredPrintingTypes.slice(prev.length, prev.length + 12)
      if (next.length > 0) {
        setHasMoreCards(prev.length + next.length < filteredPrintingTypes.length)
        return [...prev, ...next]
      }
      setHasMoreCards(false)
      return prev
    })
  }, [filteredPrintingTypes])

  const handleViewModeChange = useCallback((mode) => {
    setViewMode(mode)
    setCurrentPage(1)
    if (mode === "card") {
      setDisplayedCards(filteredPrintingTypes.slice(0, 12))
      setHasMoreCards(filteredPrintingTypes.length > 12)
    }
  }, [filteredPrintingTypes.length])

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }))
  }

  const resetForm = () => {
    setFormData(initialFormData)
    setEditingId(null)
    setError("")
  }

  const clearForm = () => {
    setFormData(initialFormData)
    setEditingId(null)
    setError("")
    setSuccess("")
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const validation = validateName(formData.name)
    if (!validation.isValid) {
      setError(validation.error)
      return
    }
    try {
      setLoading(true)
      setSuccess("")
      setError("")
      const payload = {
        name: formData.name.trim(),
        description: formData.description?.trim() || "",
        isActive: formData.isActive,
      }
      if (editingId) {
        await api.put(`/printing-types/${editingId}`, payload)
        setSuccess(`✅ Printing type "${payload.name}" has been updated successfully!`)
      } else {
        await api.post("/printing-types", payload)
        setSuccess(`✅ Printing type "${payload.name}" has been created successfully!`)
      }
      await fetchPrintingTypes()
      resetForm()
    } catch (err) {
      setError(
        err.response?.data?.msg?.includes("already exists")
          ? `❌ ${err.response.data.msg}`
          : `❌ Failed to ${editingId ? "update" : "create"} printing type. ${err.response?.data?.msg || "Please try again."}`
      )
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (item) => {
    setFormData({
      name: item.name || "",
      description: item.description || "",
      isActive: item.isActive !== undefined ? item.isActive : false,
    })
    setEditingId(item._id || item.id)
    setError("")
    setSuccess("")
    setTimeout(() => {
      if (formRef.current) formRef.current.scrollIntoView({ behavior: "smooth", block: "start" })
      if (nameInputRef.current) nameInputRef.current.focus()
    }, 100)
  }

  const handleDelete = (id) => {
    const item = printingTypes.find((p) => p._id === id)
    const isAlreadyDeleted = item?.deleted
    setDeletePopup({
      isVisible: true,
      printingTypeId: id,
      message: isAlreadyDeleted
        ? "This printing type is already marked as deleted. Click OK to permanently remove it from the database. This action cannot be undone."
        : "This will mark the printing type as inactive and add a deleted flag. Click OK to continue.",
      isPermanentDelete: !!isAlreadyDeleted,
      action: "delete",
    })
  }

  const handleDeleteConfirm = async () => {
    const { printingTypeId, isPermanentDelete } = deletePopup
    const item = printingTypes.find((p) => p._id === printingTypeId)
    try {
      setLoading(true)
      setSuccess("")
      setError("")
      if (isPermanentDelete) {
        await api.delete(`/printing-types/${printingTypeId}/hard`)
        setSuccess(`🗑️ Printing type "${item.name}" has been permanently deleted.`)
      } else {
        await api.delete(`/printing-types/${printingTypeId}`)
        setSuccess(`⏸️ Printing type "${item.name}" has been marked as deleted and inactive.`)
      }
      await fetchPrintingTypes()
    } catch (err) {
      setError(`❌ Failed to ${deletePopup.isPermanentDelete ? "permanently delete" : "mark as deleted"} printing type. ${err.response?.data?.msg || ""}`)
    } finally {
      setLoading(false)
      setDeletePopup({ isVisible: false, printingTypeId: null, message: "", isPermanentDelete: false, action: "delete" })
    }
  }

  const handleDeleteCancel = () => {
    setDeletePopup({ isVisible: false, printingTypeId: null, message: "", isPermanentDelete: false, action: "delete" })
  }

  const handleRevert = (id) => {
    const item = printingTypes.find((p) => p._id === id)
    if (!item) {
      setError("Printing type not found")
      return
    }
    if (!item.deleted) {
      setError("This printing type is not deleted")
      return
    }
    setDeletePopup({
      isVisible: true,
      printingTypeId: id,
      message: `Are you sure you want to restore the printing type "${item.name}"? This will make it active again.`,
      isPermanentDelete: false,
      action: "revert",
    })
  }

  const handleRevertConfirm = async () => {
    const { printingTypeId } = deletePopup
    const item = printingTypes.find((p) => p._id === printingTypeId)
    try {
      setLoading(true)
      setSuccess("")
      setError("")
      const existing = printingTypes.find(
        (p) => p._id !== printingTypeId && p.name.toLowerCase().trim() === item.name.toLowerCase().trim() && !p.deleted
      )
      if (existing) {
        setError(`❌ Cannot restore. A printing type with name "${item.name}" already exists.`)
        setLoading(false)
        setDeletePopup({ isVisible: false, printingTypeId: null, message: "", isPermanentDelete: false, action: "delete" })
        return
      }
      await api.put(`/printing-types/${printingTypeId}`, {
        name: item.name,
        description: item.description || "",
        isActive: true,
        deleted: false,
      })
      setSuccess(`✅ Printing type "${item.name}" has been restored and is now active!`)
      await fetchPrintingTypes()
    } catch (err) {
      setError(`❌ Failed to restore printing type. ${err.response?.data?.msg || ""}`)
    } finally {
      setLoading(false)
      setDeletePopup({ isVisible: false, printingTypeId: null, message: "", isPermanentDelete: false, action: "delete" })
    }
  }

  const handleRevertCancel = () => {
    setDeletePopup({ isVisible: false, printingTypeId: null, message: "", isPermanentDelete: false, action: "delete" })
  }

  return (
    <div className="paddingAll20">
      <PageHeader
        title="Printing Type Management"
        subtitle="Add, edit and delete printing types for products"
        isEditing={!!editingId}
        editText="Edit Printing Type"
        createText="Add New Printing Type"
      />
      <AlertMessage type="success" message={success} onClose={() => setSuccess("")} autoClose={true} />
      <AlertMessage type="error" message={error} onClose={() => setError("")} autoClose={true} />

      <div className="brandFormContainer paddingAll32 appendBottom30" ref={formRef}>
        <form onSubmit={handleSubmit} className="brandForm">
          <div className="makeFlex row gap10">
            <div className="fullWidth">
              <FormField
                ref={nameInputRef}
                type="text"
                name="name"
                label="Printing Type Name"
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g. Screen Print, DTF, Sublimation"
                required
              />
            </div>
          </div>
          <div className="makeFlex row gap10">
            <div className="fullWidth">
              <FormField
                type="textarea"
                name="description"
                label="Description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Enter description"
                rows={3}
              />
            </div>
          </div>
          <div className="makeFlex row gap10">
            <div className="makeFlex column flexOne appendBottom16">
              <label className="formLabel appendBottom10">Status:</label>
              <label className="formLabel appendBottom8 makeFlex gap10">
                <FormField type="checkbox" name="isActive" value={formData.isActive} onChange={handleChange} />
                Active
              </label>
              <p className="negativeMarginTop10">Check to keep active, uncheck to mark inactive</p>
            </div>
          </div>
          <div className="formActions paddingTop16">
            <button type="submit" disabled={loading} className="btnPrimary">
              {loading ? <span className="loadingSpinner">⏳</span> : <span>{editingId ? "Update Printing Type" : "Add Printing Type"}</span>}
            </button>
            {(editingId || (!editingId && (formData.name || formData.description))) && (
              <button type="button" onClick={() => resetForm()} className="btnSecondary">
                Cancel
              </button>
            )}
            {!editingId && success && (
              <button type="button" onClick={clearForm} className="btnSecondary">
                Add Another Printing Type
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="brandsListContainer paddingAll32">
        <div className="listHeader makeFlex spaceBetween end appendBottom24">
          <div className="leftSection">
            <h2 className="listTitle font30 fontBold blackText appendBottom16">
              Printing Types ({filteredPrintingTypes?.length || 0})
            </h2>
            <StatusFilter
              statusFilter={statusFilter}
              onStatusChange={setStatusFilter}
              counts={calculateStandardStatusCounts(printingTypes)}
              disabled={loading}
            />
          </div>
          <div className="rightSection makeFlex end gap10">
            <SearchField
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search printing types..."
              disabled={loading}
              minWidth="250px"
            />
            {loading && <div className="loadingIndicator grayText">Loading...</div>}
            <ViewToggle viewMode={viewMode} onViewChange={handleViewModeChange} disabled={loading} />
          </div>
        </div>

        {filteredPrintingTypes.length === 0 && !loading ? (
          <div className="emptyState textCenter paddingAll60">
            <div className="emptyIcon appendBottom16">🖨️</div>
            <h3 className="font22 fontSemiBold grayText appendBottom8">No Printing Types Found</h3>
            <p className="font16 grayText">Start by adding your first printing type above</p>
          </div>
        ) : (
          <>
            {viewMode === "card" && (
              <div className="brandsGrid">
                {displayedCards.map((item) => (
                  <EntityCard
                    key={item._id || item.id}
                    entity={item}
                    logoField="image"
                    nameField="name"
                    idField="_id"
                    onEdit={item.deleted ? undefined : () => handleEdit(item)}
                    onDelete={() => handleDelete(item._id || item.id)}
                    onRevert={item.deleted ? () => handleRevert(item._id || item.id) : undefined}
                    loading={loading}
                    imagePlaceholderColor={generateBrandColor(item._id || item.id, item.name)}
                    renderHeader={(entity) => (
                      <EntityCardHeader
                        entity={entity}
                        imageField="image"
                        titleField="name"
                        dateField="createdAt"
                        generateColor={generateBrandColor}
                      />
                    )}
                    renderDetails={(entity) => (
                      <>
                        <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                          <span className="detailLabel font14 fontSemiBold grayText textUppercase">Name:</span>
                          <span className="detailValue font14 blackText appendLeft6">{entity.name}</span>
                        </div>
                        {entity.description && (
                          <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                            <span className="detailLabel font14 fontSemiBold grayText textUppercase">Description:</span>
                            <span className="detailValue font14 blackText appendLeft6">{entity.description}</span>
                          </div>
                        )}
                        <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                          <span className="detailLabel font14 fontSemiBold grayText textUppercase">Status:</span>
                          <span className={`detailValue font14 ${entity.deleted ? "deleted" : entity.isActive ? "greenText" : "inactive"} appendLeft6`}>
                            {entity.deleted ? "Deleted" : entity.isActive ? "Active" : "Inactive"}
                          </span>
                        </div>
                      </>
                    )}
                    renderActions={(entity) => (
                      <ActionButtons
                        onEdit={entity.deleted ? undefined : () => handleEdit(entity)}
                        onDelete={() => handleDelete(entity._id || entity.id)}
                        onRevert={entity.deleted ? () => handleRevert(entity._id || entity.id) : undefined}
                        loading={loading}
                        size="normal"
                        editText="✏️ Edit"
                        deleteText={entity.deleted ? "🗑️ Final Del" : "🗑️ Delete"}
                        revertText="🔄 Undelete"
                        editTitle="Edit Printing Type"
                        deleteTitle={entity.deleted ? "Permanent Delete" : "Delete"}
                        revertTitle="Restore"
                      />
                    )}
                    className="brandCard"
                  />
                ))}
                {hasMoreCards && (
                  <div className="loadMoreContainer textCenter paddingAll20">
                    <button onClick={handleLoadMoreCards} className="btnPrimary" disabled={loading}>
                      {loading ? <span className="loadingSpinner">⏳</span> : "Load More"}
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
                        <th className="tableHeader">Name</th>
                        <th className="tableHeader">Description</th>
                        <th className="tableHeader">Status</th>
                        <th className="tableHeader">Created</th>
                        <th className="tableHeader">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentPrintingTypes.map((item) => (
                        <tr key={item._id || item.id} className="tableRow">
                          <td className="tableCell">
                            <span className="brandNameText">{item.name}</span>
                          </td>
                          <td className="tableCell">
                            <span className="addressText" title={item.description}>
                              {item.description ? (item.description.length > 30 ? `${item.description.substring(0, 30)}...` : item.description) : "-"}
                            </span>
                          </td>
                          <td className="tableCell">
                            <span className={`statusText ${item.deleted ? "deleted" : item.isActive ? "active" : "inactive"}`}>
                              {item.deleted ? "Deleted" : item.isActive ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td className="tableCell">
                            <span className="dateText">{new Date(item.createdAt).toLocaleDateString()}</span>
                          </td>
                          <td className="tableCell">
                            <div className="tableActions makeFlex gap8">
                              <ActionButtons
                                onEdit={item.deleted ? undefined : () => handleEdit(item)}
                                onDelete={() => handleDelete(item._id || item.id)}
                                onRevert={item.deleted ? () => handleRevert(item._id || item.id) : undefined}
                                loading={loading}
                                size="small"
                                editText="✏️"
                                deleteText="🗑️"
                                revertText="🔄"
                                editTitle="Edit"
                                deleteTitle={item.deleted ? "Final Del" : "Delete"}
                                revertTitle="Restore"
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

      <DeleteConfirmationPopup
        isVisible={deletePopup.isVisible}
        message={deletePopup.message}
        onConfirm={deletePopup.action === "delete" ? handleDeleteConfirm : handleRevertConfirm}
        onCancel={deletePopup.action === "delete" ? handleDeleteCancel : handleRevertCancel}
        action={deletePopup.action}
        isPermanentDelete={deletePopup.isPermanentDelete}
      />
    </div>
  )
}

export default PrintingTypeManager
