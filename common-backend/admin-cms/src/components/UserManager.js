import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
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

const UserManager = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [users, setUsers] = useState([]);
  const [websites, setWebsites] = useState([]); // Store websites for lookup
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editingId, setEditingId] = useState(null);
  
  // Initialize filters from URL params
  const roleFromUrl = searchParams.get('role') || 'all';
  const filterFromUrl = searchParams.get('filter'); // 'today', 'weekly', 'monthly'
  
  // Initialize website filter from localStorage (selectedWebsite)
  const getDefaultWebsiteFilter = () => {
    try {
      const selectedWebsiteStr = localStorage.getItem('selectedWebsite');
      if (selectedWebsiteStr) {
        const selectedWebsite = JSON.parse(selectedWebsiteStr);
        return selectedWebsite?._id || 'all';
      }
    } catch (error) {
      console.error('Error reading selectedWebsite from localStorage:', error);
    }
    return 'all';
  };
  
  const [websiteFilter, setWebsiteFilter] = useState(getDefaultWebsiteFilter());
  
  // Create a lookup map for websites
  const websiteMap = useMemo(() => {
    const map = {};
    websites.forEach(website => {
      map[website._id] = website;
    });
    return map;
  }, [websites]);
  
  // Helper function to get website name
  const getWebsiteName = (user) => {
    if (!user.website) return 'N/A';
    
    // If website is populated (object), use it directly
    if (typeof user.website === 'object' && user.website.name) {
      return user.website.name;
    }
    
    // If website is an ID (string), look it up
    if (typeof user.website === 'string') {
      const website = websiteMap[user.website];
      return website ? website.name : 'N/A';
    }
    
    return 'N/A';
  };
  
  // Helper function to get website ID from user
  const getWebsiteId = (user) => {
    if (!user.website) return null;
    
    // If website is populated (object), get _id
    if (typeof user.website === 'object' && user.website._id) {
      return user.website._id;
    }
    
    // If website is an ID (string), return it
    if (typeof user.website === 'string') {
      return user.website;
    }
    
    return null;
  };
  
  const initialFormData = {
    name: "",
    email: "",
    password: "",
    phone: "",
    address: {
      street: "",
      city: "",
      state: "",
      zipCode: "",
      country: ""
    },
    role: "customer",
    picture: "",
    isActive: true,
    emailVerified: false
  };

  const [formData, setFormData] = useState(initialFormData);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState(roleFromUrl);
  
  // Image popup state
  const [imagePopup, setImagePopup] = useState({
    isVisible: false,
    imageUrl: null
  });
  
  // Delete confirmation popup state
  const [deletePopup, setDeletePopup] = useState({
    isVisible: false,
    userId: null,
    message: "",
    isPermanentDelete: false,
    action: "delete"
  });
  
  // Refs for scroll and focus functionality
  const formRef = useRef(null);
  const userNameInputRef = useRef(null);
  
  // View mode and pagination states
  const [viewMode, setViewMode] = useState('card');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [hasMoreCards, setHasMoreCards] = useState(true);
  const [displayedCards, setDisplayedCards] = useState([]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (type === 'checkbox') {
      setFormData({ ...formData, [name]: checked });
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

  // Validate user email for duplicates
  const validateUserEmail = (email) => {
    if (!email || !email.trim()) {
      return { isValid: false, error: "Email is required" };
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return { isValid: false, error: "Please enter a valid email address" };
    }
    
    const existingUser = users.find(user => 
      user.email.toLowerCase().trim() === email.toLowerCase().trim() && 
      user._id !== editingId &&
      !user.deleted
    );
    
    if (existingUser) {
      return { isValid: false, error: "User with this email already exists" };
    }
    
    return { isValid: true, error: "" };
  };

  // Validate and Add / Update User
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate email
    const emailValidation = validateUserEmail(formData.email);
    if (!emailValidation.isValid) {
      setError(emailValidation.error);
      return;
    }

    if (!formData.name || !formData.name.trim()) {
      setError("Name is required");
      return;
    }

    // Password is only required when creating a new user (not for Google OAuth users)
    if (!editingId && !formData.password && !formData.googleId) {
      setError("Password is required for new users");
      return;
    }

    try {
      setLoading(true);
      setSuccess("");
      setError("");

      const userData = {
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        phone: formData.phone?.trim() || null,
        address: {
          street: formData.address?.street?.trim() || null,
          city: formData.address?.city?.trim() || null,
          state: formData.address?.state?.trim() || null,
          zipCode: formData.address?.zipCode?.trim() || null,
          country: formData.address?.country?.trim() || null
        },
        role: formData.role || "customer",
        picture: formData.picture?.trim() || null,
        isActive: formData.isActive,
        emailVerified: formData.emailVerified
      };

      // Only include password if provided (for new users or password updates)
      if (formData.password && formData.password.trim()) {
        userData.password = formData.password.trim();
      }

      if (editingId) {
        await api.put(`/users/${editingId}`, userData);
        setSuccess(`✅ User "${userData.name}" has been updated successfully!`);
      } else {
        await api.post('/users', userData);
        setSuccess(`✅ User "${userData.name}" has been created successfully!`);
      }

      await fetchUsers();
      resetForm();
      
    } catch (err) {
      console.error('Error submitting user:', err);
      if (err.response?.data?.msg?.includes('already exists')) {
        setError(`❌ ${err.response.data.msg}`);
      } else {
        const errorMsg = err.response?.data?.msg || err.message || 'Please try again.';
        setError(`❌ Failed to ${editingId ? 'update' : 'create'} user. ${errorMsg}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData(initialFormData);
    setEditingId(null);
    setError("");
  };

  const clearForm = () => {
    setFormData(initialFormData);
    setEditingId(null);
    setError("");
    setSuccess("");
  };

  // Edit user
  const handleEdit = (user) => {
    setFormData({
      ...initialFormData,
      name: user.name || "",
      email: user.email || "",
      password: "", // Don't show password
      phone: user.phone || "",
      address: {
        street: user.address?.street || "",
        city: user.address?.city || "",
        state: user.address?.state || "",
        zipCode: user.address?.zipCode || "",
        country: user.address?.country || ""
      },
      role: user.role || "customer",
      picture: user.picture || "",
      isActive: user.isActive !== undefined ? user.isActive : true,
      emailVerified: user.emailVerified !== undefined ? user.emailVerified : false
    });
    setEditingId(user._id || user.id);
    setError("");
    setSuccess("");
    
    setTimeout(() => {
      if (formRef.current) {
        formRef.current.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start' 
        });
      }
      if (userNameInputRef.current) {
        userNameInputRef.current.focus();
      }
    }, 100);
  };

  // Delete user
  const handleDelete = async (userId) => {
    const user = users.find(u => u._id === userId);
    const isAlreadyDeleted = user?.deleted;
    
    let message;
    let isPermanentDelete = false;
    
    if (isAlreadyDeleted) {
      message = "This user is already marked as deleted. Click OK to permanently remove it from the database. This action cannot be undone.";
      isPermanentDelete = true;
    } else {
      message = "This will mark the user as inactive and add a deleted flag. Click OK to continue.";
      isPermanentDelete = false;
    }
    
    setDeletePopup({
      isVisible: true,
      userId,
      message,
      isPermanentDelete,
      action: "delete"
    });
  };

  // Handle delete confirmation
  const handleDeleteConfirm = async () => {
    const { userId, isPermanentDelete } = deletePopup;
    const user = users.find(u => u._id === userId);
    
    try {
      setLoading(true);
      setSuccess("");
      setError("");
      
      if (isPermanentDelete) {
        await api.delete(`/users/${userId}/hard`);
        setSuccess(`🗑️ User "${user.name}" has been permanently deleted from the database.`);
      } else {
        await api.delete(`/users/${userId}`);
        setSuccess(`⏸️ User "${user.name}" has been marked as deleted and inactive.`);
      }
      
      await fetchUsers();
    } catch (err) {
      const action = isPermanentDelete ? "permanently delete" : "mark as deleted";
      setError(`❌ Failed to ${action} user "${user.name}". ${err.response?.data?.msg || 'Please try again.'}`);
    } finally {
      setLoading(false);
      setDeletePopup({
        isVisible: false,
        userId: null,
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
      userId: null,
      message: "",
      isPermanentDelete: false,
      action: "delete"
    });
  };

  // Revert deleted user
  const handleRevert = async (userId) => {
    const user = users.find(u => u._id === userId);
    
    if (!user) {
      setError("User not found");
      return;
    }

    if (!user.deleted) {
      setError("This user is not deleted");
      return;
    }

    setDeletePopup({
      isVisible: true,
      userId,
      message: `Are you sure you want to restore the user "${user.name}"? This will make it active again.`,
      isPermanentDelete: false,
      action: "revert"
    });
  };

  // Handle revert confirmation
  const handleRevertConfirm = async () => {
    const { userId } = deletePopup;
    const user = users.find(u => u._id === userId);
    
    try {
      setLoading(true);
      setSuccess("");
      setError("");

      // Check if there's already a user with the same email
      const existingUser = users.find(u => 
        u._id !== userId &&
        u.email.toLowerCase().trim() === user.email.toLowerCase().trim() &&
        !u.deleted
      );

      if (existingUser) {
        setError(`❌ Cannot restore user "${user.name}". A user with this email already exists.`);
        setLoading(false);
        setDeletePopup({
          isVisible: false,
          userId: null,
          message: "",
          isPermanentDelete: false,
          action: "delete"
        });
        return;
      }

      await api.put(`/users/${userId}`, {
        ...user,
        isActive: true,
        deleted: false
      });

      setSuccess(`✅ User "${user.name}" has been restored and is now active!`);
      await fetchUsers();
    } catch (err) {
      setError(`❌ Failed to restore user "${user.name}". ${err.response?.data?.msg || 'Please try again.'}`);
    } finally {
      setLoading(false);
      setDeletePopup({
        isVisible: false,
        userId: null,
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
      userId: null,
      message: "",
      isPermanentDelete: false,
      action: "delete"
    });
  };

  // Fetch users from backend
  const fetchUsers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        showInactive: 'true',
        includeDeleted: 'true'
      });
      if (roleFilter !== 'all') {
        params.append('role', roleFilter);
      }
      
      // Get base URL and auth token
      const getBaseURL = () => {
        return process.env.REACT_APP_API_BASE_URL || "/api";
      };
      
      let authToken = '';
      try {
        const userStr = localStorage.getItem("adminUser");
        if (userStr) {
          const user = JSON.parse(userStr);
          if (user?.token) {
            authToken = user.token;
          }
        }
      } catch (error) {
        console.error("Error parsing adminUser from localStorage:", error);
      }
      
      // Create custom axios instance without interceptors to control headers
      const customAxios = axios.create({
        baseURL: getBaseURL(),
      });
      
      // Set up request interceptor for this instance
      customAxios.interceptors.request.use((config) => {
        // Set Authorization header first
        if (authToken) {
          config.headers.Authorization = `Bearer ${authToken}`;
        }
        
        // Clear any existing X-Website-Id headers
        delete config.headers['X-Website-Id'];
        delete config.headers['x-website-id'];
        
        // Control X-Website-Id header based on websiteFilter
        if (websiteFilter && websiteFilter !== 'all') {
          // Send selected website ID - use both lowercase and uppercase for compatibility
          config.headers['X-Website-Id'] = websiteFilter;
          config.headers['x-website-id'] = websiteFilter;
          console.log('🔍 Frontend: Setting X-Website-Id header to:', websiteFilter);
        } else if (websiteFilter === 'all') {
          // Don't send X-Website-Id header - allows super admin to see all users
          // (optionalTenant middleware will allow super admin to proceed)
          console.log('🔍 Frontend: All Websites selected - not sending X-Website-Id header');
        } else {
          // Fallback: use selectedWebsite from localStorage
          try {
            const selectedWebsiteStr = localStorage.getItem('selectedWebsite');
            if (selectedWebsiteStr) {
              const selectedWebsite = JSON.parse(selectedWebsiteStr);
              if (selectedWebsite?._id) {
                config.headers['X-Website-Id'] = selectedWebsite._id;
                config.headers['x-website-id'] = selectedWebsite._id;
                console.log('🔍 Frontend: Using default website from localStorage:', selectedWebsite._id);
              }
            }
          } catch (error) {
            console.error('Error reading selectedWebsite:', error);
          }
        }
        
        // Log final headers being sent
        console.log('📤 Frontend: Final request headers:', {
          'X-Website-Id': config.headers['X-Website-Id'] || 'NOT SET',
          'x-website-id': config.headers['x-website-id'] || 'NOT SET',
          'Authorization': config.headers.Authorization ? 'Bearer ***' : 'none',
          'websiteFilter': websiteFilter,
          'url': config.url
        });
        
        return config;
      });
      
      const response = await customAxios.get(`/users?${params.toString()}`);
      let usersData = response.data || [];
      console.log('📥 Received users:', usersData.length, 'users');
      
      // Log website distribution for debugging
      if (usersData.length > 0) {
        const websiteDistribution = {};
        usersData.forEach(user => {
          const websiteId = getWebsiteId(user) || 'none';
          websiteDistribution[websiteId] = (websiteDistribution[websiteId] || 0) + 1;
        });
        console.log('📊 Users by website:', websiteDistribution);
      }
      
      // Apply date filter client-side if needed
      if (filterFromUrl) {
        const now = new Date();
        let filterDate = null;
        
        if (filterFromUrl === 'today') {
          filterDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        } else if (filterFromUrl === 'weekly') {
          filterDate = new Date(now);
          filterDate.setDate(now.getDate() - 7);
        } else if (filterFromUrl === 'monthly') {
          filterDate = new Date(now);
          filterDate.setMonth(now.getMonth() - 1);
        }
        
        if (filterDate) {
          usersData = usersData.filter(user => {
            const userDate = new Date(user.createdAt);
            return userDate >= filterDate;
          });
        }
      }
      
      setUsers(usersData);
      setError("");
    } catch (err) {
      setError("Failed to fetch users");
    } finally {
      setLoading(false);
    }
  };

  // Fetch websites for lookup
  const fetchWebsites = async () => {
    try {
      const response = await api.get('/websites?showInactive=true&includeDeleted=true');
      setWebsites(response.data || []);
    } catch (err) {
      console.error('Error fetching websites:', err);
    }
  };
  
  useEffect(() => {
    fetchUsers();
    fetchWebsites();
  }, [roleFilter, filterFromUrl, websiteFilter]);
  
  // Update website filter when selectedWebsite changes in localStorage (on mount)
  useEffect(() => {
    const newDefault = getDefaultWebsiteFilter();
    if (newDefault !== 'all' && newDefault !== websiteFilter) {
      setWebsiteFilter(newDefault);
    }
  }, [websites]); // Re-check when websites are loaded
  
  // Update filters when URL params change
  useEffect(() => {
    const roleParam = searchParams.get('role');
    const filterParam = searchParams.get('filter');
    
    if (roleParam && roleParam !== roleFilter) {
      setRoleFilter(roleParam);
    }
  }, [searchParams]);

  // Filter users based on search query and status
  // Note: Website filtering is handled by the backend via X-Website-Id header
  const filteredUsers = useMemo(() => {
    let filtered = users;
    
    // Website filtering is now handled by backend, so we don't need to filter here
    // But we can add additional client-side filtering if needed for edge cases
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(user => 
        user.name?.toLowerCase().includes(query) ||
        user.email?.toLowerCase().includes(query) ||
        user.phone?.toLowerCase().includes(query)
      );
    }
    
    // Apply status filter
    filtered = filterEntitiesByStatus(filtered, statusFilter);
    
    return filtered;
  }, [users, searchQuery, statusFilter]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentUsers = filteredUsers.slice(startIndex, endIndex);

  // Card lazy loading logic
  useEffect(() => {
    if (viewMode === 'card') {
      const initialCards = filteredUsers.slice(0, 12);
      setDisplayedCards(initialCards);
      setHasMoreCards(filteredUsers.length > 12);
      setCurrentPage(1);
    }
  }, [viewMode, filteredUsers]);

  // Reset pagination when search query changes
  const resetPaginationForSearch = useCallback(() => {
    setCurrentPage(1);
    if (viewMode === 'card') {
      const initialCards = filteredUsers.slice(0, 12);
      setDisplayedCards(initialCards);
      setHasMoreCards(filteredUsers.length > 12);
    }
  }, [viewMode, filteredUsers.length]);

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
      const nextCards = filteredUsers.slice(currentCardCount, currentCardCount + 12);
      
      if (nextCards.length > 0) {
        setHasMoreCards(currentCardCount + nextCards.length < filteredUsers.length);
        return [...prevCards, ...nextCards];
      } else {
        setHasMoreCards(false);
        return prevCards;
      }
    });
  }, [filteredUsers]);

  // Reset pagination when view mode changes
  const handleViewModeChange = useCallback((mode) => {
    setViewMode(mode);
    setCurrentPage(1);
    if (mode === 'card') {
      const initialCards = filteredUsers.slice(0, 12);
      setDisplayedCards(initialCards);
      setHasMoreCards(filteredUsers.length > 12);
    }
  }, [filteredUsers.length]);

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

  return (
    <div className="paddingAll20">
      {/* Header */}
      <PageHeader
        title="User Management"
        subtitle="Manage your application users and their accounts"
        isEditing={!!editingId}
        editText="Edit User"
        createText="Add New User"
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
                ref={userNameInputRef}
                type="text"
                name="name"
                label="Full Name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Enter user's full name"
                required={true}
              />
            </div>
            <div className="fullWidth">
              <FormField
                type="email"
                name="email"
                label="Email Address"
                value={formData.email}
                onChange={handleChange}
                placeholder="Enter email address"
                required={true}
              />
            </div>
          </div>

          <div className="makeFlex row gap10">
            <div className="fullWidth">
              <FormField
                type="password"
                name="password"
                label={editingId ? "New Password (Leave blank to keep current)" : "Password"}
                value={formData.password}
                onChange={handleChange}
                placeholder={editingId ? "Enter new password (optional)" : "Enter password"}
                required={!editingId}
              />
            </div>
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
          </div>

          <div className="makeFlex row gap10">
            <div className="fullWidth">
              <FormField
                type="text"
                name="address.street"
                label="Street Address"
                value={formData.address.street}
                onChange={handleChange}
                placeholder="Enter street address"
              />
            </div>
            <div className="fullWidth">
              <FormField
                type="text"
                name="address.city"
                label="City"
                value={formData.address.city}
                onChange={handleChange}
                placeholder="Enter city"
              />
            </div>
          </div>

          <div className="makeFlex row gap10">
            <div className="fullWidth">
              <FormField
                type="text"
                name="address.state"
                label="State"
                value={formData.address.state}
                onChange={handleChange}
                placeholder="Enter state"
              />
            </div>
            <div className="fullWidth">
              <FormField
                type="text"
                name="address.zipCode"
                label="Zip Code"
                value={formData.address.zipCode}
                onChange={handleChange}
                placeholder="Enter zip code"
              />
            </div>
            <div className="fullWidth">
              <FormField
                type="text"
                name="address.country"
                label="Country"
                value={formData.address.country}
                onChange={handleChange}
                placeholder="Enter country"
              />
            </div>
          </div>

          <div className="makeFlex row gap10">
            <div className="fullWidth">
              <FormField
                type="select"
                name="role"
                label="Role"
                value={formData.role}
                onChange={handleChange}
                required={true}
                options={[
                  { value: "customer", label: "Customer" },
                  { value: "editor", label: "Editor" },
                  { value: "admin", label: "Admin" },
                ]}
              />
            </div>
            <div className="fullWidth">
              <FormField
                type="text"
                name="picture"
                label="Profile Picture URL"
                value={formData.picture}
                onChange={handleChange}
                placeholder="Enter profile picture URL"
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
                  checked={formData.isActive}
                  onChange={handleChange}
                />
                Active
              </label>
              <p className="negativeMarginTop10">Check this box to keep the user active</p>
            </div>
            <div className="makeFlex column flexOne appendBottom16">
              <label className="formLabel appendBottom10">Email Verified:</label>
              <label className="formLabel appendBottom8 makeFlex gap10">
                <FormField
                  type="checkbox"
                  name="emailVerified"
                  checked={formData.emailVerified}
                  onChange={handleChange}
                />
                Email Verified
              </label>
              <p className="negativeMarginTop10">Mark if user's email is verified</p>
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
                <span>{editingId ? "Update User" : "Add User"}</span>
              )}
            </button>
            
            {(editingId || (!editingId && (formData.name || formData.email))) && (
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
                Add Another User
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Users List */}
      <div className="brandsListContainer paddingAll32">
        <div className="listHeader makeFlex spaceBetween end appendBottom24">
          <div className="leftSection">
            <h2 className="listTitle font30 fontBold blackText appendBottom16">Users ({filteredUsers.length})</h2>
            <StatusFilter
              statusFilter={statusFilter}
              onStatusChange={setStatusFilter}
              counts={calculateStandardStatusCounts(users)}
              disabled={loading}
            />
            <div className="paddingTop10">
              <label className="formLabel appendBottom10">Filter by Role:</label>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="formInput"
                style={{ minWidth: '150px' }}
              >
                <option value="all">All Roles</option>
                <option value="admin">Admin</option>
                <option value="editor">Editor</option>
                <option value="customer">Customer</option>
              </select>
            </div>
            <div className="paddingTop10">
              <label className="formLabel appendBottom10">Filter by Website:</label>
              <select
                value={websiteFilter}
                onChange={(e) => {
                  const newFilter = e.target.value;
                  console.log('🌐 Website filter changed:', newFilter);
                  setWebsiteFilter(newFilter);
                }}
                className="formInput"
                style={{ minWidth: '200px' }}
              >
                <option value="all">All Websites</option>
                {websites.map(website => (
                  <option key={website._id} value={website._id}>
                    {website.name} {website.domain && `(${website.domain})`}
                  </option>
                ))}
              </select>
              {websiteFilter && websiteFilter !== 'all' && (
                <p className="font12 grayText paddingTop4">
                  Showing users from: {websites.find(w => w._id === websiteFilter)?.name || websiteFilter}
                </p>
              )}
            </div>
          </div>
          <div className="rightSection makeFlex end gap10">
            <SearchField
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search users..."
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

        {filteredUsers.length === 0 && !loading ? (
          <div className="emptyState textCenter paddingAll60">
            <div className="emptyIcon appendBottom16">👤</div>
            <h3 className="font22 fontSemiBold grayText appendBottom8">No Users Found</h3>
            <p className="font16 grayText">Start by adding your first user above</p>
          </div>
        ) : (
          <>
            {/* Card View */}
            {viewMode === 'card' && (
              <div className="brandsGrid">
                {displayedCards.map((user) => (
                  <EntityCard
                    key={user._id || user.id}
                    entity={user}
                    logoField="picture"
                    nameField="name"
                    idField="_id"
                    onEdit={user.deleted ? undefined : handleEdit}
                    onDelete={handleDelete}
                    onRevert={user.deleted ? () => handleRevert(user._id || user.id) : undefined}
                    loading={loading}
                    imagePlaceholderColor={generateEntityColor(user._id || user.id, user.name)}
                    renderHeader={(user) => (
                      <EntityCardHeader
                        entity={user}
                        imageField="picture"
                        titleField="name"
                        dateField="createdAt"
                        generateColor={generateEntityColor}
                        onImageClick={handleImageClick}
                      />
                    )}
                    renderDetails={(user) => {
                      const fullAddress = user.address ? 
                        [user.address.street, user.address.city, user.address.state, user.address.zipCode, user.address.country]
                          .filter(Boolean).join(', ') : 'N/A';
                      
                      return (
                        <>
                          <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                            <span className="detailLabel font14 fontSemiBold grayText textUppercase">User ID:</span>
                            <span className="detailValue font14 blackText appendLeft6">{user._id || 'N/A'}</span>
                          </div>
                          <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                            <span className="detailLabel font14 fontSemiBold grayText textUppercase">Email:</span>
                            <span className="detailValue font14 blackText appendLeft6">{user.email}</span>
                          </div>
                          {user.phone && (
                            <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                              <span className="detailLabel font14 fontSemiBold grayText textUppercase">Phone:</span>
                              <span className="detailValue font14 blackText appendLeft6">{user.phone}</span>
                            </div>
                          )}
                          {fullAddress !== 'N/A' && (
                            <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                              <span className="detailLabel font14 fontSemiBold grayText textUppercase">Address:</span>
                              <span className="detailValue font14 blackText appendLeft6">{fullAddress}</span>
                            </div>
                          )}
                          <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                            <span className="detailLabel font14 fontSemiBold grayText textUppercase">Role:</span>
                            <span className={`detailValue font14 ${user.role === 'admin' ? 'redText' : user.role === 'editor' ? 'blueText' : 'blackText'} appendLeft6 fontBold`}>
                              {user.role?.toUpperCase()}
                            </span>
                          </div>
                          <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                            <span className="detailLabel font14 fontSemiBold grayText textUppercase">Email Verified:</span>
                            <span className={`detailValue font14 ${user.emailVerified ? 'greenText' : 'grayText'} appendLeft6`}>
                              {user.emailVerified ? 'Yes' : 'No'}
                            </span>
                          </div>
                          <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                            <span className="detailLabel font14 fontSemiBold grayText textUppercase">Status:</span>
                            <span className={`detailValue font14 ${user.deleted ? 'deleted' : (user.isActive ? 'greenText' : 'inactive')} appendLeft6`}>
                              {user.deleted ? 'Deleted' : (user.isActive ? 'Active' : 'Inactive')}
                            </span>
                          </div>
                          <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                            <span className="detailLabel font14 fontSemiBold grayText textUppercase">Website:</span>
                            <span className="detailValue font14 blackText appendLeft6">
                              {getWebsiteName(user)}
                            </span>
                          </div>
                        </>
                      );
                    }}
                    renderActions={(user) => (
                      <ActionButtons
                        onEdit={user.deleted ? undefined : () => handleEdit(user)}
                        onDelete={() => handleDelete(user._id || user.id)}
                        onRevert={user.deleted ? () => handleRevert(user._id || user.id) : undefined}
                        loading={loading}
                        size="normal"
                        editText="✏️ Edit"
                        deleteText={user.deleted ? "🗑️ Final Del" : "🗑️ Delete"}
                        revertText="🔄 Undelete"
                        editTitle="Edit User"
                        deleteTitle={user.deleted ? "Final Del" : "Delete User"}
                        revertTitle="Restore User"
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
                        <th className="tableHeader">Image</th>
                        <th className="tableHeader">Name</th>
                        <th className="tableHeader">Email</th>
                        <th className="tableHeader">Phone</th>
                        <th className="tableHeader">Role</th>
                        <th className="tableHeader">Status</th>
                        <th className="tableHeader">Email Verified</th>
                        <th className="tableHeader">Created</th>
                        <th className="tableHeader">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentUsers.map((user) => (
                        <tr key={user._id || user.id} className="tableRow">
                          <td className="tableCell">
                            {user.picture ? (
                              <img
                                src={user.picture}
                                alt={user.name}
                                className="tableImage"
                                style={{ 
                                  width: '40px', 
                                  height: '40px', 
                                  objectFit: 'cover',
                                  borderRadius: '4px',
                                  cursor: 'pointer'
                                }}
                                onClick={() => handleImageClick(user.picture)}
                                onError={(e) => {
                                  console.error('Image failed to load:', user.picture);
                                  e.target.style.display = 'none';
                                }}
                              />
                            ) : (
                              <div 
                                className="tableImagePlaceholder"
                                style={{
                                  width: '40px',
                                  height: '40px',
                                  backgroundColor: generateEntityColor(user._id || user.id, user.name),
                                  borderRadius: '4px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: 'white',
                                  fontSize: '12px',
                                  fontWeight: 'bold'
                                }}
                              >
                                {user.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </td>
                          <td className="tableCell">
                            <span className="brandNameText">{user.name}</span>
                          </td>
                          <td className="tableCell">
                            <span className="addressText">{user.email}</span>
                          </td>
                          <td className="tableCell">
                            <span className="addressText">{user.phone || '-'}</span>
                          </td>
                          <td className="tableCell">
                            <span className={`statusText ${user.role === 'admin' ? 'redText' : user.role === 'editor' ? 'blueText' : ''} fontBold`}>
                              {user.role?.toUpperCase()}
                            </span>
                          </td>
                          <td className="tableCell">
                            <span className={`statusText ${user.deleted ? 'deleted' : (user.isActive ? 'active' : 'inactive')}`}>
                              {user.deleted ? 'Deleted' : (user.isActive ? 'Active' : 'Inactive')}
                            </span>
                          </td>
                          <td className="tableCell">
                            <span className={`statusText ${user.emailVerified ? 'active' : 'inactive'}`}>
                              {user.emailVerified ? 'Yes' : 'No'}
                            </span>
                          </td>
                          <td className="tableCell">
                            <span className="dateText">
                              {new Date(user.createdAt).toLocaleDateString()}
                            </span>
                          </td>
                          <td className="tableCell">
                            <div className="tableActions makeFlex gap8">
                              <ActionButtons
                                onEdit={user.deleted ? undefined : () => handleEdit(user)}
                                onDelete={() => handleDelete(user._id || user.id)}
                                onRevert={user.deleted ? () => handleRevert(user._id || user.id) : undefined}
                                loading={loading}
                                size="small"
                                editText="✏️"
                                deleteText={user.deleted ? "🗑️" : "🗑️"}
                                revertText="🔄"
                                editTitle="Edit User"
                                deleteTitle={user.deleted ? "Final Del" : "Delete User"}
                                revertTitle="Restore User"
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

export default UserManager;
