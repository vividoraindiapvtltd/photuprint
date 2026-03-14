import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useSearchParams } from 'react-router-dom';
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
  InvoicePopup,
  ShippingLabelPopup,
  calculateStandardStatusCounts,
  filterEntitiesByStatus,
  generateEntityColor 
} from '../common';
import TrackingComponent from './TrackingComponent';
import AddTrackingPopup from './AddTrackingPopup';

const OrderManager = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [orders, setOrders] = useState([]);
  const [users, setUsers] = useState([]);
  const [products, setProducts] = useState([]);
  const [websites, setWebsites] = useState([]); // For website dropdown
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editingId, setEditingId] = useState(null);
  
  // Initialize filters from URL params
  const orderStatusFromUrl = searchParams.get('orderStatus') || 'all';
  const paymentStatusFromUrl = searchParams.get('paymentStatus') || 'all';
  const filterFromUrl = searchParams.get('filter'); // 'today', 'weekly', 'monthly'
  
  const initialFormData = {
    user: "",
    products: [{ product: "", quantity: 1, price: 0, productName: "" }],
    subtotal: 0, // Number
    tax: 0, // Number
    shippingCharges: 0, // Number
    discount: 0, // Number
    couponCode: "",
    couponId: "",
    shippingAddress: {
      name: "",
      phone: "",
      street: "",
      city: "",
      state: "",
      zipCode: "",
      country: ""
    },
    billingAddress: {
      name: "",
      phone: "",
      street: "",
      city: "",
      state: "",
      zipCode: "",
      country: ""
    },
    paymentMethod: "credit_card",
    paymentStatus: "pending",
    orderStatus: "pending",
    courierName: "",
    courierServiceType: "",
    trackingNumber: "",
    trackingUrl: "",
    shipmentDate: "",
    estimatedDeliveryDate: "",
    notes: "",
    adminNotes: "",
    website: "", // Website ID
    domain: "" // Domain string (alternative)
  };

  const [formData, setFormData] = useState(initialFormData);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState(paymentStatusFromUrl);
  const [orderStatusFilter, setOrderStatusFilter] = useState(orderStatusFromUrl);
  const [useSameAddress, setUseSameAddress] = useState(true);
  const [activeTab, setActiveTab] = useState('products'); // 'products', 'shipping', 'billing', 'tracking'
  
  // Delete confirmation popup state
  const [deletePopup, setDeletePopup] = useState({
    isVisible: false,
    orderId: null,
    message: "",
    isPermanentDelete: false,
    action: "delete"
  });
  
  // Invoice and Shipping Label popup state
  const [invoicePopup, setInvoicePopup] = useState({
    isVisible: false,
    order: null
  });
  
  const [shippingLabelPopup, setShippingLabelPopup] = useState({
    isVisible: false,
    order: null
  });
  
  // Tracking popup state
  const [trackingPopup, setTrackingPopup] = useState({
    isVisible: false,
    orderId: null,
    orderNumber: null
  });
  
  const [addTrackingPopup, setAddTrackingPopup] = useState({
    isVisible: false,
    orderId: null,
    orderNumber: null
  });
  
  // Refs
  const formRef = useRef(null);
  
  // View mode and pagination states
  const [viewMode, setViewMode] = useState('list');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [hasMoreCards, setHasMoreCards] = useState(true);
  const [displayedCards, setDisplayedCards] = useState([]);

  // Fetch users, products, and websites for dropdowns
  useEffect(() => {
    const fetchDropdownData = async () => {
      try {
        setLoading(true);
        const [usersRes, productsRes, websitesRes] = await Promise.all([
          api.get('/users?showInactive=true&includeDeleted=false'),
          api.get('/products?showInactive=true&includeDeleted=false&limit=1000'),
          api.get('/websites?showInactive=false&includeDeleted=false')
        ]);
        
        // Handle users
        const usersData = usersRes.data || [];
        setUsers(Array.isArray(usersData) ? usersData : []);
        
        // Handle products - API returns { products: [...], total, page, pages }
        let productsData = [];
        if (productsRes.data) {
          if (Array.isArray(productsRes.data)) {
            productsData = productsRes.data;
          } else if (productsRes.data.products && Array.isArray(productsRes.data.products)) {
            productsData = productsRes.data.products;
          } else if (Array.isArray(productsRes.data.data)) {
            productsData = productsRes.data.data;
          }
        }
        setProducts(productsData);
        console.log('Products loaded:', productsData.length);
        
        // Handle websites
        const websitesData = websitesRes.data || [];
        setWebsites(Array.isArray(websitesData) ? websitesData : []);
      } catch (err) {
        console.error('Error fetching dropdown data:', err);
        setError(`Failed to load dropdown data: ${err.response?.data?.msg || err.message}`);
      } finally {
        setLoading(false);
      }
    };
    fetchDropdownData();
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (name.startsWith('shippingAddress.')) {
      const field = name.split('.')[1];
      setFormData({
        ...formData,
        shippingAddress: {
          ...formData.shippingAddress,
          [field]: value
        }
      });
      // If use same address is checked, update billing address too
      if (useSameAddress) {
        setFormData(prev => ({
          ...prev,
          billingAddress: {
            ...prev.billingAddress,
            [field]: value
          }
        }));
      }
    } else if (name.startsWith('billingAddress.')) {
      const field = name.split('.')[1];
      setFormData({
        ...formData,
        billingAddress: {
          ...formData.billingAddress,
          [field]: value
        }
      });
    } else if (name === 'user') {
      // When user is selected, auto-populate shipping address from user profile
      const selectedUser = users.find(u => u._id === value);
      if (selectedUser) {
        const userAddress = selectedUser.address || {};
        setFormData({
          ...formData,
          user: value,
          shippingAddress: {
            name: selectedUser.name || "",
            phone: selectedUser.phone || "",
            street: userAddress.street || "",
            city: userAddress.city || "",
            state: userAddress.state || "",
            zipCode: userAddress.zipCode || "",
            country: userAddress.country || ""
          },
          // Also update billing address if "use same address" is checked
          billingAddress: useSameAddress ? {
            name: selectedUser.name || "",
            phone: selectedUser.phone || "",
            street: userAddress.street || "",
            city: userAddress.city || "",
            state: userAddress.state || "",
            zipCode: userAddress.zipCode || "",
            country: userAddress.country || ""
          } : formData.billingAddress
        });
      } else {
        setFormData({ ...formData, user: value });
      }
    } else if (name.startsWith('products.')) {
      const parts = name.split('.');
      const index = parseInt(parts[1]);
      const field = parts[2];
      const updatedProducts = [...formData.products];
      
      if (field === 'product') {
        const selectedProduct = products.find(p => p._id === value);
        updatedProducts[index] = {
          ...updatedProducts[index],
          product: value,
          productName: selectedProduct?.name || "",
          price: selectedProduct?.price || selectedProduct?.discountedPrice || 0,
          quantity: updatedProducts[index].quantity || 1
        };
      } else {
        updatedProducts[index] = {
          ...updatedProducts[index],
          [field]: field === 'quantity' || field === 'price' ? Number(value) : value
        };
      }
      
      // Recalculate subtotal
      const newSubtotal = updatedProducts.reduce((sum, item) => {
        return sum + ((item.price || 0) * (item.quantity || 1));
      }, 0);
      
      setFormData({
        ...formData,
        products: updatedProducts,
        subtotal: newSubtotal
      });
    } else {
      // Handle numeric fields - convert to number if it's a numeric input
      const numericFields = ['subtotal', 'tax', 'shippingCharges', 'discount'];
      if (numericFields.includes(name)) {
        // Convert to number, handle empty string and invalid values
        const numValue = value === '' || value === null || value === undefined ? 0 : Number(value);
        setFormData({ ...formData, [name]: isNaN(numValue) ? 0 : Math.max(0, numValue) });
      } else {
        setFormData({ ...formData, [name]: value });
      }
    }
  };

  const handleProductChange = (index, field, value) => {
    const updatedProducts = [...formData.products];
    updatedProducts[index] = {
      ...updatedProducts[index],
      [field]: field === 'quantity' || field === 'price' ? Number(value) : value
    };
    
    // Recalculate subtotal
    const newSubtotal = updatedProducts.reduce((sum, item) => {
      return sum + ((item.price || 0) * (item.quantity || 1));
    }, 0);
    
    setFormData({
      ...formData,
      products: updatedProducts,
      subtotal: newSubtotal
    });
  };

  const addProductRow = () => {
    setFormData({
      ...formData,
      products: [...formData.products, { product: "", quantity: 1, price: 0, productName: "" }]
    });
  };

  const removeProductRow = (index) => {
    if (formData.products.length > 1) {
      const updatedProducts = formData.products.filter((_, i) => i !== index);
      const newSubtotal = updatedProducts.reduce((sum, item) => {
        return sum + ((item.price || 0) * (item.quantity || 1));
      }, 0);
      
      setFormData({
        ...formData,
        products: updatedProducts,
        subtotal: newSubtotal
      });
    }
  };

  // Calculate total amount
  const calculateTotal = () => {
    const subtotal = Number(formData.subtotal) || 0;
    const tax = Number(formData.tax) || 0;
    const shippingCharges = Number(formData.shippingCharges) || 0;
    const discount = Number(formData.discount) || 0;
    return subtotal + tax + shippingCharges - discount;
  };

  // Validate and Add / Update Order
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.user) {
      setError("User is required");
      return;
    }

    if (!formData.products || formData.products.length === 0) {
      setError("At least one product is required");
      return;
    }

    if (!formData.products.every(item => item.product && item.quantity > 0 && item.price >= 0)) {
      setError("Please fill all product fields correctly");
      return;
    }

    // Validate shipping address - all required fields
    const shippingAddr = formData.shippingAddress;
    if (!shippingAddr.name || !shippingAddr.street || !shippingAddr.city || 
        !shippingAddr.state || !shippingAddr.zipCode || !shippingAddr.country) {
      setError("Complete shipping address is required (name, street, city, state, zip code, and country)");
      return;
    }

    try {
      setLoading(true);
      setSuccess("");
      setError("");

      // Calculate total amount
      const calculatedSubtotal = Number(formData.subtotal) || 0;
      const calculatedTax = Number(formData.tax) || 0;
      const calculatedShipping = Number(formData.shippingCharges) || 0;
      const calculatedDiscount = Number(formData.discount) || 0;
      const calculatedTotal = calculatedSubtotal + calculatedTax + calculatedShipping - calculatedDiscount;

      const orderData = {
        user: formData.user,
        products: formData.products.map(item => ({
          product: item.product,
          quantity: Number(item.quantity),
          price: Number(item.price),
          subtotal: Number(item.price) * Number(item.quantity)
        })),
        subtotal: calculatedSubtotal,
        tax: calculatedTax,
        shippingCharges: calculatedShipping,
        discount: calculatedDiscount,
        totalAmount: calculatedTotal,
        couponCode: formData.couponCode?.trim() || null,
        couponId: formData.couponId || null,
        shippingAddress: {
          name: shippingAddr.name.trim(),
          phone: shippingAddr.phone?.trim() || "",
          street: shippingAddr.street.trim(),
          city: shippingAddr.city.trim(),
          state: shippingAddr.state.trim(),
          zipCode: shippingAddr.zipCode.trim(),
          country: shippingAddr.country.trim()
        },
        billingAddress: formData.billingAddress && formData.billingAddress.name ? {
          name: formData.billingAddress.name.trim(),
          phone: formData.billingAddress.phone?.trim() || "",
          street: formData.billingAddress.street?.trim() || "",
          city: formData.billingAddress.city?.trim() || "",
          state: formData.billingAddress.state?.trim() || "",
          zipCode: formData.billingAddress.zipCode?.trim() || "",
          country: formData.billingAddress.country?.trim() || ""
        } : null,
        paymentMethod: formData.paymentMethod || 'credit_card',
        paymentStatus: formData.paymentStatus || 'pending',
        orderStatus: formData.orderStatus || 'pending',
        courierName: formData.courierName?.trim() || null,
        courierServiceType: formData.courierServiceType?.trim() || null,
        trackingNumber: formData.trackingNumber?.trim() || null,
        trackingUrl: formData.trackingUrl?.trim() || null,
        shipmentDate: formData.shipmentDate || null,
        estimatedDeliveryDate: formData.estimatedDeliveryDate || null,
        notes: formData.notes?.trim() || null,
        adminNotes: formData.adminNotes?.trim() || null,
        website: formData.website || null
      };

      if (editingId) {
        await api.put(`/orders/${editingId}`, orderData);
        setSuccess(`✅ Order has been updated successfully!`);
      } else {
        await api.post('/orders', orderData);
        setSuccess(`✅ Order has been created successfully!`);
      }

      await fetchOrders();
      resetForm();
      
    } catch (err) {
      console.error('Error submitting order:', err);
      const errorMsg = err.response?.data?.msg || err.message || 'Please try again.';
      setError(`❌ Failed to ${editingId ? 'update' : 'create'} order. ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData(initialFormData);
    setEditingId(null);
    setError("");
    setUseSameAddress(true);
    setActiveTab('products'); // Reset to first tab
  };

  const clearForm = () => {
    setFormData(initialFormData);
    setEditingId(null);
    setError("");
    setSuccess("");
    setUseSameAddress(true);
    setActiveTab('products'); // Reset to first tab
  };

  // Edit order
  const handleEdit = (order) => {
    // Extract website ID safely - handle both populated object and string ID
    let websiteId = "";
    if (order.website) {
      if (typeof order.website === 'string') {
        websiteId = order.website;
      } else if (order.website._id) {
        websiteId = order.website._id;
      }
    }

    setFormData({
      user: order.user?._id || order.user || "",
      products: order.products?.map(item => ({
        product: item.product?._id || item.product || "",
        quantity: Number(item.quantity) || 1,
        price: Number(item.price) || 0,
        productName: item.product?.name || item.productName || ""
      })) || [{ product: "", quantity: 1, price: 0 }],
      subtotal: Number(order.subtotal) || 0,
      tax: Number(order.tax) || 0,
      shippingCharges: Number(order.shippingCharges) || 0,
      discount: Number(order.discount) || 0,
      couponCode: order.couponCode || "",
      couponId: order.couponId?._id || order.couponId || "",
      shippingAddress: order.shippingAddress || initialFormData.shippingAddress,
      billingAddress: order.billingAddress || order.shippingAddress || initialFormData.billingAddress,
      paymentMethod: order.paymentMethod || "credit_card",
      paymentStatus: order.paymentStatus || "pending",
      orderStatus: order.orderStatus || "pending",
      courierName: order.courierName || "",
      courierServiceType: order.courierServiceType || "",
      trackingNumber: order.trackingNumber || "",
      trackingUrl: order.trackingUrl || "",
      shipmentDate: order.shipmentDate ? new Date(order.shipmentDate).toISOString().split('T')[0] : "",
      estimatedDeliveryDate: order.estimatedDeliveryDate ? new Date(order.estimatedDeliveryDate).toISOString().split('T')[0] : "",
      notes: order.notes || "",
      adminNotes: order.adminNotes || "",
      website: websiteId
    });
    setEditingId(order._id || order.id);
    setError("");
    setSuccess("");
    
    setTimeout(() => {
      if (formRef.current) {
        formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  // Delete order
  const handleDelete = async (orderId) => {
    const order = orders.find(o => o._id === orderId);
    const isAlreadyDeleted = order?.deleted;
    
    setDeletePopup({
      isVisible: true,
      orderId,
      message: isAlreadyDeleted 
        ? "This order is already marked as deleted. Click OK to permanently remove it from the database. This action cannot be undone."
        : "This will mark the order as inactive and add a deleted flag. Click OK to continue.",
      isPermanentDelete: isAlreadyDeleted,
      action: "delete"
    });
  };

  const handleDeleteConfirm = async () => {
    const { orderId, isPermanentDelete } = deletePopup;
    const order = orders.find(o => o._id === orderId);
    
    try {
      setLoading(true);
      setSuccess("");
      setError("");
      
      if (isPermanentDelete) {
        await api.delete(`/orders/${orderId}/hard`);
        setSuccess(`🗑️ Order "${order.orderNumber}" has been permanently deleted.`);
      } else {
        await api.delete(`/orders/${orderId}`);
        setSuccess(`⏸️ Order "${order.orderNumber}" has been marked as deleted and inactive.`);
      }
      
      await fetchOrders();
    } catch (err) {
      const action = isPermanentDelete ? "permanently delete" : "mark as deleted";
      setError(`❌ Failed to ${action} order. ${err.response?.data?.msg || 'Please try again.'}`);
    } finally {
      setLoading(false);
      setDeletePopup({
        isVisible: false,
        orderId: null,
        message: "",
        isPermanentDelete: false,
        action: "delete"
      });
    }
  };

  const handleDeleteCancel = () => {
    setDeletePopup({
      isVisible: false,
      orderId: null,
      message: "",
      isPermanentDelete: false,
      action: "delete"
    });
  };

  // Revert deleted order
  const handleRevert = async (orderId) => {
    const order = orders.find(o => o._id === orderId);
    
    if (!order?.deleted) {
      setError("This order is not deleted");
      return;
    }

    setDeletePopup({
      isVisible: true,
      orderId,
      message: `Are you sure you want to restore order "${order.orderNumber}"?`,
      isPermanentDelete: false,
      action: "revert"
    });
  };

  const handleRevertConfirm = async () => {
    const { orderId } = deletePopup;
    const order = orders.find(o => o._id === orderId);
    
    try {
      setLoading(true);
      setSuccess("");
      setError("");

      await api.put(`/orders/${orderId}`, {
        ...order,
        isActive: true,
        deleted: false
      });

      setSuccess(`✅ Order "${order.orderNumber}" has been restored and is now active!`);
      await fetchOrders();
    } catch (err) {
      setError(`❌ Failed to restore order. ${err.response?.data?.msg || 'Please try again.'}`);
    } finally {
      setLoading(false);
      setDeletePopup({
        isVisible: false,
        orderId: null,
        message: "",
        isPermanentDelete: false,
        action: "delete"
      });
    }
  };

  const handleRevertCancel = () => {
    setDeletePopup({
      isVisible: false,
      orderId: null,
      message: "",
      isPermanentDelete: false,
      action: "delete"
    });
  };

  // Fetch orders from backend
  const fetchOrders = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        showInactive: 'true',
        includeDeleted: 'true'
      });
      if (paymentStatusFilter !== 'all') {
        params.append('paymentStatus', paymentStatusFilter);
      }
      if (orderStatusFilter !== 'all') {
        params.append('orderStatus', orderStatusFilter);
      }
      if (searchQuery.trim()) {
        params.append('search', searchQuery.trim());
      }
      
      // Handle date filters from URL
      if (filterFromUrl) {
        const now = new Date();
        let dateFilter = {};
        
        if (filterFromUrl === 'today') {
          const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          dateFilter = { createdAt: { $gte: todayStart } };
          // Note: Backend will need to handle this, for now we'll filter client-side
        } else if (filterFromUrl === 'weekly') {
          const weekStart = new Date(now);
          weekStart.setDate(now.getDate() - 7);
          dateFilter = { createdAt: { $gte: weekStart } };
        } else if (filterFromUrl === 'monthly') {
          const monthStart = new Date(now);
          monthStart.setMonth(now.getMonth() - 1);
          dateFilter = { createdAt: { $gte: monthStart } };
        }
        
        // Add date filter to params if backend supports it
        // For now, we'll filter client-side after fetching
      }
      
      const response = await api.get(`/orders?${params.toString()}`);
      let ordersData = response.data || [];
      
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
          ordersData = ordersData.filter(order => {
            const orderDate = new Date(order.createdAt);
            return orderDate >= filterDate;
          });
        }
      }
      
      setOrders(ordersData);
      setError("");
    } catch (err) {
      console.error('Error fetching orders:', err);
      const errorMessage = err.response?.data?.msg || err.message || 'Failed to fetch orders';
      setError(`❌ ${errorMessage}${err.code === 'ECONNREFUSED' ? ' (Backend server may not be running)' : ''}`);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [paymentStatusFilter, orderStatusFilter, filterFromUrl]);
  
  // Update filters when URL params change
  useEffect(() => {
    const orderStatusParam = searchParams.get('orderStatus');
    const paymentStatusParam = searchParams.get('paymentStatus');
    const filterParam = searchParams.get('filter');
    
    if (orderStatusParam && orderStatusParam !== orderStatusFilter) {
      setOrderStatusFilter(orderStatusParam);
    }
    if (paymentStatusParam && paymentStatusParam !== paymentStatusFilter) {
      setPaymentStatusFilter(paymentStatusParam);
    }
  }, [searchParams]);
  
  // Note: searchQuery is handled client-side in filteredOrders to avoid excessive API calls

  // Filter orders
  const filteredOrders = useMemo(() => {
    let filtered = orders;
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(order => 
        order.orderNumber?.toLowerCase().includes(query) ||
        order.user?.name?.toLowerCase().includes(query) ||
        order.user?.email?.toLowerCase().includes(query) ||
        order.courierName?.toLowerCase().includes(query) ||
        order.trackingNumber?.toLowerCase().includes(query) ||
        order.shippingAddress?.name?.toLowerCase().includes(query)
      );
    }
    
    filtered = filterEntitiesByStatus(filtered, statusFilter);
    
    return filtered;
  }, [orders, searchQuery, statusFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentOrders = filteredOrders.slice(startIndex, endIndex);

  useEffect(() => {
    if (viewMode === 'card') {
      const initialCards = filteredOrders.slice(0, 12);
      setDisplayedCards(initialCards);
      setHasMoreCards(filteredOrders.length > 12);
      setCurrentPage(1);
    }
  }, [viewMode, filteredOrders]);

  const resetPaginationForSearch = useCallback(() => {
    setCurrentPage(1);
    if (viewMode === 'card') {
      const initialCards = filteredOrders.slice(0, 12);
      setDisplayedCards(initialCards);
      setHasMoreCards(filteredOrders.length > 12);
    }
  }, [viewMode, filteredOrders.length]);

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
      const nextCards = filteredOrders.slice(currentCardCount, currentCardCount + 12);
      
      if (nextCards.length > 0) {
        setHasMoreCards(currentCardCount + nextCards.length < filteredOrders.length);
        return [...prevCards, ...nextCards];
      } else {
        setHasMoreCards(false);
        return prevCards;
      }
    });
  }, [filteredOrders]);

  const handleViewModeChange = useCallback((mode) => {
    setViewMode(mode);
    setCurrentPage(1);
    if (mode === 'card') {
      const initialCards = filteredOrders.slice(0, 12);
      setDisplayedCards(initialCards);
      setHasMoreCards(filteredOrders.length > 12);
    }
  }, [filteredOrders.length]);

  const handleCancel = () => {
    resetForm();
  };

  // Handle Invoice button click
  const handleInvoiceClick = (order) => {
    setInvoicePopup({
      isVisible: true,
      order: order
    });
  };

  // Handle Shipping Label button click
  const handleShippingLabelClick = (order) => {
    setShippingLabelPopup({
      isVisible: true,
      order: order
    });
  };

  // Handle Tracking button click
  const handleTrackingClick = (order) => {
    setTrackingPopup({
      isVisible: true,
      orderId: order._id || order.id,
      orderNumber: order.orderNumber
    });
  };

  // Handle Add Tracking button click
  const handleAddTrackingClick = (order) => {
    setAddTrackingPopup({
      isVisible: true,
      orderId: order._id || order.id,
      orderNumber: order.orderNumber
    });
  };

  // Handle tracking update success
  const handleTrackingUpdateSuccess = (tracking) => {
    // Refresh orders to get updated data
    fetchOrders();
  };

  // Close tracking popup
  const handleTrackingClose = () => {
    setTrackingPopup({
      isVisible: false,
      orderId: null,
      orderNumber: null
    });
  };

  // Close Invoice popup
  const handleInvoiceClose = () => {
    setInvoicePopup({
      isVisible: false,
      order: null
    });
  };

  // Close Shipping Label popup
  const handleShippingLabelClose = () => {
    setShippingLabelPopup({
      isVisible: false,
      order: null
    });
  };

  // Create dummy order with sample data
  const createDummyOrder = () => {
    // Get first available user and product, or use sample data
    const firstUser = users.length > 0 ? users[0] : null;
    const firstProduct = products.length > 0 ? products[0] : null;

    if (!firstUser) {
      setError("Please ensure at least one user exists before creating a dummy order");
      return;
    }

    if (!firstProduct) {
      setError("Please ensure at least one product exists before creating a dummy order");
      return;
    }

    const dummyData = {
      user: firstUser._id,
      products: [
        {
          product: firstProduct._id,
          quantity: 2,
          price: firstProduct.price || firstProduct.discountedPrice || 1000,
          productName: firstProduct.name
        }
      ],
      subtotal: (firstProduct.price || firstProduct.discountedPrice || 1000) * 2,
      tax: 180,
      shippingCharges: 50,
      discount: 0,
      couponCode: "",
      couponId: "",
      shippingAddress: {
        name: firstUser.name || "John Doe",
        phone: firstUser.phone || "+91 9876543210",
        street: firstUser.address?.street || "123 Main Street",
        city: firstUser.address?.city || "Mumbai",
        state: firstUser.address?.state || "Maharashtra",
        zipCode: firstUser.address?.zipCode || "400001",
        country: firstUser.address?.country || "India"
      },
      billingAddress: {
        name: firstUser.name || "John Doe",
        phone: firstUser.phone || "+91 9876543210",
        street: firstUser.address?.street || "123 Main Street",
        city: firstUser.address?.city || "Mumbai",
        state: firstUser.address?.state || "Maharashtra",
        zipCode: firstUser.address?.zipCode || "400001",
        country: firstUser.address?.country || "India"
      },
      paymentMethod: "credit_card",
      paymentStatus: "paid",
      orderStatus: "confirmed",
      courierName: "",
      courierServiceType: "",
      trackingNumber: "",
      trackingUrl: "",
      shipmentDate: "",
      estimatedDeliveryDate: "",
      notes: "Dummy order for testing",
      adminNotes: ""
    };

    // Calculate total
    const total = dummyData.subtotal + dummyData.tax + dummyData.shippingCharges - dummyData.discount;

    setFormData({
      ...dummyData,
      subtotal: dummyData.subtotal,
      tax: dummyData.tax,
      shippingCharges: dummyData.shippingCharges,
      discount: dummyData.discount
    });
    setUseSameAddress(true);
    setError("");
    setSuccess("✅ Dummy order data loaded! Review and click 'Create Order' to submit.");

    // Scroll to form
    setTimeout(() => {
      if (formRef.current) {
        formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  return (
    <div className="paddingAll20">
      <PageHeader
        title="Order Management"
        subtitle="Manage all customer orders and track their status"
        isEditing={!!editingId}
        editText="Edit Order"
        createText="Add New Order"
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
          {/* User Selection */}
          <div className="makeFlex row gap10">
            <div className="fullWidth">
              <FormField
                type="select"
                name="user"
                label="Customer"
                value={formData.user}
                onChange={handleChange}
                required={true}
                options={[
                  { value: "", label: "Select Customer" },
                  ...users.map(user => ({
                    value: user._id,
                    label: `${user.name} (${user.email})`
                  }))
                ]}
              />
            </div>
          </div>

          {/* Website Selection */}
          <div className="makeFlex row gap10">
            <div className="fullWidth">
              <FormField
                type="select"
                name="website"
                label="Website (Optional)"
                value={formData.website}
                onChange={handleChange}
                options={[
                  { value: "", label: "Select Website (Optional)" },
                  ...websites.map(website => ({
                    value: website._id,
                    label: `${website.name} (${website.domain})`
                  }))
                ]}
                info="Select the website this order belongs to for multi-tenant support"
              />
            </div>
          </div>

          {/* Tabs Navigation */}
          <div style={{ 
            display: "flex", 
            gap: "10px", 
            marginTop: "20px", 
            marginBottom: "20px", 
            borderBottom: "2px solid #dee2e6" 
          }}>
            {[
              { id: 'products', label: '📦 Product Details' },
              { id: 'shipping', label: '🚚 Shipping Address' },
              { id: 'billing', label: '💳 Billing Address' },
              { id: 'tracking', label: '📋 Tracking Details' }
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: "10px 20px",
                  border: "none",
                  backgroundColor: "transparent",
                  cursor: "pointer",
                  borderBottom: activeTab === tab.id ? "3px solid #007bff" : "3px solid transparent",
                  color: activeTab === tab.id ? "#007bff" : "#666",
                  fontWeight: activeTab === tab.id ? "bold" : "normal",
                  transition: "all 0.2s"
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {/* Product Details Tab */}
          {activeTab === 'products' && (
            <div>
              {/* Products */}
              <div className="paddingTop16">
            <div className="makeFlex spaceBetween alignCenter appendBottom16">
              <label className="formLabel fontBold">Products:</label>
              <button
                type="button"
                onClick={addProductRow}
                className="btnSecondary"
                style={{ padding: '6px 12px', fontSize: '14px' }}
              >
                + Add Product
              </button>
            </div>
            {formData.products.map((product, index) => (
              <div key={index} className="makeFlex row gap10 appendBottom10" style={{ alignItems: 'flex-end' }}>
                <div className="fullWidth" style={{ flex: '2' }}>
                  <FormField
                    type="select"
                    name={`products.${index}.product`}
                    label={`Product ${index + 1}`}
                    value={product.product}
                    onChange={handleChange}
                    required={true}
                    options={[
                      { value: "", label: "Select Product" },
                      ...products.map(p => ({
                        value: p._id,
                        label: `${p.name} - ₹${p.price || 0}`
                      }))
                    ]}
                  />
                </div>
                <div className="fullWidth" style={{ flex: '1' }}>
                  <FormField
                    type="number"
                    name={`products.${index}.quantity`}
                    label="Quantity"
                    value={product.quantity}
                    onChange={handleChange}
                    required={true}
                    min={1}
                  />
                </div>
                <div className="fullWidth" style={{ flex: '1' }}>
                  <FormField
                    type="number"
                    name={`products.${index}.price`}
                    label="Price"
                    value={product.price}
                    onChange={handleChange}
                    required={true}
                    min={0}
                    step="0.01"
                  />
                </div>
                <div className="fullWidth" style={{ flex: '0 0 40px' }}>
                  <button
                    type="button"
                    onClick={() => removeProductRow(index)}
                    disabled={formData.products.length === 1}
                    className="btnSecondary"
                    style={{ 
                      padding: '10px', 
                      backgroundColor: formData.products.length === 1 ? '#ccc' : '#ff4444',
                      color: 'white',
                      border: 'none'
                    }}
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
              </div>

              {/* Pricing */}
              <div className="makeFlex row gap10 paddingTop16">
            <div className="fullWidth">
              <FormField
                type="number"
                name="subtotal"
                label="Subtotal"
                value={formData.subtotal}
                onChange={handleChange}
                required={true}
                min={0}
                step="0.01"
                readOnly
              />
            </div>
            <div className="fullWidth">
              <FormField
                type="number"
                name="tax"
                label="Tax"
                value={formData.tax}
                onChange={handleChange}
                min={0}
                step="0.01"
              />
            </div>
            <div className="fullWidth">
              <FormField
                type="number"
                name="shippingCharges"
                label="Shipping Charges"
                value={formData.shippingCharges}
                onChange={handleChange}
                min={0}
                step="0.01"
              />
            </div>
            <div className="fullWidth">
              <FormField
                type="number"
                name="discount"
                label="Discount"
                value={formData.discount}
                onChange={handleChange}
                min={0}
                step="0.01"
              />
            </div>
          </div>

          <div className="makeFlex row gap10 paddingTop16">
            <div className="fullWidth">
              <div className="formLabel appendBottom10">Total Amount:</div>
              <div className="fontBold font20" style={{ padding: '10px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
                ₹{calculateTotal().toFixed(2)}
              </div>
            </div>
            <div className="fullWidth">
              <FormField
                type="text"
                name="couponCode"
                label="Coupon Code (Optional)"
                value={formData.couponCode}
                onChange={handleChange}
              />
            </div>
              </div>

              {/* Payment Method and Status */}
              <div className="makeFlex row gap10 paddingTop16">
                <div className="fullWidth">
                  <FormField
                    type="select"
                    name="paymentMethod"
                    label="Payment Method"
                    value={formData.paymentMethod}
                    onChange={handleChange}
                    required={true}
                    options={[
                      { value: "credit_card", label: "Credit Card" },
                      { value: "debit_card", label: "Debit Card" },
                      { value: "paypal", label: "PayPal" },
                      { value: "cash_on_delivery", label: "Cash on Delivery" },
                      { value: "bank_transfer", label: "Bank Transfer" },
                      { value: "upi", label: "UPI" },
                      { value: "wallet", label: "Wallet" },
                      { value: "other", label: "Other" },
                    ]}
                    info="Select the payment method used for this order"
                  />
                </div>
                <div className="fullWidth">
                  <FormField
                    type="select"
                    name="paymentStatus"
                    label="Payment Status"
                    value={formData.paymentStatus}
                    onChange={handleChange}
                    required={true}
                    options={[
                      { value: "pending", label: "Pending" },
                      { value: "processing", label: "Processing" },
                      { value: "paid", label: "Paid" },
                      { value: "failed", label: "Failed" },
                      { value: "refunded", label: "Refunded" },
                      { value: "cancelled", label: "Cancelled" },
                    ]}
                    info="Current payment status of the order"
                  />
                </div>
                <div className="fullWidth">
                  <FormField
                    type="select"
                    name="orderStatus"
                    label="Order Status"
                    value={formData.orderStatus}
                    onChange={handleChange}
                    required={true}
                    options={[
                      { value: "pending", label: "Pending" },
                      { value: "confirmed", label: "Confirmed" },
                      { value: "processing", label: "Processing" },
                      { value: "shipped", label: "Shipped" },
                      { value: "delivered", label: "Delivered" },
                      { value: "cancelled", label: "Cancelled" },
                      { value: "returned", label: "Returned" },
                    ]}
                    info="Current status of the order"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Shipping Address Tab */}
          {activeTab === 'shipping' && (
            <div>
              {/* Shipping Address */}
              <div className="paddingTop16">
            <label className="formLabel fontBold appendBottom10">Shipping Address:</label>
            <div className="makeFlex row gap10">
              <div className="fullWidth">
                <FormField
                  type="text"
                  name="shippingAddress.name"
                  label="Name"
                  value={formData.shippingAddress.name}
                  onChange={handleChange}
                  required={true}
                />
              </div>
              <div className="fullWidth">
                <FormField
                  type="tel"
                  name="shippingAddress.phone"
                  label="Phone"
                  value={formData.shippingAddress.phone}
                  onChange={handleChange}
                />
              </div>
            </div>
            <div className="makeFlex row gap10">
              <div className="fullWidth">
                <FormField
                  type="text"
                  name="shippingAddress.street"
                  label="Street"
                  value={formData.shippingAddress.street}
                  onChange={handleChange}
                  required={true}
                />
              </div>
            </div>
            <div className="makeFlex row gap10">
              <div className="fullWidth">
                <FormField
                  type="text"
                  name="shippingAddress.city"
                  label="City"
                  value={formData.shippingAddress.city}
                  onChange={handleChange}
                  required={true}
                />
              </div>
              <div className="fullWidth">
                <FormField
                  type="text"
                  name="shippingAddress.state"
                  label="State"
                  value={formData.shippingAddress.state}
                  onChange={handleChange}
                  required={true}
                />
              </div>
            </div>
            <div className="makeFlex row gap10">
              <div className="fullWidth">
                <FormField
                  type="text"
                  name="shippingAddress.zipCode"
                  label="Zip Code"
                  value={formData.shippingAddress.zipCode}
                  onChange={handleChange}
                  required={true}
                />
              </div>
              <div className="fullWidth">
                <FormField
                  type="text"
                  name="shippingAddress.country"
                  label="Country"
                  value={formData.shippingAddress.country}
                  onChange={handleChange}
                  required={true}
                />
              </div>
            </div>
              </div>
            </div>
          )}

          {/* Billing Address Tab */}
          {activeTab === 'billing' && (
            <div>
              {/* Billing Address */}
              <div className="paddingTop16">
            <div className="makeFlex spaceBetween alignCenter appendBottom10">
              <label className="formLabel fontBold">Billing Address:</label>
              <label className="makeFlex gap10 alignCenter">
                <input
                  type="checkbox"
                  checked={useSameAddress}
                  onChange={(e) => {
                    setUseSameAddress(e.target.checked);
                    if (e.target.checked) {
                      setFormData(prev => ({
                        ...prev,
                        billingAddress: prev.shippingAddress
                      }));
                    }
                  }}
                />
                Same as shipping address
              </label>
            </div>
            <div className="makeFlex row gap10">
              <div className="fullWidth">
                <FormField
                  type="text"
                  name="billingAddress.name"
                  label="Name"
                  value={formData.billingAddress.name}
                  onChange={handleChange}
                  disabled={useSameAddress}
                />
              </div>
              <div className="fullWidth">
                <FormField
                  type="tel"
                  name="billingAddress.phone"
                  label="Phone"
                  value={formData.billingAddress.phone}
                  onChange={handleChange}
                  disabled={useSameAddress}
                />
              </div>
            </div>
            <div className="makeFlex row gap10">
              <div className="fullWidth">
                <FormField
                  type="text"
                  name="billingAddress.street"
                  label="Street"
                  value={formData.billingAddress.street}
                  onChange={handleChange}
                  disabled={useSameAddress}
                />
              </div>
            </div>
            <div className="makeFlex row gap10">
              <div className="fullWidth">
                <FormField
                  type="text"
                  name="billingAddress.city"
                  label="City"
                  value={formData.billingAddress.city}
                  onChange={handleChange}
                  disabled={useSameAddress}
                />
              </div>
              <div className="fullWidth">
                <FormField
                  type="text"
                  name="billingAddress.state"
                  label="State"
                  value={formData.billingAddress.state}
                  onChange={handleChange}
                  disabled={useSameAddress}
                />
              </div>
            </div>
            <div className="makeFlex row gap10">
              <div className="fullWidth">
                <FormField
                  type="text"
                  name="billingAddress.zipCode"
                  label="Zip Code"
                  value={formData.billingAddress.zipCode}
                  onChange={handleChange}
                  disabled={useSameAddress}
                />
              </div>
              <div className="fullWidth">
                <FormField
                  type="text"
                  name="billingAddress.country"
                  label="Country"
                  value={formData.billingAddress.country}
                  onChange={handleChange}
                  disabled={useSameAddress}
                />
              </div>
            </div>
              </div>
            </div>
          )}

          {/* Tracking Details Tab */}
          {activeTab === 'tracking' && (
            <div>
              {/* Courier Tracking Details */}
          <div className="makeFlex row gap10 paddingTop16">
            <div className="fullWidth">
              <FormField
                type="text"
                name="courierName"
                label="Courier Name"
                value={formData.courierName}
                onChange={handleChange}
                placeholder="e.g., FedEx, DHL, BlueDart, India Post"
                info="Enter the name of the courier service"
              />
            </div>
            <div className="fullWidth">
              <FormField
                type="text"
                name="courierServiceType"
                label="Service Type"
                value={formData.courierServiceType}
                onChange={handleChange}
                placeholder="e.g., Express, Standard, Overnight"
                info="Enter the type of courier service"
              />
            </div>
          </div>

          {/* Tracking */}
          <div className="makeFlex row gap10 paddingTop16">
            <div className="fullWidth">
              <FormField
                type="text"
                name="trackingNumber"
                label="Tracking Number"
                value={formData.trackingNumber}
                onChange={handleChange}
                placeholder="Enter tracking number"
              />
            </div>
            <div className="fullWidth">
              <FormField
                type="url"
                name="trackingUrl"
                label="Tracking URL"
                value={formData.trackingUrl}
                onChange={handleChange}
                placeholder="https://tracking.example.com/track/123456"
              />
            </div>
          </div>

          {/* Shipment Dates */}
          <div className="makeFlex row gap10 paddingTop16">
            <div className="fullWidth">
              <FormField
                type="date"
                name="shipmentDate"
                label="Shipment Date"
                value={formData.shipmentDate}
                onChange={handleChange}
                info="Date when the order was shipped"
              />
            </div>
            <div className="fullWidth">
              <FormField
                type="date"
                name="estimatedDeliveryDate"
                label="Estimated Delivery Date"
                value={formData.estimatedDeliveryDate}
                onChange={handleChange}
                info="Expected delivery date"
              />
            </div>
              </div>

              {/* Notes */}
              <div className="makeFlex row gap10 paddingTop16">
            <div className="fullWidth">
              <FormField
                type="textarea"
                name="notes"
                label="Customer Notes"
                value={formData.notes}
                onChange={handleChange}
                rows={3}
              />
            </div>
            <div className="fullWidth">
              <FormField
                type="textarea"
                name="adminNotes"
                label="Admin Notes (Internal)"
                value={formData.adminNotes}
                onChange={handleChange}
                rows={3}
              />
            </div>
              </div>
            </div>
          )}

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
                <span>{editingId ? "Update Order" : "Create Order"}</span>
              )}
            </button>
            
            {!editingId && (
              <button
                type="button"
                onClick={createDummyOrder}
                className="btnSecondary"
                style={{
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none'
                }}
              >
                🧪 Create Dummy Order
              </button>
            )}
            
            {(editingId || (!editingId && formData.user)) && (
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
                Add Another Order
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Orders List */}
      <div className="brandsListContainer paddingAll32">
        <div className="listHeader makeFlex spaceBetween end appendBottom24">
          <div className="leftSection">
            <h2 className="listTitle font30 fontBold blackText appendBottom16">Orders ({filteredOrders.length})</h2>
            <StatusFilter
              statusFilter={statusFilter}
              onStatusChange={setStatusFilter}
              counts={calculateStandardStatusCounts(orders)}
              disabled={loading}
            />
            <div className="paddingTop10 makeFlex gap10">
              <div>
                <label className="formLabel appendBottom10">Payment Status:</label>
                <select
                  value={paymentStatusFilter}
                  onChange={(e) => setPaymentStatusFilter(e.target.value)}
                  className="formInput"
                  style={{ minWidth: '150px' }}
                >
                  <option value="all">All</option>
                  <option value="pending">Pending</option>
                  <option value="processing">Processing</option>
                  <option value="paid">Paid</option>
                  <option value="failed">Failed</option>
                  <option value="refunded">Refunded</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div>
                <label className="formLabel appendBottom10">Order Status:</label>
                <select
                  value={orderStatusFilter}
                  onChange={(e) => setOrderStatusFilter(e.target.value)}
                  className="formInput"
                  style={{ minWidth: '150px' }}
                >
                  <option value="all">All</option>
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="processing">Processing</option>
                  <option value="shipped">Shipped</option>
                  <option value="delivered">Delivered</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="returned">Returned</option>
                </select>
              </div>
            </div>
          </div>
          <div className="rightSection makeFlex end gap10">
            <SearchField
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search orders..."
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

        {filteredOrders.length === 0 && !loading ? (
          <div className="emptyState textCenter paddingAll60">
            <div className="emptyIcon appendBottom16">📦</div>
            <h3 className="font22 fontSemiBold grayText appendBottom8">No Orders Found</h3>
            <p className="font16 grayText">Start by adding your first order above</p>
          </div>
        ) : (
          <>
            {/* Card View */}
            {viewMode === 'card' && (
              <div className="brandsGrid">
                {displayedCards.map((order) => {
                  const shippingAddress = order.shippingAddress;
                  const fullAddress = shippingAddress ? 
                    [shippingAddress.street, shippingAddress.city, shippingAddress.state, shippingAddress.zipCode, shippingAddress.country]
                      .filter(Boolean).join(', ') : 'N/A';
                  
                  return (
                    <EntityCard
                      key={order._id || order.id}
                      entity={order}
                      logoField="picture"
                      nameField="orderNumber"
                      idField="_id"
                      onEdit={order.deleted ? undefined : handleEdit}
                      onDelete={handleDelete}
                      onRevert={order.deleted ? () => handleRevert(order._id || order.id) : undefined}
                      loading={loading}
                      imagePlaceholderColor={generateEntityColor(order._id || order.id, order.orderNumber)}
                      renderHeader={(order) => {
                        // Extract website safely to avoid rendering object
                        const safeOrder = { ...order };
                        if (safeOrder.website && typeof safeOrder.website === 'object') {
                          // Convert website object to string representation for safe rendering
                          safeOrder.website = safeOrder.website.name || safeOrder.website.domain || safeOrder.website._id || '';
                        }
                        return (
                          <EntityCardHeader
                            entity={{
                              ...safeOrder,
                              name: `Order #${order.orderNumber}`
                            }}
                            imageField="picture"
                            titleField="name"
                            dateField="createdAt"
                            generateColor={generateEntityColor}
                          />
                        );
                      }}
                      renderDetails={(order) => (
                        <>
                          <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                            <span className="detailLabel font14 fontSemiBold grayText textUppercase">Order Number:</span>
                            <span className="detailValue font14 blackText appendLeft6 fontBold">{order.orderNumber}</span>
                          </div>
                          <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                            <span className="detailLabel font14 fontSemiBold grayText textUppercase">Customer:</span>
                            <span className="detailValue font14 blackText appendLeft6">
                              {order.user?.name || 'N/A'} ({order.user?.email || 'N/A'})
                            </span>
                          </div>
                          <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                            <span className="detailLabel font14 fontSemiBold grayText textUppercase">Products:</span>
                            <span className="detailValue font14 blackText appendLeft6">
                              {order.products?.length || 0} item(s)
                            </span>
                          </div>
                          <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                            <span className="detailLabel font14 fontSemiBold grayText textUppercase">Total Amount:</span>
                            <span className="detailValue font14 fontBold greenText appendLeft6">
                              ₹{order.totalAmount?.toFixed(2) || '0.00'}
                            </span>
                          </div>
                          <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                            <span className="detailLabel font14 fontSemiBold grayText textUppercase">Payment Status:</span>
                            <span className={`detailValue font14 ${order.paymentStatus === 'paid' ? 'greenText' : order.paymentStatus === 'failed' ? 'redText' : 'orangeText'} appendLeft6 fontBold`}>
                              {order.paymentStatus?.toUpperCase() || 'PENDING'}
                            </span>
                          </div>
                          <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                            <span className="detailLabel font14 fontSemiBold grayText textUppercase">Order Status:</span>
                            <span className={`detailValue font14 ${order.orderStatus === 'delivered' ? 'greenText' : order.orderStatus === 'cancelled' ? 'redText' : 'blueText'} appendLeft6 fontBold`}>
                              {order.orderStatus?.toUpperCase() || 'PENDING'}
                            </span>
                          </div>
                          {order.trackingNumber && (
                            <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                              <span className="detailLabel font14 fontSemiBold grayText textUppercase">Tracking:</span>
                              <span className="detailValue font14 blackText appendLeft6">{order.trackingNumber}</span>
                            </div>
                          )}
                          <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                            <span className="detailLabel font14 fontSemiBold grayText textUppercase">Status:</span>
                            <span className={`detailValue font14 ${order.deleted ? 'deleted' : (order.isActive ? 'greenText' : 'inactive')} appendLeft6`}>
                              {order.deleted ? 'Deleted' : (order.isActive ? 'Active' : 'Inactive')}
                            </span>
                          </div>
                        </>
                      )}
                      renderActions={(order) => (
                        <div className="entityCardActions makeFlex gap8 wrap">
                          <button
                            onClick={() => handleInvoiceClick(order)}
                            className="btnPrimary"
                            style={{ flex: '1', minWidth: '100px' }}
                            title="View Invoice"
                          >
                            📄 Invoice
                          </button>
                          <button
                            onClick={() => handleShippingLabelClick(order)}
                            className="btnSecondary"
                            style={{ flex: '1', minWidth: '100px' }}
                            title="View Shipping Label"
                          >
                            🚚 Shipping Label
                          </button>
                          <button
                            onClick={() => handleTrackingClick(order)}
                            className="btnSecondary"
                            style={{ flex: '1', minWidth: '100px', backgroundColor: '#17a2b8', color: 'white' }}
                            title="View Tracking"
                          >
                            📦 Track
                          </button>
                          <button
                            onClick={() => handleAddTrackingClick(order)}
                            className="btnSecondary"
                            style={{ flex: '1', minWidth: '100px', backgroundColor: '#28a745', color: 'white' }}
                            title="Add Tracking Update"
                          >
                            ➕ Add Update
                          </button>
                          <ActionButtons
                            onEdit={order.deleted ? undefined : () => handleEdit(order)}
                            onDelete={() => handleDelete(order._id || order.id)}
                            onRevert={order.deleted ? () => handleRevert(order._id || order.id) : undefined}
                            loading={loading}
                            size="normal"
                            editText="✏️ Edit"
                            deleteText={order.deleted ? "🗑️ Final Del" : "🗑️ Delete"}
                            revertText="🔄 Undelete"
                            editTitle="Edit Order"
                            deleteTitle={order.deleted ? "Final Del" : "Delete Order"}
                            revertTitle="Restore Order"
                          />
                        </div>
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
                        <th className="tableHeader">Order #</th>
                        <th className="tableHeader">Customer</th>
                        <th className="tableHeader">Items</th>
                        <th className="tableHeader">Total</th>
                        <th className="tableHeader">Payment</th>
                        <th className="tableHeader">Order Status</th>
                        <th className="tableHeader">Created</th>
                        <th className="tableHeader">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentOrders.map((order) => (
                        <tr key={order._id || order.id} className="tableRow">
                          <td className="tableCell">
                            <span className="brandNameText fontBold">{order.orderNumber}</span>
                          </td>
                          <td className="tableCell">
                            <span className="addressText">
                              {order.user?.name || 'N/A'}<br/>
                              <small>{order.user?.email || ''}</small>
                            </span>
                          </td>
                          <td className="tableCell">
                            <span className="addressText">{order.products?.length || 0} item(s)</span>
                          </td>
                          <td className="tableCell">
                            <span className="brandNameText fontBold greenText">₹{order.totalAmount?.toFixed(2) || '0.00'}</span>
                          </td>
                          <td className="tableCell">
                            <span className={`statusText ${order.paymentStatus === 'paid' ? 'active' : order.paymentStatus === 'failed' ? 'deleted' : 'inactive'}`}>
                              {order.paymentStatus?.toUpperCase() || 'PENDING'}
                            </span>
                          </td>
                          <td className="tableCell">
                            <span className={`statusText ${order.orderStatus === 'delivered' ? 'active' : order.orderStatus === 'cancelled' ? 'deleted' : 'inactive'}`}>
                              {order.orderStatus?.toUpperCase() || 'PENDING'}
                            </span>
                          </td>
                          <td className="tableCell">
                            <span className="dateText">
                              {new Date(order.createdAt).toLocaleDateString()}
                            </span>
                          </td>
                          <td className="tableCell">
                            <div className="tableActions makeFlex gap8">
                              <button
                                onClick={() => handleInvoiceClick(order)}
                                className="btnPrimary"
                                style={{ padding: '4px 8px', fontSize: '12px' }}
                                title="View Invoice"
                              >
                                📄
                              </button>
                              <button
                                onClick={() => handleShippingLabelClick(order)}
                                className="btnSecondary"
                                style={{ padding: '4px 8px', fontSize: '12px' }}
                                title="View Shipping Label"
                              >
                                🚚
                              </button>
                              <button
                                onClick={() => handleTrackingClick(order)}
                                className="btnSecondary"
                                style={{ padding: '4px 8px', fontSize: '12px', backgroundColor: '#17a2b8', color: 'white' }}
                                title="View Tracking"
                              >
                                📦
                              </button>
                              <button
                                onClick={() => handleAddTrackingClick(order)}
                                className="btnSecondary"
                                style={{ padding: '4px 8px', fontSize: '12px', backgroundColor: '#28a745', color: 'white' }}
                                title="Add Tracking Update"
                              >
                                ➕
                              </button>
                              <ActionButtons
                                onEdit={order.deleted ? undefined : () => handleEdit(order)}
                                onDelete={() => handleDelete(order._id || order.id)}
                                onRevert={order.deleted ? () => handleRevert(order._id || order.id) : undefined}
                                loading={loading}
                                size="small"
                                editText="✏️"
                                deleteText={order.deleted ? "🗑️" : "🗑️"}
                                revertText="🔄"
                                editTitle="Edit Order"
                                deleteTitle={order.deleted ? "Final Del" : "Delete Order"}
                                revertTitle="Restore Order"
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

      {/* Invoice Popup */}
      <InvoicePopup
        isVisible={invoicePopup.isVisible}
        order={invoicePopup.order}
        onClose={handleInvoiceClose}
      />

      {/* Shipping Label Popup */}
      <ShippingLabelPopup
        isVisible={shippingLabelPopup.isVisible}
        order={shippingLabelPopup.order}
        onClose={handleShippingLabelClose}
      />

      {/* Tracking Popup */}
      {trackingPopup.isVisible && (
        <div 
          className="modalOverlay"
          onClick={() => setTrackingPopup({ isVisible: false, orderId: null, orderNumber: null })}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000
          }}
        >
          <div 
            className="modalContent"
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              padding: '20px',
              maxWidth: '900px',
              width: '90%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
            }}
          >
            <TrackingComponent
              orderId={trackingPopup.orderId}
              onClose={handleTrackingClose}
            />
          </div>
        </div>
      )}

      {/* Add Tracking Popup */}
      <AddTrackingPopup
        isVisible={addTrackingPopup.isVisible}
        orderId={addTrackingPopup.orderId}
        orderNumber={addTrackingPopup.orderNumber}
        onClose={() => setAddTrackingPopup({ isVisible: false, orderId: null, orderNumber: null })}
        onSuccess={handleTrackingUpdateSuccess}
      />
    </div>
  );
};

export default OrderManager;
