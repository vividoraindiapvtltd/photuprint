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
  calculateStandardStatusCounts,
  filterEntitiesByStatus,
  DeleteConfirmationPopup,
  ValidationErrorPopup,
  generateBrandColor 
} from '../common';

const BrandManager = () => {
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [viewMode, setViewMode] = useState('card');
  const [statusFilter, setStatusFilter] = useState('all'); // Add status filter state
  
  // Pagination and lazy loading states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [hasMoreCards, setHasMoreCards] = useState(true);
  const [displayedCards, setDisplayedCards] = useState([]);
  
  const initialFormData = {
    name: "",
    logo: null,
    gstNo: "",
    companyName: "",
    address: "",
    isActive: false
  };

  const [formData, setFormData] = useState(initialFormData);
  const [currentLogoUrl, setCurrentLogoUrl] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Validation states
  const [nameError, setNameError] = useState("");
  const [gstError, setGstError] = useState("");
  
  // Image popup state (for card logo click)
  const [imagePopup, setImagePopup] = useState({
    isVisible: false,
    imageUrl: null
  });

  // Delete confirmation popup state
  const [deletePopup, setDeletePopup] = useState({
    isVisible: false,
    brandId: null,
    message: "",
    isPermanentDelete: false,
    action: "delete" // "delete" or "revert"
  });

  // Validation error popup state
  const [validationErrorPopup, setValidationErrorPopup] = useState({
    isVisible: false,
    errors: []
  });

  // Refs for scroll and focus functionality
  const formRef = useRef(null);
  const brandNameInputRef = useRef(null);

  // Helper to force browsers to load the latest logo after updates
  const addCacheBuster = (url, cacheBuster) => {
    if (!url) return url;
    // Avoid duplicating the cache-buster if it's already present
    if (url.includes('v=')) return url;
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}v=${cacheBuster}`;
  };

  // Fetch brands from backend
  const fetchBrands = async () => {
    try {
      setLoading(true);
      const response = await api.get('/brands?showInactive=true&includeDeleted=true');
      
      // Process brands to ensure proper logo URLs
      const cacheBuster = Date.now();
      const processedBrands = response.data.map(brand => {
        let logoUrl = brand.logo;
        
        // If logo is a relative path, construct full URL
        if (logoUrl && !logoUrl.startsWith('http')) {
          if (logoUrl.startsWith('/uploads/')) {
            logoUrl = `${logoUrl}`;
          }
        }
        
        // Append cache-buster so updated logos show immediately
        logoUrl = addCacheBuster(logoUrl, cacheBuster);
        
        // Debug: Log brandId and deleted status for each brand
        console.log(`Brand ${brand.name}: brandId = ${brand.brandId}, _id = ${brand._id}, deleted = ${brand.deleted}`);
        
        return {
          ...brand,
          logo: logoUrl
        };
      });
      
      setBrands(processedBrands);
      setError("");
    } catch (err) {
      setError("Failed to load brands. Please refresh the page and try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBrands();
  }, []);

  // Filter brands based on search query and status - memoized to prevent infinite loops
  const filteredBrands = useMemo(() => {
    let filtered = brands;
    
    // Apply status filter using utility function
    filtered = filterEntitiesByStatus(filtered, statusFilter);
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(brand => 
        brand.name.toLowerCase().includes(query) ||
        (brand.companyName && brand.companyName.toLowerCase().includes(query)) ||
        (brand.gstNo && brand.gstNo.toLowerCase().includes(query)) ||
        (brand.address && brand.address.toLowerCase().includes(query))
      );
    }
    
    return filtered;
  }, [brands, searchQuery, statusFilter]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredBrands.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentBrands = filteredBrands.slice(startIndex, endIndex);

  // Card lazy loading logic
  useEffect(() => {
    if (viewMode === 'card' && filteredBrands.length > 0) {
      const initialCards = filteredBrands.slice(0, 16); // 4 cards per row × 4 rows = 16 cards
      setDisplayedCards(initialCards);
      setHasMoreCards(filteredBrands.length > 16);
      setCurrentPage(1);
    }
  }, [filteredBrands, viewMode]);

  // Reset pagination when search query changes
  useEffect(() => {
    setCurrentPage(1);
    if (viewMode === 'card') {
      const initialCards = filteredBrands.slice(0, 16);
      setDisplayedCards(initialCards);
      setHasMoreCards(filteredBrands.length > 16);
    }
  }, [searchQuery, viewMode, filteredBrands]);

  // Handle page change for list view
  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Handle lazy loading for card view
  const handleLoadMoreCards = () => {
    const currentCardCount = displayedCards.length;
    const nextCards = filteredBrands.slice(currentCardCount, currentCardCount + 16);
    
    if (nextCards.length > 0) {
      setDisplayedCards([...displayedCards, ...nextCards]);
      setHasMoreCards(currentCardCount + nextCards.length < filteredBrands.length);
    } else {
      setHasMoreCards(false);
    }
  };

  // Reset pagination when view mode changes
  const handleViewModeChange = (mode) => {
    setViewMode(mode);
    setCurrentPage(1);
    if (mode === 'card') {
      const initialCards = filteredBrands.slice(0, 16);
      setDisplayedCards(initialCards);
      setHasMoreCards(filteredBrands.length > 16);
    }
  };

  // Validation functions
  const validateBrandName = (name) => {
    if (!name.trim()) {
      setNameError("Brand name is required");
      return false;
    }
    
    const trimmedName = name.toLowerCase().trim();
    
    // Debug: Log the current brands state
    console.log('Validating brand name:', name);
    console.log('Current brands:', brands);
    console.log('Editing ID:', editingId);
    
    const existingBrand = brands.find(brand => {
      const brandName = brand.name ? brand.name.toLowerCase().trim() : '';
      return brandName === trimmedName && 
             brand._id !== editingId && 
             brand.isActive === true && // Only check against active brands
             !brand.deleted; // Exclude deleted brands
    });
    
    console.log('Found existing brand:', existingBrand);
    
    if (existingBrand) {
      setNameError("Brand name already exists");
      return false;
    }
    
    setNameError("");
    return true;
  };

  const validateGSTNumber = (gstNo) => {
    if (!gstNo.trim()) {
      setGstError(""); // GST is optional
      return true;
    }
    
    if (gstNo.trim().length !== 15) {
      setGstError("GST number must be exactly 15 characters");
      return false;
    }
    
    const existingBrand = brands.find(brand => 
      brand.gstNo && 
      brand.gstNo.toLowerCase().trim() === gstNo.toLowerCase().trim() && 
      brand._id !== editingId &&
      brand.isActive === true && // Only check against active brands
      !brand.deleted // Exclude deleted brands
    );
    
    if (existingBrand) {
      setGstError("GST number already exists");
      return false;
    }
    
    setGstError("");
    return true;
  };

  // Show validation error popup
  const showValidationErrorPopup = () => {
    const errors = [];
    if (nameError) errors.push(nameError);
    if (gstError) errors.push(gstError);
    
    if (errors.length > 0) {
      setValidationErrorPopup({
        isVisible: true,
        errors: errors
      });
    }
  };

  const handleChange = (e) => {
    const { name, value, files, type, checked } = e.target;
    
    if (name === "logo") {
      setFormData({ ...formData, logo: files[0] || null });
    } else if (type === "checkbox") {
      setFormData({ ...formData, [name]: checked });
    } else {
      setFormData({ ...formData, [name]: value });
      
      // Real-time validation only for brand name
      if (name === "name") {
        validateBrandName(value);
      } else if (name === "gstNo") {
        // Clear GST error when user starts typing again
        setGstError("");
      }
    }
  };

  // Handle blur events for validation
  const handleBlur = (e) => {
    const { name, value } = e.target;
    
    if (name === "gstNo") {
      // Validate GST number when user leaves the field
      validateGSTNumber(value);
    }
  };

  const resetForm = () => {
    setFormData(initialFormData);
    setCurrentLogoUrl(null);
    setEditingId(null);
    setError("");
    setNameError("");
    setGstError("");
    setValidationErrorPopup({ isVisible: false, errors: [] });
  };

  // Clear file input after successful upload
  const clearFileInput = () => {
    const fileInput = document.querySelector('input[name="logo"]');
    if (fileInput) {
      fileInput.value = '';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Clear previous errors
    setError("");
    setNameError("");
    setGstError("");
    
    // Validate brand name
    const nameValidation = validateBrandName(formData.name);
    if (!nameValidation) {
      showValidationErrorPopup();
      return;
    }
    
    // Validate GST number if provided
    let gstValidation = true;
    if (formData.gstNo && formData.gstNo.trim()) {
      gstValidation = validateGSTNumber(formData.gstNo);
      if (!gstValidation) {
        showValidationErrorPopup();
        return;
      }
    }
    
    // Final validation check
    if (!nameValidation || !gstValidation) {
      showValidationErrorPopup();
      return;
    }

    try {
      setLoading(true);
      setError("");
      setSuccess("");

      let brandData;
      
      if (formData.logo) {
        // Use FormData for file upload (new logo selected)
        brandData = new FormData();
        brandData.append('name', formData.name.trim());
        brandData.append('gstNo', formData.gstNo.trim() || '');
        brandData.append('companyName', formData.companyName.trim() || '');
        brandData.append('address', formData.address.trim() || '');
        brandData.append('isActive', formData.isActive ? 'true' : 'false');
        brandData.append('logo', formData.logo);
      } else if (editingId && currentLogoUrl) {
        // Use JSON for update without logo change (keep existing logo)
        brandData = {
          name: formData.name.trim(),
          gstNo: formData.gstNo.trim() || null,
          companyName: formData.companyName.trim() || null,
          address: formData.address.trim() || null,
          isActive: formData.isActive
        };
      } else {
        // Use JSON for new brand without logo
        brandData = {
          name: formData.name.trim(),
          gstNo: formData.gstNo.trim() || null,
          companyName: formData.companyName.trim() || null,
          address: formData.address.trim() || null,
          isActive: formData.isActive
        };
      }

      if (editingId) {
        // Update brand
        await api.put(`/brands/${editingId}`, brandData);
        
        // Check if brand status changed
        const originalBrand = brands.find(b => b._id === editingId);
        const statusChanged = originalBrand && originalBrand.isActive !== formData.isActive;
        
        let action;
        if (formData.logo) {
          action = "updated with new logo";
        } else if (statusChanged && formData.isActive) {
          action = "reactivated and updated";
        } else if (statusChanged && !formData.isActive) {
          action = "deactivated and updated";
        } else {
          action = "updated successfully";
        }
        
        const successMessage = `✅ Brand "${formData.name.trim()}" has been ${action}!`;
        setSuccess(successMessage);
      } else {
        // Create brand
        await api.post('/brands', brandData);
        const action = formData.logo ? "created with logo" : "created successfully";
        const successMessage = `✅ Brand "${formData.name.trim()}" has been ${action}!`;
        setSuccess(successMessage);
      }

      // Refresh brands list
      await fetchBrands();
      resetForm();
      clearFileInput();
      
    } catch (err) {
      const action = editingId ? "update" : "create";
      setError(`❌ Failed to ${action} brand "${formData.name.trim()}". ${err.response?.data?.msg || 'Please try again.'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (brand) => {
    setFormData({
      ...initialFormData,
      name: brand.name || "",
      gstNo: brand.gstNo || "",
      companyName: brand.companyName || "",
      address: brand.address || "",
      isActive: Boolean(brand.isActive),
      logo: null
    });
    setCurrentLogoUrl(brand.logo || null);
    setEditingId(brand._id);
    setError("");
    setSuccess("");
    setNameError("");
    setGstError("");
    
    // Scroll to form and focus on brand name input
    setTimeout(() => {
      if (formRef.current) {
        formRef.current.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start' 
        });
      }
      if (brandNameInputRef.current) {
        brandNameInputRef.current.focus();
      }
    }, 100);
  };

  const handleDelete = async (brandId) => {
    const brand = brands.find(b => b._id === brandId);
    const isAlreadyDeleted = brand?.deleted;
    
    let message;
    let isPermanentDelete = false;
    
    if (isAlreadyDeleted) {
      message = "This brand is already marked as deleted. Click OK to permanently remove it from the database. This action cannot be undone.";
      isPermanentDelete = true;
    } else {
      message = "This will mark the brand as inactive and add a deleted flag. Click OK to continue.";
      isPermanentDelete = false;
    }
    
    setDeletePopup({
      isVisible: true,
      brandId,
      message,
      isPermanentDelete,
      action: "delete"
    });
  };

  const handleDeleteConfirm = async () => {
    const { brandId, isPermanentDelete } = deletePopup;
    const brand = brands.find(b => b._id === brandId);
    
    try {
      setLoading(true);
      setSuccess("");
      setError("");
      
      if (isPermanentDelete) {
        await api.delete(`/brands/${brandId}/hard`);
        setSuccess(`🗑️ Brand "${brand.name}" has been permanently deleted from the database.`);
      } else {
        // Soft delete - call the delete endpoint which will set deleted flag
        await api.delete(`/brands/${brandId}`);
        setSuccess(`⏸️ Brand "${brand.name}" has been marked as deleted and inactive.`);
      }
      
      await fetchBrands();
    } catch (err) {
      const action = isPermanentDelete ? "permanently delete" : "mark as deleted";
      setError(`❌ Failed to ${action} brand "${brand.name}". ${err.response?.data?.msg || 'Please try again.'}`);
    } finally {
      setLoading(false);
      setDeletePopup({
        isVisible: false,
        brandId: null,
        message: "",
        isPermanentDelete: false,
        action: "delete"
      });
    }
  };

  const handleDeleteCancel = () => {
    setDeletePopup({
      isVisible: false,
      brandId: null,
      message: "",
      isPermanentDelete: false,
      action: "delete"
    });
  };

  // Revert deleted brand
  const handleRevert = async (brandId) => {
    const brand = brands.find(b => b._id === brandId);
    
    if (!brand) {
      setError("Brand not found");
      return;
    }

    if (!brand.deleted) {
      setError("This brand is not deleted");
      return;
    }

    setDeletePopup({
      isVisible: true,
      brandId,
      message: `Are you sure you want to restore the brand "${brand.name}"? This will make it active again.`,
      isPermanentDelete: false,
      action: "revert"
    });
  };

  // Handle revert confirmation
  const handleRevertConfirm = async () => {
    const { brandId } = deletePopup;
    const brand = brands.find(b => b._id === brandId);
    
    try {
      setLoading(true);
      setSuccess("");
      setError("");

      // Check if there's already an active or inactive brand with the same name
      const existingBrand = brands.find(b => 
        b._id !== brandId && // Exclude current brand being reverted
        b.name.toLowerCase().trim() === brand.name.toLowerCase().trim() && // Same name
        !b.deleted // Not deleted (active or inactive)
      );

      if (existingBrand) {
        const status = existingBrand.isActive ? 'Active' : 'Inactive';
        const suggestion = existingBrand.isActive ? 
          `Consider deleting the active brand "${existingBrand.name}" first, or use a different name for the restored brand.` :
          `Consider deleting the inactive brand "${existingBrand.name}" first, or use a different name for the restored brand.`;
        
        setError(`❌ Cannot restore brand "${brand.name}". A ${status.toLowerCase()} brand with this name already exists. ${suggestion}`);
        setLoading(false);
        setDeletePopup({
          isVisible: false,
          brandId: null,
          message: "",
          isPermanentDelete: false,
          action: "delete"
        });
        return;
      }

      // Revert the brand by setting deleted to false and isActive to true
      await api.put(`/brands/${brandId}`, {
        name: brand.name,
        gstNo: brand.gstNo,
        companyName: brand.companyName,
        address: brand.address,
        isActive: true,
        deleted: false
      });

      setSuccess(`✅ Brand "${brand.name}" has been restored and is now active!`);
      await fetchBrands();
    } catch (err) {
      setError(`❌ Failed to restore brand "${brand.name}". ${err.response?.data?.msg || 'Please try again.'}`);
    } finally {
      setLoading(false);
      setDeletePopup({
        isVisible: false,
        brandId: null,
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
      brandId: null,
      message: "",
      isPermanentDelete: false,
      action: "delete"
    });
  };

  const handleCancel = () => {
    resetForm();
  };

  const handleImageClick = (imageUrl) => {
    if (imageUrl) {
      setImagePopup({ isVisible: true, imageUrl });
    }
  };

  const handleCloseImagePopup = () => {
    setImagePopup({ isVisible: false, imageUrl: null });
  };

  // Generate next brand ID
  const generateNextBrandId = useCallback(() => {
    if (brands.length === 0) {
      return 'PPSBDNM1001';
    }
    
    // Find the highest existing brand ID number
    const existingIds = brands
      .map(brand => brand.brandId)
      .filter(id => id && id.startsWith('PPSBDNM'))
      .map(id => {
        const match = id.match(/PPSBDNM(\d+)/);
        return match ? parseInt(match[1]) : 0;
      });
    
    const maxNumber = Math.max(...existingIds, 1000);
    const nextNumber = maxNumber + 1;
    return `PPSBDNM${nextNumber}`;
  }, [brands]);

  // Get current brand ID for display
  const getCurrentBrandId = useCallback(() => {
    if (editingId) {
      return brands.find(b => b._id === editingId)?.brandId || 'N/A';
    }
    return generateNextBrandId();
  }, [editingId, brands, generateNextBrandId]);

  return (
    <div className="paddingAll20">
      {/* Header */}
      <PageHeader
        title="Brand Management"
        subtitle="Manage your brand information and company details"
        isEditing={!!editingId}
        editText="Edit Brand"
        createText="Add New Brand"
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

      {/* Brand Form */}
      <div className="brandFormContainer paddingAll32 appendBottom30" ref={formRef}>
        {/* Form Validation Errors */}
        {(nameError || gstError) && (
          <div className="formValidationErrors appendBottom24">
            <div className="validationErrorHeader">
              <span className="validationErrorIcon">⚠️</span>
              <span className="validationErrorTitle">Please fix the following errors:</span>
            </div>
            <div className="validationErrorList">
              {nameError && (
                <div className="validationErrorItem">
                  <span className="validationErrorBullet">•</span>
                  <span className="validationErrorText">{nameError}</span>
                </div>
              )}
              {gstError && (
                <div className="validationErrorItem">
                  <span className="validationErrorBullet">•</span>
                  <span className="validationErrorText">{gstError}</span>
                </div>
              )}
            </div>
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="brandForm">
          {/* Brand ID Display Field */}
          <div className="makeFlex row gap10">
            <div className="widthHalf">
              <FormField
                type="text"
                name="brandId"
                label="Brand ID"
                value={getCurrentBrandId()}
                onChange={() => {}} // No change handler - read-only
                placeholder="Brand ID will be auto-generated"
                disabled={true}
                info="Brand ID is automatically generated in the format PPSBDNM1001, PPSBDNM1002, etc. This field cannot be edited."
              />
            </div>
          </div>
          
          <div className="makeFlex row gap10">
            <div className="fullWidth">
              <FormField
                ref={brandNameInputRef}
                type="text"
                name="name"
                label="Brand Name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Enter Brand Name"
                required={true}
                info="Brand ID will be auto-generated (e.g., PPSBDNM1001, PPSBDNM1002). Duplicate names are checked in real-time."
              />
              {nameError && (
                <div className="formError appendTop4">
                  <span className="errorText">{nameError}</span>
                </div>
              )}
            </div>
          </div>
          <div className="makeFlex row gap10">
            <div className="fullWidth">
              {editingId && currentLogoUrl ? (
                <div className="currentImageInfo">
                  <label className="formLabel appendBottom8">Current Logo</label>
                  <div className="currentImageDisplay makeFlex alignCenter gap12">
                    <img 
                      src={currentLogoUrl} 
                      alt="Current brand logo" 
                      className="currentImagePreview"
                      style={{ 
                        width: '60px', 
                        height: '60px', 
                        objectFit: 'cover',
                        borderRadius: '8px',
                        border: '2px solid #e5e7eb'
                      }}
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                    <div className="currentImageDetails">
                      <p className="font14 fontSemiBold blackText">Current logo is set</p>
                      <p className="font12 grayText">Upload a new file to replace it</p>
                    </div>
                  </div>
                  <FormField
                    type="file"
                    name="logo"
                    label="Replace Logo (Optional)"
                    onChange={handleChange}
                    accept="image/*"
                    info="Upload a new image to replace the current logo"
                  />
                </div>
              ) : (
                <FormField
                  type="file"
                  name="logo"
                  label="Brand Logo"
                  onChange={handleChange}
                  accept="image/*"
                  info="Supported formats: JPG, PNG, GIF (Max size: 5MB)"
                />
              )}
            </div>
          </div>
          <div className="makeFlex row gap16">
            <div className="flexOne">
              <FormField
                type="text"
                name="gstNo"
                label="GST Number"
                value={formData.gstNo}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="Enter GST Number (15 characters)"
                uppercase={true}
                alphanumeric={true}
                maxLength={15}
                info="GST number must be exactly 15 characters (automatically converted to uppercase, alphanumeric only). Validation occurs when you leave this field."
              />
              {gstError && (
                <div className="formError appendTop4">
                  <span className="errorText">{gstError}</span>
                </div>
              )}
            </div>
            
            <div className="flexOne">
              <FormField
                type="text"
                name="companyName"
                label="Company Name"
                value={formData.companyName}
                onChange={handleChange}
                placeholder="Enter Company Name"
              />
            </div>
          </div>

          <div className="makeFlex row gap10">
            <div className="fullWidth">
              <FormField
                type="textarea"
                name="address"
                label="Company Address"
                value={formData.address}
                onChange={handleChange}
                placeholder="Enter Company Address"
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
              <p className="negativeMarginTop10">Check this box to keep the brand active, uncheck to mark as inactive</p>
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
                <span>{editingId ? "Update Brand" : "Create Brand"}</span>
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
          </div>
        </form>
      </div>

      {/* Brands List */}
      <div className="brandsListContainer paddingAll32">
        <div className="listHeader makeFlex spaceBetween end appendBottom24">
          <div className="leftSection">
            <h2 className="listTitle font30 fontBold blackText appendBottom16">Brands ({filteredBrands.length})</h2>
            <StatusFilter
              statusFilter={statusFilter}
              onStatusChange={setStatusFilter}
              counts={calculateStandardStatusCounts(brands)}
              disabled={loading}
            />
          </div>
          <div className="rightSection makeFlex end gap10">
            <SearchField
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search brands..."
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

        {filteredBrands.length === 0 && !loading ? (
          <div className="emptyState textCenter paddingAll60">
            <div className="emptyIcon appendBottom16">🏢</div>
            <h3 className="font22 fontSemiBold grayText appendBottom8">No Brands Found</h3>
            <p className="font16 grayText appendBottom16">Start by adding your first brand above</p>
            <div className="font14 grayText">
              <p>💡 <strong>Brand ID Format:</strong> PPSBDNM1001, PPSBDNM1002, etc.</p>
              <p>Brand IDs are automatically generated when you create a new brand.</p>
            </div>
          </div>
        ) : (
          <>
            {/* Card View */}
            {viewMode === 'card' && (
              <div className="brandsGrid">
                {displayedCards.map((brand) => (
                  <EntityCard
                    key={brand._id}
                    entity={brand}
                    logoField="logo"
                    nameField="name"
                    idField="_id"
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    loading={loading}
                    imagePlaceholderColor={generateBrandColor(brand._id, brand.name)}
                    renderHeader={(brand) => (
                      <EntityCardHeader
                        entity={brand}
                        imageField="logo"
                        titleField="name"
                        dateField="createdAt"
                        generateColor={generateBrandColor}
                        onImageClick={handleImageClick}
                      />
                    )}
                    renderDetails={(brand) => (
                      <>
                        <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                          <span className="detailLabel font14 fontSemiBold grayText textUppercase">Brand ID:</span>
                          <span className="detailValue font14 blackText appendLeft6">{brand.brandId || 'N/A'}</span>
                        </div>
                        {brand.gstNo && (
                          <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                            <span className="detailLabel font14 fontSemiBold grayText textUppercase">GST:</span>
                            <span className="detailValue font14 blackText appendLeft6">{brand.gstNo}</span>
                          </div>
                        )}
                        <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                          <span className="detailLabel font14 fontSemiBold grayText textUppercase">Name:</span>
                          <span className="detailValue font14 blackText appendLeft6">{brand.name}</span>
                        </div>
                        {brand.address && (
                          <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                            <span className="detailLabel font14 fontSemiBold grayText textUppercase">Address:</span>
                            <span className="detailValue font14 blackText appendLeft6">{brand.address}</span>
                          </div>
                        )}
                        <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                          <span className="detailLabel font14 fontSemiBold grayText textUppercase">Status:</span>
                          <span className={`detailValue font14 ${brand.deleted ? 'deleted' : (brand.isActive ? 'greenText' : 'inactive')} appendLeft6`}>
                            {brand.deleted ? 'Deleted' : (brand.isActive ? 'Active' : 'Inactive')}
                          </span>
                        </div>
                      </>
                    )}
                    renderActions={(brand) => (
                      <ActionButtons
                        onEdit={brand.deleted ? undefined : () => handleEdit(brand)}
                        onDelete={() => handleDelete(brand._id)}
                        onRevert={brand.deleted ? () => handleRevert(brand._id) : undefined}
                        loading={loading}
                        size="normal"
                        editText="✏️ Edit"
                        deleteText={brand.deleted ? "🗑️ Final Del" : "🗑️ Delete"}
                        revertText="🔄 Revert Back"
                        editTitle="Edit Brand"
                        deleteTitle={brand.deleted ? "Final Del" : "Mark brand as deleted"}
                        revertTitle="Restore this brand back to active"
                        editDisabled={brand.deleted}
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
                        <th className="tableHeader">Logo</th>
                        <th className="tableHeader">Brand ID</th>
                        <th className="tableHeader">Name</th>
                        <th className="tableHeader">Company</th>
                        <th className="tableHeader">GST No</th>
                        <th className="tableHeader">Address</th>
                        <th className="tableHeader">Status</th>
                        <th className="tableHeader">Created</th>
                        <th className="tableHeader">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentBrands.map((brand) => (
                        <tr key={brand._id} className="tableRow">
                          <td className="tableCell width5">
                            <div className="tableLogo">
                              {brand.logo ? (
                                <img
                                  src={brand.logo}
                                  alt={brand.name}
                                  className="tableLogoImage"
                                />
                              ) : (
                                <div className="tableLogoPlaceholder" style={{ backgroundColor: generateBrandColor(brand._id, brand.name) }}>
                                  {brand.name.charAt(0).toUpperCase()}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="tableCell width10 font14 blackText">{brand.brandId}</td>
                          <td className="tableCell width15 font14 blackText">{brand.name}</td>
                          <td className="tableCell width15 font14 blackText">{brand.companyName}</td>
                          <td className="tableCell width15 font14 blackText">{brand.gstNo}</td>
                          <td className="tableCell width25 font14 blackText">{brand.address ? (brand.address.length > 30 ? `${brand.address.substring(0, 30)}...` : brand.address) : '-'}</td>
                          <td className="tableCell width5 font14 blackText">
                            <span className={`statusText ${brand.deleted ? 'deleted' : (brand.isActive ? 'active' : 'inactive')}`}>
                              {brand.deleted ? 'Deleted' : (brand.isActive ? 'Active' : 'Inactive')}
                            </span>
                          </td>
                          <td className="tableCell width5 font14 blackText">{new Date(brand.createdAt).toLocaleDateString()}</td>
                          <td className="tableCell width5">
                            <div className="tableActions makeFlex gap8">
                              <ActionButtons
                                onEdit={brand.deleted ? undefined : () => handleEdit(brand)}
                                onDelete={() => handleDelete(brand._id)}
                                onRevert={brand.deleted ? () => handleRevert(brand._id) : undefined}
                                loading={loading}
                                size="small"
                                editText="✏️"
                                deleteText={brand.deleted ? "🗑️ Final Del" : "🗑️ Delete"}
                                revertText="🔄 Revert Back"
                                editTitle="Edit Brand"
                                deleteTitle={brand.deleted ? "Final Del" : "Mark brand as deleted"}
                                revertTitle="Restore this brand back to active"
                                editDisabled={brand.deleted}
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

      {/* Image Popup (logo click in card view) */}
      {imagePopup.isVisible && (
        <div
          className="imagePopupOverlay"
          onClick={handleCloseImagePopup}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            cursor: 'pointer'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              maxWidth: '90vw',
              maxHeight: '90vh',
              backgroundColor: 'white',
              borderRadius: '8px',
              padding: '20px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
            }}
          >
            <button
              type="button"
              onClick={handleCloseImagePopup}
              style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                background: '#ff4444',
                color: 'white',
                border: 'none',
                borderRadius: '50%',
                width: '30px',
                height: '30px',
                fontSize: '20px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10001
              }}
              aria-label="Close"
            >
              ×
            </button>
            <img
              src={imagePopup.imageUrl}
              alt="Brand logo"
              style={{
                maxWidth: '100%',
                maxHeight: '85vh',
                objectFit: 'contain',
                display: 'block'
              }}
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          </div>
        </div>
      )}

      <DeleteConfirmationPopup
        isVisible={deletePopup.isVisible}
        message={deletePopup.message}
        onConfirm={deletePopup.action === "delete" ? handleDeleteConfirm : handleRevertConfirm}
        onCancel={deletePopup.action === "delete" ? handleDeleteCancel : handleRevertCancel}
        confirmText={deletePopup.action === "delete" ? (deletePopup.isPermanentDelete ? "Final Del" : "Delete") : "Restore"}
        cancelText="Cancel"
        loading={loading}
      />

      <ValidationErrorPopup
        isVisible={validationErrorPopup.isVisible}
        errors={validationErrorPopup.errors}
        onClose={() => setValidationErrorPopup({ isVisible: false, errors: [] })}
        autoClose={true}
        autoCloseDelay={5000}
      />
    </div>
  );
};

export default BrandManager;

