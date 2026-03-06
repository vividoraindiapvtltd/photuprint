import React, { useState, useEffect, useMemo, useCallback } from "react"
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

const SHAPE_OPTIONS = [
  { value: "rectangle", label: "Rectangle" },
  { value: "oval", label: "Oval" },
  { value: "square", label: "Square" },
  { value: "custom", label: "Custom" },
]

// Unit dropdown: same options as Width/Height Manager (long-form values)
const UNIT_OPTIONS = [
  { value: "millimeters", label: "Millimeters (mm)" },
  { value: "centimeters", label: "Centimeters (cm)" },
  { value: "inches", label: "Inches (in)" },
  { value: "feet", label: "Feet (ft)" },
  { value: "meters", label: "Meters (m)" },
]
// Map long form (dropdown) → short form (API)
const UNIT_LONG_TO_SHORT = {
  millimeters: "mm",
  centimeters: "cm",
  inches: "inch",
  feet: "ft",
  meters: "m",
}
// Map short form (API) → long form (dropdown)
const UNIT_SHORT_TO_LONG = {
  mm: "millimeters",
  cm: "centimeters",
  inch: "inches",
  ft: "feet",
  m: "meters",
}

function getUnitAbbreviation(unit) {
  const map = { millimeters: "mm", centimeters: "cm", inches: "in", feet: "ft", meters: "m" }
  return map[unit] || "cm"
}

