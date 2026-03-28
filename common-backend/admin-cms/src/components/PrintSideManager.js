import React, { useState, useEffect, useMemo, useCallback, useRef } from "react"
import api, { getUploadBaseURL } from "../api/axios"
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

const resolveStoredImageUrl = (path) => {
  if (!path || typeof path !== "string") return null
  if (path.startsWith("http://") || path.startsWith("https://")) return path
  const base = getUploadBaseURL()
  return path.startsWith("/") ? `${base}${path}` : `${base}/uploads/${path}`
}

const PrintSideManager = () => {
  const [printSides, setPrintSides] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [editingId, setEditingId] = useState(null)
  const [viewMode, setViewMode] = useState("card")
  const [statusFilter, setStatusFilter] = useState("all")
  const [deletePopup, setDeletePopup] = useState({
    isVisible: false,
    printSideId: null,
    message: "",
    isPermanentDelete: false,
    action: "delete",
  })
  const formRef = useRef(null)
  const nameInputRef = useRef(null)
  const imageInputRef = useRef(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(10)
  const [hasMoreCards, setHasMoreCards] = useState(true)
  const [displayedCards, setDisplayedCards] = useState([])

  const initialFormData = { name: "", description: "", sortOrder: 0, isActive: false, image: null }
  const [formData, setFormData] = useState(initialFormData)
  const [currentImageUrl, setCurrentImageUrl] = useState(null)
  const [previewBlobUrl, setPreviewBlobUrl] = useState(null)
  const [stripImageOnSave, setStripImageOnSave] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  const validateName = (name) => {
    if (!name || !name.trim()) return { isValid: false, error: "Print side name is required" }
    const existing = printSides.find(
      (p) =>
        p.name.toLowerCase().trim() === name.toLowerCase().trim() &&
        p._id !== editingId &&
        p.isActive === true &&
        !p.deleted
    )
    if (existing) return { isValid: false, error: "Print side name already exists" }
    return { isValid: true, error: "" }
  }

  const fetchPrintSides = async () => {
    try {
      setLoading(true)
      const res = await api.get("/print-sides?showInactive=true&includeDeleted=true")
      setPrintSides(res.data || [])
      setError("")
    } catch (err) {
      setError("Failed to fetch print sides")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPrintSides()
  }, [])

  useEffect(() => {
    if (!(formData.image instanceof File)) {
      setPreviewBlobUrl(null)
      return undefined
    }
    const u = URL.createObjectURL(formData.image)
    setPreviewBlobUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [formData.image])

  const filteredPrintSides = useMemo(() => {
    let filtered = printSides
    if (searchQuery?.trim()) {
      const q = searchQuery.toLowerCase().trim()
      filtered = filtered.filter(
        (p) =>
          (p.name && p.name.toLowerCase().includes(q)) ||
          (p.description && p.description.toLowerCase().includes(q))
      )
    }
    return filterEntitiesByStatus(filtered, statusFilter)
  }, [printSides, searchQuery, statusFilter])

  const totalPages = Math.ceil(filteredPrintSides.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const currentPrintSides = filteredPrintSides.slice(startIndex, startIndex + itemsPerPage)

  useEffect(() => {
    if (viewMode === "card" && filteredPrintSides.length > 0) {
      setDisplayedCards(filteredPrintSides.slice(0, 12))
      setHasMoreCards(filteredPrintSides.length > 12)
      setCurrentPage(1)
    }
  }, [filteredPrintSides, viewMode])

  const resetPaginationForSearch = useCallback(() => {
    setCurrentPage(1)
    if (viewMode === "card") {
      setDisplayedCards(filteredPrintSides.slice(0, 12))
      setHasMoreCards(filteredPrintSides.length > 12)
    }
  }, [viewMode, filteredPrintSides.length])

  useEffect(() => {
    resetPaginationForSearch()
  }, [searchQuery, resetPaginationForSearch])

  const handlePageChange = useCallback((pageNumber) => {
    setCurrentPage(pageNumber)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }, [])

  const handleLoadMoreCards = useCallback(() => {
    setDisplayedCards((prev) => {
      const next = filteredPrintSides.slice(prev.length, prev.length + 12)
      if (next.length > 0) {
        setHasMoreCards(prev.length + next.length < filteredPrintSides.length)
        return [...prev, ...next]
      }
      setHasMoreCards(false)
      return prev
    })
  }, [filteredPrintSides])

  const handleViewModeChange = useCallback((mode) => {
    setViewMode(mode)
    setCurrentPage(1)
    if (mode === "card") {
      setDisplayedCards(filteredPrintSides.slice(0, 12))
      setHasMoreCards(filteredPrintSides.length > 12)
    }
  }, [filteredPrintSides.length])

  const handleChange = (e) => {
    const { name, value, type, checked, files } = e.target
    if (type === "checkbox") {
      setFormData((prev) => ({ ...prev, [name]: checked }))
    } else if (type === "file") {
      const f = files?.[0]
      if (f && !f.type.startsWith("image/")) {
        setError("Please select an image file")
        e.target.value = ""
        return
      }
      setFormData((prev) => ({ ...prev, image: f || null }))
      setStripImageOnSave(false)
      setError("")
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }))
    }
  }

  const resetForm = () => {
    setFormData(initialFormData)
    setCurrentImageUrl(null)
    setStripImageOnSave(false)
    setEditingId(null)
    setError("")
    if (imageInputRef.current) imageInputRef.current.value = ""
  }

  const clearForm = () => {
    setFormData(initialFormData)
    setCurrentImageUrl(null)
    setStripImageOnSave(false)
    setEditingId(null)
    setError("")
    setSuccess("")
    if (imageInputRef.current) imageInputRef.current.value = ""
  }

  const handleRemoveImage = () => {
    setFormData((prev) => ({ ...prev, image: null }))
    setCurrentImageUrl(null)
    if (editingId) setStripImageOnSave(true)
    if (imageInputRef.current) imageInputRef.current.value = ""
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
      const basePayload = {
        name: formData.name.trim(),
        description: formData.description?.trim() || "",
        sortOrder: Number(formData.sortOrder) || 0,
        isActive: formData.isActive,
      }
      const hasNewImage = formData.image instanceof File
      let reqBody
      if (hasNewImage) {
        reqBody = new FormData()
        reqBody.append("name", basePayload.name)
        reqBody.append("description", basePayload.description)
        reqBody.append("sortOrder", String(basePayload.sortOrder))
        reqBody.append("isActive", basePayload.isActive ? "true" : "false")
        reqBody.append("image", formData.image)
      } else {
        reqBody = { ...basePayload }
        if (editingId && stripImageOnSave) reqBody.removeImage = true
      }
      if (editingId) {
        await api.put(`/print-sides/${editingId}`, reqBody)
        setSuccess(`✅ Print side "${basePayload.name}" has been updated successfully!`)
      } else {
        await api.post("/print-sides", reqBody)
        setSuccess(`✅ Print side "${basePayload.name}" has been created successfully!`)
      }
      await fetchPrintSides()
      resetForm()
    } catch (err) {
      setError(
        err.response?.data?.msg?.includes("already exists")
          ? `❌ ${err.response.data.msg}`
          : `❌ Failed to ${editingId ? "update" : "create"} print side. ${err.response?.data?.msg || "Please try again."}`
      )
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (item) => {
    setFormData({
      name: item.name || "",
      description: item.description || "",
      sortOrder: item.sortOrder ?? 0,
      isActive: item.isActive !== undefined ? item.isActive : false,
      image: null,
    })
    setCurrentImageUrl(resolveStoredImageUrl(item.image))
    setStripImageOnSave(false)
    setEditingId(item._id || item.id)
    setError("")
    setSuccess("")
    if (imageInputRef.current) imageInputRef.current.value = ""
    setTimeout(() => {
      if (formRef.current) formRef.current.scrollIntoView({ behavior: "smooth", block: "start" })
      if (nameInputRef.current) nameInputRef.current.focus()
    }, 100)
  }

  const handleDelete = (id) => {
    const item = printSides.find((p) => p._id === id)
    const isAlreadyDeleted = item?.deleted
    setDeletePopup({
      isVisible: true,
      printSideId: id,
      message: isAlreadyDeleted
        ? "This print side is already marked as deleted. Click OK to permanently remove it from the database. This action cannot be undone."
        : "This will mark the print side as inactive and add a deleted flag. Click OK to continue.",
      isPermanentDelete: !!isAlreadyDeleted,
      action: "delete",
    })
  }

  const handleDeleteConfirm = async () => {
    const { printSideId, isPermanentDelete } = deletePopup
    const item = printSides.find((p) => p._id === printSideId)
    try {
      setLoading(true)
      setSuccess("")
      setError("")
      if (isPermanentDelete) {
        await api.delete(`/print-sides/${printSideId}/hard`)
        setSuccess(`🗑️ Print side "${item.name}" has been permanently deleted.`)
      } else {
        await api.delete(`/print-sides/${printSideId}`)
        setSuccess(`⏸️ Print side "${item.name}" has been marked as deleted and inactive.`)
      }
      await fetchPrintSides()
    } catch (err) {
      setError(`❌ Failed to ${deletePopup.isPermanentDelete ? "permanently delete" : "mark as deleted"} print side. ${err.response?.data?.msg || ""}`)
    } finally {
      setLoading(false)
      setDeletePopup({ isVisible: false, printSideId: null, message: "", isPermanentDelete: false, action: "delete" })
    }
  }

  const handleDeleteCancel = () => {
    setDeletePopup({ isVisible: false, printSideId: null, message: "", isPermanentDelete: false, action: "delete" })
  }

  const handleRevert = (id) => {
    const item = printSides.find((p) => p._id === id)
    if (!item) {
      setError("Print side not found")
      return
    }
    if (!item.deleted) {
      setError("This print side is not deleted")
      return
    }
    setDeletePopup({
      isVisible: true,
      printSideId: id,
      message: `Are you sure you want to restore the print side "${item.name}"? This will make it active again.`,
      isPermanentDelete: false,
      action: "revert",
    })
  }

  const handleRevertConfirm = async () => {
    const { printSideId } = deletePopup
    const item = printSides.find((p) => p._id === printSideId)
    try {
      setLoading(true)
      setSuccess("")
      setError("")
      const existing = printSides.find(
        (p) => p._id !== printSideId && p.name.toLowerCase().trim() === item.name.toLowerCase().trim() && !p.deleted
      )
      if (existing) {
        setError(`❌ Cannot restore. A print side with name "${item.name}" already exists.`)
        setLoading(false)
        setDeletePopup({ isVisible: false, printSideId: null, message: "", isPermanentDelete: false, action: "delete" })
        return
      }
      await api.put(`/print-sides/${printSideId}`, {
        name: item.name,
        description: item.description || "",
        sortOrder: item.sortOrder ?? 0,
        isActive: true,
        deleted: false,
      })
      setSuccess(`✅ Print side "${item.name}" has been restored and is now active!`)
      await fetchPrintSides()
    } catch (err) {
      setError(`❌ Failed to restore print side. ${err.response?.data?.msg || ""}`)
    } finally {
      setLoading(false)
      setDeletePopup({ isVisible: false, printSideId: null, message: "", isPermanentDelete: false, action: "delete" })
    }
  }

  const handleRevertCancel = () => {
    setDeletePopup({ isVisible: false, printSideId: null, message: "", isPermanentDelete: false, action: "delete" })
  }

  return (
    <div className="paddingAll20">
      <PageHeader
        title="Print Side Management"
        subtitle="Add, edit and delete print sides for products"
        isEditing={!!editingId}
        editText="Edit Print Side"
        createText="Add New Print Side"
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
                label="Print Side Name"
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g. Front Side, Back Side, Left Sleeve"
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
              <label className="formLabel appendBottom10" htmlFor="print-side-image">
                Image (optional)
              </label>
              <input
                id="print-side-image"
                ref={imageInputRef}
                type="file"
                name="image"
                accept="image/*"
                onChange={handleChange}
                className="font14"
              />
              {(previewBlobUrl || currentImageUrl) && (
                <div className="makeFlex alignCenter gap10 paddingTop10">
                  <img
                    src={previewBlobUrl || currentImageUrl}
                    alt=""
                    style={{ maxWidth: 120, maxHeight: 120, objectFit: "cover", borderRadius: 4 }}
                  />
                  <button type="button" onClick={handleRemoveImage} className="btnSecondary">
                    Remove image
                  </button>
                </div>
              )}
              <p className="negativeMarginTop10 grayText font14">Optional reference image for this print side.</p>
            </div>
          </div>
          <div className="makeFlex row gap10">
            <div className="fullWidth" style={{ maxWidth: "200px" }}>
              <FormField
                type="number"
                name="sortOrder"
                label="Sort order"
                value={formData.sortOrder}
                onChange={handleChange}
                placeholder="0"
                min="0"
                step="1"
                info="Lower numbers appear first on products"
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
              {loading ? <span className="loadingSpinner">⏳</span> : <span>{editingId ? "Update Print Side" : "Add Print Side"}</span>}
            </button>
            {(editingId || (!editingId && (formData.name || formData.description || formData.image))) && (
              <button type="button" onClick={() => resetForm()} className="btnSecondary">
                Cancel
              </button>
            )}
            {!editingId && success && (
              <button type="button" onClick={clearForm} className="btnSecondary">
                Add Another Print Side
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="brandsListContainer paddingAll32">
        <div className="listHeader makeFlex spaceBetween end appendBottom24">
          <div className="leftSection">
            <h2 className="listTitle font30 fontBold blackText appendBottom16">
              Print Sides ({filteredPrintSides?.length || 0})
            </h2>
            <StatusFilter
              statusFilter={statusFilter}
              onStatusChange={setStatusFilter}
              counts={calculateStandardStatusCounts(printSides)}
              disabled={loading}
            />
          </div>
          <div className="rightSection makeFlex end gap10">
            <SearchField
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search print sides..."
              disabled={loading}
              minWidth="250px"
            />
            {loading && <div className="loadingIndicator grayText">Loading...</div>}
            <ViewToggle viewMode={viewMode} onViewChange={handleViewModeChange} disabled={loading} />
          </div>
        </div>

        {filteredPrintSides.length === 0 && !loading ? (
          <div className="emptyState textCenter paddingAll60">
            <div className="emptyIcon appendBottom16">📐</div>
            <h3 className="font22 fontSemiBold grayText appendBottom8">No Print Sides Found</h3>
            <p className="font16 grayText">Start by adding your first print side above</p>
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
                        entity={{ ...entity, image: resolveStoredImageUrl(entity.image) }}
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
                          <span className="detailLabel font14 fontSemiBold grayText textUppercase">Sort:</span>
                          <span className="detailValue font14 blackText appendLeft6">{entity.sortOrder ?? 0}</span>
                        </div>
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
                        editTitle="Edit Print Side"
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
                        <th className="tableHeader">Image</th>
                        <th className="tableHeader">Name</th>
                        <th className="tableHeader">Description</th>
                        <th className="tableHeader">Sort</th>
                        <th className="tableHeader">Status</th>
                        <th className="tableHeader">Created</th>
                        <th className="tableHeader">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentPrintSides.map((item) => (
                        <tr key={item._id || item.id} className="tableRow">
                          <td className="tableCell">
                            {item.image ? (
                              <img
                                src={resolveStoredImageUrl(item.image)}
                                alt=""
                                style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 4 }}
                              />
                            ) : (
                              <span className="grayText">—</span>
                            )}
                          </td>
                          <td className="tableCell">
                            <span className="brandNameText">{item.name}</span>
                          </td>
                          <td className="tableCell">
                            <span className="addressText" title={item.description}>
                              {item.description ? (item.description.length > 30 ? `${item.description.substring(0, 30)}...` : item.description) : "-"}
                            </span>
                          </td>
                          <td className="tableCell">
                            <span className="dateText">{item.sortOrder ?? 0}</span>
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

export default PrintSideManager
