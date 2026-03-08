import React, { useState, useEffect, useCallback, useMemo } from "react"
import api from "../api/axios"
import {
  AlertMessage,
  FormField,
  ActionButtons,
  DeleteConfirmationPopup,
  ViewToggle,
  Pagination,
  EntityCard,
  EntityCardHeader,
  SearchField,
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

const ORIENTATION_OPTIONS = [
  { value: "any", label: "Any" },
  { value: "portrait", label: "Portrait" },
  { value: "landscape", label: "Landscape" },
  { value: "square", label: "Square" },
]

const ANIMATION_OPTIONS = [
  { value: "none", label: "None" },
  { value: "fade", label: "Fade" },
  { value: "slide", label: "Slide" },
  { value: "zoom", label: "Zoom" },
  { value: "spin", label: "Spin" },
  { value: "bounce", label: "Bounce" },
]

const ACCEPT_FILES = "image/*,.svg,.png,.jpg,.jpeg,.gif,.webp"

export default function ElementImageManager() {
  const [elements, setElements] = useState([])
  const [selectedElementId, setSelectedElementId] = useState("all")
  const [assets, setAssets] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [editingAssetId, setEditingAssetId] = useState(null)
  const [deletePopup, setDeletePopup] = useState({ isVisible: false, assetId: null, message: "" })
  const [viewMode, setViewMode] = useState("card")
  const [searchQuery, setSearchQuery] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(10)
  const [displayedCards, setDisplayedCards] = useState([])
  const [hasMoreCards, setHasMoreCards] = useState(false)

  const [formData, setFormData] = useState({
    elementId: "",
    image: null,
    color: "",
    orientation: "any",
    animation: "none",
    label: "",
    isActive: true,
  })

  const fetchElements = useCallback(async () => {
    try {
      const res = await api.get("/elements?includeDeleted=false")
      setElements(res.data || [])
    } catch (e) {
      setError(e.response?.data?.msg || "Failed to load elements")
    }
  }, [])

  const fetchAssets = useCallback(async (elementId) => {
    if (!elementId) {
      setAssets([])
      return
    }
    try {
      setLoading(true)
      setError("")
      const res = await api.get(`/element-assets?elementId=${elementId}`)
      const list = (res.data || []).map((a) => ({
        ...a,
        image: normalizeImageUrl(a.image) || a.image,
        elementName: (a.element && typeof a.element === "object" ? a.element.name : null) || "",
      }))
      setAssets(list)
    } catch (e) {
      setError(e.response?.data?.msg || "Failed to load images")
      setAssets([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchElements()
  }, [fetchElements])

  useEffect(() => {
    if (!elements.length) return
    setSelectedElementId((prev) => {
      if (prev && prev !== "all") return prev
      return "all"
    })
  }, [elements])

  useEffect(() => {
    if (selectedElementId) {
      fetchAssets(selectedElementId)
      setFormData((f) => ({ ...f, elementId: selectedElementId === "all" ? "" : selectedElementId }))
    } else {
      setAssets([])
    }
  }, [selectedElementId, fetchAssets])

  const filteredAssets = useMemo(() => {
    if (!searchQuery.trim()) return assets
    const q = searchQuery.toLowerCase().trim()
    return assets.filter(
      (a) =>
        (a.label && a.label.toLowerCase().includes(q)) ||
        (a.color && a.color.toLowerCase().includes(q)) ||
        (a.orientation && a.orientation.toLowerCase().includes(q)) ||
        (a.animation && a.animation.toLowerCase().includes(q))
    )
  }, [assets, searchQuery])

  const totalPages = Math.ceil(filteredAssets.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const currentAssets = filteredAssets.slice(startIndex, startIndex + itemsPerPage)

  useEffect(() => {
    if (viewMode === "card" && filteredAssets.length > 0) {
      setDisplayedCards(filteredAssets.slice(0, 16))
      setHasMoreCards(filteredAssets.length > 16)
    }
  }, [filteredAssets, viewMode])

  useEffect(() => {
    setCurrentPage(1)
    if (viewMode === "card") {
      setDisplayedCards(filteredAssets.slice(0, 16))
      setHasMoreCards(filteredAssets.length > 16)
    }
  }, [searchQuery])

  const handlePageChange = (page) => {
    setCurrentPage(page)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const handleLoadMoreCards = () => {
    setDisplayedCards((prev) => {
      const next = filteredAssets.slice(prev.length, prev.length + 16)
      setHasMoreCards(prev.length + next.length < filteredAssets.length)
      return next.length ? [...prev, ...next] : prev
    })
  }

  const handleViewModeChange = (mode) => {
    setViewMode(mode)
    setCurrentPage(1)
    if (mode === "card") {
      setDisplayedCards(filteredAssets.slice(0, 16))
      setHasMoreCards(filteredAssets.length > 16)
    }
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }))
  }

  const handleFileChange = (e) => {
    setFormData((prev) => ({ ...prev, image: e.target.files?.[0] || null }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const elementId = formData.elementId || selectedElementId
    if (!elementId || elementId === "all") {
      setError("Please select a specific element")
      return
    }
    if (!editingAssetId && !formData.image) {
      setError("Please select an image file to upload")
      return
    }
    try {
      setLoading(true)
      setError("")
      setSuccess("")
      const data = new FormData()
      data.append("elementId", elementId)
      data.append("color", formData.color)
      data.append("orientation", formData.orientation)
      data.append("animation", formData.animation)
      data.append("label", formData.label)
      data.append("isActive", formData.isActive ? "true" : "false")
      if (formData.image && formData.image instanceof File) {
        data.append("image", formData.image)
      }
      if (editingAssetId) {
        await api.put(`/element-assets/${editingAssetId}`, data)
        setSuccess("Image updated")
      } else {
        await api.post("/element-assets", data)
        setSuccess("Image uploaded")
      }
      setFormData({
        elementId: selectedElementId === "all" ? "" : selectedElementId,
        image: null,
        color: "",
        orientation: "any",
        animation: "none",
        label: "",
        isActive: true,
      })
      setEditingAssetId(null)
      await fetchAssets(selectedElementId)
    } catch (err) {
      setError(err.response?.data?.msg || "Failed to save")
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (asset) => {
    setEditingAssetId(asset._id)
    setFormData({
      elementId: selectedElementId,
      image: null,
      color: asset.color || "",
      orientation: asset.orientation || "any",
      animation: asset.animation || "none",
      label: asset.label || "",
      isActive: asset.isActive !== false,
    })
    setError("")
    setSuccess("")
  }

  const handleCancelEdit = () => {
    setEditingAssetId(null)
    setFormData({
      elementId: selectedElementId,
      image: null,
      color: "",
      orientation: "any",
      animation: "none",
      label: "",
      isActive: true,
    })
  }

  const handleDelete = (assetId) => {
    setDeletePopup({ isVisible: true, assetId, message: "Delete this image from the element?" })
  }

  const handleDeleteConfirm = async () => {
    const { assetId } = deletePopup
    if (!assetId) return
    try {
      setLoading(true)
      setError("")
      await api.delete(`/element-assets/${assetId}`)
      setSuccess("Image removed")
      setDeletePopup({ isVisible: false, assetId: null, message: "" })
      await fetchAssets(selectedElementId)
    } catch (err) {
      setError(err.response?.data?.msg || "Failed to delete")
    } finally {
      setLoading(false)
    }
  }

  const selectedElement = elements.find((el) => String(el._id) === String(selectedElementId))

  return (
    <div className="paddingAll20" style={{ width: "100%" }}>
      <AlertMessage type="success" message={success} onClose={() => setSuccess("")} autoClose />
      <AlertMessage type="error" message={error} onClose={() => setError("")} autoClose />

      <div className="brandFormContainer paddingAll32 appendBottom30" style={{ width: "100%" }}>
        <form onSubmit={handleSubmit} className="brandForm">
          <div className="makeFlex row gap10 appendBottom16">
            <div className="fullWidth">
              <FormField
                type="select"
                name="elementId"
                label="Element (select specific element to add image)"
                value={selectedElementId}
                onChange={(e) => {
                  const val = e.target.value
                  setSelectedElementId(val)
                  setFormData((f) => ({ ...f, elementId: val === "all" ? "" : val }))
                }}
                options={[{ value: "all", label: "All elements" }, ...elements.map((el) => ({ value: el._id, label: el.name }))]}
              />
            </div>
          </div>
          <div className="makeFlex row gap10 appendBottom16">
            <div className="fullWidth">
              <FormField
                type="file"
                name="image"
                label={editingAssetId ? "New image (optional – leave empty to keep current)" : "Image (required)"}
                accept={ACCEPT_FILES}
                onChange={handleFileChange}
              />
            </div>
          </div>
          <div className="makeFlex row gap10 appendBottom16">
            <div className="flexOne">
              <FormField
                type="text"
                name="color"
                label="Color"
                value={formData.color}
                onChange={handleChange}
                placeholder="e.g. #ff0000 or red"
              />
            </div>
            <div className="flexOne">
              <FormField
                type="select"
                name="orientation"
                label="Orientation"
                value={formData.orientation}
                onChange={handleChange}
                options={ORIENTATION_OPTIONS}
              />
            </div>
          </div>
          <div className="makeFlex row gap10 appendBottom16">
            <div className="flexOne">
              <FormField
                type="select"
                name="animation"
                label="Animation"
                value={formData.animation}
                onChange={handleChange}
                options={ANIMATION_OPTIONS}
              />
            </div>
            <div className="flexOne">
              <FormField
                type="text"
                name="label"
                label="Label (optional)"
                value={formData.label}
                onChange={handleChange}
                placeholder="Short label for this variant"
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
              <p className="negativeMarginTop10">Check this box to keep the image active, uncheck to mark as inactive.</p>
            </div>
          </div>
          <div className="formActions paddingTop16 makeFlex gap10">
            <button type="submit" className="btnPrimary" disabled={loading}>
              {loading ? <span className="loadingSpinner">⏳</span> : <span>{editingAssetId ? "Update" : "Upload"}</span>}
            </button>
            {editingAssetId && (
              <button type="button" onClick={handleCancelEdit} className="btnSecondary">
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="brandsListContainer paddingAll32" style={{ width: "100%" }}>
        <div className="listHeader makeFlex spaceBetween end appendBottom24">
          <div className="leftSection">
            <h2 className="listTitle font30 fontBold blackText appendBottom16">
              {selectedElementId === "all"
                ? `All element images (${filteredAssets.length})`
                : selectedElementId
                  ? `Images for: ${selectedElement?.name || "Element"} (${filteredAssets.length})`
                  : "Element Images"}
            </h2>
          </div>
          <div className="rightSection makeFlex end gap10 alignCenter">
            <select
              className="formSelect"
              value={selectedElementId}
              onChange={(e) => {
                const id = e.target.value
                setSelectedElementId(id)
                setFormData((f) => ({ ...f, elementId: id === "all" ? "" : id }))
              }}
              disabled={loading}
              style={{ minWidth: 200 }}
              title="Filter by element"
            >
                <option value="all">All elements</option>
                {elements.map((el) => (
                  <option key={el._id} value={el._id}>
                    {el.name}
                  </option>
                ))}
            </select>
            <SearchField
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by label, color, orientation..."
              disabled={loading}
              minWidth="250px"
            />
            {loading && <span className="loadingIndicator grayText">Loading...</span>}
            <ViewToggle
              viewMode={viewMode}
              onViewChange={handleViewModeChange}
              disabled={loading}
            />
          </div>
        </div>

        {!selectedElementId ? (
          <div className="emptyState textCenter paddingAll60">
            <div className="emptyIcon appendBottom16">🖼️</div>
            <h3 className="font22 fontSemiBold grayText appendBottom8">Select an element</h3>
            <p className="font16 grayText appendBottom16">Choose an element above to view and manage its images in card or list view.</p>
          </div>
        ) : loading && !assets.length ? (
          <p className="grayText">Loading...</p>
        ) : filteredAssets.length === 0 ? (
          <div className="emptyState textCenter paddingAll60">
            <div className="emptyIcon appendBottom16">🖼️</div>
            <h3 className="font22 fontSemiBold grayText appendBottom8">No Images Found</h3>
            <p className="font16 grayText appendBottom16">Upload an image above for this element.</p>
          </div>
        ) : (
            <>
              {viewMode === "card" && (
                <div className="brandsGrid">
                  {displayedCards.map((asset) => (
                    <EntityCard
                      key={asset._id}
                      entity={asset}
                      imageField="image"
                      nameField="label"
                      idField="_id"
                      titleField="label"
                      onEdit={() => handleEdit(asset)}
                      onDelete={() => handleDelete(asset._id)}
                      loading={loading}
                      imagePlaceholderColor={generateBrandColor(asset._id, asset.label || "Asset")}
                      renderHeader={(entity) => (
                        <EntityCardHeader
                          entity={{ ...entity, label: entity.label || "Image" }}
                          imageField="image"
                          titleField="label"
                          dateField="createdAt"
                          generateColor={generateBrandColor}
                        />
                      )}
                      renderDetails={(entity) => (
                        <>
                          {selectedElementId === "all" && entity.elementName && (
                            <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                              <span className="detailLabel font14 fontSemiBold grayText textUppercase">Element</span>
                              <span className="detailValue font14 blackText appendLeft6">{entity.elementName}</span>
                            </div>
                          )}
                          <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                            <span className="detailLabel font14 fontSemiBold grayText textUppercase">Color</span>
                            <span className="detailValue font14 blackText appendLeft6">{entity.color || "—"}</span>
                          </div>
                          <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                            <span className="detailLabel font14 fontSemiBold grayText textUppercase">Orientation</span>
                            <span className="detailValue font14 blackText appendLeft6">{entity.orientation || "—"}</span>
                          </div>
                          <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                            <span className="detailLabel font14 fontSemiBold grayText textUppercase">Animation</span>
                            <span className="detailValue font14 blackText appendLeft6">{entity.animation || "—"}</span>
                          </div>
                          <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                            <span className="detailLabel font14 fontSemiBold grayText textUppercase">Status</span>
                            <span className={`detailValue font14 ${entity.isActive !== false ? "greenText" : "grayText"} appendLeft6`}>
                              {entity.isActive !== false ? "Active" : "Inactive"}
                            </span>
                          </div>
                        </>
                      )}
                      renderActions={(entity) => (
                        <ActionButtons
                          onEdit={() => handleEdit(entity)}
                          onDelete={() => handleDelete(entity._id)}
                          loading={loading}
                          size="normal"
                          editText="✏️ Edit"
                          deleteText="🗑️ Delete"
                          editTitle="Edit image"
                          deleteTitle="Delete this image"
                        />
                      )}
                      className="brandCard"
                    />
                  ))}
                  {hasMoreCards && (
                    <div className="loadMoreContainer textCenter paddingAll20">
                      <button
                        type="button"
                        onClick={handleLoadMoreCards}
                        className="btnPrimary"
                        disabled={loading}
                      >
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
                          <th className="tableHeader">Image</th>
                          {selectedElementId === "all" && <th className="tableHeader">Element</th>}
                          <th className="tableHeader">Label</th>
                          <th className="tableHeader">Color</th>
                          <th className="tableHeader">Orientation</th>
                          <th className="tableHeader">Animation</th>
                          <th className="tableHeader">Status</th>
                          <th className="tableHeader">Created</th>
                          <th className="tableHeader">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentAssets.map((asset) => (
                          <tr key={asset._id} className="tableRow">
                            <td className="tableCell width5">
                              <div className="tableLogo">
                                {asset.image ? (
                                  <img src={asset.image} alt={asset.label || "Asset"} className="tableLogoImage" />
                                ) : (
                                  <div
                                    className="tableLogoPlaceholder"
                                    style={{ backgroundColor: generateBrandColor(asset._id, asset.label || "A") }}
                                  >
                                    {(asset.label || "?").charAt(0).toUpperCase()}
                                  </div>
                                )}
                              </div>
                            </td>
                            {selectedElementId === "all" && (
                              <td className="tableCell width15 font14 blackText">{asset.elementName || "—"}</td>
                            )}
                            <td className="tableCell width15 font14 blackText">{asset.label || "—"}</td>
                            <td className="tableCell width10 font14 blackText">{asset.color || "—"}</td>
                            <td className="tableCell width10 font14 blackText">{asset.orientation || "—"}</td>
                            <td className="tableCell width10 font14 blackText">{asset.animation || "—"}</td>
                            <td className="tableCell width10 font14 blackText">
                              <span className={asset.isActive !== false ? "statusText active" : "statusText inactive"}>
                                {asset.isActive !== false ? "Active" : "Inactive"}
                              </span>
                            </td>
                            <td className="tableCell width15 font14 grayText">
                              {asset.createdAt ? new Date(asset.createdAt).toLocaleDateString() : "—"}
                            </td>
                            <td className="tableCell width15">
                              <ActionButtons
                                onEdit={() => handleEdit(asset)}
                                onDelete={() => handleDelete(asset._id)}
                                loading={loading}
                                editText="✏️ Edit"
                                deleteText="🗑️ Delete"
                              />
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
        onCancel={() => setDeletePopup({ isVisible: false, assetId: null, message: "" })}
        title="Delete image"
      />
    </div>
  )
}
