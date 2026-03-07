import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import api, { getUploadBaseURL } from '../api/axios';
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

const CouponManager = () => {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [generatedBulkCoupons, setGeneratedBulkCoupons] = useState([]);
  const initialFormData = {
    code: "",
    type: "single", // "single" or "bulk"
    usageType: "single", // "single" or "multiple" - single use or multiple use
    discountType: "percentage",
    discountValue: "",
    minPurchase: "",
    startDate: "",
    startTime: "",
    expiryDate: "",
    endTime: "",
    isActive: false,
    // Offer type: cart, product_base, bank_offer
    offerType: "cart",
    applicableProductIds: [],
    bankName: "",
    // Bulk coupon generation fields
    numberOfCodes: "",
    codeLength: "",
    prefix: "",
    suffix: "",
    codeGenerationType: "alphanumeric", // "custom", "alphabet", "numbers", "alphanumeric"
    useSeparator: false,
    separatorLength: ""
  };

  const [formData, setFormData] = useState(initialFormData);
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [productsForSelection, setProductsForSelection] = useState([]);
  const [applicableCategoryId, setApplicableCategoryId] = useState("");
  const [applicableSubcategoryId, setApplicableSubcategoryId] = useState("");
  const [productsLoading, setProductsLoading] = useState(false);
  const [subcategoriesLoading, setSubcategoriesLoading] = useState(false);
  const [selectedProductDetails, setSelectedProductDetails] = useState({}); // { [productId]: { name, imageUrl } } for selected IDs not in current list
  const [searchQuery, setSearchQuery] = useState(""); // Search query state
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'active', 'inactive', 'deleted'
  
  // Delete confirmation popup state
  const [deletePopup, setDeletePopup] = useState({
    isVisible: false,
    couponId: null,
    message: "",
    isPermanentDelete: false,
    action: "delete" // "delete" or "revert"
  });
  
  // Refs for scroll and focus functionality
  const formRef = useRef(null);
  const couponCodeInputRef = useRef(null);
  
  // View mode and pagination states
  const [viewMode, setViewMode] = useState('card'); // 'card' or 'list'
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10); // For list view
  const [hasMoreCards, setHasMoreCards] = useState(true);
  const [displayedCards, setDisplayedCards] = useState([]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (type === 'checkbox') {
      setFormData({ ...formData, [name]: checked });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  // Validate coupon code for duplicates
  const validateCouponCode = (code) => {
    if (!code || !code.trim()) {
      return { isValid: false, error: "Coupon Code is required" };
    }
    
    // Check for duplicate codes only against active, non-deleted coupons (excluding current coupon being edited)
    const existingCoupon = coupons.find(coupon => 
      coupon.code.toUpperCase().trim() === code.toUpperCase().trim() && 
      coupon._id !== editingId &&
      coupon.isActive === true && // Only check against active coupons
      !coupon.deleted // Exclude deleted coupons
    );
    
    if (existingCoupon) {
      return { isValid: false, error: "Coupon code already exists" };
    }
    
    return { isValid: true, error: "" };
  };

  // Validate and Add / Update Coupon
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate based on coupon type
    if (formData.type === 'single') {
      const codeValidation = validateCouponCode(formData.code);
      if (!codeValidation.isValid) {
        setError(codeValidation.error);
        return;
      }
    } else {
      // Validate bulk coupon fields
      if (!formData.numberOfCodes || Number(formData.numberOfCodes) <= 0) {
        setError("Number of coupon codes is required and must be greater than 0");
        return;
      }
      if (!formData.codeLength || Number(formData.codeLength) <= 0) {
        setError("Code length is required and must be greater than 0");
        return;
      }
    }

    if (!formData.discountValue || Number(formData.discountValue) <= 0) {
      setError("Discount value must be a positive number");
      return;
    }

    if (formData.discountType === 'percentage' && Number(formData.discountValue) > 100) {
      setError("Percentage discount cannot exceed 100%");
      return;
    }

    if (!formData.expiryDate) {
      setError("Expiry date is required");
      return;
    }

    try {
      setLoading(true);
      setSuccess(""); // Clear any existing success message
      setError(""); // Clear any existing error message

      // Combine date and time for startDate
      let startDateValue = null;
      if (formData.startDate) {
        if (formData.startTime) {
          startDateValue = `${formData.startDate}T${formData.startTime}:00`;
        } else {
          startDateValue = `${formData.startDate}T00:00:00`;
        }
      }

      // Combine date and time for expiryDate
      let expiryDateValue = formData.expiryDate;
      if (formData.expiryDate) {
        if (formData.endTime) {
          expiryDateValue = `${formData.expiryDate}T${formData.endTime}:00`;
        } else {
          expiryDateValue = `${formData.expiryDate}T23:59:59`;
        }
      }

      const couponData = {
        type: formData.type,
        usageType: formData.usageType || "single",
        discountType: formData.discountType,
        discountValue: Number(formData.discountValue),
        minPurchase: formData.minPurchase ? Number(formData.minPurchase) : 0,
        startDate: startDateValue,
        expiryDate: expiryDateValue,
        isActive: formData.isActive,
        offerType: formData.offerType || "cart",
        applicableProductIds: formData.offerType === "product_base" && Array.isArray(formData.applicableProductIds) ? formData.applicableProductIds : [],
        bankName: formData.offerType === "bank_offer" && formData.bankName ? String(formData.bankName).trim() : null
      };

      // Add single coupon specific fields
      if (formData.type === 'single') {
        couponData.code = formData.code.trim().toUpperCase();
      } else {
        // Add bulk coupon specific fields
        couponData.numberOfCodes = Number(formData.numberOfCodes);
        couponData.codeLength = Number(formData.codeLength);
        couponData.prefix = formData.prefix?.trim().toUpperCase() || null;
        couponData.suffix = formData.suffix?.trim().toUpperCase() || null;
        couponData.codeGenerationType = formData.codeGenerationType || 'alphanumeric';
        couponData.useSeparator = formData.useSeparator || false;
        couponData.separatorLength = formData.useSeparator && formData.separatorLength ? Number(formData.separatorLength) : null;
      }

      if (editingId) {
        // Update coupon
        await api.put(`/coupons/${editingId}`, couponData);
        setSuccess(`✅ Coupon has been updated successfully!`);
      } else {
        // Create coupon
        const response = await api.post('/coupons', couponData);
        if (formData.type === 'bulk' && response.data.count) {
          setSuccess(`✅ Successfully generated ${response.data.count} bulk coupons!`);
          // Store generated bulk coupons for CSV download
          if (response.data.coupons && Array.isArray(response.data.coupons)) {
            setGeneratedBulkCoupons(response.data.coupons);
          }
        } else {
          setSuccess(`✅ Coupon "${couponData.code || 'created'}" has been created successfully!`);
          setGeneratedBulkCoupons([]); // Clear bulk coupons if single coupon
        }
      }

      // Refresh coupons list
      await fetchCoupons();
      
      // Reset form after successful submission (for both add and edit)
      resetForm();
      
    } catch (err) {
      console.error('Error submitting coupon:', err);
      if (err.response?.data?.msg?.includes('already exists')) {
        setError(`❌ ${err.response.data.msg}`);
      } else {
        const errorMsg = err.response?.data?.msg || err.message || 'Please try again.';
        setError(`❌ Failed to ${editingId ? 'update' : 'create'} coupon. ${errorMsg}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData(initialFormData);
    setEditingId(null);
    setError("");
    // Don't clear success message here - let AlertMessage handle it
    // setSuccess("");
    // Don't clear generatedBulkCoupons here - keep them for download
  };

  // Clear form after successful operations
  const clearForm = () => {
    setFormData(initialFormData);
    setEditingId(null);
    setError("");
    setSuccess("");
    setGeneratedBulkCoupons([]);
  };

  // Download bulk coupons as CSV
  const downloadBulkCouponsCSV = () => {
    if (!generatedBulkCoupons || generatedBulkCoupons.length === 0) {
      setError("No bulk coupons available to download");
      return;
    }

    // CSV headers
    const headers = [
      "Code",
      "Discount Type",
      "Discount Value",
      "Min Purchase",
      "Start Date",
      "Expiry Date",
      "Status",
      "Used",
      "Created At"
    ];

    // Convert coupons to CSV rows
    const csvRows = generatedBulkCoupons.map(coupon => {
      return [
        coupon.code || "",
        coupon.discountType || "",
        coupon.discountValue || "",
        coupon.minPurchase || "0",
        coupon.startDate ? new Date(coupon.startDate).toLocaleDateString() : "",
        coupon.expiryDate ? new Date(coupon.expiryDate).toLocaleDateString() : "",
        coupon.isActive ? "Active" : "Inactive",
        coupon.used ? "True" : "False",
        coupon.createdAt ? new Date(coupon.createdAt).toLocaleString() : ""
      ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(",");
    });

    // Combine headers and rows
    const csvContent = [
      headers.map(h => `"${h}"`).join(","),
      ...csvRows
    ].join("\n");

    // Create blob and download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    
    link.setAttribute("href", url);
    link.setAttribute("download", `bulk-coupons-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setSuccess(`✅ Successfully downloaded ${generatedBulkCoupons.length} coupons as CSV!`);
  };

  // Format date for input field (YYYY-MM-DD)
  const formatDateForInput = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Format time for input field (HH:MM)
  const formatTimeForInput = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "";
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  // Edit coupon
  const handleEdit = (coupon) => {
    setFormData({
      ...initialFormData,
      code: coupon.code || "",
      type: coupon.type || "single",
      usageType: coupon.usageType || "single",
      discountType: coupon.discountType || "percentage",
      discountValue: coupon.discountValue?.toString() || "",
      minPurchase: coupon.minPurchase?.toString() || "",
      startDate: coupon.startDate ? formatDateForInput(coupon.startDate) : "",
      startTime: coupon.startDate ? formatTimeForInput(coupon.startDate) : "",
      expiryDate: formatDateForInput(coupon.expiryDate),
      endTime: coupon.expiryDate ? formatTimeForInput(coupon.expiryDate) : "",
      isActive: coupon.isActive !== undefined ? coupon.isActive : false,
      offerType: coupon.offerType || "cart",
      applicableProductIds: Array.isArray(coupon.applicableProductIds) ? coupon.applicableProductIds.map(id => (typeof id === 'object' && id?._id ? id._id : id)) : [],
      bankName: coupon.bankName || "",
      // Bulk coupon fields
      numberOfCodes: coupon.numberOfCodes?.toString() || "",
      codeLength: coupon.codeLength?.toString() || "",
      prefix: coupon.prefix || "",
      suffix: coupon.suffix || "",
      codeGenerationType: coupon.codeGenerationType || "alphanumeric",
      useSeparator: coupon.useSeparator || false,
      separatorLength: coupon.separatorLength?.toString() || ""
    });
    setEditingId(coupon._id || coupon.id);
    setError("");
    setSuccess("");
    
    // Scroll to form and focus on coupon code input
    setTimeout(() => {
      if (formRef.current) {
        formRef.current.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start' 
        });
      }
      if (couponCodeInputRef.current) {
        couponCodeInputRef.current.focus();
      }
    }, 100);
  };

  // Delete coupon
  const handleDelete = async (couponId) => {
    // Find the coupon to check if it's already marked as deleted
    const coupon = coupons.find(c => c._id === couponId);
    const isAlreadyDeleted = coupon?.deleted;
    
    let message;
    let isPermanentDelete = false;
    
    if (isAlreadyDeleted) {
      message = "This coupon is already marked as deleted. Click OK to permanently remove it from the database. This action cannot be undone.";
      isPermanentDelete = true;
    } else {
      message = "This will mark the coupon as inactive and add a deleted flag. Click OK to continue.";
      isPermanentDelete = false;
    }
    
    setDeletePopup({
      isVisible: true,
      couponId,
      message,
      isPermanentDelete,
      action: "delete"
    });
  };

  // Handle delete confirmation
  const handleDeleteConfirm = async () => {
    const { couponId, isPermanentDelete } = deletePopup;
    const coupon = coupons.find(c => c._id === couponId);
    
    try {
      setLoading(true);
      setSuccess(""); // Clear any existing success message
      setError(""); // Clear any existing error message
      
      if (isPermanentDelete) {
        // Permanent deletion
        await api.delete(`/coupons/${couponId}/hard`);
        setSuccess(`🗑️ Coupon "${coupon.code}" has been permanently deleted from the database.`);
      } else {
        // Soft delete - mark as inactive and add deleted flag
        await api.delete(`/coupons/${couponId}`);
        setSuccess(`⏸️ Coupon "${coupon.code}" has been marked as deleted and inactive.`);
      }
      
      await fetchCoupons();
    } catch (err) {
      const action = isPermanentDelete ? "permanently delete" : "mark as deleted";
      setError(`❌ Failed to ${action} coupon "${coupon.code}". ${err.response?.data?.msg || 'Please try again.'}`);
    } finally {
      setLoading(false);
      setDeletePopup({
        isVisible: false,
        couponId: null,
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
      couponId: null,
      message: "",
      isPermanentDelete: false,
      action: "delete"
    });
  };

  // Revert deleted coupon
  const handleRevert = async (couponId) => {
    const coupon = coupons.find(c => c._id === couponId);
    
    if (!coupon) {
      setError("Coupon not found");
      return;
    }

    if (!coupon.deleted) {
      setError("This coupon is not deleted");
      return;
    }

    setDeletePopup({
      isVisible: true,
      couponId,
      message: `Are you sure you want to restore the coupon "${coupon.code}"? This will make it active again.`,
      isPermanentDelete: false,
      action: "revert"
    });
  };

  // Handle revert confirmation
  const handleRevertConfirm = async () => {
    const { couponId } = deletePopup;
    const coupon = coupons.find(c => c._id === couponId);
    
    try {
      setLoading(true);
      setSuccess("");
      setError("");

      // Check if there's already an active or inactive coupon with the same code
      const existingCoupon = coupons.find(c => 
        c._id !== couponId && // Exclude current coupon being reverted
        c.code.toUpperCase().trim() === coupon.code.toUpperCase().trim() && // Same code
        !c.deleted // Not deleted (active or inactive)
      );

      if (existingCoupon) {
        const status = existingCoupon.isActive ? 'Active' : 'Inactive';
        const suggestion = existingCoupon.isActive ? 
          `Consider deleting the active coupon "${existingCoupon.code}" first, or use a different code for the restored coupon.` :
          `Consider deleting the inactive coupon "${existingCoupon.code}" first, or use a different code for the restored coupon.`;
        
        setError(`❌ Cannot restore coupon "${coupon.code}". A ${status.toLowerCase()} coupon with this code already exists. ${suggestion}`);
        setLoading(false);
        setDeletePopup({
          isVisible: false,
          couponId: null,
          message: "",
          isPermanentDelete: false,
          action: "delete"
        });
        return;
      }

      // Revert the coupon by setting deleted to false and isActive to true
      await api.put(`/coupons/${couponId}`, {
        code: coupon.code,
        type: coupon.type || "single",
        usageType: coupon.usageType || "single",
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        minPurchase: coupon.minPurchase || 0,
        startDate: coupon.startDate || null,
        expiryDate: coupon.expiryDate,
        isActive: true,
        deleted: false,
        offerType: coupon.offerType || "cart",
        applicableProductIds: coupon.applicableProductIds || [],
        bankName: coupon.bankName || null,
        // Bulk coupon fields
        numberOfCodes: coupon.numberOfCodes || null,
        codeLength: coupon.codeLength || null,
        prefix: coupon.prefix || null,
        suffix: coupon.suffix || null,
        codeGenerationType: coupon.codeGenerationType || "alphanumeric",
        useSeparator: coupon.useSeparator || false,
        separatorLength: coupon.separatorLength || null
      });

      setSuccess(`✅ Coupon "${coupon.code}" has been restored and is now active!`);
      await fetchCoupons();
    } catch (err) {
      setError(`❌ Failed to restore coupon "${coupon.code}". ${err.response?.data?.msg || 'Please try again.'}`);
    } finally {
      setLoading(false);
      setDeletePopup({
        isVisible: false,
        couponId: null,
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
      couponId: null,
      message: "",
      isPermanentDelete: false,
      action: "delete"
    });
  };

  // Fetch coupons from backend
  const fetchCoupons = async () => {
    try {
      setLoading(true);
      const response = await api.get('/coupons?showInactive=true&includeDeleted=true');
      setCoupons(response.data);
      setError("");
    } catch (err) {
      setError("Failed to fetch coupons");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCoupons();
  }, []);

  // Fetch categories when product_base is selected
  const fetchCategories = useCallback(async () => {
    try {
      const response = await api.get('/categories');
      setCategories(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      console.error('Error fetching categories for coupon:', err);
      setCategories([]);
    }
  }, []);

  useEffect(() => {
    if (formData.offerType === 'product_base') {
      fetchCategories();
    } else {
      setCategories([]);
      setSubcategories([]);
      setProductsForSelection([]);
      setApplicableCategoryId('');
      setApplicableSubcategoryId('');
      setSelectedProductDetails({});
    }
  }, [formData.offerType, fetchCategories]);

  useEffect(() => {
    if (formData.offerType !== "product_base") {
      setSelectedProductDetails({});
      return;
    }
    const ids = formData.applicableProductIds || [];
    if (ids.length === 0) {
      setSelectedProductDetails({});
      return;
    }
    setSelectedProductDetails((prev) => {
      const set = new Set(ids.map(String));
      return Object.fromEntries(Object.entries(prev).filter(([k]) => set.has(k)));
    });
  }, [formData.offerType, formData.applicableProductIds]);

  // Fetch subcategories when category is selected
  useEffect(() => {
    if (formData.offerType !== 'product_base' || !applicableCategoryId) {
      setSubcategories([]);
      setApplicableSubcategoryId('');
      setProductsForSelection([]);
      return;
    }
    let cancelled = false;
    setSubcategoriesLoading(true);
    setSubcategories([]);
    setApplicableSubcategoryId('');
    setProductsForSelection([]);
    api.get(`/subcategories?categoryId=${applicableCategoryId}&showInactive=true&includeDeleted=false&_t=${Date.now()}`)
      .then((res) => {
        if (!cancelled) setSubcategories(Array.isArray(res.data) ? res.data : []);
      })
      .catch(() => { if (!cancelled) setSubcategories([]); })
      .finally(() => { if (!cancelled) setSubcategoriesLoading(false); });
    return () => { cancelled = true; };
  }, [formData.offerType, applicableCategoryId]);

  // Fetch products when subcategory is selected
  useEffect(() => {
    if (formData.offerType !== 'product_base' || !applicableSubcategoryId) {
      setProductsForSelection([]);
      return;
    }
    let cancelled = false;
    setProductsLoading(true);
    api.get(`/products?subCategoryId=${applicableSubcategoryId}&showInactive=true&includeDeleted=false&limit=500&_t=${Date.now()}`)
      .then((res) => {
        const list = res.data?.products ?? (Array.isArray(res.data) ? res.data : res.data?.data ?? []);
        if (!cancelled) setProductsForSelection(Array.isArray(list) ? list : []);
      })
      .catch(() => { if (!cancelled) setProductsForSelection([]); })
      .finally(() => { if (!cancelled) setProductsLoading(false); });
    return () => { cancelled = true; };
  }, [formData.offerType, applicableSubcategoryId]);

  const handleApplicableProductToggle = useCallback((productId, checked) => {
    setFormData((prev) => {
      const ids = Array.isArray(prev.applicableProductIds) ? [...prev.applicableProductIds] : [];
      const set = new Set(ids.map(String));
      if (checked) set.add(String(productId));
      else set.delete(String(productId));
      return { ...prev, applicableProductIds: Array.from(set) };
    });
  }, []);

  const handleRemoveApplicableProduct = useCallback((productId) => {
    setFormData((prev) => {
      const ids = (prev.applicableProductIds || []).filter((id) => String(id) !== String(productId));
      return { ...prev, applicableProductIds: ids };
    });
  }, []);

  const getProductImageUrl = (p) => {
    const url = p.mainImage || (p.images && p.images[0]) || null;
    if (!url) return null;
    if (typeof url === "string" && url.startsWith("http")) return url;
    const base = getUploadBaseURL();
    return url.startsWith("/") ? base + url : base + "/" + url;
  };

  // Resolve name and image for a product id (from current list or fetched cache)
  const getSelectedProductDisplay = useCallback((productId) => {
    const idStr = String(productId);
    const fromList = productsForSelection.find((p) => String(p._id) === idStr);
    if (fromList) return { name: fromList.name || fromList.title || idStr, imageUrl: getProductImageUrl(fromList) };
    const cached = selectedProductDetails[idStr];
    if (cached) return { name: cached.name, imageUrl: cached.imageUrl };
    return { name: null, imageUrl: null }; // loading or unknown
  }, [productsForSelection, selectedProductDetails]);

  // Fetch product details for selected IDs we don't have (e.g. from other subcategories or edit mode)
  useEffect(() => {
    const ids = formData.offerType !== "product_base" ? [] : (formData.applicableProductIds || []);
    const idSet = new Set(ids.map(String));
    const inCurrentList = new Set(productsForSelection.map((p) => String(p._id)));
    const missing = ids.filter((id) => !inCurrentList.has(String(id)) && !selectedProductDetails[String(id)]);
    if (missing.length === 0) return;
    let cancelled = false;
    const fetchOne = async (id) => {
      try {
        const res = await api.get(`/products/${id}?_t=${Date.now()}`);
        const p = res.data;
        if (!p || cancelled) return;
        const name = p.name || p.title || id;
        const imageUrl = getProductImageUrl(p);
        setSelectedProductDetails((prev) => ({ ...prev, [String(id)]: { name, imageUrl } }));
      } catch {
        if (!cancelled) setSelectedProductDetails((prev) => ({ ...prev, [String(id)]: { name: id, imageUrl: null } }));
      }
    };
    missing.forEach(fetchOne);
    return () => { cancelled = true; };
  }, [formData.offerType, formData.applicableProductIds, productsForSelection, selectedProductDetails]);

  // Filter coupons based on search query and status
  const filteredCoupons = useMemo(() => {
    let filtered = coupons;
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(coupon => 
        coupon.code.toLowerCase().includes(query) ||
        coupon.discountType.toLowerCase().includes(query) ||
        coupon.discountValue.toString().includes(query) ||
        (coupon.offerType && coupon.offerType.toLowerCase().includes(query)) ||
        (coupon.bankName && coupon.bankName.toLowerCase().includes(query))
      );
    }
    
    // Apply status filter
    filtered = filterEntitiesByStatus(filtered, statusFilter);
    
    return filtered;
  }, [coupons, searchQuery, statusFilter]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredCoupons.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentCoupons = filteredCoupons.slice(startIndex, endIndex);

  // Card lazy loading logic
  useEffect(() => {
    if (viewMode === 'card') {
      const initialCards = filteredCoupons.slice(0, 12);
      setDisplayedCards(initialCards);
      setHasMoreCards(filteredCoupons.length > 12);
      setCurrentPage(1);
    }
  }, [viewMode, filteredCoupons]);

  // Reset pagination when search query changes
  const resetPaginationForSearch = useCallback(() => {
    setCurrentPage(1);
    if (viewMode === 'card') {
      const initialCards = filteredCoupons.slice(0, 12);
      setDisplayedCards(initialCards);
      setHasMoreCards(filteredCoupons.length > 12);
    }
  }, [viewMode, filteredCoupons.length]);

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
      const nextCards = filteredCoupons.slice(currentCardCount, currentCardCount + 12);
      
      if (nextCards.length > 0) {
        setHasMoreCards(currentCardCount + nextCards.length < filteredCoupons.length);
        return [...prevCards, ...nextCards];
      } else {
        setHasMoreCards(false);
        return prevCards;
      }
    });
  }, [filteredCoupons]);

  // Reset pagination when view mode changes
  const handleViewModeChange = useCallback((mode) => {
    setViewMode(mode);
    setCurrentPage(1);
    if (mode === 'card') {
      const initialCards = filteredCoupons.slice(0, 12);
      setDisplayedCards(initialCards);
      setHasMoreCards(filteredCoupons.length > 12);
    }
  }, [filteredCoupons.length]);

  const handleCancel = () => {
    resetForm();
  };

  // Check if coupon is expired
  const isExpired = (expiryDate) => {
    if (!expiryDate) return false;
    return new Date(expiryDate) < new Date();
  };

  return (
    <div className="paddingAll20">
      {/* Header */}
      <PageHeader
        title="Coupon Management"
        subtitle="Manage your discount coupons and promotional codes"
        isEditing={!!editingId}
        editText="Edit Coupon"
        createText="Add New Coupon"
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
                type="select"
                name="type"
                label="Coupon Type"
                value={formData.type}
                onChange={handleChange}
                required={true}
                options={[
                  { value: "single", label: "Single Coupon" },
                  { value: "bulk", label: "Bulk Coupons" },
                ]}
              />
            </div>   
          </div>

          {formData.type === 'single' ? (
            <div className="makeFlex row gap10">
              <div className="fullWidth">
                <FormField
                  ref={couponCodeInputRef}
                  type="text"
                  name="code"
                  label="Coupon Code"
                  value={formData.code}
                  onChange={handleChange}
                  placeholder="Enter Coupon Code (e.g., SUMMER20)"
                  required={true}
                  style={{ textTransform: 'uppercase' }}
                />
              </div>
            </div>
          ) : (
            <>
              <div className="makeFlex row gap10">
                <div className="fullWidth">
                  <FormField
                    type="number"
                    name="numberOfCodes"
                    label="Number of Coupon Codes"
                    value={formData.numberOfCodes}
                    onChange={handleChange}
                    placeholder="Enter number of codes to generate (e.g., 100)"
                    required={true}
                    min={1}
                  />
                </div>
                <div className="fullWidth">
                  <FormField
                    type="number"
                    name="codeLength"
                    label="Length of Codes"
                    value={formData.codeLength}
                    onChange={handleChange}
                    placeholder="Enter length of codes (e.g., 6)"
                    required={true}
                    min={1}
                    max={12}
                  />
                </div>
              </div>
              <div className="makeFlex row gap10">
                <div className="fullWidth">
                  <FormField
                    type="text"
                    name="prefix"
                    label="Prefix (Optional)"
                    value={formData.prefix}
                    onChange={handleChange}
                    placeholder="Enter prefix (e.g., SUPER)"
                    style={{ textTransform: 'uppercase' }}
                  />
                </div>
                <div className="fullWidth">
                  <FormField
                    type="text"
                    name="suffix"
                    label="Suffix (Optional)"
                    value={formData.suffix}
                    onChange={handleChange}
                    placeholder="Enter Suffix (e.g., 2024)"
                    style={{ textTransform: 'uppercase' }}
                  />
                </div>
              </div>
              <div className="makeFlex row gap10">
                <div className="fullWidth">
                  <FormField
                    type="select"
                    name="codeGenerationType"
                    label="Code Generation Type"
                    value={formData.codeGenerationType}
                    onChange={handleChange}
                    required={true}
                    options={[
                      { value: "alphanumeric", label: "Alphanumeric (A-Z, 0-9)" },
                      { value: "alphabet", label: "Alphabet Only (A-Z)" },
                      { value: "numbers", label: "Numbers Only (0-9)" },
                    ]}
                  />
                </div>
                <div className="fullWidth">
                  <label className="formLabel appendBottom8 makeFlex gap10">
                    <FormField
                      type="checkbox"
                      name="useSeparator"
                      checked={formData.useSeparator}
                      onChange={handleChange}
                    />
                    Use Separator
                  </label>
                </div>
              </div>
              {formData.useSeparator && (
                <div className="makeFlex row gap10">
                  <div className="fullWidth">
                    <FormField
                      type="select"
                      name="separatorLength"
                      label="Separator Length"
                      value={formData.separatorLength}
                      onChange={handleChange}
                      options={[
                        { value: "2", label: "2" },
                        { value: "3", label: "3" },
                        { value: "4", label: "4" },
                      ]}
                    />
                  </div>
                </div>
              )}
            </>
          )}

          <div className="makeFlex row gap10">
            <div className="fullWidth">
              <FormField
                type="select"
                name="usageType"
                label="Usage Type"
                value={formData.usageType}
                onChange={handleChange}
                required={true}
                options={[
                  { value: "single", label: "Single Use" },
                  { value: "multiple", label: "Multiple Use" },
                ]}
                info="Single Use: Can be used only once. Multiple Use: Can be used multiple times until expiry."
              />
            </div>
          </div>

          <div className="makeFlex row gap10">
            <div className="fullWidth">
              <FormField
                type="select"
                name="offerType"
                label="Offer Type"
                value={formData.offerType}
                onChange={handleChange}
                required={true}
                options={[
                  { value: "cart", label: "Cart (entire order)" },
                  { value: "product_base", label: "Product base" },
                  { value: "bank_offer", label: "Bank offer" },
                ]}
                info="Cart: applies to entire order. Product base: applies to selected products only. Bank offer: tied to a bank promotion."
              />
            </div>
          </div>

          {formData.offerType === "product_base" && (
            <>
              <div className="makeFlex row gap10 appendBottom16">
                <div className="fullWidth">
                  <FormField
                    type="select"
                    label="Category"
                    name="applicableCategoryId"
                    value={applicableCategoryId}
                    onChange={(e) => setApplicableCategoryId(e.target.value)}
                    options={[
                      { value: "", label: "Select category" },
                      ...categories.filter(c => c.isActive !== false && !c.deleted).map((c) => ({ value: c._id, label: c.name || c._id }))
                    ]}
                  />
                </div>
                <div className="fullWidth">
                  <FormField
                    type="select"
                    label="Subcategory"
                    name="applicableSubcategoryId"
                    value={applicableSubcategoryId}
                    onChange={(e) => setApplicableSubcategoryId(e.target.value)}
                    disabled={!applicableCategoryId || subcategoriesLoading}
                    options={[
                      { value: "", label: applicableCategoryId ? (subcategoriesLoading ? "Loading..." : "Select subcategory") : "Select category first" },
                      ...subcategories.filter(s => s.isActive !== false && !s.deleted).map((s) => ({ value: s._id, label: s.name || s._id }))
                    ]}
                  />
                </div>
              </div>
              <div className="makeFlex row gap10 appendBottom16">
                <div className="fullWidth">
                  <label className="formLabel appendBottom8 block">Applicable Products</label>
                  {!applicableSubcategoryId ? (
                    <p className="grayText font14 appendBottom8">Select category and subcategory to see products.</p>
                  ) : productsLoading ? (
                    <p className="grayText font14 appendBottom8">Loading products...</p>
                  ) : productsForSelection.length === 0 ? (
                    <p className="grayText font14 appendBottom8">No products in this subcategory.</p>
                  ) : (
                    <div className="makeFlex column gap8 paddingAll12 appendBottom8" style={{ maxHeight: 220, overflowY: "auto", border: "1px solid #ddd", borderRadius: 6 }}>
                      {productsForSelection.map((p) => {
                        const id = p._id;
                        const isSelected = (formData.applicableProductIds || []).some(pid => String(pid) === String(id));
                        const imgUrl = getProductImageUrl(p);
                        return (
                          <label key={id} className="makeFlex gap10 alignCenter cursorPointer font14">
                            <input
                              type="checkbox"
                              checked={!!isSelected}
                              onChange={(e) => handleApplicableProductToggle(id, e.target.checked)}
                            />
                            {imgUrl ? (
                              <img src={imgUrl} alt="" className="borderRadius4" style={{ width: 32, height: 32, objectFit: "cover" }} />
                            ) : (
                              <span className="makeFlex alignCenter justifyCenter borderRadius4 grayText font12" style={{ width: 32, height: 32, backgroundColor: "#eee" }}>—</span>
                            )}
                            <span>{p.name || p.title || id}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                  <p className="grayText font14" style={{ marginTop: 4 }}>
                    Select products above; you can change subcategory to add more.
                    {(formData.applicableProductIds || []).length > 0 && (
                      <span className="appendLeft8 fontSemiBold">{(formData.applicableProductIds || []).length} product(s) selected.</span>
                    )}
                  </p>
                </div>
              </div>
              {(formData.applicableProductIds || []).length > 0 && (
                <div className="makeFlex row gap10 appendBottom16">
                  <div className="fullWidth">
                    <div className="makeFlex spaceBetween alignCenter appendBottom8">
                      <span className="formLabel">Selected products</span>
                      <button
                        type="button"
                        className="btnSecondary font14"
                        onClick={() => setFormData((prev) => ({ ...prev, applicableProductIds: [] }))}
                      >
                        Clear all
                      </button>
                    </div>
                    <div className="makeFlex wrap gap8">
                      {(formData.applicableProductIds || []).map((productId) => {
                        const { name, imageUrl } = getSelectedProductDisplay(productId);
                        return (
                          <span
                            key={productId}
                            className="makeFlex alignCenter gap6 padding6 borderRadius4 cursorPointer"
                            style={{ backgroundColor: "#f0f0f0" }}
                            onClick={() => handleRemoveApplicableProduct(productId)}
                            title="Click to remove"
                            onKeyDown={(e) => e.key === "Enter" && handleRemoveApplicableProduct(productId)}
                            role="button"
                            tabIndex={0}
                          >
                            {imageUrl ? (
                              <img src={imageUrl} alt="" className="borderRadius4" style={{ width: 28, height: 28, objectFit: "cover" }} />
                            ) : (
                              <span className="makeFlex alignCenter justifyCenter borderRadius4 grayText font12" style={{ width: 28, height: 28, backgroundColor: "#e0e0e0" }}>—</span>
                            )}
                            <span className="font14">{name ?? productId}</span>
                            <span className="redText font14">×</span>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {formData.offerType === "bank_offer" && (
            <div className="makeFlex row gap10">
              <div className="fullWidth">
                <FormField
                  type="text"
                  name="bankName"
                  label="Bank / Offer Name"
                  value={formData.bankName}
                  onChange={handleChange}
                  placeholder="e.g. HDFC Bank 10% off, SBI Card offer"
                />
              </div>
            </div>
          )}
          
          <div className="makeFlex row gap10">
            <div className="fullWidth">
              <FormField
                type="select"
                name="discountType"
                label="Discount Type"
                value={formData.discountType}
                onChange={handleChange}
                required={true}
                options={[
                  { value: "percentage", label: "Percentage (%)" },
                  { value: "flat", label: "Flat Amount" },
                ]}
              />
            </div>
            <div className="fullWidth">
              <FormField
                type="number"
                name="discountValue"
                label={`Discount Value ${formData.discountType === 'percentage' ? '(%)' : '(Amount)'}`}
                value={formData.discountValue}
                onChange={handleChange}
                placeholder={formData.discountType === 'percentage' ? "Enter percentage (0-100)" : "Enter amount"}
                required={true}
                min={formData.discountType === 'percentage' ? 0 : 0}
                max={formData.discountType === 'percentage' ? 100 : undefined}
              />
            </div>
          </div>

          <div className="makeFlex row gap10">
            <div className="fullWidth">
              <FormField
                type="number"
                name="minPurchase"
                label="Minimum Purchase Amount"
                value={formData.minPurchase}
                onChange={handleChange}
                placeholder="Enter minimum purchase amount (0 for no minimum)"
                min="0"
              />
            </div>
          </div>

          <div className="makeFlex row gap10">
            <div className="fullWidth">
              <FormField
                type="date"
                name="startDate"
                label="Coupon Start Date (Optional)"
                value={formData.startDate}
                onChange={handleChange}
                placeholder="Select start date"
              />
            </div>
            <div className="fullWidth">
              <FormField
                type="time"
                name="startTime"
                label="Start Time (Optional)"
                value={formData.startTime}
                onChange={handleChange}
                placeholder="Select start time"
                info="If not specified, defaults to 00:00:00"
              />
            </div>
          </div>

          <div className="makeFlex row gap10">
            <div className="fullWidth">
              <FormField
                type="date"
                name="expiryDate"
                label="Coupon End Date"
                value={formData.expiryDate}
                onChange={handleChange}
                placeholder="Select end date"
                required={true}
              />
            </div>
            <div className="fullWidth">
              <FormField
                type="time"
                name="endTime"
                label="End Time (Optional)"
                value={formData.endTime}
                onChange={handleChange}
                placeholder="Select end time"
                info="If not specified, defaults to 23:59:59"
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
              <p className="negativeMarginTop10">Check this box to keep the coupon active, uncheck to mark as inactive</p>
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
                <span>{editingId ? "Update Coupon" : "Generate Coupon(Bulk/Single)"}</span>
              )}
            </button>
            
            {(editingId || (!editingId && (formData.code || formData.discountValue || formData.expiryDate))) && (
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
                Add Another Coupon
              </button>
            )}

            {/* Download CSV button for bulk coupons */}
            {!editingId && generatedBulkCoupons && generatedBulkCoupons.length > 0 && (
              <button
                type="button"
                onClick={downloadBulkCouponsCSV}
                className="btnSecondary"
                style={{
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none'
                }}
              >
                📥 Download Bulk Coupons CSV ({generatedBulkCoupons.length})
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Coupons List */}
      <div className="brandsListContainer paddingAll32">
        <div className="listHeader makeFlex spaceBetween end appendBottom24">
          <div className="leftSection">
            <h2 className="listTitle font30 fontBold blackText appendBottom16">Coupons ({filteredCoupons.length})</h2>
            <StatusFilter
              statusFilter={statusFilter}
              onStatusChange={setStatusFilter}
              counts={calculateStandardStatusCounts(coupons)}
              disabled={loading}
            />
          </div>
          <div className="rightSection makeFlex end gap10">
            <SearchField
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search coupons..."
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

        {filteredCoupons.length === 0 && !loading ? (
          <div className="emptyState textCenter paddingAll60">
            <div className="emptyIcon appendBottom16">🎫</div>
            <h3 className="font22 fontSemiBold grayText appendBottom8">No Coupons Found</h3>
            <p className="font16 grayText">Start by adding your first coupon above</p>
          </div>
        ) : (
          <>
            {/* Card View */}
            {viewMode === 'card' && (
              <div className="brandsGrid">
                {displayedCards.map((coupon) => (
                  <EntityCard
                    key={coupon._id || coupon.id}
                    entity={coupon}
                    logoField="image"
                    nameField="code"
                    idField="_id"
                    onEdit={coupon.deleted ? undefined : handleEdit}
                    onDelete={handleDelete}
                    onRevert={coupon.deleted ? () => handleRevert(coupon._id || coupon.id) : undefined}
                    loading={loading}
                    imagePlaceholderColor={generateEntityColor(coupon._id || coupon.id, coupon.code)}
                    renderHeader={(coupon) => (
                      <EntityCardHeader
                        entity={coupon}
                        imageField="image"
                        titleField="code"
                        dateField="createdAt"
                        generateColor={generateEntityColor}
                      />
                    )}
                    renderDetails={(coupon) => {
                      const expired = isExpired(coupon.expiryDate);
                      return (
                        <>
                          <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                            <span className="detailLabel font14 fontSemiBold grayText textUppercase">ID:</span>
                            <span className="detailValue font14 blackText appendLeft6">{coupon._id || 'N/A'}</span>
                          </div>
                          <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                            <span className="detailLabel font14 fontSemiBold grayText textUppercase">Coupon Code:</span>
                            <span className="detailValue font14 blackText appendLeft6 fontBold">{coupon.code}</span>
                          </div>
                          <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                            <span className="detailLabel font14 fontSemiBold grayText textUppercase">Offer Type:</span>
                            <span className="detailValue font14 blackText appendLeft6">
                              {coupon.offerType === 'product_base' ? 'Product base' : coupon.offerType === 'bank_offer' ? 'Bank offer' : 'Cart'}
                              {coupon.offerType === 'bank_offer' && coupon.bankName ? ` (${coupon.bankName})` : ''}
                            </span>
                          </div>
                          <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                            <span className="detailLabel font14 fontSemiBold grayText textUppercase">Discount:</span>
                            <span className="detailValue font14 fontBold redText appendLeft6">
                              {coupon.discountType === 'percentage' 
                                ? `${coupon.discountValue}%`
                                : `₹${coupon.discountValue}`}
                            </span>
                          </div>
                          {coupon.minPurchase > 0 && (
                            <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                              <span className="detailLabel font14 fontSemiBold grayText textUppercase">Min Purchase:</span>
                              <span className="detailValue font14 blackText appendLeft6">₹{coupon.minPurchase}</span>
                            </div>
                          )}
                          <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                            <span className="detailLabel font14 fontSemiBold grayText textUppercase">Expiry Date & Time:</span>
                            <span className={`detailValue font14 ${expired ? 'redText' : 'blackText'} appendLeft6`}>
                              {new Date(coupon.expiryDate).toLocaleString()}
                              {expired && ' (Expired)'}
                            </span>
                          </div>
                          <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                            <span className="detailLabel font14 fontSemiBold grayText textUppercase">Coupon Used:</span>
                            <span className={`detailValue font14 ${coupon.used ? 'greenText' : 'grayText'} appendLeft6`}>
                              {coupon.used ? 'True' : 'False'}
                            </span>
                          </div>
                          <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                            <span className="detailLabel font14 fontSemiBold grayText textUppercase">Status:</span>
                            <span className={`detailValue font14 ${coupon.deleted ? 'deleted' : (expired ? 'redText' : (coupon.isActive ? 'greenText' : 'inactive'))} appendLeft6`}>
                              {coupon.deleted ? 'Deleted' : (expired ? 'Expired' : (coupon.isActive ? 'Active' : 'Inactive'))}
                            </span>
                          </div>
                        </>
                      );
                    }}
                    renderActions={(coupon) => (
                      <ActionButtons
                        onEdit={coupon.deleted ? undefined : () => handleEdit(coupon)}
                        onDelete={() => handleDelete(coupon._id || coupon.id)}
                        onRevert={coupon.deleted ? () => handleRevert(coupon._id || coupon.id) : undefined}
                        loading={loading}
                        size="normal"
                        editText="✏️ Edit"
                        deleteText={coupon.deleted ? "🗑️ Final Del" : "🗑️ Delete"}
                        revertText="🔄 Undelete"
                        editTitle="Edit Coupon"
                        deleteTitle={coupon.deleted ? "Final Del" : "Delete Coupon"}
                        revertTitle="Restore Coupon"
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
                        <th className="tableHeader">Code</th>
                        <th className="tableHeader">Offer Type</th>
                        <th className="tableHeader">Discount</th>
                        <th className="tableHeader">Min Purchase</th>
                        <th className="tableHeader">Expiry Date</th>
                        <th className="tableHeader">Coupon Used</th>
                        <th className="tableHeader">Status</th>
                        <th className="tableHeader">Created</th>
                        <th className="tableHeader">Actions</th>
          </tr>
        </thead>
        <tbody>
                      {currentCoupons.map((coupon) => {
                        const expired = isExpired(coupon.expiryDate);
                        return (
                          <tr key={coupon._id || coupon.id} className="tableRow">
                            <td className="tableCell">
                              <span className="brandNameText fontBold">{coupon.code}</span>
                            </td>
                            <td className="tableCell">
                              <span className="addressText">
                                {coupon.offerType === 'product_base' ? 'Product base' : coupon.offerType === 'bank_offer' ? (coupon.bankName ? `Bank (${coupon.bankName})` : 'Bank offer') : 'Cart'}
                              </span>
                            </td>
                            <td className="tableCell">
                              <span className="brandNameText">
                                {coupon.discountType === 'percentage' 
                                  ? `${coupon.discountValue}%` 
                                  : `₹${coupon.discountValue}`}
                              </span>
                            </td>
                            <td className="tableCell">
                              <span className="addressText">
                              ₹{coupon.minPurchase || 0}
                              </span>
                            </td>
                            <td className="tableCell">
                              <span className={`dateText ${expired ? 'redText' : ''}`} title={new Date(coupon.expiryDate).toLocaleString()}>
                                {new Date(coupon.expiryDate).toLocaleString()}
                                {expired && ' (Expired)'}
                              </span>
                            </td>
                            <td className="tableCell">
                              <span className={`statusText ${coupon.used ? 'greenText' : 'grayText'}`}>
                                {coupon.used ? 'True' : 'False'}
                              </span>
                            </td>
                            <td className="tableCell">
                              <span className={`statusText ${coupon.deleted ? 'deleted' : (expired ? 'redText' : (coupon.isActive ? 'active' : 'inactive'))}`}>
                                {coupon.deleted ? 'Deleted' : (expired ? 'Expired' : (coupon.isActive ? 'Active' : 'Inactive'))}
                              </span>
                            </td>
                            <td className="tableCell">
                              <span className="dateText">
                                {new Date(coupon.createdAt).toLocaleDateString()}
                              </span>
                            </td>
                            <td className="tableCell">
                              <div className="tableActions makeFlex gap8">
                                <ActionButtons
                                  onEdit={coupon.deleted ? undefined : () => handleEdit(coupon)}
                                  onDelete={() => handleDelete(coupon._id || coupon.id)}
                                  onRevert={coupon.deleted ? () => handleRevert(coupon._id || coupon.id) : undefined}
                                  loading={loading}
                                  size="small"
                                  editText="✏️"
                                  deleteText={coupon.deleted ? "🗑️" : "🗑️"}
                                  revertText="🔄"
                                  editTitle="Edit Coupon"
                                  deleteTitle={coupon.deleted ? "Final Del" : "Delete Coupon"}
                                  revertTitle="Restore Coupon"
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

export default CouponManager;
