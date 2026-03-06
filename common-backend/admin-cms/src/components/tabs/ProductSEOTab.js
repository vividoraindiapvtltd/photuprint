import React, { useState } from "react"
import { FormField } from "../../common"

const ProductSEOTab = ({
  formData,
  handleInputChange,
  storeName,
  generateSlug
}) => {
  const [showAdvancedSEO, setShowAdvancedSEO] = useState(false)

  return (
    <div>
      <div style={{ marginBottom: "30px" }}>
        <p style={{ fontSize: "14px", color: "#666", marginBottom: "20px", fontStyle: "italic" }}>
          Even if you leave these fields empty, the product page will be SEO-safe with auto-generated defaults.
        </p>
        
        {/* Required Fields */}
        <div style={{ marginBottom: "30px" }}>
          <h4 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "15px" }}>Required Fields</h4>
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "15px" }}>
            <div>
              <FormField
                type="text"
                name="seoTitle"
                label="SEO Title"
                value={formData.seoTitle}
                onChange={handleInputChange}
                placeholder={`${formData.name || "Product Name"} | ${storeName}`}
                maxLength={60}
                info={`Recommended max: 60 characters. ${formData.seoTitle.length > 60 ? "⚠️ Exceeds recommended length" : ""}`}
              />
              {formData.seoTitle.length > 60 && (
                <p style={{ color: "#ffc107", fontSize: "12px", marginTop: "5px" }}>
                  ⚠️ Title exceeds recommended length (60 characters)
                </p>
              )}
            </div>
            <div>
              <FormField
                type="textarea"
                name="metaDescription"
                label="Meta Description"
                value={formData.metaDescription}
                onChange={handleInputChange}
                placeholder={`Create a personalized ${formData.name || "product"}. Perfect gift for birthdays, anniversaries & special moments.`}
                rows={3}
                maxLength={160}
                info={`Recommended max: 160 characters. ${formData.metaDescription.length > 160 ? "⚠️ Exceeds recommended length" : ""}`}
              />
              {formData.metaDescription.length > 160 && (
                <p style={{ color: "#ffc107", fontSize: "12px", marginTop: "5px" }}>
                  ⚠️ Description exceeds recommended length (160 characters)
                </p>
              )}
            </div>
            <div>
              <FormField
                type="text"
                name="urlSlug"
                label="URL Slug"
                value={formData.urlSlug}
                onChange={handleInputChange}
                placeholder={generateSlug(formData.name) || "product-slug"}
                info="URL-friendly version of product name. Auto-generated from product name. Must be unique per tenant."
              />
              {!formData.urlSlug && (
                <p style={{ color: "#ffc107", fontSize: "12px", marginTop: "5px" }}>
                  ⚠️ Warning: Empty slug may cause SEO issues
                </p>
              )}
            </div>
            <div>
              <label style={{ display: "flex", gap: "10px" }}>
                <FormField
                  type="checkbox"
                  name="index"
                  checked={formData.index}
                  onChange={handleInputChange}
                />
                <span>Allow search engines to index this page</span>
              </label>
              <p style={{ fontSize: "12px", color: "#666", marginTop: "5px" }}>
                When unchecked, backend will add noindex, nofollow meta tag to prevent search engine indexing
              </p>
            </div>
          </div>
        </div>

        {/* Recommended Fields */}
        <div style={{ marginBottom: "30px" }}>
          <h4 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "15px" }}>Recommended Fields</h4>
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "15px" }}>
            <FormField
              type="text"
              name="primaryKeyword"
              label="Primary Keyword (Optional)"
              value={formData.primaryKeyword}
              onChange={handleInputChange}
              placeholder="Main keyword for this product"
              info="Used for SEO guidance and AI generation"
            />
            <FormField
              type="text"
              name="secondaryKeywords"
              label="Secondary Keywords (Optional, comma-separated)"
              value={formData.secondaryKeywords}
              onChange={handleInputChange}
              placeholder="keyword1, keyword2, keyword3"
              info="Additional keywords for SEO"
            />
            <FormField
              type="text"
              name="openGraphImage"
              label="Open Graph Image URL (Optional)"
              value={formData.openGraphImage}
              onChange={handleInputChange}
              placeholder="https://example.com/image.jpg"
              info="Image used for social sharing (Facebook, WhatsApp, etc.). Falls back to featured image if empty."
            />
          </div>
        </div>

        {/* Advanced SEO - Collapsed by Default */}
        <div style={{ marginBottom: "30px" }}>
          <button
            type="button"
            onClick={() => setShowAdvancedSEO(!showAdvancedSEO)}
            style={{
              width: "100%",
              padding: "12px",
              backgroundColor: "#f8f9fa",
              border: "1px solid #dee2e6",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "16px",
              fontWeight: "600",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}
          >
            <span>Show Advanced SEO</span>
            <span>{showAdvancedSEO ? "▲" : "▼"}</span>
          </button>
          
          {showAdvancedSEO && (
            <div style={{ marginTop: "20px", padding: "20px", backgroundColor: "#f8f9fa", borderRadius: "4px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "15px" }}>
                <FormField
                  type="text"
                  name="canonicalUrl"
                  label="Canonical URL (Optional)"
                  value={formData.canonicalUrl}
                  onChange={handleInputChange}
                  placeholder="https://example.com/product-url"
                  info="Used to prevent duplicate content issues. Multi-tenant: Each tenant should have unique canonical URLs."
                />
                <FormField
                  type="select"
                  name="schemaType"
                  label="Schema Type"
                  value={formData.schemaType}
                  onChange={handleInputChange}
                  options={[
                    { value: "Product", label: "Product (Default)" },
                    { value: "Article", label: "Article" },
                    { value: "Collection", label: "Collection" }
                  ]}
                  info="Product schema will be auto-generated by backend with product details"
                />
                <div>
                  <FormField
                    type="textarea"
                    name="customSchema"
                    label="Custom Schema Override (Optional, JSON-LD)"
                    value={formData.customSchema}
                    onChange={handleInputChange}
                    placeholder='{"@context": "https://schema.org", "@type": "Product", ...}'
                    rows={8}
                    info="⚠️ Warning: Invalid JSON can break rich results. Overrides default Product schema."
                  />
                </div>
                <div>
                  <h4 style={{ fontSize: "14px", fontWeight: "600", marginBottom: "10px" }}>Robots Meta Controls</h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    <label style={{ display: "flex", gap: "10px" }}>
                      <FormField
                        type="checkbox"
                        name="robotsMeta_noimageindex"
                        checked={formData.robotsMeta.noimageindex}
                        onChange={handleInputChange}
                      />
                      <span>noimageindex (Prevent image indexing)</span>
                    </label>
                    <label style={{ display: "flex", gap: "10px" }}>
                      <FormField
                        type="checkbox"
                        name="robotsMeta_nosnippet"
                        checked={formData.robotsMeta.nosnippet}
                        onChange={handleInputChange}
                      />
                      <span>nosnippet (Prevent snippet display)</span>
                    </label>
                  </div>
                  <p style={{ fontSize: "12px", color: "#666", marginTop: "10px" }}>
                    Advanced use cases: Use these for fine-grained control over how search engines index and display your content
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ProductSEOTab
