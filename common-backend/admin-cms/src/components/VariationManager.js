import React, { useState, useEffect, useMemo, useCallback, useRef } from "react"
import api from "../api/axios"
import { useAuth } from "../context/AuthContext"
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
  generateEntityColor
} from "../common"
import SearchableSelect from "../common/SearchableSelect"

const VariationManager = () => {
  const { selectedWebsite } = useAuth()
  const [settings, setSettings] = useState([])
  const [categories, setCategories] = useState([])
  const [subcategories, setSubcategories] = useState([])
  const [loading, setLoading] = useState(false)
  const [categoriesLoading, setCategoriesLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [categoriesError, setCategoriesError] = useState("")
  const [editingId, setEditingId] = useState(null)
  const [viewMode, setViewMode] = useState('card')
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(10)
  const [hasMoreCards, setHasMoreCards] = useState(true)
  const [displayedCards, setDisplayedCards] = useState([])

  const formRef = useRef(null)

  // Delete confirmation popup state
  const [deletePopup, setDeletePopup] = useState({
    isVisible: false,
    settingId: null,
    message: "",
    isPermanentDelete: false,
    action: "delete"
  })

  const initialFormData = {
    category: "",
    subcategory: "",
    enabled: true,
    variationBasis: "size_and_color",
    displayBasis: "color_first"
  }

  const VARIATION_BASIS_OPTIONS = [
    { value: "size_and_color", label: "Size + Color (e.g. T-shirts, apparel)" },
    { value: "color_only", label: "Color only (e.g. mugs, posters)" },
    { value: "size_only", label: "Size only" },
  ]

  const DISPLAY_BASIS_OPTIONS = [
    { value: "color_first", label: "Color basis (group by color, then size)" },
    { value: "size_first", label: "Size basis (group by size, then color)" },
  ]

  const [formData, setFormData] = useState(initialFormData)

  // Fetch variation settings (X-Website-Id is sent by axios interceptor from localStorage)
  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true)
      setError("")
      const response = await api.get("/variation-settings")
      const data = response?.data
      setSettings(Array.isArray(data) ? data : [])
      setError("")
    } catch (err) {
      console.error("Error fetching variation settings:", err)
      if (err.code === "ERR_NETWORK" || err.message === "Network Error") {
        setError("❌ Cannot connect to server. Please ensure the backend server is running on port 8080.")
      } else {
        const msg = err.response?.data?.msg || err.message || "Failed to load variation settings"
        setError(msg)
      }
      setSettings([])
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch categories - only active, non-deleted (like CategoryManager shows). X-Website-Id sent by axios.
  const fetchCategories = async () => {
    try {
      setCategoriesLoading(true)
      console.log("Fetching categories for VariationManager...")
      const response = await api.get("/categories")
      console.log("Categories response:", response)
      console.log("Categories data:", response.data)
      
      // Handle different response structures
      let categoriesData = response.data
      if (!Array.isArray(categoriesData)) {
        console.warn("Categories response is not an array:", categoriesData)
        categoriesData = []
      }
      
      // Filter to only show active, non-deleted categories (like CategoryManager default view)
      // Handle cases where isActive or deleted might be undefined/null
      const activeCategories = categoriesData.filter(cat => {
        // Exclude deleted categories
        if (cat.deleted === true) return false
        // Include categories that are explicitly active (true) or undefined (defaults to active)
        // Exclude categories that are explicitly inactive (false)
        return cat.isActive !== false
      })
      
      console.log(`Found ${activeCategories.length} active categories out of ${categoriesData.length} total`)
      setCategories(activeCategories)
      
      if (activeCategories.length === 0 && categoriesData.length > 0) {
        console.warn("No active categories found. All categories may be inactive or deleted.")
        setCategoriesError("No active categories found. Please activate categories in Category Manager.")
      } else if (activeCategories.length === 0) {
        setCategoriesError("No categories found. Please create categories in Category Manager first.")
      } else {
        setCategoriesError("") // Clear error if categories loaded successfully
      }
    } catch (err) {
      console.error("Error fetching categories:", err)
      console.error("Error details:", err.response?.data, err.message)
      
      // Handle network errors specifically
      if (err.code === 'ERR_NETWORK' || err.message === 'Network Error') {
        setCategoriesError("❌ Cannot connect to server. Please ensure the backend server is running on port 8080.")
      } else {
        setCategoriesError("Failed to load categories. Please check the connection.")
      }
      setCategories([])
    } finally {
      setCategoriesLoading(false)
    }
  }

  // Fetch subcategories - will be filtered by selected category. X-Website-Id sent by axios.
  const fetchSubcategories = async () => {
    try {
      const response = await api.get("/subcategories?showInactive=true&includeDeleted=false")
      setSubcategories(response.data || [])
    } catch (err) {
      console.error("Error fetching subcategories:", err)
      // Don't set error here - categoriesError will handle it
      if (err.code === 'ERR_NETWORK' || err.message === 'Network Error') {
        setCategoriesError("❌ Cannot connect to server. Please ensure the backend server is running on port 8080.")
      }
    }
  }

  // Resolve website ID from context or localStorage (so fetch runs even if context lags)
  const websiteId = selectedWebsite?._id ?? (() => {
    try {
      const w = JSON.parse(localStorage.getItem("selectedWebsite"))
      return w?._id ?? null
    } catch {
      return null
    }
  })()

  useEffect(() => {
    if (websiteId) {
      fetchSettings()
      fetchCategories()
      fetchSubcategories()
    } else {
      setSettings([])
      setCategories([])
      setSubcategories([])
    }
  }, [websiteId, fetchSettings])

  // Status counts for variation settings (enabled = active, !enabled = inactive)
  const statusCounts = useMemo(() => ({
    total: settings.length,
    active: settings.filter(s => s.enabled).length,
    inactive: settings.filter(s => !s.enabled).length,
    deleted: 0
  }), [settings])

  // Filter settings based on status and search
  const filteredSettings = useMemo(() => {
    let list = settings
    if (statusFilter === 'active') list = list.filter(s => s.enabled)
    else if (statusFilter === 'inactive') list = list.filter(s => !s.enabled)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      list = list.filter(setting => {
        const categoryName = setting.category?.name || ""
        const subcategoryName = setting.subcategory?.name || ""
        return (
          categoryName.toLowerCase().includes(query) ||
          subcategoryName.toLowerCase().includes(query)
        )
      })
    }
    return list
  }, [settings, statusFilter, searchQuery])

  const totalPages = Math.ceil(filteredSettings.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentSettings = filteredSettings.slice(startIndex, endIndex)

  useEffect(() => {
    if (viewMode === 'card' && filteredSettings.length > 0) {
      const initialCards = filteredSettings.slice(0, 16)
      setDisplayedCards(initialCards)
      setHasMoreCards(filteredSettings.length > 16)
      setCurrentPage(1)
    }
  }, [filteredSettings, viewMode])

  useEffect(() => {
    setCurrentPage(1)
    if (viewMode === 'card') {
      const initialCards = filteredSettings.slice(0, 16)
      setDisplayedCards(initialCards)
      setHasMoreCards(filteredSettings.length > 16)
    }
  }, [searchQuery, statusFilter, viewMode, filteredSettings])

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleLoadMoreCards = () => {
    const currentCardCount = displayedCards.length
    const nextCards = filteredSettings.slice(currentCardCount, currentCardCount + 16)
    if (nextCards.length > 0) {
      setDisplayedCards([...displayedCards, ...nextCards])
      setHasMoreCards(currentCardCount + nextCards.length < filteredSettings.length)
    } else {
      setHasMoreCards(false)
    }
  }

  const handleViewModeChange = (mode) => {
    setViewMode(mode)
    setCurrentPage(1)
    if (mode === 'card') {
      const initialCards = filteredSettings.slice(0, 16)
      setDisplayedCards(initialCards)
      setHasMoreCards(filteredSettings.length > 16)
    }
  }

  // Handle form change
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    if (type === "checkbox") {
      setFormData({ ...formData, [name]: checked })
    } else {
      setFormData({ ...formData, [name]: value })
      // Clear subcategory when category changes
      if (name === "category") {
        setFormData(prev => ({ ...prev, subcategory: "" }))
      }
    }
  }

  // Handle category/subcategory select change
  const handleCategoryChange = (e) => {
    const value = e.target?.value || e
    setFormData({ ...formData, category: value, subcategory: "" })
  }

  const handleSubcategoryChange = (e) => {
    const value = e.target?.value || e
    setFormData({ ...formData, subcategory: value })
  }

  // Get subcategories for selected category - filter by category
  const availableSubcategories = useMemo(() => {
    if (!formData.category) return []
    
    // Filter subcategories that belong to the selected category
    // Handle different possible field names for category reference
    return subcategories.filter(sub => {
      const subCategoryId = sub.category?._id || sub.category || sub.categoryId
      const selectedCategoryId = formData.category
      
      // Compare as strings to handle ObjectId comparisons
      return String(subCategoryId) === String(selectedCategoryId)
    })
  }, [formData.category, subcategories])

  // Handle submit
  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!selectedWebsite) {
      setError("Please select a website first")
      return
    }

    if (!formData.category && !formData.subcategory) {
      setError("Please select either a category or subcategory")
      return
    }

    try {
      setLoading(true)
      setError("")
      setSuccess("")

      const payload = {
        category: formData.category || null,
        subcategory: formData.subcategory || null,
        enabled: formData.enabled,
        variationBasis: formData.variationBasis || "size_and_color",
        displayBasis: formData.displayBasis || "color_first"
      }

      if (editingId) {
        await api.put(`/variation-settings/${editingId}`, payload)
        setSuccess("Variation setting updated successfully")
      } else {
        await api.post("/variation-settings", payload)
        setSuccess("Variation setting created successfully")
      }

      resetForm()
      fetchSettings()
    } catch (err) {
      console.error("Error saving variation setting:", err)
      setError(err.response?.data?.msg || "Failed to save variation setting")
    } finally {
      setLoading(false)
    }
  }

  // Handle edit
  const handleEdit = (setting) => {
    setEditingId(setting._id)
    setFormData({
      category: setting.category?._id || setting.category || "",
      subcategory: setting.subcategory?._id || setting.subcategory || "",
      enabled: setting.enabled !== undefined ? setting.enabled : true,
      variationBasis: setting.variationBasis || "size_and_color",
      displayBasis: setting.displayBasis || "color_first"
    })
    
    // Scroll to form
    if (formRef.current) {
      formRef.current.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }

  // Handle delete
  const handleDelete = (settingId) => {
    const setting = settings.find(s => s._id === settingId)
    const categoryName = setting?.category?.name || "Category"
    const subcategoryName = setting?.subcategory?.name || ""
    const name = subcategoryName ? `${categoryName} > ${subcategoryName}` : categoryName
    
    setDeletePopup({
      isVisible: true,
      settingId,
      message: `Are you sure you want to remove variation support for "${name}"?`,
      isPermanentDelete: false,
      action: "delete"
    })
  }

  // Handle delete confirm
  const handleDeleteConfirm = async () => {
    try {
      setLoading(true)
      setError("")
      await api.delete(`/variation-settings/${deletePopup.settingId}`)
      setSuccess("Variation setting deleted successfully")
      fetchSettings()
    } catch (err) {
      console.error("Error deleting variation setting:", err)
      setError(err.response?.data?.msg || "Failed to delete variation setting")
    } finally {
      setLoading(false)
      setDeletePopup({ isVisible: false, settingId: null, message: "", isPermanentDelete: false, action: "delete" })
    }
  }

  // Handle delete cancel
  const handleDeleteCancel = () => {
    setDeletePopup({ isVisible: false, settingId: null, message: "", isPermanentDelete: false, action: "delete" })
  }

  // Reset form
  const resetForm = () => {
    setEditingId(null)
    setFormData({ ...initialFormData })
  }

  // Get display name for setting
  const getSettingDisplayName = (setting) => {
    if (setting.subcategory?.name) {
      return `${setting.category?.name || "Category"} > ${setting.subcategory.name}`
    }
    return setting.category?.name || "Category"
  }

  return (
    <div className="paddingAll20">
      <PageHeader
        title="Variation Settings"
        subtitle={selectedWebsite 
          ? `Configure which categories and subcategories support product variations for ${selectedWebsite.name || "selected website"}`
          : "Configure which categories and subcategories support product variations"
        }
        isEditing={!!editingId}
        editText="Edit Setting"
        createText="Add New Setting"
      />

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
      {categoriesError && (
        <AlertMessage type="error" message={categoriesError} onClose={() => setCategoriesError("")} autoClose={false} />
      )}
      {!selectedWebsite && (
        <AlertMessage
          type="error"
          message="Please select a website first to manage variation settings"
          onClose={() => {}}
          autoClose={false}
        />
      )}

      {/* Variation Setting Form */}
      <div className="brandFormContainer paddingAll32 appendBottom30" ref={formRef}>
        <form onSubmit={handleSubmit} className="brandForm" style={{ opacity: selectedWebsite ? 1 : 0.6 }}>
          <div className="makeFlex row gap10">
            <div className="widthHalf">
              <SearchableSelect
                label="Category"
                options={categories.map(cat => ({ value: cat._id, label: cat.name }))}
                value={formData.category}
                onChange={handleCategoryChange}
                placeholder={categoriesLoading ? "Loading categories..." : (categories.length === 0 ? "No active categories available" : "Select a category (optional)")}
                allowClear={true}
                disabled={categoriesLoading || categories.length === 0}
              />
              {categoriesLoading && (
                <small style={{ color: "#666", marginTop: "4px", display: "block" }}>Loading categories...</small>
              )}
              {!categoriesLoading && categories.length === 0 && (
                <small style={{ color: "#dc3545", marginTop: "4px", display: "block" }}>
                  No active categories. Create or activate categories in Category Manager first.
                </small>
              )}
              {!categoriesLoading && categories.length > 0 && (
                <small style={{ color: "#666", marginTop: "4px", display: "block" }}>
                  {categories.length} active categor{categories.length === 1 ? "y" : "ies"} available
                </small>
              )}
            </div>
            <div className="widthHalf">
              <SearchableSelect
                label="Subcategory"
                options={availableSubcategories
                  .filter(sub => sub.isActive === true && !sub.deleted)
                  .map(sub => ({ value: sub._id, label: sub.name }))}
                value={formData.subcategory}
                onChange={handleSubcategoryChange}
                placeholder={formData.category ? "Select a subcategory (optional)" : "Select a category first"}
                disabled={!formData.category}
                allowClear={true}
              />
              {formData.category && availableSubcategories.filter(sub => sub.isActive === true && !sub.deleted).length > 0 && (
                <small style={{ color: "#666", marginTop: "4px", display: "block" }}>
                  {availableSubcategories.filter(sub => sub.isActive === true && !sub.deleted).length} subcategor{availableSubcategories.filter(sub => sub.isActive && !sub.deleted).length === 1 ? "y" : "ies"} for this category
                </small>
              )}
            </div>
          </div>

          <div className="makeFlex row gap10 appendBottom16">
            <div className="widthHalf">
              <FormField
                type="select"
                name="variationBasis"
                label="Variation basis"
                value={formData.variationBasis || "size_and_color"}
                onChange={handleChange}
                options={VARIATION_BASIS_OPTIONS}
                info="Size + Color: T-shirts, caps. Color only: mugs, posters. Size only: sizes only."
              />
            </div>
            {formData.variationBasis === "size_and_color" && (
              <div className="widthHalf">
                <FormField
                  type="select"
                  name="displayBasis"
                  label="Display basis"
                  value={formData.displayBasis || "color_first"}
                  onChange={handleChange}
                  options={DISPLAY_BASIS_OPTIONS}
                  info="Color basis: group by color then size. Size basis: group by size then color."
                />
              </div>
            )}
          </div>

          <div className="makeFlex row gap10">
            <div className="makeFlex column flexOne appendBottom16">
              <label className="formLabel appendBottom10">Status</label>
              <label className="formLabel appendBottom8 makeFlex gap10">
                <FormField
                  type="checkbox"
                  name="enabled"
                  checked={formData.enabled}
                  onChange={handleChange}
                />
                Enable variations for this category/subcategory
              </label>
              <p className="negativeMarginTop10">Check to enable variations; uncheck to disable</p>
            </div>
          </div>

          <div className="formActions paddingTop16">
            <button type="submit" className="btnPrimary" disabled={loading || !selectedWebsite}>
              {loading ? <span className="loadingSpinner">⏳</span> : (editingId ? "Update Setting" : "Create Setting")}
            </button>
            {editingId && (
              <button type="button" onClick={resetForm} className="btnSecondary" disabled={!selectedWebsite}>
                Cancel
              </button>
            )}
          </div>
          {!selectedWebsite && (
            <small style={{ color: "#dc3545", marginTop: "8px", display: "block" }}>
              Please select a website to enable the form
            </small>
          )}
        </form>
      </div>

      {/* Variation Settings List */}
      <div className="brandsListContainer paddingAll32">
        <div className="listHeader makeFlex spaceBetween end appendBottom24">
          <div className="leftSection">
            <h2 className="listTitle font30 fontBold blackText appendBottom16">
              Variation Settings ({filteredSettings.length})
            </h2>
            {selectedWebsite && (
              <p className="font14 grayText" style={{ marginTop: "-8px", marginBottom: "8px" }}>
                Website: <strong>{selectedWebsite.name}</strong>
              </p>
            )}
            <StatusFilter
              statusFilter={statusFilter}
              onStatusChange={setStatusFilter}
              counts={statusCounts}
              disabled={loading}
            />
          </div>
          <div className="rightSection makeFlex end gap10">
            <SearchField
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by category or subcategory..."
              disabled={loading}
              minWidth="250px"
            />
            {loading && <div className="loadingIndicator grayText">Loading...</div>}
            <ViewToggle
              viewMode={viewMode}
              onViewChange={handleViewModeChange}
              disabled={loading}
            />
          </div>
        </div>

        {!selectedWebsite ? (
          <div className="emptyState textCenter paddingAll60">
            <div className="emptyIcon appendBottom16">🌐</div>
            <h3 className="font22 fontSemiBold grayText appendBottom8">No Website Selected</h3>
            <p className="font16 grayText appendBottom16">
              Please select a website from the header to manage variation settings
            </p>
          </div>
        ) : filteredSettings.length === 0 && !loading ? (
          <div className="emptyState textCenter paddingAll60">
            <div className="emptyIcon appendBottom16">⚙️</div>
            <h3 className="font22 fontSemiBold grayText appendBottom8">No Variation Settings</h3>
            <p className="font16 grayText appendBottom16">
              Add settings above to enable variations for specific categories or subcategories
            </p>
            {selectedWebsite && (
              <p className="font14 grayText" style={{ marginTop: "8px" }}>
                Managing settings for: <strong>{selectedWebsite.name}</strong>
              </p>
            )}
          </div>
        ) : (
          <>
            {/* Card View */}
            {viewMode === 'card' && (
              <div className="brandsGrid">
                {displayedCards.map((setting) => (
                  <EntityCard
                    key={setting._id}
                    entity={setting}
                    titleField="displayName"
                    idField="_id"
                    onEdit={() => handleEdit(setting)}
                    onDelete={() => handleDelete(setting._id)}
                    loading={loading}
                    imagePlaceholderColor={generateEntityColor(setting._id, getSettingDisplayName(setting))}
                    renderHeader={(setting) => (
                      <EntityCardHeader
                        entity={{
                          ...setting,
                          displayName: getSettingDisplayName(setting)
                        }}
                        titleField="displayName"
                        dateField="createdAt"
                        generateColor={generateEntityColor}
                      />
                    )}
                    renderDetails={(setting) => (
                      <>
                        <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                          <span className="detailLabel font14 fontSemiBold grayText textUppercase">Type:</span>
                          <span className="detailValue font14 blackText appendLeft6">
                            {setting.subcategory ? "Subcategory" : "Category"}
                          </span>
                        </div>
                        <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                          <span className="detailLabel font14 fontSemiBold grayText textUppercase">Basis:</span>
                          <span className="detailValue font14 blackText appendLeft6">
                            {setting.variationBasis === "color_only" ? "Color only" : setting.variationBasis === "size_only" ? "Size only" : "Size + Color"}
                            {setting.variationBasis === "size_and_color" && setting.displayBasis && (
                              <span className="grayText" style={{ fontSize: "12px", marginLeft: "4px" }}>
                                ({setting.displayBasis === "size_first" ? "Size first" : "Color first"})
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                          <span className="detailLabel font14 fontSemiBold grayText textUppercase">Status:</span>
                          <span className={`detailValue font14 ${setting.enabled ? 'greenText' : 'inactive'} appendLeft6`}>
                            {setting.enabled ? 'Enabled' : 'Disabled'}
                          </span>
                        </div>
                      </>
                    )}
                    renderActions={(setting) => (
                      <ActionButtons
                        onEdit={() => handleEdit(setting)}
                        onDelete={() => handleDelete(setting._id)}
                        loading={loading}
                        size="normal"
                        editText="✏️ Edit"
                        deleteText="🗑️ Delete"
                        editTitle="Edit Setting"
                        deleteTitle="Remove variation setting"
                      />
                    )}
                    className="brandCard"
                  />
                ))}
                {hasMoreCards && filteredSettings.length > 16 && (
                  <div className="loadMoreContainer textCenter paddingAll20">
                    <button type="button" onClick={handleLoadMoreCards} className="btnPrimary" disabled={loading}>
                      {loading ? <span className="loadingSpinner">⏳</span> : "Load More"}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* List View */}
            {viewMode === 'list' && (
              <div className="brandsListTable">
                <div className="tableContainer">
                  <table className="brandsTable">
                    <thead>
                      <tr>
                        <th className="tableHeader">Category</th>
                        <th className="tableHeader">Subcategory</th>
                        <th className="tableHeader">Type</th>
                        <th className="tableHeader">Basis / Display</th>
                        <th className="tableHeader">Status</th>
                        <th className="tableHeader">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentSettings.map((setting) => (
                        <tr key={setting._id} className="tableRow">
                          <td className="tableCell width20 font14 blackText">
                            {setting.category?.name || "N/A"}
                          </td>
                          <td className="tableCell width20 font14 blackText">
                            {setting.subcategory?.name || "—"}
                          </td>
                          <td className="tableCell width15 font14 blackText">
                            {setting.subcategory ? "Subcategory" : "Category"}
                          </td>
                          <td className="tableCell width15 font14 blackText">
                            {setting.variationBasis === "color_only" ? "Color only" : setting.variationBasis === "size_only" ? "Size only" : "Size + Color"}
                            {setting.variationBasis === "size_and_color" && setting.displayBasis && (
                              <span className="grayText" style={{ fontSize: "12px" }}> ({setting.displayBasis === "size_first" ? "Size first" : "Color first"})</span>
                            )}
                          </td>
                          <td className="tableCell width15 font14 blackText">
                            <span className={`statusText ${setting.enabled ? 'active' : 'inactive'}`}>
                              {setting.enabled ? 'Enabled' : 'Disabled'}
                            </span>
                          </td>
                          <td className="tableCell width10">
                            <div className="tableActions makeFlex gap8">
                              <ActionButtons
                                onEdit={() => handleEdit(setting)}
                                onDelete={() => handleDelete(setting._id)}
                                loading={loading}
                                size="small"
                                editText="✏️"
                                deleteText="🗑️"
                                editTitle="Edit Setting"
                                deleteTitle="Remove variation setting"
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
        onCancel={handleDeleteCancel}
        confirmText="Delete"
        cancelText="Cancel"
        loading={loading}
      />
    </div>
  )
}

export default VariationManager
