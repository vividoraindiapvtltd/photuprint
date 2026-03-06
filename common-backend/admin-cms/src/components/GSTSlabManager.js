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

const GSTSlabManager = () => {
  const [gstSlabs, setGstSlabs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [viewMode, setViewMode] = useState('card'); // 'card' or 'list'
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'active', 'inactive', 'deleted'
  
  // Delete confirmation popup state
  const [deletePopup, setDeletePopup] = useState({
    isVisible: false,
    gstSlabId: null,
    message: "",
    isPermanentDelete: false,
    action: "delete" // "delete" or "revert"
  });
  
  // Refs for scroll and focus functionality
  const formRef = useRef(null);
  const gstSlabNameInputRef = useRef(null);
  
  // Pagination and lazy loading states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10); // For list view
  const [hasMoreCards, setHasMoreCards] = useState(true);
  const [displayedCards, setDisplayedCards] = useState([]);
  
  const initialFormData = {
    name: "",
    rate: "",
    description: "",
    isActive: false
  };

  const [formData, setFormData] = useState(initialFormData);
  const [searchQuery, setSearchQuery] = useState(""); // Search query state

  // Validate GST slab for duplicates
  const validateGstSlab = () => {
    if (!formData.name || !formData.name.trim()) {
      return { isValid: false, error: "GST Slab name is required" };
    }
    
    if (!formData.rate || formData.rate === '' || formData.rate === null) {
      return { isValid: false, error: "GST rate is required" };
    }

    const rateNum = Number(formData.rate);
    if (isNaN(rateNum) || rateNum < 0 || rateNum > 100) {
      return { isValid: false, error: "GST rate must be a number between 0 and 100" };
    }

    // Check for duplicate rates only against active, non-deleted GST slabs (excluding current GST slab being edited)
    const existingGstSlab = gstSlabs.find(gstSlab => 
      Number(gstSlab.rate) === rateNum && 
      gstSlab._id !== editingId &&
      gstSlab.isActive === true && // Only check against active GST slabs
      !gstSlab.deleted // Exclude deleted GST slabs
    );
    
    if (existingGstSlab) {
      return { isValid: false, error: `GST slab with rate ${rateNum}% already exists` };
    }
    
    return { isValid: true, error: "" };
  };

  // Fetch GST slabs from backend
  const fetchGstSlabs = async () => {
    try {
      setLoading(true);
      const response = await api.get('/gst-slabs?showInactive=true&includeDeleted=true');
      setGstSlabs(response.data);
      setError("");
    } catch (err) {
      setError("Failed to fetch GST slabs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGstSlabs();
  }, []);

  // Filter GST slabs based on search query and status - memoized to prevent infinite loops
  const filteredGstSlabs = useMemo(() => {
    let filtered = gstSlabs;
    
    // Apply search filter
    if (searchQuery && searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(gstSlab => 
        gstSlab.name.toLowerCase().includes(query) ||
        gstSlab.rate.toString().includes(query) ||
        (gstSlab.description && gstSlab.description.toLowerCase().includes(query))
      );
    }
    
    // Apply status filter
    filtered = filterEntitiesByStatus(filtered, statusFilter);
    
    return filtered;
  }, [gstSlabs, searchQuery, statusFilter]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredGstSlabs.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentGstSlabs = filteredGstSlabs.slice(startIndex, endIndex);

  // Card lazy loading logic
  useEffect(() => {
    if (viewMode === 'card' && filteredGstSlabs.length > 0) {
      const initialCards = filteredGstSlabs.slice(0, 12);
      setDisplayedCards(initialCards);
      setHasMoreCards(filteredGstSlabs.length > 12);
      setCurrentPage(1);
    }
  }, [filteredGstSlabs, viewMode]);

  // Reset pagination when search query changes
  const resetPaginationForSearch = useCallback(() => {
    setCurrentPage(1);
    if (viewMode === 'card') {
      const initialCards = filteredGstSlabs.slice(0, 12);
      setDisplayedCards(initialCards);
      setHasMoreCards(filteredGstSlabs.length > 12);
    }
  }, [viewMode, filteredGstSlabs.length]);

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
      const nextCards = filteredGstSlabs.slice(currentCardCount, currentCardCount + 12);
      
      if (nextCards.length > 0) {
        setHasMoreCards(currentCardCount + nextCards.length < filteredGstSlabs.length);
        return [...prevCards, ...nextCards];
      } else {
        setHasMoreCards(false);
        return prevCards;
      }
    });
  }, [filteredGstSlabs]);

  // Reset pagination when view mode changes
  const handleViewModeChange = useCallback((mode) => {
    setViewMode(mode);
    setCurrentPage(1);
    if (mode === 'card') {
      const initialCards = filteredGstSlabs.slice(0, 12);
      setDisplayedCards(initialCards);
      setHasMoreCards(filteredGstSlabs.length > 12);
    }
  }, [filteredGstSlabs.length]);

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

  // Validate and Add / Update GST Slab
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate GST slab
    const validation = validateGstSlab();
    if (!validation.isValid) {
      setError(validation.error);
      return;
    }

    try {
      setLoading(true);
      setSuccess(""); // Clear any existing success message
      setError(""); // Clear any existing error message

      const gstSlabData = {
        name: formData.name.trim(),
        rate: Number(formData.rate),
        description: formData.description?.trim() || '',
        isActive: formData.isActive
      };

      if (editingId) {
        // Update GST slab
        await api.put(`/gst-slabs/${editingId}`, gstSlabData);
        setSuccess(`✅ GST Slab "${gstSlabData.name}" has been updated successfully!`);
      } else {
        // Create GST slab
        await api.post('/gst-slabs', gstSlabData);
        setSuccess(`✅ GST Slab "${gstSlabData.name}" has been created successfully!`);
      }

      // Refresh GST slabs list
      await fetchGstSlabs();
      
      // Reset form after successful submission (for both add and edit)
      resetForm();
      
    } catch (err) {
      if (err.response?.data?.msg?.includes('already exists')) {
        setError(`❌ ${err.response.data.msg}`);
      } else {
        setError(`❌ Failed to ${editingId ? 'update' : 'create'} GST slab. ${err.response?.data?.msg || 'Please try again.'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (gstSlab) => {
    setFormData({
      ...initialFormData,
      name: gstSlab.name || "",
      rate: gstSlab.rate?.toString() || "",
      description: gstSlab.description || "",
      isActive: gstSlab.isActive !== undefined ? gstSlab.isActive : false
    });
    setEditingId(gstSlab._id || gstSlab.id);
    setError("");
    setSuccess("");
    
    // Scroll to form and focus on GST slab name input
    setTimeout(() => {
      if (formRef.current) {
        formRef.current.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start' 
        });
      }
      if (gstSlabNameInputRef.current) {
        gstSlabNameInputRef.current.focus();
      }
    }, 100);
  };

  const handleDelete = (gstSlabId) => {
    // Find the GST slab to check if it's already marked as deleted
    const gstSlab = gstSlabs.find(g => g._id === gstSlabId);
    const isAlreadyDeleted = gstSlab?.deleted;
    
    let message;
    let isPermanentDelete = false;
    
    if (isAlreadyDeleted) {
      message = "This GST slab is already marked as deleted. Click OK to permanently remove it from the database. This action cannot be undone.";
      isPermanentDelete = true;
    } else {
      message = "This will mark the GST slab as inactive and add a deleted flag. Click OK to continue.";
      isPermanentDelete = false;
    }
    
    setDeletePopup({
      isVisible: true,
      gstSlabId,
      message,
      isPermanentDelete,
      action: "delete"
    });
  };

  // Handle delete confirmation
  const handleDeleteConfirm = async () => {
    const { gstSlabId, isPermanentDelete } = deletePopup;
    const gstSlab = gstSlabs.find(g => g._id === gstSlabId);
    
    try {
      setLoading(true);
      setSuccess(""); // Clear any existing success message
      setError(""); // Clear any existing error message
      
      if (isPermanentDelete) {
        // Permanent deletion
        await api.delete(`/gst-slabs/${gstSlabId}/hard`);
        setSuccess(`🗑️ GST Slab "${gstSlab.name}" has been permanently deleted from the database.`);
      } else {
        // Soft delete - mark as inactive and add deleted flag
        await api.delete(`/gst-slabs/${gstSlabId}`);
        setSuccess(`⏸️ GST Slab "${gstSlab.name}" has been marked as deleted and inactive.`);
      }
      
      await fetchGstSlabs();
    } catch (err) {
      const action = isPermanentDelete ? "permanently delete" : "mark as deleted";
      setError(`❌ Failed to ${action} GST slab "${gstSlab.name}". ${err.response?.data?.msg || 'Please try again.'}`);
    } finally {
      setLoading(false);
      setDeletePopup({
        isVisible: false,
        gstSlabId: null,
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
      gstSlabId: null,
      message: "",
      isPermanentDelete: false,
      action: "delete"
    });
  };

  // Revert deleted GST slab
  const handleRevert = async (gstSlabId) => {
    const gstSlab = gstSlabs.find(g => g._id === gstSlabId);
    
    if (!gstSlab) {
      setError("GST slab not found");
      return;
    }

    if (!gstSlab.deleted) {
      setError("This GST slab is not deleted");
      return;
    }

    setDeletePopup({
      isVisible: true,
      gstSlabId,
      message: `Are you sure you want to restore the GST slab "${gstSlab.name}"? This will make it active again.`,
      isPermanentDelete: false,
      action: "revert"
    });
  };

  // Handle revert confirmation
  const handleRevertConfirm = async () => {
    const { gstSlabId } = deletePopup;
    const gstSlab = gstSlabs.find(g => g._id === gstSlabId);
    
    try {
      setLoading(true);
      setSuccess("");
      setError("");

      // Check if there's already an active or inactive GST slab with the same rate
      const existingGstSlab = gstSlabs.find(g => 
        g._id !== gstSlabId && // Exclude current GST slab being reverted
        Number(g.rate) === Number(gstSlab.rate) && // Same rate
        !g.deleted // Not deleted (active or inactive)
      );

      if (existingGstSlab) {
        const status = existingGstSlab.isActive ? 'Active' : 'Inactive';
        const suggestion = existingGstSlab.isActive ? 
          `Consider deleting the active GST slab "${existingGstSlab.name}" first, or use a different rate for the restored GST slab.` :
          `Consider deleting the inactive GST slab "${existingGstSlab.name}" first, or use a different rate for the restored GST slab.`;
        
        setError(`❌ Cannot restore GST slab "${gstSlab.name}". A ${status.toLowerCase()} GST slab with rate ${gstSlab.rate}% already exists. ${suggestion}`);
        setLoading(false);
        setDeletePopup({
          isVisible: false,
          gstSlabId: null,
          message: "",
          isPermanentDelete: false,
          action: "delete"
        });
        return;
      }

      // Revert the GST slab by setting deleted to false and isActive to true
      await api.put(`/gst-slabs/${gstSlabId}`, {
        name: gstSlab.name,
        rate: gstSlab.rate,
        description: gstSlab.description || '',
        isActive: true,
        deleted: false
      });

      setSuccess(`✅ GST Slab "${gstSlab.name}" has been restored and is now active!`);
      await fetchGstSlabs();
    } catch (err) {
      setError(`❌ Failed to restore GST slab "${gstSlab.name}". ${err.response?.data?.msg || 'Please try again.'}`);
    } finally {
      setLoading(false);
      setDeletePopup({
        isVisible: false,
        gstSlabId: null,
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
      gstSlabId: null,
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
        title="GST Slab Management"
        subtitle="Manage GST tax slabs and rates"
        isEditing={!!editingId}
        editText="Edit GST Slab"
        createText="Add New GST Slab"
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

      {/* GST Slab Form */}
      <div className="brandFormContainer paddingAll32 appendBottom30" ref={formRef}>
        <form onSubmit={handleSubmit} className="brandForm">
          <div className="makeFlex row gap10">
            <div className="fullWidth">
              <FormField
                ref={gstSlabNameInputRef}
                type="text"
                name="name"
                label="GST Slab Name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Enter GST Slab Name (e.g., GST 0%, GST 5%, GST 18%)"
                required={true}
              />
            </div>
            <div className="fullWidth">
              <FormField
                type="number"
                name="rate"
                label="GST Rate (%)"
                value={formData.rate}
                onChange={handleChange}
                placeholder="Enter GST Rate (0-100)"
                required={true}
                min={0}
                max={100}
                step={0.01}
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
                placeholder="Enter GST Slab Description"
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
              <p className="negativeMarginTop10">Check this box to keep the GST slab active, uncheck to mark as inactive</p>
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
                <span>{editingId ? "Update GST Slab" : "Add GST Slab"}</span>
              )}
            </button>
            
            {(editingId || (!editingId && (formData.name || formData.rate || formData.description))) && (
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
                Add Another GST Slab
              </button>
            )}
          </div>
        </form>
      </div>

      {/* GST Slabs List */}
      <div className="brandsListContainer paddingAll32">
        <div className="listHeader makeFlex spaceBetween end appendBottom24">
          <div className="leftSection">
            <h2 className="listTitle font30 fontBold blackText appendBottom16">GST Slabs ({filteredGstSlabs?.length || 0})</h2>
            <StatusFilter
              statusFilter={statusFilter}
              onStatusChange={setStatusFilter}
              counts={calculateStandardStatusCounts(gstSlabs)}
              disabled={loading}
            />
          </div>
          <div className="rightSection makeFlex end gap10">
            <SearchField
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search GST slabs..."
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

        {filteredGstSlabs.length === 0 && !loading ? (
          <div className="emptyState textCenter paddingAll60">
            <div className="emptyIcon appendBottom16">📊</div>
            <h3 className="font22 fontSemiBold grayText appendBottom8">No GST Slabs Found</h3>
            <p className="font16 grayText">Start by adding your first GST slab above</p>
          </div>
        ) : (
          <>
            {/* Card View */}
            {viewMode === 'card' && (
              <div className="brandsGrid">
                {displayedCards.map((gstSlab) => (
                    <EntityCard
                      key={gstSlab._id || gstSlab.id}
                      entity={gstSlab}
                      logoField="image"
                      nameField="name"
                      idField="_id"
                      onEdit={gstSlab.deleted ? undefined : handleEdit}
                      onDelete={handleDelete}
                      onRevert={gstSlab.deleted ? () => handleRevert(gstSlab._id || gstSlab.id) : undefined}
                      loading={loading}
                      imagePlaceholderColor={generateEntityColor(gstSlab._id || gstSlab.id, gstSlab.name)}
                      renderHeader={(gstSlab) => (
                        <EntityCardHeader
                          entity={{
                            ...gstSlab,
                            name: `${gstSlab.name} (${gstSlab.rate}%)`
                          }}
                          imageField="image"
                          titleField="name"
                          dateField="createdAt"
                          generateColor={generateEntityColor}
                        />
                      )}
                      renderDetails={(gstSlab) => {
                        return (
                          <>
                            <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                              <span className="detailLabel font14 fontSemiBold grayText textUppercase">GST Slab ID:</span>
                              <span className="detailValue font14 blackText appendLeft6">{gstSlab._id || 'N/A'}</span>
                            </div>
                            <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                              <span className="detailLabel font14 fontSemiBold grayText textUppercase">Name:</span>
                              <span className="detailValue font14 blackText appendLeft6">{gstSlab.name}</span>
                            </div>
                            <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                              <span className="detailLabel font14 fontSemiBold grayText textUppercase">GST Rate:</span>
                              <span className="detailValue font14 fontBold redText appendLeft6">{gstSlab.rate}%</span>
                            </div>
                            {gstSlab.description && (
                              <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                                <span className="detailLabel font14 fontSemiBold grayText textUppercase">Description:</span>
                                <span className="detailValue font14 blackText appendLeft6">{gstSlab.description}</span>
                              </div>
                            )}
                            <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                              <span className="detailLabel font14 fontSemiBold grayText textUppercase">Status:</span>
                              <span className={`detailValue font14 ${gstSlab.deleted ? 'deleted' : (gstSlab.isActive ? 'greenText' : 'inactive')} appendLeft6`}>
                                {gstSlab.deleted ? 'Deleted' : (gstSlab.isActive ? 'Active' : 'Inactive')}
                              </span>
                            </div>
                          </>
                        );
                      }}
                      renderActions={(gstSlab) => (
                        <ActionButtons
                          onEdit={gstSlab.deleted ? undefined : () => handleEdit(gstSlab)}
                          onDelete={() => handleDelete(gstSlab._id || gstSlab.id)}
                          onRevert={gstSlab.deleted ? () => handleRevert(gstSlab._id || gstSlab.id) : undefined}
                          loading={loading}
                          size="normal"
                          editText="✏️ Edit"
                          deleteText={gstSlab.deleted ? "🗑️ Final Del" : "🗑️ Delete"}
                          revertText="🔄 Undelete"
                          editTitle="Edit GST Slab"
                          deleteTitle={gstSlab.deleted ? "Final Del" : "Delete GST Slab"}
                          revertTitle="Restore GST Slab"
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
                        <th className="tableHeader">Rate (%)</th>
                        <th className="tableHeader">Description</th>
                        <th className="tableHeader">Status</th>
                        <th className="tableHeader">Created</th>
                        <th className="tableHeader">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentGstSlabs.map((gstSlab) => (
                        <tr key={gstSlab._id || gstSlab.id} className="tableRow">
                          <td className="tableCell">
                            <span className="brandNameText">{gstSlab.name}</span>
                          </td>
                          <td className="tableCell">
                            <span className="brandNameText fontBold redText">{gstSlab.rate}%</span>
                          </td>
                          <td className="tableCell">
                            <span className="addressText" title={gstSlab.description}>
                              {gstSlab.description ? (gstSlab.description.length > 30 ? `${gstSlab.description.substring(0, 30)}...` : gstSlab.description) : '-'}
                            </span>
                          </td>
                          <td className="tableCell">
                            <span className={`statusText ${gstSlab.deleted ? 'deleted' : (gstSlab.isActive ? 'active' : 'inactive')}`}>
                              {gstSlab.deleted ? 'Deleted' : (gstSlab.isActive ? 'Active' : 'Inactive')}
                            </span>
                          </td>
                          <td className="tableCell">
                            <span className="dateText">
                              {new Date(gstSlab.createdAt).toLocaleDateString()}
                            </span>
                          </td>
                          <td className="tableCell">
                            <div className="tableActions makeFlex gap8">
                              <ActionButtons
                                onEdit={gstSlab.deleted ? undefined : () => handleEdit(gstSlab)}
                                onDelete={() => handleDelete(gstSlab._id || gstSlab.id)}
                                onRevert={gstSlab.deleted ? () => handleRevert(gstSlab._id || gstSlab.id) : undefined}
                                loading={loading}
                                size="small"
                                editText="✏️"
                                deleteText={gstSlab.deleted ? "🗑️" : "🗑️"}
                                revertText="🔄"
                                editTitle="Edit GST Slab"
                                deleteTitle={gstSlab.deleted ? "Final Del" : "Delete GST Slab"}
                                revertTitle="Restore GST Slab"
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

export default GSTSlabManager;
