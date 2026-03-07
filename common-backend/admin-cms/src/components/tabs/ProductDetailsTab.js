import React, { useState, useRef, useEffect } from "react"
import { FormField } from "../../common"
import SearchableSelect from "../../common/SearchableSelect"
import RichTextEditor from "../CKEditor"

/** Multi-select dropdown styled like SearchableSelect (same as other Product Attributes). */
const MultiSelectDropdown = ({ label, options, value = [], onChange, placeholder = "Type to search...", info }) => {
  const [isOpen, setIsOpen] = useState(false)
  const wrapperRef = useRef(null)
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setIsOpen(false)
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])
  const selectedIds = Array.isArray(value) ? value : []
  const toggle = (id) => {
    const next = selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]
    onChange(next)
  }
  const displayText = selectedIds.length === 0 ? placeholder : selectedIds.length === 1
    ? (options.find(o => o.value === selectedIds[0])?.label ?? "1 selected")
    : `${selectedIds.length} selected`
  const inputStyle = {
    width: "100%",
    padding: "12px 40px 12px 16px",
    border: isOpen ? "2px solid #667eea" : "2px solid #e5e7eb",
    borderRadius: "8px",
    fontSize: "1rem",
    background: isOpen ? "white" : "#f9fafb",
    outline: "none",
    transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
    boxSizing: "border-box",
    boxShadow: isOpen ? "0 0 0 4px rgba(102, 126, 234, 0.15)" : "none",
    cursor: "pointer",
    textAlign: "left",
    color: selectedIds.length ? "#111" : "#6b7280",
  }
  return (
    <div className="searchableSelectWrapper" ref={wrapperRef} style={{ position: "relative" }}>
      {label && <label className="formLabel">{label}</label>}
      <div className="searchableSelectContainer" style={{ position: "relative" }}>
        <div
          className="searchableSelectInputWrapper"
          role="button"
          tabIndex={0}
          onClick={() => setIsOpen((o) => !o)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setIsOpen((o) => !o) } }}
        >
          <div style={inputStyle}>
            {displayText}
          </div>
          <span
            className="searchableSelectArrow"
            style={{
              position: "absolute",
              right: "8px",
              top: "50%",
              transform: isOpen ? "translateY(-50%) rotate(180deg)" : "translateY(-50%)",
              width: "16px",
              height: "16px",
              display: "inline-block",
              backgroundRepeat: "no-repeat",
              backgroundPosition: "center",
              backgroundSize: "16px",
              transition: "transform 0.2s ease",
              pointerEvents: "none",
            }}
          />
        </div>
        {isOpen && (
          <div
            className="searchableSelectDropdown"
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              right: 0,
              backgroundColor: "#fff",
              border: "1px solid #ced4da",
              borderTop: "none",
              borderRadius: "0 0 4px 4px",
              maxHeight: "200px",
              overflowY: "auto",
              zIndex: 1000,
              boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
            }}
          >
            {options.length === 0 ? (
              <div style={{ padding: "12px", textAlign: "center", color: "#666", fontSize: "14px" }}>No options found</div>
            ) : (
              options.map((opt, index) => (
                <label
                  key={opt.value}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "10px 12px",
                    cursor: "pointer",
                    backgroundColor: selectedIds.includes(opt.value) ? "#e7f3ff" : "#fff",
                    borderBottom: index < options.length - 1 ? "1px solid #f0f0f0" : "none",
                    fontSize: "14px",
                    transition: "background-color 0.2s",
                  }}
                >
                  <input type="checkbox" checked={selectedIds.includes(opt.value)} onChange={() => toggle(opt.value)} />
                  <span>{opt.label}</span>
                </label>
              ))
            )}
          </div>
        )}
      </div>
      {info && <div className="formInfo" style={{ fontSize: "12px", color: "#666", marginTop: "4px" }}>{info}</div>}
    </div>
  )
}

