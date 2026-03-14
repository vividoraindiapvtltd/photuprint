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

// 216 web-safe colors (6 levels per channel: 00, 33, 66, 99, CC, FF) – first row = first 18
const WEB_SAFE_HEX = (() => {
  const levels = ["00", "33", "66", "99", "CC", "FF"];
  const out = [];
  for (const r of levels) for (const g of levels) for (const b of levels) out.push(`#${r}${g}${b}`);
  return out;
})();

// Web-safe hex to display name (for Color Name field when picking from palette)
const WEB_SAFE_NAMES = {
  "#000000": "Black", "#003300": "Dark Green", "#006600": "Green", "#009900": "Green", "#00CC00": "Lime", "#00FF00": "Lime",
  "#330000": "Dark Maroon", "#333300": "Dark Olive", "#336600": "Olive", "#339900": "Olive", "#33CC00": "Lime", "#33FF00": "Lime",
  "#660000": "Maroon", "#663300": "Brown", "#666600": "Olive", "#669900": "Olive", "#66CC00": "Lime", "#66FF00": "Lime",
  "#990000": "Red", "#993300": "Orange", "#996600": "Olive", "#999900": "Yellow", "#99CC00": "Lime", "#99FF00": "Lime",
  "#CC0000": "Red", "#CC3300": "Orange", "#CC6600": "Orange", "#CC9900": "Gold", "#CCCC00": "Yellow", "#CCFF00": "Lime",
  "#FF0000": "Red", "#FF3300": "Orange", "#FF6600": "Orange", "#FF9900": "Orange", "#FFCC00": "Gold", "#FFFF00": "Yellow",
  "#000033": "Navy", "#003333": "Teal", "#006633": "Green", "#009933": "Green", "#00CC33": "Green", "#00FF33": "Lime",
  "#333333": "Gray", "#336633": "Olive", "#339933": "Green", "#33CC33": "Green", "#33FF33": "Lime",
  "#666633": "Olive", "#669933": "Green", "#66CC33": "Green", "#66FF33": "Lime",
  "#999933": "Yellow", "#99CC33": "Green", "#99FF33": "Lime",
  "#CC9933": "Gold", "#CCCC33": "Yellow", "#CCFF33": "Lime",
  "#FF9933": "Orange", "#FFCC33": "Gold", "#FFFF33": "Yellow",
  "#000066": "Navy", "#003366": "Navy", "#006666": "Teal", "#009966": "Teal", "#00CC66": "Green", "#00FF66": "Spring Green",
  "#330066": "Purple", "#333366": "Navy", "#336666": "Teal", "#339966": "Teal", "#33CC66": "Green", "#33FF66": "Spring Green",
  "#660066": "Purple", "#663366": "Purple", "#666666": "Gray", "#669966": "Gray", "#66CC66": "Green", "#66FF66": "Spring Green",
  "#990066": "Purple", "#993366": "Brown", "#996666": "Gray", "#999966": "Olive", "#99CC66": "Green", "#99FF66": "Spring Green",
  "#CC0066": "Red", "#CC3366": "Red", "#CC6666": "Gray", "#CC9966": "Tan", "#CCCC66": "Yellow", "#CCFF66": "Lime",
  "#FF0066": "Pink", "#FF3366": "Red", "#FF6666": "Red", "#FF9966": "Orange", "#FFCC66": "Gold", "#FFFF66": "Yellow",
  "#000099": "Navy", "#003399": "Blue", "#006699": "Blue", "#009999": "Cyan", "#00CC99": "Green", "#00FF99": "Spring Green",
  "#330099": "Purple", "#333399": "Navy", "#336699": "Blue", "#339999": "Teal", "#33CC99": "Green", "#33FF99": "Spring Green",
  "#660099": "Purple", "#663399": "Purple", "#666699": "Slate", "#669999": "Teal", "#66CC99": "Green", "#66FF99": "Spring Green",
  "#990099": "Magenta", "#993399": "Purple", "#996699": "Gray", "#999999": "Gray", "#99CC99": "Green", "#99FF99": "Mint",
  "#CC0099": "Magenta", "#CC3399": "Pink", "#CC6699": "Pink", "#CC9999": "Tan", "#CCCC99": "Beige", "#CCFF99": "Mint",
  "#FF0099": "Magenta", "#FF3399": "Pink", "#FF6699": "Pink", "#FF9999": "Salmon", "#FFCC99": "Peach", "#FFFF99": "Yellow",
  "#0000CC": "Blue", "#0033CC": "Blue", "#0066CC": "Blue", "#0099CC": "Blue", "#00CCCC": "Cyan", "#00FFCC": "Cyan",
  "#3300CC": "Blue", "#3333CC": "Blue", "#3366CC": "Blue", "#3399CC": "Blue", "#33CCCC": "Cyan", "#33FFCC": "Cyan",
  "#6600CC": "Purple", "#6633CC": "Purple", "#6666CC": "Blue", "#6699CC": "Blue", "#66CCCC": "Cyan", "#66FFCC": "Cyan",
  "#9900CC": "Purple", "#9933CC": "Purple", "#9966CC": "Purple", "#9999CC": "Gray", "#99CCCC": "Cyan", "#99FFCC": "Mint",
  "#CC00CC": "Magenta", "#CC33CC": "Magenta", "#CC66CC": "Pink", "#CC99CC": "Pink", "#CCCCCC": "Silver", "#CCFFCC": "Mint",
  "#FF00CC": "Magenta", "#FF33CC": "Pink", "#FF66CC": "Pink", "#FF99CC": "Pink", "#FFCCCC": "Pink", "#FFFFCC": "Cream",
  "#0000FF": "Blue", "#0033FF": "Blue", "#0066FF": "Blue", "#0099FF": "Blue", "#00CCFF": "Cyan", "#00FFFF": "Cyan",
  "#3300FF": "Blue", "#3333FF": "Blue", "#3366FF": "Blue", "#3399FF": "Blue", "#33CCFF": "Cyan", "#33FFFF": "Cyan",
  "#6600FF": "Blue", "#6633FF": "Blue", "#6666FF": "Blue", "#6699FF": "Blue", "#66CCFF": "Cyan", "#66FFFF": "Cyan",
  "#9900FF": "Purple", "#9933FF": "Purple", "#9966FF": "Purple", "#9999FF": "Lavender", "#99CCFF": "Light Blue", "#99FFFF": "Cyan",
  "#CC00FF": "Magenta", "#CC33FF": "Magenta", "#CC66FF": "Purple", "#CC99FF": "Lavender", "#CCCCFF": "Lavender", "#CCFFFF": "Cyan",
  "#FF00FF": "Magenta", "#FF33FF": "Magenta", "#FF66FF": "Pink", "#FF99FF": "Pink", "#FFCCFF": "Pink", "#FFFFFF": "White",
};

