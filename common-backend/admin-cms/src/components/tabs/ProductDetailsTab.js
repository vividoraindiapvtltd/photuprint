import React from "react"
import { FormField } from "../../common"
import SearchableSelect from "../../common/SearchableSelect"
import RichTextEditor from "../CKEditor"

const ProductDetailsTab = ({
  formData,
  handleInputChange,
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
              value={formData.category}
              onChange={handleInputChange}
              required={true}
              options={[
                { value: "", label: "Select Category" },
                ...categories
                  .filter(cat => !cat.deleted && cat.isActive)
                  .map(cat => ({
                    value: cat._id,
                    label: `${cat.name} ${cat.categoryId ? `(${cat.categoryId})` : ""}`
                  }))
              ]}
            />
          </div>
          <div>
            <FormField
              type="select"
              name="subcategory"
              label="Subcategory"
              value={formData.subcategory}
              onChange={handleInputChange}
              disabled={!formData.category}
              options={[
                { value: "", label: formData.category ? "Select Subcategory" : "Select category first" },
                ...subcategories
                  .filter(sub => {
                    const matchesCategory = !formData.category || sub.categoryId?.toString() === formData.category || sub.categoryId?._id?.toString() === formData.category
                    const isActive = !sub.deleted && sub.isActive
                    return matchesCategory && isActive
                  })
                  .map(sub => ({
                    value: sub._id,
                    label: `${sub.name} ${sub.subcategoryId ? `(${sub.subcategoryId})` : ""}`
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
              value={formData.brand}
              onChange={handleInputChange}
              options={[
                { value: "", label: "Select Brand" },
                ...brands
                  .filter(brand => !brand.deleted && brand.isActive)
                  .map(brand => ({
                    value: brand._id,
                    label: `${brand.name} ${brand.brandId ? `(${brand.brandId})` : ""}`
                  }))
              ]}
            />
          </div>
          <div>
            <FormField
              type="text"
              name="tags"
              label="Tags (comma-separated)"
              value={formData.tags}
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
              value={formData.shortDescription}
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
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
          <div>
            <SearchableSelect
              name="collarStyle"
              label="Collar Style (Optional)"
              value={formData.collarStyle}
              onChange={handleInputChange}
              placeholder="Type to search collar styles..."
              options={collarStyles
                .filter(collarStyle => !collarStyle.deleted && collarStyle.isActive)
                .map(collarStyle => ({
                  value: collarStyle._id,
                  label: collarStyle.name
                }))}
            />
          </div>
          <div>
            <SearchableSelect
              name="material"
              label="Material (Optional)"
              value={formData.material}
              onChange={handleInputChange}
              placeholder="Type to search materials..."
              options={materials
                .filter(material => !material.deleted && material.isActive)
                .map(material => ({
                  value: material._id,
                  label: material.name
                }))}
            />
          </div>
          <div>
            <SearchableSelect
              name="pattern"
              label="Pattern (Optional)"
              value={formData.pattern}
              onChange={handleInputChange}
              placeholder="Type to search patterns..."
              options={patterns
                .filter(pattern => !pattern.deleted && pattern.isActive)
                .map(pattern => ({
                  value: pattern._id,
                  label: pattern.name
                }))}
            />
          </div>
          <div>
            <SearchableSelect
              name="fitType"
              label="Fit Type (Optional)"
              value={formData.fitType}
              onChange={handleInputChange}
              placeholder="Type to search fit types..."
              options={fitTypes
                .filter(fitType => !fitType.deleted && fitType.isActive)
                .map(fitType => ({
                  value: fitType._id,
                  label: fitType.name
                }))}
            />
          </div>
          <div>
            <SearchableSelect
              name="sleeveType"
              label="Sleeve Type (Optional)"
              value={formData.sleeveType}
              onChange={handleInputChange}
              placeholder="Type to search sleeve types..."
              options={sleeveTypes
                .filter(sleeveType => !sleeveType.deleted && sleeveType.isActive)
                .map(sleeveType => ({
                  value: sleeveType._id,
                  label: sleeveType.name
                }))}
            />
          </div>
          <div>
            <SearchableSelect
              name="printingType"
              label="Printing Type (Optional)"
              value={formData.printingType}
              onChange={handleInputChange}
              placeholder="Type to search printing types..."
              options={(printingTypes || [])
                .filter(pt => !pt.deleted && pt.isActive !== false)
                .map(pt => ({
                  value: pt._id,
                  label: pt.name
                }))}
            />
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginTop: "15px" }}>
          <div>
            <SearchableSelect
              name="countryOfOrigin"
              label="Country of Origin (Optional)"
              value={formData.countryOfOrigin}
              onChange={handleInputChange}
              placeholder="Type to search countries..."
              options={countries
                .filter(country => !country.deleted && country.isActive)
                .map(country => ({
                  value: country._id,
                  label: country.name
                }))}
            />
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
              placeholder="0.00"
              step="0.01"
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
              placeholder="0.00"
              step="0.01"
              min="0"
            />
          </div>
          <div>
            <FormField
              type="select"
              name="taxClass"
              label="Tax Class (Optional)"
              value={formData.taxClass}
              onChange={handleInputChange}
              options={[
                { value: "", label: "Select Tax Class" },
                ...gstSlabs
                  .filter(gstSlab => !gstSlab.deleted && gstSlab.isActive)
                  .map(gstSlab => ({
                    value: gstSlab._id,
                    label: `${gstSlab.name} (${gstSlab.rate}%)`
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
            value={formData.weight}
            onChange={handleInputChange}
            placeholder="0.00"
            step="0.01"
            min="0"
          />
          <FormField
            type="select"
            name="shippingClass"
            label="Shipping Method"
            value={formData.shippingClass}
            onChange={handleInputChange}
            options={[
              { value: "", label: "Select Shipping Method" },
              { value: "standard", label: "Standard" },
              { value: "express", label: "Express" }
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
              value={formData.processingTime}
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
                value={formData.dimensions.length}
                onChange={handleInputChange}
                options={[
                  { value: "", label: "Select Length" },
                  ...lengths
                    .filter(length => length && !length.deleted)
                    .map(length => ({
                      value: length._id || length.id,
                      label: `${length.name} ${getUnitAbbreviation(length.unit || 'centimeters')}${!length.isActive ? ' (Inactive)' : ''}`
                    }))
                ]}
                info={`Select a length value from Length Manager (${lengths.filter(l => l && !l.deleted).length} available)`}
              />
              <FormField
                type="select"
                name="dimension_width"
                label="Width"
                value={formData.dimensions.width}
                onChange={handleInputChange}
                options={[
                  { value: "", label: "Select Width" },
                  ...widths
                    .filter(width => width && !width.deleted)
                    .map(width => ({
                      value: width._id || width.id,
                      label: `${width.name} ${getUnitAbbreviation(width.unit || 'centimeters')}${!width.isActive ? ' (Inactive)' : ''}`
                    }))
                ]}
                info={`Select a width value from Width Manager (${widths.filter(w => w && !w.deleted).length} available)`}
              />
              <FormField
                type="select"
                name="dimension_height"
                label="Height"
                value={formData.dimensions.height}
                onChange={handleInputChange}
                options={[
                  { value: "", label: "Select Height" },
                  ...heights
                    .filter(height => height && !height.deleted)
                    .map(height => ({
                      value: height._id || height.id,
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