const ProductDetailsTab = ({
  formData,
  handleInputChange,
  handleMultiSelect,
  categories,
  subcategories,
  brands,
  gstSlabs,
  collarStyles,
  materials,
  patterns,
  fitTypes,
  sleeveTypes,
  printingTypes,
  countries,
  lengths,
  widths,
  heights,
  colors = [],
  sizes = [],
  categorySupportsVariations = false,
  getUnitAbbreviation
}) => {
  return (
    <div>
      {/* Product Type Selection - Controls visibility of customization sections */}
      <div style={{ marginBottom: "30px" }}>
        <h3 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "20px", color: "#444444", borderBottom: "2px solid #444444", paddingBottom: "12px", paddingTop: "8px" }}>
          Product Type
        </h3>
        <FormField
          type="select"
          name="productType"
          label="Product Type"
          value={formData.productType}
          onChange={handleInputChange}
          required={true}
          options={[
            { value: "standard", label: "Standard Product (Non-customized)" },
            { value: "customized", label: "Customized Product (Personalized)" }
          ]}
          info="Select 'Standard' for regular products or 'Customized' for personalized products with templates"
        />
      </div>

      {/* Category, Subcategory, Brand, Tags */}
      <div style={{ marginBottom: "30px" }}>
        <h3 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "20px", color: "#444444", borderBottom: "2px solid #444444", paddingBottom: "12px", paddingTop: "8px" }}>
          Categories & Classification
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
          <div>
            <FormField
              type="select"
              name="category"
              label="Category"
              value={formData.category != null ? String(formData.category) : ""}
              onChange={handleInputChange}
              required={true}
              options={[
                { value: "", label: "Select Category" },
                ...categories
                  .filter(cat => (!cat.deleted && cat.isActive) || (formData.category && String(cat._id) === String(formData.category)))
                  .map(cat => ({
                    value: String(cat._id),
                    label: `${cat.name} ${cat.categoryId ? `(${cat.categoryId})` : ""}${!cat.isActive ? " (Inactive)" : ""}`
                  }))
              ]}
            />
          </div>
          <div>
            <FormField
              type="select"
              name="subcategory"
              label="Subcategory"
              value={formData.subcategory != null ? String(formData.subcategory) : ""}
              onChange={handleInputChange}
              disabled={!formData.category}
              options={[
                { value: "", label: formData.category ? "Select Subcategory" : "Select category first" },
                ...subcategories
                  .filter(sub => {
                    const matchesCategory = !formData.category || sub.categoryId?.toString() === formData.category || sub.categoryId?._id?.toString() === formData.category
                    const isActive = !sub.deleted && sub.isActive
                    const isSelected = formData.subcategory && String(sub._id) === String(formData.subcategory)
                    return (matchesCategory && isActive) || isSelected
                  })
                  .map(sub => ({
                    value: String(sub._id),
                    label: `${sub.name} ${sub.subcategoryId ? `(${sub.subcategoryId})` : ""}${!sub.isActive ? " (Inactive)" : ""}`
                  }))
              ]}
            />
            {formData.category && (
              <p style={{ fontSize: "12px", color: "#666", marginTop: "5px" }}>
                {subcategories.filter(sub => {
                  const matchesCategory = sub.categoryId?.toString() === formData.category || sub.categoryId?._id?.toString() === formData.category
                  return matchesCategory && !sub.deleted && sub.isActive
                }).length} subcategory(ies) available for this category
              </p>
            )}
          </div>
          <div>
            <FormField
              type="select"
              name="brand"
              label="Brand"
              value={formData.brand != null ? String(formData.brand) : ""}
              onChange={handleInputChange}
              options={[
                { value: "", label: "Select Brand" },
                ...brands
                  .filter(brand => (!brand.deleted && brand.isActive) || (formData.brand && String(brand._id) === String(formData.brand)))
                  .map(brand => ({
                    value: String(brand._id),
                    label: `${brand.name} ${brand.brandId ? `(${brand.brandId})` : ""}${!brand.isActive ? " (Inactive)" : ""}`
                  }))
              ]}
            />
          </div>
          <div>
            <FormField
              type="text"
              name="tags"
              label="Tags (comma-separated)"
              value={formData.tags ?? ""}
              onChange={handleInputChange}
              placeholder="tag1, tag2, tag3"
            />
          </div>
          <div>
            <FormField
              type="text"
              name="sku"
              label="SKU (Optional, unique per tenant)"
              value={formData.sku}
              onChange={handleInputChange}
              placeholder="Enter 10 alphanumeric characters"
              maxLength={10}
              info="Must be exactly 10 alphanumeric characters (A-Z, 0-9). Auto-generated if left empty."
            />
          </div>
        </div>
      </div>

      {/* Basic Product Information */}
      <div style={{ marginBottom: "30px" }}>
        <h3 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "20px", color: "#444444", borderBottom: "2px solid #444444", paddingBottom: "12px", paddingTop: "8px" }}>
          Basic Information
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
          <div style={{ gridColumn: "1 / -1" }}>
            <FormField
              type="text"
              name="name"
              label="Product Name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="Enter product name"
              required={true}
            />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <FormField
              type="textarea"
              name="shortDescription"
              label="Short Description"
              value={formData.shortDescription ?? ""}
              onChange={handleInputChange}
              placeholder="Brief product description"
              rows={3}
            />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <RichTextEditor
              name="longDescription"
              label="Long Description"
              value={formData.longDescription || ""}
              onChange={handleInputChange}
              placeholder="Detailed product description (supports bold, lists, links, images, etc.)"
            />
          </div>
          <div>
            <FormField
              type="select"
              name="productStatus"
              label="Product Status"
              value={formData.productStatus}
              onChange={handleInputChange}
              options={[
                { value: "draft", label: "Draft" },
                { value: "active", label: "Active" },
                { value: "archived", label: "Archived" }
              ]}
            />
          </div>
        </div>
      </div>

      {/* Product Attributes Section */}
      <div style={{ marginBottom: "30px" }}>
        <h3 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "20px", color: "#444444", borderBottom: "2px solid #444444", paddingBottom: "12px", paddingTop: "8px" }}>
          Product Attributes
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "15px" }}>
          <MultiSelectDropdown
            label="Color (Optional)"
            options={(colors || []).filter(c => !c.deleted && c.isActive !== false).map(c => ({
              value: String(c._id),
              label: c.name + (c.code ? ` (${c.code})` : "")
            }))}
            value={formData.selectedColors || []}
            onChange={(arr) => handleMultiSelect && handleMultiSelect("selectedColors", arr)}
            placeholder="Type to search colors..."
            info="From Color Manager."
          />
          <MultiSelectDropdown
            label="Size (Optional)"
            options={(sizes || []).filter(s => !s.deleted && s.isActive !== false).map(s => ({
              value: String(s._id),
              label: s.name + (s.initial ? ` (${s.initial})` : "")
            }))}
            value={formData.selectedSizes || []}
            onChange={(arr) => handleMultiSelect && handleMultiSelect("selectedSizes", arr)}
            placeholder="Type to search sizes..."
            info="From Size Manager."
          />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
          <div>
            <SearchableSelect
              name="collarStyle"
              label="Collar Style (Optional)"
              value={formData.collarStyle != null ? String(formData.collarStyle) : ""}
              onChange={handleInputChange}
              placeholder="Type to search collar styles..."
              options={(collarStyles || [])
                .filter(collarStyle => (!collarStyle.deleted && collarStyle.isActive) || (formData.collarStyle && String(collarStyle._id) === String(formData.collarStyle)))
                .map(collarStyle => ({
                  value: String(collarStyle._id),
                  label: `${collarStyle.name}${!collarStyle.isActive ? " (Inactive)" : ""}`
                }))}
            />
          </div>
          <div>
            <SearchableSelect
              name="material"
              label="Material (Optional)"
              value={formData.material != null ? String(formData.material) : ""}
              onChange={handleInputChange}
              placeholder="Type to search materials..."
              options={(materials || [])
                .filter(material => (!material.deleted && material.isActive) || (formData.material && String(material._id) === String(formData.material)))
                .map(material => ({
                  value: String(material._id),
                  label: `${material.name}${!material.isActive ? " (Inactive)" : ""}`
                }))}
            />
          </div>
          <div>
            <SearchableSelect
              name="pattern"
              label="Pattern (Optional)"
              value={formData.pattern != null ? String(formData.pattern) : ""}
              onChange={handleInputChange}
              placeholder="Type to search patterns..."
              options={(patterns || [])
                .filter(pattern => (!pattern.deleted && pattern.isActive) || (formData.pattern && String(pattern._id) === String(formData.pattern)))
                .map(pattern => ({
                  value: String(pattern._id),
                  label: `${pattern.name}${!pattern.isActive ? " (Inactive)" : ""}`
                }))}
            />
          </div>
          <div>
            <SearchableSelect
              name="fitType"
              label="Fit Type (Optional)"
              value={formData.fitType != null ? String(formData.fitType) : ""}
              onChange={handleInputChange}
              placeholder="Type to search fit types..."
              options={(fitTypes || [])
                .filter(fitType => (!fitType.deleted && fitType.isActive) || (formData.fitType && String(fitType._id) === String(formData.fitType)))
                .map(fitType => ({
                  value: String(fitType._id),
                  label: `${fitType.name}${!fitType.isActive ? " (Inactive)" : ""}`
                }))}
            />
          </div>
          <div>
            <SearchableSelect
              name="sleeveType"
              label="Sleeve Type (Optional)"
              value={formData.sleeveType != null ? String(formData.sleeveType) : ""}
              onChange={handleInputChange}
              placeholder="Type to search sleeve types..."
              options={(sleeveTypes || [])
                .filter(sleeveType => (!sleeveType.deleted && sleeveType.isActive) || (formData.sleeveType && String(sleeveType._id) === String(formData.sleeveType)))
                .map(sleeveType => ({
                  value: String(sleeveType._id),
                  label: `${sleeveType.name}${!sleeveType.isActive ? " (Inactive)" : ""}`
                }))}
            />
          </div>
          <div>
            <SearchableSelect
              name="printingType"
              label="Printing Type (Optional)"
              value={formData.printingType != null ? String(formData.printingType) : ""}
              onChange={handleInputChange}
              placeholder="Type to search printing types..."
              options={(printingTypes || [])
                .filter(pt => (!pt.deleted && pt.isActive !== false) || (formData.printingType && String(pt._id) === String(formData.printingType)))
                .map(pt => ({
                  value: String(pt._id),
                  label: `${pt.name}${!pt.isActive ? " (Inactive)" : ""}`
                }))}
            />
          </div>
        </div>

        {/* Additional product attributes */}
        <div style={{ marginTop: "15px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
            <FormField type="text" name="includedComponents" label="Included Components" value={formData.includedComponents || ""} onChange={handleInputChange} placeholder="e.g. 1 T-shirt, 1 care label" />
            <FormField type="text" name="productCareInstructions" label="Product Care Instructions" value={formData.productCareInstructions || ""} onChange={handleInputChange} placeholder="e.g. Machine wash cold, tumble dry low" />
            <FormField type="text" name="recommendedUsesForProduct" label="Recommended Uses For Product" value={formData.recommendedUsesForProduct || ""} onChange={handleInputChange} placeholder="e.g. Casual wear, gym, travel" />
            <FormField type="text" name="reusability" label="Reusability" value={formData.reusability || ""} onChange={handleInputChange} placeholder="e.g. Reusable, single use" />
            <FormField type="text" name="shape" label="Shape" value={formData.shape || ""} onChange={handleInputChange} placeholder="e.g. Regular, slim, relaxed" />
            <FormField type="text" name="specialFeature" label="Special Feature" value={formData.specialFeature || ""} onChange={handleInputChange} placeholder="e.g. Moisture wicking, UV protection" />
            <FormField type="text" name="specificUsesForProduct" label="Specific Uses For Product" value={formData.specificUsesForProduct || ""} onChange={handleInputChange} placeholder="e.g. Sports, office, party" />
            <FormField type="text" name="style" label="Style" value={formData.style || ""} onChange={handleInputChange} placeholder="e.g. Classic, modern, vintage" />
            <FormField type="text" name="design" label="Design" value={formData.design || ""} onChange={handleInputChange} placeholder="e.g. Solid, printed, graphic" />
            <FormField type="text" name="occasion" label="Occasion" value={formData.occasion || ""} onChange={handleInputChange} placeholder="e.g. Casual, formal, party, wedding" />
            <div>
              <SearchableSelect
                name="countryOfOrigin"
                label="Country of Origin (Optional)"
                value={formData.countryOfOrigin != null ? String(formData.countryOfOrigin) : ""}
                onChange={handleInputChange}
                placeholder="Type to search countries..."
                options={(countries || [])
                  .filter(country => (!country.deleted && country.isActive) || (formData.countryOfOrigin && String(country._id) === String(formData.countryOfOrigin)))
                  .map(country => ({
                    value: String(country._id),
                    label: `${country.name}${!country.isActive ? " (Inactive)" : ""}`
                  }))}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Pricing & Inventory */}
      <div style={{ marginBottom: "30px" }}>
        <h3 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "20px", color: "#444444", borderBottom: "2px solid #444444", paddingBottom: "12px", paddingTop: "8px" }}>
          Pricing & Inventory
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
          <div>
            <FormField
              type="number"
              name="basePrice"
              label="Base Price"
              value={formData.basePrice}
              onChange={handleInputChange}
              placeholder="0"
              step="1"
              min="0"
              required={true}
            />
          </div>
          <div>
            <FormField
              type="number"
              name="discountPrice"
              label="Discount Price (Optional)"
              value={formData.discountPrice}
              onChange={handleInputChange}
              placeholder="0"
              step="1"
              min="0"
            />
          </div>
          <div>
            <FormField
              type="select"
              name="taxClass"
              label="Tax Class (Optional)"
              value={formData.taxClass != null ? String(formData.taxClass) : ""}
              onChange={handleInputChange}
              options={[
                { value: "", label: "Select Tax Class" },
                ...(gstSlabs || [])
                  .filter(gstSlab => (!gstSlab.deleted && gstSlab.isActive) || (formData.taxClass && String(gstSlab._id) === String(formData.taxClass)))
                  .map(gstSlab => ({
                    value: String(gstSlab._id),
                    label: `${gstSlab.name} (${gstSlab.rate}%)${!gstSlab.isActive ? " (Inactive)" : ""}`
                  }))
              ]}
              info="Select a GST slab for tax calculation"
            />
          </div>
          <div>
            <FormField
              type="number"
              name="noOfPcsIncluded"
              label="No of Pcs Included"
              value={formData.noOfPcsIncluded}
              onChange={handleInputChange}
              placeholder="0"
              min="0"
              step="1"
            />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <FormField
              type="select"
              name="stockManagement"
              label="Stock Management"
              value={formData.stockManagement}
              onChange={handleInputChange}
              options={[
                { value: "unlimited", label: "Unlimited Stock" },
                { value: "track", label: "Track Quantity" }
              ]}
            />
          </div>
          {formData.stockManagement === "track" && (
            <div style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
              <div>
                <FormField
                  type="number"
                  name="quantity"
                  label="Quantity"
                  value={formData.quantity}
                  onChange={handleInputChange}
                  placeholder="0"
                  min="0"
                  required={true}
                />
              </div>
              <div>
                <FormField
                  type="number"
                  name="lowStockThreshold"
                  label="Low Stock Warning Threshold"
                  value={formData.lowStockThreshold}
                  onChange={handleInputChange}
                  placeholder="10"
                  min="0"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Customization Settings - Only for Customized Products */}
      {formData.productType === "customized" && (
        <div style={{ marginBottom: "30px" }}>
          <h3 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "20px", color: "#444444", borderBottom: "2px solid #444444", paddingBottom: "12px", paddingTop: "8px" }}>
            Customization Settings
          </h3>
          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <FormField
                type="checkbox"
                name="livePreviewEnabled"
                checked={formData.livePreviewEnabled}
                onChange={handleInputChange}
              />
              <span>Enable Live Preview (Frontend supports real-time preview)</span>
            </label>
          </div>
          <div style={{ marginBottom: "20px", padding: "15px", backgroundColor: "#f8f9fa", borderRadius: "4px" }}>
            <h4 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "10px" }}>Text Customization</h4>
            <label style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
              <FormField
                type="checkbox"
                name="textCustomization_enabled"
                checked={formData.textCustomization.enabled}
                onChange={handleInputChange}
              />
              <span>Enable Text Customization</span>
            </label>
            {formData.textCustomization.enabled && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "10px" }}>
                <FormField
                  type="number"
                  name="textCustomization_maxCharacters"
                  label="Max Characters"
                  value={formData.textCustomization.maxCharacters}
                  onChange={handleInputChange}
                  min="1"
                />
                <FormField
                  type="text"
                  name="textCustomization_placeholder"
                  label="Placeholder Text"
                  value={formData.textCustomization.placeholder}
                  onChange={handleInputChange}
                />
                <label style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <FormField
                    type="checkbox"
                    name="textCustomization_required"
                    checked={formData.textCustomization.required}
                    onChange={handleInputChange}
                  />
                  <span>Required</span>
                </label>
              </div>
            )}
          </div>
          <div style={{ padding: "15px", backgroundColor: "#f8f9fa", borderRadius: "4px" }}>
            <h4 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "10px" }}>Image Upload Customization</h4>
            <label style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
              <FormField
                type="checkbox"
                name="imageUploadCustomization_enabled"
                checked={formData.imageUploadCustomization.enabled}
                onChange={handleInputChange}
              />
              <span>Enable Image Upload Customization</span>
            </label>
            {formData.imageUploadCustomization.enabled && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "10px" }}>
                <FormField
                  type="text"
                  name="imageUploadCustomization_allowedFileTypes"
                  label="Allowed File Types (comma-separated)"
                  value={formData.imageUploadCustomization.allowedFileTypes.join(", ")}
                  onChange={handleInputChange}
                  placeholder="jpg, jpeg, png"
                />
                <FormField
                  type="number"
                  name="imageUploadCustomization_maxFileSize"
                  label="Max File Size (MB)"
                  value={formData.imageUploadCustomization.maxFileSize}
                  onChange={handleInputChange}
                  min="1"
                />
                <label style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <FormField
                    type="checkbox"
                    name="imageUploadCustomization_required"
                    checked={formData.imageUploadCustomization.required}
                    onChange={handleInputChange}
                  />
                  <span>Required</span>
                </label>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Shipping & Fulfillment */}
      <div style={{ marginBottom: "30px" }}>
        <h3 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "20px", color: "#444444", borderBottom: "2px solid #444444", paddingBottom: "12px", paddingTop: "8px" }}>
          Shipping & Fulfillment
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
          <FormField
            type="number"
            name="weight"
            label="Weight (Grms)"
            value={formData.weight ?? ""}
            onChange={handleInputChange}
            placeholder="0.00"
            step="0.01"
            min="0"
          />
          <FormField
            type="select"
            name="shippingClass"
            label="Shipping Method"
            value={(() => {
              const v = formData.shippingClass != null ? String(formData.shippingClass).trim() : ""
              const lower = v.toLowerCase()
              if (lower === "standard" || lower === "express") return lower
              return v || ""
            })()}
            onChange={handleInputChange}
            options={[
              { value: "", label: "Select Shipping Method" },
              { value: "standard", label: "Standard" },
              { value: "express", label: "Express" },
              ...(formData.shippingClass && String(formData.shippingClass).trim() && !["standard", "express"].includes(String(formData.shippingClass).trim().toLowerCase())
                ? [{ value: String(formData.shippingClass).trim(), label: String(formData.shippingClass).trim() }]
                : [])
            ]}
          />
          {formData.productType === "customized" && (
            <div>
              <label style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <FormField
                  type="checkbox"
                  name="madeToOrder"
                  checked={formData.madeToOrder}
                  onChange={handleInputChange}
                  disabled={true}
                />
                <span>Made-to-Order Product <span style={{ fontSize: "12px", color: "#666", fontStyle: "italic" }}>(Required for customized products)</span></span>
              </label>
              <p style={{ fontSize: "12px", color: "#666", marginTop: "5px", marginLeft: "30px" }}>
                Customized products are automatically set as made-to-order since they are personalized for each customer.
              </p>
            </div>
          )}
          <div style={{ gridColumn: "1 / -1" }}>
            <FormField
              type="text"
              name="processingTime"
              label="Processing Time"
              value={formData.processingTime ?? ""}
              onChange={handleInputChange}
              placeholder="e.g., 3-5 business days"
            />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <h4 style={{ fontSize: "14px", fontWeight: "600", marginBottom: "10px" }}>Dimensions (Optional)</h4>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
              <FormField
                type="select"
                name="dimension_length"
                label="Length"
                value={formData.dimensions?.length != null ? String(formData.dimensions.length) : ""}
                onChange={handleInputChange}
                options={[
                  { value: "", label: "Select Length" },
                  ...(lengths || [])
                    .filter(length => length && (!length.deleted || (formData.dimensions?.length && String(length._id || length.id) === String(formData.dimensions.length))))
                    .map(length => ({
                      value: String(length._id || length.id),
                      label: `${length.name} ${getUnitAbbreviation(length.unit || 'centimeters')}${!length.isActive ? ' (Inactive)' : ''}`
                    }))
                ]}
                info={`Select a length value from Length Manager (${lengths.filter(l => l && !l.deleted).length} available)`}
              />
              <FormField
                type="select"
                name="dimension_width"
                label="Width"
                value={formData.dimensions?.width != null ? String(formData.dimensions.width) : ""}
                onChange={handleInputChange}
                options={[
                  { value: "", label: "Select Width" },
                  ...(widths || [])
                    .filter(width => width && (!width.deleted || (formData.dimensions?.width && String(width._id || width.id) === String(formData.dimensions.width))))
                    .map(width => ({
                      value: String(width._id || width.id),
                      label: `${width.name} ${getUnitAbbreviation(width.unit || 'centimeters')}${!width.isActive ? ' (Inactive)' : ''}`
                    }))
                ]}
                info={`Select a width value from Width Manager (${widths.filter(w => w && !w.deleted).length} available)`}
              />
              <FormField
                type="select"
                name="dimension_height"
                label="Height"
                value={formData.dimensions?.height != null ? String(formData.dimensions.height) : ""}
                onChange={handleInputChange}
                options={[
                  { value: "", label: "Select Height" },
                  ...(heights || [])
                    .filter(height => height && (!height.deleted || (formData.dimensions?.height && String(height._id || height.id) === String(formData.dimensions.height))))
                    .map(height => ({
                      value: String(height._id || height.id),
                      label: `${height.name} ${getUnitAbbreviation(height.unit || 'centimeters')}${!height.isActive ? ' (Inactive)' : ''}`
                    }))
                ]}
                info={`Select a height value from Height Manager (${heights.filter(h => h && !h.deleted).length} available)`}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProductDetailsTab
