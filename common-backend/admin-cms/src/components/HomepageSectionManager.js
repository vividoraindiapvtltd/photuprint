import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
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
 * Homepage Section Manager
 * 
 * Admin component for managing homepage product display sections.
 * Features:
 * - Create, edit, delete sections
 * - Add/remove products from sections
 * - Reorder sections and products within sections
 * - Schedule sections (start/end dates)
 * - Preview changes before publishing
 * - Toggle section visibility
 */

// Section type options
const SECTION_TYPES = [
  { value: "featured", label: "Featured Products" },
  { value: "hot", label: "Hot / Trending" },
  { value: "new_arrivals", label: "New Arrivals" },
  { value: "bestsellers", label: "Best Sellers" },
  { value: "offers", label: "Offers / Discounts" },
  { value: "custom", label: "Custom Section" },
];

// Layout style options
const LAYOUT_STYLES = [
  { value: "grid", label: "Grid" },
  { value: "carousel", label: "Carousel" },
  { value: "list", label: "List" },
  { value: "masonry", label: "Masonry" },
];

// Status options
const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "scheduled", label: "Scheduled" },
];

const HomepageSectionManager = () => {
  const { selectedWebsite } = useAuth();
  
  // State for sections
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [stats, setStats] = useState(null);
  
  // View and filter states
  const [viewMode, setViewMode] = useState('card');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [hasMoreCards, setHasMoreCards] = useState(true);
  const [displayedCards, setDisplayedCards] = useState([]);
  
  // Form state
  const initialFormData = {
    name: "",
    type: "custom",
    description: "",
    status: "draft",
    displayOrder: 0,
    productLimit: 10,
    autoPopulate: false,
    startDate: "",
    endDate: "",
    isActive: true,
    displayConfig: {
      columns: 4,
      showViewAll: true,
      viewAllLink: "",
      backgroundColor: "#ffffff",
      textColor: "#000000",
      layoutStyle: "grid",
      showProductCount: false,
      customClass: "",
    },
  };
  
  const [formData, setFormData] = useState(initialFormData);
  
  // Product selection modal state
  const [showProductModal, setShowProductModal] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [availableProducts, setAvailableProducts] = useState([]);
  const [productSearchQuery, setProductSearchQuery] = useState("");
  const [productLoading, setProductLoading] = useState(false);
  const [productPage, setProductPage] = useState(1);
  const [productPagination, setProductPagination] = useState(null);
  
  // Delete confirmation popup
  const [deletePopup, setDeletePopup] = useState({
    isVisible: false,
    sectionId: null,
    message: "",
    isPermanentDelete: false,
    action: "delete",
  });
  
  // Preview state
  const [showPreview, setShowPreview] = useState(false);
  const [previewSection, setPreviewSection] = useState(null);
  
  // Refs
  const formRef = useRef(null);
  const nameInputRef = useRef(null);

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  const fetchSections = async () => {
    if (!selectedWebsite?._id) {
      setSections([]);
      setError("Please select a website first.");
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError("");
      const response = await api.get('/homepage-sections', {
        params: {
          showInactive: 'true',
          includeDeleted: 'true',
          includeProducts: 'true',
        },
      });
      
      setSections(response.data.sections || []);
    } catch (err) {
      console.error("Error fetching sections:", err);
      const msg = err.response?.data?.msg || err.message || "Failed to load sections. Please refresh and try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await api.get('/homepage-sections/admin/stats');
      setStats(response.data);
    } catch (err) {
      console.error("Error fetching stats:", err);
    }
  };

  const fetchAvailableProducts = async (search = "", page = 1) => {
    try {
      setProductLoading(true);
      const response = await api.get('/homepage-sections/admin/available-products', {
        params: {
          search,
          page,
          limit: 20,
          excludeSection: editingId || undefined,
        },
      });
      
      setAvailableProducts(response.data.products || []);
      setProductPagination(response.data.pagination);
    } catch (err) {
      console.error("Error fetching products:", err);
    } finally {
      setProductLoading(false);
    }
  };

  useEffect(() => {
    if (selectedWebsite?._id) {
      fetchSections();
      fetchStats();
    }
  }, [selectedWebsite?._id]);

  // ============================================================================
  // FILTERING AND PAGINATION
  // ============================================================================

  const filteredSections = useMemo(() => {
    let filtered = sections;
    
    // Apply status filter
    filtered = filterEntitiesByStatus(filtered, statusFilter);
    
    // Apply type filter
    if (typeFilter !== "all") {
      filtered = filtered.filter(s => s.type === typeFilter);
    }
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(section =>
        section.name.toLowerCase().includes(query) ||
        section.sectionId?.toLowerCase().includes(query) ||
        section.description?.toLowerCase().includes(query)
      );
    }
    
    // Sort by display order
    return filtered.sort((a, b) => a.displayOrder - b.displayOrder);
  }, [sections, searchQuery, statusFilter, typeFilter]);

  // Calculate status counts
  const statusCounts = useMemo(() => {
    return calculateStandardStatusCounts(sections);
  }, [sections]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredSections.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentSections = filteredSections.slice(startIndex, endIndex);

  // Card lazy loading
  useEffect(() => {
    if (viewMode === 'card' && filteredSections.length > 0) {
      const initialCards = filteredSections.slice(0, 12);
      setDisplayedCards(initialCards);
      setHasMoreCards(filteredSections.length > 12);
      setCurrentPage(1);
    }
  }, [filteredSections, viewMode]);

  useEffect(() => {
    setCurrentPage(1);
    if (viewMode === 'card') {
      const initialCards = filteredSections.slice(0, 12);
      setDisplayedCards(initialCards);
      setHasMoreCards(filteredSections.length > 12);
    }
  }, [searchQuery, statusFilter, typeFilter, viewMode, filteredSections]);

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLoadMoreCards = () => {
    const currentCardCount = displayedCards.length;
    const nextCards = filteredSections.slice(currentCardCount, currentCardCount + 12);
    
    if (nextCards.length > 0) {
      setDisplayedCards([...displayedCards, ...nextCards]);
      setHasMoreCards(currentCardCount + nextCards.length < filteredSections.length);
    } else {
      setHasMoreCards(false);
    }
  };

  const handleViewModeChange = (mode) => {
    setViewMode(mode);
    setCurrentPage(1);
    if (mode === 'card') {
      const initialCards = filteredSections.slice(0, 12);
      setDisplayedCards(initialCards);
      setHasMoreCards(filteredSections.length > 12);
    }
  };

  // ============================================================================
  // FORM HANDLING
  // ============================================================================

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (name.startsWith("displayConfig.")) {
      const configKey = name.replace("displayConfig.", "");
      setFormData(prev => ({
        ...prev,
        displayConfig: {
          ...prev.displayConfig,
          [configKey]: type === "checkbox" ? checked : value,
        },
      }));
    } else if (type === "checkbox") {
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const resetForm = () => {
    setFormData(initialFormData);
    setSelectedProducts([]);
    setEditingId(null);
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      setError("Section name is required");
      return;
    }
    
    try {
      setLoading(true);
      setError("");
      setSuccess("");
      
      const submitData = {
        ...formData,
        name: formData.name.trim(),
        description: formData.description?.trim() || "",
        startDate: formData.startDate || null,
        endDate: formData.endDate || null,
        productLimit: parseInt(formData.productLimit) || 10,
        displayOrder: parseInt(formData.displayOrder) || 0,
        displayConfig: {
          ...formData.displayConfig,
          columns: parseInt(formData.displayConfig.columns) || 4,
        },
      };
      
      if (editingId) {
        await api.put(`/homepage-sections/${editingId}`, submitData);
        
        // Update products if changed
        if (selectedProducts.length > 0) {
          await api.put(`/homepage-sections/${editingId}/products`, {
            products: selectedProducts.map((p, index) => ({
              productId: p._id,
              displayOrder: index,
            })),
          });
        }
        
        setSuccess(`Section "${formData.name}" updated successfully!`);
      } else {
        const response = await api.post('/homepage-sections', submitData);
        const newSectionId = response.data.section._id;
        
        // Add products if selected
        if (selectedProducts.length > 0) {
          await api.put(`/homepage-sections/${newSectionId}/products`, {
            products: selectedProducts.map((p, index) => ({
              productId: p._id,
              displayOrder: index,
            })),
          });
        }
        
        setSuccess(`Section "${formData.name}" created successfully!`);
      }
      
      await fetchSections();
      await fetchStats();
      resetForm();
    } catch (err) {
      const action = editingId ? "update" : "create";
      setError(`Failed to ${action} section. ${err.response?.data?.msg || 'Please try again.'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (section) => {
    setFormData({
      name: section.name || "",
      type: section.type || "custom",
      description: section.description || "",
      status: section.status || "draft",
      displayOrder: section.displayOrder || 0,
      productLimit: section.productLimit || 10,
      autoPopulate: section.autoPopulate || false,
      startDate: section.startDate ? section.startDate.split('T')[0] : "",
      endDate: section.endDate ? section.endDate.split('T')[0] : "",
      isActive: section.isActive !== false,
      displayConfig: {
        columns: section.displayConfig?.columns || 4,
        showViewAll: section.displayConfig?.showViewAll !== false,
        viewAllLink: section.displayConfig?.viewAllLink || "",
        backgroundColor: section.displayConfig?.backgroundColor || "#ffffff",
        textColor: section.displayConfig?.textColor || "#000000",
        layoutStyle: section.displayConfig?.layoutStyle || "grid",
        showProductCount: section.displayConfig?.showProductCount || false,
        customClass: section.displayConfig?.customClass || "",
      },
    });
    
    // Set selected products
    const sectionProducts = (section.products || [])
      .filter(p => p.product)
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map(p => p.product);
    setSelectedProducts(sectionProducts);
    
    setEditingId(section._id);
    setError("");
    setSuccess("");
    
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      nameInputRef.current?.focus();
    }, 100);
  };

  const handleCancel = () => {
    resetForm();
  };

  // ============================================================================
  // DELETE HANDLING
  // ============================================================================

  const handleDelete = (sectionId) => {
    const section = sections.find(s => s._id === sectionId);
    const isAlreadyDeleted = section?.deleted;
    
    let message;
    let isPermanentDelete = false;
    
    if (isAlreadyDeleted) {
      message = `This will permanently delete "${section.name}". This action cannot be undone.`;
      isPermanentDelete = true;
    } else {
      message = `This will mark "${section.name}" as deleted and inactive.`;
      isPermanentDelete = false;
    }
    
    setDeletePopup({
      isVisible: true,
      sectionId,
      message,
      isPermanentDelete,
      action: "delete",
    });
  };

  const handleDeleteConfirm = async () => {
    const { sectionId, isPermanentDelete } = deletePopup;
    const section = sections.find(s => s._id === sectionId);
    
    try {
      setLoading(true);
      
      if (isPermanentDelete) {
        await api.delete(`/homepage-sections/${sectionId}/hard`);
        setSuccess(`Section "${section.name}" permanently deleted.`);
      } else {
        await api.delete(`/homepage-sections/${sectionId}`);
        setSuccess(`Section "${section.name}" marked as deleted.`);
      }
      
      await fetchSections();
      await fetchStats();
    } catch (err) {
      setError(`Failed to delete section. ${err.response?.data?.msg || 'Please try again.'}`);
    } finally {
      setLoading(false);
      setDeletePopup({ isVisible: false, sectionId: null, message: "", isPermanentDelete: false, action: "delete" });
    }
  };

  const handleRestore = async (sectionId) => {
    const section = sections.find(s => s._id === sectionId);
    
    setDeletePopup({
      isVisible: true,
      sectionId,
      message: `Restore section "${section.name}"? This will make it available again.`,
      isPermanentDelete: false,
      action: "restore",
    });
  };

  const handleRestoreConfirm = async () => {
    const { sectionId } = deletePopup;
    const section = sections.find(s => s._id === sectionId);
    
    try {
      setLoading(true);
      await api.post(`/homepage-sections/${sectionId}/restore`);
      setSuccess(`Section "${section.name}" restored successfully!`);
      await fetchSections();
      await fetchStats();
    } catch (err) {
      setError(`Failed to restore section. ${err.response?.data?.msg || 'Please try again.'}`);
    } finally {
      setLoading(false);
      setDeletePopup({ isVisible: false, sectionId: null, message: "", isPermanentDelete: false, action: "delete" });
    }
  };

  // ============================================================================
  // STATUS AND ORDERING
  // ============================================================================

  const handleToggleStatus = async (sectionId) => {
    try {
      setLoading(true);
      await api.post(`/homepage-sections/${sectionId}/toggle-status`);
      await fetchSections();
      setSuccess("Section status updated.");
    } catch (err) {
      setError("Failed to update section status.");
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async (sectionId) => {
    try {
      setLoading(true);
      await api.post(`/homepage-sections/${sectionId}/publish`);
      await fetchSections();
      await fetchStats();
      setSuccess("Section published successfully!");
    } catch (err) {
      setError("Failed to publish section.");
    } finally {
      setLoading(false);
    }
  };

  const handleMoveSection = async (sectionId, direction) => {
    const index = filteredSections.findIndex(s => s._id === sectionId);
    if (index === -1) return;
    
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= filteredSections.length) return;
    
    // Swap display orders
    const reorderedSections = filteredSections.map((s, i) => {
      if (i === index) return { id: s._id, displayOrder: newIndex };
      if (i === newIndex) return { id: s._id, displayOrder: index };
      return { id: s._id, displayOrder: i };
    });
    
    try {
      setLoading(true);
      await api.post('/homepage-sections/admin/reorder', { sections: reorderedSections });
      await fetchSections();
    } catch (err) {
      setError("Failed to reorder sections.");
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // PRODUCT MODAL
  // ============================================================================

  const openProductModal = () => {
    setShowProductModal(true);
    fetchAvailableProducts("", 1);
  };

  const closeProductModal = () => {
    setShowProductModal(false);
    setProductSearchQuery("");
    setAvailableProducts([]);
  };

  const handleProductSearch = useCallback((e) => {
    const query = e.target.value;
    setProductSearchQuery(query);
    setProductPage(1);
    fetchAvailableProducts(query, 1);
  }, [editingId]);

  const handleProductPageChange = (page) => {
    setProductPage(page);
    fetchAvailableProducts(productSearchQuery, page);
  };

  const addProductToSelection = (product) => {
    if (!selectedProducts.find(p => p._id === product._id)) {
      setSelectedProducts(prev => [...prev, product]);
    }
  };

  const removeProductFromSelection = (productId) => {
    setSelectedProducts(prev => prev.filter(p => p._id !== productId));
  };

  const moveProductInSelection = (index, direction) => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= selectedProducts.length) return;
    
    const newProducts = [...selectedProducts];
    [newProducts[index], newProducts[newIndex]] = [newProducts[newIndex], newProducts[index]];
    setSelectedProducts(newProducts);
  };

  // ============================================================================
  // PREVIEW
  // ============================================================================

  const handlePreview = (section) => {
    setPreviewSection(section);
    setShowPreview(true);
  };

  const closePreview = () => {
    setShowPreview(false);
    setPreviewSection(null);
  };

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================

  const getSectionTypeLabel = (type) => {
    return SECTION_TYPES.find(t => t.value === type)?.label || type;
  };

  const getStatusColor = (status, isActive, deleted) => {
    if (deleted) return "#dc3545";
    if (!isActive) return "#6c757d";
    switch (status) {
      case "active": return "#28a745";
      case "draft": return "#ffc107";
      case "scheduled": return "#17a2b8";
      default: return "#6c757d";
    }
  };

  const formatDate = (date) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString();
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="paddingAll20">
      {/* Header */}
      <PageHeader
        title="Homepage Section Manager"
        subtitle="Manage product display sections on your homepage"
        isEditing={!!editingId}
        editText="Edit Section"
        createText="Create New Section"
      />

      {/* Success/Error Messages */}
      <AlertMessage type="success" message={success} onClose={() => setSuccess("")} autoClose={true} />
      <AlertMessage type="error" message={error} onClose={() => setError("")} autoClose={true} />

      {/* Statistics Cards */}
      {stats && (
        <div className="statsContainer makeFlex gap16 appendBottom24" style={{ flexWrap: 'wrap' }}>
          <div className="statCard" style={{ flex: '1', minWidth: '150px', padding: '16px', backgroundColor: '#e3f2fd', borderRadius: '8px' }}>
            <div className="font24 fontBold" style={{ color: '#1976d2' }}>{stats.sections?.total || 0}</div>
            <div className="font14 grayText">Total Sections</div>
          </div>
          <div className="statCard" style={{ flex: '1', minWidth: '150px', padding: '16px', backgroundColor: '#e8f5e9', borderRadius: '8px' }}>
            <div className="font24 fontBold" style={{ color: '#388e3c' }}>{stats.sections?.active || 0}</div>
            <div className="font14 grayText">Active Sections</div>
          </div>
          <div className="statCard" style={{ flex: '1', minWidth: '150px', padding: '16px', backgroundColor: '#fff3e0', borderRadius: '8px' }}>
            <div className="font24 fontBold" style={{ color: '#f57c00' }}>{stats.productTags?.featured || 0}</div>
            <div className="font14 grayText">Featured Products</div>
          </div>
          <div className="statCard" style={{ flex: '1', minWidth: '150px', padding: '16px', backgroundColor: '#fce4ec', borderRadius: '8px' }}>
            <div className="font24 fontBold" style={{ color: '#c2185b' }}>{stats.productTags?.hot || 0}</div>
            <div className="font14 grayText">Hot/Trending</div>
          </div>
          <div className="statCard" style={{ flex: '1', minWidth: '150px', padding: '16px', backgroundColor: '#f3e5f5', borderRadius: '8px' }}>
            <div className="font24 fontBold" style={{ color: '#7b1fa2' }}>{stats.productTags?.newArrival || 0}</div>
            <div className="font14 grayText">New Arrivals</div>
          </div>
        </div>
      )}

      {/* Section Form */}
      <div className="brandFormContainer paddingAll32 appendBottom30" ref={formRef}>
        <form onSubmit={handleSubmit} className="brandForm">
          {/* Basic Info */}
          <div className="makeFlex row gap16">
            <div className="flexOne">
              <FormField
                ref={nameInputRef}
                type="text"
                name="name"
                label="Section Name"
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g., Featured Products, New Arrivals"
                required={true}
                info="Display name for this section"
              />
            </div>
            <div className="flexOne">
              <FormField
                type="select"
                name="type"
                label="Section Type"
                value={formData.type}
                onChange={handleChange}
                options={SECTION_TYPES}
                info="Predefined types help with auto-population features"
              />
            </div>
          </div>

          <div className="makeFlex row gap16">
            <div className="fullWidth">
              <FormField
                type="textarea"
                name="description"
                label="Description (Optional)"
                value={formData.description}
                onChange={handleChange}
                placeholder="Internal description for this section"
                rows={2}
              />
            </div>
          </div>

          {/* Status and Limits */}
          <div className="makeFlex row gap16">
            <div className="flexOne">
              <FormField
                type="select"
                name="status"
                label="Status"
                value={formData.status}
                onChange={handleChange}
                options={STATUS_OPTIONS}
              />
            </div>
            <div className="flexOne">
              <FormField
                type="number"
                name="productLimit"
                label="Product Limit"
                value={formData.productLimit}
                onChange={handleChange}
                min={1}
                max={50}
                info="Maximum products to display"
              />
            </div>
            <div className="flexOne">
              <FormField
                type="number"
                name="displayOrder"
                label="Display Order"
                value={formData.displayOrder}
                onChange={handleChange}
                min={0}
                info="Lower numbers appear first"
              />
            </div>
          </div>

          {/* Scheduling */}
          <div className="makeFlex row gap16">
            <div className="flexOne">
              <FormField
                type="date"
                name="startDate"
                label="Start Date (Optional)"
                value={formData.startDate}
                onChange={handleChange}
                info="Section becomes visible from this date"
              />
            </div>
            <div className="flexOne">
              <FormField
                type="date"
                name="endDate"
                label="End Date (Optional)"
                value={formData.endDate}
                onChange={handleChange}
                info="Section hides after this date"
              />
            </div>
          </div>

          {/* Display Configuration */}
          <div className="appendTop16 appendBottom16">
            <h4 className="font16 fontSemiBold appendBottom12">Display Configuration</h4>
            <div className="makeFlex row gap16">
              <div className="flexOne">
                <FormField
                  type="select"
                  name="displayConfig.layoutStyle"
                  label="Layout Style"
                  value={formData.displayConfig.layoutStyle}
                  onChange={handleChange}
                  options={LAYOUT_STYLES}
                />
              </div>
              <div className="flexOne">
                <FormField
                  type="number"
                  name="displayConfig.columns"
                  label="Grid Columns"
                  value={formData.displayConfig.columns}
                  onChange={handleChange}
                  min={1}
                  max={6}
                />
              </div>
            </div>
            <div className="makeFlex row gap16 appendTop12">
              <div className="flexOne">
                <FormField
                  type="color"
                  name="displayConfig.backgroundColor"
                  label="Background Color"
                  value={formData.displayConfig.backgroundColor}
                  onChange={handleChange}
                />
              </div>
              <div className="flexOne">
                <FormField
                  type="color"
                  name="displayConfig.textColor"
                  label="Text Color"
                  value={formData.displayConfig.textColor}
                  onChange={handleChange}
                />
              </div>
              <div className="flexOne">
                <FormField
                  type="text"
                  name="displayConfig.viewAllLink"
                  label="View All Link"
                  value={formData.displayConfig.viewAllLink}
                  onChange={handleChange}
                  placeholder="/products?category=..."
                />
              </div>
            </div>
            <div className="makeFlex row gap16 appendTop12">
              <div className="makeFlex alignCenter gap8">
                <FormField
                  type="checkbox"
                  name="displayConfig.showViewAll"
                  value={formData.displayConfig.showViewAll}
                  onChange={handleChange}
                />
                <label>Show "View All" Button</label>
              </div>
              <div className="makeFlex alignCenter gap8">
                <FormField
                  type="checkbox"
                  name="displayConfig.showProductCount"
                  value={formData.displayConfig.showProductCount}
                  onChange={handleChange}
                />
                <label>Show Product Count</label>
              </div>
              <div className="makeFlex alignCenter gap8">
                <FormField
                  type="checkbox"
                  name="isActive"
                  value={formData.isActive}
                  onChange={handleChange}
                />
                <label>Active</label>
              </div>
            </div>
          </div>

          {/* Selected Products */}
          <div className="appendTop16 appendBottom16">
            <div className="makeFlex spaceBetween alignCenter appendBottom12">
              <h4 className="font16 fontSemiBold">Products ({selectedProducts.length})</h4>
              <button
                type="button"
                className="btnSecondary"
                onClick={openProductModal}
              >
                + Add Products
              </button>
            </div>
            
            {selectedProducts.length > 0 ? (
              <div className="selectedProductsList" style={{ border: '1px solid #e0e0e0', borderRadius: '8px', padding: '12px' }}>
                {selectedProducts.map((product, index) => (
                  <div
                    key={product._id}
                    className="selectedProductItem makeFlex alignCenter spaceBetween"
                    style={{ padding: '8px', borderBottom: index < selectedProducts.length - 1 ? '1px solid #f0f0f0' : 'none' }}
                  >
                    <div className="makeFlex alignCenter gap12">
                      <span className="font14 grayText" style={{ width: '30px' }}>#{index + 1}</span>
                      {product.mainImage && (
                        <img
                          src={product.mainImage.startsWith('http') ? product.mainImage : `http://localhost:8080${product.mainImage}`}
                          alt={product.name}
                          style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px' }}
                        />
                      )}
                      <div>
                        <div className="font14 fontSemiBold">{product.name}</div>
                        <div className="font12 grayText">{product.productId} | ₹{product.price}</div>
                      </div>
                    </div>
                    <div className="makeFlex gap8">
                      <button
                        type="button"
                        className="btnSmall"
                        onClick={() => moveProductInSelection(index, 'up')}
                        disabled={index === 0}
                        style={{ padding: '4px 8px', fontSize: '12px' }}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="btnSmall"
                        onClick={() => moveProductInSelection(index, 'down')}
                        disabled={index === selectedProducts.length - 1}
                        style={{ padding: '4px 8px', fontSize: '12px' }}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className="btnDanger btnSmall"
                        onClick={() => removeProductFromSelection(product._id)}
                        style={{ padding: '4px 8px', fontSize: '12px' }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="emptyState textCenter paddingAll20" style={{ backgroundColor: '#f9f9f9', borderRadius: '8px' }}>
                <p className="grayText">No products selected. Click "Add Products" to select products for this section.</p>
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div className="formActions paddingTop16">
            <button type="submit" disabled={loading} className="btnPrimary">
              {loading ? "Saving..." : (editingId ? "Update Section" : "Create Section")}
            </button>
            {editingId && (
              <button type="button" onClick={handleCancel} className="btnSecondary">
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Sections List */}
      <div className="brandsListContainer paddingAll32">
        <div className="listHeader makeFlex spaceBetween end appendBottom24">
          <div className="leftSection">
            <h2 className="listTitle font30 fontBold blackText appendBottom16">
              Sections ({filteredSections.length})
            </h2>
            <div className="makeFlex gap16 alignCenter">
              <StatusFilter
                statusFilter={statusFilter}
                onStatusChange={setStatusFilter}
                counts={statusCounts}
                disabled={loading}
              />
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="formSelect"
                style={{ padding: '8px 12px', borderRadius: '4px', border: '1px solid #ccc' }}
              >
                <option value="all">All Types</option>
                {SECTION_TYPES.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="rightSection makeFlex end gap10">
            <SearchField
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search sections..."
              disabled={loading}
              minWidth="250px"
            />
            {loading && <div className="loadingIndicator grayText">Loading...</div>}
            <ViewToggle viewMode={viewMode} onViewChange={handleViewModeChange} disabled={loading} />
          </div>
        </div>

        {filteredSections.length === 0 && !loading ? (
          <div className="emptyState textCenter paddingAll60">
            <div className="emptyIcon appendBottom16">📦</div>
            <h3 className="font22 fontSemiBold grayText appendBottom8">No Sections Found</h3>
            <p className="font16 grayText">Create your first homepage section above</p>
          </div>
        ) : (
          <>
            {/* Card View */}
            {viewMode === 'card' && (
              <div className="brandsGrid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                {displayedCards.map((section, index) => (
                  <div
                    key={section._id}
                    className="sectionCard"
                    style={{
                      border: '1px solid #e0e0e0',
                      borderRadius: '12px',
                      overflow: 'hidden',
                      backgroundColor: '#fff',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                    }}
                  >
                    {/* Card Header */}
                    <div
                      style={{
                        padding: '16px',
                        backgroundColor: section.displayConfig?.backgroundColor || '#f5f5f5',
                        borderBottom: '1px solid #e0e0e0',
                      }}
                    >
                      <div className="makeFlex spaceBetween alignCenter">
                        <span
                          className="sectionType font12 fontSemiBold"
                          style={{
                            backgroundColor: getStatusColor(section.status, section.isActive, section.deleted),
                            color: '#fff',
                            padding: '4px 8px',
                            borderRadius: '4px',
                          }}
                        >
                          {getSectionTypeLabel(section.type)}
                        </span>
                        <span className="font12 grayText">Order: {section.displayOrder}</span>
                      </div>
                      <h3 className="font18 fontBold appendTop8" style={{ color: section.displayConfig?.textColor || '#000' }}>
                        {section.name}
                      </h3>
                      {section.description && (
                        <p className="font12 grayText appendTop4">{section.description}</p>
                      )}
                    </div>

                    {/* Card Body */}
                    <div style={{ padding: '16px' }}>
                      <div className="makeFlex spaceBetween appendBottom8">
                        <span className="font14 grayText">Products:</span>
                        <span className="font14 fontSemiBold">{section.productCount || 0} / {section.productLimit}</span>
                      </div>
                      <div className="makeFlex spaceBetween appendBottom8">
                        <span className="font14 grayText">Layout:</span>
                        <span className="font14">{section.displayConfig?.layoutStyle || 'grid'}</span>
                      </div>
                      <div className="makeFlex spaceBetween appendBottom8">
                        <span className="font14 grayText">Status:</span>
                        <span
                          className="font14 fontSemiBold"
                          style={{ color: getStatusColor(section.status, section.isActive, section.deleted) }}
                        >
                          {section.deleted ? 'Deleted' : (section.isActive ? section.status : 'Inactive')}
                        </span>
                      </div>
                      {(section.startDate || section.endDate) && (
                        <div className="makeFlex spaceBetween appendBottom8">
                          <span className="font14 grayText">Schedule:</span>
                          <span className="font12">
                            {formatDate(section.startDate)} - {formatDate(section.endDate)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Card Actions */}
                    <div style={{ padding: '12px 16px', borderTop: '1px solid #f0f0f0', backgroundColor: '#fafafa' }}>
                      <div className="makeFlex gap8 flexWrap">
                        {!section.deleted && (
                          <>
                            <button
                              className="btnSmall btnSecondary"
                              onClick={() => handleEdit(section)}
                              disabled={loading}
                              style={{ fontSize: '12px', padding: '6px 10px' }}
                            >
                              ✏️ Edit
                            </button>
                            <button
                              className="btnSmall btnSecondary"
                              onClick={() => handlePreview(section)}
                              disabled={loading}
                              style={{ fontSize: '12px', padding: '6px 10px' }}
                            >
                              👁️ Preview
                            </button>
                            <button
                              className="btnSmall"
                              onClick={() => handleToggleStatus(section._id)}
                              disabled={loading}
                              style={{
                                fontSize: '12px',
                                padding: '6px 10px',
                                backgroundColor: section.isActive ? '#ffc107' : '#28a745',
                                color: '#fff',
                                border: 'none',
                              }}
                            >
                              {section.isActive ? '⏸️' : '▶️'}
                            </button>
                            {section.status !== 'active' && (
                              <button
                                className="btnSmall btnPrimary"
                                onClick={() => handlePublish(section._id)}
                                disabled={loading}
                                style={{ fontSize: '12px', padding: '6px 10px' }}
                              >
                                🚀 Publish
                              </button>
                            )}
                            <button
                              className="btnSmall"
                              onClick={() => handleMoveSection(section._id, 'up')}
                              disabled={loading || index === 0}
                              style={{ fontSize: '12px', padding: '6px 10px' }}
                            >
                              ↑
                            </button>
                            <button
                              className="btnSmall"
                              onClick={() => handleMoveSection(section._id, 'down')}
                              disabled={loading || index === displayedCards.length - 1}
                              style={{ fontSize: '12px', padding: '6px 10px' }}
                            >
                              ↓
                            </button>
                          </>
                        )}
                        <button
                          className="btnSmall btnDanger"
                          onClick={() => section.deleted ? handleDelete(section._id) : handleDelete(section._id)}
                          disabled={loading}
                          style={{ fontSize: '12px', padding: '6px 10px' }}
                        >
                          🗑️
                        </button>
                        {section.deleted && (
                          <button
                            className="btnSmall"
                            onClick={() => handleRestore(section._id)}
                            disabled={loading}
                            style={{ fontSize: '12px', padding: '6px 10px', backgroundColor: '#17a2b8', color: '#fff', border: 'none' }}
                          >
                            🔄 Restore
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Load More for Card View */}
            {viewMode === 'card' && hasMoreCards && (
              <div className="loadMoreContainer textCenter paddingAll20">
                <button onClick={handleLoadMoreCards} className="btnPrimary" disabled={loading}>
                  {loading ? "Loading..." : "Load More"}
                </button>
              </div>
            )}

            {/* List View */}
            {viewMode === 'list' && (
              <div className="brandsListTable">
                <div className="tableContainer" style={{ overflowX: 'auto' }}>
                  <table className="brandsTable" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f5f5f5' }}>
                        <th className="tableHeader" style={{ padding: '12px', textAlign: 'left' }}>Order</th>
                        <th className="tableHeader" style={{ padding: '12px', textAlign: 'left' }}>Name</th>
                        <th className="tableHeader" style={{ padding: '12px', textAlign: 'left' }}>Type</th>
                        <th className="tableHeader" style={{ padding: '12px', textAlign: 'left' }}>Products</th>
                        <th className="tableHeader" style={{ padding: '12px', textAlign: 'left' }}>Layout</th>
                        <th className="tableHeader" style={{ padding: '12px', textAlign: 'left' }}>Schedule</th>
                        <th className="tableHeader" style={{ padding: '12px', textAlign: 'left' }}>Status</th>
                        <th className="tableHeader" style={{ padding: '12px', textAlign: 'left' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentSections.map((section) => (
                        <tr key={section._id} style={{ borderBottom: '1px solid #e0e0e0' }}>
                          <td style={{ padding: '12px' }}>{section.displayOrder}</td>
                          <td style={{ padding: '12px' }}>
                            <div className="font14 fontSemiBold">{section.name}</div>
                            <div className="font12 grayText">{section.sectionId}</div>
                          </td>
                          <td style={{ padding: '12px' }}>{getSectionTypeLabel(section.type)}</td>
                          <td style={{ padding: '12px' }}>{section.productCount || 0} / {section.productLimit}</td>
                          <td style={{ padding: '12px' }}>{section.displayConfig?.layoutStyle || 'grid'}</td>
                          <td style={{ padding: '12px' }}>
                            {section.startDate || section.endDate ? (
                              <span className="font12">
                                {formatDate(section.startDate)} - {formatDate(section.endDate)}
                              </span>
                            ) : '-'}
                          </td>
                          <td style={{ padding: '12px' }}>
                            <span
                              style={{
                                backgroundColor: getStatusColor(section.status, section.isActive, section.deleted),
                                color: '#fff',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '12px',
                              }}
                            >
                              {section.deleted ? 'Deleted' : (section.isActive ? section.status : 'Inactive')}
                            </span>
                          </td>
                          <td style={{ padding: '12px' }}>
                            <ActionButtons
                              onEdit={section.deleted ? undefined : () => handleEdit(section)}
                              onDelete={() => handleDelete(section._id)}
                              onRevert={section.deleted ? () => handleRestore(section._id) : undefined}
                              loading={loading}
                              size="small"
                              editText="✏️"
                              deleteText="🗑️"
                              revertText="🔄"
                              editDisabled={section.deleted}
                            />
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

      {/* Product Selection Modal */}
      {showProductModal && (
        <div
          className="modalOverlay"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={closeProductModal}
        >
          <div
            className="modalContent"
            style={{
              backgroundColor: '#fff',
              borderRadius: '12px',
              width: '90%',
              maxWidth: '800px',
              maxHeight: '80vh',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ padding: '20px', borderBottom: '1px solid #e0e0e0' }}>
              <div className="makeFlex spaceBetween alignCenter">
                <h3 className="font20 fontBold">Select Products</h3>
                <button
                  onClick={closeProductModal}
                  style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }}
                >
                  ×
                </button>
              </div>
              <div className="appendTop12">
                <input
                  type="text"
                  value={productSearchQuery}
                  onChange={handleProductSearch}
                  placeholder="Search products by name, ID, or SKU..."
                  style={{
                    width: '100%',
                    padding: '10px 16px',
                    border: '1px solid #e0e0e0',
                    borderRadius: '8px',
                    fontSize: '14px',
                  }}
                />
              </div>
            </div>

            {/* Modal Body */}
            <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
              {productLoading ? (
                <div className="textCenter paddingAll20">Loading products...</div>
              ) : availableProducts.length === 0 ? (
                <div className="textCenter paddingAll20 grayText">No products found</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
                  {availableProducts.map((product) => {
                    const isSelected = selectedProducts.some(p => p._id === product._id);
                    return (
                      <div
                        key={product._id}
                        style={{
                          border: `2px solid ${isSelected ? '#007bff' : '#e0e0e0'}`,
                          borderRadius: '8px',
                          padding: '12px',
                          cursor: 'pointer',
                          backgroundColor: isSelected ? '#e3f2fd' : '#fff',
                          transition: 'all 0.2s',
                        }}
                        onClick={() => isSelected ? removeProductFromSelection(product._id) : addProductToSelection(product)}
                      >
                        <div className="makeFlex gap12 alignCenter">
                          {product.mainImage && (
                            <img
                              src={product.mainImage.startsWith('http') ? product.mainImage : `http://localhost:8080${product.mainImage}`}
                              alt={product.name}
                              style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '4px' }}
                            />
                          )}
                          <div style={{ flex: 1 }}>
                            <div className="font14 fontSemiBold" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {product.name}
                            </div>
                            <div className="font12 grayText">{product.productId}</div>
                            <div className="font14 fontSemiBold" style={{ color: '#28a745' }}>
                              ₹{product.discountedPrice || product.price}
                            </div>
                          </div>
                          {isSelected && (
                            <span style={{ color: '#007bff', fontSize: '20px' }}>✓</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Product Pagination */}
              {productPagination && productPagination.pages > 1 && (
                <div className="makeFlex justifyCenter gap8 appendTop20">
                  <button
                    onClick={() => handleProductPageChange(productPage - 1)}
                    disabled={productPage === 1 || productLoading}
                    className="btnSmall btnSecondary"
                  >
                    Prev
                  </button>
                  <span className="font14">
                    Page {productPage} of {productPagination.pages}
                  </span>
                  <button
                    onClick={() => handleProductPageChange(productPage + 1)}
                    disabled={productPage === productPagination.pages || productLoading}
                    className="btnSmall btnSecondary"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '16px 20px', borderTop: '1px solid #e0e0e0', backgroundColor: '#f9f9f9' }}>
              <div className="makeFlex spaceBetween alignCenter">
                <span className="font14">{selectedProducts.length} products selected</span>
                <div className="makeFlex gap12">
                  <button onClick={closeProductModal} className="btnSecondary">
                    Cancel
                  </button>
                  <button onClick={closeProductModal} className="btnPrimary">
                    Done
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreview && previewSection && (
        <div
          className="modalOverlay"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={closePreview}
        >
          <div
            className="modalContent"
            style={{
              backgroundColor: '#fff',
              borderRadius: '12px',
              width: '95%',
              maxWidth: '1200px',
              maxHeight: '90vh',
              overflow: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Preview Header */}
            <div style={{ padding: '20px', borderBottom: '1px solid #e0e0e0' }}>
              <div className="makeFlex spaceBetween alignCenter">
                <h3 className="font20 fontBold">Preview: {previewSection.name}</h3>
                <button
                  onClick={closePreview}
                  style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }}
                >
                  ×
                </button>
              </div>
            </div>

            {/* Preview Content */}
            <div
              style={{
                padding: '40px',
                backgroundColor: previewSection.displayConfig?.backgroundColor || '#f5f5f5',
              }}
            >
              <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                {/* Section Title */}
                <div className="makeFlex spaceBetween alignCenter appendBottom24">
                  <h2
                    className="font28 fontBold"
                    style={{ color: previewSection.displayConfig?.textColor || '#000' }}
                  >
                    {previewSection.name}
                  </h2>
                  {previewSection.displayConfig?.showViewAll && (
                    <a
                      href={previewSection.displayConfig?.viewAllLink || '#'}
                      style={{ color: '#007bff', textDecoration: 'none' }}
                    >
                      View All →
                    </a>
                  )}
                </div>

                {/* Products Grid */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${previewSection.displayConfig?.columns || 4}, 1fr)`,
                    gap: '20px',
                  }}
                >
                  {(previewSection.products || [])
                    .filter(p => p.product)
                    .slice(0, previewSection.productLimit)
                    .map((item) => (
                      <div
                        key={item.product._id}
                        style={{
                          backgroundColor: '#fff',
                          borderRadius: '8px',
                          overflow: 'hidden',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                        }}
                      >
                        <div style={{ aspectRatio: '1', backgroundColor: '#f0f0f0', position: 'relative' }}>
                          {item.product.mainImage ? (
                            <img
                              src={item.product.mainImage.startsWith('http') ? item.product.mainImage : `http://localhost:8080${item.product.mainImage}`}
                              alt={item.product.name}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          ) : (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              No Image
                            </div>
                          )}
                          {item.product.homepageTags?.hot && (
                            <span
                              style={{
                                position: 'absolute',
                                top: '8px',
                                left: '8px',
                                backgroundColor: '#dc3545',
                                color: '#fff',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '10px',
                                fontWeight: 'bold',
                              }}
                            >
                              HOT
                            </span>
                          )}
                        </div>
                        <div style={{ padding: '12px' }}>
                          <h4 className="font14 fontSemiBold" style={{ marginBottom: '4px' }}>
                            {item.product.name}
                          </h4>
                          <div className="makeFlex alignCenter gap8">
                            <span className="font16 fontBold" style={{ color: '#28a745' }}>
                              ₹{item.product.discountedPrice || item.product.price}
                            </span>
                            {item.product.discountedPrice && item.product.discountedPrice < item.product.price && (
                              <span className="font12 grayText" style={{ textDecoration: 'line-through' }}>
                                ₹{item.product.price}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>

                {(!previewSection.products || previewSection.products.filter(p => p.product).length === 0) && (
                  <div className="textCenter paddingAll40" style={{ color: previewSection.displayConfig?.textColor || '#666' }}>
                    <p>No products in this section</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Popup */}
      <DeleteConfirmationPopup
        isVisible={deletePopup.isVisible}
        message={deletePopup.message}
        onConfirm={deletePopup.action === "restore" ? handleRestoreConfirm : handleDeleteConfirm}
        onCancel={() => setDeletePopup({ isVisible: false, sectionId: null, message: "", isPermanentDelete: false, action: "delete" })}
        confirmText={deletePopup.action === "restore" ? "Restore" : (deletePopup.isPermanentDelete ? "Delete Forever" : "Delete")}
        cancelText="Cancel"
        loading={loading}
      />
    </div>
  );
};

export default HomepageSectionManager;