export default function TemplateDimensionManager() {
  const [dimensions, setDimensions] = useState([])
  const [widths, setWidths] = useState([])
  const [heights, setHeights] = useState([])
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
  const [deletePopup, setDeletePopup] = useState({ isVisible: false, dimensionId: null, message: "" })

  const initialFormData = {
    name: "",
    slug: "",
    description: "",
    width: "",
    height: "",
    widthId: "",
    heightId: "",
    unit: "millimeters",
    dpi: 300,
    bleed: 0,
    safeAreaInset: 0,
    shape: "rectangle",
    isActive: true,
  }
  const [formData, setFormData] = useState(initialFormData)

  const fetchWidthsHeights = useCallback(async () => {
    try {
      const [wRes, hRes] = await Promise.all([
        api.get("/widths?includeDeleted=false"),
        api.get("/heights?includeDeleted=false"),
      ])
      setWidths(wRes.data || [])
      setHeights(hRes.data || [])
    } catch (e) {
      console.error("Failed to load widths/heights:", e)
    }
  }, [])

  useEffect(() => {
    fetchWidthsHeights()
  }, [fetchWidthsHeights])

  const widthOptions = useMemo(() => {
    const list = (widths || []).filter((w) => w && !w.deleted)
    return [
      { value: "", label: "Select from Width Manager" },
      ...list.map((w) => ({
        value: w._id,
        label: `${w.name} ${getUnitAbbreviation(w.unit || "centimeters")}`,
      })),
    ]
  }, [widths])

  const heightOptions = useMemo(() => {
    const list = (heights || []).filter((h) => h && !h.deleted)
    return [
      { value: "", label: "Select from Height Manager" },
      ...list.map((h) => ({
        value: h._id,
        label: `${h.name} ${getUnitAbbreviation(h.unit || "centimeters")}`,
      })),
    ]
  }, [heights])

  const selectedWidthId = formData.widthId || (() => {
    const w = Number(formData.width)
    const u = formData.unit
    const found = (widths || []).find(
      (x) => !x.deleted && Number(x.name) === w && (x.unit === u || UNIT_LONG_TO_SHORT[x.unit] === u)
    )
    return found ? found._id : ""
  })()

  const selectedHeightId = formData.heightId || (() => {
    const h = Number(formData.height)
    const found = (heights || []).find((x) => !x.deleted && Number(x.name) === h)
    return found ? found._id : ""
  })()

  const fetchDimensions = useCallback(async () => {
    try {
      setLoading(true)
      setError("")
      const res = await api.get("/template-dimensions?includeDeleted=false")
      setDimensions(res.data || [])
    } catch (e) {
      setError(e.response?.data?.msg || "Failed to load dimensions")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDimensions()
  }, [fetchDimensions])

  const filteredDimensions = useMemo(() => {
    let list = filterEntitiesByStatus(dimensions, statusFilter)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      list = list.filter(
        (d) =>
          (d.name && d.name.toLowerCase().includes(q)) ||
          (d.slug && d.slug.toLowerCase().includes(q)) ||
          (d.description && d.description.toLowerCase().includes(q))
      )
    }
    return list
  }, [dimensions, statusFilter, searchQuery])

  const totalPages = Math.ceil(filteredDimensions.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const currentDimensions = filteredDimensions.slice(startIndex, startIndex + itemsPerPage)

  useEffect(() => {
    if (viewMode === "card" && filteredDimensions.length > 0) {
      setDisplayedCards(filteredDimensions.slice(0, 16))
      setHasMoreCards(filteredDimensions.length > 16)
    }
  }, [filteredDimensions, viewMode])

  useEffect(() => {
    setCurrentPage(1)
    if (viewMode === "card") {
      setDisplayedCards(filteredDimensions.slice(0, 16))
      setHasMoreCards(filteredDimensions.length > 16)
    }
  }, [searchQuery, statusFilter])

  const handlePageChange = (page) => {
    setCurrentPage(page)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const handleLoadMoreCards = () => {
    setDisplayedCards((prev) => {
      const next = filteredDimensions.slice(prev.length, prev.length + 16)
      setHasMoreCards(prev.length + next.length < filteredDimensions.length)
      return next.length ? [...prev, ...next] : prev
    })
  }

  const handleViewModeChange = (mode) => {
    setViewMode(mode)
    setCurrentPage(1)
    if (mode === "card") {
      setDisplayedCards(filteredDimensions.slice(0, 16))
      setHasMoreCards(filteredDimensions.length > 16)
    }
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }))
  }

  const handleEdit = (d) => {
    setEditingId(d._id)
    setFormData({
      name: d.name || "",
      slug: d.slug || "",
      description: d.description || "",
      width: String(d.width ?? ""),
      height: String(d.height ?? ""),
      widthId: "",
      heightId: "",
      unit: UNIT_SHORT_TO_LONG[d.unit] || d.unit || "millimeters",
      dpi: d.dpi ?? 300,
      bleed: d.bleed ?? 0,
      safeAreaInset: d.safeAreaInset ?? 0,
      shape: d.shape || "rectangle",
      isActive: d.isActive !== false,
    })
    setError("")
    setSuccess("")
  }

  const handleWidthFromManager = (e) => {
    const id = e.target.value
    if (!id) {
      setFormData((prev) => ({ ...prev, widthId: "" }))
      return
    }
    const w = widths.find((x) => x._id === id)
    if (w) {
      setFormData((prev) => ({
        ...prev,
        widthId: id,
        width: String(Number(w.name) || ""),
        unit: w.unit || "millimeters",
      }))
    }
  }

  const handleHeightFromManager = (e) => {
    const id = e.target.value
    if (!id) {
      setFormData((prev) => ({ ...prev, heightId: "" }))
      return
    }
    const h = heights.find((x) => x._id === id)
    if (h) {
      setFormData((prev) => ({
        ...prev,
        heightId: id,
        height: String(Number(h.name) || ""),
      }))
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.name?.trim()) {
      setError("Name is required")
      return
    }
    const width = Number(formData.width)
    const height = Number(formData.height)
    if (Number.isNaN(width) || width <= 0 || Number.isNaN(height) || height <= 0) {
      setError("Please select Width and Height from the dropdowns (Width Manager and Height Manager)")
      return
    }
    try {
      setLoading(true)
      setError("")
      setSuccess("")
      const payload = {
        name: formData.name.trim(),
        slug: (formData.slug || "").trim(),
        description: (formData.description || "").trim(),
        width,
        height,
        unit: UNIT_LONG_TO_SHORT[formData.unit] || formData.unit,
        dpi: Number(formData.dpi) || 300,
        bleed: Number(formData.bleed) || 0,
        safeAreaInset: Number(formData.safeAreaInset) || 0,
        shape: formData.shape,
        isActive: formData.isActive,
      }
      if (editingId) {
        await api.put(`/template-dimensions/${editingId}`, payload)
        setSuccess("Dimension updated")
      } else {
        await api.post("/template-dimensions", payload)
        setSuccess("Dimension created")
      }
      await fetchDimensions()
      setFormData(initialFormData)
      setEditingId(null)
    } catch (err) {
      setError(err.response?.data?.msg || "Failed to save")
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
    setDeletePopup({ isVisible: true, dimensionId: id, message: "Delete this print area dimension?" })
  }

  const handleDeleteConfirm = async () => {
    const { dimensionId } = deletePopup
    if (!dimensionId) return
    try {
      setLoading(true)
      setError("")
      await api.delete(`/template-dimensions/${dimensionId}`)
      setSuccess("Dimension deleted")
      setDeletePopup({ isVisible: false, dimensionId: null, message: "" })
      await fetchDimensions()
    } catch (err) {
      setError(err.response?.data?.msg || "Failed to delete")
    } finally {
      setLoading(false)
    }
  }

  const sectionStyle = {
    fontSize: "18px",
    fontWeight: "600",
    marginBottom: "20px",
    color: "#444444",
    borderBottom: "2px solid #444444",
    paddingBottom: "12px",
    paddingTop: "8px",
  }
  const gridStyle = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }

  return (
    <div style={{ padding: 16 }}>
      {error && <AlertMessage type="error" message={error} />}
      {success && <AlertMessage type="success" message={success} />}

      <div className="brandFormContainer paddingAll32 appendBottom30">
        <form onSubmit={handleSubmit} className="brandForm">
          {/* Basic information */}
          <div style={{ marginBottom: "30px" }}>
            <h3 style={sectionStyle}>Basic information</h3>
            <FormField
              type="text"
              name="name"
              label="Name"
              value={formData.name}
              onChange={handleChange}
              placeholder="e.g. T-Shirt Front, Mug Wrap, Cap"
              required
            />
            <FormField
              type="text"
              name="slug"
              label="Slug (optional)"
              value={formData.slug}
              onChange={handleChange}
              placeholder="e.g. tshirt-front, mug-wrap"
            />
            <FormField
              type="textarea"
              name="description"
              label="Description (optional)"
              value={formData.description}
              onChange={handleChange}
              rows={2}
            />
          </div>

          {/* Dimensions – from Width Manager & Height Manager */}
          <div style={{ marginBottom: "30px" }}>
            <h3 style={sectionStyle}>Dimensions</h3>
            <div style={gridStyle}>
              <div>
                <FormField
                  type="select"
                  name="widthFromManager"
                  label="Width"
                  value={selectedWidthId}
                  onChange={handleWidthFromManager}
                  options={widthOptions}
                  required
                  info={`Select from Width Manager (${widths.filter((w) => w && !w.deleted).length} available)`}
                />
              </div>
              <div>
                <FormField
                  type="select"
                  name="heightFromManager"
                  label="Height"
                  value={selectedHeightId}
                  onChange={handleHeightFromManager}
                  options={heightOptions}
                  required
                  info={`Select from Height Manager (${heights.filter((h) => h && !h.deleted).length} available)`}
                />
              </div>
            </div>
            <div style={{ marginTop: "15px" }}>
              <FormField
                type="select"
                name="unit"
                label="Unit"
                value={formData.unit}
                onChange={handleChange}
                options={UNIT_OPTIONS}
                required
                info="Unit of measure for width and height (same options as Width/Height Manager)"
              />
            </div>
          </div>

          {/* Print settings */}
          <div style={{ marginBottom: "30px" }}>
            <h3 style={sectionStyle}>Print settings</h3>
            <div style={gridStyle}>
              <div>
                <FormField
                  type="number"
                  name="dpi"
                  label="DPI"
                  value={formData.dpi}
                  onChange={handleChange}
                  min={72}
                  max={600}
                />
              </div>
              <div>
                <FormField
                  type="select"
                  name="shape"
                  label="Shape"
                  value={formData.shape}
                  onChange={handleChange}
                  options={SHAPE_OPTIONS}
                />
              </div>
              <div>
                <FormField
                  type="number"
                  name="bleed"
                  label="Bleed"
                  value={formData.bleed}
                  onChange={handleChange}
                  min={0}
                  step={0.5}
                  info="Extra area beyond the trim edge that gets cut off during production. Use the same unit as dimensions (e.g. 3 mm or 0.125 in). Prevents white edges on final print."
                />
              </div>
              <div>
                <FormField
                  type="number"
                  name="safeAreaInset"
                  label="Safe area inset"
                  value={formData.safeAreaInset}
                  onChange={handleChange}
                  min={0}
                  step={0.5}
                  info="Margin from the trim edge where important text and graphics should stay. Content outside this area may be cut or hidden. Often same as bleed or slightly larger."
                />
              </div>
            </div>
          </div>

          {/* Status */}
          <div style={{ marginBottom: "30px" }}>
            <h3 style={sectionStyle}>Status</h3>
            <FormField
              type="checkbox"
              name="isActive"
              label="Active"
              checked={formData.isActive}
              onChange={handleChange}
            />
          </div>

          <div className="formActions paddingTop16">
            <button type="submit" className="btnPrimary" disabled={loading}>
              {editingId ? "Update dimension" : "Create dimension"}
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
              Print area dimensions ({filteredDimensions.length})
            </h2>
            <StatusFilter
              statusFilter={statusFilter}
              onStatusChange={setStatusFilter}
              counts={calculateStandardStatusCounts(dimensions)}
              disabled={loading}
            />
          </div>
          <div className="rightSection makeFlex end gap10">
            <SearchField
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search dimensions..."
              disabled={loading}
              minWidth="250px"
            />
            {loading && <span className="loadingIndicator grayText">Loading...</span>}
            <ViewToggle viewMode={viewMode} onViewChange={handleViewModeChange} disabled={loading} />
          </div>
        </div>

        {filteredDimensions.length === 0 && !loading ? (
          <div className="emptyState textCenter paddingAll60">
            <div className="emptyIcon appendBottom16">📐</div>
            <h3 className="font22 fontSemiBold grayText appendBottom8">No Dimensions Yet</h3>
            <p className="font16 grayText appendBottom16">Create print areas for T-Shirts, Mugs, Caps, etc. above.</p>
          </div>
        ) : (
          <>
            {viewMode === "card" && (
              <div className="brandsGrid">
                {displayedCards.map((d) => (
                  <EntityCard
                    key={d._id}
                    entity={d}
                    nameField="name"
                    idField="_id"
                    onEdit={() => handleEdit(d)}
                    onDelete={() => handleDelete(d._id)}
                    loading={loading}
                    imagePlaceholderColor={generateBrandColor(d._id, d.name)}
                    showImage={false}
                    renderHeader={(entity) => (
                      <EntityCardHeader
                        entity={{ ...entity, label: entity.name }}
                        titleField="name"
                        dateField="createdAt"
                        generateColor={generateBrandColor}
                      />
                    )}
                    renderDetails={(entity) => (
                      <>
                        <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                          <span className="detailLabel font14 fontSemiBold grayText textUppercase">Position/Slug</span>
                          <span className="detailValue font14 blackText appendLeft6">{entity.slug || "—"}</span>
                        </div>
                        <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                          <span className="detailLabel font14 fontSemiBold grayText textUppercase">Size</span>
                          <span className="detailValue font14 blackText appendLeft6">
                            {entity.width} × {entity.height} {entity.unit}
                          </span>
                        </div>
                        <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                          <span className="detailLabel font14 fontSemiBold grayText textUppercase">DPI</span>
                          <span className="detailValue font14 blackText appendLeft6">{entity.dpi}</span>
                        </div>
                        <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                          <span className="detailLabel font14 fontSemiBold grayText textUppercase">Shape</span>
                          <span className="detailValue font14 blackText appendLeft6">{entity.shape}</span>
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
                      Load More
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
                        <th className="tableHeader">Position/Slug</th>
                        <th className="tableHeader">Size</th>
                        <th className="tableHeader">Unit</th>
                        <th className="tableHeader">DPI</th>
                        <th className="tableHeader">Shape</th>
                        <th className="tableHeader">Status</th>
                        <th className="tableHeader">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentDimensions.map((d) => (
                        <tr key={d._id} className="tableRow">
                          <td className="tableCell width15 font14 blackText">{d.name}</td>
                          <td className="tableCell width10 font14 grayText">{d.slug || "—"}</td>
                          <td className="tableCell width10 font14 blackText">
                            {d.width} × {d.height}
                          </td>
                          <td className="tableCell width5 font14 blackText">{d.unit}</td>
                          <td className="tableCell width5 font14 blackText">{d.dpi}</td>
                          <td className="tableCell width8 font14 blackText">{d.shape}</td>
                          <td className="tableCell width8 font14 blackText">
                            <span className={d.isActive ? "statusText active" : "statusText inactive"}>
                              {d.isActive ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td className="tableCell width15">
                            <ActionButtons
                              onEdit={() => handleEdit(d)}
                              onDelete={() => handleDelete(d._id)}
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
        onCancel={() => setDeletePopup({ isVisible: false, dimensionId: null, message: "" })}
        title="Delete dimension"
      />
    </div>
  )
}
