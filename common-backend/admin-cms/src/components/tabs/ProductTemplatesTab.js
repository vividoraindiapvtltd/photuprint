import React, { useState } from "react"
import { FormField } from "../../common"

const ProductTemplatesTab = ({
  formData,
  templates,
  handleTemplateToggle,
  handleInputChange,
}) => {
  const [imagePopupUrl, setImagePopupUrl] = useState(null)

  const getPreviewImageUrl = (template) => {
    if (!template?.previewImage) return null
    if (template.previewImage.startsWith("http")) return template.previewImage
    const base = `${window.location.protocol}//${window.location.hostname}:8080`
    return template.previewImage.startsWith("/") ? base + template.previewImage : `${base}/${template.previewImage}`
  }

  return (
    <div>
      <div style={{ marginBottom: "30px" }}>
        <h3 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "20px", color: "#444444", borderBottom: "2px solid #444444", paddingBottom: "12px", paddingTop: "8px" }}>
          Template Selection (Multiple)
        </h3>
        {!formData.category ? (
          <p style={{ color: "#666", fontStyle: "italic", marginTop: "10px" }}>
            Please select a category first in Product Details tab to view available templates.
          </p>
        ) : templates.length === 0 ? (
          <p style={{ color: "#666", fontStyle: "italic", marginTop: "10px" }}>
            No templates available for this category.
          </p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "15px", marginTop: "10px" }}>
            {templates.map((template) => {
              const previewUrl = getPreviewImageUrl(template)
              return (
                <label
                  key={template._id}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    padding: "15px",
                    border: formData.selectedTemplates.includes(template._id) ? "2px solid #007bff" : "1px solid #ddd",
                    borderRadius: "8px",
                    cursor: "pointer",
                    backgroundColor: formData.selectedTemplates.includes(template._id) ? "#e7f3ff" : "white",
                    transition: "all 0.2s",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={formData.selectedTemplates.includes(template._id)}
                    onChange={() => handleTemplateToggle(template._id)}
                    style={{ marginBottom: "10px" }}
                  />
                  {previewUrl && (
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={(e) => { e.preventDefault(); setImagePopupUrl(previewUrl) }}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setImagePopupUrl(previewUrl) } }}
                      style={{ marginBottom: "8px", cursor: "pointer", borderRadius: "4px", overflow: "hidden" }}
                      title="Click to view larger"
                    >
                      <img
                        src={previewUrl}
                        alt={template.name}
                        style={{ width: "100%", height: "120px", objectFit: "cover", borderRadius: "4px", display: "block" }}
                      />
                    </div>
                  )}
                  <span style={{ fontWeight: "bold", marginBottom: "4px" }}>{template.name}</span>
                  {template.description && (
                    <span style={{ fontSize: "12px", color: "#666" }}>{template.description}</span>
                  )}
                </label>
              )
            })}
          </div>
        )}
      </div>

      {/* Customization settings — only on Templates tab (customized products) */}
      {formData.productType === "customized" && handleInputChange && (
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

      {/* Image popup: max 200px on longest side, min 200x200 area, proportional */}
      {imagePopupUrl && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Template preview"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            backgroundColor: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
          onClick={() => setImagePopupUrl(null)}
        >
          <div
            style={{
              minWidth: "200px",
              minHeight: "200px",
              maxWidth: "90vw",
              maxHeight: "90vh",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#fff",
              borderRadius: "8px",
              padding: "12px",
              boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
              position: "relative",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setImagePopupUrl(null)}
              aria-label="Close"
              style={{
                position: "absolute",
                top: "8px",
                right: "8px",
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                border: "1px solid #ccc",
                background: "#fff",
                cursor: "pointer",
                fontSize: "18px",
                lineHeight: 1,
                zIndex: 1,
              }}
            >
              ×
            </button>
            <img
              src={imagePopupUrl}
              alt="Template preview"
              style={{
                maxWidth: "200px",
                maxHeight: "200px",
                width: "auto",
                height: "auto",
                objectFit: "contain",
                display: "block",
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default ProductTemplatesTab
