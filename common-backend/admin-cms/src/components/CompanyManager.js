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

const CompanyManager = () => {
  const [companies, setCompanies] = useState([]);
  const [websites, setWebsites] = useState([]); // For website dropdown
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [viewMode, setViewMode] = useState('card'); // 'card' or 'list'
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'active', 'inactive', 'deleted'
  
  // Image popup state
  const [imagePopup, setImagePopup] = useState({
    isVisible: false,
    imageUrl: null
  });
  
  // Delete confirmation popup state
  const [deletePopup, setDeletePopup] = useState({
    isVisible: false,
    companyId: null,
    message: "",
    isPermanentDelete: false,
    action: "delete" // "delete" or "revert"
  });
  
  // Refs for scroll and focus functionality
  const formRef = useRef(null);
  const companyNameInputRef = useRef(null);
  const logoInputRef = useRef(null);
  
  // Pagination and lazy loading states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10); // For list view
  const [hasMoreCards, setHasMoreCards] = useState(true);
  const [displayedCards, setDisplayedCards] = useState([]);
  
  const [currentLogoUrl, setCurrentLogoUrl] = useState(null);

  const initialFormData = {
    name: "",
    address: {
      street: "",
      city: "",
      state: "",
      zipCode: "",
      country: ""
    },
    phone: "",
    email: "",
    websiteUrl: "", // Legacy website URL field
    websiteId: "", // Website reference (new)
    domain: "", // Domain string (alternative)
    gstNumber: "",
    panNumber: "",
    footerText: "",
    logo: null,
    isActive: true,
    isDefault: false
  };

  const [formData, setFormData] = useState(initialFormData);
  const [searchQuery, setSearchQuery] = useState(""); // Search query state

  // Validate logo dimensions (max 250x250px) and file size (max 1MB)
  const validateLogoDimensions = (file) => {
    return new Promise((resolve, reject) => {
      if (!file) {
        resolve({ isValid: true, error: "" });
        return;
      }

      // Check if it's an image file
      if (!file.type.startsWith('image/')) {
        resolve({ isValid: false, error: "Please select a valid image file" });
        return;
      }

      // Check file size (max 1MB)
      const maxSizeInBytes = 1 * 1024 * 1024; // 1MB
      if (file.size > maxSizeInBytes) {
        const fileSizeInMB = (file.size / (1024 * 1024)).toFixed(2);
        resolve({ 
          isValid: false, 
          error: `File size (${fileSizeInMB}MB) exceeds the maximum allowed size of 1MB. Please compress your image.` 
        });
        return;
      }

      const img = new Image();
      const objectUrl = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        const maxDimension = 250;
        
        if (img.width > maxDimension || img.height > maxDimension) {
          resolve({ 
            isValid: false, 
            error: `Logo dimensions (${img.width}x${img.height}px) exceed the maximum allowed size of ${maxDimension}x${maxDimension}px. Please resize your logo.` 
          });
        } else {
          resolve({ isValid: true, error: "" });
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve({ isValid: false, error: "Failed to load image. Please select a valid image file." });
      };

      img.src = objectUrl;
    });
  };

  // Helper function to normalize logo URL
  const normalizeLogoUrl = (logoUrl) => {
    if (!logoUrl) return null;
    
    if (logoUrl.startsWith('http://') || logoUrl.startsWith('https://')) {
      if (logoUrl.includes('/backend/uploads/') || logoUrl.includes('/Users/')) {
        const filename = logoUrl.split('/').pop();
        return `http://localhost:8080/uploads/${filename}`;
      }
      return logoUrl;
    }
    
    if (logoUrl.includes('/backend/uploads/') || logoUrl.includes('/Users/')) {
      const filename = logoUrl.split('/').pop();
      return `http://localhost:8080/uploads/${filename}`;
    }
    
    if (logoUrl.startsWith('/uploads/') || logoUrl.startsWith('/')) {
      return `http://localhost:8080${logoUrl}`;
    }
    
    return `http://localhost:8080/uploads/${logoUrl}`;
  };

  // Fetch websites for dropdown
  useEffect(() => {
    const fetchWebsites = async () => {
      try {
        const response = await api.get('/websites?showInactive=false&includeDeleted=false');
        setWebsites(response.data || []);
      } catch (err) {
        console.error('Error fetching websites:', err);
      }
    };
    fetchWebsites();
  }, []);

  // Fetch companies from backend
  const fetchCompanies = async () => {
    try {
      setLoading(true);
      const response = await api.get('/companies?showInactive=true&includeDeleted=true');
      
      // Process companies to ensure proper logo URLs and populate website
      const processedCompanies = response.data.map(company => {
        let logoUrl = company.logo;
        
        if (logoUrl) {
          if (logoUrl.startsWith('http://') || logoUrl.startsWith('https://')) {
            if (logoUrl.includes('/backend/uploads/') || logoUrl.includes('/Users/')) {
              const filename = logoUrl.split('/').pop();
              logoUrl = `http://localhost:8080/uploads/${filename}`;
            }
          } else if (!logoUrl.startsWith('http')) {
            if (logoUrl.includes('/backend/uploads/') || logoUrl.includes('/Users/')) {
              const filename = logoUrl.split('/').pop();
              logoUrl = `http://localhost:8080/uploads/${filename}`;
            } else if (logoUrl.startsWith('/uploads/') || logoUrl.startsWith('/')) {
              logoUrl = `http://localhost:8080${logoUrl}`;
            } else {
              logoUrl = `http://localhost:8080/uploads/${logoUrl}`;
            }
          }
        }
        
        return {
          ...company,
          logo: logoUrl
        };
      });
      
      setCompanies(processedCompanies);
      setError("");
    } catch (err) {
      setError("Failed to fetch companies");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

  // Filter companies based on search query and status
  const filteredCompanies = useMemo(() => {
    let filtered = companies;
    
    // Apply search filter
    if (searchQuery && searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(company => 
        company.name.toLowerCase().includes(query) ||
        (company.email && company.email.toLowerCase().includes(query)) ||
        (company.phone && company.phone.includes(query)) ||
        (company.gstNumber && company.gstNumber.toLowerCase().includes(query)) ||
        (company.panNumber && company.panNumber.toLowerCase().includes(query)) ||
        (company.address?.city && company.address.city.toLowerCase().includes(query)) ||
        (company.address?.state && company.address.state.toLowerCase().includes(query))
      );
    }
    
    // Apply status filter
    filtered = filterEntitiesByStatus(filtered, statusFilter);
    
    return filtered;
  }, [companies, searchQuery, statusFilter]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredCompanies.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentCompanies = filteredCompanies.slice(startIndex, endIndex);

  // Card lazy loading logic
  useEffect(() => {
    if (viewMode === 'card' && filteredCompanies.length > 0) {
      const initialCards = filteredCompanies.slice(0, 12);
      setDisplayedCards(initialCards);
      setHasMoreCards(filteredCompanies.length > 12);
      setCurrentPage(1);
    }
  }, [filteredCompanies, viewMode]);

  // Reset pagination when search query changes
  const resetPaginationForSearch = useCallback(() => {
    setCurrentPage(1);
    if (viewMode === 'card') {
      const initialCards = filteredCompanies.slice(0, 12);
      setDisplayedCards(initialCards);
      setHasMoreCards(filteredCompanies.length > 12);
    }
  }, [viewMode, filteredCompanies.length]);

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
      const nextCards = filteredCompanies.slice(currentCardCount, currentCardCount + 12);
      
      if (nextCards.length > 0) {
        setHasMoreCards(currentCardCount + nextCards.length < filteredCompanies.length);
        return [...prevCards, ...nextCards];
      } else {
        setHasMoreCards(false);
        return prevCards;
      }
    });
  }, [filteredCompanies]);

  // Reset pagination when view mode changes
  const handleViewModeChange = useCallback((mode) => {
    setViewMode(mode);
    setCurrentPage(1);
    if (mode === 'card') {
      const initialCards = filteredCompanies.slice(0, 12);
      setDisplayedCards(initialCards);
      setHasMoreCards(filteredCompanies.length > 12);
    }
  }, [filteredCompanies.length]);

  const handleChange = async (e) => {
    const { name, value, type, checked, files } = e.target;
    
    if (type === 'checkbox') {
      setFormData({ ...formData, [name]: checked });
    } else if (type === 'file') {
      // Validate logo dimensions and file size if it's a logo file
      if (files[0] && files[0].type.startsWith('image/')) {
        const validation = await validateLogoDimensions(files[0]);
        if (!validation.isValid) {
          setError(validation.error);
          // Clear the file input
          e.target.value = '';
          return;
        }
      }
      
      setFormData({ ...formData, [name]: files[0] || null });
      // Clear any previous error if validation passes
      if (error && (error.includes('dimensions') || error.includes('File size'))) {
        setError("");
      }
    } else if (name.startsWith('address.')) {
      const addressField = name.split('.')[1];
      setFormData({
        ...formData,
        address: {
          ...formData.address,
          [addressField]: value
        }
      });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const resetForm = () => {
    setFormData(initialFormData);
    setCurrentLogoUrl(null);
    setEditingId(null);
    setError("");
    // Clear file input
    if (logoInputRef.current) {
      logoInputRef.current.value = '';
    }
  };

  // Clear form after successful operations
  const clearForm = () => {
    setFormData(initialFormData);
    setCurrentLogoUrl(null);
    setEditingId(null);
    setError("");
    setSuccess("");
    // Clear file input
    if (logoInputRef.current) {
      logoInputRef.current.value = '';
    }
  };

  // Validate and Add / Update Company
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name || !formData.name.trim()) {
      setError("Company name is required");
      return;
    }

    try {
      setLoading(true);
      setSuccess("");
      setError("");

      let companyData;
      
      // Check if logo is a File object (not a string URL from existing logo)
      const hasNewLogo = formData.logo && formData.logo instanceof File;
      
      if (hasNewLogo) {
        // Use FormData for file upload
        companyData = new FormData();
        companyData.append('name', formData.name.trim());
        companyData.append('address[street]', formData.address?.street?.trim() || '');
        companyData.append('address[city]', formData.address?.city?.trim() || '');
        companyData.append('address[state]', formData.address?.state?.trim() || '');
        companyData.append('address[zipCode]', formData.address?.zipCode?.trim() || '');
        companyData.append('address[country]', formData.address?.country?.trim() || '');
        companyData.append('phone', formData.phone?.trim() || '');
        companyData.append('email', formData.email?.trim() || '');
        companyData.append('websiteUrl', formData.websiteUrl?.trim() || '');
        if (formData.websiteId) {
          companyData.append('websiteId', formData.websiteId);
        }
        if (formData.domain) {
          companyData.append('domain', formData.domain.trim().toLowerCase());
        }
        companyData.append('gstNumber', formData.gstNumber?.trim() || '');
        companyData.append('panNumber', formData.panNumber?.trim() || '');
        companyData.append('footerText', formData.footerText?.trim() || '');
        companyData.append('isActive', formData.isActive ? 'true' : 'false');
        companyData.append('isDefault', formData.isDefault ? 'true' : 'false');
        companyData.append('logo', formData.logo);
      } else {
        // Use JSON for better boolean handling
        companyData = {
          name: formData.name.trim(),
          address: {
            street: formData.address?.street?.trim() || null,
            city: formData.address?.city?.trim() || null,
            state: formData.address?.state?.trim() || null,
            zipCode: formData.address?.zipCode?.trim() || null,
            country: formData.address?.country?.trim() || null
          },
          phone: formData.phone?.trim() || null,
          email: formData.email?.trim() || null,
          websiteUrl: formData.websiteUrl?.trim() || null,
          websiteId: formData.websiteId || null,
          domain: formData.domain?.trim().toLowerCase() || null,
          gstNumber: formData.gstNumber?.trim() || null,
          panNumber: formData.panNumber?.trim() || null,
          footerText: formData.footerText?.trim() || null,
          logo: currentLogoUrl || null, // Keep existing logo URL if no new file
          isActive: formData.isActive,
          isDefault: formData.isDefault
        };
      }

      if (editingId) {
        // Update company
        await api.put(`/companies/${editingId}`, companyData);
        setSuccess(`✅ Company "${formData.name.trim()}" has been updated successfully!`);
      } else {
        // Create company
        await api.post('/companies', companyData);
        setSuccess(`✅ Company "${formData.name.trim()}" has been created successfully!`);
      }

      // Refresh companies list
      await fetchCompanies();
      
      // Reset form after successful submission (for both add and edit)
      resetForm();
      
    } catch (err) {
      console.error('Error submitting company:', err);
      const errorMsg = err.response?.data?.msg || err.message || 'Please try again.';
      setError(`❌ Failed to ${editingId ? 'update' : 'create'} company. ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (company) => {
    setFormData({
      ...initialFormData,
      name: company.name || "",
      address: {
        street: company.address?.street || "",
        city: company.address?.city || "",
        state: company.address?.state || "",
        zipCode: company.address?.zipCode || "",
        country: company.address?.country || ""
      },
      phone: company.phone || "",
      email: company.email || "",
      websiteUrl: company.websiteUrl || "",
      websiteId: company.website?._id || company.website || "",
      domain: company.domain || "",
      gstNumber: company.gstNumber || "",
      panNumber: company.panNumber || "",
      footerText: company.footerText || "",
      logo: null, // Reset logo field for new file selection
      isActive: company.isActive !== undefined ? company.isActive : true,
      isDefault: company.isDefault !== undefined ? company.isDefault : false
    });
    setCurrentLogoUrl(company.logo ? normalizeLogoUrl(company.logo) : null);
    setEditingId(company._id || company.id);
    setError("");
    setSuccess("");
    
    // Scroll to form and focus on company name input
    setTimeout(() => {
      if (formRef.current) {
        formRef.current.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start' 
        });
      }
      if (companyNameInputRef.current) {
        companyNameInputRef.current.focus();
      }
    }, 100);
  };

  const handleDelete = (companyId) => {
    const company = companies.find(c => c._id === companyId);
    const isAlreadyDeleted = company?.deleted;
    
    let message;
    let isPermanentDelete = false;
    
    if (isAlreadyDeleted) {
      message = "This company is already marked as deleted. Click OK to permanently remove it from the database. This action cannot be undone.";
      isPermanentDelete = true;
    } else {
      message = "This will mark the company as inactive and add a deleted flag. Click OK to continue.";
      isPermanentDelete = false;
    }
    
    setDeletePopup({
      isVisible: true,
      companyId,
      message,
      isPermanentDelete,
      action: "delete"
    });
  };

  // Handle delete confirmation
  const handleDeleteConfirm = async () => {
    const { companyId, isPermanentDelete } = deletePopup;
    const company = companies.find(c => c._id === companyId);
    
    try {
      setLoading(true);
      setSuccess("");
      setError("");
      
      if (isPermanentDelete) {
        await api.delete(`/companies/${companyId}/hard`);
        setSuccess(`🗑️ Company "${company.name}" has been permanently deleted from the database.`);
      } else {
        await api.delete(`/companies/${companyId}`);
        setSuccess(`⏸️ Company "${company.name}" has been marked as deleted and inactive.`);
      }
      
      await fetchCompanies();
    } catch (err) {
      const action = isPermanentDelete ? "permanently delete" : "mark as deleted";
      setError(`❌ Failed to ${action} company "${company.name}". ${err.response?.data?.msg || 'Please try again.'}`);
    } finally {
      setLoading(false);
      setDeletePopup({
        isVisible: false,
        companyId: null,
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
      companyId: null,
      message: "",
      isPermanentDelete: false,
      action: "delete"
    });
  };

  // Revert deleted company
  const handleRevert = async (companyId) => {
    const company = companies.find(c => c._id === companyId);
    
    if (!company) {
      setError("Company not found");
      return;
    }

    if (!company.deleted) {
      setError("This company is not deleted");
      return;
    }

    setDeletePopup({
      isVisible: true,
      companyId,
      message: `Are you sure you want to restore the company "${company.name}"? This will make it active again.`,
      isPermanentDelete: false,
      action: "revert"
    });
  };

  // Handle revert confirmation
  const handleRevertConfirm = async () => {
    const { companyId } = deletePopup;
    const company = companies.find(c => c._id === companyId);
    
    try {
      setLoading(true);
      setSuccess("");
      setError("");

      // Revert the company by setting deleted to false and isActive to true
      await api.put(`/companies/${companyId}`, {
        name: company.name,
        address: company.address || {},
        phone: company.phone || null,
        email: company.email || null,
        website: company.website || null,
        gstNumber: company.gstNumber || null,
        panNumber: company.panNumber || null,
        footerText: company.footerText || null,
        logo: company.logo || null,
        isActive: true,
        isDefault: company.isDefault || false,
        deleted: false
      });

      setSuccess(`✅ Company "${company.name}" has been restored and is now active!`);
      await fetchCompanies();
    } catch (err) {
      setError(`❌ Failed to restore company "${company.name}". ${err.response?.data?.msg || 'Please try again.'}`);
    } finally {
      setLoading(false);
      setDeletePopup({
        isVisible: false,
        companyId: null,
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
      companyId: null,
      message: "",
      isPermanentDelete: false,
      action: "delete"
    });
  };

  const handleCancel = () => {
    resetForm();
  };

  // Handle image click to show popup
  const handleImageClick = (imageUrl) => {
    if (imageUrl) {
      setImagePopup({
        isVisible: true,
        imageUrl: imageUrl
      });
    }
  };

  // Handle close image popup
  const handleCloseImagePopup = () => {
    setImagePopup({
      isVisible: false,
      imageUrl: null
    });
  };

  // Handle remove logo
  const handleRemoveLogo = () => {
    setFormData({ ...formData, logo: null });
    setCurrentLogoUrl(null);
    if (logoInputRef.current) {
      logoInputRef.current.value = '';
    }
  };

  return (
    <div className="paddingAll20">
      {/* Header */}
      <PageHeader
        title="Company Management"
        subtitle="Manage company details for invoices and shipping labels"
        isEditing={!!editingId}
        editText="Edit Company"
        createText="Add New Company"
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

      {/* Company Form */}
      <div className="brandFormContainer paddingAll32 appendBottom30" ref={formRef}>
        <form onSubmit={handleSubmit} className="brandForm">
          <div className="makeFlex row gap10">
            <div className="fullWidth">
              <FormField
                ref={companyNameInputRef}
                type="text"
                name="name"
                label="Company Name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Enter Company Name"
                required={true}
              />
            </div>
          </div>

          <div className="makeFlex row gap10">
            <div className="fullWidth">
              <FormField
                type="text"
                name="address.street"
                label="Street Address"
                value={formData.address?.street || ''}
                onChange={handleChange}
                placeholder="Enter street address"
              />
            </div>
          </div>

          <div className="makeFlex row gap10">
            <div className="fullWidth">
              <FormField
                type="text"
                name="address.city"
                label="City"
                value={formData.address?.city || ''}
                onChange={handleChange}
                placeholder="Enter city"
              />
            </div>
            <div className="fullWidth">
              <FormField
                type="text"
                name="address.state"
                label="State"
                value={formData.address?.state || ''}
                onChange={handleChange}
                placeholder="Enter state"
              />
            </div>
          </div>

          <div className="makeFlex row gap10">
            <div className="fullWidth">
              <FormField
                type="text"
                name="address.zipCode"
                label="Zip Code"
                value={formData.address?.zipCode || ''}
                onChange={handleChange}
                placeholder="Enter zip code"
              />
            </div>
            <div className="fullWidth">
              <FormField
                type="text"
                name="address.country"
                label="Country"
                value={formData.address?.country || ''}
                onChange={handleChange}
                placeholder="Enter country"
              />
            </div>
          </div>

          <div className="makeFlex row gap10">
            <div className="fullWidth">
              <FormField
                type="tel"
                name="phone"
                label="Phone Number"
                value={formData.phone}
                onChange={handleChange}
                placeholder="Enter phone number"
              />
            </div>
            <div className="fullWidth">
              <FormField
                type="email"
                name="email"
                label="Email"
                value={formData.email}
                onChange={handleChange}
                placeholder="Enter email address"
              />
            </div>
          </div>

          <div className="makeFlex row gap10">
            <div className="fullWidth">
              <FormField
                type="select"
                name="websiteId"
                label="Domain (website)"
                value={formData.websiteId}
                onChange={handleChange}
                options={[
                  { value: "", label: "Select Domain (Optional)" },
                  ...websites.map(website => ({
                    value: website._id,
                    label: `${website.name} (${website.domain})`
                  }))
                ]}
                info="Select a website/domain to associate this company with. This will be used for invoices and shipping labels."
              />
            </div>
            <div className="fullWidth">
              <FormField
                type="text"
                name="domain"
                label="Domain (direct)"
                value={formData.domain}
                onChange={handleChange}
                placeholder="Or enter domain directly (e.g., example.com)"
                info="Alternative to website selection - enter domain directly"
              />
            </div>
          </div>

          <div className="makeFlex row gap10">
            <div className="fullWidth">
              <FormField
                type="text"
                name="websiteUrl"
                label="Website URL (Legacy)"
                value={formData.websiteUrl}
                onChange={handleChange}
                placeholder="Enter website URL (e.g., https://www.example.com)"
                info="Legacy field for website URL"
              />
            </div>
          </div>

          <div className="makeFlex row gap10">
            <div className="fullWidth">
              <FormField
                type="text"
                name="gstNumber"
                label="GST Number"
                value={formData.gstNumber}
                onChange={handleChange}
                placeholder="Enter GST number"
              />
            </div>
            <div className="fullWidth">
              <FormField
                type="text"
                name="panNumber"
                label="PAN Number"
                value={formData.panNumber}
                onChange={handleChange}
                placeholder="Enter PAN number"
              />
            </div>
          </div>

          <div className="makeFlex row gap10">
            <div className="fullWidth">
              <FormField
                ref={logoInputRef}
                type="file"
                name="logo"
                label="Company Logo"
                onChange={handleChange}
                accept="image/*"
                info="Supported formats: JPG, PNG, GIF, WEBP (Max size: 1MB, Max dimensions: 250x250px)"
              />
              {/* Show current logo if editing */}
              {editingId && currentLogoUrl && (
                <div className="currentImageInfo paddingTop8">
                  <div className="makeFlex spaceBetween alignCenter" style={{ marginBottom: '8px' }}>
                    <p className="font12 grayText">Current logo:</p>
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      className="btnSecondary"
                      style={{
                        padding: '4px 12px',
                        fontSize: '12px',
                        backgroundColor: '#ff4444',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      Remove Logo
                    </button>
                  </div>
                  <img 
                    src={currentLogoUrl} 
                    alt="Current company logo" 
                    className="currentImagePreview"
                    style={{ 
                      maxWidth: '150px', 
                      maxHeight: '150px', 
                      objectFit: 'contain',
                      borderRadius: '4px',
                      marginTop: '4px'
                    }}
                    onError={(e) => {
                      console.error('Current logo failed to load:', currentLogoUrl);
                      e.target.style.display = 'none';
                    }}
                  />
                </div>
              )}
              {/* Show remove button for newly selected logo */}
              {!editingId && formData.logo && formData.logo instanceof File && (
                <div className="paddingTop8">
                  <button
                    type="button"
                    onClick={handleRemoveLogo}
                    className="btnSecondary"
                    style={{
                      padding: '4px 12px',
                      fontSize: '12px',
                      backgroundColor: '#ff4444',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    Remove Selected Logo
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="makeFlex row gap10">
            <div className="fullWidth">
              <FormField
                type="textarea"
                name="footerText"
                label="Footer Text (for invoices)"
                value={formData.footerText}
                onChange={handleChange}
                placeholder="Enter footer text to display on invoices (e.g., Thank you for your business!)"
                rows={3}
              />
            </div>
          </div>

          <div className="makeFlex row gap10">
            <div className="makeFlex column flexOne appendBottom16">
              <label className="formLabel appendBottom10">Options:</label>
              <label className="formLabel appendBottom8 makeFlex gap10">
                <FormField
                  type="checkbox"
                  name="isDefault"
                  checked={formData.isDefault}
                  onChange={handleChange}
                />
                Set as Default Company
              </label>
              <p className="negativeMarginTop10 font12 grayText">Default company will be used for invoices and shipping labels</p>
              <label className="formLabel appendBottom8 makeFlex gap10">
                <FormField
                  type="checkbox"
                  name="isActive"
                  checked={formData.isActive}
                  onChange={handleChange}
                />
                Active
              </label>
              <p className="negativeMarginTop10">Check this box to keep the company active, uncheck to mark as inactive</p>
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
                <span>{editingId ? "Update Company" : "Add Company"}</span>
              )}
            </button>
            
            {(editingId || (!editingId && (formData.name || formData.email || formData.phone))) && (
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
                Add Another Company
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Companies List */}
      <div className="brandsListContainer paddingAll32">
        <div className="listHeader makeFlex spaceBetween end appendBottom24">
          <div className="leftSection">
            <h2 className="listTitle font30 fontBold blackText appendBottom16">Companies ({filteredCompanies?.length || 0})</h2>
            <StatusFilter
              statusFilter={statusFilter}
              onStatusChange={setStatusFilter}
              counts={calculateStandardStatusCounts(companies)}
              disabled={loading}
            />
          </div>
          <div className="rightSection makeFlex end gap10">
            <SearchField
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search companies..."
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

        {filteredCompanies.length === 0 && !loading ? (
          <div className="emptyState textCenter paddingAll60">
            <div className="emptyIcon appendBottom16">🏢</div>
            <h3 className="font22 fontSemiBold grayText appendBottom8">No Companies Found</h3>
            <p className="font16 grayText">Start by adding your first company above</p>
          </div>
        ) : (
          <>
            {/* Card View */}
            {viewMode === 'card' && (
              <div className="brandsGrid">
                {displayedCards.map((company) => {
                  const fullAddress = [
                    company.address?.street,
                    company.address?.city,
                    company.address?.state,
                    company.address?.zipCode,
                    company.address?.country
                  ].filter(Boolean).join(', ') || 'N/A';

                  return (
                    <EntityCard
                      key={company._id || company.id}
                      entity={company}
                      logoField="logo"
                      nameField="name"
                      idField="_id"
                      onEdit={company.deleted ? undefined : handleEdit}
                      onDelete={handleDelete}
                      onRevert={company.deleted ? () => handleRevert(company._id || company.id) : undefined}
                      loading={loading}
                      imagePlaceholderColor={generateEntityColor(company._id || company.id, company.name)}
                      renderHeader={(company) => (
                        <EntityCardHeader
                          entity={{
                            ...company,
                            name: `${company.name}${company.isDefault ? ' (Default)' : ''}`
                          }}
                          imageField="logo"
                          titleField="name"
                          dateField="createdAt"
                          generateColor={generateEntityColor}
                          onImageClick={handleImageClick}
                        />
                      )}
                      renderDetails={(company) => {
                        return (
                          <>
                            <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                              <span className="detailLabel font14 fontSemiBold grayText textUppercase">Company ID:</span>
                              <span className="detailValue font14 blackText appendLeft6">{company._id || 'N/A'}</span>
                            </div>
                            <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                              <span className="detailLabel font14 fontSemiBold grayText textUppercase">Address:</span>
                              <span className="detailValue font14 blackText appendLeft6">{fullAddress}</span>
                            </div>
                            {company.phone && (
                              <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                                <span className="detailLabel font14 fontSemiBold grayText textUppercase">Phone:</span>
                                <span className="detailValue font14 blackText appendLeft6">{company.phone}</span>
                              </div>
                            )}
                            {company.email && (
                              <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                                <span className="detailLabel font14 fontSemiBold grayText textUppercase">Email:</span>
                                <span className="detailValue font14 blackText appendLeft6">{company.email}</span>
                              </div>
                            )}
                            {company.websiteUrl && (
                              <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                                <span className="detailLabel font14 fontSemiBold grayText textUppercase">Website URL:</span>
                                <span className="detailValue font14 blackText appendLeft6">{company.websiteUrl}</span>
                              </div>
                            )}
                            {(company.domain || company.website?.domain || company.website?.name) && (
                              <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                                <span className="detailLabel font14 fontSemiBold grayText textUppercase">Domain:</span>
                                <span className="detailValue font14 blackText appendLeft6">
                                  {company.domain || company.website?.domain || (company.website?.name ? `${company.website.name} (${company.website.domain})` : '')}
                                </span>
                              </div>
                            )}
                            {company.gstNumber && (
                              <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                                <span className="detailLabel font14 fontSemiBold grayText textUppercase">GST Number:</span>
                                <span className="detailValue font14 blackText appendLeft6">{company.gstNumber}</span>
                              </div>
                            )}
                            {company.panNumber && (
                              <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                                <span className="detailLabel font14 fontSemiBold grayText textUppercase">PAN Number:</span>
                                <span className="detailValue font14 blackText appendLeft6">{company.panNumber}</span>
                              </div>
                            )}
                            <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                              <span className="detailLabel font14 fontSemiBold grayText textUppercase">Default:</span>
                              <span className={`detailValue font14 ${company.isDefault ? 'greenText' : 'grayText'} appendLeft6`}>
                                {company.isDefault ? 'Yes' : 'No'}
                              </span>
                            </div>
                            <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                              <span className="detailLabel font14 fontSemiBold grayText textUppercase">Status:</span>
                              <span className={`detailValue font14 ${company.deleted ? 'deleted' : (company.isActive ? 'greenText' : 'inactive')} appendLeft6`}>
                                {company.deleted ? 'Deleted' : (company.isActive ? 'Active' : 'Inactive')}
                              </span>
                            </div>
                          </>
                        );
                      }}
                      renderActions={(company) => (
                        <ActionButtons
                          onEdit={company.deleted ? undefined : () => handleEdit(company)}
                          onDelete={() => handleDelete(company._id || company.id)}
                          onRevert={company.deleted ? () => handleRevert(company._id || company.id) : undefined}
                          loading={loading}
                          size="normal"
                          editText="✏️ Edit"
                          deleteText={company.deleted ? "🗑️ Final Del" : "🗑️ Delete"}
                          revertText="🔄 Undelete"
                          editTitle="Edit Company"
                          deleteTitle={company.deleted ? "Final Del" : "Delete Company"}
                          revertTitle="Restore Company"
                        />
                      )}
                      className="brandCard"
                    />
                  );
                })}
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
                        <th className="tableHeader">Name</th>
                        <th className="tableHeader">Email</th>
                        <th className="tableHeader">Phone</th>
                        <th className="tableHeader">Address</th>
                        <th className="tableHeader">Default</th>
                        <th className="tableHeader">Status</th>
                        <th className="tableHeader">Created</th>
                        <th className="tableHeader">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentCompanies.map((company) => {
                        const fullAddress = [
                          company.address?.city,
                          company.address?.state,
                          company.address?.country
                        ].filter(Boolean).join(', ') || 'N/A';

                        return (
                          <tr key={company._id || company.id} className="tableRow">
                            <td className="tableCell">
                              {company.logo ? (
                                <img
                                  src={company.logo}
                                  alt={company.name}
                                  className="tableImage"
                                  style={{ 
                                    width: '40px', 
                                    height: '40px', 
                                    objectFit: 'contain',
                                    borderRadius: '4px',
                                    cursor: 'pointer'
                                  }}
                                  onClick={() => handleImageClick(company.logo)}
                                  onError={(e) => {
                                    console.error('Logo failed to load:', company.logo);
                                    e.target.style.display = 'none';
                                  }}
                                />
                              ) : (
                                <div 
                                  className="tableImagePlaceholder"
                                  style={{
                                    width: '40px',
                                    height: '40px',
                                    backgroundColor: generateEntityColor(company._id || company.id, company.name),
                                    borderRadius: '4px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'white',
                                    fontSize: '12px',
                                    fontWeight: 'bold'
                                  }}
                                >
                                  {company.name.charAt(0).toUpperCase()}
                                </div>
                              )}
                            </td>
                            <td className="tableCell">
                              <span className="brandNameText">{company.name}</span>
                              {company.isDefault && <span className="font12 grayText"> (Default)</span>}
                            </td>
                            <td className="tableCell">
                              <span className="addressText">{company.email || '-'}</span>
                            </td>
                            <td className="tableCell">
                              <span className="addressText">{company.phone || '-'}</span>
                            </td>
                            <td className="tableCell">
                              <span className="addressText" title={fullAddress}>
                                {fullAddress.length > 30 ? `${fullAddress.substring(0, 30)}...` : fullAddress}
                              </span>
                            </td>
                            <td className="tableCell">
                              <span className={`statusText ${company.isDefault ? 'active' : 'inactive'}`}>
                                {company.isDefault ? 'Yes' : 'No'}
                              </span>
                            </td>
                            <td className="tableCell">
                              <span className={`statusText ${company.deleted ? 'deleted' : (company.isActive ? 'active' : 'inactive')}`}>
                                {company.deleted ? 'Deleted' : (company.isActive ? 'Active' : 'Inactive')}
                              </span>
                            </td>
                            <td className="tableCell">
                              <span className="dateText">
                                {new Date(company.createdAt).toLocaleDateString()}
                              </span>
                            </td>
                            <td className="tableCell">
                              <div className="tableActions makeFlex gap8">
                                <ActionButtons
                                  onEdit={company.deleted ? undefined : () => handleEdit(company)}
                                  onDelete={() => handleDelete(company._id || company.id)}
                                  onRevert={company.deleted ? () => handleRevert(company._id || company.id) : undefined}
                                  loading={loading}
                                  size="small"
                                  editText="✏️"
                                  deleteText={company.deleted ? "🗑️" : "🗑️"}
                                  revertText="🔄"
                                  editTitle="Edit Company"
                                  deleteTitle={company.deleted ? "Final Del" : "Delete Company"}
                                  revertTitle="Restore Company"
                                />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
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

      {/* Image Popup */}
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
              aria-label="Close image"
            >
              ×
            </button>
            <img
              src={imagePopup.imageUrl}
              alt="Full size preview"
              style={{
                maxWidth: '100%',
                maxHeight: '85vh',
                objectFit: 'contain',
                display: 'block'
              }}
              onError={(e) => {
                console.error("Image failed to load in popup:", imagePopup.imageUrl);
                e.target.style.display = 'none';
              }}
            />
          </div>
        </div>
      )}

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

export default CompanyManager;
