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

const CapacityManager = () => {
  const [capacities, setCapacities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [viewMode, setViewMode] = useState('card'); // 'card' or 'list'
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'active', 'inactive', 'deleted'
  
  // Delete confirmation popup state
  const [deletePopup, setDeletePopup] = useState({
    isVisible: false,
    capacityId: null,
    message: "",
    isPermanentDelete: false,
    action: "delete" // "delete" or "revert"
  });
  
  // Refs for scroll and focus functionality
  const formRef = useRef(null);
  const capacityNameInputRef = useRef(null);
  
  // Pagination and lazy loading states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10); // For list view
  const [hasMoreCards, setHasMoreCards] = useState(true);
  const [displayedCards, setDisplayedCards] = useState([]);
  
  const initialFormData = {
    name: "",
    description: "",
    isActive: false
  };

  const [formData, setFormData] = useState(initialFormData);
  const [searchQuery, setSearchQuery] = useState(""); // Search query state

  // Validate capacity name for duplicates
  const validateCapacityName = (name) => {
    if (!name || !name.trim()) {
      return { isValid: false, error: "Capacity Name is required" };
    }
    
    // Check for duplicate names only against active, non-deleted capacities (excluding current capacity being edited)
    const existingCapacity = capacities.find(capacity => 
      capacity.name.toLowerCase().trim() === name.toLowerCase().trim() && 
      capacity._id !== editingId &&
      capacity.isActive === true && // Only check against active capacities
      !capacity.deleted // Exclude deleted capacities
    );
    
    if (existingCapacity) {
      return { isValid: false, error: "Capacity name already exists" };
    }
    
    return { isValid: true, error: "" };
  };

  // Fetch capacities from backend
  const fetchCapacities = async () => {
    try {
      setLoading(true);
      const response = await api.get('/capacities?showInactive=true&includeDeleted=true');
      setCapacities(response.data);
      setError("");
    } catch (err) {
      setError("Failed to fetch capacities");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCapacities();
  }, []);

  // Filter capacities based on search query and status - memoized to prevent infinite loops
  const filteredCapacities = useMemo(() => {
    let filtered = capacities;
    
    // Apply search filter
    if (searchQuery && searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(capacity => 
        capacity.name.toLowerCase().includes(query) ||
        (capacity.description && capacity.description.toLowerCase().includes(query))
      );
    }
    
    // Apply status filter
    filtered = filterEntitiesByStatus(filtered, statusFilter);
    
    return filtered;
  }, [capacities, searchQuery, statusFilter]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredCapacities.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentCapacities = filteredCapacities.slice(startIndex, endIndex);

  // Card lazy loading logic
  useEffect(() => {
    if (viewMode === 'card' && filteredCapacities.length > 0) {
      const initialCards = filteredCapacities.slice(0, 12);
      setDisplayedCards(initialCards);
      setHasMoreCards(filteredCapacities.length > 12);
      setCurrentPage(1);
    }
  }, [filteredCapacities, viewMode]);

  // Reset pagination when search query changes
  const resetPaginationForSearch = useCallback(() => {
    setCurrentPage(1);
    if (viewMode === 'card') {
      const initialCards = filteredCapacities.slice(0, 12);
      setDisplayedCards(initialCards);
      setHasMoreCards(filteredCapacities.length > 12);
    }
  }, [viewMode, filteredCapacities.length]);

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
      const nextCards = filteredCapacities.slice(currentCardCount, currentCardCount + 12);
      
      if (nextCards.length > 0) {
        setHasMoreCards(currentCardCount + nextCards.length < filteredCapacities.length);
        return [...prevCards, ...nextCards];
      } else {
        setHasMoreCards(false);
        return prevCards;
      }
    });
  }, [filteredCapacities]);

  // Reset pagination when view mode changes
  const handleViewModeChange = useCallback((mode) => {
    setViewMode(mode);
    setCurrentPage(1);
    if (mode === 'card') {
      const initialCards = filteredCapacities.slice(0, 12);
      setDisplayedCards(initialCards);
      setHasMoreCards(filteredCapacities.length > 12);
    }
  }, [filteredCapacities.length]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (type === 'checkbox') {
      setFormData({ ...formData, [name]: checked });
    } else {
      setFormData({ ...formData, [name]: value });
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

  // Validate and Add / Update Capacity
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate capacity name
    const nameValidation = validateCapacityName(formData.name);
    if (!nameValidation.isValid) {
      setError(nameValidation.error);
      return;
    }

    try {
      setLoading(true);
      setSuccess(""); // Clear any existing success message
      setError(""); // Clear any existing error message

      const capacityData = {
        name: formData.name.trim(),
        description: formData.description?.trim() || '',
        isActive: formData.isActive
      };

      if (editingId) {
        // Update capacity
        await api.put(`/capacities/${editingId}`, capacityData);
        setSuccess(`✅ Capacity "${capacityData.name}" has been updated successfully!`);
      } else {
        // Create capacity
        await api.post('/capacities', capacityData);
        setSuccess(`✅ Capacity "${capacityData.name}" has been created successfully!`);
      }

      // Refresh capacities list
      await fetchCapacities();
      
      // Reset form after successful submission (for both add and edit)
      resetForm();
      
    } catch (err) {
      if (err.response?.data?.msg?.includes('already exists')) {
        setError(`❌ ${err.response.data.msg}`);
      } else {
        setError(`❌ Failed to ${editingId ? 'update' : 'create'} capacity. ${err.response?.data?.msg || 'Please try again.'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (capacity) => {
    setFormData({
      ...initialFormData,
      name: capacity.name || "",
      description: capacity.description || "",
      isActive: capacity.isActive !== undefined ? capacity.isActive : false
    });
    setEditingId(capacity._id || capacity.id);
    setError("");
    setSuccess("");
    
    // Scroll to form and focus on capacity name input
    setTimeout(() => {
      if (formRef.current) {
        formRef.current.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start' 
        });
      }
      if (capacityNameInputRef.current) {
        capacityNameInputRef.current.focus();
      }
    }, 100);
  };

  const handleDelete = (capacityId) => {
    // Find the capacity to check if it's already marked as deleted
    const capacity = capacities.find(f => f._id === capacityId);
    const isAlreadyDeleted = capacity?.deleted;
    
    let message;
    let isPermanentDelete = false;
    
    if (isAlreadyDeleted) {
      message = "This capacity is already marked as deleted. Click OK to permanently remove it from the database. This action cannot be undone.";
      isPermanentDelete = true;
    } else {
      message = "This will mark the capacity as inactive and add a deleted flag. Click OK to continue.";
      isPermanentDelete = false;
    }
    
    setDeletePopup({
      isVisible: true,
      capacityId,
      message,
      isPermanentDelete,
      action: "delete"
    });
  };

  // Handle delete confirmation
  const handleDeleteConfirm = async () => {
    const { capacityId, isPermanentDelete } = deletePopup;
    const capacity = capacities.find(f => f._id === capacityId);
    
    try {
      setLoading(true);
      setSuccess(""); // Clear any existing success message
      setError(""); // Clear any existing error message
      
      if (isPermanentDelete) {
        // Permanent deletion
        await api.delete(`/capacities/${capacityId}/hard`);
        setSuccess(`🗑️ Capacity "${capacity.name}" has been permanently deleted from the database.`);
      } else {
        // Soft delete - mark as inactive and add deleted flag
        await api.delete(`/capacities/${capacityId}`);
        setSuccess(`⏸️ Capacity "${capacity.name}" has been marked as deleted and inactive.`);
      }
      
      await fetchCapacities();
    } catch (err) {
      const action = isPermanentDelete ? "permanently delete" : "mark as deleted";
      setError(`❌ Failed to ${action} capacity "${capacity.name}". ${err.response?.data?.msg || 'Please try again.'}`);
    } finally {
      setLoading(false);
      setDeletePopup({
        isVisible: false,
        capacityId: null,
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
      capacityId: null,
      message: "",
      isPermanentDelete: false,
      action: "delete"
    });
  };

  // Revert deleted capacity
  const handleRevert = async (capacityId) => {
    const capacity = capacities.find(f => f._id === capacityId);
    
    if (!capacity) {
      setError("Capacity not found");
      return;
    }

    if (!capacity.deleted) {
      setError("This capacity is not deleted");
      return;
    }

    setDeletePopup({
      isVisible: true,
      capacityId,
      message: `Are you sure you want to restore the capacity "${capacity.name}"? This will make it active again.`,
      isPermanentDelete: false,
      action: "revert"
    });
  };

  // Handle revert confirmation
  const handleRevertConfirm = async () => {
    const { capacityId } = deletePopup;
    const capacity = capacities.find(f => f._id === capacityId);
    
    try {
      setLoading(true);
      setSuccess("");
      setError("");

      // Check if there's already an active or inactive capacity with the same name
      const existingCapacity = capacities.find(f => 
        f._id !== capacityId && // Exclude current capacity being reverted
        f.name.toLowerCase().trim() === capacity.name.toLowerCase().trim() && // Same name
        !f.deleted // Not deleted (active or inactive)
      );

      if (existingCapacity) {
        const status = existingCapacity.isActive ? 'Active' : 'Inactive';
        const suggestion = existingCapacity.isActive ? 
          `Consider deleting the active capacity "${existingCapacity.name}" first, or use a different name for the restored capacity.` :
          `Consider deleting the inactive capacity "${existingCapacity.name}" first, or use a different name for the restored capacity.`;
        
        setError(`❌ Cannot restore capacity "${capacity.name}". A ${status.toLowerCase()} capacity with this name already exists. ${suggestion}`);
        setLoading(false);
        setDeletePopup({
          isVisible: false,
          capacityId: null,
          message: "",
          isPermanentDelete: false,
          action: "delete"
        });
        return;
      }

      // Revert the capacity by setting deleted to false and isActive to true
      await api.put(`/capacities/${capacityId}`, {
        name: capacity.name,
        description: capacity.description || '',
        isActive: true,
        deleted: false
      });

      setSuccess(`✅ Capacity "${capacity.name}" has been restored and is now active!`);
      await fetchCapacities();
    } catch (err) {
      setError(`❌ Failed to restore capacity "${capacity.name}". ${err.response?.data?.msg || 'Please try again.'}`);
    } finally {
      setLoading(false);
      setDeletePopup({
        isVisible: false,
        capacityId: null,
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
      capacityId: null,
      message: "",
      isPermanentDelete: false,
      action: "delete"
    });
  };

  const handleCancel = () => {
    resetForm();
  };


  return (
    <div className="paddingAll20">
      {/* Header */}
      <PageHeader
        title="Capacity Management"
        subtitle="Manage capacity options for products (e.g. volume)"
        isEditing={!!editingId}
        editText="Edit Capacity"
        createText="Add New Capacity"
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

      {/* Capacity Form */}
      <div className="brandFormContainer paddingAll32 appendBottom30" ref={formRef}>
        <form onSubmit={handleSubmit} className="brandForm">
          <div className="makeFlex row gap10">
            <div className="fullWidth">
              <FormField
                ref={capacityNameInputRef}
                type="text"
                name="name"
                label="Capacity Name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Enter capacity label (e.g., 500 ml)"
                required={true}
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
                placeholder="Enter Capacity Description"
                rows={3}
              />
            </div>
          </div>

          <div className="makeFlex row gap10">
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
              <p className="negativeMarginTop10">Check this box to keep the capacity active, uncheck to mark as inactive</p>
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
                <span>{editingId ? "Update Capacity" : "Add Capacity"}</span>
              )}
            </button>
            
            {(editingId || (!editingId && (formData.name || formData.description))) && (
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
                Add Another Capacity
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Capacitys List */}
      <div className="brandsListContainer paddingAll32">
        <div className="listHeader makeFlex spaceBetween end appendBottom24">
          <div className="leftSection">
            <h2 className="listTitle font30 fontBold blackText appendBottom16">Capacitys ({filteredCapacities?.length || 0})</h2>
            <StatusFilter
              statusFilter={statusFilter}
              onStatusChange={setStatusFilter}
              counts={calculateStandardStatusCounts(capacities)}
              disabled={loading}
            />
          </div>
          <div className="rightSection makeFlex end gap10">
            <SearchField
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search capacities..."
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

        {filteredCapacities.length === 0 && !loading ? (
          <div className="emptyState textCenter paddingAll60">
            <div className="emptyIcon appendBottom16">📦</div>
            <h3 className="font22 fontSemiBold grayText appendBottom8">No Capacitys Found</h3>
            <p className="font16 grayText">Start by adding your first capacity above</p>
          </div>
        ) : (
          <>
            {/* Card View */}
            {viewMode === 'card' && (
              <div className="brandsGrid">
                {displayedCards.map((capacity) => (
                    <EntityCard
                      key={capacity._id || capacity.id}
                      entity={capacity}
                      logoField="image"
                      nameField="name"
                      idField="_id"
                      onEdit={capacity.deleted ? undefined : handleEdit}
                      onDelete={handleDelete}
                      onRevert={capacity.deleted ? () => handleRevert(capacity._id || capacity.id) : undefined}
                      loading={loading}
                      imagePlaceholderColor={generateEntityColor(capacity._id || capacity.id, capacity.name)}
                      renderHeader={(capacity) => (
                        <EntityCardHeader
                          entity={capacity}
                          imageField="image"
                          titleField="name"
                          dateField="createdAt"
                          generateColor={generateEntityColor}
                        />
                      )}
                      renderDetails={(capacity) => {
                        return (
                          <>
                            <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                              <span className="detailLabel font14 fontSemiBold grayText textUppercase">Capacity ID:</span>
                              <span className="detailValue font14 blackText appendLeft6">{capacity._id || 'N/A'}</span>
                            </div>
                            <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                              <span className="detailLabel font14 fontSemiBold grayText textUppercase">Name:</span>
                              <span className="detailValue font14 blackText appendLeft6">{capacity.name}</span>
                            </div>
                            {capacity.description && (
                              <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                                <span className="detailLabel font14 fontSemiBold grayText textUppercase">Description:</span>
                                <span className="detailValue font14 blackText appendLeft6">{capacity.description}</span>
                              </div>
                            )}
                            <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                              <span className="detailLabel font14 fontSemiBold grayText textUppercase">Status:</span>
                              <span className={`detailValue font14 ${capacity.deleted ? 'deleted' : (capacity.isActive ? 'greenText' : 'inactive')} appendLeft6`}>
                                {capacity.deleted ? 'Deleted' : (capacity.isActive ? 'Active' : 'Inactive')}
                              </span>
                            </div>
                          </>
                        );
                      }}
                      renderActions={(capacity) => (
                        <ActionButtons
                          onEdit={capacity.deleted ? undefined : () => handleEdit(capacity)}
                          onDelete={() => handleDelete(capacity._id || capacity.id)}
                          onRevert={capacity.deleted ? () => handleRevert(capacity._id || capacity.id) : undefined}
                          loading={loading}
                          size="normal"
                          editText="✏️ Edit"
                          deleteText={capacity.deleted ? "🗑️ Final Del" : "🗑️ Delete"}
                          revertText="🔄 Undelete"
                          editTitle="Edit Capacity"
                          deleteTitle={capacity.deleted ? "Final Del" : "Delete Capacity"}
                          revertTitle="Restore Capacity"
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
                        <th className="tableHeader">Name</th>
                        <th className="tableHeader">Description</th>
                        <th className="tableHeader">Status</th>
                        <th className="tableHeader">Created</th>
                        <th className="tableHeader">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentCapacities.map((capacity) => (
                        <tr key={capacity._id || capacity.id} className="tableRow">
                          <td className="tableCell">
                            <span className="brandNameText">{capacity.name}</span>
                          </td>
                          <td className="tableCell">
                            <span className="addressText" title={capacity.description}>
                              {capacity.description ? (capacity.description.length > 30 ? `${capacity.description.substring(0, 30)}...` : capacity.description) : '-'}
                            </span>
                          </td>
                          <td className="tableCell">
                            <span className={`statusText ${capacity.deleted ? 'deleted' : (capacity.isActive ? 'active' : 'inactive')}`}>
                              {capacity.deleted ? 'Deleted' : (capacity.isActive ? 'Active' : 'Inactive')}
                            </span>
                          </td>
                          <td className="tableCell">
                            <span className="dateText">
                              {new Date(capacity.createdAt).toLocaleDateString()}
                            </span>
                          </td>
                          <td className="tableCell">
                            <div className="tableActions makeFlex gap8">
                              <ActionButtons
                                onEdit={capacity.deleted ? undefined : () => handleEdit(capacity)}
                                onDelete={() => handleDelete(capacity._id || capacity.id)}
                                onRevert={capacity.deleted ? () => handleRevert(capacity._id || capacity.id) : undefined}
                                loading={loading}
                                size="small"
                                editText="✏️"
                                deleteText={capacity.deleted ? "🗑️" : "🗑️"}
                                revertText="🔄"
                                editTitle="Edit Capacity"
                                deleteTitle={capacity.deleted ? "Final Del" : "Delete Capacity"}
                                revertTitle="Restore Capacity"
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

export default CapacityManager;
