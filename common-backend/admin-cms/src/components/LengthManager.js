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

const LengthManager = () => {
  const [lengths, setLengths] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editingId, setEditingId] = useState(null);
  const initialFormData = {
    name: "",
    unit: "centimeters",
    description: "",
    image: null,
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
    lengthId: null,
    message: "",
    isPermanentDelete: false,
    action: "delete" // "delete" or "revert"
  });
  
  // Refs for scroll and focus functionality
  const formRef = useRef(null);
  const lengthNameInputRef = useRef(null);
  
  // View mode and pagination states
  const [viewMode, setViewMode] = useState('card'); // 'card' or 'list'
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10); // For list view
  const [hasMoreCards, setHasMoreCards] = useState(true);
  const [displayedCards, setDisplayedCards] = useState([]);

  const handleChange = (e) => {
    const { name, value, type, checked, files } = e.target;
    
    if (type === 'checkbox') {
      setFormData({ ...formData, [name]: checked });
    } else if (type === 'file') {
      setFormData({ ...formData, [name]: files[0] || null });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  // Validate length name for duplicates
  const validateLengthName = (name) => {
    if (!name || name === '' || name === null || name === undefined) {
      return { isValid: false, error: "Length value is required" };
    }
    
    // Convert to number for comparison (backend stores as number)
    const nameNum = Number(name);
    
    // Check if it's a valid number
    if (isNaN(nameNum)) {
      return { isValid: false, error: "Length value must be a number" };
    }
    
    // Check for duplicate names only against active, non-deleted lengths (excluding current length being edited)
    const existingLength = lengths.find(length => 
      Number(length.name) === nameNum && 
      length._id !== editingId &&
      length.isActive === true && // Only check against active lengths
      !length.deleted && // Exclude deleted lengths
      length.unit === formData.unit // Check for same unit as well
    );
    
    if (existingLength) {
      return { isValid: false, error: `Length value ${nameNum} with unit ${formData.unit} already exists` };
    }
    
    return { isValid: true, error: "" };
  };

  // Validate and Add / Update length
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate length name
    const nameValidation = validateLengthName(formData.name);
    if (!nameValidation.isValid) {
      setError(nameValidation.error);
      return;
    }

    try {
      setLoading(true);
      setSuccess(""); // Clear any existing success message
      setError(""); // Clear any existing error message

      // Use JSON for data submission
      const lengthData = {
        name: Number(formData.name), // Convert to number as backend expects
          unit: formData.unit,
          description: formData.description?.trim() || '',
          isActive: formData.isActive
        };

      if (editingId) {
        // Update length
        await api.put(`/lengths/${editingId}`, lengthData);
        setSuccess(`✅ Length "${lengthData.name}" has been updated successfully!`);
      } else {
        // Create length
        await api.post('/lengths', lengthData);
        setSuccess(`✅ Length "${lengthData.name}" has been created successfully!`);
      }

      // Refresh lengths list
      await fetchLengths();
      
      // Reset form after successful submission (for both add and edit)
      resetForm();
      
    } catch (err) {
      if (err.response?.data?.msg === 'length name already exists') {
        setError("❌ length name already exists. Please choose a different name.");
      } else {
        setError(`❌ Failed to ${editingId ? 'update' : 'create'} length. ${err.response?.data?.msg || 'Please try again.'}`);
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

  // Edit length
  const handleEdit = (length) => {
    setFormData({
      ...initialFormData,
      name: length.name?.toString() || "", // Convert number to string for input field
      unit: length.unit || "centimeters",
      description: length.description || "",
      isActive: length.isActive !== undefined ? length.isActive : false
    });
    setEditingId(length._id || length.id);
    setError("");
    setSuccess("");
    
    // Scroll to form and focus on length name input
    setTimeout(() => {
      if (formRef.current) {
        formRef.current.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start' 
        });
      }
      if (lengthNameInputRef.current) {
        lengthNameInputRef.current.focus();
      }
    }, 100);
  };

  // Delete length
  const handleDelete = async (lengthId) => {
    // Find the length to check if it's already marked as deleted
    const length = lengths.find(h => h._id === lengthId);
    const isAlreadyDeleted = length?.deleted;
    
    let message;
    let isPermanentDelete = false;
    
    if (isAlreadyDeleted) {
      message = "This length is already marked as deleted. Click OK to permanently remove it from the database. This action cannot be undone.";
      isPermanentDelete = true;
    } else {
      message = "This will mark the length as inactive and add a deleted flag. Click OK to continue.";
      isPermanentDelete = false;
    }
    
    setDeletePopup({
      isVisible: true,
      lengthId,
      message,
      isPermanentDelete,
      action: "delete"
    });
  };

  // Handle delete confirmation
  const handleDeleteConfirm = async () => {
    const { lengthId, isPermanentDelete } = deletePopup;
    const length = lengths.find(h => h._id === lengthId);
    
    try {
      setLoading(true);
      setSuccess(""); // Clear any existing success message
      setError(""); // Clear any existing error message
      
      if (isPermanentDelete) {
        // Permanent deletion
        await api.delete(`/lengths/${lengthId}/hard`);
        setSuccess(`🗑️ length "${length.name}" has been permanently deleted from the database.`);
      } else {
        // Soft delete - mark as inactive and add deleted flag
        await api.delete(`/lengths/${lengthId}`);
        setSuccess(`⏸️ length "${length.name}" has been marked as deleted and inactive.`);
      }
      
      await fetchLengths();
    } catch (err) {
      const action = isPermanentDelete ? "permanently delete" : "mark as deleted";
      setError(`❌ Failed to ${action} length "${length.name}". ${err.response?.data?.msg || 'Please try again.'}`);
    } finally {
      setLoading(false);
      setDeletePopup({
        isVisible: false,
        lengthId: null,
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
      lengthId: null,
      message: "",
      isPermanentDelete: false,
      action: "delete"
    });
  };

  // Revert deleted length
  const handleRevert = async (lengthId) => {
    const length = lengths.find(h => h._id === lengthId);
    
    if (!length) {
      setError("length not found");
      return;
    }

    if (!length.deleted) {
      setError("This length is not deleted");
      return;
    }

    setDeletePopup({
      isVisible: true,
      lengthId,
      message: `Are you sure you want to restore the length "${length.name}"? This will make it active again.`,
      isPermanentDelete: false,
      action: "revert"
    });
  };

  // Handle revert confirmation
  const handleRevertConfirm = async () => {
    const { lengthId } = deletePopup;
    const length = lengths.find(h => h._id === lengthId);
    
    try {
      setLoading(true);
      setSuccess("");
      setError("");

      // Check if there's already an active or inactive length with the same name
      const existingLength = lengths.find(h => 
        h._id !== lengthId && // Exclude current length being reverted
        h.name.toLowerCase().trim() === length.name.toLowerCase().trim() && // Same name
        !h.deleted // Not deleted (active or inactive)
      );

      if (existingLength) {
        const status = existingLength.isActive ? 'Active' : 'Inactive';
        const suggestion = existingLength.isActive ? 
          `Consider deleting the active length "${existingLength.name}" first, or use a different name for the restored length.` :
          `Consider deleting the inactive length "${existingLength.name}" first, or use a different name for the restored length.`;
        
        setError(`❌ Cannot restore length "${length.name}". A ${status.toLowerCase()} length with this name already exists. ${suggestion}`);
        setLoading(false);
        setDeletePopup({
          isVisible: false,
          lengthId: null,
          message: "",
          isPermanentDelete: false,
          action: "delete"
        });
        return;
      }

      // Revert the length by setting deleted to false and isActive to true
      await api.put(`/lengths/${lengthId}`, {
        name: length.name,
        unit: length.unit || "centimeters",
        description: length.description || '',
        isActive: true,
        deleted: false
      });

      setSuccess(`✅ length "${length.name}" has been restored and is now active!`);
      await fetchLengths();
    } catch (err) {
      setError(`❌ Failed to restore length "${length.name}". ${err.response?.data?.msg || 'Please try again.'}`);
    } finally {
      setLoading(false);
      setDeletePopup({
        isVisible: false,
        lengthId: null,
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
      lengthId: null,
      message: "",
      isPermanentDelete: false,
      action: "delete"
    });
  };

  // Fetch lengths from backend
  const fetchLengths = async () => {
    try {
      setLoading(true);
      const response = await api.get('/lengths?showInactive=true&includeDeleted=true');
      
      // Process lengths to ensure proper image URLs
      const processedLengths = response.data.map(length => {
        let imageUrl = length.image;
        
        // If image is a relative path, construct full URL
        if (imageUrl && !imageUrl.startsWith('http')) {
          // Check if it's a local upload path
          if (imageUrl.startsWith('/uploads/')) {
            imageUrl = `${imageUrl}`;
          }
        }
        
        return {
          ...length,
          image: imageUrl
        };
      });
      
      setLengths(processedLengths);
      setError("");
    } catch (err) {
      setError("Failed to fetch lengths");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLengths();
  }, []);

  // Filter lengths based on search query and status
  const filteredLengths = useMemo(() => {
    let filtered = lengths;
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(length => 
        length.name.toLowerCase().includes(query) ||
        (length.unit && length.unit.toLowerCase().includes(query)) ||
        (length.description && length.description.toLowerCase().includes(query))
      );
    }
    
    // Apply status filter
    filtered = filterEntitiesByStatus(filtered, statusFilter);
    
    return filtered;
  }, [lengths, searchQuery, statusFilter]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredLengths.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentLengths = filteredLengths.slice(startIndex, endIndex);

  // Card lazy loading logic
  useEffect(() => {
    if (viewMode === 'card') {
      const initialCards = filteredLengths.slice(0, 12);
      setDisplayedCards(initialCards);
      setHasMoreCards(filteredLengths.length > 12);
      setCurrentPage(1);
    }
  }, [viewMode, filteredLengths]);

  // Reset pagination when search query changes
  const resetPaginationForSearch = useCallback(() => {
    setCurrentPage(1);
    if (viewMode === 'card') {
      const initialCards = filteredLengths.slice(0, 12);
      setDisplayedCards(initialCards);
      setHasMoreCards(filteredLengths.length > 12);
    }
  }, [viewMode, filteredLengths.length]);

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
      const nextCards = filteredLengths.slice(currentCardCount, currentCardCount + 12);
      
      if (nextCards.length > 0) {
        setHasMoreCards(currentCardCount + nextCards.length < filteredLengths.length);
        return [...prevCards, ...nextCards];
      } else {
        setHasMoreCards(false);
        return prevCards;
      }
    });
  }, [filteredLengths]);

  // Reset pagination when view mode changes
  const handleViewModeChange = useCallback((mode) => {
    setViewMode(mode);
    setCurrentPage(1);
    if (mode === 'card') {
      const initialCards = filteredLengths.slice(0, 12);
      setDisplayedCards(initialCards);
      setHasMoreCards(filteredLengths.length > 12);
    }
  }, [filteredLengths.length]);

  const handleCancel = () => {
    resetForm();
  };

  return (
    <div className="paddingAll20">
      {/* Header */}
      <PageHeader
        title="length Management"
        subtitle="Manage your product lengths and classifications"
        isEditing={!!editingId}
        editText="Edit length"
        createText="Add New length"
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
                ref={lengthNameInputRef}
                type="number"
                name="name"
                label="Length Value"
                value={formData.name}
                onChange={handleChange}
                placeholder="Enter length Value (e.g., 50)"
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
              placeholder="Enter length Description" 
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
              <p className="negativeMarginTop10">Check this box to keep the length active, uncheck to mark as inactive</p>
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
                <span>{editingId ? "Update length" : "Add length"}</span>
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
                Add Another length
              </button>
            )}
          </div>
        </form>
      </div>

      {/* lengths List */}
      <div className="brandsListContainer paddingAll32">
        <div className="listHeader makeFlex spaceBetween end appendBottom24">
          <div className="leftSection">
            <h2 className="listTitle font30 fontBold blackText appendBottom16">lengths ({filteredLengths.length})</h2>
            <StatusFilter
              statusFilter={statusFilter}
              onStatusChange={setStatusFilter}
              counts={calculateStandardStatusCounts(lengths)}
              disabled={loading}
            />
          </div>
          <div className="rightSection makeFlex end gap10">
            <SearchField
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search lengths..."
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

        {filteredLengths.length === 0 && !loading ? (
          <div className="emptyState textCenter paddingAll60">
            <div className="emptyIcon appendBottom16">📏</div>
            <h3 className="font22 fontSemiBold grayText appendBottom8">No lengths Found</h3>
            <p className="font16 grayText">Start by adding your first length above</p>
          </div>
        ) : (
          <>
            {/* Card View */}
            {viewMode === 'card' && (
              <div className="brandsGrid">
                {displayedCards.map((length) => (
                  <EntityCard
                    key={length._id || length.id}
                    entity={length}
                    logoField="image"
                    nameField="name"
                    idField="_id"
                    onEdit={length.deleted ? undefined : handleEdit}
                    onDelete={handleDelete}
                    onRevert={length.deleted ? () => handleRevert(length._id || length.id) : undefined}
                    loading={loading}
                    imagePlaceholderColor={generateEntityColor(length._id || length.id, length.name)}
                    renderHeader={(length) => (
                      <EntityCardHeader
                        entity={{
                          ...length,
                          name: `${length.name} ${getUnitAbbreviation(length.unit || 'centimeters')}`
                        }}
                        imageField="image"
                        titleField="name"
                        dateField="createdAt"
                        generateColor={generateEntityColor}
                      />
                    )}
                    renderDetails={(length) => {
                      return (
                        <>
                          <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                            <span className="detailLabel font14 fontSemiBold grayText textUppercase">length ID:</span>
                            <span className="detailValue font14 blackText appendLeft6">{length._id || 'N/A'}</span>
                          </div>
                          <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                            <span className="detailLabel font14 fontSemiBold grayText textUppercase">length:</span>
                            <span className="detailValue font14 blackText appendLeft6">
                              {length.name} {getUnitAbbreviation(length.unit || 'centimeters')}
                            </span>
                          </div>
                          {length.description && (
                            <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                              <span className="detailLabel font14 fontSemiBold grayText textUppercase">Description:</span>
                              <span className="detailValue font14 blackText appendLeft6">{length.description}</span>
                            </div>
                          )}
                          <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                            <span className="detailLabel font14 fontSemiBold grayText textUppercase">Status:</span>
                            <span className={`detailValue font14 ${length.deleted ? 'deleted' : (length.isActive ? 'greenText' : 'inactive')} appendLeft6`}>
                              {length.deleted ? 'Deleted' : (length.isActive ? 'Active' : 'Inactive')}
                            </span>
                          </div>
                        </>
                      );
                    }}
                    renderActions={(length) => (
                      <ActionButtons
                        onEdit={length.deleted ? undefined : () => handleEdit(length)}
                        onDelete={() => handleDelete(length._id || length.id)}
                        onRevert={length.deleted ? () => handleRevert(length._id || length.id) : undefined}
                        loading={loading}
                        size="normal"
                        editText="✏️ Edit"
                        deleteText={length.deleted ? "🗑️ Final Del" : "🗑️ Delete"}
                        revertText="🔄 Undelete"
                        editTitle="Edit length"
                        deleteTitle={length.deleted ? "Final Del" : "Delete length"}
                        revertTitle="Restore length"
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
                      {currentLengths.map((length) => (
                        <tr key={length._id || length.id} className="tableRow">
                          <td className="tableCell">
                            {length.image ? (
                              <img
                                src={length.image}
                                alt={length.name}
                                className="tableImage"
                                style={{ 
                                  width: '40px', 
                                  length: '40px', 
                                  objectFit: 'cover',
                                  borderRadius: '4px'
                                }}
                                onError={(e) => {
                                  console.error('Image failed to load:', length.image);
                                  e.target.style.display = 'none';
                                }}
                              />
                            ) : (
                              <div 
                                className="tableImagePlaceholder"
                                style={{
                                  width: '40px',
                                  length: '40px',
                                  backgroundColor: generateEntityColor(length._id || length.id, length.name),
                                  borderRadius: '4px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: 'white',
                                  fontSize: '12px',
                                  fontWeight: 'bold'
                                }}
                              >
                                {length.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </td>
                          <td className="tableCell">
                            <span className="brandNameText">{length.name}</span>
                          </td>
                          <td className="tableCell">
                            <span className="addressText">
                              {length.unit ? length.unit.charAt(0).toUpperCase() + length.unit.slice(1) : 'Centimeters'}
                            </span>
                          </td>
                          <td className="tableCell">
                            <span className={`statusText ${length.deleted ? 'deleted' : (length.isActive ? 'active' : 'inactive')}`}>
                              {length.deleted ? 'Deleted' : (length.isActive ? 'Active' : 'Inactive')}
                            </span>
                          </td>
                          <td className="tableCell">
                            <span className="dateText">
                              {new Date(length.createdAt).toLocaleDateString()}
                            </span>
                          </td>
                          <td className="tableCell">
                            <div className="tableActions makeFlex gap8">
                              <ActionButtons
                                onEdit={length.deleted ? undefined : () => handleEdit(length)}
                                onDelete={() => handleDelete(length._id || length.id)}
                                onRevert={length.deleted ? () => handleRevert(length._id || length.id) : undefined}
                                loading={loading}
                                size="small"
                                editText="✏️"
                                deleteText={length.deleted ? "🗑️" : "🗑️"}
                                revertText="🔄"
                                editTitle="Edit length"
                                deleteTitle={length.deleted ? "Final Del" : "Delete length"}
                                revertTitle="Restore length"
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

export default LengthManager;
