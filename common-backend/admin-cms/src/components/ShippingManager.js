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

const ShippingManager = () => {
  const [shippings, setShippings] = useState([]);
  const [users, setUsers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [viewMode, setViewMode] = useState('card');
  const [statusFilter, setStatusFilter] = useState('all');
  
  // Delete confirmation popup state
  const [deletePopup, setDeletePopup] = useState({
    isVisible: false,
    shippingId: null,
    message: "",
    isPermanentDelete: false,
    action: "delete"
  });
  
  // Refs
  const formRef = useRef(null);
  const nameInputRef = useRef(null);
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [hasMoreCards, setHasMoreCards] = useState(true);
  const [displayedCards, setDisplayedCards] = useState([]);
  
  const initialFormData = {
    name: "",
    phone: "",
    email: "",
    street: "",
    city: "",
    state: "",
    zipCode: "",
    country: "India",
    landmark: "",
    addressType: "home",
    isDefault: false,
    user: "",
    order: "",
    isActive: false
  };

  const [formData, setFormData] = useState(initialFormData);
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch users and orders for dropdowns
  useEffect(() => {
    const fetchDropdownData = async () => {
      try {
        const [usersRes, ordersRes] = await Promise.all([
          api.get('/users?showInactive=true&includeDeleted=false'),
          api.get('/orders?showInactive=true&includeDeleted=false&limit=1000')
        ]);
        setUsers(usersRes.data || []);
        setOrders(ordersRes.data || []);
      } catch (err) {
        console.error('Error fetching dropdown data:', err);
      }
    };
    fetchDropdownData();
  }, []);

  // Fetch shipping addresses
  const fetchShippings = async () => {
    try {
      setLoading(true);
      const response = await api.get('/shipping?showInactive=true&includeDeleted=true');
      setShippings(response.data || []);
      setError("");
    } catch (err) {
      setError("Failed to fetch shipping addresses");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShippings();
  }, []);

  // Filter shippings
  const filteredShippings = useMemo(() => {
    let filtered = shippings;
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(shipping => 
        shipping.name?.toLowerCase().includes(query) ||
        shipping.city?.toLowerCase().includes(query) ||
        shipping.state?.toLowerCase().includes(query) ||
        shipping.zipCode?.includes(query) ||
        shipping.user?.name?.toLowerCase().includes(query)
      );
    }
    
    filtered = filterEntitiesByStatus(filtered, statusFilter);
    
    return filtered;
  }, [shippings, searchQuery, statusFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredShippings.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentShippings = filteredShippings.slice(startIndex, endIndex);

  // Card lazy loading
  useEffect(() => {
    if (viewMode === 'card') {
      const initialCards = filteredShippings.slice(0, 12);
      setDisplayedCards(initialCards);
      setHasMoreCards(filteredShippings.length > 12);
      setCurrentPage(1);
    }
  }, [viewMode, filteredShippings]);

  const resetPaginationForSearch = useCallback(() => {
    setCurrentPage(1);
    if (viewMode === 'card') {
      const initialCards = filteredShippings.slice(0, 12);
      setDisplayedCards(initialCards);
      setHasMoreCards(filteredShippings.length > 12);
    }
  }, [viewMode, filteredShippings.length]);

  useEffect(() => {
    resetPaginationForSearch();
  }, [searchQuery, resetPaginationForSearch]);

  const handlePageChange = useCallback((pageNumber) => {
    setCurrentPage(pageNumber);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleLoadMoreCards = useCallback(() => {
    setDisplayedCards(prevCards => {
      const currentCardCount = prevCards.length;
      const nextCards = filteredShippings.slice(currentCardCount, currentCardCount + 12);
      
      if (nextCards.length > 0) {
        setHasMoreCards(currentCardCount + nextCards.length < filteredShippings.length);
        return [...prevCards, ...nextCards];
      } else {
        setHasMoreCards(false);
        return prevCards;
      }
    });
  }, [filteredShippings]);

  const handleViewModeChange = useCallback((mode) => {
    setViewMode(mode);
    setCurrentPage(1);
    if (mode === 'card') {
      const initialCards = filteredShippings.slice(0, 12);
      setDisplayedCards(initialCards);
      setHasMoreCards(filteredShippings.length > 12);
    }
  }, [filteredShippings.length]);

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
  };

  const clearForm = () => {
    setFormData(initialFormData);
    setEditingId(null);
    setError("");
    setSuccess("");
  };

  // Handle submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name || !formData.street || !formData.city || !formData.state || !formData.zipCode || !formData.country) {
      setError("Name, street, city, state, zip code, and country are required");
      return;
    }

    try {
      setLoading(true);
      setSuccess("");
      setError("");

      const shippingData = {
        name: formData.name.trim(),
        phone: formData.phone?.trim() || null,
        email: formData.email?.trim() || null,
        street: formData.street.trim(),
        city: formData.city.trim(),
        state: formData.state.trim(),
        zipCode: formData.zipCode.trim(),
        country: formData.country.trim(),
        landmark: formData.landmark?.trim() || null,
        addressType: formData.addressType || 'home',
        isDefault: formData.isDefault || false,
        user: formData.user || null,
        order: formData.order || null,
        isActive: formData.isActive
      };

      if (editingId) {
        await api.put(`/shipping/${editingId}`, shippingData);
        setSuccess(`✅ Shipping address has been updated successfully!`);
      } else {
        await api.post('/shipping', shippingData);
        setSuccess(`✅ Shipping address has been created successfully!`);
      }

      await fetchShippings();
      resetForm();
      
    } catch (err) {
      setError(`❌ Failed to ${editingId ? 'update' : 'create'} shipping address. ${err.response?.data?.msg || 'Please try again.'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (shipping) => {
    setFormData({
      name: shipping.name || "",
      phone: shipping.phone || "",
      email: shipping.email || "",
      street: shipping.street || "",
      city: shipping.city || "",
      state: shipping.state || "",
      zipCode: shipping.zipCode || "",
      country: shipping.country || "India",
      landmark: shipping.landmark || "",
      addressType: shipping.addressType || "home",
      isDefault: shipping.isDefault || false,
      user: shipping.user?._id || shipping.user || "",
      order: shipping.order?._id || shipping.order || "",
      isActive: shipping.isActive !== undefined ? shipping.isActive : false
    });
    setEditingId(shipping._id || shipping.id);
    setError("");
    setSuccess("");
    
    setTimeout(() => {
      if (formRef.current) {
        formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      if (nameInputRef.current) {
        nameInputRef.current.focus();
      }
    }, 100);
  };

  const handleDelete = (shippingId) => {
    const shipping = shippings.find(s => s._id === shippingId);
    const isAlreadyDeleted = shipping?.deleted;
    
    setDeletePopup({
      isVisible: true,
      shippingId,
      message: isAlreadyDeleted 
        ? "This shipping address is already marked as deleted. Click OK to permanently remove it from the database. This action cannot be undone."
        : "This will mark the shipping address as inactive and add a deleted flag. Click OK to continue.",
      isPermanentDelete: isAlreadyDeleted,
      action: "delete"
    });
  };

  const handleDeleteConfirm = async () => {
    const { shippingId, isPermanentDelete } = deletePopup;
    const shipping = shippings.find(s => s._id === shippingId);
    
    try {
      setLoading(true);
      setSuccess("");
      setError("");
      
      if (isPermanentDelete) {
        await api.delete(`/shipping/${shippingId}/hard`);
        setSuccess(`🗑️ Shipping address has been permanently deleted.`);
      } else {
        await api.delete(`/shipping/${shippingId}`);
        setSuccess(`⏸️ Shipping address has been marked as deleted and inactive.`);
      }
      
      await fetchShippings();
    } catch (err) {
      const action = isPermanentDelete ? "permanently delete" : "mark as deleted";
      setError(`❌ Failed to ${action} shipping address. ${err.response?.data?.msg || 'Please try again.'}`);
    } finally {
      setLoading(false);
      setDeletePopup({
        isVisible: false,
        shippingId: null,
        message: "",
        isPermanentDelete: false,
        action: "delete"
      });
    }
  };

  const handleDeleteCancel = () => {
    setDeletePopup({
      isVisible: false,
      shippingId: null,
      message: "",
      isPermanentDelete: false,
      action: "delete"
    });
  };

  const handleRevert = async (shippingId) => {
    const shipping = shippings.find(s => s._id === shippingId);
    
    if (!shipping) {
      setError("Shipping address not found");
      return;
    }

    if (!shipping.deleted) {
      setError("This shipping address is not deleted");
      return;
    }

    setDeletePopup({
      isVisible: true,
      shippingId,
      message: `Are you sure you want to restore this shipping address? This will make it active again.`,
      isPermanentDelete: false,
      action: "revert"
    });
  };

  const handleRevertConfirm = async () => {
    const { shippingId } = deletePopup;
    const shipping = shippings.find(s => s._id === shippingId);
    
    try {
      setLoading(true);
      setSuccess("");
      setError("");

      await api.put(`/shipping/${shippingId}`, {
        name: shipping.name,
        phone: shipping.phone,
        email: shipping.email,
        street: shipping.street,
        city: shipping.city,
        state: shipping.state,
        zipCode: shipping.zipCode,
        country: shipping.country,
        landmark: shipping.landmark,
        addressType: shipping.addressType,
        isDefault: shipping.isDefault,
        user: shipping.user?._id || shipping.user,
        order: shipping.order?._id || shipping.order,
        isActive: true,
        deleted: false
      });

      setSuccess(`✅ Shipping address has been restored and is now active!`);
      await fetchShippings();
    } catch (err) {
      setError(`❌ Failed to restore shipping address. ${err.response?.data?.msg || 'Please try again.'}`);
    } finally {
      setLoading(false);
      setDeletePopup({
        isVisible: false,
        shippingId: null,
        message: "",
        isPermanentDelete: false,
        action: "delete"
      });
    }
  };

  const handleRevertCancel = () => {
    setDeletePopup({
      isVisible: false,
      shippingId: null,
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
      <PageHeader
        title="Shipping Address Management"
        subtitle="Manage customer shipping addresses for orders"
        isEditing={!!editingId}
        editText="Edit Shipping Address"
        createText="Add New Shipping Address"
      />

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
          {/* User and Order Selection */}
          <div className="makeFlex row gap10">
            <div className="fullWidth">
              <FormField
                type="select"
                name="user"
                label="Customer (Optional)"
                value={formData.user}
                onChange={handleChange}
                options={[
                  { value: "", label: "Select Customer" },
                  ...users.map(user => ({
                    value: user._id,
                    label: `${user.name} (${user.email})`
                  }))
                ]}
              />
            </div>
            <div className="fullWidth">
              <FormField
                type="select"
                name="order"
                label="Order (Optional)"
                value={formData.order}
                onChange={handleChange}
                options={[
                  { value: "", label: "Select Order" },
                  ...orders.map(order => ({
                    value: order._id,
                    label: `${order.orderNumber || order._id}`
                  }))
                ]}
              />
            </div>
          </div>

          {/* Contact Information */}
          <div className="makeFlex row gap10 paddingTop16">
            <div className="fullWidth">
              <FormField
                ref={nameInputRef}
                type="text"
                name="name"
                label="Full Name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Enter full name"
                required={true}
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

          {/* Address */}
          <div className="makeFlex row gap10 paddingTop16">
            <div className="fullWidth">
              <FormField
                type="textarea"
                name="street"
                label="Street Address"
                value={formData.street}
                onChange={handleChange}
                placeholder="Enter street address"
                required={true}
                rows={2}
              />
            </div>
          </div>

          <div className="makeFlex row gap10">
            <div className="fullWidth">
              <FormField
                type="text"
                name="city"
                label="City"
                value={formData.city}
                onChange={handleChange}
                placeholder="Enter city"
                required={true}
              />
            </div>
            <div className="fullWidth">
              <FormField
                type="text"
                name="state"
                label="State"
                value={formData.state}
                onChange={handleChange}
                placeholder="Enter state"
                required={true}
              />
            </div>
            <div className="fullWidth">
              <FormField
                type="text"
                name="zipCode"
                label="Zip Code"
                value={formData.zipCode}
                onChange={handleChange}
                placeholder="Enter zip code"
                required={true}
              />
            </div>
            <div className="fullWidth">
              <FormField
                type="text"
                name="country"
                label="Country"
                value={formData.country}
                onChange={handleChange}
                placeholder="Enter country"
                required={true}
              />
            </div>
          </div>

          <div className="makeFlex row gap10">
            <div className="fullWidth">
              <FormField
                type="text"
                name="landmark"
                label="Landmark (Optional)"
                value={formData.landmark}
                onChange={handleChange}
                placeholder="Enter landmark"
              />
            </div>
            <div className="fullWidth">
              <FormField
                type="select"
                name="addressType"
                label="Address Type"
                value={formData.addressType}
                onChange={handleChange}
                options={[
                  { value: "home", label: "Home" },
                  { value: "work", label: "Work" },
                  { value: "other", label: "Other" }
                ]}
              />
            </div>
          </div>

          {/* Status */}
          <div className="makeFlex row gap10 paddingTop16">
            <div className="makeFlex column appendBottom16">
              <label className="formLabel appendBottom8 makeFlex gap10">
                <FormField
                  type="checkbox"
                  name="isDefault"
                  checked={formData.isDefault}
                  onChange={handleChange}
                />
                Set as Default Address
              </label>
              <label className="formLabel appendBottom8 makeFlex gap10">
                <FormField
                  type="checkbox"
                  name="isActive"
                  checked={formData.isActive}
                  onChange={handleChange}
                />
                Active
              </label>
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
                <span>{editingId ? "Update Shipping Address" : "Add Shipping Address"}</span>
              )}
            </button>
            
            {(editingId || (!editingId && formData.name)) && (
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
                Add Another Address
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Shipping Addresses List */}
      <div className="brandsListContainer paddingAll32">
        <div className="listHeader makeFlex spaceBetween end appendBottom24">
          <div className="leftSection">
            <h2 className="listTitle font30 fontBold blackText appendBottom16">
              Shipping Addresses ({filteredShippings?.length || 0})
            </h2>
            <StatusFilter
              statusFilter={statusFilter}
              onStatusChange={setStatusFilter}
              counts={calculateStandardStatusCounts(shippings)}
              disabled={loading}
            />
          </div>
          <div className="rightSection makeFlex end gap10">
            <SearchField
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search shipping addresses..."
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

        {filteredShippings.length === 0 && !loading ? (
          <div className="emptyState textCenter paddingAll60">
            <div className="emptyIcon appendBottom16">📦</div>
            <h3 className="font22 fontSemiBold grayText appendBottom8">No Shipping Addresses Found</h3>
            <p className="font16 grayText">Start by adding your first shipping address above</p>
          </div>
        ) : (
          <>
            {/* Card View */}
            {viewMode === 'card' && (
              <div className="brandsGrid">
                {displayedCards.map((shipping) => (
                  <EntityCard
                    key={shipping._id || shipping.id}
                    entity={shipping}
                    logoField="image"
                    nameField="name"
                    idField="_id"
                    onEdit={shipping.deleted ? undefined : handleEdit}
                    onDelete={handleDelete}
                    onRevert={shipping.deleted ? () => handleRevert(shipping._id || shipping.id) : undefined}
                    loading={loading}
                    imagePlaceholderColor={generateEntityColor(shipping._id || shipping.id, shipping.name)}
                    renderHeader={(shipping) => (
                      <EntityCardHeader
                        entity={shipping}
                        imageField="image"
                        titleField="name"
                        dateField="createdAt"
                        generateColor={generateEntityColor}
                      />
                    )}
                    renderDetails={(shipping) => {
                      return (
                        <>
                          <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                            <span className="detailLabel font14 fontSemiBold grayText textUppercase">Address ID:</span>
                            <span className="detailValue font14 blackText appendLeft6">{shipping._id || 'N/A'}</span>
                          </div>
                          {shipping.user && (
                            <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                              <span className="detailLabel font14 fontSemiBold grayText textUppercase">Customer:</span>
                              <span className="detailValue font14 blackText appendLeft6">
                                {shipping.user?.name || 'N/A'}
                              </span>
                            </div>
                          )}
                          <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                            <span className="detailLabel font14 fontSemiBold grayText textUppercase">Address:</span>
                            <span className="detailValue font14 blackText appendLeft6">
                              {shipping.street}, {shipping.city}, {shipping.state} {shipping.zipCode}
                            </span>
                          </div>
                          <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                            <span className="detailLabel font14 fontSemiBold grayText textUppercase">Country:</span>
                            <span className="detailValue font14 blackText appendLeft6">{shipping.country}</span>
                          </div>
                          {shipping.phone && (
                            <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                              <span className="detailLabel font14 fontSemiBold grayText textUppercase">Phone:</span>
                              <span className="detailValue font14 blackText appendLeft6">{shipping.phone}</span>
                            </div>
                          )}
                          <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                            <span className="detailLabel font14 fontSemiBold grayText textUppercase">Type:</span>
                            <span className="detailValue font14 blackText appendLeft6 capitalize">
                              {shipping.addressType || 'home'}
                            </span>
                          </div>
                          {shipping.isDefault && (
                            <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                              <span className="detailLabel font14 fontSemiBold grayText textUppercase">Default:</span>
                              <span className="detailValue font14 greenText appendLeft6">Yes</span>
                            </div>
                          )}
                          <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                            <span className="detailLabel font14 fontSemiBold grayText textUppercase">Status:</span>
                            <span className={`detailValue font14 ${shipping.deleted ? 'deleted' : (shipping.isActive ? 'greenText' : 'inactive')} appendLeft6`}>
                              {shipping.deleted ? 'Deleted' : (shipping.isActive ? 'Active' : 'Inactive')}
                            </span>
                          </div>
                        </>
                      );
                    }}
                    renderActions={(shipping) => (
                      <ActionButtons
                        onEdit={shipping.deleted ? undefined : () => handleEdit(shipping)}
                        onDelete={() => handleDelete(shipping._id || shipping.id)}
                        onRevert={shipping.deleted ? () => handleRevert(shipping._id || shipping.id) : undefined}
                        loading={loading}
                        size="normal"
                        editText="✏️ Edit"
                        deleteText={shipping.deleted ? "🗑️ Final Del" : "🗑️ Delete"}
                        revertText="🔄 Undelete"
                        editTitle="Edit Shipping Address"
                        deleteTitle={shipping.deleted ? "Final Del" : "Delete Shipping Address"}
                        revertTitle="Restore Shipping Address"
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
                        <th className="tableHeader">Customer</th>
                        <th className="tableHeader">Address</th>
                        <th className="tableHeader">City</th>
                        <th className="tableHeader">State</th>
                        <th className="tableHeader">Zip Code</th>
                        <th className="tableHeader">Default</th>
                        <th className="tableHeader">Status</th>
                        <th className="tableHeader">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentShippings.map((shipping) => (
                        <tr key={shipping._id || shipping.id} className="tableRow">
                          <td className="tableCell">
                            <span className="brandNameText">{shipping.name}</span>
                          </td>
                          <td className="tableCell">
                            <span className="addressText">
                              {shipping.user?.name || '-'}
                            </span>
                          </td>
                          <td className="tableCell">
                            <span className="addressText" title={`${shipping.street}, ${shipping.city}`}>
                              {shipping.street?.length > 30 ? `${shipping.street.substring(0, 30)}...` : shipping.street}
                            </span>
                          </td>
                          <td className="tableCell">
                            <span className="addressText">{shipping.city}</span>
                          </td>
                          <td className="tableCell">
                            <span className="addressText">{shipping.state}</span>
                          </td>
                          <td className="tableCell">
                            <span className="addressText">{shipping.zipCode}</span>
                          </td>
                          <td className="tableCell">
                            <span className={`statusText ${shipping.isDefault ? 'active' : 'inactive'}`}>
                              {shipping.isDefault ? 'Yes' : 'No'}
                            </span>
                          </td>
                          <td className="tableCell">
                            <span className={`statusText ${shipping.deleted ? 'deleted' : (shipping.isActive ? 'active' : 'inactive')}`}>
                              {shipping.deleted ? 'Deleted' : (shipping.isActive ? 'Active' : 'Inactive')}
                            </span>
                          </td>
                          <td className="tableCell">
                            <div className="tableActions makeFlex gap8">
                              <ActionButtons
                                onEdit={shipping.deleted ? undefined : () => handleEdit(shipping)}
                                onDelete={() => handleDelete(shipping._id || shipping.id)}
                                onRevert={shipping.deleted ? () => handleRevert(shipping._id || shipping.id) : undefined}
                                loading={loading}
                                size="small"
                                editText="✏️"
                                deleteText={shipping.deleted ? "🗑️" : "🗑️"}
                                revertText="🔄"
                                editTitle="Edit Shipping Address"
                                deleteTitle={shipping.deleted ? "Final Del" : "Delete Shipping Address"}
                                revertTitle="Restore Shipping Address"
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

export default ShippingManager;
