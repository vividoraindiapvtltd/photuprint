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

const HeightManager = () => {
  const [heights, setHeights] = useState([]);
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
    heightId: null,
    message: "",
    isPermanentDelete: false,
    action: "delete" // "delete" or "revert"
  });
  
  // Refs for scroll and focus functionality
  const formRef = useRef(null);
  const heightNameInputRef = useRef(null);
  const imageInputRef = useRef(null);
  
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

  // Validate height name for duplicates
  const validateHeightName = (name) => {
    if (!name || name.toString().trim() === '') {
      return { isValid: false, error: "Height value is required" };
    }
    
    // Convert to string for comparison
    const nameStr = name.toString().trim();
    
    // Check for duplicate names only against active, non-deleted heights (excluding current height being edited)
    const existingHeight = heights.find(height => 
      height.name.toString().toLowerCase().trim() === nameStr.toLowerCase() && 
      height._id !== editingId &&
      height.isActive === true && // Only check against active heights
      !height.deleted && // Exclude deleted heights
      height.unit === formData.unit // Check for same unit as well
    );
    
    if (existingHeight) {
      return { isValid: false, error: `Height value ${nameStr} with unit ${formData.unit} already exists` };
    }
    
    return { isValid: true, error: "" };
  };

  // Validate and Add / Update Height
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate height name
    const nameValidation = validateHeightName(formData.name);
    if (!nameValidation.isValid) {
      setError(nameValidation.error);
      return;
    }

    try {
      setLoading(true);
      setSuccess(""); // Clear any existing success message
      setError(""); // Clear any existing error message

      let heightData;
      
      if (formData.image) {
        // Use FormData for file upload
        heightData = new FormData();
        heightData.append('name', formData.name.trim());
        heightData.append('unit', formData.unit);
        heightData.append('description', formData.description?.trim() || '');
        heightData.append('isActive', formData.isActive ? 'true' : 'false');
        // heightData.append('image', formData.image);
      } else {
        // Use JSON for better boolean handling
        heightData = {
          name: formData.name.trim(),
          unit: formData.unit,
          description: formData.description?.trim() || '',
          isActive: formData.isActive
        };
      }

      if (editingId) {
        // Update height
        await api.put(`/heights/${editingId}`, heightData, {
          headers: formData.image ? { "Content-Type": "multipart/form-data" } : {},
        });
        setSuccess(`✅ Height "${formData.name.trim()}" has been updated successfully!`);
      } else {
        // Create height
        await api.post('/heights', heightData, {
          headers: formData.image ? { "Content-Type": "multipart/form-data" } : {},
        });
        setSuccess(`✅ Height "${formData.name.trim()}" has been created successfully!`);
      }

      // Refresh heights list
      await fetchHeights();
      
      // Reset form after successful submission (for both add and edit)
      resetForm();
      
    } catch (err) {
      if (err.response?.data?.msg === 'Height name already exists') {
        setError("❌ Height name already exists. Please choose a different name.");
      } else {
        setError(`❌ Failed to ${editingId ? 'update' : 'create'} height. ${err.response?.data?.msg || 'Please try again.'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData(initialFormData);
    setEditingId(null);
    setError("");
    // Reset file input if it exists
    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
    // Don't clear success message here - let AlertMessage handle it
    // setSuccess("");
  };

  // Clear form after successful operations
  const clearForm = () => {
    setFormData(initialFormData);
    setEditingId(null);
    setError("");
    setSuccess("");
    // Reset file input if it exists
    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
  };

  // Edit height
  const handleEdit = (height) => {
    setFormData({
      ...initialFormData,
      name: height.name || "",
      unit: height.unit || "centimeters",
      description: height.description || "",
      image: height.image || null, // Preserve existing image
      isActive: height.isActive !== undefined ? height.isActive : false
    });
    setEditingId(height._id || height.id);
    setError("");
    setSuccess("");
    
    // Scroll to form and focus on height name input
    setTimeout(() => {
      if (formRef.current) {
        formRef.current.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start' 
        });
      }
      if (heightNameInputRef.current) {
        heightNameInputRef.current.focus();
      }
    }, 100);
  };

  // Delete height
  const handleDelete = async (heightId) => {
    // Find the height to check if it's already marked as deleted
    const height = heights.find(h => h._id === heightId);
    const isAlreadyDeleted = height?.deleted;
    
    let message;
    let isPermanentDelete = false;
    
    if (isAlreadyDeleted) {
      message = "This height is already marked as deleted. Click OK to permanently remove it from the database. This action cannot be undone.";
      isPermanentDelete = true;
    } else {
      message = "This will mark the height as inactive and add a deleted flag. Click OK to continue.";
      isPermanentDelete = false;
    }
    
    setDeletePopup({
      isVisible: true,
      heightId,
      message,
      isPermanentDelete,
      action: "delete"
    });
  };

  // Handle delete confirmation
  const handleDeleteConfirm = async () => {
    const { heightId, isPermanentDelete } = deletePopup;
    const height = heights.find(h => h._id === heightId);
    
    try {
      setLoading(true);
      setSuccess(""); // Clear any existing success message
      setError(""); // Clear any existing error message
      
      if (isPermanentDelete) {
        // Permanent deletion
        await api.delete(`/heights/${heightId}/hard`);
        setSuccess(`🗑️ Height "${height.name}" has been permanently deleted from the database.`);
      } else {
        // Soft delete - mark as inactive and add deleted flag
        await api.delete(`/heights/${heightId}`);
        setSuccess(`⏸️ Height "${height.name}" has been marked as deleted and inactive.`);
      }
      
      await fetchHeights();
    } catch (err) {
      const action = isPermanentDelete ? "permanently delete" : "mark as deleted";
      setError(`❌ Failed to ${action} height "${height.name}". ${err.response?.data?.msg || 'Please try again.'}`);
    } finally {
      setLoading(false);
      setDeletePopup({
        isVisible: false,
        heightId: null,
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
      heightId: null,
      message: "",
      isPermanentDelete: false,
      action: "delete"
    });
  };

  // Revert deleted height
  const handleRevert = async (heightId) => {
    const height = heights.find(h => h._id === heightId);
    
    if (!height) {
      setError("Height not found");
      return;
    }

    if (!height.deleted) {
      setError("This height is not deleted");
      return;
    }

    setDeletePopup({
      isVisible: true,
      heightId,
      message: `Are you sure you want to restore the height "${height.name}"? This will make it active again.`,
      isPermanentDelete: false,
      action: "revert"
    });
  };

  // Handle revert confirmation
  const handleRevertConfirm = async () => {
    const { heightId } = deletePopup;
    const height = heights.find(h => h._id === heightId);
    
    try {
      setLoading(true);
      setSuccess("");
      setError("");

      // Check if there's already an active or inactive height with the same name
      const existingHeight = heights.find(h => 
        h._id !== heightId && // Exclude current height being reverted
        h.name.toLowerCase().trim() === height.name.toLowerCase().trim() && // Same name
        !h.deleted // Not deleted (active or inactive)
      );

      if (existingHeight) {
        const status = existingHeight.isActive ? 'Active' : 'Inactive';
        const suggestion = existingHeight.isActive ? 
          `Consider deleting the active height "${existingHeight.name}" first, or use a different name for the restored height.` :
          `Consider deleting the inactive height "${existingHeight.name}" first, or use a different name for the restored height.`;
        
        setError(`❌ Cannot restore height "${height.name}". A ${status.toLowerCase()} height with this name already exists. ${suggestion}`);
        setLoading(false);
        setDeletePopup({
          isVisible: false,
          heightId: null,
          message: "",
          isPermanentDelete: false,
          action: "delete"
        });
        return;
      }

      // Revert the height by setting deleted to false and isActive to true
      await api.put(`/heights/${heightId}`, {
        name: height.name,
        unit: height.unit || "centimeters",
        description: height.description || '',
        isActive: true,
        deleted: false
      });

      setSuccess(`✅ Height "${height.name}" has been restored and is now active!`);
      await fetchHeights();
    } catch (err) {
      setError(`❌ Failed to restore height "${height.name}". ${err.response?.data?.msg || 'Please try again.'}`);
    } finally {
      setLoading(false);
      setDeletePopup({
        isVisible: false,
        heightId: null,
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
      heightId: null,
      message: "",
      isPermanentDelete: false,
      action: "delete"
    });
  };

  // Fetch heights from backend
  const fetchHeights = async () => {
    try {
      setLoading(true);
      const response = await api.get('/heights?showInactive=true&includeDeleted=true');
      
      // Process heights to ensure proper image URLs
      const processedHeights = response.data.map(height => {
        let imageUrl = height.image;
        
        // If image is a relative path, construct full URL
        if (imageUrl && !imageUrl.startsWith('http')) {
          // Check if it's a local upload path
          if (imageUrl.startsWith('/uploads/')) {
            imageUrl = `${imageUrl}`;
          }
        }
        
        return {
          ...height,
          image: imageUrl
        };
      });
      
      setHeights(processedHeights);
      setError("");
    } catch (err) {
      setError("Failed to fetch heights");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHeights();
  }, []);

  // Filter heights based on search query and status
  const filteredHeights = useMemo(() => {
    let filtered = heights;
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(height => 
        height.name.toLowerCase().includes(query) ||
        (height.unit && height.unit.toLowerCase().includes(query)) ||
        (height.description && height.description.toLowerCase().includes(query))
      );
    }
    
    // Apply status filter
    filtered = filterEntitiesByStatus(filtered, statusFilter);
    
    return filtered;
  }, [heights, searchQuery, statusFilter]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredHeights.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentHeights = filteredHeights.slice(startIndex, endIndex);

  // Card lazy loading logic
  useEffect(() => {
    if (viewMode === 'card') {
      const initialCards = filteredHeights.slice(0, 12);
      setDisplayedCards(initialCards);
      setHasMoreCards(filteredHeights.length > 12);
      setCurrentPage(1);
    }
  }, [viewMode, filteredHeights]);

  // Reset pagination when search query changes
  const resetPaginationForSearch = useCallback(() => {
    setCurrentPage(1);
    if (viewMode === 'card') {
      const initialCards = filteredHeights.slice(0, 12);
      setDisplayedCards(initialCards);
      setHasMoreCards(filteredHeights.length > 12);
    }
  }, [viewMode, filteredHeights.length]);

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
      const nextCards = filteredHeights.slice(currentCardCount, currentCardCount + 12);
      
      if (nextCards.length > 0) {
        setHasMoreCards(currentCardCount + nextCards.length < filteredHeights.length);
        return [...prevCards, ...nextCards];
      } else {
        setHasMoreCards(false);
        return prevCards;
      }
    });
  }, [filteredHeights]);

  // Reset pagination when view mode changes
  const handleViewModeChange = useCallback((mode) => {
    setViewMode(mode);
    setCurrentPage(1);
    if (mode === 'card') {
      const initialCards = filteredHeights.slice(0, 12);
      setDisplayedCards(initialCards);
      setHasMoreCards(filteredHeights.length > 12);
    }
  }, [filteredHeights.length]);

  const handleCancel = () => {
    resetForm();
  };

  return (
    <div className="paddingAll20">
      {/* Header */}
      <PageHeader
        title="Height Management"
        subtitle="Manage your product heights and classifications"
        isEditing={!!editingId}
        editText="Edit Height"
        createText="Add New Height"
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
                ref={heightNameInputRef}
                type="number"
                name="name"
                label="Height Value"
                value={formData.name}
                onChange={handleChange}
                placeholder="Enter Height Value (e.g., 50)"
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
                placeholder="Enter Height Description"
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
              <p className="negativeMarginTop10">Check this box to keep the height active, uncheck to mark as inactive</p>
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
                <span>{editingId ? "Update Height" : "Add Height"}</span>
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
                Add Another Height
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Heights List */}
      <div className="brandsListContainer paddingAll32">
        <div className="listHeader makeFlex spaceBetween end appendBottom24">
          <div className="leftSection">
            <h2 className="listTitle font30 fontBold blackText appendBottom16">Heights ({filteredHeights.length})</h2>
            <StatusFilter
              statusFilter={statusFilter}
              onStatusChange={setStatusFilter}
              counts={calculateStandardStatusCounts(heights)}
              disabled={loading}
            />
          </div>
          <div className="rightSection makeFlex end gap10">
            <SearchField
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search heights..."
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

        {filteredHeights.length === 0 && !loading ? (
          <div className="emptyState textCenter paddingAll60">
            <div className="emptyIcon appendBottom16">📏</div>
            <h3 className="font22 fontSemiBold grayText appendBottom8">No Heights Found</h3>
            <p className="font16 grayText">Start by adding your first height above</p>
          </div>
        ) : (
          <>
            {/* Card View */}
            {viewMode === 'card' && (
              <div className="brandsGrid">
                {displayedCards.map((height) => (
                  <EntityCard
                    key={height._id || height.id}
                    entity={height}
                    logoField="image"
                    nameField="name"
                    idField="_id"
                    onEdit={height.deleted ? undefined : handleEdit}
                    onDelete={handleDelete}
                    onRevert={height.deleted ? () => handleRevert(height._id || height.id) : undefined}
                    loading={loading}
                    imagePlaceholderColor={generateEntityColor(height._id || height.id, height.name)}
                    renderHeader={(height) => (
                      <EntityCardHeader
                        entity={{
                          ...height,
                          name: `${height.name} ${getUnitAbbreviation(height.unit || 'centimeters')}`
                        }}
                        imageField="image"
                        titleField="name"
                        dateField="createdAt"
                        generateColor={generateEntityColor}
                      />
                    )}
                    renderDetails={(height) => {
                      return (
                        <>
                          <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                            <span className="detailLabel font14 fontSemiBold grayText textUppercase">Height ID:</span>
                            <span className="detailValue font14 blackText appendLeft6">{height._id || 'N/A'}</span>
                          </div>
                          <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                            <span className="detailLabel font14 fontSemiBold grayText textUppercase">Height:</span>
                            <span className="detailValue font14 blackText appendLeft6">
                              {height.name} {getUnitAbbreviation(height.unit || 'centimeters')}
                            </span>
                          </div>
                          {height.description && (
                            <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                              <span className="detailLabel font14 fontSemiBold grayText textUppercase">Description:</span>
                              <span className="detailValue font14 blackText appendLeft6">{height.description}</span>
                            </div>
                          )}
                          <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                            <span className="detailLabel font14 fontSemiBold grayText textUppercase">Status:</span>
                            <span className={`detailValue font14 ${height.deleted ? 'deleted' : (height.isActive ? 'greenText' : 'inactive')} appendLeft6`}>
                              {height.deleted ? 'Deleted' : (height.isActive ? 'Active' : 'Inactive')}
                            </span>
                          </div>
                        </>
                      );
                    }}
                    renderActions={(height) => (
                      <ActionButtons
                        onEdit={height.deleted ? undefined : () => handleEdit(height)}
                        onDelete={() => handleDelete(height._id || height.id)}
                        onRevert={height.deleted ? () => handleRevert(height._id || height.id) : undefined}
                        loading={loading}
                        size="normal"
                        editText="✏️ Edit"
                        deleteText={height.deleted ? "🗑️ Final Del" : "🗑️ Delete"}
                        revertText="🔄 Undelete"
                        editTitle="Edit Height"
                        deleteTitle={height.deleted ? "Final Del" : "Delete Height"}
                        revertTitle="Restore Height"
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
                      {currentHeights.map((height) => (
                        <tr key={height._id || height.id} className="tableRow">
                          <td className="tableCell">
                            {height.image ? (
                              <img
                                src={height.image}
                                alt={height.name}
                                className="tableImage"
                                style={{ 
                                  width: '40px', 
                                  height: '40px', 
                                  objectFit: 'cover',
                                  borderRadius: '4px'
                                }}
                                onError={(e) => {
                                  console.error('Image failed to load:', height.image);
                                  e.target.style.display = 'none';
                                }}
                              />
                            ) : (
                              <div 
                                className="tableImagePlaceholder"
                                style={{
                                  width: '40px',
                                  height: '40px',
                                  backgroundColor: generateEntityColor(height._id || height.id, height.name),
                                  borderRadius: '4px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: 'white',
                                  fontSize: '12px',
                                  fontWeight: 'bold'
                                }}
                              >
                                {height.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </td>
                          <td className="tableCell">
                            <span className="brandNameText">{height.name}</span>
                          </td>
                          <td className="tableCell">
                            <span className="addressText">
                              {height.unit ? height.unit.charAt(0).toUpperCase() + height.unit.slice(1) : 'Centimeters'}
                            </span>
                          </td>
                          <td className="tableCell">
                            <span className={`statusText ${height.deleted ? 'deleted' : (height.isActive ? 'active' : 'inactive')}`}>
                              {height.deleted ? 'Deleted' : (height.isActive ? 'Active' : 'Inactive')}
                            </span>
                          </td>
                          <td className="tableCell">
                            <span className="dateText">
                              {new Date(height.createdAt).toLocaleDateString()}
                            </span>
                          </td>
                          <td className="tableCell">
                            <div className="tableActions makeFlex gap8">
                              <ActionButtons
                                onEdit={height.deleted ? undefined : () => handleEdit(height)}
                                onDelete={() => handleDelete(height._id || height.id)}
                                onRevert={height.deleted ? () => handleRevert(height._id || height.id) : undefined}
                                loading={loading}
                                size="small"
                                editText="✏️"
                                deleteText={height.deleted ? "🗑️" : "🗑️"}
                                revertText="🔄"
                                editTitle="Edit Height"
                                deleteTitle={height.deleted ? "Final Del" : "Delete Height"}
                                revertTitle="Restore Height"
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

export default HeightManager;
