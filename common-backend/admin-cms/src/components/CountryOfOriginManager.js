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

const CountryOfOriginManager = () => {
  const [countries, setCountries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [viewMode, setViewMode] = useState('card'); // 'card' or 'list'
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'active', 'inactive', 'deleted'
  
  // Delete confirmation popup state
  const [deletePopup, setDeletePopup] = useState({
    isVisible: false,
    countryId: null,
    message: "",
    isPermanentDelete: false,
    action: "delete" // "delete" or "revert"
  });
  
  // Refs for scroll and focus functionality
  const formRef = useRef(null);
  const countryNameInputRef = useRef(null);
  
  // Pagination and lazy loading states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10); // For list view
  const [hasMoreCards, setHasMoreCards] = useState(true);
  const [displayedCards, setDisplayedCards] = useState([]);
  
  const initialFormData = {
    name: "",
    code: "",
    description: "",
    isActive: false
  };

  const [formData, setFormData] = useState(initialFormData);
  const [searchQuery, setSearchQuery] = useState(""); // Search query state

  // Validate country name for duplicates
  const validateCountryName = (name) => {
    if (!name || !name.trim()) {
      return { isValid: false, error: "Country Name is required" };
    }
    
    // Check for duplicate names only against active, non-deleted countries (excluding current country being edited)
    const existingCountry = countries.find(country => 
      country.name.toLowerCase().trim() === name.toLowerCase().trim() && 
      country._id !== editingId &&
      country.isActive === true && // Only check against active countries
      !country.deleted // Exclude deleted countries
    );
    
    if (existingCountry) {
      return { isValid: false, error: "Country name already exists" };
    }
    
    return { isValid: true, error: "" };
  };

  // Validate country code for duplicates
  const validateCountryCode = (code) => {
    if (!code || !code.trim()) {
      return { isValid: false, error: "Country Code is required" };
    }
    
    // Check for duplicate codes only against active, non-deleted countries (excluding current country being edited)
    const existingCountry = countries.find(country => 
      country.code && 
      country.code.toUpperCase().trim() === code.toUpperCase().trim() && 
      country._id !== editingId &&
      country.isActive === true && // Only check against active countries
      !country.deleted // Exclude deleted countries
    );
    
    if (existingCountry) {
      return { isValid: false, error: "Country code already exists" };
    }
    
    return { isValid: true, error: "" };
  };

  // Fetch countries from backend
  const fetchCountries = async () => {
    try {
      setLoading(true);
      const response = await api.get('/countries?showInactive=true&includeDeleted=true');
      setCountries(response.data);
      setError("");
    } catch (err) {
      setError("Failed to fetch countries");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCountries();
  }, []);

  // Filter countries based on search query and status
  const filteredCountries = useMemo(() => {
    let filtered = countries;
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(country => 
        country.name.toLowerCase().includes(query) ||
        (country.code && country.code.toLowerCase().includes(query)) ||
        (country.description && country.description.toLowerCase().includes(query))
      );
    }
    
    // Apply status filter
    filtered = filterEntitiesByStatus(filtered, statusFilter);
    
    return filtered;
  }, [countries, searchQuery, statusFilter]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredCountries.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentCountries = filteredCountries.slice(startIndex, endIndex);

  // Card lazy loading logic
  useEffect(() => {
    if (viewMode === 'card') {
      const initialCards = filteredCountries.slice(0, 12);
      setDisplayedCards(initialCards);
      setHasMoreCards(filteredCountries.length > 12);
      setCurrentPage(1);
    }
  }, [viewMode, filteredCountries]);

  // Reset pagination when search query changes
  const resetPaginationForSearch = useCallback(() => {
    setCurrentPage(1);
    if (viewMode === 'card') {
      const initialCards = filteredCountries.slice(0, 12);
      setDisplayedCards(initialCards);
      setHasMoreCards(filteredCountries.length > 12);
    }
  }, [viewMode, filteredCountries.length]);

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
      const nextCards = filteredCountries.slice(currentCardCount, currentCardCount + 12);
      
      if (nextCards.length > 0) {
        setHasMoreCards(currentCardCount + nextCards.length < filteredCountries.length);
        return [...prevCards, ...nextCards];
      } else {
        setHasMoreCards(false);
        return prevCards;
      }
    });
  }, [filteredCountries]);

  // Reset pagination when view mode changes
  const handleViewModeChange = useCallback((mode) => {
    setViewMode(mode);
    setCurrentPage(1);
    if (mode === 'card') {
      const initialCards = filteredCountries.slice(0, 12);
      setDisplayedCards(initialCards);
      setHasMoreCards(filteredCountries.length > 12);
    }
  }, [filteredCountries.length]);

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

  // Validate and Add / Update Country
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate country name
    const nameValidation = validateCountryName(formData.name);
    if (!nameValidation.isValid) {
      setError(nameValidation.error);
      return;
    }

    // Validate country code
    const codeValidation = validateCountryCode(formData.code);
    if (!codeValidation.isValid) {
      setError(codeValidation.error);
      return;
    }

    try {
      setLoading(true);
      setSuccess(""); // Clear any existing success message
      setError(""); // Clear any existing error message

      const countryData = {
        name: formData.name.trim(),
        code: formData.code.trim().toUpperCase(),
        description: formData.description?.trim() || '',
        isActive: formData.isActive
      };

      if (editingId) {
        // Update country
        await api.put(`/countries/${editingId}`, countryData);
        setSuccess(`✅ Country "${countryData.name}" has been updated successfully!`);
      } else {
        // Create country
        await api.post('/countries', countryData);
        setSuccess(`✅ Country "${countryData.name}" has been created successfully!`);
      }

      // Refresh countries list
      await fetchCountries();
      
      // Reset form after successful submission (for both add and edit)
      resetForm();
      
    } catch (err) {
      if (err.response?.data?.msg?.includes('already exists')) {
        setError(`❌ ${err.response.data.msg}`);
      } else {
        setError(`❌ Failed to ${editingId ? 'update' : 'create'} country. ${err.response?.data?.msg || 'Please try again.'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // Edit country
  const handleEdit = (country) => {
    setFormData({
      ...initialFormData,
      name: country.name || "",
      code: country.code || "",
      description: country.description || "",
      isActive: country.isActive !== undefined ? country.isActive : false
    });
    setEditingId(country._id || country.id);
    setError("");
    setSuccess("");
    
    // Scroll to form and focus on country name input
    setTimeout(() => {
      if (formRef.current) {
        formRef.current.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start' 
        });
      }
      if (countryNameInputRef.current) {
        countryNameInputRef.current.focus();
      }
    }, 100);
  };

  const handleDelete = (countryId) => {
    // Find the country to check if it's already marked as deleted
    const country = countries.find(c => c._id === countryId);
    const isAlreadyDeleted = country?.deleted;
    
    let message;
    let isPermanentDelete = false;
    
    if (isAlreadyDeleted) {
      message = "This country is already marked as deleted. Click OK to permanently remove it from the database. This action cannot be undone.";
      isPermanentDelete = true;
    } else {
      message = "This will mark the country as inactive and add a deleted flag. Click OK to continue.";
      isPermanentDelete = false;
    }
    
    setDeletePopup({
      isVisible: true,
      countryId,
      message,
      isPermanentDelete,
      action: "delete"
    });
  };

  // Handle delete confirmation
  const handleDeleteConfirm = async () => {
    const { countryId, isPermanentDelete } = deletePopup;
    const country = countries.find(c => c._id === countryId);
    
    try {
      setLoading(true);
      setSuccess(""); // Clear any existing success message
      setError(""); // Clear any existing error message
      
      if (isPermanentDelete) {
        // Permanent deletion
        await api.delete(`/countries/${countryId}/hard`);
        setSuccess(`🗑️ Country "${country.name}" has been permanently deleted from the database.`);
      } else {
        // Soft delete - mark as inactive and add deleted flag
        await api.delete(`/countries/${countryId}`);
        setSuccess(`⏸️ Country "${country.name}" has been marked as deleted and inactive.`);
      }
      
      await fetchCountries();
    } catch (err) {
      const action = isPermanentDelete ? "permanently delete" : "mark as deleted";
      setError(`❌ Failed to ${action} country "${country.name}". ${err.response?.data?.msg || 'Please try again.'}`);
    } finally {
      setLoading(false);
      setDeletePopup({
        isVisible: false,
        countryId: null,
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
      countryId: null,
      message: "",
      isPermanentDelete: false,
      action: "delete"
    });
  };

  // Revert deleted country
  const handleRevert = async (countryId) => {
    const country = countries.find(c => c._id === countryId);
    
    if (!country) {
      setError("Country not found");
      return;
    }

    if (!country.deleted) {
      setError("This country is not deleted");
      return;
    }

    setDeletePopup({
      isVisible: true,
      countryId,
      message: `Are you sure you want to restore the country "${country.name}"? This will make it active again.`,
      isPermanentDelete: false,
      action: "revert"
    });
  };

  // Handle revert confirmation
  const handleRevertConfirm = async () => {
    const { countryId } = deletePopup;
    const country = countries.find(c => c._id === countryId);
    
    try {
      setLoading(true);
      setSuccess("");
      setError("");

      // Check if there's already an active or inactive country with the same name or code
      const existingCountry = countries.find(c => 
        c._id !== countryId && // Exclude current country being reverted
        ((c.name && country.name && c.name.toLowerCase().trim() === country.name.toLowerCase().trim()) || 
         (c.code && country.code && c.code.toUpperCase().trim() === country.code.toUpperCase().trim())) && // Same name or code
        !c.deleted // Not deleted (active or inactive)
      );

      if (existingCountry) {
        const status = existingCountry.isActive ? 'Active' : 'Inactive';
        const conflict = existingCountry.name && country.name && existingCountry.name.toLowerCase().trim() === country.name.toLowerCase().trim() ? 'name' : 'code';
        const suggestion = existingCountry.isActive ? 
          `Consider deleting the active country "${existingCountry.name}" first, or use a different ${conflict} for the restored country.` :
          `Consider deleting the inactive country "${existingCountry.name}" first, or use a different ${conflict} for the restored country.`;
        
        setError(`❌ Cannot restore country "${country.name}". A ${status.toLowerCase()} country with this ${conflict} already exists. ${suggestion}`);
        setLoading(false);
        setDeletePopup({
          isVisible: false,
          countryId: null,
          message: "",
          isPermanentDelete: false,
          action: "delete"
        });
        return;
      }

      // Revert the country by setting deleted to false and isActive to true
      await api.put(`/countries/${countryId}`, {
        name: country.name,
        code: country.code,
        description: country.description || '',
        isActive: true,
        deleted: false
      });

      setSuccess(`✅ Country "${country.name}" has been restored and is now active!`);
      await fetchCountries();
    } catch (err) {
      setError(`❌ Failed to restore country "${country.name}". ${err.response?.data?.msg || 'Please try again.'}`);
    } finally {
      setLoading(false);
      setDeletePopup({
        isVisible: false,
        countryId: null,
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
      countryId: null,
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
        title="Country of Origin Management"
        subtitle="Manage your product countries of origin and classifications"
        isEditing={!!editingId}
        editText="Edit Country"
        createText="Add New Country"
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

      {/* Country Form */}
      <div className="brandFormContainer paddingAll32 appendBottom30" ref={formRef}>
        <form onSubmit={handleSubmit} className="brandForm">
          <div className="makeFlex row gap10">
            <div className="fullWidth">
              <FormField
                ref={countryNameInputRef}
                type="text"
                name="name"
                label="Country Name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Enter Country Name (e.g., India)"
                required={true}
              />
            </div>
          </div>
          
          <div className="makeFlex row gap10">
            <div className="fullWidth">
              <FormField
                type="text"
                name="code"
                label="Country Code"
                value={formData.code}
                onChange={handleChange}
                placeholder="Enter Country Code (e.g., IN)"
                required={true}
                uppercase={true}
                maxLength={3}
                info="Country code will be automatically converted to uppercase (max 3 characters)"
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
                placeholder="Enter Country Description"
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
              <p className="negativeMarginTop10">Check this box to keep the country active, uncheck to mark as inactive</p>
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
                <span>{editingId ? "Update Country" : "Add Country"}</span>
              )}
            </button>
            
            {(editingId || (!editingId && (formData.name || formData.code || formData.description))) && (
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
                Add Another Country
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Countries List */}
      <div className="brandsListContainer paddingAll32">
        <div className="listHeader makeFlex spaceBetween end appendBottom24">
          <div className="leftSection">
            <h2 className="listTitle font30 fontBold blackText appendBottom16">Countries ({filteredCountries?.length || 0})</h2>
            <StatusFilter
              statusFilter={statusFilter}
              onStatusChange={setStatusFilter}
              counts={calculateStandardStatusCounts(countries)}
              disabled={loading}
            />
          </div>
          <div className="rightSection makeFlex end gap10">
            <SearchField
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search countries..."
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

        {filteredCountries.length === 0 && !loading ? (
          <div className="emptyState textCenter paddingAll60">
            <div className="emptyIcon appendBottom16">🌍</div>
            <h3 className="font22 fontSemiBold grayText appendBottom8">No Countries Found</h3>
            <p className="font16 grayText">Start by adding your first country above</p>
          </div>
        ) : (
          <>
            {/* Card View */}
            {viewMode === 'card' && (
              <div className="brandsGrid">
                {displayedCards.map((country) => (
                  <EntityCard
                    key={country._id || country.id}
                    entity={country}
                    logoField="image"
                    nameField="name"
                    idField="_id"
                    onEdit={country.deleted ? undefined : handleEdit}
                    onDelete={handleDelete}
                    onRevert={country.deleted ? () => handleRevert(country._id || country.id) : undefined}
                    loading={loading}
                    imagePlaceholderColor={generateEntityColor(country._id || country.id, country.name)}
                    renderHeader={(country) => (
                      <EntityCardHeader
                        entity={country}
                        imageField="image"
                        titleField="name"
                        dateField="createdAt"
                        generateColor={generateEntityColor}
                      />
                    )}
                    renderDetails={(country) => {
                      return (
                        <>
                          <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                            <span className="detailLabel font14 fontSemiBold grayText textUppercase">Country ID:</span>
                            <span className="detailValue font14 blackText appendLeft6">{country._id || 'N/A'}</span>
                          </div>
                          <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                            <span className="detailLabel font14 fontSemiBold grayText textUppercase">Name:</span>
                            <span className="detailValue font14 blackText appendLeft6">{country.name}</span>
                          </div>
                          <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                            <span className="detailLabel font14 fontSemiBold grayText textUppercase">Code:</span>
                            <span className="detailValue font14 blackText appendLeft6">{country.code}</span>
                          </div>
                          {country.description && (
                            <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                              <span className="detailLabel font14 fontSemiBold grayText textUppercase">Description:</span>
                              <span className="detailValue font14 blackText appendLeft6">{country.description}</span>
                            </div>
                          )}
                          <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                            <span className="detailLabel font14 fontSemiBold grayText textUppercase">Status:</span>
                            <span className={`detailValue font14 ${country.deleted ? 'deleted' : (country.isActive ? 'greenText' : 'inactive')} appendLeft6`}>
                              {country.deleted ? 'Deleted' : (country.isActive ? 'Active' : 'Inactive')}
                            </span>
                          </div>
                        </>
                      );
                    }}
                    renderActions={(country) => (
                      <ActionButtons
                        onEdit={country.deleted ? undefined : () => handleEdit(country)}
                        onDelete={() => handleDelete(country._id || country.id)}
                        onRevert={country.deleted ? () => handleRevert(country._id || country.id) : undefined}
                        loading={loading}
                        size="normal"
                        editText="✏️ Edit"
                        deleteText={country.deleted ? "🗑️ Final Del" : "🗑️ Delete"}
                        revertText="🔄 Undelete"
                        editTitle="Edit Country"
                        deleteTitle={country.deleted ? "Final Del" : "Delete Country"}
                        revertTitle="Restore Country"
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
                        <th className="tableHeader">Code</th>
                        <th className="tableHeader">Description</th>
                        <th className="tableHeader">Status</th>
                        <th className="tableHeader">Created</th>
                        <th className="tableHeader">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentCountries.map((country) => (
                        <tr key={country._id || country.id} className="tableRow">
                          <td className="tableCell">
                            <span className="brandNameText">{country.name}</span>
                          </td>
                          <td className="tableCell">
                            <span className="brandIdText">{country.code}</span>
                          </td>
                          <td className="tableCell">
                            <span className="addressText" title={country.description}>
                              {country.description ? (country.description.length > 30 ? `${country.description.substring(0, 30)}...` : country.description) : '-'}
                            </span>
                          </td>
                          <td className="tableCell">
                            <span className={`statusText ${country.deleted ? 'deleted' : (country.isActive ? 'active' : 'inactive')}`}>
                              {country.deleted ? 'Deleted' : (country.isActive ? 'Active' : 'Inactive')}
                            </span>
                          </td>
                          <td className="tableCell">
                            <span className="dateText">
                              {new Date(country.createdAt).toLocaleDateString()}
                            </span>
                          </td>
                          <td className="tableCell">
                            <div className="tableActions makeFlex gap8">
                              <ActionButtons
                                onEdit={country.deleted ? undefined : () => handleEdit(country)}
                                onDelete={() => handleDelete(country._id || country.id)}
                                onRevert={country.deleted ? () => handleRevert(country._id || country.id) : undefined}
                                loading={loading}
                                size="small"
                                editText="✏️"
                                deleteText={country.deleted ? "🗑️" : "🗑️"}
                                revertText="🔄"
                                editTitle="Edit Country"
                                deleteTitle={country.deleted ? "Final Del" : "Delete Country"}
                                revertTitle="Restore Country"
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

export default CountryOfOriginManager;
