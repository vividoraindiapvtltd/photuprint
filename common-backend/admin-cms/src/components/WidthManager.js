import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import api from '../api/axios';
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
  generateEntityColor 
} from '../common';

const WidthManager = () => {
  const [widths, setWidths] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editingId, setEditingId] = useState(null);
  const initialFormData = {
    name: "",
    unit: "centimeters",
    description: "",
    isActive: false
  };

  // Helper function to get unit abbreviation
  const getUnitAbbreviation = (unit) => {
    const unitMap = {
      'millimeters': 'mm',
      'centimeters': 'cm',
      'inches': 'in',
      'feet': 'ft',
      'meters': 'm'
    };
    return unitMap[unit] || 'cm';
  };

  const [formData, setFormData] = useState(initialFormData);
  const [searchQuery, setSearchQuery] = useState(""); // Search query state
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'active', 'inactive', 'deleted'
  
  // Delete confirmation popup state
  const [deletePopup, setDeletePopup] = useState({
    isVisible: false,
    widthId: null,
    message: "",
    isPermanentDelete: false,
    action: "delete" // "delete" or "revert"
  });
  
  // Refs for scroll and focus functionality
  const formRef = useRef(null);
  const widthNameInputRef = useRef(null);
  
  // View mode and pagination states
  const [viewMode, setViewMode] = useState('card'); // 'card' or 'list'
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10); // For list view
  const [hasMoreCards, setHasMoreCards] = useState(true);
  const [displayedCards, setDisplayedCards] = useState([]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (type === 'checkbox') {
      setFormData({ ...formData, [name]: checked });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  // Validate Width name for duplicates
  const validateWidthName = (name) => {
    if (!name || name === '' || name === null || name === undefined) {
      return { isValid: false, error: "Width value is required" };
    }
    
    // Convert to number for comparison (backend stores as number)
    const nameNum = Number(name);
    
    // Check if it's a valid number
    if (isNaN(nameNum)) {
      return { isValid: false, error: "Width value must be a number" };
    }
    
    // Check for duplicate names only against active, non-deleted widths (excluding current width being edited)
    const existingWidth = widths.find(width => 
      Number(width.name) === nameNum && 
      width._id !== editingId &&
      width.isActive === true && // Only check against active widths
      !width.deleted && // Exclude deleted widths
      width.unit === formData.unit // Check for same unit as well
    );
    
    if (existingWidth) {
      return { isValid: false, error: `Width value ${nameNum} with unit ${formData.unit} already exists` };
    }
    
    return { isValid: true, error: "" };
  };

  // Validate and Add / Update Width
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate Width name
    const nameValidation = validateWidthName(formData.name);
    if (!nameValidation.isValid) {
      setError(nameValidation.error);
      return;
    }

    try {
      setLoading(true);
      setSuccess(""); // Clear any existing success message
      setError(""); // Clear any existing error message

      // Use JSON for data submission
      const widthData = {
        name: Number(formData.name), // Convert to number as backend expects
          unit: formData.unit,
          description: formData.description?.trim() || '',
          isActive: formData.isActive
        };

      if (editingId) {
        // Update Width
        await api.put(`/widths/${editingId}`, widthData);
        setSuccess(`✅ Width "${widthData.name}" has been updated successfully!`);
      } else {
        // Create Width
        await api.post('/widths', widthData);
        setSuccess(`✅ Width "${widthData.name}" has been created successfully!`);
      }

      // Refresh widths list
      await fetchWidths();
      
      // Reset form after successful submission (for both add and edit)
      resetForm();
      
    } catch (err) {
      if (err.response?.data?.msg?.includes('already exists')) {
        setError(`❌ ${err.response.data.msg}`);
      } else {
        setError(`❌ Failed to ${editingId ? 'update' : 'create'} width. ${err.response?.data?.msg || 'Please try again.'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData(initialFormData);
    setEditingId(null);
    setError("");
    // Don't clear success message here - let AlertMessage handle it
    // setSuccess("");
  };

  // Clear form after successful operations
  const clearForm = () => {
    setFormData(initialFormData);
    setEditingId(null);
    setError("");
    setSuccess("");
  };

  // Edit Width
  const handleEdit = (width) => {
    setFormData({
      ...initialFormData,
      name: width.name?.toString() || "", // Convert number to string for input field
      unit: width.unit || "centimeters",
      description: width.description || "",
      isActive: width.isActive !== undefined ? width.isActive : false
    });
    setEditingId(width._id || width.id);
    setError("");
    setSuccess("");
    
    // Scroll to form and focus on width name input
    setTimeout(() => {
      if (formRef.current) {
        formRef.current.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start' 
        });
      }
      if (widthNameInputRef.current) {
        widthNameInputRef.current.focus();
      }
    }, 100);
  };

  // Delete Width
  const handleDelete = async (widthId) => {
    // Find the width to check if it's already marked as deleted
    const width = widths.find(w => w._id === widthId);
    const isAlreadyDeleted = width?.deleted;
    
    let message;
    let isPermanentDelete = false;
    
    if (isAlreadyDeleted) {
      message = "This width is already marked as deleted. Click OK to permanently remove it from the database. This action cannot be undone.";
      isPermanentDelete = true;
    } else {
      message = "This will mark the width as inactive and add a deleted flag. Click OK to continue.";
      isPermanentDelete = false;
    }
    
    setDeletePopup({
      isVisible: true,
      widthId,
      message,
      isPermanentDelete,
      action: "delete"
    });
  };

  // Handle delete confirmation
  const handleDeleteConfirm = async () => {
    const { widthId, isPermanentDelete } = deletePopup;
    const width = widths.find(w => w._id === widthId);
    
    try {
      setLoading(true);
      setSuccess(""); // Clear any existing success message
      setError(""); // Clear any existing error message
      
      if (isPermanentDelete) {
        // Permanent deletion
        await api.delete(`/widths/${widthId}/hard`);
        setSuccess(`🗑️ Width "${width.name}" has been permanently deleted from the database.`);
      } else {
        // Soft delete - mark as inactive and add deleted flag
        await api.delete(`/widths/${widthId}`);
        setSuccess(`⏸️ Width "${width.name}" has been marked as deleted and inactive.`);
      }
      
      await fetchWidths();
    } catch (err) {
      const action = isPermanentDelete ? "permanently delete" : "mark as deleted";
      setError(`❌ Failed to ${action} width "${width.name}". ${err.response?.data?.msg || 'Please try again.'}`);
    } finally {
      setLoading(false);
      setDeletePopup({
        isVisible: false,
        widthId: null,
        message: "",
        isPermanentDelete: false,
        action: "delete"
      });
    }
  };

  // Handle delete cancellation
  const handleDeleteCancel = () => {
    setDeletePopup({
      isVisible: false,
      widthId: null,
      message: "",
      isPermanentDelete: false,
      action: "delete"
    });
  };

  // Revert deleted Width
  const handleRevert = async (widthId) => {
    const width = widths.find(w => w._id === widthId);
    
    if (!width) {
      setError("Width not found");
      return;
    }

    if (!width.deleted) {
      setError("This width is not deleted");
      return;
    }

    setDeletePopup({
      isVisible: true,
      widthId,
      message: `Are you sure you want to restore the width "${width.name}"? This will make it active again.`,
      isPermanentDelete: false,
      action: "revert"
    });
  };

  // Handle revert confirmation
  const handleRevertConfirm = async () => {
    const { widthId } = deletePopup;
    const width = widths.find(w => w._id === widthId);
    
    try {
      setLoading(true);
      setSuccess("");
      setError("");

      // Check if there's already an active or inactive width with the same name and unit
      const existingWidth = widths.find(w => 
        w._id !== widthId && // Exclude current width being reverted
        Number(w.name) === Number(width.name) && // Same numeric value
        w.unit === width.unit && // Same unit
        !w.deleted // Not deleted (active or inactive)
      );

      if (existingWidth) {
        const status = existingWidth.isActive ? 'Active' : 'Inactive';
        const suggestion = existingWidth.isActive ? 
          `Consider deleting the active width "${existingWidth.name} ${existingWidth.unit}" first, or use a different value/unit for the restored width.` :
          `Consider deleting the inactive width "${existingWidth.name} ${existingWidth.unit}" first, or use a different value/unit for the restored width.`;
        
        setError(`❌ Cannot restore width "${width.name} ${width.unit}". A ${status.toLowerCase()} width with this value and unit already exists. ${suggestion}`);
        setLoading(false);
        setDeletePopup({
          isVisible: false,
          widthId: null,
          message: "",
          isPermanentDelete: false,
          action: "delete"
        });
        return;
      }

      // Revert the width by setting deleted to false and isActive to true
      await api.put(`/widths/${widthId}`, {
        name: width.name,
        unit: width.unit || "centimeters",
        description: width.description || '',
        isActive: true,
        deleted: false
      });

      setSuccess(`✅ Width "${width.name}" has been restored and is now active!`);
      await fetchWidths();
    } catch (err) {
      setError(`❌ Failed to restore width "${width.name}". ${err.response?.data?.msg || 'Please try again.'}`);
    } finally {
      setLoading(false);
      setDeletePopup({
        isVisible: false,
        widthId: null,
        message: "",
        isPermanentDelete: false,
        action: "delete"
      });
    }
  };

  // Handle revert cancellation
  const handleRevertCancel = () => {
    setDeletePopup({
      isVisible: false,
      widthId: null,
      message: "",
      isPermanentDelete: false,
      action: "delete"
    });
  };

  // Fetch widths from backend
  const fetchWidths = async () => {
    try {
      setLoading(true);
      const response = await api.get('/widths?showInactive=true&includeDeleted=true');
      
      setWidths(response.data);
      setError("");
    } catch (err) {
      setError("Failed to fetch widths");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWidths();
  }, []);

  // Filter widths based on search query and status
  const filteredWidths = useMemo(() => {
    let filtered = widths;
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(width => 
        width.name.toString().toLowerCase().includes(query) ||
        (width.unit && width.unit.toLowerCase().includes(query)) ||
        (width.description && width.description.toLowerCase().includes(query))
      );
    }
    
    // Apply status filter
    filtered = filterEntitiesByStatus(filtered, statusFilter);
    
    return filtered;
  }, [widths, searchQuery, statusFilter]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredWidths.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentWidths = filteredWidths.slice(startIndex, endIndex);

  // Card lazy loading logic
  useEffect(() => {
    if (viewMode === 'card') {
      const initialCards = filteredWidths.slice(0, 12);
      setDisplayedCards(initialCards);
      setHasMoreCards(filteredWidths.length > 12);
      setCurrentPage(1);
    }
  }, [viewMode, filteredWidths]);

  // Reset pagination when search query changes
  const resetPaginationForSearch = useCallback(() => {
    setCurrentPage(1);
    if (viewMode === 'card') {
      const initialCards = filteredWidths.slice(0, 12);
      setDisplayedCards(initialCards);
      setHasMoreCards(filteredWidths.length > 12);
    }
  }, [viewMode, filteredWidths.length]);

  useEffect(() => {
    resetPaginationForSearch();
  }, [searchQuery, resetPaginationForSearch]);

  // Handle page change for list view
  const handlePageChange = useCallback((pageNumber) => {
    setCurrentPage(pageNumber);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Handle lazy loading for card view
  const handleLoadMoreCards = useCallback(() => {
    setDisplayedCards(prevCards => {
      const currentCardCount = prevCards.length;
      const nextCards = filteredWidths.slice(currentCardCount, currentCardCount + 12);
      
      if (nextCards.length > 0) {
        setHasMoreCards(currentCardCount + nextCards.length < filteredWidths.length);
        return [...prevCards, ...nextCards];
      } else {
        setHasMoreCards(false);
        return prevCards;
      }
    });
  }, [filteredWidths]);

  // Reset pagination when view mode changes
  const handleViewModeChange = useCallback((mode) => {
    setViewMode(mode);
    setCurrentPage(1);
    if (mode === 'card') {
      const initialCards = filteredWidths.slice(0, 12);
      setDisplayedCards(initialCards);
      setHasMoreCards(filteredWidths.length > 12);
    }
  }, [filteredWidths.length]);

  const handleCancel = () => {
    resetForm();
  };

  return (
    <div className="paddingAll20">
      {/* Header */}
      <PageHeader
        title="Width Management"
        subtitle="Manage your product Widths and classifications"
        isEditing={!!editingId}
        editText="Edit Width"
        createText="Add New Width"
      />

      {/* Success/Error Messages */}
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

      {/* Form */}
      <div className="brandFormContainer paddingAll32 appendBottom30" ref={formRef}>
        <form onSubmit={handleSubmit} className="brandForm">
          <div className="makeFlex row gap10">
            <div className="fullWidth">
              <FormField
                ref={widthNameInputRef}
                type="number"
                name="name"
                label="Width Value"
                value={formData.name}
                onChange={handleChange}
                placeholder="Enter Width Value (e.g., 50)"
                required={true}
              />
            </div>
            <div className="fullWidth">
              <FormField
                type="select"
                  name="unit"
                label="Unit"
                  value={formData.unit}
                  onChange={handleChange}
                required={true}
                options={[
                  { value: "millimeters", label: "Millimeters (mm)" },
                  { value: "centimeters", label: "Centimeters (cm)" },
                  { value: "inches", label: "Inches (in)" },
                  { value: "feet", label: "Feet (ft)" },
                  { value: "meters", label: "Meters (m)" },
                ]}
              />
            </div>
          </div>
          <div className="makeFlex row gap10">
            <div className="fullWidth">
              <FormField
                type="textarea"
                name="description"
                label="Description"
              value={formData.description || ''} 
                onChange={handleChange}
                placeholder="Enter Width Description"
                rows={3}
              />
            </div>
          </div>

          <div className="makeFlex row gap10">
            <div className="makeFlex column appendBottom16">
              <label className="formLabel appendBottom10">Status:</label>
              <label className="appendBottom8 makeFlex gap10">
                <FormField
                  type="checkbox"
                  name="isActive"
                  className="fontBold"
                  value={formData.isActive}
                  onChange={handleChange}
                />
                Active
              </label>
              <p className="negativeMarginTop10">Check this box to keep the Width active, uncheck to mark as inactive</p>
            </div>
          </div>

          {/* Form Actions */}
          <div className="formActions paddingTop16">
            <button
              type="submit"
              disabled={loading}
              className="btnPrimary"
            >
              {loading ? (
                <span className="loadingSpinner">⏳</span>
              ) : (
                <span>{editingId ? "Update Width" : "Add Width"}</span>
              )}
            </button>
            
            {editingId && (
              <button
                type="button"
                onClick={handleCancel}
                className="btnSecondary"
              >
                Cancel
              </button>
            )}
            
            {!editingId && success && (
              <button
                type="button"
                onClick={clearForm}
                className="btnSecondary"
              >
                Add Another Width
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Widths List */}
      <div className="brandsListContainer paddingAll32">
        <div className="listHeader makeFlex spaceBetween end appendBottom24">
          <div className="leftSection">
            <h2 className="listTitle font30 fontBold blackText appendBottom16">Widths ({filteredWidths?.length || 0})</h2>
            <StatusFilter
              statusFilter={statusFilter}
              onStatusChange={setStatusFilter}
              counts={calculateStandardStatusCounts(widths)}
              disabled={loading}
            />
          </div>
          <div className="rightSection makeFlex end gap10">
            <SearchField
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Widths..."
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

        {filteredWidths.length === 0 && !loading ? (
          <div className="emptyState textCenter paddingAll60">
            <div className="emptyIcon appendBottom16">📏</div>
            <h3 className="font22 fontSemiBold grayText appendBottom8">No Widths Found</h3>
            <p className="font16 grayText">Start by adding your first width above</p>
          </div>
        ) : (
          <>
            {/* Card View */}
            {viewMode === 'card' && (
              <div className="brandsGrid">
                {displayedCards.map((width) => (
                  <EntityCard
                    key={width._id || width.id}
                    entity={width}
                    logoField="image"
                    nameField="name"
                    idField="_id"
                    onEdit={width.deleted ? undefined : handleEdit}
                    onDelete={handleDelete}
                    onRevert={width.deleted ? () => handleRevert(width._id || width.id) : undefined}
                    loading={loading}
                    imagePlaceholderColor={generateEntityColor(width._id || width.id, width.name)}
                    renderHeader={(width) => (
                      <EntityCardHeader
                        entity={{
                          ...width,
                          name: `${width.name} ${getUnitAbbreviation(width.unit || 'centimeters')}`
                        }}
                        imageField="image"
                        titleField="name"
                        dateField="createdAt"
                        generateColor={generateEntityColor}
                      />
                    )}
                    renderDetails={(width) => {
                      return (
                        <>
                          <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                            <span className="detailLabel font14 fontSemiBold grayText textUppercase">Width ID:</span>
                            <span className="detailValue font14 blackText appendLeft6">{width._id || 'N/A'}</span>
                          </div>
                          <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                            <span className="detailLabel font14 fontSemiBold grayText textUppercase">Width:</span>
                            <span className="detailValue font14 blackText appendLeft6">
                              {width.name} {getUnitAbbreviation(width.unit || 'centimeters')}
                            </span>
                          </div>
                          {width.description && (
                            <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                              <span className="detailLabel font14 fontSemiBold grayText textUppercase">Description:</span>
                              <span className="detailValue font14 blackText appendLeft6">{width.description}</span>
                            </div>
                          )}
                          <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                            <span className="detailLabel font14 fontSemiBold grayText textUppercase">Status:</span>
                            <span className={`detailValue font14 ${width.deleted ? 'deleted' : (width.isActive ? 'greenText' : 'inactive')} appendLeft6`}>
                              {width.deleted ? 'Deleted' : (width.isActive ? 'Active' : 'Inactive')}
                            </span>
                          </div>
                        </>
                      );
                    }}
                    renderActions={(width) => (
                      <ActionButtons
                        onEdit={width.deleted ? undefined : () => handleEdit(width)}
                        onDelete={() => handleDelete(width._id || width.id)}
                        onRevert={width.deleted ? () => handleRevert(width._id || width.id) : undefined}
                        loading={loading}
                        size="normal"
                        editText="✏️ Edit"
                        deleteText={width.deleted ? "🗑️ Final Del" : "🗑️ Delete"}
                        revertText="🔄 Undelete"
                        editTitle="Edit Width"
                        deleteTitle={width.deleted ? "Final Del" : "Delete Width"}
                        revertTitle="Restore Width"
                      />
                    )}
                    className="brandCard"
                  />
                ))}
                {hasMoreCards && (
                  <div className="loadMoreContainer textCenter paddingAll20">
                    <button
                      onClick={handleLoadMoreCards}
                      className="btnPrimary"
                      disabled={loading}
                    >
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

            {/* List View */}
            {viewMode === 'list' && (
              <div className="brandsListTable">
                <div className="tableContainer">
                  <table className="brandsTable">
                    <thead>
                      <tr>
                        <th className="tableHeader">ID</th>
                        <th className="tableHeader">Value</th>
                        <th className="tableHeader">Unit</th>
                        <th className="tableHeader">Status</th>
                        <th className="tableHeader">Created</th>
                        <th className="tableHeader">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentWidths.map((width) => (
                        <tr key={width._id || width.id} className="tableRow">
                          <td className="tableCell">
                            <span className="brandNameText">{width._id || 'N/A'}</span>
                          </td>
                          <td className="tableCell">
                            <span className="brandNameText">{width.name}</span>
                          </td>
                          <td className="tableCell">
                            <span className="addressText">
                              {width.unit ? width.unit.charAt(0).toUpperCase() + width.unit.slice(1) : 'Centimeters'}
                            </span>
                          </td>
                          <td className="tableCell">
                            <span className={`statusText ${width.deleted ? 'deleted' : (width.isActive ? 'active' : 'inactive')}`}>
                              {width.deleted ? 'Deleted' : (width.isActive ? 'Active' : 'Inactive')}
                            </span>
                          </td>
                          <td className="tableCell">
                            <span className="dateText">
                              {new Date(width.createdAt).toLocaleDateString()}
                            </span>
                          </td>
                          <td className="tableCell">
                            <div className="tableActions makeFlex gap8">
                              <ActionButtons
                                onEdit={width.deleted ? undefined : () => handleEdit(width)}
                                onDelete={() => handleDelete(width._id || width.id)}
                                onRevert={width.deleted ? () => handleRevert(width._id || width.id) : undefined}
                                loading={loading}
                                size="small"
                                editText="✏️"
                                deleteText={width.deleted ? "🗑️" : "🗑️"}
                                revertText="🔄"
                                editTitle="Edit Width"
                                deleteTitle={width.deleted ? "Final Del" : "Delete Width"}
                                revertTitle="Restore Width"
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

      {/* Delete Confirmation Popup */}
      <DeleteConfirmationPopup
        isVisible={deletePopup.isVisible}
        message={deletePopup.message}
        onConfirm={deletePopup.action === "delete" ? handleDeleteConfirm : handleRevertConfirm}
        onCancel={deletePopup.action === "delete" ? handleDeleteCancel : handleRevertCancel}
        action={deletePopup.action}
        isPermanentDelete={deletePopup.isPermanentDelete}
      />
    </div>
  );
};

export default WidthManager;
