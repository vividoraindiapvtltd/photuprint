import React, { useState, useEffect, useMemo, useCallback, useRef } from "react"
import api from "../api/axios"
import {
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

const getBaseUploadUrl = () => {
  const hostname = typeof window !== "undefined" ? window.location.hostname : "localhost"
  return ``
}

const normalizeImageUrl = (url) => {
  if (!url) return null
  if (url.startsWith("http://") || url.startsWith("https://")) return url
  if (url.startsWith("/uploads/")) return `${getBaseUploadUrl()}${url}`
  return `${getBaseUploadUrl()}/uploads/${url}`
}

export default function ElementManager() {
  const [elements, setElements] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [editingId, setEditingId] = useState(null)
  const [viewMode, setViewMode] = useState("card")
  const [statusFilter, setStatusFilter] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(10)
  const [displayedCards, setDisplayedCards] = useState([])
  const [hasMoreCards, setHasMoreCards] = useState(false)
  const [deletePopup, setDeletePopup] = useState({ isVisible: false, elementId: null, message: "" })

  const formRef = useRef(null)
  const initialFormData = { name: "", type: "image", description: "", image: null, isActive: true }
  const [formData, setFormData] = useState(initialFormData)

  const fetchElements = async () => {
    try {
      setLoading(true)
      setError("")
      const res = await api.get("/elements?includeDeleted=false")
      const list = (res.data || []).map((el) => ({
        ...el,
        image: normalizeImageUrl(el.image) || el.image,
      }))
      setElements(list)
    } catch (e) {
      setError(e.response?.data?.msg || "Failed to load elements")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchElements()
  }, [])

  const filteredElements = useMemo(() => {
    let list = filterEntitiesByStatus(elements, statusFilter)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      list = list.filter(
        (el) =>
          (el.name && el.name.toLowerCase().includes(q)) ||
          (el.description && el.description.toLowerCase().includes(q))
      )
    }
    return list
  }, [elements, statusFilter, searchQuery])

  const totalPages = Math.ceil(filteredElements.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const currentElements = filteredElements.slice(startIndex, startIndex + itemsPerPage)

  useEffect(() => {
    if (viewMode === "card" && filteredElements.length > 0) {
      setDisplayedCards(filteredElements.slice(0, 16))
      setHasMoreCards(filteredElements.length > 16)
      setCurrentPage(1)
    }
  }, [filteredElements, viewMode])

  useEffect(() => {
    setCurrentPage(1)
    if (viewMode === "card") {
      setDisplayedCards(filteredElements.slice(0, 16))
      setHasMoreCards(filteredElements.length > 16)
    }
  }, [searchQuery, viewMode, filteredElements])

  const handlePageChange = (page) => {
    setCurrentPage(page)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const handleLoadMoreCards = () => {
    setDisplayedCards((prev) => {
      const next = filteredElements.slice(prev.length, prev.length + 16)
      setHasMoreCards(prev.length + next.length < filteredElements.length)
      return next.length ? [...prev, ...next] : prev
    })
  }

  const handleViewModeChange = (mode) => {
    setViewMode(mode)
    setCurrentPage(1)
    if (mode === "card") {
      setDisplayedCards(filteredElements.slice(0, 16))
      setHasMoreCards(filteredElements.length > 16)
    }
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }))
  }

  const handleEdit = (el) => {
    setEditingId(el._id)
    setFormData({
      name: el.name || "",
      type: el.type || "image",
      description: el.description || "",
      image: null,
      isActive: el.isActive !== false,
    })
    setError("")
    setSuccess("")
    setTimeout(() => {
      if (formRef.current) {
        formRef.current.scrollIntoView({ behavior: "smooth", block: "start" })
      }
    }, 100)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.name?.trim()) {
      setError("Element name is required")
      return
    }
    try {
      setLoading(true)
      setError("")
      setSuccess("")
      const data = new FormData()
      data.append("name", formData.name.trim())
      data.append("type", formData.type)
      data.append("description", formData.description || "")
      data.append("isActive", formData.isActive ? "true" : "false")
      if (formData.image && formData.image instanceof File) data.append("image", formData.image)
      if (editingId) {
        await api.put(`/elements/${editingId}`, data)
        setSuccess("Element updated successfully")
      } else {
        await api.post("/elements", data)
        setSuccess("Element created successfully")
      }
      await fetchElements()
      setFormData(initialFormData)
      setEditingId(null)
    } catch (err) {
      setError(err.response?.data?.msg || "Failed to save element")
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    setFormData(initialFormData)
    setEditingId(null)
    setError("")
  }

  const handleDelete = (id) => {
    setDeletePopup({ isVisible: true, elementId: id, message: "Delete this element?" })
  }

  const handleDeleteConfirm = async () => {
    const { elementId } = deletePopup
    if (!elementId) return
    try {
      setLoading(true)
      setError("")
      await api.delete(`/elements/${elementId}`)
      setSuccess("Element deleted")
      await fetchElements()
      setDeletePopup({ isVisible: false, elementId: null, message: "" })
    } catch (err) {
      setError(err.response?.data?.msg || "Failed to delete element")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="paddingAll20">
      <AlertMessage
        type="success"
        message={success}
        onClose={() => setSuccess("")}
        autoClose={true}
      />
      <AlertMessage
        type="error"
        message={error}
        onClose={() => setError("")}
        autoClose={true}
      />

      <div className="brandFormContainer paddingAll32 appendBottom30" ref={formRef}>
        <form onSubmit={handleSubmit} className="brandForm">
          <div className="makeFlex row gap10 appendBottom16">
            <div className="flexOne">
              <FormField
                type="text"
                name="name"
                label="Element Name *"
                value={formData.name}
                onChange={handleChange}
                placeholder="Enter element name"
                required
              />
            </div>
            <div className="flexOne">
              <FormField
                type="select"
                name="type"
                label="Type"
                value={formData.type}
                onChange={handleChange}
                options={[
                  { value: "text", label: "Text" },
                  { value: "image", label: "Image" },
                  { value: "shape", label: "Shape" },
                ]}
              />
            </div>
          </div>
          <div className="makeFlex row gap10 appendBottom16">
            <div className="fullWidth">
              <FormField
                type="textarea"
                name="description"
                label="Description (optional)"
                value={formData.description}
                onChange={handleChange}
                rows={2}
                placeholder="Enter description"
              />
            </div>
          </div>
          <div className="makeFlex row gap10 appendBottom16">
            <div className="fullWidth">
              <FormField
                type="file"
                name="image"
                label="Image (optional)"
                accept="image/*"
                onChange={(e) => setFormData((p) => ({ ...p, image: e.target.files?.[0] || null }))}
                info="Supported formats: JPG, PNG, GIF"
              />
            </div>
          </div>
          <div className="makeFlex row gap10 appendBottom16">
            <div className="makeFlex column flexOne appendBottom16">
              <label className="formLabel appendBottom10">Status:</label>
              <label className="formLabel appendBottom8 makeFlex gap10">
                <FormField
                  type="checkbox"
                  name="isActive"
                  value={formData.isActive}
                  onChange={handleChange}
                />
                Active
              </label>
              <p className="negativeMarginTop10">Check this box to keep the element active, uncheck to mark as inactive</p>
            </div>
          </div>
          <div className="formActions paddingTop16 makeFlex gap10">
            <button type="submit" className="btnPrimary" disabled={loading}>
              {loading ? (
                <span className="loadingSpinner">⏳</span>
              ) : (
                <span>{editingId ? "Update Element" : "Create Element"}</span>
              )}
            </button>
            {editingId && (
              <button type="button" onClick={handleCancel} className="btnSecondary">
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="brandsListContainer paddingAll32">
        <div className="listHeader makeFlex spaceBetween end appendBottom24">
          <div className="leftSection">
            <h2 className="listTitle font30 fontBold blackText appendBottom16">
              Elements ({filteredElements.length})
            </h2>
            <StatusFilter
              statusFilter={statusFilter}
              onStatusChange={setStatusFilter}
              counts={calculateStandardStatusCounts(elements)}
              disabled={loading}
            />
          </div>
          <div className="rightSection makeFlex end gap10">
            <SearchField
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search elements..."
              disabled={loading}
              minWidth="250px"
            />
            {loading && <span className="loadingIndicator grayText">Loading...</span>}
            <ViewToggle viewMode={viewMode} onViewChange={handleViewModeChange} disabled={loading} />
          </div>
        </div>

        {filteredElements.length === 0 && !loading ? (
          <div className="emptyState textCenter paddingAll60">
            <div className="emptyIcon appendBottom16">🧩</div>
            <h3 className="font22 fontSemiBold grayText appendBottom8">No Elements Found</h3>
            <p className="font16 grayText appendBottom16">Start by adding your first element above</p>
            <p className="font14 grayText">Reusable elements (text, image, shape) can be used in PixelCraft templates.</p>
          </div>
        ) : (
          <>
            {viewMode === "card" && (
              <div className="brandsGrid">
                {displayedCards.map((el) => (
                  <EntityCard
                    key={el._id}
                    entity={el}
                    imageField="image"
                    nameField="name"
                    idField="_id"
                    onEdit={() => handleEdit(el)}
                    onDelete={() => handleDelete(el._id)}
                    loading={loading}
                    imagePlaceholderColor={generateBrandColor(el._id, el.name)}
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
                          <span className="detailLabel font14 fontSemiBold grayText textUppercase">Type</span>
                          <span className="detailValue font14 blackText appendLeft6">{entity.type}</span>
                        </div>
                        <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                          <span className="detailLabel font14 fontSemiBold grayText textUppercase">Status</span>
                          <span className={`detailValue font14 ${entity.isActive ? "greenText" : "grayText"} appendLeft6`}>
                            {entity.isActive ? "Active" : "Inactive"}
                          </span>
                        </div>
                      </>
                    )}
                    renderActions={(entity) => (
                      <ActionButtons
                        onEdit={() => handleEdit(entity)}
                        onDelete={() => handleDelete(entity._id)}
                        loading={loading}
                        editText="✏️ Edit"
                        deleteText="🗑️ Delete"
                      />
                    )}
                    className="brandCard"
                  />
                ))}
                {hasMoreCards && (
                  <div className="loadMoreContainer textCenter paddingAll20">
                    <button type="button" onClick={handleLoadMoreCards} className="btnPrimary" disabled={loading}>
                      {loading ? (
                        <span className="loadingSpinner">⏳</span>
                      ) : (
                        <span>Load More</span>
                      )}
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
                        <th className="tableHeader">Type</th>
                        <th className="tableHeader">Status</th>
                        <th className="tableHeader">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentElements.map((el) => (
                        <tr key={el._id} className="tableRow">
                          <td className="tableCell width5">
                            <div className="tableLogo">
                              {el.image ? (
                                <img src={el.image} alt={el.name} className="tableLogoImage" />
                              ) : (
                                <div
                                  className="tableLogoPlaceholder"
                                  style={{ backgroundColor: generateBrandColor(el._id, el.name) }}
                                >
                                  {el.name ? el.name.charAt(0).toUpperCase() : "?"}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="tableCell width15 font14 blackText">{el.name}</td>
                          <td className="tableCell width10 font14 blackText">{el.type}</td>
                          <td className="tableCell width10 font14 blackText">
                            <span className={el.isActive ? "statusText active" : "statusText inactive"}>
                              {el.isActive ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td className="tableCell width15">
                            <div className="tableActions makeFlex gap8">
                              <ActionButtons
                                onEdit={() => handleEdit(el)}
                                onDelete={() => handleDelete(el._id)}
                                loading={loading}
                                size="small"
                                editText="✏️"
                                deleteText="🗑️ Delete"
                                editTitle="Edit Element"
                                deleteTitle="Delete element"
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
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeletePopup({ isVisible: false, elementId: null, message: "" })}
        title="Delete element"
      />
    </div>
  )
}
