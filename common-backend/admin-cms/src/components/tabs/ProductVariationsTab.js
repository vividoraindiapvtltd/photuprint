import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import api, { getUploadBaseURL } from "../../api/axios";
import { AlertMessage, ViewToggle, DeleteConfirmationPopup } from "../../common";

/** Build full URL for variant/product images (uploads or Cloudinary). Uses same base as API. */
function buildVariantImageUrl(imageUrl) {
  if (!imageUrl || typeof imageUrl !== "string") return null;
  const base = getUploadBaseURL();
  const trimmed = imageUrl.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("blob:")) return trimmed;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    if (trimmed.includes("/backend/uploads/") || trimmed.includes("/Users/")) {
      const filename = trimmed.split("/").pop();
      return `${base}/uploads/${filename}`;
    }
    return trimmed;
  }
  if (trimmed.includes("/backend/uploads/") || trimmed.includes("/Users/")) {
    const filename = trimmed.split("/").pop();
    return `${base}/uploads/${filename}`;
  }
  if (trimmed.startsWith("/uploads/")) return `${base}${trimmed}`;
  if (trimmed.startsWith("uploads/")) return `${base}/${trimmed}`;
  return `${base}/uploads/${trimmed}`;
}

/**
 * Selling price for display: variant.discountedPrice, else parent product sale (form),
 * else MRP. Variants created earlier often only have variant.price copied — product.discountedPrice
 * lives on the product, not on each variant document until saved.
 */
function getVariantDisplayPrice(variant, productBasePrice, productDiscountPrice) {
  const num = (v) => {
    if (v == null || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const variantMrp = num(variant?.price);
  const productMrp = num(productBasePrice);
  const mrp = variantMrp != null && variantMrp > 0 ? variantMrp : (productMrp ?? 0);

  const variantSale = num(variant?.discountedPrice);
  const productSale = num(productDiscountPrice);

  const selling =
    variantSale != null
      ? variantSale
      : productSale != null
        ? productSale
        : mrp;

  const showStrike = mrp > 0 && selling < mrp;
  return { selling, mrp, hasDiscount: showStrike };
}

function defaultVariantDiscountedField(variant, productDiscountPrice) {
  if (variant?.discountedPrice != null && variant.discountedPrice !== "") return variant.discountedPrice;
  return productDiscountPrice != null && productDiscountPrice !== "" ? productDiscountPrice : "";
}

function stockDisplayLabel(stock) {
  if (stock === -1) return "Unlimited";
  return String(stock ?? 0);
}

function parseStockFromInput(value) {
  if (value === "" || value === undefined || value === null) return 0;
  const n = parseInt(String(value).trim(), 10);
  return Number.isNaN(n) ? 0 : n;
}

/**
 * Image Popup Component
 */
const ImagePopup = ({ imageUrl, isOpen, onClose }) => {
  if (!isOpen || !imageUrl) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.9)",
        zIndex: 10000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer"
      }}
      onClick={onClose}
    >
      <div
        style={{
          position: "relative",
          maxWidth: "90%",
          maxHeight: "90%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={imageUrl}
          alt="Preview"
          style={{
            maxWidth: "100%",
            maxHeight: "90vh",
            objectFit: "contain"
          }}
          onError={(e) => {
            console.error("Failed to load image in popup:", imageUrl);
            e.target.style.display = 'none';
          }}
        />
        <button
          type="button"
          onClick={onClose}
          style={{
            position: "absolute",
            top: "-40px",
            right: "0",
            background: "#fff",
            color: "#000",
            border: "none",
            borderRadius: "50%",
            width: "32px",
            height: "32px",
            fontSize: "20px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: "bold"
          }}
          title="Close (ESC)"
        >
          ×
        </button>
      </div>
    </div>
  );
};

/**
 * Stats Cards
 */
const VariantStats = ({ stats }) => (
  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "15px", marginBottom: "30px" }}>
    {[
      { label: "Total Variants", value: stats.total, color: "#007bff" },
      { label: "Active", value: stats.active, color: "#28a745" },
      { label: "Out of Stock", value: stats.outOfStock, color: "#dc3545" },
      { label: "Low Stock", value: stats.lowStock, color: "#ffc107" },
      { label: "Total Stock", value: stats.totalStock, color: "#17a2b8" },
    ].map(({ label, value, color }) => (
      <div key={label} style={{ padding: "20px", backgroundColor: "#f8f9fa", borderRadius: "8px", border: "1px solid #dee2e6" }}>
        <div style={{ fontSize: "24px", fontWeight: "bold", color }}>{value}</div>
        <div style={{ fontSize: "14px", color: "#666" }}>{label}</div>
      </div>
    ))}
  </div>
);

/**
 * Create Variants Form
 */
