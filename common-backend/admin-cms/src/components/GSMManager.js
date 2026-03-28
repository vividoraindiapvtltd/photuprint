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

const GSMManager = () => {
  const [gsms, setGsms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [viewMode, setViewMode] = useState('card'); // 'card' or 'list'
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'active', 'inactive', 'deleted'
  
  // Delete confirmation popup state
  const [deletePopup, setDeletePopup] = useState({
    isVisible: false,
    gsmId: null,
    message: "",
    isPermanentDelete: false,
    action: "delete" // "delete" or "revert"
  });
  
  // Refs for scroll and focus functionality
  const formRef = useRef(null);
  const gsmNameInputRef = useRef(null);
  
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

  // Validate GSM name for duplicates
  const validateGsmName = (name) => {
    if (!name || !name.trim()) {
      return { isValid: false, error: "GSM Name is required" };
    }
    
    // Check for duplicate names only against active, non-deleted GSMs (excluding current GSM being edited)
    const existingGsm = gsms.find(gsm => 
      gsm.name.toLowerCase().trim() === name.toLowerCase().trim() && 
      gsm._id !== editingId &&
      gsm.isActive === true && // Only check against active GSMs
      !gsm.deleted // Exclude deleted GSMs
    );
    
    if (existingGsm) {
      return { isValid: false, error: "GSM name already exists" };
    }
    
    return { isValid: true, error: "" };
  };

  // Fetch GSMs from backend
  const fetchGsms = async () => {
    try {
      setLoading(true);
      const response = await api.get('/gsms?showInactive=true&includeDeleted=true');
      setGsms(response.data);
      setError("");
    } catch (err) {
      setError("Failed to fetch GSMs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGsms();
  }, []);

  // Filter GSMs based on search query and status - memoized to prevent infinite loops
  const filteredGsms = useMemo(() => {
    let filtered = gsms;
    
    // Apply search filter
    if (searchQuery && searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(gsm => 
        gsm.name.toLowerCase().includes(query) ||
        (gsm.description && gsm.description.toLowerCase().includes(query))
      );
    }
    
    // Apply status filter
    filtered = filterEntitiesByStatus(filtered, statusFilter);
    
    return filtered;
  }, [gsms, searchQuery, statusFilter]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredGsms.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentGsms = filteredGsms.slice(startIndex, endIndex);

  // Card lazy loading logic
  useEffect(() => {
    if (viewMode === 'card' && filteredGsms.length > 0) {
      const initialCards = filteredGsms.slice(0, 12);
      setDisplayedCards(initialCards);
      setHasMoreCards(filteredGsms.length > 12);
      setCurrentPage(1);
    }
  }, [filteredGsms, viewMode]);

  // Reset pagination when search query changes
  const resetPaginationForSearch = useCallback(() => {
    setCurrentPage(1);
    if (viewMode === 'card') {
      const initialCards = filteredGsms.slice(0, 12);
      setDisplayedCards(initialCards);
      setHasMoreCards(filteredGsms.length > 12);
    }
  }, [viewMode, filteredGsms.length]);

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
      const nextCards = filteredGsms.slice(currentCardCount, currentCardCount + 12);
      
      if (nextCards.length > 0) {
        setHasMoreCards(currentCardCount + nextCards.length < filteredGsms.length);
        return [...prevCards, ...nextCards];
      } else {
        setHasMoreCards(false);
        return prevCards;
      }
    });
  }, [filteredGsms]);

  // Reset pagination when view mode changes
  const handleViewModeChange = useCallback((mode) => {
    setViewMode(mode);
    setCurrentPage(1);
    if (mode === 'card') {
      const initialCards = filteredGsms.slice(0, 12);
      setDisplayedCards(initialCards);
      setHasMoreCards(filteredGsms.length > 12);
    }
  }, [filteredGsms.length]);

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

  // Validate and Add / Update GSM
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate GSM name
    const nameValidation = validateGsmName(formData.name);
    if (!nameValidation.isValid) {
      setError(nameValidation.error);
      return;
    }

    try {
      setLoading(true);
      setSuccess(""); // Clear any existing success message
      setError(""); // Clear any existing error message

      const gsmData = {
        name: formData.name.trim(),
        description: formData.description?.trim() || '',
        isActive: formData.isActive
      };

      if (editingId) {
        // Update GSM
        await api.put(`/gsms/${editingId}`, gsmData);
        setSuccess(`✅ GSM "${gsmData.name}" has been updated successfully!`);
      } else {
        // Create GSM
        await api.post('/gsms', gsmData);
        setSuccess(`✅ GSM "${gsmData.name}" has been created successfully!`);
      }

      // Refresh GSMs list
      await fetchGsms();
      
      // Reset form after successful submission (for both add and edit)
      resetForm();
      
    } catch (err) {
      if (err.response?.data?.msg?.includes('already exists')) {
        setError(`❌ ${err.response.data.msg}`);
      } else {
        setError(`❌ Failed to ${editingId ? 'update' : 'create'} GSM. ${err.response?.data?.msg || 'Please try again.'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (gsm) => {
    setFormData({
      ...initialFormData,
      name: gsm.name || "",
      description: gsm.description || "",
      isActive: gsm.isActive !== undefined ? gsm.isActive : false
    });
    setEditingId(gsm._id || gsm.id);
    setError("");
    setSuccess("");
    
    // Scroll to form and focus on GSM name input
    setTimeout(() => {
      if (formRef.current) {
        formRef.current.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start' 
        });
      }
      if (gsmNameInputRef.current) {
        gsmNameInputRef.current.focus();
      }
    }, 100);
  };

  const handleDelete = (gsmId) => {
    // Find the GSM to check if it's already marked as deleted
    const gsm = gsms.find(f => f._id === gsmId);
    const isAlreadyDeleted = gsm?.deleted;
    
    let message;
    let isPermanentDelete = false;
    
    if (isAlreadyDeleted) {
      message = "This GSM is already marked as deleted. Click OK to permanently remove it from the database. This action cannot be undone.";
      isPermanentDelete = true;
    } else {
      message = "This will mark the GSM as inactive and add a deleted flag. Click OK to continue.";
      isPermanentDelete = false;
    }
    
    setDeletePopup({
      isVisible: true,
      gsmId,
      message,
      isPermanentDelete,
      action: "delete"
    });
  };

  // Handle delete confirmation
  const handleDeleteConfirm = async () => {
    const { gsmId, isPermanentDelete } = deletePopup;
    const gsm = gsms.find(f => f._id === gsmId);
    
    try {
      setLoading(true);
      setSuccess(""); // Clear any existing success message
      setError(""); // Clear any existing error message
      
      if (isPermanentDelete) {
        // Permanent deletion
        await api.delete(`/gsms/${gsmId}/hard`);
        setSuccess(`🗑️ GSM "${gsm.name}" has been permanently deleted from the database.`);
      } else {
        // Soft delete - mark as inactive and add deleted flag
        await api.delete(`/gsms/${gsmId}`);
        setSuccess(`⏸️ GSM "${gsm.name}" has been marked as deleted and inactive.`);
      }
      
      await fetchGsms();
    } catch (err) {
      const action = isPermanentDelete ? "permanently delete" : "mark as deleted";
      setError(`❌ Failed to ${action} GSM "${gsm.name}". ${err.response?.data?.msg || 'Please try again.'}`);
    } finally {
      setLoading(false);
      setDeletePopup({
        isVisible: false,
        gsmId: null,
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
      gsmId: null,
      message: "",
      isPermanentDelete: false,
      action: "delete"
    });
  };

  // Revert deleted GSM
  const handleRevert = async (gsmId) => {
    const gsm = gsms.find(f => f._id === gsmId);
    
    if (!gsm) {
      setError("GSM not found");
      return;
    }

    if (!gsm.deleted) {
      setError("This GSM is not deleted");
      return;
    }

    setDeletePopup({
      isVisible: true,
      gsmId,
      message: `Are you sure you want to restore the GSM "${gsm.name}"? This will make it active again.`,
      isPermanentDelete: false,
      action: "revert"
    });
  };

  // Handle revert confirmation
  const handleRevertConfirm = async () => {
    const { gsmId } = deletePopup;
    const gsm = gsms.find(f => f._id === gsmId);
    
    try {
      setLoading(true);
      setSuccess("");
      setError("");

      // Check if there's already an active or inactive GSM with the same name
      const existingGsm = gsms.find(f => 
        f._id !== gsmId && // Exclude current GSM being reverted
        f.name.toLowerCase().trim() === gsm.name.toLowerCase().trim() && // Same name
        !f.deleted // Not deleted (active or inactive)
      );

      if (existingGsm) {
        const status = existingGsm.isActive ? 'Active' : 'Inactive';
        const suggestion = existingGsm.isActive ? 
          `Consider deleting the active GSM "${existingGsm.name}" first, or use a different name for the restored GSM.` :
          `Consider deleting the inactive GSM "${existingGsm.name}" first, or use a different name for the restored GSM.`;
        
        setError(`❌ Cannot restore GSM "${gsm.name}". A ${status.toLowerCase()} GSM with this name already exists. ${suggestion}`);
        setLoading(false);
        setDeletePopup({
          isVisible: false,
          gsmId: null,
          message: "",
          isPermanentDelete: false,
          action: "delete"
        });
        return;
      }

      // Revert the GSM by setting deleted to false and isActive to true
      await api.put(`/gsms/${gsmId}`, {
        name: gsm.name,
        description: gsm.description || '',
        isActive: true,
        deleted: false
      });

      setSuccess(`✅ GSM "${gsm.name}" has been restored and is now active!`);
      await fetchGsms();
    } catch (err) {
      setError(`❌ Failed to restore GSM "${gsm.name}". ${err.response?.data?.msg || 'Please try again.'}`);
    } finally {
      setLoading(false);
      setDeletePopup({
        isVisible: false,
        gsmId: null,
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
      gsmId: null,
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
        title="GSM Management"
        subtitle="Manage fabric weight (GSM) options for products"
        isEditing={!!editingId}
        editText="Edit GSM"
        createText="Add New GSM"
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

      {/* GSM Form */}
      <div className="brandFormContainer paddingAll32 appendBottom30" ref={formRef}>
        <form onSubmit={handleSubmit} className="brandForm">
          <div className="makeFlex row gap10">
            <div className="fullWidth">
              <FormField
                ref={gsmNameInputRef}
                type="text"
                name="name"
                label="GSM Name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Enter GSM label (e.g., 180 GSM)"
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
                placeholder="Enter GSM Description"
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
              <p className="negativeMarginTop10">Check this box to keep the GSM active, uncheck to mark as inactive</p>
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
                <span>{editingId ? "Update GSM" : "Add GSM"}</span>
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
                Add Another GSM
              </button>
            )}
          </div>
        </form>
      </div>

      {/* GSMs List */}
      <div className="brandsListContainer paddingAll32">
        <div className="listHeader makeFlex spaceBetween end appendBottom24">
          <div className="leftSection">
            <h2 className="listTitle font30 fontBold blackText appendBottom16">GSMs ({filteredGsms?.length || 0})</h2>
            <StatusFilter
              statusFilter={statusFilter}
              onStatusChange={setStatusFilter}
              counts={calculateStandardStatusCounts(gsms)}
              disabled={loading}
            />
          </div>
          <div className="rightSection makeFlex end gap10">
            <SearchField
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search GSMs..."
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

        {filteredGsms.length === 0 && !loading ? (
          <div className="emptyState textCenter paddingAll60">
            <div className="emptyIcon appendBottom16">📄</div>
            <h3 className="font22 fontSemiBold grayText appendBottom8">No GSMs Found</h3>
            <p className="font16 grayText">Start by adding your first GSM above</p>
          </div>
        ) : (
          <>
            {/* Card View */}
            {viewMode === 'card' && (
              <div className="brandsGrid">
                {displayedCards.map((gsm) => (
                    <EntityCard
                      key={gsm._id || gsm.id}
                      entity={gsm}
                      logoField="image"
                      nameField="name"
                      idField="_id"
                      onEdit={gsm.deleted ? undefined : handleEdit}
                      onDelete={handleDelete}
                      onRevert={gsm.deleted ? () => handleRevert(gsm._id || gsm.id) : undefined}
                      loading={loading}
                      imagePlaceholderColor={generateEntityColor(gsm._id || gsm.id, gsm.name)}
                      renderHeader={(gsm) => (
                        <EntityCardHeader
                          entity={gsm}
                          imageField="image"
                          titleField="name"
                          dateField="createdAt"
                          generateColor={generateEntityColor}
                        />
                      )}
                      renderDetails={(gsm) => {
                        return (
                          <>
                            <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                              <span className="detailLabel font14 fontSemiBold grayText textUppercase">GSM ID:</span>
                              <span className="detailValue font14 blackText appendLeft6">{gsm._id || 'N/A'}</span>
                            </div>
                            <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                              <span className="detailLabel font14 fontSemiBold grayText textUppercase">Name:</span>
                              <span className="detailValue font14 blackText appendLeft6">{gsm.name}</span>
                            </div>
                            {gsm.description && (
                              <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                                <span className="detailLabel font14 fontSemiBold grayText textUppercase">Description:</span>
                                <span className="detailValue font14 blackText appendLeft6">{gsm.description}</span>
                              </div>
                            )}
                            <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                              <span className="detailLabel font14 fontSemiBold grayText textUppercase">Status:</span>
                              <span className={`detailValue font14 ${gsm.deleted ? 'deleted' : (gsm.isActive ? 'greenText' : 'inactive')} appendLeft6`}>
                                {gsm.deleted ? 'Deleted' : (gsm.isActive ? 'Active' : 'Inactive')}
                              </span>
                            </div>
                          </>
                        );
                      }}
                      renderActions={(gsm) => (
                        <ActionButtons
                          onEdit={gsm.deleted ? undefined : () => handleEdit(gsm)}
                          onDelete={() => handleDelete(gsm._id || gsm.id)}
                          onRevert={gsm.deleted ? () => handleRevert(gsm._id || gsm.id) : undefined}
                          loading={loading}
                          size="normal"
                          editText="✏️ Edit"
                          deleteText={gsm.deleted ? "🗑️ Final Del" : "🗑️ Delete"}
                          revertText="🔄 Undelete"
                          editTitle="Edit GSM"
                          deleteTitle={gsm.deleted ? "Final Del" : "Delete GSM"}
                          revertTitle="Restore GSM"
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
                      {currentGsms.map((gsm) => (
                        <tr key={gsm._id || gsm.id} className="tableRow">
                          <td className="tableCell">
                            <span className="brandNameText">{gsm.name}</span>
                          </td>
                          <td className="tableCell">
                            <span className="addressText" title={gsm.description}>
                              {gsm.description ? (gsm.description.length > 30 ? `${gsm.description.substring(0, 30)}...` : gsm.description) : '-'}
                            </span>
                          </td>
                          <td className="tableCell">
                            <span className={`statusText ${gsm.deleted ? 'deleted' : (gsm.isActive ? 'active' : 'inactive')}`}>
                              {gsm.deleted ? 'Deleted' : (gsm.isActive ? 'Active' : 'Inactive')}
                            </span>
                          </td>
                          <td className="tableCell">
                            <span className="dateText">
                              {new Date(gsm.createdAt).toLocaleDateString()}
                            </span>
                          </td>
                          <td className="tableCell">
                            <div className="tableActions makeFlex gap8">
                              <ActionButtons
                                onEdit={gsm.deleted ? undefined : () => handleEdit(gsm)}
                                onDelete={() => handleDelete(gsm._id || gsm.id)}
                                onRevert={gsm.deleted ? () => handleRevert(gsm._id || gsm.id) : undefined}
                                loading={loading}
                                size="small"
                                editText="✏️"
                                deleteText={gsm.deleted ? "🗑️" : "🗑️"}
                                revertText="🔄"
                                editTitle="Edit GSM"
                                deleteTitle={gsm.deleted ? "Final Del" : "Delete GSM"}
                                revertTitle="Restore GSM"
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

export default GSMManager;
