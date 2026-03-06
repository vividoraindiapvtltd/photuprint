import React, { useState, useEffect, useMemo, useCallback } from "react"
import api from "../api/axios"
import { useAuth } from "../context/AuthContext"
import { 
  PageHeader, 
  AlertMessage, 
  ViewToggle, 
  EntityCard, 
  EntityCardHeader,
  FormField, 
  ActionButtons,
  SearchField,
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
    enabled: true
  }

  const [formData, setFormData] = useState(initialFormData)
  const formRef = React.useRef(null)

  // Fetch variation settings
  const fetchSettings = async () => {
    if (!selectedWebsite) {
      console.warn("Cannot fetch settings: No website selected")
      return
    }
    
    try {
      setLoading(true)
      setError("") // Clear previous error
      const response = await api.get("/variation-settings")
      setSettings(response.data || [])
      setError("") // Ensure error is cleared on success
    } catch (err) {
      console.error("Error fetching variation settings:", err)
      
      // Handle network errors specifically
      if (err.code === 'ERR_NETWORK' || err.message === 'Network Error') {
        setError("❌ Cannot connect to server. Please ensure the backend server is running on port 8080.")
      } else {
        const errorMsg = err.response?.data?.msg || err.message || "Failed to load variation settings"
        setError(errorMsg)
      }
    } finally {
      setLoading(false)
    }
  }

  // Fetch categories - only active, non-deleted (like CategoryManager shows)
  const fetchCategories = async () => {
    if (!selectedWebsite) {
      console.warn("Cannot fetch categories: No website selected")
      return
    }
    
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

  // Fetch subcategories - will be filtered by selected category
  const fetchSubcategories = async () => {
    if (!selectedWebsite) {
      console.warn("Cannot fetch subcategories: No website selected")
      return
    }
    
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

  useEffect(() => {
    if (selectedWebsite) {
      fetchSettings()
      fetchCategories()
      fetchSubcategories()
    } else {
      // Clear data when no website is selected
      setSettings([])
      setCategories([])
      setSubcategories([])
    }
  }, [selectedWebsite])

  // Filter settings based on search
  const filteredSettings = useMemo(() => {
    if (!searchQuery.trim()) return settings
    
    const query = searchQuery.toLowerCase().trim()
    return settings.filter(setting => {
      const categoryName = setting.category?.name || ""
      const subcategoryName = setting.subcategory?.name || ""
      return (
        categoryName.toLowerCase().includes(query) ||
        subcategoryName.toLowerCase().includes(query)
      )
    })
  }, [settings, searchQuery])

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
        enabled: formData.enabled
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
      enabled: setting.enabled !== undefined ? setting.enabled : true
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
    setFormData(initialFormData)
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
      />
      
      {!selectedWebsite && (
        <AlertMessage 
          type="error" 
          message="Please select a website first to manage variation settings" 
          onClose={() => {}}
          autoClose={false}
        />
      )}

      {error && <AlertMessage type="error" message={error} onClose={() => setError("")} />}
      {success && <AlertMessage type="success" message={success} onClose={() => setSuccess("")} />}
      {categoriesError && <AlertMessage type="error" message={categoriesError} onClose={() => setCategoriesError("")} />}

      {/* Form */}
      <div className="brandFormContainer paddingAll32 appendBottom30" ref={formRef}>
        <form onSubmit={handleSubmit} className="brandForm" style={{ opacity: selectedWebsite ? 1 : 0.6 }}>
          <div className="makeFlex row gap10">
            <div className="fullWidth">
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
                <small style={{ color: "#666", marginTop: "4px", display: "block" }}>
                  Loading categories...
                </small>
              )}
              {!categoriesLoading && categories.length === 0 && (
                <small style={{ color: "#dc3545", marginTop: "4px", display: "block" }}>
                  ⚠️ No active categories found. Please create or activate categories in Category Manager first.
                </small>
              )}
              {!categoriesLoading && categories.length > 0 && (
                <small style={{ color: "#666", marginTop: "4px", display: "block" }}>
                  Only active categories from Category Manager are shown ({categories.length} available)
                </small>
              )}
            </div>
            <div className="fullWidth">
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
              {formData.category && availableSubcategories.filter(sub => sub.isActive === true && !sub.deleted).length === 0 && (
                <small style={{ color: "#666", marginTop: "4px", display: "block" }}>
                  No active subcategories found for this category
                </small>
              )}
              {formData.category && availableSubcategories.filter(sub => sub.isActive === true && !sub.deleted).length > 0 && (
                <small style={{ color: "#666", marginTop: "4px", display: "block" }}>
                  Showing {availableSubcategories.filter(sub => sub.isActive === true && !sub.deleted).length} active subcategory(ies) for selected category
                </small>
              )}
            </div>
          </div>

          <div className="makeFlex row gap10">
            <div className="fullWidth">
              <label style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "16px" }}>
                <input
                  type="checkbox"
                  name="enabled"
                  checked={formData.enabled}
                  onChange={handleChange}
                />
                <span>Enable variations for this category/subcategory</span>
              </label>
            </div>
          </div>

          <div className="makeFlex row gap10 appendTop20">
            <button type="submit" className="btnPrimary" disabled={loading || !selectedWebsite}>
              {loading ? "Saving..." : editingId ? "Update Setting" : "Add Setting"}
            </button>
            {editingId && (
              <button type="button" onClick={resetForm} className="btnSecondary" disabled={!selectedWebsite}>
                Cancel
              </button>
            )}
          </div>
          {!selectedWebsite && (
            <small style={{ color: "#dc3545", marginTop: "8px", display: "block" }}>
              ⚠️ Please select a website to enable the form
            </small>
          )}
        </form>
      </div>

      {/* Settings List */}
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
          </div>
          <div className="rightSection makeFlex end gap10">
            <SearchField
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search settings..."
              disabled={loading}
              minWidth="250px"
            />
            <ViewToggle
              viewMode={viewMode}
              onViewChange={setViewMode}
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
                {filteredSettings.map((setting) => (
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
                        <th className="tableHeader">Status</th>
                        <th className="tableHeader">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSettings.map((setting) => (
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
