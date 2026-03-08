import React, { useState } from "react"
import { FormField } from "../../common"

const ProductMediaTab = ({
  formData,
  handleFeaturedImageUpload,
  handleGalleryImagesUpload,
  removeGalleryImage,
  removeExistingGalleryImage,
  removeFeaturedImage,
  editingId
}) => {
  const [mediaPopup, setMediaPopup] = useState({
    isOpen: false,
    mediaUrl: null,
    isVideo: false
  })

  const openMediaPopup = (mediaUrl, isVideo = false) => {
    setMediaPopup({
      isOpen: true,
      mediaUrl,
      isVideo
    })
  }

  const closeMediaPopup = () => {
    setMediaPopup({
      isOpen: false,
      mediaUrl: null,
      isVideo: false
    })
  }
  return (
    <div>
      {/* Media & Gallery */}
      <div style={{ marginBottom: "30px" }}>
        <div>
          <FormField
            type="file"
            name="featuredImage"
            label="Featured Image"
            onChange={handleFeaturedImageUpload}
            accept="image/jpeg,image/jpg,image/png,image/gif"
            required={!formData.existingFeaturedImage && !formData.featuredImage}
            info="Required. Maximum dimensions: 1200x1200px. Formats: JPG, PNG, GIF only. Max size: 5MB"
          />
          {formData.existingFeaturedImage && !formData.featuredImage && (
            <div style={{ marginTop: "15px", position: "relative", display: "inline-block" }}>
              <p style={{ fontSize: "14px", color: "#666", marginBottom: "10px" }}>Current Featured Image:</p>
              <div style={{ position: "relative", display: "inline-block" }}>
                <img
                  src={formData.existingFeaturedImage.startsWith("http") ? formData.existingFeaturedImage : `${formData.existingFeaturedImage}`}
                  alt="Featured"
                  style={{ width: "200px", height: "200px", objectFit: "cover", borderRadius: "4px", border: "2px solid #007bff", cursor: "pointer" }}
                  onClick={() => openMediaPopup(formData.existingFeaturedImage.startsWith("http") ? formData.existingFeaturedImage : `${formData.existingFeaturedImage}`, false)}
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    removeFeaturedImage()
                  }}
                  style={{
                    position: "absolute",
                    top: "5px",
                    right: "5px",
                    backgroundColor: "red",
                    color: "white",
                    border: "none",
                    borderRadius: "50%",
                    width: "25px",
                    height: "25px",
                    cursor: "pointer",
                    fontSize: "14px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.2)"
                  }}
                  title="Remove featured image"
                >
                  ×
                </button>
              </div>
            </div>
          )}
          {formData.featuredImage && (
            <div style={{ marginTop: "15px" }}>
              <p style={{ fontSize: "14px", color: "#666", marginBottom: "10px" }}>New Featured Image:</p>
              <img
                src={URL.createObjectURL(formData.featuredImage)}
                alt="New Featured"
                style={{ width: "200px", height: "200px", objectFit: "cover", borderRadius: "4px", border: "2px solid #28a745", cursor: "pointer" }}
                onClick={() => openMediaPopup(URL.createObjectURL(formData.featuredImage), false)}
              />
            </div>
          )}
        </div>
      </div>

      <div style={{ marginBottom: "30px" }}>
        <h4 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "10px" }}>
          Gallery Images/Videos (Optional)
          <span style={{ fontSize: "14px", fontWeight: "400", color: "#666", marginLeft: "10px" }}>
            ({formData.galleryImages.length + (formData.existingGalleryImages?.length || 0)}/9)
          </span>
        </h4>
        <FormField
          type="file"
          name="galleryImages"
          label="Gallery Images/Videos"
          onChange={handleGalleryImagesUpload}
          accept="image/jpeg,image/jpg,image/png,image/gif,video/*"
          multiple={true}
          key={`gallery-${formData.galleryImages.length}-${formData.existingGalleryImages?.length || 0}`}
          info={`Up to 9 images/videos total. Images: maximum 1200x1200px, max 5MB (JPG/PNG/GIF). Videos: max 100MB.`}
        />
        {/* Show existing gallery images/videos */}
        {formData.existingGalleryImages && formData.existingGalleryImages.length > 0 && (
          <div style={{ marginTop: "15px" }}>
            <p style={{ fontSize: "14px", color: "#666", marginBottom: "10px" }}>Existing Gallery Media:</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "10px" }}>
              {formData.existingGalleryImages.map((mediaUrl, index) => {
                const isVideo = typeof mediaUrl === "string" && (mediaUrl.includes(".mp4") || mediaUrl.includes(".webm") || mediaUrl.includes(".mov") || mediaUrl.includes("video"))
                const fullUrl = mediaUrl.startsWith("http") ? mediaUrl : `${mediaUrl}`
                
                return (
                  <div key={`existing-${index}`} style={{ position: "relative" }}>
                    {isVideo ? (
                      <video
                        src={fullUrl}
                        style={{ width: "100%", height: "150px", objectFit: "cover", borderRadius: "4px", border: "2px solid #007bff", cursor: "pointer" }}
                        controls
                        onClick={(e) => {
                          e.stopPropagation()
                          openMediaPopup(fullUrl, true)
                        }}
                      />
                    ) : (
                      <img
                        src={fullUrl}
                        alt={`Existing Gallery ${index + 1}`}
                        style={{ width: "100%", height: "150px", objectFit: "cover", borderRadius: "4px", border: "2px solid #007bff", cursor: "pointer" }}
                        onClick={() => openMediaPopup(fullUrl, false)}
                      />
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        removeExistingGalleryImage(index)
                      }}
                      style={{
                        position: "absolute",
                        top: "5px",
                        right: "5px",
                        backgroundColor: "red",
                        color: "white",
                        border: "none",
                        borderRadius: "50%",
                        width: "25px",
                        height: "25px",
                        cursor: "pointer",
                        fontSize: "14px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        boxShadow: "0 2px 4px rgba(0,0,0,0.2)"
                      }}
                      title="Remove image"
                    >
                      ×
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}
        {/* Show new gallery images/videos */}
        {formData.galleryImages.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "10px", marginTop: "15px" }}>
            {formData.galleryImages.map((media, index) => {
              const isVideo = media instanceof File && media.type.startsWith("video/")
              const mediaUrl = media instanceof File ? URL.createObjectURL(media) : media
              
              return (
                <div key={`new-${index}`} style={{ position: "relative" }}>
                  {isVideo ? (
                    <video
                      src={mediaUrl}
                      style={{ width: "100%", height: "150px", objectFit: "cover", borderRadius: "4px", border: "2px solid #28a745", cursor: "pointer" }}
                      controls
                      onClick={(e) => {
                        e.stopPropagation()
                        openMediaPopup(mediaUrl, true)
                      }}
                    />
                  ) : (
                    <img
                      src={mediaUrl}
                      alt={`New Gallery ${index + 1}`}
                      style={{ width: "100%", height: "150px", objectFit: "cover", borderRadius: "4px", border: "2px solid #28a745", cursor: "pointer" }}
                      onClick={() => openMediaPopup(mediaUrl, false)}
                    />
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      removeGalleryImage(index)
                    }}
                    style={{
                      position: "absolute",
                      top: "5px",
                      right: "5px",
                      backgroundColor: "red",
                      color: "white",
                      border: "none",
                      borderRadius: "50%",
                      width: "25px",
                      height: "25px",
                      cursor: "pointer",
                      fontSize: "14px",
                    }}
                  >
                    ×
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Media Popup */}
      {mediaPopup.isOpen && (
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
          onClick={closeMediaPopup}
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
            {mediaPopup.isVideo ? (
              <video
                src={mediaPopup.mediaUrl}
                controls
                autoPlay
                style={{
                  maxWidth: "90vw",
                  maxHeight: "90vh",
                  objectFit: "contain"
                }}
                onError={(e) => {
                  console.error("Failed to load video in popup:", mediaPopup.mediaUrl)
                  e.target.style.display = 'none'
                }}
              />
            ) : (
              <img
                src={mediaPopup.mediaUrl}
                alt="Preview"
                style={{
                  maxWidth: "90vw",
                  maxHeight: "90vh",
                  objectFit: "contain"
                }}
                onError={(e) => {
                  console.error("Failed to load image in popup:", mediaPopup.mediaUrl)
                  e.target.style.display = 'none'
                }}
              />
            )}
            <button
              onClick={closeMediaPopup}
              style={{
                position: "absolute",
                top: "20px",
                right: "20px",
                backgroundColor: "rgba(255, 255, 255, 0.9)",
                color: "#333",
                border: "none",
                borderRadius: "50%",
                width: "40px",
                height: "40px",
                cursor: "pointer",
                fontSize: "24px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 8px rgba(0,0,0,0.3)",
                transition: "all 0.2s ease"
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = "white"
                e.target.style.transform = "scale(1.1)"
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = "rgba(255, 255, 255, 0.9)"
                e.target.style.transform = "scale(1)"
              }}
              title="Close"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default ProductMediaTab