const CreateVariantsForm = ({
  availableAttributes,
  selectedAttributes,
  onAttributeChange,
  onCreate,
  loading,
  generatedCount,
  requiredAttributes = ["color"],
  attributeOrder: attributeOrderProp,
}) => {
  // Check if all required attributes have at least one value selected
  const isDisabled = loading || requiredAttributes.some(
    (attr) => !(selectedAttributes[attr]?.length > 0)
  );

  // Use prop order for display; include material if available. Default: color, size, material
  const baseOrder = Array.isArray(attributeOrderProp) && attributeOrderProp.length > 0 ? [...attributeOrderProp] : ["color", "size"];
  const attributeOrder = baseOrder.includes("material") || !availableAttributes.material?.length ? baseOrder : [...baseOrder, "material"];

  const toggleAttributeId = (attr, rawId) => {
    const id = String(rawId);
    const current = (selectedAttributes[attr] || []).map(String);
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    onAttributeChange(attr, next);
  };

  const requiredLabel = requiredAttributes
    .map((a) => a.charAt(0).toUpperCase() + a.slice(1))
    .join(" and ");

  return (
    <div
      style={{
        marginBottom: "30px",
        padding: "20px",
        backgroundColor: "#f8f9fa",
        borderRadius: "8px",
        border: "1px solid #dee2e6",
      }}
    >
      <h3 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "15px" }}>
        Create Variants from Attributes
      </h3>
      <p style={{ fontSize: "13px", color: "#555", marginTop: "-8px", marginBottom: "14px", lineHeight: 1.45 }}>
        {requiredAttributes.includes("size")
          ? "Tick one or more options in each required column. We generate every combination of the selected attributes."
          : "Select one or more colors. One variant is created per color. Set quantity for each size on the variant cards below (sizes come from selected sizes on Product Details)."}
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
          gap: "15px",
          marginBottom: "15px",
        }}
      >
        {/* Render attributes in specific order: Color, Size, Material — checkboxes work on mobile & desktop */}
        {attributeOrder.map((attr) => {
          if (!availableAttributes[attr] || availableAttributes[attr].length === 0) return null;

          const selectedSet = new Set((selectedAttributes[attr] || []).map(String));

          return (
            <div key={attr}>
              <label style={{ display: "block", marginBottom: "8px", fontWeight: "500" }}>
                {attr.charAt(0).toUpperCase() + attr.slice(1)}
                {requiredAttributes.includes(attr) && <span style={{ color: "#dc3545" }}> *</span>}
              </label>
              <div
                role="group"
                aria-label={`${attr} options`}
                style={{
                  width: "100%",
                  maxHeight: "220px",
                  overflowY: "auto",
                  padding: "10px",
                  borderRadius: "4px",
                  border: "1px solid #ced4da",
                  backgroundColor: "#fff",
                  boxSizing: "border-box",
                }}
              >
                {availableAttributes[attr]?.map((item) => {
                  const id = String(item._id);
                  const checked = selectedSet.has(id);
                  const labelText = `${item.name}${item.initial ? ` (${item.initial})` : ""}`;
                  return (
                    <label
                      key={id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        padding: "6px 4px",
                        cursor: "pointer",
                        fontSize: "14px",
                        borderRadius: "4px",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleAttributeId(attr, item._id)}
                      />
                      <span>{labelText}</span>
                    </label>
                  );
                })}
              </div>
              <div style={{ fontSize: "11px", color: "#666", marginTop: "6px" }}>
                Selected: {selectedAttributes[attr]?.length || 0} {attr}(s)
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: "15px" }}>
        <button
          type="button"
          onClick={onCreate}
          disabled={isDisabled}
          className="btnPrimary"
          style={{
            opacity: isDisabled ? 0.5 : 1,
            cursor: isDisabled ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Creating..." : `Generate ${generatedCount} Variant(s)`}
        </button>

        {isDisabled && !loading && (
          <div style={{ color: "#6c757d", fontSize: "12px", marginTop: "8px", lineHeight: 1.4 }}>
            Choose at least one {requiredLabel} above to enable generation.
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Single Variant Row
 */
const VariantRow = ({ variant, editingId, onEdit, onUpdate, onCancel, onStockUpdate, onStatusToggle, onDelete, onImageUpload, availableAttributes, productQuantity = -1, productBasePrice, productDiscountPrice, colorOnlyVariations = false, productSizesForTable = [] }) => {
  const productUnlimited = productQuantity < 0;
  // Image popup state
  const [imagePopup, setImagePopup] = useState({ isOpen: false, imageUrl: null });
  // Local state for stock input when not in edit mode
  const [localStock, setLocalStock] = useState(variant.stock || 0);
  const primaryImageInputRef = useRef(null);

  const normalizeImageUrl = buildVariantImageUrl;
  const [formData, setFormData] = useState({
    price: variant.price ?? "",
    discountedPrice: defaultVariantDiscountedField(variant, productDiscountPrice),
    stock: variant.stock !== undefined && variant.stock !== null ? variant.stock : 0,
    sku: variant.sku || "",
    isActive: variant.isActive !== undefined ? variant.isActive : true,
    primaryImage: variant.primaryImage || variant.image || null,
    images: Array.isArray(variant.images) ? variant.images : []
  });

  const isEditing = editingId === variant._id;
  
  // Update formData when variant changes or when entering edit mode
  useEffect(() => {
    if (isEditing) {
      setFormData({
        price: variant.price ?? "",
        discountedPrice: defaultVariantDiscountedField(variant, productDiscountPrice),
        stock: variant.stock !== undefined && variant.stock !== null ? variant.stock : 0,
        sku: variant.sku || "",
        isActive: variant.isActive !== undefined ? variant.isActive : true,
        primaryImage: variant.primaryImage || variant.image || null,
        images: Array.isArray(variant.images) ? variant.images : []
      });
    }
  }, [isEditing, variant._id, variant.stock, variant.price, variant.discountedPrice, variant.sku, variant.isActive, productDiscountPrice]);

  // Sync localStock when variant changes
  useEffect(() => {
    setLocalStock(variant.stock !== undefined && variant.stock !== null ? variant.stock : 0);
  }, [variant.stock, variant._id]);
  const isLowStock = variant.stock !== -1 && variant.stock > 0 && variant.stock <= (variant.lowStockThreshold || 10);
  const displayPrice = getVariantDisplayPrice(variant, productBasePrice, productDiscountPrice);

  // Preview only — primary image is uploaded when user clicks "Update Variant" (multipart with ref file)
  const handlePrimaryImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFormData((prev) => ({ ...prev, primaryImage: URL.createObjectURL(file) }));
  };

  // Handle additional images/videos upload (up to 9)
  const handleAdditionalImagesChange = async (e) => {
    const files = Array.from(e.target.files).slice(0, 9); // Max 9 files
    if (files.length === 0) return;

    const currentImages = formData.images || [];
    const remainingSlots = 9 - currentImages.length;
    if (remainingSlots <= 0) {
      alert("Maximum 9 gallery images/videos allowed");
      e.target.value = ""; // Clear input
      return;
    }
    
    const filesToAdd = files.slice(0, remainingSlots);
    const newImageUrls = filesToAdd.map(file => URL.createObjectURL(file));
    const updatedImages = [...currentImages, ...newImageUrls].slice(0, 9); // Max 9 total
    
    setFormData(prev => ({ ...prev, images: updatedImages })); // Optimistic update
    e.target.value = ""; // Clear input after selection

    try {
      const formDataPayload = new FormData();
      filesToAdd.forEach((file, index) => {
        formDataPayload.append("images", file);
      });
      await api.put(`/variants/${variant._id}`, formDataPayload);
      if (onImageUpload) onImageUpload(variant._id, filesToAdd, "additional");
    } catch (err) {
      setFormData(prev => ({ ...prev, images: currentImages })); // Rollback
      console.error("Additional images/videos upload failed", err);
      const msg = err.response?.data?.msg || err.response?.data?.error || err.message || "Upload failed";
      alert(msg);
    }
  };

  // Remove primary image
  const handleRemovePrimaryImage = async () => {
    const prevImage = formData.primaryImage || variant.primaryImage || variant.image;
    setFormData(prev => ({ ...prev, primaryImage: null }));
    if (primaryImageInputRef.current) primaryImageInputRef.current.value = "";

    try {
      await api.put(`/variants/${variant._id}`, { primaryImage: null });
      // Refresh variant data
      if (onImageUpload) {
        onImageUpload(variant._id, null, "primary");
      }
    } catch (err) {
      setFormData(prev => ({ ...prev, primaryImage: prevImage })); // Rollback
      console.error("Failed to remove primary image", err);
      alert("Failed to remove primary image");
    }
  };

  // Remove an additional image
  const handleRemoveImage = async (index) => {
    const currentImages = formData.images || variant.images || [];
    const updatedImages = currentImages.filter((_, i) => i !== index);
    setFormData(prev => ({ ...prev, images: updatedImages }));

    try {
      await api.put(`/variants/${variant._id}`, { images: updatedImages });
      // Refresh variant data
      if (onImageUpload) {
        onImageUpload(variant._id, updatedImages, "additional");
      }
    } catch (err) {
      setFormData(prev => ({ ...prev, images: currentImages })); // Rollback
      console.error("Failed to remove image", err);
      alert("Failed to remove image");
    }
  };

  return (
    <tr
      key={variant._id}
      style={{
        borderBottom: "1px solid #dee2e6",
        backgroundColor: variant.isOutOfStock ? "#fff5f5" : isLowStock ? "#fffbf0" : "#fff"
      }}
    >
      <td style={{ padding: "12px" }}>
        <div style={{ fontWeight: "500" }}>
          {(() => {
            // Handle both Map objects and plain objects
            let attrs = variant.attributes || {};
            if (attrs instanceof Map) {
              attrs = Object.fromEntries(attrs);
            }
            
            // Get attribute names from availableAttributes for better display
            const attrDisplay = [];
            for (const [key, value] of Object.entries(attrs)) {
              if (colorOnlyVariations && !String(key).toLowerCase().includes("color")) continue;
              let displayValue = value;
              
              // Try to find the actual name from availableAttributes
              if (key === "color" && availableAttributes.color) {
                const color = availableAttributes.color.find(c => c._id === value || c._id?.toString() === value);
                if (color) displayValue = color.name;
              } else if (key === "size" && availableAttributes.size) {
                const size = availableAttributes.size.find(s => s._id === value || s._id?.toString() === value);
                if (size) displayValue = size.name;
              } else if (key === "material" && availableAttributes.material) {
                const material = availableAttributes.material.find(m => m._id === value || m._id?.toString() === value);
                if (material) displayValue = material.name;
              } else if (value && typeof value === 'object' && value.name) {
                displayValue = value.name;
              }
              
              attrDisplay.push(`${key.charAt(0).toUpperCase() + key.slice(1)}: ${displayValue}`);
            }
            
            return attrDisplay.length > 0 ? attrDisplay.join(", ") : "No attributes";
          })()}
        </div>
      </td>

      <td style={{ padding: "12px" }}>
        {isEditing ? (
          <input
            type="text"
            value={formData.sku}
            onChange={(e) => setFormData(prev => ({ ...prev, sku: e.target.value }))}
            style={{ width: "100%", padding: "6px", borderRadius: "4px", border: "1px solid #ced4da" }}
          />
        ) : (
          variant.sku || "N/A"
        )}
      </td>

      <td style={{ padding: "12px" }}>
        {isEditing ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={{ fontSize: "11px", color: "#666" }}>MRP</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={formData.price}
              onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
              style={{ width: "100%", padding: "6px", borderRadius: "4px", border: "1px solid #ced4da" }}
            />
            <label style={{ fontSize: "11px", color: "#666" }}>Sale price</label>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="Same as MRP if empty"
              value={formData.discountedPrice}
              onChange={(e) => setFormData(prev => ({ ...prev, discountedPrice: e.target.value }))}
              style={{ width: "100%", padding: "6px", borderRadius: "4px", border: "1px solid #ced4da" }}
            />
          </div>
        ) : (
          <div>
            <span style={{ fontWeight: 600, color: "#28a745" }}>₹{displayPrice.selling.toFixed(2)}</span>
            {displayPrice.hasDiscount && (
              <span style={{ marginLeft: "8px", textDecoration: "line-through", color: "#888", fontSize: "12px" }}>
                ₹{displayPrice.mrp.toFixed(2)}
              </span>
            )}
          </div>
        )}
      </td>

      <td style={{ padding: "12px" }}>
        {colorOnlyVariations && productSizesForTable.length > 0 ? (
          <div>
            <div style={{ fontWeight: "600", fontSize: "13px" }}>Total: {stockDisplayLabel(variant.stock)}</div>
            <div style={{ fontSize: "10px", color: "#888", marginTop: "4px", maxWidth: "160px" }}>
              Per-size qty: use <strong>card view</strong> to edit.
            </div>
          </div>
        ) : isEditing ? (
          <input
            type="number"
            value={formData.stock}
            onChange={(e) => {
              const value = e.target.value;
              setFormData(prev => ({ ...prev, stock: value === "" ? "" : value }));
            }}
            onBlur={(e) => {
              const newStock = parseStockFromInput(e.target.value);
              const currentStock = variant.stock !== undefined && variant.stock !== null ? variant.stock : 0;
              setFormData(prev => ({ ...prev, stock: newStock }));
              if (onStockUpdate && newStock !== currentStock) {
                onStockUpdate(variant._id, newStock);
              }
            }}
            style={{ width: "80px", padding: "6px", borderRadius: "4px", border: "1px solid #ced4da" }}
            min={productUnlimited ? "-1" : "0"}
            title={productUnlimited ? "Use -1 for unlimited (when product inventory is unlimited)" : "Quantity"}
          />
        ) : (
          <input
            type="number"
            value={localStock}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "" || v === "-") {
                setLocalStock(v);
                return;
              }
              setLocalStock(parseStockFromInput(v));
            }}
            onBlur={(e) => {
              const newStock = parseStockFromInput(e.target.value);
              const currentStock = variant.stock !== undefined && variant.stock !== null ? variant.stock : 0;
              setLocalStock(newStock);
              if (onStockUpdate && newStock !== currentStock) {
                onStockUpdate(variant._id, newStock);
              }
            }}
            style={{
              width: "80px",
              padding: "6px",
              borderRadius: "4px",
              border: "1px solid #ced4da",
              backgroundColor: variant.isOutOfStock ? "#fff5f5" : isLowStock ? "#fffbf0" : "#fff"
            }}
            min={productUnlimited ? "-1" : "0"}
            title={productUnlimited ? "-1 = unlimited" : "Quantity"}
          />
        )}
        {!isEditing && !(colorOnlyVariations && productSizesForTable.length > 0) && variant.stock === -1 && (
          <div style={{ fontSize: "11px", color: "#0d6efd", marginTop: "4px" }}>Unlimited</div>
        )}
        {!(colorOnlyVariations && productSizesForTable.length > 0) && isLowStock && <div style={{ fontSize: "11px", color: "#ffc107" }}>Low Stock</div>}
        {!(colorOnlyVariations && productSizesForTable.length > 0) && variant.isOutOfStock && <div style={{ fontSize: "11px", color: "#dc3545" }}>Out of Stock</div>}
      </td>

      <td style={{ padding: "12px" }}>
        {isEditing ? (
          <label style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <input
              type="checkbox"
              checked={formData.isActive}
              onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
            />
            Active
          </label>
        ) : (
          <span
            style={{
              padding: "4px 8px",
              borderRadius: "4px",
              fontSize: "12px",
              fontWeight: "500",
              backgroundColor: variant.isActive ? "#d4edda" : "#f8d7da",
              color: variant.isActive ? "#155724" : "#721c24"
            }}
          >
            {variant.isActive ? "Active" : "Inactive"}
          </span>
        )}
      </td>

      <td style={{ padding: "12px", textAlign: "center" }}>
        {isEditing ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", alignItems: "center" }}>
            <div style={{ display: "flex", gap: "5px", justifyContent: "center" }}>
              <button 
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const primaryFile = primaryImageInputRef.current?.files?.[0] || null;
                  const payload = { ...formData };
                  if (variant?.sizeStock?.length > 0) {
                    delete payload.stock;
                  }
                  onUpdate(variant._id, payload, { primaryFile });
                }} 
                className="btnPrimary" 
                style={{ padding: "4px 12px", fontSize: "12px" }}
              >
                Update Variant
              </button>
              <button 
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onCancel();
                }} 
                className="btnSecondary" 
                style={{ padding: "4px 12px", fontSize: "12px" }}
              >
                Cancel Edit
              </button>
            </div>
            
            {/* Image Upload Section - Always visible when editing */}
            <div style={{ width: "100%", padding: "10px", backgroundColor: "#f8f9fa", borderRadius: "4px", border: "1px solid #dee2e6", marginTop: "8px" }}>
              <div style={{ marginBottom: "8px" }}>
                <label style={{ fontSize: "11px", fontWeight: "500", display: "block", marginBottom: "4px" }}>
                  Main Image:
                </label>
                <input 
                  ref={primaryImageInputRef}
                  type="file" 
                  accept="image/*" 
                  onChange={handlePrimaryImageChange} 
                  style={{ fontSize: "11px", width: "100%" }}
                />
                {(formData.primaryImage || variant.primaryImage || variant.image) && (
                  <div style={{ marginTop: "4px", position: "relative", display: "inline-block" }}>
                    <img 
                      src={formData.primaryImage || normalizeImageUrl(variant.primaryImage || variant.image)} 
                      alt="Primary" 
                      style={{ width: "50px", height: "50px", objectFit: "cover", borderRadius: "4px", border: "1px solid #dee2e6", cursor: "pointer" }}
                      onClick={() => {
                        const imgUrl = formData.primaryImage || normalizeImageUrl(variant.primaryImage || variant.image);
                        if (imgUrl) {
                          setImagePopup({ isOpen: true, imageUrl: imgUrl });
                        }
                      }}
                      onError={(e) => {
                        console.error("Failed to load primary image in VariantRow:", formData.primaryImage || variant.primaryImage || variant.image);
                        e.target.style.display = 'none';
                      }}
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleRemovePrimaryImage();
                      }}
                      style={{
                        position: "absolute",
                        top: "-5px",
                        right: "-5px",
                        background: "#dc3545",
                        color: "white",
                        border: "none",
                        borderRadius: "50%",
                        width: "18px",
                        height: "18px",
                        fontSize: "10px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        lineHeight: "1"
                      }}
                      title="Remove primary image"
                    >
                      ×
                    </button>
                  </div>
                )}
              </div>
              
              <div>
                <label style={{ fontSize: "11px", fontWeight: "500", display: "block", marginBottom: "4px" }}>
                  Additional Images/Videos ({(formData.images?.length || variant.images?.length || 0)}/9):
                </label>
                <input 
                  type="file" 
                  accept="image/*,video/*" 
                  multiple 
                  onChange={handleAdditionalImagesChange}
                  disabled={(formData.images?.length || variant.images?.length || 0) >= 9}
                  style={{ fontSize: "11px", width: "100%" }}
                />
                <div style={{ display: "flex", gap: "4px", marginTop: "4px", flexWrap: "wrap" }}>
                  {(formData.images || variant.images || []).map((img, idx) => {
                    const normalizedImg = normalizeImageUrl(img);
                    if (!normalizedImg) return null;
                    const isVideo = typeof normalizedImg === "string" && (normalizedImg.includes(".mp4") || normalizedImg.includes(".webm") || normalizedImg.includes(".mov") || normalizedImg.includes(".avi") || normalizedImg.includes("video"));
                    return (
                    <div key={idx} style={{ position: "relative" }}>
                      {isVideo ? (
                        <video
                          src={normalizedImg}
                          style={{ width: "40px", height: "40px", objectFit: "cover", borderRadius: "4px", border: "1px solid #dee2e6", cursor: "pointer" }}
                          onClick={() => {
                            if (normalizedImg) {
                              setImagePopup({ isOpen: true, imageUrl: normalizedImg });
                            }
                          }}
                          onError={(e) => {
                            console.error("Failed to load additional video in VariantRow:", img, "normalized:", normalizedImg);
                            e.target.style.display = 'none';
                          }}
                        />
                      ) : (
                        <img 
                          src={normalizedImg} 
                          alt={`Additional ${idx + 1}`} 
                          style={{ width: "40px", height: "40px", objectFit: "cover", borderRadius: "4px", border: "1px solid #dee2e6", cursor: "pointer" }}
                          onClick={() => {
                            if (normalizedImg) {
                              setImagePopup({ isOpen: true, imageUrl: normalizedImg });
                            }
                          }}
                          onError={(e) => {
                            console.error("Failed to load additional image in VariantRow:", img, "normalized:", normalizedImg);
                            e.target.style.display = 'none';
                          }}
                        />
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleRemoveImage(idx);
                        }}
                        style={{
                          position: "absolute",
                          top: "-5px",
                          right: "-5px",
                          background: "#dc3545",
                          color: "white",
                          border: "none",
                          borderRadius: "50%",
                          width: "18px",
                          height: "18px",
                          fontSize: "10px",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center"
                        }}
                      >
                        ×
                      </button>
                    </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", alignItems: "center" }}>
            <div style={{ display: "flex", gap: "5px", justifyContent: "center" }}>
              <button 
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onEdit(variant);
                }} 
                className="btnSecondary" 
                style={{ padding: "4px 12px", fontSize: "12px" }}
              >
                Edit Variant
              </button>
              <button 
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onStatusToggle(variant._id, variant.isActive);
                }} 
                className="btnSecondary" 
                style={{ padding: "4px 12px", fontSize: "12px" }}
              >
                {variant.isActive ? "Deactivate" : "Activate"}
              </button>
              <button 
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onDelete(variant._id);
                }} 
                className="btnSecondary" 
                style={{ padding: "4px 12px", fontSize: "12px", color: "#dc3545" }}
                title={variant.deleted ? "Final Delete" : "Delete Variant"}
              >
                {variant.deleted ? "🗑️ Final Del" : "🗑️ Delete"}
              </button>
            </div>
            
            {/* Display Images with Remove Functionality */}
            <div style={{ width: "100%", padding: "8px", backgroundColor: "#f8f9fa", borderRadius: "4px" }}>
              {variant.primaryImage || variant.image ? (
                <div style={{ marginBottom: "8px" }}>
                  <div style={{ fontSize: "10px", color: "#666", marginBottom: "4px", fontWeight: "500" }}>Main Image:</div>
                  <div style={{ position: "relative", display: "inline-block" }}>
                    <img 
                      src={normalizeImageUrl(variant.primaryImage || variant.image)} 
                      alt="Primary" 
                      style={{ width: "50px", height: "50px", objectFit: "cover", borderRadius: "4px", border: "1px solid #dee2e6" }}
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (window.confirm("Remove primary image?")) {
                          handleRemovePrimaryImage();
                        }
                      }}
                      style={{
                        position: "absolute",
                        top: "-5px",
                        right: "-5px",
                        background: "#dc3545",
                        color: "white",
                        border: "none",
                        borderRadius: "50%",
                        width: "18px",
                        height: "18px",
                        fontSize: "10px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        lineHeight: "1"
                      }}
                      title="Remove primary image"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ) : null}
              {variant.images && variant.images.length > 0 && (
                <div>
                  <div style={{ fontSize: "10px", color: "#666", marginBottom: "4px", fontWeight: "500" }}>
                    Additional Images/Videos ({variant.images.length}/9):
                  </div>
                  <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                    {variant.images.map((img, idx) => {
                      const normalizedImg = normalizeImageUrl(img);
                      if (!normalizedImg) return null;
                      const isVideo = typeof normalizedImg === "string" && (normalizedImg.includes(".mp4") || normalizedImg.includes(".webm") || normalizedImg.includes(".mov") || normalizedImg.includes(".avi") || normalizedImg.includes("video"));
                      return (
                        <div key={idx} style={{ position: "relative" }}>
                          {isVideo ? (
                            <video
                              src={normalizedImg}
                              style={{ width: "40px", height: "40px", objectFit: "cover", borderRadius: "4px", border: "1px solid #dee2e6" }}
                            />
                          ) : (
                            <img 
                              src={normalizedImg} 
                              alt={`Additional ${idx + 1}`} 
                              style={{ width: "40px", height: "40px", objectFit: "cover", borderRadius: "4px", border: "1px solid #dee2e6" }}
                            />
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (window.confirm("Remove this image?")) {
                                handleRemoveImage(idx);
                              }
                            }}
                            style={{
                              position: "absolute",
                              top: "-5px",
                              right: "-5px",
                              background: "#dc3545",
                              color: "white",
                              border: "none",
                              borderRadius: "50%",
                              width: "18px",
                              height: "18px",
                              fontSize: "10px",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              lineHeight: "1"
                            }}
                            title="Remove image"
                          >
                            ×
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </td>

      {/* Image Popup */}
      <ImagePopup
        imageUrl={imagePopup.imageUrl}
        isOpen={imagePopup.isOpen}
        onClose={() => setImagePopup({ isOpen: false, imageUrl: null })}
      />
    </tr>
  );
};

/**
 * Variant Card Component
 */
const VariantCard = ({ variant, editingId, onEdit, onUpdate, onCancel, onStockUpdate, onStatusToggle, onDelete, onImageUpload, availableAttributes, productQuantity = -1, productBasePrice, productDiscountPrice, colorOnlyVariations = false, productSizesForTable = [] }) => {
  const productUnlimited = productQuantity < 0;
  // Image popup state
  const [imagePopup, setImagePopup] = useState({ isOpen: false, imageUrl: null });
  const primaryImageInputRef = useRef(null);

  const normalizeImageUrl = buildVariantImageUrl;

  // Normalize variant images - recompute when variant changes
  const normalizedPrimaryImage = useMemo(() => {
    const img = variant.primaryImage || variant.image;
    return img ? normalizeImageUrl(img) : null;
  }, [variant.primaryImage, variant.image]);
  
  const normalizedImages = useMemo(() => {
    const imgs = Array.isArray(variant.images) ? variant.images : [];
    const normalized = imgs.map(img => {
      if (!img) return null;
      // If already a full URL, use it directly (already normalized)
      if (img.startsWith('http://') || img.startsWith('https://')) {
        return img;
      }
      // Otherwise normalize it
      return normalizeImageUrl(img);
    }).filter(Boolean);
    console.log("VariantCard normalizedImages - variant._id:", variant._id, "original count:", imgs.length, "normalized count:", normalized.length);
    return normalized;
  }, [variant.images]);

  const [formData, setFormData] = useState({
    price: variant.price ?? "",
    discountedPrice: defaultVariantDiscountedField(variant, productDiscountPrice),
    stock: variant.stock !== undefined && variant.stock !== null ? variant.stock : 0,
    sku: variant.sku || "",
    isActive: variant.isActive !== undefined ? variant.isActive : true,
    primaryImage: normalizedPrimaryImage,
    images: normalizedImages
  });

  const [sizeStockDraft, setSizeStockDraft] = useState({});

  useEffect(() => {
    if (!colorOnlyVariations || !productSizesForTable.length) return;
    const next = {};
    for (const sz of productSizesForTable) {
      const id = String(sz._id);
      const row = (variant.sizeStock || []).find((r) => String(r.size) === id);
      next[id] = row != null ? row.stock : 0;
    }
    setSizeStockDraft(next);
  }, [variant._id, variant.sizeStock, colorOnlyVariations, productSizesForTable]);

  const buildUpdatePayload = () => {
    const base = { ...formData };
    if (colorOnlyVariations && productSizesForTable.length) {
      base.sizeStock = productSizesForTable.map((sz) => {
        const id = String(sz._id);
        const raw = sizeStockDraft[id];
        if (productUnlimited && (raw === -1 || raw === "-1" || String(raw).trim() === "-1")) {
          return { size: sz._id, stock: -1 };
        }
        const n = parseInt(String(raw === undefined || raw === "" ? 0 : raw).trim(), 10);
        return { size: sz._id, stock: Number.isNaN(n) ? 0 : n };
      });
    }
    return base;
  };

  const isEditing = editingId === variant._id;
  const isLowStock = variant.stock !== -1 && variant.stock > 0 && variant.stock <= (variant.lowStockThreshold || 10);
  const isOutOfStock = variant.stock === 0;
  const displayPrice = getVariantDisplayPrice(variant, productBasePrice, productDiscountPrice);

  // Update formData when entering edit mode or variant changes
  useEffect(() => {
    // Always normalize images from variant prop
    const normalizedPrimary = normalizeImageUrl(variant.primaryImage || variant.image);
    const normalizedImgs = Array.isArray(variant.images) 
      ? variant.images.map(img => normalizeImageUrl(img)).filter(Boolean)
      : [];
    
    console.log("VariantCard useEffect - variant._id:", variant._id, "normalizedPrimary:", normalizedPrimary, "normalizedImgs:", normalizedImgs.length);
    
    if (isEditing) {
      setFormData({
        price: variant.price ?? "",
        discountedPrice: defaultVariantDiscountedField(variant, productDiscountPrice),
        stock: variant.stock !== undefined && variant.stock !== null ? variant.stock : 0,
        sku: variant.sku || "",
        isActive: variant.isActive !== undefined ? variant.isActive : true,
        primaryImage: normalizedPrimary,
        images: normalizedImgs
      });
    } else {
      // Always update images when variant changes to reflect changes from server
      setFormData(prev => ({
        ...prev,
        primaryImage: normalizedPrimary || prev.primaryImage,
        images: normalizedImgs.length > 0 ? normalizedImgs : (prev.images || [])
      }));
    }
  }, [isEditing, variant._id, variant.stock, variant.price, variant.discountedPrice, variant.sku, variant.isActive, variant.primaryImage, variant.image, variant.images, productDiscountPrice]);

  // Get attribute display names
  const getAttributeDisplay = () => {
    let attrs = variant.attributes || {};
    if (attrs instanceof Map) {
      attrs = Object.fromEntries(attrs);
    }
    
    const attrDisplay = [];
    for (const [key, value] of Object.entries(attrs)) {
      if (colorOnlyVariations && !String(key).toLowerCase().includes("color")) continue;
      let displayValue = value;
      
      if (key === "color" && availableAttributes.color) {
        const color = availableAttributes.color.find(c => c._id === value || c._id?.toString() === value);
        if (color) displayValue = color.name;
      } else if (key === "size" && availableAttributes.size) {
        const size = availableAttributes.size.find(s => s._id === value || s._id?.toString() === value);
        if (size) displayValue = size.name;
      } else if (key === "material" && availableAttributes.material) {
        const material = availableAttributes.material.find(m => m._id === value || m._id?.toString() === value);
        if (material) displayValue = material.name;
      }
      
      attrDisplay.push(`${key.charAt(0).toUpperCase() + key.slice(1)}: ${displayValue}`);
    }
    
    return attrDisplay.length > 0 ? attrDisplay.join(", ") : "No attributes";
  };

  const handlePrimaryImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFormData((prev) => ({ ...prev, primaryImage: URL.createObjectURL(file) }));
  };

  // Handle additional images upload
  const handleAdditionalImagesChange = async (e) => {
    const files = Array.from(e.target.files).slice(0, 9);
    if (files.length === 0) return;
    const currentImages = formData.images || [];
    const remainingSlots = 9 - currentImages.length;
    if (remainingSlots <= 0) {
      alert("Maximum 9 gallery images/videos allowed");
      e.target.value = ""; // Clear input
      return;
    }
    
    const filesToAdd = files.slice(0, remainingSlots);
    const newImageUrls = filesToAdd.map(file => URL.createObjectURL(file));
    const updatedImages = [...currentImages, ...newImageUrls].slice(0, 9);
    setFormData(prev => ({ ...prev, images: updatedImages }));
    e.target.value = ""; // Clear input after selection
    
    try {
      const formDataPayload = new FormData();
      filesToAdd.forEach(file => formDataPayload.append("images", file));
      await api.put(`/variants/${variant._id}`, formDataPayload);
      if (onImageUpload) onImageUpload(variant._id, filesToAdd, "additional");
    } catch (err) {
      setFormData(prev => ({ ...prev, images: currentImages }));
      console.error("Additional images/videos upload failed", err);
      const msg = err.response?.data?.msg || err.response?.data?.error || err.message || "Upload failed";
      alert(msg);
    }
  };

  // Remove primary image
  const handleRemovePrimaryImage = async () => {
    const prevImage = formData.primaryImage || variant.primaryImage || variant.image;
    setFormData(prev => ({ ...prev, primaryImage: null }));
    if (primaryImageInputRef.current) primaryImageInputRef.current.value = "";
    try {
      await api.put(`/variants/${variant._id}`, { primaryImage: null });
      if (onImageUpload) onImageUpload(variant._id, null, "primary");
    } catch (err) {
      setFormData(prev => ({ ...prev, primaryImage: prevImage }));
      console.error("Failed to remove primary image", err);
      alert("Failed to remove primary image");
    }
  };

  // Remove additional image
  const handleRemoveImage = async (index) => {
    const currentImages = formData.images || variant.images || [];
    const updatedImages = currentImages.filter((_, i) => i !== index);
    setFormData(prev => ({ ...prev, images: updatedImages }));
    try {
      await api.put(`/variants/${variant._id}`, { images: updatedImages });
      if (onImageUpload) onImageUpload(variant._id, updatedImages, "additional");
    } catch (err) {
      setFormData(prev => ({ ...prev, images: currentImages }));
      console.error("Failed to remove image", err);
      alert("Failed to remove image");
    }
  };

  return (
    <div
      style={{
        backgroundColor: "#fff",
        borderRadius: "8px",
        border: "1px solid #dee2e6",
        padding: "20px",
        boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
        transition: "all 0.3s ease",
        position: "relative",
        borderLeft: isOutOfStock ? "4px solid #dc3545" : isLowStock ? "4px solid #ffc107" : "4px solid #28a745"
      }}
    >
      {/* Status Badge */}
      <div style={{ position: "absolute", top: "15px", right: "15px" }}>
        <span
          style={{
            padding: "4px 8px",
            borderRadius: "4px",
            fontSize: "11px",
            fontWeight: "500",
            backgroundColor: variant.isActive ? "#d4edda" : "#f8d7da",
            color: variant.isActive ? "#155724" : "#721c24"
          }}
        >
          {variant.isActive ? "Active" : "Inactive"}
        </span>
      </div>

      {/* Primary Image */}
      <div style={{ marginBottom: "15px", textAlign: "center" }}>
        {(formData.primaryImage || normalizedPrimaryImage || variant.primaryImage || variant.image) ? (
          <div style={{ position: "relative", display: "inline-block" }}>
            <img
              src={formData.primaryImage || normalizedPrimaryImage || normalizeImageUrl(variant.primaryImage || variant.image)}
              alt="Primary"
              style={{
                width: "150px",
                height: "150px",
                objectFit: "cover",
                borderRadius: "8px",
                border: "2px solid #dee2e6",
                cursor: "pointer"
              }}
              onClick={() => {
                const imgUrl = formData.primaryImage || normalizedPrimaryImage || normalizeImageUrl(variant.primaryImage || variant.image);
                if (imgUrl) {
                  setImagePopup({ isOpen: true, imageUrl: imgUrl });
                }
              }}
              onError={(e) => {
                console.error("Failed to load primary image:", formData.primaryImage || normalizedPrimaryImage);
                e.target.style.display = 'none';
              }}
            />
            {isEditing && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (window.confirm("Remove primary image?")) {
                    handleRemovePrimaryImage();
                  }
                }}
                style={{
                  position: "absolute",
                  top: "-5px",
                  right: "-5px",
                  background: "#dc3545",
                  color: "white",
                  border: "none",
                  borderRadius: "50%",
                  width: "24px",
                  height: "24px",
                  fontSize: "14px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
                title="Remove primary image"
              >
                ×
              </button>
            )}
          </div>
        ) : (
          <div
            style={{
              width: "150px",
              height: "150px",
              backgroundColor: "#f8f9fa",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#999",
              fontSize: "12px",
              margin: "0 auto"
            }}
          >
            No Image
          </div>
        )}
      </div>

      {/* Variant Details */}
      <div style={{ marginBottom: "15px" }}>
        <h4 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "10px", color: "#333" }}>
          {getAttributeDisplay()}
        </h4>
        
        <div style={{ fontSize: "13px", color: "#666", marginBottom: "8px" }}>
          <strong>SKU:</strong>{" "}
          {isEditing ? (
            <input
              type="text"
              value={formData.sku}
              onChange={(e) => setFormData(prev => ({ ...prev, sku: e.target.value }))}
              style={{
                width: "100%",
                padding: "4px 8px",
                borderRadius: "4px",
                border: "1px solid #ced4da",
                fontSize: "13px"
              }}
            />
          ) : (
            variant.sku || "N/A"
          )}
        </div>
        
        <div style={{ fontSize: "14px", fontWeight: "600", color: "#28a745", marginBottom: "8px" }}>
          {isEditing ? (
            <div>
              <label style={{ fontSize: "12px", color: "#666", display: "block", marginBottom: "4px" }}>MRP</label>
              <input
                type="number"
                value={formData.price}
                onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                style={{
                  width: "100%",
                  padding: "4px 8px",
                  borderRadius: "4px",
                  border: "1px solid #ced4da",
                  fontSize: "14px"
                }}
                step="0.01"
                min="0"
              />
              <label style={{ fontSize: "12px", color: "#666", display: "block", marginTop: "8px", marginBottom: "4px" }}>Sale price</label>
              <input
                type="number"
                value={formData.discountedPrice}
                onChange={(e) => setFormData(prev => ({ ...prev, discountedPrice: e.target.value }))}
                placeholder="Same as MRP if empty"
                style={{
                  width: "100%",
                  padding: "4px 8px",
                  borderRadius: "4px",
                  border: "1px solid #ced4da",
                  fontSize: "14px"
                }}
                step="0.01"
                min="0"
              />
            </div>
          ) : (
            <div>
              <span style={{ fontWeight: 700 }}>₹{displayPrice.selling.toFixed(2)}</span>
              {displayPrice.hasDiscount && (
                <span style={{ marginLeft: "8px", textDecoration: "line-through", color: "#888", fontSize: "13px", fontWeight: 400 }}>
                  ₹{displayPrice.mrp.toFixed(2)}
                </span>
              )}
            </div>
          )}
        </div>
        
        {colorOnlyVariations && productSizesForTable.length > 0 ? (
          <div style={{ fontSize: "13px", color: "#333", marginBottom: "8px" }}>
            <div style={{ fontWeight: "600", marginBottom: "6px" }}>Size & quantity</div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "4px", borderBottom: "1px solid #dee2e6" }}>Size</th>
                  <th style={{ textAlign: "right", padding: "4px", borderBottom: "1px solid #dee2e6" }}>Qty</th>
                </tr>
              </thead>
              <tbody>
                {productSizesForTable.map((sz) => {
                  const id = String(sz._id);
                  const label = `${sz.name}${sz.initial ? ` (${sz.initial})` : ""}`;
                  const raw = sizeStockDraft[id];
                  return (
                    <tr key={id}>
                      <td style={{ padding: "4px", borderBottom: "1px solid #f0f0f0" }}>{label}</td>
                      <td style={{ padding: "4px", borderBottom: "1px solid #f0f0f0", textAlign: "right" }}>
                        {isEditing ? (
                          <input
                            type="number"
                            value={raw === undefined || raw === -1 ? (raw === -1 ? -1 : "") : raw}
                            onChange={(e) => {
                              const v = e.target.value;
                              if (v === "" || v === "-") {
                                setSizeStockDraft((prev) => ({ ...prev, [id]: v }));
                                return;
                              }
                              const n = parseInt(String(v).trim(), 10);
                              setSizeStockDraft((prev) => ({ ...prev, [id]: Number.isNaN(n) ? 0 : n }));
                            }}
                            style={{ width: "72px", padding: "4px", borderRadius: "4px", border: "1px solid #ced4da" }}
                            min={productUnlimited ? "-1" : "0"}
                            title={productUnlimited ? "-1 = unlimited for this size" : "Units in stock"}
                          />
                        ) : (
                          <span>{stockDisplayLabel((variant.sizeStock || []).find((r) => String(r.size) === id)?.stock ?? 0)}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div style={{ marginTop: "6px", fontSize: "12px", color: "#666" }}>
              <strong>Total:</strong>{" "}
              <span style={{ fontWeight: "600", color: "#28a745" }}>{stockDisplayLabel(variant.stock)}</span>
            </div>
          </div>
        ) : (
        <div style={{ fontSize: "13px", color: "#666", marginBottom: "8px" }}>
          <strong>Stock:</strong>{" "}
          {isEditing ? (
            <input
              type="number"
              value={formData.stock}
              onChange={(e) => {
                const value = e.target.value;
                setFormData(prev => ({ ...prev, stock: value === "" ? "" : value }));
              }}
              onBlur={(e) => {
                const newStock = parseStockFromInput(e.target.value);
                const currentStock = variant.stock !== undefined && variant.stock !== null ? variant.stock : 0;
                setFormData(prev => ({ ...prev, stock: newStock }));
                if (onStockUpdate && newStock !== currentStock) {
                  onStockUpdate(variant._id, newStock);
                }
              }}
              style={{
                width: "100%",
                padding: "4px 8px",
                borderRadius: "4px",
                border: "1px solid #ced4da",
                fontSize: "13px"
              }}
              min={productUnlimited ? "-1" : "0"}
              title={productUnlimited ? "Use -1 for unlimited when product inventory is unlimited" : "Quantity"}
            />
          ) : (
            <>
              <span style={{ color: isOutOfStock ? "#dc3545" : isLowStock ? "#ffc107" : "#28a745", fontWeight: "600" }}>
                {stockDisplayLabel(variant.stock)}
              </span>
              {variant.stock === -1 && (
                <span style={{ color: "#0d6efd", marginLeft: "5px", fontSize: "12px" }}>(unlimited)</span>
              )}
              {isLowStock && <span style={{ color: "#ffc107", marginLeft: "5px" }}>(Low Stock)</span>}
              {isOutOfStock && <span style={{ color: "#dc3545", marginLeft: "5px" }}>(Out of Stock)</span>}
            </>
          )}
        </div>
        )}
      </div>

      {/* Additional Images */}
      {((normalizedImages && normalizedImages.length > 0) || (formData.images && formData.images.length > 0) || (variant.images && variant.images.length > 0)) && (
        <div style={{ marginBottom: "15px" }}>
          <div style={{ fontSize: "12px", color: "#666", marginBottom: "8px", fontWeight: "500" }}>
            Additional Images/Videos ({((formData.images || normalizedImages || variant.images || []).length)}/9):
          </div>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", justifyContent: "center" }}>
            {(formData.images || normalizedImages || variant.images || []).map((img, idx) => {
              const normalizedImg = normalizeImageUrl(img);
              if (!normalizedImg) return null;
              const isVideo = typeof normalizedImg === "string" && (normalizedImg.includes(".mp4") || normalizedImg.includes(".webm") || normalizedImg.includes(".mov") || normalizedImg.includes(".avi") || normalizedImg.includes("video"));
              return (
                <div key={idx} style={{ position: "relative" }}>
                  {isVideo ? (
                    <video
                      src={normalizedImg}
                      style={{
                        width: "50px",
                        height: "50px",
                        objectFit: "cover",
                        borderRadius: "4px",
                        border: "1px solid #dee2e6",
                        cursor: "pointer"
                      }}
                      onClick={() => {
                        if (normalizedImg) {
                          setImagePopup({ isOpen: true, imageUrl: normalizedImg });
                        }
                      }}
                      onError={(e) => {
                        console.error("Failed to load additional video:", normalizedImg);
                        e.target.style.display = 'none';
                      }}
                    />
                  ) : (
                    <img
                      src={normalizedImg}
                      alt={`Additional ${idx + 1}`}
                      style={{
                        width: "50px",
                        height: "50px",
                        objectFit: "cover",
                        borderRadius: "4px",
                        border: "1px solid #dee2e6",
                        cursor: "pointer"
                      }}
                      onClick={() => {
                        if (normalizedImg) {
                          setImagePopup({ isOpen: true, imageUrl: normalizedImg });
                        }
                      }}
                      onError={(e) => {
                        console.error("Failed to load additional image:", normalizedImg);
                        e.target.style.display = 'none';
                      }}
                    />
                  )}
                  {isEditing && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (window.confirm("Remove this image?")) {
                          handleRemoveImage(idx);
                        }
                      }}
                      style={{
                        position: "absolute",
                        top: "-5px",
                        right: "-5px",
                        background: "#dc3545",
                        color: "white",
                        border: "none",
                        borderRadius: "50%",
                        width: "18px",
                        height: "18px",
                        fontSize: "10px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center"
                      }}
                      title="Remove image"
                    >
                      ×
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Image Popup */}
      <ImagePopup
        imageUrl={imagePopup.imageUrl}
        isOpen={imagePopup.isOpen}
        onClose={() => setImagePopup({ isOpen: false, imageUrl: null })}
      />

      {/* Edit Mode - Image Upload */}
      {isEditing && (
        <div style={{ marginBottom: "15px", padding: "10px", backgroundColor: "#f8f9fa", borderRadius: "4px" }}>
          <div style={{ marginBottom: "8px" }}>
            <label style={{ fontSize: "11px", fontWeight: "500", display: "block", marginBottom: "4px" }}>
              Main Image:
            </label>
            <input
              ref={primaryImageInputRef}
              type="file"
              accept="image/*"
              onChange={handlePrimaryImageChange}
              style={{ fontSize: "11px", width: "100%" }}
            />
          </div>
          <div>
            <label style={{ fontSize: "11px", fontWeight: "500", display: "block", marginBottom: "4px" }}>
              Additional Images/Videos ({(formData.images?.length || variant.images?.length || 0)}/9):
            </label>
            <input
              type="file"
              accept="image/*,video/*"
              multiple
              onChange={handleAdditionalImagesChange}
              disabled={(formData.images?.length || variant.images?.length || 0) >= 9}
              style={{ fontSize: "11px", width: "100%" }}
            />
          </div>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "center" }}>
        {isEditing ? (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const primaryFile = primaryImageInputRef.current?.files?.[0] || null;
                onUpdate(variant._id, buildUpdatePayload(), { primaryFile });
              }}
              className="btnPrimary"
              style={{ padding: "6px 12px", fontSize: "12px" }}
            >
              Update
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onCancel();
              }}
              className="btnSecondary"
              style={{ padding: "6px 12px", fontSize: "12px" }}
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onEdit(variant);
              }}
              className="btnSecondary"
              style={{ padding: "6px 12px", fontSize: "12px" }}
            >
              Edit
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onStatusToggle(variant._id, variant.isActive);
              }}
              className="btnSecondary"
              style={{ padding: "6px 12px", fontSize: "12px" }}
            >
              {variant.isActive ? "Deactivate" : "Activate"}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onDelete(variant._id);
              }}
              className="btnSecondary"
              style={{ padding: "6px 12px", fontSize: "12px", color: "#dc3545" }}
              title={variant.deleted ? "Final Delete" : "Delete Variant"}
            >
              {variant.deleted ? "🗑️ Final Del" : "🗑️ Delete"}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

/**
 * Variant Card Grid
 */
const VariantCardGrid = ({ variants, editingId, onEdit, onUpdate, onCancel, onStockUpdate, onStatusToggle, onDelete, onImageUpload, availableAttributes, productQuantity = -1, productBasePrice, productDiscountPrice, colorOnlyVariations, productSizesForTable }) => {
  if (!variants || variants.length === 0) {
    return (
      <div style={{ backgroundColor: "#fff", borderRadius: "8px", border: "1px solid #dee2e6", padding: "40px", textAlign: "center" }}>
        <div style={{ fontSize: "18px", color: "#666", marginBottom: "10px" }}>
          No variants found
        </div>
        <div style={{ fontSize: "14px", color: "#999" }}>
          Create variants using the form above
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
        gap: "20px",
        padding: "20px 0"
      }}
    >
      {variants
        .filter((v, index, self) => index === self.findIndex(t => t._id === v._id))
        .map(variant => (
          <VariantCard
            key={variant._id}
            variant={variant}
            editingId={editingId}
            onEdit={onEdit}
            onUpdate={onUpdate}
            onCancel={onCancel}
            onStockUpdate={onStockUpdate}
            onStatusToggle={onStatusToggle}
            onDelete={onDelete}
            onImageUpload={onImageUpload}
            availableAttributes={availableAttributes}
            productQuantity={productQuantity}
            productBasePrice={productBasePrice}
            productDiscountPrice={productDiscountPrice}
            colorOnlyVariations={colorOnlyVariations}
            productSizesForTable={productSizesForTable}
          />
        ))}
    </div>
  );
};

/**
 * Variant Table
 */
const VariantTable = ({ variants, editingId, onEdit, onUpdate, onCancel, onStockUpdate, onStatusToggle, onDelete, onImageUpload, availableAttributes, productQuantity, productBasePrice, productDiscountPrice, colorOnlyVariations, productSizesForTable }) => {
  console.log("VariantTable render - variants:", variants, "count:", variants?.length);
  
  if (!variants || variants.length === 0) {
    return (
      <div style={{ backgroundColor: "#fff", borderRadius: "8px", border: "1px solid #dee2e6", padding: "40px", textAlign: "center" }}>
        <div style={{ fontSize: "18px", color: "#666", marginBottom: "10px" }}>
          No variants found
        </div>
        <div style={{ fontSize: "14px", color: "#999" }}>
          Create variants using the form above
        </div>
      </div>
    );
  }
  
  return (
      <div style={{ backgroundColor: "#fff", borderRadius: "8px", border: "1px solid #dee2e6", overflow: "hidden" }}>
      <div style={{ padding: "15px", backgroundColor: "#f8f9fa", borderBottom: "1px solid #dee2e6" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ fontSize: "18px", fontWeight: "600", margin: 0 }}>Variants ({variants.length})</h3>
          {productQuantity >= 0 ? (
            <div style={{ fontSize: "13px", color: "#666" }}>
              Product quantity limit: <strong style={{ color: "#333" }}>{productQuantity}</strong>
            </div>
          ) : (
            <div style={{ fontSize: "13px", color: "#666" }}>
              Product inventory: <strong style={{ color: "#0d6efd" }}>Unlimited</strong> — use variant stock <strong>-1</strong> for unlimited per variant
            </div>
          )}
        </div>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ backgroundColor: "#f8f9fa" }}>
              <th style={{ padding: "12px", textAlign: "left", borderBottom: "2px solid #dee2e6" }}>Attributes</th>
              <th style={{ padding: "12px", textAlign: "left", borderBottom: "2px solid #dee2e6" }}>SKU</th>
              <th style={{ padding: "12px", textAlign: "left", borderBottom: "2px solid #dee2e6" }}>Price</th>
              <th style={{ padding: "12px", textAlign: "left", borderBottom: "2px solid #dee2e6" }}>Stock</th>
              <th style={{ padding: "12px", textAlign: "left", borderBottom: "2px solid #dee2e6" }}>Status</th>
              <th style={{ padding: "12px", textAlign: "center", borderBottom: "2px solid #dee2e6" }}>Actions & Images</th>
            </tr>
          </thead>
          <tbody>
            {variants
              .filter((v, index, self) => 
                // Remove duplicates by checking _id
                index === self.findIndex(t => t._id === v._id)
              )
              .map(variant => {
                console.log("Rendering variant:", variant._id, "attributes:", variant.attributes);
                return (
                  <VariantRow
                    key={variant._id}
                    variant={variant}
                    editingId={editingId}
                    onEdit={onEdit}
                    onUpdate={onUpdate}
                    onCancel={onCancel}
                    onStockUpdate={onStockUpdate}
                    onStatusToggle={onStatusToggle}
                    onDelete={onDelete}
                    onImageUpload={onImageUpload}
                    availableAttributes={availableAttributes}
                    productQuantity={productQuantity}
                    productBasePrice={productBasePrice}
                    productDiscountPrice={productDiscountPrice}
                    colorOnlyVariations={colorOnlyVariations}
                    productSizesForTable={productSizesForTable}
                  />
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/**
 * Main Product Variations Component
 */
const ProductVariationsTab = ({ productId, productName, productQuantity = -1, productBasePrice, productDiscountPrice, requiredAttributes = ["color"], attributeOrder: attributeOrderProp, productSizeIds = [], onVariantsChange, onNextTab }) => {
  const [variants, setVariants] = useState([]);
  const [loading, setLoading] = useState(false); // initial variants list fetch only
  const [creatingVariants, setCreatingVariants] = useState(false); // POST create — do not hide whole tab
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editingVariantId, setEditingVariantId] = useState(null);
  const [availableAttributes, setAvailableAttributes] = useState({ size: [], color: [], material: [] });
  const [selectedAttributes, setSelectedAttributes] = useState({ size: [], color: [], material: [] });
  const [stats, setStats] = useState({ total: 0, active: 0, outOfStock: 0, lowStock: 0, totalStock: 0 });
  const [viewMode, setViewMode] = useState('card'); // 'card' or 'list'
  const [deletePopup, setDeletePopup] = useState({
    isVisible: false,
    variantId: null,
    message: "",
    isPermanentDelete: false,
    action: "delete"
  });

  const lastProductIdRef = useRef(null);
  const isFetchingRef = useRef(false);
  const attributesFetchedRef = useRef(false);
  const currentProductIdRef = useRef(productId); // Track current productId for async operations
  
  // Update currentProductIdRef when productId prop changes
  useEffect(() => {
    currentProductIdRef.current = productId;
    console.log("Updated currentProductIdRef to:", productId);
  }, [productId]);

  const memoizedProductName = useMemo(() => productName || "Product", [productName]);

  const colorOnlyVariations = useMemo(
    () =>
      Array.isArray(requiredAttributes) &&
      requiredAttributes.includes("color") &&
      !requiredAttributes.includes("size"),
    [requiredAttributes]
  );

  const productSizesForTable = useMemo(() => {
    const ids = (productSizeIds || []).map(String).filter(Boolean);
    const pool = availableAttributes.size || [];
    if (ids.length === 0) return [];
    const set = new Set(ids);
    return pool.filter((s) => set.has(String(s._id)));
  }, [productSizeIds, availableAttributes.size]);

  const normalizeImageUrl = buildVariantImageUrl;

  // Normalize variants helper
  const normalizeVariants = useCallback((variants) => {
    return (variants || []).map(variant => {
      const normalizedPrimaryImage = buildVariantImageUrl(variant.primaryImage || variant.image);
      const normalizedImages = Array.isArray(variant.images)
        ? variant.images.map(img => buildVariantImageUrl(img)).filter(Boolean)
        : [];
      return {
        ...variant,
        primaryImage: normalizedPrimaryImage,
        image: normalizedPrimaryImage,
        images: normalizedImages
      };
    });
  }, []);

  // Debug: Log when variants change
  useEffect(() => {
    console.log("Variants state changed:", variants.length, "variants");
    if (variants.length > 0) {
      console.log("First variant:", variants[0]);
    }
  }, [variants]);

  // Fetch Attributes - same approach as SizeManager and ColorManager (only once)
  useEffect(() => {
    // Prevent duplicate fetches
    if (attributesFetchedRef.current) {
      console.log("Attributes already fetched, skipping...");
      return;
    }
    
    const fetchAttributes = async () => {
      try {
        console.log("Fetching sizes and colors from SizeManager and ColorManager endpoints...");
        attributesFetchedRef.current = true;
        
        // Use same endpoints as SizeManager and ColorManager
        const [sizesRes, colorsRes] = await Promise.all([
          api.get("/sizes?showInactive=true&includeDeleted=true"),
          api.get("/colors?showInactive=true&includeDeleted=true"),
        ]);
        
        // Filter to only active, non-deleted items (same filtering logic as managers)
        const activeSizes = (sizesRes.data || []).filter(
          size => size.isActive === true && !size.deleted
        );
        const activeColors = (colorsRes.data || []).filter(
          color => color.isActive === true && !color.deleted
        );
        
        console.log(`Loaded ${activeSizes.length} active sizes and ${activeColors.length} active colors`);
        
        setAvailableAttributes({ 
          size: activeSizes, 
          color: activeColors, 
          material: [] 
        });
      } catch (err) {
        console.error("Error fetching attributes:", err);
        setError(`Failed to load sizes/colors: ${err.response?.data?.msg || err.message}`);
        attributesFetchedRef.current = false; // Reset on error so it can retry
      }
    };
    fetchAttributes();
  }, []);

  // Extract unique attribute values from variants and pre-populate selected attributes
  const extractAttributesFromVariants = useCallback((variants) => {
    const extracted = { size: [], color: [], material: [] };
    
    variants.forEach(variant => {
      if (variant.attributes) {
        // Handle both Map and plain object formats
        const attrs = variant.attributes instanceof Map 
          ? Object.fromEntries(variant.attributes) 
          : variant.attributes;
        
        // Extract unique values for each attribute type
        Object.keys(attrs).forEach(key => {
          const value = attrs[key];
          if (value != null && value !== "") {
            const attrKey = key.toLowerCase();
            if (attrKey === 'size' || attrKey === 'color' || attrKey === 'material') {
              const str = String(value);
              if (!extracted[attrKey].includes(str)) {
                extracted[attrKey].push(str);
              }
            }
          }
        });
      }
    });
    
    return extracted;
  }, []);

  // Fetch Variants
  useEffect(() => {
    if (!productId) {
      console.log("No productId, skipping variant fetch");
      return;
    }
    
    // Fetch on initial mount or when productId changes (no duplicate refresh after inline create)
    const isProductIdChanged = productId !== lastProductIdRef.current;
    const isInitialMount = lastProductIdRef.current === null;
    const shouldRefresh = isInitialMount || isProductIdChanged;
    
    if (!shouldRefresh) {
      console.log("ProductId unchanged and no refresh trigger, skipping variant fetch");
      return;
    }
    
    // Only prevent duplicate fetches if we're already fetching AND productId hasn't changed
    if (isFetchingRef.current && !isProductIdChanged && !isInitialMount) {
      console.log("Already fetching variants, skipping duplicate request");
      return;
    }
    
    console.log("Fetching variants for productId:", productId, "isInitialMount:", isInitialMount);
    
    // Update refs BEFORE starting async operation
    lastProductIdRef.current = productId;
    currentProductIdRef.current = productId;
    isFetchingRef.current = true;

    // Capture productId at fetch time to compare later
    const fetchProductId = productId;
    const fetchTimestamp = Date.now(); // Track when fetch started
    let isMounted = true;

    const loadVariants = async () => {
      try {
        console.log("Setting loading to true for variant fetch");
        setLoading(true);
        setError("");
        const response = await api.get(`/products/${fetchProductId}/variants?includeDeleted=true`, {
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });
        console.log("Variants response:", response.data);
        console.log("Variants array:", response.data?.variants);
        console.log("Variants count:", response.data?.variants?.length);
        console.log("isMounted status:", isMounted);
        console.log("Current productId:", currentProductIdRef.current, "Fetch productId:", fetchProductId);
        console.log("About to update state with", response.data?.variants?.length || 0, "variants");
        
        // Only update state if productId hasn't changed during the fetch
        if (currentProductIdRef.current !== fetchProductId) {
          console.warn("ProductId changed during fetch, skipping state update");
          return;
        }
        
        const normalizedVariants = (response.data.variants || []).map(variant => {
          const normalizedPrimaryImage = buildVariantImageUrl(variant.primaryImage || variant.image);
          const normalizedImages = Array.isArray(variant.images)
            ? variant.images.map(img => buildVariantImageUrl(img)).filter(Boolean)
            : [];
          
          return {
            ...variant,
            primaryImage: normalizedPrimaryImage,
            image: normalizedPrimaryImage,
            images: normalizedImages
          };
        });
        
        console.log("Setting variants state with", normalizedVariants.length, "variants");
        console.log("Sample variant:", normalizedVariants[0]);
        
        // Always update state - React handles unmounted component warnings gracefully
        // Check isMounted only for loading state, not for data updates
        console.log("Calling setVariants with", normalizedVariants.length, "variants");
        console.log("Double-checking productId match:", currentProductIdRef.current === fetchProductId);
        
        // Always update state - React will handle unmounted component warnings
        // The productId check ensures we don't update state for a different product
        // But we still update if productId matches, even if component unmounted
        const shouldUpdate = currentProductIdRef.current === fetchProductId;
        console.log("Should update state?", shouldUpdate, "currentProductIdRef:", currentProductIdRef.current, "fetchProductId:", fetchProductId, "isMounted:", isMounted);
        
        // Update state if productId matches (even if unmounted - React handles warnings)
        if (shouldUpdate) {
          console.log("✅ Calling setVariants with", normalizedVariants.length, "variants");
          // Use direct state update - React will handle unmounted component warnings
          // The productId check above ensures we only update for the correct product
          setVariants(normalizedVariants);
          console.log("✅ setVariants called with", normalizedVariants.length, "variants");
          
          // Pre-populate selected attributes from existing variants
          if (normalizedVariants.length > 0) {
            const extractedAttributes = extractAttributesFromVariants(normalizedVariants);
            console.log("Extracted attributes from variants:", extractedAttributes);
            setSelectedAttributes(extractedAttributes);
          } else {
            // Clear attributes if no variants exist
            setSelectedAttributes({ size: [], color: [], material: [] });
          }
          
          setStats(response.data.stats || {
            total: 0,
            active: 0,
            outOfStock: 0,
            lowStock: 0,
            totalStock: 0
          });
          
          console.log(`✅ Successfully set ${normalizedVariants.length} variants in state`);
        } else {
          console.warn("⚠️ ProductId changed during fetch, state update skipped. Current:", currentProductIdRef.current, "Fetch:", fetchProductId);
        }
        
        // Always reset fetching flag, but only update loading if component is still mounted and productId matches
        isFetchingRef.current = false;
        if (isMounted && shouldUpdate) {
          console.log(`Loaded ${normalizedVariants.length} variants with normalized images`);
          console.log("Setting loading to false after successful variant fetch");
          setLoading(false);
        } else if (!isMounted) {
          console.warn("Component unmounted during fetch, but state was updated");
        } else if (!shouldUpdate) {
          console.warn("ProductId changed during fetch");
        }
      } catch (err) {
        console.error("Error fetching variants:", err);
        // Always update error state, but only update loading if mounted
        const errorMsg = err.response?.data?.msg || err.message || "Failed to load variants";
        setError(`Failed to load variants: ${errorMsg}`);
        setVariants([]);
        setStats({
          total: 0,
          active: 0,
          outOfStock: 0,
          lowStock: 0,
          totalStock: 0
        });
        if (isMounted) {
          console.log("Setting loading to false after variant fetch error");
          setLoading(false);
        }
      } finally {
        // Always reset fetching flag, but only update loading if mounted
        isFetchingRef.current = false;
        if (isMounted) {
          console.log("Variant fetch finally block - setting loading to false");
          setLoading(false);
        }
      }
    };
    loadVariants();
    return () => { 
      console.log("Cleanup: Setting isMounted to false for productId:", productId, "currentProductIdRef:", currentProductIdRef.current);
      isMounted = false;
      // Don't reset loading or variants on cleanup - let the new mount handle it
      // Only reset fetching flag if productId hasn't changed (to allow new fetch for new productId)
      if (currentProductIdRef.current === productId) {
        isFetchingRef.current = false;
      }
    };
  }, [productId]);
  
  // Ensure loading is reset after a delay (safety net)
  useEffect(() => {
    if (loading) {
      const timer = setTimeout(() => {
        console.log("Loading timeout - forcing loading to false");
        setLoading(false);
      }, 5000); // 5 second timeout
      return () => clearTimeout(timer);
    }
  }, [loading]);

  // Generate combinations from required attributes only (respects variation basis: color_only, size_only, size_and_color)
  const allowedKeys = Array.isArray(requiredAttributes) && requiredAttributes.length > 0 ? requiredAttributes : ["color", "size"];
  const generatedCombinations = useMemo(() => {
    const keys = allowedKeys.filter(k => selectedAttributes[k]?.length > 0);
    if (!keys.length) return [];
    const values = keys.map(k => selectedAttributes[k]);
    const combinations = values.reduce((acc, cur) => acc.flatMap(a => cur.map(v => [...a, v])), [[]]);
    return combinations;
  }, [selectedAttributes, allowedKeys]);

  const handleAttributeChange = useCallback((type, values) => {
    console.log(`Attribute changed - ${type}:`, values, "Type:", typeof values, "Is Array:", Array.isArray(values));
    setSelectedAttributes(prev => {
      const updated = { ...prev, [type]: values || [] };
      console.log("Updated selectedAttributes:", {
        ...updated,
        sizeLength: updated.size?.length || 0,
        colorLength: updated.color?.length || 0,
        sizeType: typeof updated.size,
        colorType: typeof updated.color
      });
      return updated;
    });
  }, []);

  const handleCreateVariants = async () => {
    if (!generatedCombinations.length) {
      setError("Select at least one attribute");
      return;
    }
    
    try {
      setCreatingVariants(true);
      setError("");
      setSuccess("");
      
      // Build attributes object from required attributes only (respects variation basis)
      const attrKeys = Array.isArray(requiredAttributes) && requiredAttributes.length > 0 ? requiredAttributes : ["color", "size"];
      const attributes = {};
      attrKeys.forEach(key => {
        if (selectedAttributes[key]?.length > 0) {
          attributes[key] = selectedAttributes[key].map(String);
        }
      });
      
      console.log("Creating variants with attributes:", attributes);
      
      // Send attributes object - backend will generate combinations
      const response = await api.post(`/products/${productId}/variants`, { 
        attributes 
      });
      
      console.log("Variants created:", response.data);
      
      if (response.data.variants && response.data.variants.length > 0) {
        setSuccess(`✅ Created ${response.data.variants.length} variant(s) successfully!`);
      }
      
      // Show errors if any
      if (response.data.errors && response.data.errors.length > 0) {
        const duplicateErrors = response.data.errors.filter(e => 
          e.error && e.error.includes("Duplicate")
        );
        const stockErrors = response.data.errors.filter(e => 
          e.error && e.error.includes("cannot be greater than product stock")
        );
        const otherErrors = response.data.errors.filter(e => 
          !e.error || (!e.error.includes("Duplicate") && !e.error.includes("cannot be greater than product stock"))
        );
        
        // Get attribute names for better error message
        const getAttributeNames = (attributes) => {
          const names = [];
          for (const [key, value] of Object.entries(attributes)) {
            if (key === "color" && availableAttributes.color) {
              const color = availableAttributes.color.find(c => String(c._id) === String(value));
              if (color) names.push(`Color: ${color.name}`);
            } else if (key === "size" && availableAttributes.size) {
              const size = availableAttributes.size.find(s => String(s._id) === String(value));
              if (size) names.push(`Size: ${size.name}`);
            } else if (key === "material" && availableAttributes.material) {
              const material = availableAttributes.material.find(m => String(m._id) === String(value));
              if (material) names.push(`Material: ${material.name}`);
            } else {
              names.push(`${key}: ${value}`);
            }
          }
          return names.join(", ");
        };
        
        let errorMessage = "";
        
        // Show stock validation errors prominently
        if (stockErrors.length > 0) {
          const stockMessages = stockErrors.map(e => {
            const attrNames = getAttributeNames(e.attributes || {});
            return attrNames ? `${attrNames}: ${e.error}` : e.error;
          });
          errorMessage = `❌ Stock Validation Error:\n\n${stockMessages.join("\n\n")}`;
        }
        
        if (duplicateErrors.length > 0) {
          const duplicateMessages = duplicateErrors.map(e => getAttributeNames(e.attributes));
          
          if (errorMessage) errorMessage += "\n\n";
          errorMessage += `⚠️ ${duplicateErrors.length} variant(s) already exist with these combinations:\n`;
          errorMessage += duplicateMessages.map((msg, idx) => `${idx + 1}. ${msg}`).join("\n");
          errorMessage += "\n\nThese variants are already created. Please select different combinations or edit the existing variants below.";
        }
        
        if (otherErrors.length > 0) {
          const otherMessages = otherErrors.map(e => 
            `${getAttributeNames(e.attributes || {})}: ${e.error}`
          ).join("; ");
          errorMessage += (errorMessage ? "\n\n" : "") + `⚠️ Additional errors: ${otherMessages}`;
        }
        
        if (response.data.variants && response.data.variants.length === 0 && errorMessage) {
          // If no variants were created and there are errors, show error
          setError(errorMessage);
        } else if (errorMessage) {
          // If some variants were created but there are errors, show both success and error
          setSuccess(`✅ Created ${response.data.variants.length} variant(s) successfully!`);
          // Show error after a short delay so both messages are visible
          setTimeout(() => {
            setError(errorMessage);
          }, 100);
        }
      } else if (!response.data.variants || response.data.variants.length === 0) {
        setError("No variants were created. Please check your selections.");
      }
      
      // Always refresh variants list to show existing variants
      const updated = await api.get(`/products/${productId}/variants`, {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      console.log("Refresh response:", updated.data);
      console.log("Refresh variants array:", updated.data?.variants);
      console.log("Refresh variants count:", updated.data?.variants?.length);
      const normalized = normalizeVariants(updated.data.variants || []);
      console.log("Refreshing variants after creation:", normalized.length, "variants");
      console.log("Normalized variants data:", normalized);
      console.log("Setting variants state with", normalized.length, "variants");
      setVariants(normalized);
      
      // Update selected attributes based on all existing variants (including newly created ones)
      if (normalized.length > 0) {
        const extractedAttributes = extractAttributesFromVariants(normalized);
        console.log("Updating selected attributes from all variants:", extractedAttributes);
        setSelectedAttributes(extractedAttributes);
      }
      
      setStats(updated.data.stats || {
        total: 0,
        active: 0,
        outOfStock: 0,
        lowStock: 0,
        totalStock: 0
      });
      
      // Notify parent component
      if (onVariantsChange) {
        setTimeout(() => {
          onVariantsChange(normalized);
        }, 0);
      }
      
      // Clear selections only if variants were created successfully
      if (response.data.variants && response.data.variants.length > 0) {
        setSelectedAttributes({ size: [], color: [], material: [] });
      }
      
    } catch (err) {
      console.error("Error creating variants:", err);
      const errorMsg = err.response?.data?.msg || err.response?.data?.error || "Failed to create variants";
      // Check if it's a stock validation error
      if (errorMsg.includes("cannot be greater than product stock")) {
        setError(`❌ Stock Validation Error: ${errorMsg}`);
      } else {
        setError(`❌ ${errorMsg}`);
      }
    } finally { 
      setCreatingVariants(false); 
    }
  };

  // Handlers (optimistic)
  const handleEdit = (variant) => setEditingVariantId(variant._id);
  const handleCancel = () => setEditingVariantId(null);

  const handleUpdate = async (variantId, formData, uploadOpts = {}) => {
    const { primaryFile } = uploadOpts || {};
    try {
      setLoading(true);
      setError("");
      
      // Find the original variant to get actual URLs (not blob URLs)
      const originalVariant = variants.find(v => v._id === variantId);
      if (!originalVariant) {
        setError("Variant not found");
        setLoading(false);
        return;
      }
      
      // Filter out blob URLs from images - only keep actual URLs
      const actualImages = (formData.images || []).filter(img => {
        // Keep if it's a string URL (not a blob URL)
        if (typeof img === 'string') {
          // Blob URLs start with 'blob:'
          return !img.startsWith('blob:');
        }
        return false;
      });
      
      // Use actual primaryImage URL (not blob URL)
      let actualPrimaryImage = formData.primaryImage;
      if (actualPrimaryImage && typeof actualPrimaryImage === 'string' && actualPrimaryImage.startsWith('blob:')) {
        // If it's a blob URL, use the original image URL
        actualPrimaryImage = originalVariant.primaryImage || originalVariant.image || null;
      }
      
      const stockNum = (() => {
        const s = formData.stock;
        if (s === "" || s === undefined || s === null) return 0;
        const n = parseInt(String(s).trim(), 10);
        return Number.isNaN(n) ? 0 : n;
      })();

      let discountedPayload = null;
      if (formData.discountedPrice === "" || formData.discountedPrice == null) {
        discountedPayload = null;
      } else {
        const n = parseFloat(formData.discountedPrice);
        discountedPayload = Number.isNaN(n) ? null : n;
      }

      // Prepare update payload - only send actual data, not blob URLs
      const updatePayload = {
        price: parseFloat(formData.price) || 0,
        discountedPrice: discountedPayload,
        stock: stockNum,
        sku: formData.sku || "",
        isActive: formData.isActive !== undefined ? formData.isActive : true
      };
      if (Array.isArray(formData.sizeStock) && formData.sizeStock.length > 0) {
        updatePayload.sizeStock = formData.sizeStock;
      } else if (originalVariant?.sizeStock?.length > 0) {
        delete updatePayload.stock;
      }
      
      // Only include images if they're actual URLs (not blob URLs)
      if (actualImages.length > 0) {
        updatePayload.images = actualImages;
      }
      
      // Only include primaryImage if it's an actual URL (not blob URL)
      if (actualPrimaryImage && !actualPrimaryImage.startsWith('blob:')) {
        updatePayload.primaryImage = actualPrimaryImage;
      } else if (actualPrimaryImage === null) {
        // Explicitly set to null to remove image
        updatePayload.primaryImage = null;
      }
      
      console.log("Updating variant with payload:", updatePayload, "primaryFile:", !!primaryFile);
      
      if (primaryFile) {
        const fd = new FormData();
        fd.append("price", String(parseFloat(formData.price) || 0));
        fd.append("discountedPrice", formData.discountedPrice === "" || formData.discountedPrice == null ? "" : String(parseFloat(formData.discountedPrice)));
        fd.append("stock", String(stockNum));
        fd.append("sku", formData.sku || "");
        fd.append("isActive", String(formData.isActive !== undefined ? formData.isActive : true));
        if (Array.isArray(formData.sizeStock) && formData.sizeStock.length > 0) {
          fd.append("sizeStock", JSON.stringify(formData.sizeStock));
        }
        fd.append("primaryImage", primaryFile);
        await api.put(`/variants/${variantId}`, fd);
      } else {
        await api.put(`/variants/${variantId}`, updatePayload);
      }
      
      // Refresh variants to get updated data from server
      const updated = await api.get(`/products/${productId}/variants`);
      const normalized = normalizeVariants(updated.data.variants || []);
      setVariants(normalized);
      
      // Update selected attributes to reflect all existing variants
      if (normalized.length > 0) {
        const extractedAttributes = extractAttributesFromVariants(normalized);
        setSelectedAttributes(extractedAttributes);
      }
      
      setStats(updated.data.stats || {
        total: 0,
        active: 0,
        outOfStock: 0,
        lowStock: 0,
        totalStock: 0
      });

      setSuccess("✅ Variant updated successfully");
      
      // Auto-clear success message and move to next tab
      setTimeout(() => {
        setSuccess("");
        // Move to next tab if callback provided
        if (onNextTab) {
          onNextTab();
        }
      }, 1500); // Show success message for 1.5 seconds, then move to next tab
    } catch (err) {
      console.error("Failed to update variant:", err);
      // Refresh to get correct state so card view shows server data
      const updated = await api.get(`/products/${productId}/variants`);
      setVariants(normalizeVariants(updated.data.variants || []));
      const errorMsg = err.response?.data?.msg || err.message;
      // Check if it's a stock validation error
      if (errorMsg.includes("cannot be greater than product stock")) {
        setError(`❌ Stock Validation Error: ${errorMsg}`);
      } else {
        setError(`Failed to update variant: ${errorMsg}`);
      }
    } finally {
      setEditingVariantId(null); // Always exit edit mode so card shows latest data
      setLoading(false);
    }
  };

  const handleStockUpdate = async (variantId, stock) => {
    const variant = variants.find(v => v._id === variantId);
    if (!variant) return;
    
    const newStock =
      typeof stock === "number" && !Number.isNaN(stock)
        ? stock
        : parseInt(String(stock).trim(), 10);
    const newStockNum = Number.isNaN(newStock) ? 0 : newStock;
    
    if (productQuantity >= 0 && newStockNum < 0) {
      setError("Unlimited variant quantity (-1) is only allowed when product inventory is unlimited.");
      setVariants(prev => prev.map(v => (v._id === variantId ? { ...v, stock: variant.stock } : v)));
      return;
    }
    
    // Validate against product quantity if product has stock tracking enabled
    if (productQuantity >= 0) {
      const otherVariantsStock = variants
        .filter(v => v._id !== variantId)
        .reduce((sum, v) => {
          const s = Number(v.stock);
          if (s < 0) return sum;
          return sum + (Number.isFinite(s) ? s : 0);
        }, 0);
      
      const totalStock = otherVariantsStock + newStockNum;
      
      if (totalStock > productQuantity) {
        const availableStock = productQuantity - otherVariantsStock;
        setError(`❌ Stock Validation Error: Total variant stock (${totalStock}) exceeds product stock (${productQuantity}). Available stock for this variant: ${availableStock >= 0 ? availableStock : 0}`);
        // Rollback to previous stock
        setVariants(prev => prev.map(v => v._id === variantId ? { ...v, stock: variant.stock } : v));
        return;
      }
    }
    
    const prevStock = variant.stock;
    setVariants(prev => prev.map(v => v._id === variantId ? { ...v, stock: newStockNum } : v));
    setError(""); // Clear any previous errors
    
    try {
      await api.put(`/variants/${variantId}`, { stock: newStockNum });
      // Refresh to get updated data
      const updated = await api.get(`/products/${productId}/variants?includeDeleted=true`);
      const normalized = normalizeVariants(updated.data.variants || []);
      setVariants(normalized);
      
      // Update selected attributes to reflect all existing variants
      if (normalized.length > 0) {
        const extractedAttributes = extractAttributesFromVariants(normalized);
        setSelectedAttributes(extractedAttributes);
      }
      
      setStats(updated.data.stats || {
        total: 0,
        active: 0,
        outOfStock: 0,
        lowStock: 0,
        totalStock: 0
      });
      
      setSuccess(`✅ Stock updated successfully`);
      // Auto-clear success message after 3 seconds
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      // Rollback on error
      setVariants(prev => prev.map(v => v._id === variantId ? { ...v, stock: prevStock } : v));
      const errorMsg = err.response?.data?.msg || err.message;
      // Check if it's a stock validation error
      if (errorMsg.includes("cannot be greater than product stock")) {
        setError(`❌ Stock Validation Error: ${errorMsg}`);
      } else {
        setError(`❌ Failed to update stock: ${errorMsg}`);
      }
      console.error("Failed to update stock:", err);
    }
  };

  const handleStatusToggle = async (variantId, isActive) => {
    const variant = variants.find(v => v._id === variantId);
    if (!variant) return;
    
    const newStatus = !isActive;
    setVariants(prev => prev.map(v => v._id === variantId ? { ...v, isActive: newStatus } : v));
    try {
      await api.put(`/variants/${variantId}`, { isActive: newStatus });
      // Refresh to get updated data
      const updated = await api.get(`/products/${productId}/variants?includeDeleted=true`);
      const normalized = normalizeVariants(updated.data.variants || []);
      setVariants(normalized);
      
      // Update selected attributes to reflect all existing variants
      if (normalized.length > 0) {
        const extractedAttributes = extractAttributesFromVariants(normalized);
        setSelectedAttributes(extractedAttributes);
      }
      
      setStats(updated.data.stats || {
        total: 0,
        active: 0,
        outOfStock: 0,
        lowStock: 0,
        totalStock: 0
      });
    } catch (err) {
      // Rollback on error
      setVariants(prev => prev.map(v => v._id === variantId ? { ...v, isActive } : v));
      console.error("Failed to toggle status:", err);
    }
  };

  const handleDelete = (variantId) => {
    const variant = variants.find(v => v._id === variantId);
    if (!variant) {
      setError("Variant not found");
      return;
    }
    
    const isAlreadyDeleted = variant?.deleted;
    
    let message;
    let isPermanentDelete = false;
    
    if (isAlreadyDeleted) {
      message = "This variant is already marked as deleted. Click OK to permanently remove it from the database. This action cannot be undone.";
      isPermanentDelete = true;
    } else {
      message = "This will mark the variant as inactive and add a deleted flag. Click OK to continue.";
      isPermanentDelete = false;
    }
    
    setDeletePopup({
      isVisible: true,
      variantId,
      message,
      isPermanentDelete,
      action: "delete"
    });
  };

  const handleDeleteConfirm = async () => {
    const { variantId, isPermanentDelete } = deletePopup;
    const variant = variants.find(v => v._id === variantId);
    
    if (!variant) {
      setError("Variant not found");
      setDeletePopup({
        isVisible: false,
        variantId: null,
        message: "",
        isPermanentDelete: false,
        action: "delete"
      });
      return;
    }
    
    const prevVariants = variants;
    setVariants(prev => prev.filter(v => v._id !== variantId));
    
    try {
      setLoading(true);
      setError("");
      setSuccess("");
      
      if (isPermanentDelete) {
        await api.delete(`/variants/${variantId}/hard`);
        setSuccess(`🗑️ Variant has been permanently deleted from the database.`);
      } else {
        // Soft delete - call the delete endpoint which will set deleted flag
        await api.delete(`/variants/${variantId}`);
        setSuccess(`⏸️ Variant has been marked as deleted and inactive.`);
      }
      
      // Refresh to get updated data
      const updated = await api.get(`/products/${productId}/variants?includeDeleted=true`);
      const normalized = normalizeVariants(updated.data.variants || []);
      setVariants(normalized);
      
      // Update selected attributes to reflect remaining variants
      if (normalized.length > 0) {
        const extractedAttributes = extractAttributesFromVariants(normalized);
        setSelectedAttributes(extractedAttributes);
      } else {
        // Clear attributes if no variants remain
        setSelectedAttributes({ size: [], color: [], material: [] });
      }
      
      setStats(updated.data.stats || {
        total: 0,
        active: 0,
        outOfStock: 0,
        lowStock: 0,
        totalStock: 0
      });
    } catch (err) {
      // Rollback on error
      setVariants(prevVariants);
      const action = isPermanentDelete ? "permanently delete" : "mark as deleted";
      setError(`❌ Failed to ${action} variant. ${err.response?.data?.msg || err.message || 'Please try again.'}`);
    } finally {
      setLoading(false);
      setDeletePopup({
        isVisible: false,
        variantId: null,
        message: "",
        isPermanentDelete: false,
        action: "delete"
      });
    }
  };

  const handleDeleteCancel = () => {
    setDeletePopup({
      isVisible: false,
      variantId: null,
      message: "",
      isPermanentDelete: false,
      action: "delete"
    });
  };

  const handleImageUpload = async (variantId, file, type = "primary") => {
    // Refresh variant data from server after image upload/removal
    try {
      const updated = await api.get(`/products/${productId}/variants`);
      const normalized = normalizeVariants(updated.data.variants || []);
      setVariants(normalized);
      
      // Update selected attributes to reflect all existing variants
      if (normalized.length > 0) {
        const extractedAttributes = extractAttributesFromVariants(normalized);
        setSelectedAttributes(extractedAttributes);
      }
      
      setStats(updated.data.stats || {
        total: 0,
        active: 0,
        outOfStock: 0,
        lowStock: 0,
        totalStock: 0
      });
    } catch (err) {
      console.error("Failed to refresh variants after image change:", err);
    }
  };


  // Prevent Enter key from submitting the parent form
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  // Sort variants by attribute order (color first => group by color then size; size first => group by size then color)
  const sortedVariants = useMemo(() => {
    const order = Array.isArray(attributeOrderProp) && attributeOrderProp.length > 0 ? attributeOrderProp : ["color", "size"];
    return [...variants].sort((a, b) => {
      const attrsA = a.attributes instanceof Map ? Object.fromEntries(a.attributes) : (a.attributes || {});
      const attrsB = b.attributes instanceof Map ? Object.fromEntries(b.attributes) : (b.attributes || {});
      for (const key of order) {
        const valA = attrsA[key]?.toString?.() ?? attrsA[key] ?? "";
        const valB = attrsB[key]?.toString?.() ?? attrsB[key] ?? "";
        if (valA !== valB) return valA.localeCompare(valB, undefined, { numeric: true });
      }
      return 0;
    });
  }, [variants, attributeOrderProp]);

  return (
    <div onKeyDown={handleKeyDown}>
      {error && <AlertMessage type="error" message={error} />}
      {success && <AlertMessage type="success" message={success} />}

      {loading && (
        <div style={{ padding: "20px", textAlign: "center", color: "#666" }}>
          Loading variants...
        </div>
      )}

      {!loading && (
        <>
          <VariantStats stats={stats} />

          <CreateVariantsForm
            availableAttributes={availableAttributes}
            selectedAttributes={selectedAttributes}
            onAttributeChange={handleAttributeChange}
            onCreate={handleCreateVariants}
            loading={creatingVariants}
            generatedCount={generatedCombinations.length}
            requiredAttributes={requiredAttributes}
            attributeOrder={attributeOrderProp}
          />

          {/* View Toggle */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <h3 style={{ fontSize: "18px", fontWeight: "600", margin: 0 }}>
              Variants ({variants.length})
            </h3>
            <ViewToggle
              viewMode={viewMode}
              onViewChange={setViewMode}
              disabled={loading}
            />
          </div>

          {variants.length === 0 ? (
            <div style={{ 
              padding: "40px", 
              textAlign: "center", 
              backgroundColor: "#f8f9fa", 
              borderRadius: "8px",
              border: "1px dashed #dee2e6"
            }}>
              <div style={{ fontSize: "48px", marginBottom: "16px" }}>📦</div>
              <h3 style={{ fontSize: "18px", fontWeight: "600", color: "#495057", marginBottom: "8px" }}>
                No Variants Found
              </h3>
              <p style={{ fontSize: "14px", color: "#6c757d", marginBottom: "20px" }}>
                Create your first variant by selecting attributes above and clicking "Generate Variant(s)".
              </p>
            </div>
          ) : (
            <>
              {/* Card View */}
              {viewMode === 'card' && (
                <VariantCardGrid
                  variants={sortedVariants}
                  editingId={editingVariantId}
                  onEdit={handleEdit}
                  onUpdate={handleUpdate}
                  onCancel={handleCancel}
                  onStockUpdate={handleStockUpdate}
                  onStatusToggle={handleStatusToggle}
                  onDelete={handleDelete}
                  onImageUpload={handleImageUpload}
                  availableAttributes={availableAttributes}
                  productQuantity={productQuantity}
                  productBasePrice={productBasePrice}
                  productDiscountPrice={productDiscountPrice}
                  colorOnlyVariations={colorOnlyVariations}
                  productSizesForTable={productSizesForTable}
                />
              )}

              {/* List/Table View */}
              {viewMode === 'list' && (
                <VariantTable
                  variants={sortedVariants}
                  editingId={editingVariantId}
                  onEdit={handleEdit}
                  onUpdate={handleUpdate}
                  onCancel={handleCancel}
                  onStockUpdate={handleStockUpdate}
                  onStatusToggle={handleStatusToggle}
                  onDelete={handleDelete}
                  onImageUpload={handleImageUpload}
                  availableAttributes={availableAttributes}
                  productQuantity={productQuantity}
                  productBasePrice={productBasePrice}
                  productDiscountPrice={productDiscountPrice}
                  colorOnlyVariations={colorOnlyVariations}
                  productSizesForTable={productSizesForTable}
                />
              )}
            </>
          )}
        </>
      )}

      <DeleteConfirmationPopup
        isVisible={deletePopup.isVisible}
        message={deletePopup.message}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
        confirmText={deletePopup.isPermanentDelete ? "Final Del" : "Delete"}
        cancelText="Cancel"
        loading={loading}
      />
    </div>
  );
};

export default ProductVariationsTab;
