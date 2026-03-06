import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import api from '../api/axios';
import {
  PageHeader,
  AlertMessage,
  ViewToggle,
  Pagination,
  FormField,
  ActionButtons,
  SearchField,
  StatusFilter,
  calculateStandardStatusCounts,
  filterEntitiesByStatus,
  DeleteConfirmationPopup,
} from '../common';

/**
 * UserAccessManager Component
 * 
 * Comprehensive RBAC management for admin panel:
 * - Create/Edit/Delete staff users
 * - Assign permissions to users
 * - Enable/Disable user accounts
 * - View user statistics
 */

// Role options
const ROLE_OPTIONS = [
  { value: "admin", label: "Admin", color: "#28a745" },
  { value: "editor", label: "Editor", color: "#17a2b8" },
  { value: "super_admin", label: "Super Admin", color: "#dc3545" },
];

const UserAccessManager = () => {
  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================
  
  const [users, setUsers] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [groupedPermissions, setGroupedPermissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [stats, setStats] = useState(null);
  
  // View and Filter state
  const [viewMode, setViewMode] = useState('card');
  const [statusFilter, setStatusFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState("");
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(12);
  const [displayedCount, setDisplayedCount] = useState(12);
  
  // Form state
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    username: "",
    password: "",
    confirmPassword: "",
    role: "admin",
    phone: "",
    isActive: true,
    permissions: [],
  });
  
  // Delete confirmation popup state
  const [showDeletePopup, setShowDeletePopup] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [deleteAction, setDeleteAction] = useState('soft');
  
  // Permission modal state
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [selectedPermissions, setSelectedPermissions] = useState([]);
  
  // Password reset modal
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordResetData, setPasswordResetData] = useState({
    userId: null,
    newPassword: "",
    confirmPassword: "",
  });
  
  // Customer promotion modal state
  const [showPromoteModal, setShowPromoteModal] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customersLoading, setCustomersLoading] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  
  // Website access state
  const [availableWebsites, setAvailableWebsites] = useState([]);
  const [selectedWebsites, setSelectedWebsites] = useState([]);
  const [promoteRole, setPromoteRole] = useState("editor");
  const [promotePermissions, setPromotePermissions] = useState([]);
  
  // Refs
  const formRef = useRef(null);
  
  // Get current user info
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const isSuperAdmin = currentUser.role === 'super_admin' || currentUser.isSuperAdmin;

  // ============================================================================
  // DATA FETCHING
  // ============================================================================
  
  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get('/user-access/users', {
        params: { includeDeleted: 'true' }
      });
      setUsers(response.data.users || []);
    } catch (err) {
      console.error("Error fetching users:", err);
      setError(err.response?.data?.msg || "Failed to fetch users");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPermissions = useCallback(async () => {
    try {
      const response = await api.get('/user-access/permissions');
      setPermissions(response.data.permissions || []);
      setGroupedPermissions(response.data.grouped || []);
    } catch (err) {
      console.error("Error fetching permissions:", err);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const response = await api.get('/user-access/stats');
      setStats(response.data);
    } catch (err) {
      console.error("Error fetching stats:", err);
    }
  }, []);

  // Fetch available websites for assignment
  const fetchWebsites = useCallback(async () => {
    try {
      const response = await api.get('/websites?showInactive=false&includeDeleted=false');
      setAvailableWebsites(response.data || []);
    } catch (err) {
      console.error("Error fetching websites:", err);
    }
  }, []);

  // Fetch customers for promotion
  const fetchCustomers = useCallback(async (search = "") => {
    try {
      setCustomersLoading(true);
      const response = await api.get('/user-access/customers', {
        params: { search, limit: 20 }
      });
      setCustomers(response.data.customers || []);
    } catch (err) {
      console.error("Error fetching customers:", err);
      setError(err.response?.data?.msg || "Failed to fetch customers");
    } finally {
      setCustomersLoading(false);
    }
  }, []);

  // Promote customer to staff
  const handlePromoteCustomer = async () => {
    if (!selectedCustomer) {
      setError("Please select a customer to promote");
      return;
    }
    
    try {
      setLoading(true);
      await api.post(`/user-access/customers/${selectedCustomer._id}/promote`, {
        role: promoteRole,
        permissions: promotePermissions
      });
      
      setSuccess(`${selectedCustomer.name} has been promoted to ${promoteRole}`);
      setShowPromoteModal(false);
      setSelectedCustomer(null);
      setPromoteRole("editor");
      setPromotePermissions([]);
      setCustomerSearch("");
      setCustomers([]);
      fetchUsers();
      fetchStats();
    } catch (err) {
      setError(err.response?.data?.msg || "Failed to promote customer");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchPermissions();
    fetchStats();
    fetchWebsites();
  }, [fetchUsers, fetchPermissions, fetchStats, fetchWebsites]);

  // ============================================================================
  // FILTERING AND PAGINATION
  // ============================================================================
  
  const filteredUsers = useMemo(() => {
    let result = users;
    
    // Filter by status
    result = filterEntitiesByStatus(result, statusFilter);
    
    // Filter by role
    if (roleFilter !== 'all') {
      result = result.filter(user => user.role === roleFilter);
    }
    
    // Filter by search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(user =>
        user.name?.toLowerCase().includes(query) ||
        user.email?.toLowerCase().includes(query) ||
        user.username?.toLowerCase().includes(query)
      );
    }
    
    return result;
  }, [users, statusFilter, roleFilter, searchQuery]);

  const statusCounts = useMemo(() => {
    const roleCounts = ROLE_OPTIONS.reduce((acc, role) => {
      acc[role.value] = users.filter(u => u.role === role.value && !u.deleted).length;
      return acc;
    }, {});
    
    return {
      ...calculateStandardStatusCounts(users),
      ...roleCounts
    };
  }, [users]);

  // Pagination
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const paginatedUsers = useMemo(() => {
    if (viewMode === 'card') {
      return filteredUsers.slice(0, displayedCount);
    }
    const start = (currentPage - 1) * itemsPerPage;
    return filteredUsers.slice(start, start + itemsPerPage);
  }, [filteredUsers, currentPage, itemsPerPage, viewMode, displayedCount]);

  const handleLoadMore = useCallback(() => {
    setDisplayedCount(prev => Math.min(prev + 12, filteredUsers.length));
  }, [filteredUsers.length]);

  const handleViewModeChange = useCallback((mode) => {
    setViewMode(mode);
    if (mode === 'card') {
      setDisplayedCount(12);
    } else {
      setCurrentPage(1);
    }
  }, []);

  // ============================================================================
  // FORM HANDLING
  // ============================================================================
  
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      username: "",
      password: "",
      confirmPassword: "",
      role: "admin",
      phone: "",
      isActive: true,
      permissions: [],
    });
    setEditingId(null);
    setSelectedPermissions([]);
    setSelectedWebsites([]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    
    // Validation
    if (!formData.name.trim()) {
      setError("Name is required");
      return;
    }
    
    if (!formData.email.trim()) {
      setError("Email is required");
      return;
    }
    
    if (!editingId && !formData.password) {
      setError("Password is required for new users");
      return;
    }
    
    if (formData.password && formData.password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    
    if (formData.password && formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    
    try {
      setLoading(true);
      
      const payload = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        username: formData.username.trim() || null,
        role: formData.role,
        phone: formData.phone.trim(),
        isActive: formData.isActive,
        permissions: formData.role === 'super_admin' ? [] : selectedPermissions,
        accessibleWebsites: formData.role === 'super_admin' ? [] : selectedWebsites,
      };
      
      if (formData.password) {
        payload.password = formData.password;
      }
      
      let userId = editingId;
      
      if (editingId) {
        await api.put(`/user-access/users/${editingId}`, payload);
        setSuccess("User updated successfully");
      } else {
        const response = await api.post('/user-access/users', payload);
        userId = response.data.user?._id;
        setSuccess("User created successfully");
      }
      
      // Update website access separately if needed (for non-super-admin users)
      if (userId && formData.role !== 'super_admin' && selectedWebsites.length > 0) {
        await api.put(`/user-access/users/${userId}/websites`, {
          accessibleWebsites: selectedWebsites
        });
      }
      
      resetForm();
      fetchUsers();
      fetchStats();
    } catch (err) {
      setError(err.response?.data?.msg || "Failed to save user");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (user) => {
    setEditingId(user._id);
    setFormData({
      name: user.name || "",
      email: user.email || "",
      username: user.username || "",
      password: "",
      confirmPassword: "",
      role: user.role || "admin",
      phone: user.phone || "",
      isActive: user.isActive !== false,
      permissions: user.permissions || [],
    });
    setSelectedPermissions(user.permissions || []);
    // Set accessible websites (extract IDs if objects are passed)
    const websiteIds = (user.accessibleWebsites || []).map(w => 
      typeof w === 'object' ? w._id : w
    );
    setSelectedWebsites(websiteIds);
    formRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleCancel = () => {
    resetForm();
  };

  // ============================================================================
  // USER ACTIONS
  // ============================================================================
  
  const handleToggleStatus = async (userId) => {
    try {
      setLoading(true);
      await api.patch(`/user-access/users/${userId}/toggle-status`);
      setSuccess("User status updated successfully");
      fetchUsers();
      fetchStats();
    } catch (err) {
      setError(err.response?.data?.msg || "Failed to update status");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (user) => {
    setUserToDelete(user);
    setDeleteAction(user.deleted ? 'hard' : 'soft');
    setShowDeletePopup(true);
  };

  const handleDeleteConfirm = async () => {
    if (!userToDelete) return;
    
    try {
      setLoading(true);
      if (deleteAction === 'hard') {
        await api.delete(`/user-access/users/${userToDelete._id}/permanent`);
        setSuccess("User permanently deleted");
      } else {
        await api.delete(`/user-access/users/${userToDelete._id}`);
        setSuccess("User deleted successfully");
      }
      fetchUsers();
      fetchStats();
    } catch (err) {
      setError(err.response?.data?.msg || "Failed to delete user");
    } finally {
      setLoading(false);
      setShowDeletePopup(false);
      setUserToDelete(null);
    }
  };

  const handleRestore = async (userId) => {
    try {
      setLoading(true);
      await api.patch(`/user-access/users/${userId}/restore`);
      setSuccess("User restored successfully");
      fetchUsers();
      fetchStats();
    } catch (err) {
      setError(err.response?.data?.msg || "Failed to restore user");
    } finally {
      setLoading(false);
    }
  };

  const handleUnlock = async (userId) => {
    try {
      setLoading(true);
      await api.patch(`/user-access/users/${userId}/unlock`);
      setSuccess("Account unlocked successfully");
      fetchUsers();
    } catch (err) {
      setError(err.response?.data?.msg || "Failed to unlock account");
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // PASSWORD RESET
  // ============================================================================
  
  const openPasswordModal = (userId) => {
    setPasswordResetData({
      userId,
      newPassword: "",
      confirmPassword: "",
    });
    setShowPasswordModal(true);
  };

  const handlePasswordReset = async () => {
    if (passwordResetData.newPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    
    if (passwordResetData.newPassword !== passwordResetData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    
    try {
      setLoading(true);
      await api.patch(`/user-access/users/${passwordResetData.userId}/reset-password`, {
        newPassword: passwordResetData.newPassword
      });
      setSuccess("Password reset successfully");
      setShowPasswordModal(false);
    } catch (err) {
      setError(err.response?.data?.msg || "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // PERMISSION MANAGEMENT
  // ============================================================================
  
  const handlePermissionToggle = (permissionKey) => {
    setSelectedPermissions(prev => {
      if (prev.includes(permissionKey)) {
        return prev.filter(p => p !== permissionKey);
      }
      return [...prev, permissionKey];
    });
  };

  const handleModuleToggle = (modulePermissions) => {
    const moduleKeys = modulePermissions.map(p => p.key);
    const allSelected = moduleKeys.every(key => selectedPermissions.includes(key));
    
    if (allSelected) {
      setSelectedPermissions(prev => prev.filter(p => !moduleKeys.includes(p)));
    } else {
      setSelectedPermissions(prev => [...new Set([...prev, ...moduleKeys])]);
    }
  };

  const handleSelectAllPermissions = () => {
    if (selectedPermissions.length === permissions.length) {
      setSelectedPermissions([]);
    } else {
      setSelectedPermissions(permissions.map(p => p.key));
    }
  };

  // ============================================================================
  // SEED PERMISSIONS
  // ============================================================================
  
  const handleSeedPermissions = async () => {
    try {
      setLoading(true);
      await api.post('/user-access/permissions/seed');
      setSuccess("Permissions seeded successfully");
      fetchPermissions();
    } catch (err) {
      setError(err.response?.data?.msg || "Failed to seed permissions");
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================
  
  const getRoleColor = (role) => {
    const option = ROLE_OPTIONS.find(r => r.value === role);
    return option?.color || "#6c757d";
  };

  const getRoleLabel = (role) => {
    const option = ROLE_OPTIONS.find(r => r.value === role);
    return option?.label || role;
  };

  // ============================================================================
  // RENDER
  // ============================================================================
  
  return (
    <div className="paddingAll20">
      <PageHeader
        title="User Access Manager"
        subtitle="Manage staff users, roles, and permissions"
        isEditing={!!editingId}
        editText="Edit User"
        createText="Create New Staff User"
      />

      {/* Quick Actions */}
      <div style={{ marginBottom: '16px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => {
            setShowPromoteModal(true);
            fetchCustomers();
          }}
          className="primaryBtn"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 20px',
            background: '#28a745',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500'
          }}
        >
          <span>↑</span> Upgrade Customer to Staff
        </button>
      </div>

      {/* Alert Messages */}
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

      {/* Statistics Cards */}
      {stats && (
        <div className="statsGrid appendBottom24" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '16px'
        }}>
          <div className="statCard" style={{
            background: '#fff',
            padding: '16px',
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#007bff' }}>
              {stats.total}
            </div>
            <div style={{ fontSize: '12px', color: '#6c757d' }}>Total Users</div>
          </div>
          <div className="statCard" style={{
            background: '#fff',
            padding: '16px',
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#28a745' }}>
              {stats.active}
            </div>
            <div style={{ fontSize: '12px', color: '#6c757d' }}>Active</div>
          </div>
          <div className="statCard" style={{
            background: '#fff',
            padding: '16px',
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ffc107' }}>
              {stats.inactive}
            </div>
            <div style={{ fontSize: '12px', color: '#6c757d' }}>Inactive</div>
          </div>
          <div className="statCard" style={{
            background: '#fff',
            padding: '16px',
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#dc3545' }}>
              {stats.lockedAccounts}
            </div>
            <div style={{ fontSize: '12px', color: '#6c757d' }}>Locked</div>
          </div>
          <div className="statCard" style={{
            background: '#fff',
            padding: '16px',
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#6f42c1' }}>
              {stats.totalPermissions}
            </div>
            <div style={{ fontSize: '12px', color: '#6c757d' }}>Permissions</div>
          </div>
        </div>
      )}

      {/* User Form */}
      <div className="brandFormContainer paddingAll32 appendBottom30" ref={formRef}>
        <form onSubmit={handleSubmit} className="brandForm">
          <div className="formGrid" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px'
          }}>
            <FormField
              label="Full Name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              placeholder="Enter full name"
            />
            <FormField
              label="Email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              required
              placeholder="Enter email address"
            />
            <FormField
              label="Username (optional)"
              name="username"
              value={formData.username}
              onChange={handleChange}
              placeholder="Enter username for login"
            />
            <FormField
              label="Phone"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="Enter phone number"
            />
            <FormField
              label="Role"
              name="role"
              type="select"
              value={formData.role}
              onChange={handleChange}
              options={isSuperAdmin ? ROLE_OPTIONS : ROLE_OPTIONS.filter(r => r.value !== 'super_admin')}
              disabled={!isSuperAdmin && formData.role === 'super_admin'}
            />
            <FormField
              label={editingId ? "New Password (leave blank to keep)" : "Password"}
              name="password"
              type="password"
              value={formData.password}
              onChange={handleChange}
              required={!editingId}
              placeholder={editingId ? "Leave blank to keep current" : "Enter password (min 8 chars)"}
            />
            <FormField
              label="Confirm Password"
              name="confirmPassword"
              type="password"
              value={formData.confirmPassword}
              onChange={handleChange}
              required={!!formData.password}
              placeholder="Confirm password"
            />
            <div className="formField">
              <label className="fieldLabel" style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer'
              }}>
                <input
                  type="checkbox"
                  name="isActive"
                  checked={formData.isActive}
                  onChange={handleChange}
                  style={{ width: '18px', height: '18px' }}
                />
                <span>Account Active</span>
              </label>
            </div>
          </div>

          {/* Website Access Section */}
          {formData.role !== 'super_admin' && formData.role !== 'admin' && (
            <div className="websiteAccessSection appendTop24">
              <div className="makeFlex spaceBetween alignCenter appendBottom16">
                <h4 className="font16 fontSemiBold">Website Access</h4>
                <div className="makeFlex gap10">
                  <button
                    type="button"
                    className="btnSecondary"
                    onClick={() => {
                      if (selectedWebsites.length === availableWebsites.length) {
                        setSelectedWebsites([]);
                      } else {
                        setSelectedWebsites(availableWebsites.map(w => w._id));
                      }
                    }}
                    style={{ fontSize: '12px', padding: '6px 12px' }}
                  >
                    {selectedWebsites.length === availableWebsites.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>
              </div>
              
              <div className="websiteList" style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '12px',
                padding: '16px',
                background: '#f8f9fa',
                borderRadius: '8px',
                maxHeight: '200px',
                overflowY: 'auto'
              }}>
                {availableWebsites.length === 0 ? (
                  <div style={{ color: '#666', fontSize: '14px' }}>
                    No websites available
                  </div>
                ) : (
                  availableWebsites.map(website => (
                    <label
                      key={website._id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 12px',
                        background: selectedWebsites.includes(website._id) ? '#e3f2fd' : '#fff',
                        border: selectedWebsites.includes(website._id) ? '2px solid #007bff' : '1px solid #e9ecef',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedWebsites.includes(website._id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedWebsites(prev => [...prev, website._id]);
                          } else {
                            setSelectedWebsites(prev => prev.filter(id => id !== website._id));
                          }
                        }}
                        style={{ width: '16px', height: '16px' }}
                      />
                      <div>
                        <div style={{ fontWeight: '500', fontSize: '14px' }}>{website.name}</div>
                        <div style={{ fontSize: '12px', color: '#666' }}>{website.domain}</div>
                      </div>
                    </label>
                  ))
                )}
              </div>
              
              <div className="selectedCount appendTop8" style={{ fontSize: '13px', color: '#6c757d' }}>
                {selectedWebsites.length} website(s) selected
              </div>
            </div>
          )}

          {(formData.role === 'super_admin' || formData.role === 'admin') && (
            <div className="adminWebsiteNote appendTop16" style={{
              padding: '12px',
              background: '#d4edda',
              borderRadius: '6px',
              color: '#155724',
              fontSize: '14px'
            }}>
              {formData.role === 'super_admin' ? 'Super Admin' : 'Admin'} users have access to all websites by default.
            </div>
          )}

          {/* Permissions Section */}
          {formData.role !== 'super_admin' && (
            <div className="permissionsSection appendTop24">
              <div className="makeFlex spaceBetween alignCenter appendBottom16">
                <h4 className="font16 fontSemiBold">Permissions</h4>
                <div className="makeFlex gap10">
                  <button
                    type="button"
                    className="btnSecondary"
                    onClick={handleSelectAllPermissions}
                    style={{ fontSize: '12px', padding: '6px 12px' }}
                  >
                    {selectedPermissions.length === permissions.length ? 'Deselect All' : 'Select All'}
                  </button>
                  {isSuperAdmin && permissions.length === 0 && (
                    <button
                      type="button"
                      className="btnPrimary"
                      onClick={handleSeedPermissions}
                      style={{ fontSize: '12px', padding: '6px 12px' }}
                    >
                      Seed Permissions
                    </button>
                  )}
                </div>
              </div>
              
              <div className="permissionGroups" style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                gap: '16px',
                maxHeight: '400px',
                overflowY: 'auto',
                padding: '16px',
                background: '#f8f9fa',
                borderRadius: '8px'
              }}>
                {groupedPermissions.map(group => {
                  const moduleKeys = group.permissions.map(p => p.key);
                  const allSelected = moduleKeys.every(key => selectedPermissions.includes(key));
                  const someSelected = moduleKeys.some(key => selectedPermissions.includes(key));
                  
                  return (
                    <div key={group.module} className="permissionGroup" style={{
                      background: '#fff',
                      padding: '12px',
                      borderRadius: '6px',
                      border: '1px solid #e9ecef'
                    }}>
                      <label className="moduleHeader" style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginBottom: '8px',
                        cursor: 'pointer',
                        fontWeight: '600',
                        color: '#495057'
                      }}>
                        <input
                          type="checkbox"
                          checked={allSelected}
                          ref={el => {
                            if (el) el.indeterminate = someSelected && !allSelected;
                          }}
                          onChange={() => handleModuleToggle(group.permissions)}
                          style={{ width: '16px', height: '16px' }}
                        />
                        <span style={{ textTransform: 'capitalize' }}>
                          {group.label}
                        </span>
                      </label>
                      <div className="modulePermissions" style={{ paddingLeft: '24px' }}>
                        {group.permissions.map(permission => (
                          <label key={permission.key} style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            marginBottom: '4px',
                            cursor: 'pointer',
                            fontSize: '13px',
                            color: '#6c757d'
                          }}>
                            <input
                              type="checkbox"
                              checked={selectedPermissions.includes(permission.key)}
                              onChange={() => handlePermissionToggle(permission.key)}
                              style={{ width: '14px', height: '14px' }}
                            />
                            <span>{permission.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              
              <div className="selectedCount appendTop8" style={{ fontSize: '13px', color: '#6c757d' }}>
                {selectedPermissions.length} permission(s) selected
              </div>
            </div>
          )}

          {formData.role === 'super_admin' && (
            <div className="superAdminNote appendTop16" style={{
              padding: '12px',
              background: '#fff3cd',
              borderRadius: '6px',
              color: '#856404',
              fontSize: '14px'
            }}>
              Super Admin has all permissions by default. No need to assign individual permissions.
            </div>
          )}

          {/* Form Actions */}
          <div className="formActions paddingTop24">
            <button
              type="submit"
              disabled={loading}
              className="btnPrimary"
            >
              {loading ? "Saving..." : (editingId ? "Update User" : "Create User")}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={handleCancel}
                className="btnSecondary"
                style={{ marginLeft: '10px' }}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Users List */}
      <div className="brandsListContainer paddingAll32">
        <div className="listHeader makeFlex spaceBetween end appendBottom24">
          <div className="leftSection">
            <h2 className="listTitle font30 fontBold blackText appendBottom16">
              Staff Users ({filteredUsers.length})
            </h2>
            <StatusFilter
              statusFilter={statusFilter}
              onStatusChange={setStatusFilter}
              counts={statusCounts}
              disabled={loading}
            />
            {/* Role Filter */}
            <div className="roleFilter appendTop12">
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="filterSelect"
                style={{
                  padding: '8px 12px',
                  borderRadius: '4px',
                  border: '1px solid #ddd',
                  background: '#fff'
                }}
              >
                <option value="all">All Roles</option>
                {ROLE_OPTIONS.map(role => (
                  <option key={role.value} value={role.value}>
                    {role.label} ({statusCounts[role.value] || 0})
                  </option>
                ))}
              </select>
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

        {/* Card View */}
        {viewMode === 'card' && (
          <>
            <div className="brandsGrid" style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: '20px'
            }}>
              {paginatedUsers.map(user => (
                <div
                  key={user._id}
                  className="brandCard"
                  style={{
                    background: '#fff',
                    borderRadius: '8px',
                    padding: '20px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                    opacity: user.deleted ? 0.6 : 1,
                    border: user.deleted ? '2px dashed #dc3545' : 'none'
                  }}
                >
                  <div className="cardHeader makeFlex spaceBetween alignCenter appendBottom12">
                    <div className="userInfo">
                      <h3 className="font16 fontSemiBold blackText">{user.name}</h3>
                      <p className="font13 grayText">{user.email}</p>
                      {user.username && (
                        <p className="font12 grayText">@{user.username}</p>
                      )}
                    </div>
                    <div className="userAvatar" style={{
                      width: '50px',
                      height: '50px',
                      borderRadius: '50%',
                      background: getRoleColor(user.role),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontWeight: 'bold',
                      fontSize: '18px'
                    }}>
                      {user.name?.charAt(0)?.toUpperCase()}
                    </div>
                  </div>
                  
                  <div className="cardBody appendBottom12">
                    <div className="makeFlex gap8 alignCenter appendBottom8">
                      <span
                        className="roleBadge"
                        style={{
                          padding: '4px 12px',
                          borderRadius: '20px',
                          fontSize: '12px',
                          fontWeight: '600',
                          background: getRoleColor(user.role),
                          color: '#fff'
                        }}
                      >
                        {getRoleLabel(user.role)}
                      </span>
                      <span
                        className="statusBadge"
                        style={{
                          padding: '4px 12px',
                          borderRadius: '20px',
                          fontSize: '12px',
                          background: user.deleted ? '#dc3545' : (user.isActive ? '#28a745' : '#ffc107'),
                          color: '#fff'
                        }}
                      >
                        {user.deleted ? 'Deleted' : (user.isActive ? 'Active' : 'Inactive')}
                      </span>
                      {user.lockedUntil && new Date(user.lockedUntil) > new Date() && (
                        <span
                          className="lockedBadge"
                          style={{
                            padding: '4px 12px',
                            borderRadius: '20px',
                            fontSize: '12px',
                            background: '#dc3545',
                            color: '#fff'
                          }}
                        >
                          Locked
                        </span>
                      )}
                    </div>
                    
                    {user.role !== 'super_admin' && (
                      <div className="permissionCount font13 grayText">
                        {user.permissions?.length || 0} permission(s)
                      </div>
                    )}
                    
                    {user.lastLoginAt && (
                      <div className="lastLogin font12 grayText appendTop8">
                        Last login: {new Date(user.lastLoginAt).toLocaleString()}
                      </div>
                    )}
                  </div>
                  
                  <div className="cardActions makeFlex gap8">
                    {!user.deleted ? (
                      <>
                        <button
                          onClick={() => handleEdit(user)}
                          className="btnSecondary"
                          style={{ flex: 1, fontSize: '13px', padding: '8px' }}
                        >
                          Edit
                        </button>
                        {user._id !== currentUser.id && (
                          <>
                            <button
                              onClick={() => handleToggleStatus(user._id)}
                              className={user.isActive ? "btnWarning" : "btnSuccess"}
                              style={{ flex: 1, fontSize: '13px', padding: '8px' }}
                            >
                              {user.isActive ? 'Disable' : 'Enable'}
                            </button>
                            <button
                              onClick={() => openPasswordModal(user._id)}
                              className="btnSecondary"
                              style={{ fontSize: '13px', padding: '8px' }}
                              title="Reset Password"
                            >
                              🔑
                            </button>
                            {user.lockedUntil && new Date(user.lockedUntil) > new Date() && (
                              <button
                                onClick={() => handleUnlock(user._id)}
                                className="btnPrimary"
                                style={{ fontSize: '13px', padding: '8px' }}
                                title="Unlock Account"
                              >
                                🔓
                              </button>
                            )}
                            <button
                              onClick={() => handleDelete(user)}
                              className="btnDanger"
                              style={{ fontSize: '13px', padding: '8px' }}
                              title="Delete User"
                            >
                              🗑️
                            </button>
                          </>
                        )}
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => handleRestore(user._id)}
                          className="btnSuccess"
                          style={{ flex: 1, fontSize: '13px', padding: '8px' }}
                        >
                          Restore
                        </button>
                        {isSuperAdmin && (
                          <button
                            onClick={() => handleDelete(user)}
                            className="btnDanger"
                            style={{ flex: 1, fontSize: '13px', padding: '8px' }}
                          >
                            Delete Permanently
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
            
            {displayedCount < filteredUsers.length && (
              <div className="loadMoreContainer appendTop24" style={{ textAlign: 'center' }}>
                <button
                  onClick={handleLoadMore}
                  className="btnSecondary"
                  disabled={loading}
                >
                  Load More ({filteredUsers.length - displayedCount} remaining)
                </button>
              </div>
            )}
          </>
        )}

        {/* List View */}
        {viewMode === 'list' && (
          <>
            <div className="usersTable" style={{ overflowX: 'auto' }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                background: '#fff',
                borderRadius: '8px',
                overflow: 'hidden'
              }}>
                <thead>
                  <tr style={{ background: '#f8f9fa' }}>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>User</th>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>Role</th>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>Status</th>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>Permissions</th>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>Last Login</th>
                    <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #dee2e6' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedUsers.map(user => (
                    <tr
                      key={user._id}
                      style={{
                        opacity: user.deleted ? 0.6 : 1,
                        background: user.deleted ? '#fff5f5' : '#fff'
                      }}
                    >
                      <td style={{ padding: '12px', borderBottom: '1px solid #dee2e6' }}>
                        <div>
                          <strong>{user.name}</strong>
                          <div className="font12 grayText">{user.email}</div>
                          {user.username && <div className="font11 grayText">@{user.username}</div>}
                        </div>
                      </td>
                      <td style={{ padding: '12px', borderBottom: '1px solid #dee2e6' }}>
                        <span style={{
                          padding: '4px 10px',
                          borderRadius: '20px',
                          fontSize: '12px',
                          fontWeight: '600',
                          background: getRoleColor(user.role),
                          color: '#fff'
                        }}>
                          {getRoleLabel(user.role)}
                        </span>
                      </td>
                      <td style={{ padding: '12px', borderBottom: '1px solid #dee2e6' }}>
                        <span style={{
                          padding: '4px 10px',
                          borderRadius: '20px',
                          fontSize: '12px',
                          background: user.deleted ? '#dc3545' : (user.isActive ? '#28a745' : '#ffc107'),
                          color: '#fff'
                        }}>
                          {user.deleted ? 'Deleted' : (user.isActive ? 'Active' : 'Inactive')}
                        </span>
                      </td>
                      <td style={{ padding: '12px', borderBottom: '1px solid #dee2e6' }}>
                        {user.role === 'super_admin' ? (
                          <span className="font12 grayText">All Permissions</span>
                        ) : (
                          <span>{user.permissions?.length || 0} assigned</span>
                        )}
                      </td>
                      <td style={{ padding: '12px', borderBottom: '1px solid #dee2e6' }}>
                        {user.lastLoginAt ? (
                          <span className="font12">{new Date(user.lastLoginAt).toLocaleDateString()}</span>
                        ) : (
                          <span className="font12 grayText">Never</span>
                        )}
                      </td>
                      <td style={{ padding: '12px', borderBottom: '1px solid #dee2e6', textAlign: 'center' }}>
                        <div className="makeFlex gap8 justifyCenter">
                          {!user.deleted ? (
                            <>
                              <button onClick={() => handleEdit(user)} className="btnSecondary" style={{ fontSize: '12px', padding: '6px 10px' }}>Edit</button>
                              {user._id !== currentUser.id && (
                                <>
                                  <button onClick={() => handleToggleStatus(user._id)} className={user.isActive ? "btnWarning" : "btnSuccess"} style={{ fontSize: '12px', padding: '6px 10px' }}>
                                    {user.isActive ? 'Disable' : 'Enable'}
                                  </button>
                                  <button onClick={() => handleDelete(user)} className="btnDanger" style={{ fontSize: '12px', padding: '6px 10px' }}>Delete</button>
                                </>
                              )}
                            </>
                          ) : (
                            <>
                              <button onClick={() => handleRestore(user._id)} className="btnSuccess" style={{ fontSize: '12px', padding: '6px 10px' }}>Restore</button>
                              {isSuperAdmin && (
                                <button onClick={() => handleDelete(user)} className="btnDanger" style={{ fontSize: '12px', padding: '6px 10px' }}>Permanent</button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              disabled={loading}
            />
          </>
        )}

        {filteredUsers.length === 0 && !loading && (
          <div className="emptyState" style={{
            textAlign: 'center',
            padding: '60px 20px',
            color: '#6c757d'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>👥</div>
            <h3>No users found</h3>
            <p>Try adjusting your filters or create a new staff user.</p>
          </div>
        )}
      </div>

      {/* Delete Confirmation Popup */}
      <DeleteConfirmationPopup
        isOpen={showDeletePopup}
        onClose={() => setShowDeletePopup(false)}
        onConfirm={handleDeleteConfirm}
        title={deleteAction === 'hard' ? "Permanently Delete User" : "Delete User"}
        message={
          deleteAction === 'hard'
            ? `Are you sure you want to permanently delete "${userToDelete?.name}"? This action cannot be undone.`
            : `Are you sure you want to delete "${userToDelete?.name}"? You can restore them later.`
        }
        confirmText={deleteAction === 'hard' ? "Delete Permanently" : "Delete"}
        loading={loading}
      />

      {/* Password Reset Modal */}
      {showPasswordModal && (
        <div className="modalOverlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div className="modalContent" style={{
            background: '#fff',
            padding: '24px',
            borderRadius: '8px',
            width: '100%',
            maxWidth: '400px'
          }}>
            <h3 className="appendBottom16">Reset Password</h3>
            <FormField
              label="New Password"
              name="newPassword"
              type="password"
              value={passwordResetData.newPassword}
              onChange={(e) => setPasswordResetData(prev => ({ ...prev, newPassword: e.target.value }))}
              placeholder="Enter new password (min 8 chars)"
            />
            <FormField
              label="Confirm Password"
              name="confirmPassword"
              type="password"
              value={passwordResetData.confirmPassword}
              onChange={(e) => setPasswordResetData(prev => ({ ...prev, confirmPassword: e.target.value }))}
              placeholder="Confirm new password"
            />
            <div className="modalActions makeFlex gap10 appendTop16">
              <button
                onClick={handlePasswordReset}
                className="btnPrimary"
                disabled={loading}
              >
                {loading ? "Resetting..." : "Reset Password"}
              </button>
              <button
                onClick={() => setShowPasswordModal(false)}
                className="btnSecondary"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer Promotion Modal */}
      {showPromoteModal && (
        <div className="modalOverlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div className="modalContent" style={{
            background: '#fff',
            padding: '24px',
            borderRadius: '8px',
            width: '100%',
            maxWidth: '600px',
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            <h3 className="appendBottom16" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#28a745' }}>↑</span> Upgrade Customer to Staff
            </h3>
            
            {/* Customer Search */}
            <div style={{ marginBottom: '16px' }}>
              <label className="fieldLabel">Search Customer</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  placeholder="Search by name, email, or phone..."
                  style={{
                    flex: 1,
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '4px'
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      fetchCustomers(customerSearch);
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => fetchCustomers(customerSearch)}
                  className="btnPrimary"
                  style={{ padding: '10px 20px' }}
                >
                  Search
                </button>
              </div>
            </div>

            {/* Customer List */}
            {customersLoading ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
                Loading customers...
              </div>
            ) : customers.length > 0 ? (
              <div style={{ 
                maxHeight: '200px', 
                overflow: 'auto', 
                border: '1px solid #eee', 
                borderRadius: '4px',
                marginBottom: '16px'
              }}>
                {customers.map(customer => (
                  <div
                    key={customer._id}
                    onClick={() => setSelectedCustomer(customer)}
                    style={{
                      padding: '12px',
                      borderBottom: '1px solid #eee',
                      cursor: 'pointer',
                      background: selectedCustomer?._id === customer._id ? '#e3f2fd' : '#fff',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: '500' }}>{customer.name}</div>
                      <div style={{ fontSize: '12px', color: '#666' }}>{customer.email}</div>
                      {customer.phone && (
                        <div style={{ fontSize: '12px', color: '#888' }}>{customer.phone}</div>
                      )}
                    </div>
                    {selectedCustomer?._id === customer._id && (
                      <span style={{ color: '#28a745', fontWeight: 'bold' }}>✓</span>
                    )}
                  </div>
                ))}
              </div>
            ) : customerSearch ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#666', marginBottom: '16px' }}>
                No customers found matching "{customerSearch}"
              </div>
            ) : (
              <div style={{ padding: '20px', textAlign: 'center', color: '#666', marginBottom: '16px' }}>
                Enter a name, email, or phone to search for customers
              </div>
            )}

            {/* Selected Customer Info */}
            {selectedCustomer && (
              <div style={{
                padding: '12px',
                background: '#f8f9fa',
                borderRadius: '4px',
                marginBottom: '16px'
              }}>
                <div style={{ fontWeight: '500', marginBottom: '4px' }}>
                  Selected: {selectedCustomer.name}
                </div>
                <div style={{ fontSize: '13px', color: '#666' }}>
                  {selectedCustomer.email}
                </div>
              </div>
            )}

            {/* Role Selection */}
            <div style={{ marginBottom: '16px' }}>
              <label className="fieldLabel">Select Role</label>
              <select
                value={promoteRole}
                onChange={(e) => setPromoteRole(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '4px'
                }}
              >
                <option value="editor">Editor</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            {/* Permissions Selection */}
            {promoteRole !== 'super_admin' && groupedPermissions.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <label className="fieldLabel">Assign Permissions</label>
                <div style={{
                  maxHeight: '200px',
                  overflow: 'auto',
                  border: '1px solid #eee',
                  borderRadius: '4px',
                  padding: '8px'
                }}>
                  {groupedPermissions.map(group => (
                    <div key={group.module} style={{ marginBottom: '12px' }}>
                      <div style={{
                        fontWeight: '500',
                        fontSize: '13px',
                        color: '#333',
                        marginBottom: '6px',
                        textTransform: 'capitalize'
                      }}>
                        {group.label}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {group.permissions.map(perm => (
                          <label
                            key={perm.key}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '12px',
                              cursor: 'pointer',
                              padding: '4px 8px',
                              background: promotePermissions.includes(perm.key) ? '#e3f2fd' : '#f5f5f5',
                              borderRadius: '4px'
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={promotePermissions.includes(perm.key)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setPromotePermissions(prev => [...prev, perm.key]);
                                } else {
                                  setPromotePermissions(prev => prev.filter(k => k !== perm.key));
                                }
                              }}
                            />
                            {perm.label}
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="modalActions makeFlex gap10 appendTop16">
              <button
                onClick={handlePromoteCustomer}
                className="btnPrimary"
                disabled={loading || !selectedCustomer}
                style={{
                  background: '#28a745',
                  opacity: (!selectedCustomer || loading) ? 0.6 : 1
                }}
              >
                {loading ? "Promoting..." : "Promote to Staff"}
              </button>
              <button
                onClick={() => {
                  setShowPromoteModal(false);
                  setSelectedCustomer(null);
                  setPromoteRole("editor");
                  setPromotePermissions([]);
                  setCustomerSearch("");
                  setCustomers([]);
                }}
                className="btnSecondary"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserAccessManager;