const ColorManager = () => {
  const [colors, setColors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [viewMode, setViewMode] = useState('card'); // 'card' or 'list'
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'active', 'inactive', 'deleted'
  
  // Delete confirmation popup state
  const [deletePopup, setDeletePopup] = useState({
    isVisible: false,
    colorId: null,
    message: "",
    isPermanentDelete: false,
    action: "delete" // "delete" or "revert"
  });
  
  // Refs for scroll and focus functionality
  const formRef = useRef(null);
  const colorNameInputRef = useRef(null);
  const imageInputRef = useRef(null);
  
  // Image popup state
  const [imagePopup, setImagePopup] = useState({
    isVisible: false,
    imageUrl: null
  });
  
  // Pagination and lazy loading states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10); // For list view
  const [hasMoreCards, setHasMoreCards] = useState(true);
  const [displayedCards, setDisplayedCards] = useState([]);
  
  const initialFormData = {
    name: "",
    code: "",
    image: null,
    isActive: false
  };

  const [formData, setFormData] = useState(initialFormData);
  const [currentImageUrl, setCurrentImageUrl] = useState(null); // Track current image URL separately
  const [searchQuery, setSearchQuery] = useState(""); // Search query state
  const [colorPaletteOpen, setColorPaletteOpen] = useState(false);

  // Validate image dimensions (max 1200x1200px)
  const validateImageDimensions = (file) => {
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

      const img = new Image();
      const objectUrl = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        const maxDimension = 1200;
        
        if (img.width > maxDimension || img.height > maxDimension) {
          resolve({ 
            isValid: false, 
            error: `Image dimensions (${img.width}x${img.height}px) exceed the maximum allowed size of ${maxDimension}x${maxDimension}px. Please resize your image.` 
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

  // Helper function to normalize image URL
  const normalizeImageUrl = (imageUrl) => {
    if (!imageUrl) return null;
    
    // If it's already a Cloudinary URL (starts with http/https), check for system paths
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      // Check if it's a system path incorrectly formatted
      if (imageUrl.includes('/backend/uploads/') || imageUrl.includes('/Users/')) {
        // Extract filename from system path
        const filename = imageUrl.split('/').pop();
        return `http://localhost:8080/uploads/${filename}`;
      }
      // Otherwise it's a valid Cloudinary URL, return as is
      return imageUrl;
    }
    
    // Handle old system paths that might be stored incorrectly
    if (imageUrl.includes('/backend/uploads/') || imageUrl.includes('/Users/')) {
      // Extract filename from system path
      const filename = imageUrl.split('/').pop();
      return `http://localhost:8080/uploads/${filename}`;
    }
    
    // Handle relative paths
    if (imageUrl.startsWith('/uploads/') || imageUrl.startsWith('/')) {
      return `http://localhost:8080${imageUrl}`;
    }
    
    // Relative path without leading slash
    return `http://localhost:8080/uploads/${imageUrl}`;
  };

  // Fetch colors from backend
  const fetchColors = async () => {
    try {
      setLoading(true);
      const response = await api.get('/colors?showInactive=true&includeDeleted=true');
      
      // Process colors to ensure proper image URLs
      const processedColors = response.data.map(color => {
        let imageUrl = color.image;
        
        if (imageUrl) {
          // Use normalizeImageUrl to handle all URL formats
          imageUrl = normalizeImageUrl(imageUrl);
        }
        
        return {
          ...color,
          image: imageUrl
        };
      });
      
      setColors(processedColors);
      setError("");
    } catch (err) {
      setError("Failed to fetch colors");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchColors();
  }, []);

  // Filter colors based on search query and status - memoized to prevent infinite loops
  const filteredColors = useMemo(() => {
    let filtered = colors;
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(color => 
        color.name.toLowerCase().includes(query) ||
        (color.code && color.code.toLowerCase().includes(query))
      );
    }
    
    // Apply status filter
    filtered = filterEntitiesByStatus(filtered, statusFilter);
    
    return filtered;
  }, [colors, searchQuery, statusFilter]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredColors.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentColors = filteredColors.slice(startIndex, endIndex);

  // Card lazy loading logic
  useEffect(() => {
    if (viewMode === 'card' && filteredColors.length > 0) {
      const initialCards = filteredColors.slice(0, 12);
      setDisplayedCards(initialCards);
      setHasMoreCards(filteredColors.length > 12);
      setCurrentPage(1);
    }
  }, [filteredColors, viewMode]);

  // Reset pagination when search query changes
  useEffect(() => {
    setCurrentPage(1);
    if (viewMode === 'card') {
      const initialCards = filteredColors.slice(0, 12);
      setDisplayedCards(initialCards);
      setHasMoreCards(filteredColors.length > 12);
    }
  }, [searchQuery, viewMode, filteredColors]);

  // Handle page change for list view
  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Handle lazy loading for card view
  const handleLoadMoreCards = () => {
    const currentCardCount = displayedCards.length;
    const nextCards = filteredColors.slice(currentCardCount, currentCardCount + 12);
    
    if (nextCards.length > 0) {
      setDisplayedCards([...displayedCards, ...nextCards]);
      setHasMoreCards(currentCardCount + nextCards.length < filteredColors.length);
    } else {
      setHasMoreCards(false);
    }
  };

  // Reset pagination when view mode changes
  const handleViewModeChange = (mode) => {
    setViewMode(mode);
    setCurrentPage(1);
    if (mode === 'card') {
      const initialCards = filteredColors.slice(0, 12);
      setDisplayedCards(initialCards);
      setHasMoreCards(filteredColors.length > 12);
    }
  };

  const handleChange = async (e) => {
    const { name, value, type, checked, files } = e.target;
    
    if (type === 'checkbox') {
      setFormData({ ...formData, [name]: checked });
    } else if (type === 'file') {
      // Validate image dimensions if it's an image file
      if (files[0] && files[0].type.startsWith('image/')) {
        const validation = await validateImageDimensions(files[0]);
        if (!validation.isValid) {
          setError(validation.error);
          // Clear the file input
          e.target.value = '';
          return;
        }
      }
      
      setFormData({ ...formData, [name]: files[0] || null });
      // Clear any previous error if validation passes
      if (error && error.includes('dimensions')) {
        setError("");
      }
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const resetForm = () => {
    setFormData(initialFormData);
    setCurrentImageUrl(null);
    setEditingId(null);
    setError("");
    // Clear file input
    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
    // Don't clear success message here - let AlertMessage handle it
    // setSuccess("");
  };

  // Clear form after successful operations
  const clearForm = () => {
    setFormData(initialFormData);
    setCurrentImageUrl(null);
    setEditingId(null);
    setError("");
    setSuccess("");
    // Clear file input
    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      setError("Color Name is required");
      return;
    }

    try {
      setLoading(true);
      setSuccess(""); // Clear any existing success message
      setError(""); // Clear any existing error message

      let colorData;
      
      // Check if image is a File object (not a string URL from existing image)
      const hasNewImage = formData.image && formData.image instanceof File;
      
      if (hasNewImage) {
        // Use FormData for file upload
        colorData = new FormData();
        colorData.append('name', formData.name.trim());
        if (formData.code && formData.code.trim()) colorData.append('code', formData.code.trim());
        colorData.append('isActive', formData.isActive ? 'true' : 'false');
        colorData.append('image', formData.image);
      } else {
        // Use JSON for better boolean handling
        colorData = {
          name: formData.name.trim(),
          code: (formData.code && formData.code.trim()) ? formData.code.trim() : null,
          isActive: formData.isActive,
          // If editing and no new image, send null to remove image, or keep existing
          image: editingId && !currentImageUrl ? null : (currentImageUrl || null)
        };
      }

      if (editingId) {
        // Update color
        await api.put(`/colors/${editingId}`, colorData);
        setSuccess(`✅ Color "${formData.name.trim()}" has been updated successfully!`);
      } else {
        // Create color
        await api.post('/colors', colorData);
        setSuccess(`✅ Color "${formData.name.trim()}" has been created successfully!`);
      }

      // Refresh colors list
      await fetchColors();
      
      // Reset form after successful submission (for both add and edit)
      resetForm();
      
    } catch (err) {
      const action = editingId ? "update" : "create";
      setError(err.response?.data?.msg || `Failed to ${action} color. Please try again.`);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (color) => {
    setFormData({
      ...initialFormData,
      name: color.name || "",
      code: color.code || "#000000",
      image: null, // Reset image field for new file selection
      isActive: color.isActive !== undefined ? color.isActive : false
    });
    // Only set currentImageUrl if color has a valid image
    const imageUrl = color.image && color.image.trim && color.image.trim() !== '' 
      ? normalizeImageUrl(color.image) 
      : null;
    setCurrentImageUrl(imageUrl && imageUrl.trim() !== '' ? imageUrl : null);
    setEditingId(color._id);
    setError("");
    setSuccess("");
    
    // Scroll to form and focus on color name input
    setTimeout(() => {
      if (formRef.current) {
        formRef.current.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start' 
        });
      }
      if (colorNameInputRef.current) {
        colorNameInputRef.current.focus();
      }
    }, 100);
  };

  // Handle remove image
  const handleRemoveImage = () => {
    setFormData({ ...formData, image: null });
    setCurrentImageUrl(null);
    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
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

  const handleDelete = (colorId) => {
    // Find the color to check if it's already marked as deleted
    const color = colors.find(c => c._id === colorId);
    const isAlreadyDeleted = color?.deleted;
    
    let message;
    let isPermanentDelete = false;
    
    if (isAlreadyDeleted) {
      message = "This color is already marked as deleted. Click OK to permanently remove it from the database. This action cannot be undone.";
      isPermanentDelete = true;
    } else {
      message = "This will mark the color as inactive and add a deleted flag. Click OK to continue.";
      isPermanentDelete = false;
    }
    
    setDeletePopup({
      isVisible: true,
      colorId,
      message,
      isPermanentDelete,
      action: "delete"
    });
  };

  // Handle delete confirmation
  const handleDeleteConfirm = async () => {
    const { colorId, isPermanentDelete } = deletePopup;
    const color = colors.find(c => c._id === colorId);
    
    try {
      setLoading(true);
      setSuccess(""); // Clear any existing success message
      setError(""); // Clear any existing error message
      
      if (isPermanentDelete) {
        // Permanent deletion
        await api.delete(`/colors/${colorId}/hard`);
        setSuccess(`🗑️ Color "${color.name}" has been permanently deleted from the database.`);
      } else {
        // Soft delete - mark as inactive and add deleted flag
        await api.delete(`/colors/${colorId}`);
        setSuccess(`⏸️ Color "${color.name}" has been marked as deleted and inactive.`);
      }
      
      await fetchColors();
    } catch (err) {
      const action = isPermanentDelete ? "permanently delete" : "mark as deleted";
      setError(`❌ Failed to ${action} color "${color.name}". ${err.response?.data?.msg || 'Please try again.'}`);
    } finally {
      setLoading(false);
      setDeletePopup({
        isVisible: false,
        colorId: null,
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
      colorId: null,
      message: "",
      isPermanentDelete: false,
      action: "delete"
    });
  };

  // Revert deleted color
  const handleRevert = async (colorId) => {
    const color = colors.find(c => c._id === colorId);
    
    if (!color) {
      setError("Color not found");
      return;
    }

    if (!color.deleted) {
      setError("This color is not deleted");
      return;
    }

    setDeletePopup({
      isVisible: true,
      colorId,
      message: `Are you sure you want to restore the color "${color.name}"? This will make it active again.`,
      isPermanentDelete: false,
      action: "revert"
    });
  };

  // Handle revert confirmation
  const handleRevertConfirm = async () => {
    const { colorId } = deletePopup;
    const color = colors.find(c => c._id === colorId);
    
    try {
      setLoading(true);
      setSuccess("");
      setError("");

      // Check if there's already an active or inactive color with the same name
      const existingColor = colors.find(c => 
        c._id !== colorId && // Exclude current color being reverted
        c.name.toLowerCase().trim() === color.name.toLowerCase().trim() && // Same name
        !c.deleted // Not deleted (active or inactive)
      );

      if (existingColor) {
        const status = existingColor.isActive ? 'Active' : 'Inactive';
        const suggestion = existingColor.isActive ? 
          `Consider deleting the active color "${existingColor.name}" first, or use a different name for the restored color.` :
          `Consider deleting the inactive color "${existingColor.name}" first, or use a different name for the restored color.`;
        
        setError(`❌ Cannot restore color "${color.name}". A ${status.toLowerCase()} color with this name already exists. ${suggestion}`);
        setLoading(false);
        setDeletePopup({
          isVisible: false,
          colorId: null,
          message: "",
          isPermanentDelete: false,
          action: "delete"
        });
        return;
      }

      // Revert the color by setting deleted to false and isActive to true
      await api.put(`/colors/${colorId}`, {
        name: color.name,
        code: color.code,
        isActive: true,
        deleted: false
      });

      setSuccess(`✅ Color "${color.name}" has been restored and is now active!`);
      await fetchColors();
    } catch (err) {
      setError(`❌ Failed to restore color "${color.name}". ${err.response?.data?.msg || 'Please try again.'}`);
    } finally {
      setLoading(false);
      setDeletePopup({
        isVisible: false,
        colorId: null,
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
      colorId: null,
      message: "",
      isPermanentDelete: false,
      action: "delete"
    });
  };

  const handleCancel = () => {
    resetForm();
  };

  // Get status information for display
  const getStatusInfo = (color) => {
    if (color.deleted) {
      return { text: 'Deleted', className: 'deleted' };
    }
    return color.isActive 
      ? { text: 'Active', className: 'active' } 
      : { text: 'Inactive', className: 'inactive' };
  };

  return (
    <div className="paddingAll20">
      {/* Header */}
      <PageHeader
        title="Color Management"
        subtitle="Manage your product colors and variants"
        isEditing={!!editingId}
        editText="Edit Color"
        createText="Add New Color"
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

      {/* Color Form */}
      <div className="brandFormContainer paddingAll32 appendBottom30" ref={formRef}>
        <form onSubmit={handleSubmit} className="brandForm">
          <div className="makeFlex row gap10">
            <div className="fullWidth">
              <FormField
                ref={colorNameInputRef}
                type="text"
                name="name"
                label="Color Name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Enter Color Name (e.g., Black)"
                required={true}
              />
            </div>
          </div>

          <div className="makeFlex row gap10">
            <div className="fullWidth">
              <label className="formLabel font14 fontSemiBold blackText" style={{ display: "block", marginBottom: "6px" }}>Color Code (optional)</label>
              <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", flexWrap: "nowrap" }}>
                <div style={{ flexShrink: 0, position: "relative" }}>
                  <button
                    type="button"
                    onClick={() => setColorPaletteOpen((open) => !open)}
                    title="Open web-safe color palette"
                    style={{
                      width: "44px",
                      height: "38px",
                      padding: "2px",
                      border: "1px solid #ced4da",
                      borderRadius: "6px",
                      backgroundColor: (formData.code && /^#[0-9A-Fa-f]{6}$/.test(formData.code.trim())) ? formData.code.trim() : "#f0f0f0",
                      cursor: "pointer",
                      display: "block",
                    }}
                  />
                  {colorPaletteOpen && (
                    <div
                      style={{
                        position: "absolute",
                        left: 0,
                        top: "100%",
                        zIndex: 1000,
                        marginTop: "4px",
                        display: "grid",
                        gridTemplateColumns: "repeat(18, 12px)",
                        gap: "2px",
                        padding: "8px",
                        border: "1px solid #ced4da",
                        borderRadius: "6px",
                        backgroundColor: "#fff",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                        maxHeight: "160px",
                        overflow: "auto",
                      }}
                    >
                      {WEB_SAFE_HEX.map((hex) => (
                        <button
                          key={hex}
                          type="button"
                          onClick={() => {
                            const name = WEB_SAFE_NAMES[hex] || hex;
                            setFormData((prev) => ({ ...prev, code: hex, name }));
                            setColorPaletteOpen(false);
                          }}
                          title={`${WEB_SAFE_NAMES[hex] || hex} ${hex}`}
                          style={{
                            width: "12px",
                            height: "12px",
                            padding: 0,
                            border: formData.code && formData.code.trim().toUpperCase() === hex ? "2px solid #333" : "1px solid #dee2e6",
                            borderRadius: "2px",
                            backgroundColor: hex,
                            cursor: "pointer",
                            minWidth: "12px",
                            minHeight: "12px",
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ flex: "1", minWidth: "140px" }}>
                  <FormField
                    type="text"
                    name="code"
                    label=""
                    value={formData.code}
                    onChange={handleChange}
                    placeholder="Or enter hex (e.g., #000000)"
                    required={false}
                    info="Click the color box to open web-safe palette; picked color name appears in Color Name"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="makeFlex row gap10">
            <div className="fullWidth">
              <FormField 
                ref={imageInputRef}
                type="file" 
                name="image" 
                label="Color Image" 
                onChange={handleChange} 
                accept="image/*" 
                info="Supported formats: JPG, PNG, GIF, WEBP (Max size: 5MB, Max dimensions: 1200x1200px)" 
              />
              {/* Show current image if editing and image exists */}
              {editingId && currentImageUrl && typeof currentImageUrl === 'string' && currentImageUrl.trim() !== '' && currentImageUrl !== 'null' && currentImageUrl !== 'undefined' && currentImageUrl.length > 0 && (
                <div className="currentImageInfo paddingTop8">
                  <p className="font14 textUppercase blackText fontSemiBold" style={{ marginBottom: '10px' }}>Current image:</p>
                  <img
                    src={currentImageUrl}
                    alt="Current color image"
                    className="currentImagePreview"
                    style={{
                      maxWidth: "120px",
                      maxHeight: "120px",
                      objectFit: "cover",
                      borderRadius: "5px",
                      marginTop: "8px",
                      cursor: "pointer",
                    }}
                    onClick={() => handleImageClick(currentImageUrl)}
                    onError={(e) => {
                      console.error("Current image failed to load:", currentImageUrl);
                      e.target.style.display = "none";
                    }}
                  />
                  <div>
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className="btnSecondary"
                      style={{
                        padding: '4px',
                        fontSize: '12px',
                        backgroundColor: '#ff4444',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        marginTop: '10px',
                      }}
                    >
                      Remove Image
                    </button>
                  </div>
                </div>
              )}
              {/* Show remove button for newly selected image */}
              {!editingId && formData.image && formData.image instanceof File && (
                <div className="paddingTop8">
                  <button
                    type="button"
                    onClick={handleRemoveImage}
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
                    Remove Selected Image
                  </button>
                </div>
              )}
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
              <p className="negativeMarginTop10">Check this box to keep the color active, uncheck to mark as inactive</p>
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
                <span>{editingId ? "Update Color" : "Add Color"}</span>
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
            
            {!editingId && success && (
              <button
                type="button"
                onClick={clearForm}
                className="btnSecondary"
              >
                Add Another Color
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Colors List */}
      <div className="brandsListContainer paddingAll32">
        <div className="listHeader makeFlex spaceBetween alignCenter appendBottom24">
          <div className="leftSection">
            <h2 className="listTitle font30 fontBold blackText">Colors ({filteredColors.length})</h2>
            <StatusFilter
              statusFilter={statusFilter}
              onStatusChange={setStatusFilter}
              counts={calculateStandardStatusCounts(colors)}
              disabled={loading}
            />
          </div>
          <div className="rightSection makeFlex alignCenter gap10">
            <SearchField
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search colors..."
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

        {filteredColors.length === 0 && !loading ? (
          <div className="emptyState textCenter paddingAll60">
            <div className="emptyIcon appendBottom16">🎨</div>
            <h3 className="font22 fontSemiBold grayText appendBottom8">No Colors Found</h3>
            <p className="font16 grayText">Start by adding your first color above</p>
          </div>
        ) : (
          <>
            {/* Card View */}
            {viewMode === 'card' && (
              <div className="brandsGrid">
                {displayedCards.map((color) => {
                  const statusInfo = getStatusInfo(color);
                  return (
                    <EntityCard
                      key={color._id}
                      entity={color}
                      logoField="image"
                      nameField="name"
                      idField="_id"
                      onEdit={color.deleted ? undefined : handleEdit}
                      onDelete={handleDelete}
                      onRevert={color.deleted ? () => handleRevert(color._id) : undefined}
                      loading={loading}
                      imagePlaceholderColor={color.code || generateEntityColor(color._id, color.name)}
                      renderHeader={(color) => (
                        <EntityCardHeader
                          entity={color}
                          imageField="image"
                          titleField="name"
                          dateField="createdAt"
                          generateColor={generateEntityColor}
                          onImageClick={handleImageClick}
                        />
                      )}
                      renderDetails={(color) => (
                        <>
                          <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                            <span className="detailLabel font14 fontSemiBold grayText textUppercase">Color ID:</span>
                            <span className="detailValue font14 blackText appendLeft6">{color._id || 'N/A'}</span>
                          </div>
                          <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                            <span className="detailLabel font14 fontSemiBold grayText textUppercase">Name:</span>
                            <span className="detailValue font14 blackText appendLeft6">{color.name}</span>
                          </div>
                          <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                            <span className="detailLabel font14 fontSemiBold grayText textUppercase">Code:</span>
                            <span className="detailValue font14 blackText appendLeft6">{color.code}</span>
                          </div>
                          <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                            <span className="detailLabel font14 fontSemiBold grayText textUppercase">Status:</span>
                            <span className={`detailValue font14 ${statusInfo.className === 'active' ? 'greenText' : statusInfo.className === 'deleted' ? 'redText' : 'orangeText'} appendLeft6`}>
                              {statusInfo.text}
                            </span>
                          </div>
                        </>
                      )}
                      renderActions={(color) => (
                        <ActionButtons
                          onEdit={color.deleted ? undefined : () => handleEdit(color)}
                          onDelete={() => handleDelete(color._id)}
                          onRevert={color.deleted ? () => handleRevert(color._id) : undefined}
                          loading={loading}
                          size="normal"
                          deleteText={color.deleted ? "🗑️ Final Del" : "🗑️ Delete"}
                          deleteTitle={color.deleted ? "Permanently delete this color" : "Mark color as deleted"}
                          revertText="🔄 Restore"
                          revertTitle="Restore this deleted color"
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
                        <th className="tableHeader">Image</th>
                        <th className="tableHeader">Color</th>
                        <th className="tableHeader">Name</th>
                        <th className="tableHeader">Code</th>
                        <th className="tableHeader">Status</th>
                        <th className="tableHeader">Created</th>
                        <th className="tableHeader">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentColors.map((color) => {
                        const statusInfo = getStatusInfo(color);
                        return (
                          <tr key={color._id} className="tableRow">
                            <td className="tableCell">
                              {color.image ? (
                                <img
                                  src={color.image}
                                  alt={color.name}
                                  className="tableImage"
                                  style={{ 
                                    width: '40px', 
                                    height: '40px', 
                                    objectFit: 'cover',
                                    borderRadius: '4px',
                                    cursor: 'pointer'
                                  }}
                                  onClick={() => handleImageClick(color.image)}
                                  onError={(e) => {
                                    console.error('Image failed to load:', color.image);
                                    e.target.style.display = 'none';
                                  }}
                                />
                              ) : (
                                <div 
                                  className="tableImagePlaceholder"
                                  style={{
                                    width: '40px',
                                    height: '40px',
                                    backgroundColor: color.code || generateEntityColor(color._id, color.name),
                                    borderRadius: '4px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'white',
                                    fontSize: '12px',
                                    fontWeight: 'bold'
                                  }}
                                >
                                  {color.name.charAt(0).toUpperCase()}
                                </div>
                              )}
                            </td>
                            <td className="tableCell">
                              <span className="colorCodeText">{color.code}</span>
                            </td>
                            <td className="tableCell">
                              <span className="brandNameText">{color.name}</span>
                            </td>
                            <td className="tableCell">
                              <span className="brandIdText">{color.code}</span>
                            </td>
                            <td className="tableCell">
                              <span className={`statusText ${statusInfo.className}`}>
                                {statusInfo.text}
                              </span>
                            </td>
                            <td className="tableCell">
                              <span className="dateText">
                                {new Date(color.createdAt).toLocaleDateString()}
                              </span>
                            </td>
                            <td className="tableCell">
                              <div className="tableActions makeFlex gap8">
                                <ActionButtons
                                  onEdit={color.deleted ? undefined : () => handleEdit(color)}
                                  onDelete={() => handleDelete(color._id)}
                                  onRevert={color.deleted ? () => handleRevert(color._id) : undefined}
                                  loading={loading}
                                  size="small"
                                  editText="✏️"
                                  deleteText={color.deleted ? "🗑️" : "🗑️"}
                                  revertText="🔄"
                                  editTitle="Edit Color"
                                  deleteTitle={color.deleted ? "Final Del" : "Delete Color"}
                                  revertTitle="Restore Color"
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

export default ColorManager;
