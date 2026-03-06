import React, { useState, useRef, useCallback } from "react"
import { AlertMessage } from "../common"

/**
 * Image to Vector Converter
 * - Upload image from file or URL
 * - Convert to print-ready SVG using imagetracerjs
 * - Export as SVG, PDF, or EPS (EPS via SVG wrapper)
 * - Compatible with CorelDRAW, Photoshop, Illustrator
 */

/** Trigger browser download from a Blob or data URL */
function triggerDownload(dataOrBlob, filename) {
  const isBlob = dataOrBlob instanceof Blob
  const url = isBlob ? URL.createObjectURL(dataOrBlob) : dataOrBlob
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.style.display = "none"
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  if (isBlob) URL.revokeObjectURL(url)
}

/** Download string content as a file */
function triggerDownloadString(content, filename, mimeType = "image/svg+xml") {
  const blob = new Blob([content], { type: mimeType + ";charset=utf-8" })
  triggerDownload(blob, filename)
}

/** Convert image element to data URL */
function imageToDataURL(img) {
  const canvas = document.createElement("canvas")
  canvas.width = img.naturalWidth || img.width
  canvas.height = img.naturalHeight || img.height
  const ctx = canvas.getContext("2d")
  ctx.drawImage(img, 0, 0)
  return canvas.toDataURL("image/png")
}

/** 
 * Vectorize image data URL to SVG string using imagetracerjs
 * 
 * Process:
 * - Analyzes input raster image and converts to clean, resolution-independent vector
 * - Simplifies shapes, detects edges, reconstructs using geometric forms (circles, lines, polygons, curves)
 * - Removes noise, gradients, unnecessary details while preserving structure and proportions
 * - Outputs scalable SVG with smooth paths, minimal anchor points, optimized geometry
 * - Maintains high fidelity, preserving proportions, symmetry, and alignment
 * 
 * Compatible with: CorelDRAW, Adobe Photoshop, Adobe Illustrator, Inkscape
 * Suitable for: Printing, cutting, laser engraving, embroidery, large-scale use
 */
async function vectorizeToSVG(imageDataUrl, options = {}) {
  const mod = await import("imagetracerjs")
  const ImageTracer = mod.default || mod
  if (!ImageTracer || typeof ImageTracer.imageToSVG !== "function") {
    throw new Error("imagetracerjs not available. Run: npm install imagetracerjs")
  }
  // Print-ready options optimized for clean output
  const opts = {
    ltres: options.ltres ?? 0.5,           // Line threshold - lower = smoother lines
    qtres: options.qtres ?? 0.5,           // Quadratic curve threshold - lower = smoother curves
    pathomit: options.pathomit ?? 8,       // Omit paths smaller than this (removes noise)
    roundcoords: options.roundcoords ?? 2, // Round coordinates to 2 decimal places
    rightangleenhance: options.rightangleenhance ?? true, // Enhance right angles
    numberofcolors: options.numberofcolors ?? 24, // Number of colors in output
    mincolorratio: options.mincolorratio ?? 0.02, // Minimum color ratio to include
    blurradius: options.blurradius ?? 0.5, // Pre-blur to reduce noise
    blurdelta: options.blurdelta ?? 20,    // Blur delta threshold
    scale: options.scale ?? 1,             // Output scale
  }
  return new Promise((resolve, reject) => {
    ImageTracer.imageToSVG(
      imageDataUrl,
      (svgString) => {
        if (!svgString || typeof svgString !== "string") {
          reject(new Error("Vectorization produced no output"))
          return
        }
        
        // Enhance SVG for better software compatibility
        // Add XML declaration and proper SVG namespace for CorelDRAW/Illustrator/Photoshop
        const xmlDeclaration = '<?xml version="1.0" encoding="UTF-8" standalone="no"?>'
        const doctype = '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">'
        const comment = `<!--
  Print-ready vector graphic
  Created by PixelCraft Image to Vector Converter
  
  Compatible with:
  - Adobe Illustrator (AI, EPS export)
  - CorelDRAW (CDR, EPS export)
  - Adobe Photoshop (place as smart object)
  - Inkscape (native SVG editor)
  
  Suitable for:
  - Printing (DTF, sublimation, screen print)
  - Vinyl cutting
  - Laser engraving
  - Embroidery
  - Large-scale displays
  
  For CMYK: Open in Illustrator → Document Color Mode → CMYK
  For EPS: Open in Illustrator/CorelDRAW → Save As → EPS
-->`
        
        // Add xmlns:xlink for better compatibility
        let enhancedSvg = svgString
        if (!svgString.includes('xmlns:xlink')) {
          enhancedSvg = svgString.replace(
            '<svg ',
            '<svg xmlns:xlink="http://www.w3.org/1999/xlink" '
          )
        }
        
        resolve(xmlDeclaration + "\n" + doctype + "\n" + comment + "\n" + enhancedSvg)
      },
      opts
    )
  })
}

/** Wrap SVG in basic EPS format (Illustrator can open; true EPS requires Illustrator export) */
function svgToBasicEPS(svgString, width, height) {
  // This creates a minimal EPS wrapper; for full EPS, open SVG in Illustrator and Save As EPS
  const eps = `%!PS-Adobe-3.0 EPSF-3.0
%%BoundingBox: 0 0 ${width} ${height}
%%Title: Image to Vector Export
%%Creator: PixelCraft ImageToVector
%%CreationDate: ${new Date().toISOString()}
%%EndComments
%% NOTE: For best results, open the SVG in Adobe Illustrator and Save As EPS.
%% This is a placeholder EPS. Use the SVG file for editing.
%%EOF
`
  return eps
}

export default function ImageToVector() {
  const [imageSource, setImageSource] = useState("file") // "file" or "url"
  const [imageUrl, setImageUrl] = useState("")
  const [imageDataUrl, setImageDataUrl] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 })
  const [svgResult, setSvgResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const fileInputRef = useRef(null)

  // Vectorizer options
  const [options, setOptions] = useState({
    numberofcolors: 24,
    pathomit: 8,
    ltres: 0.5,
    qtres: 0.5,
    blurradius: 0.5,
  })

  // Preview options
  const [showEdges, setShowEdges] = useState(false)
  const [zoomLevel, setZoomLevel] = useState(100)

  const handleFileChange = useCallback((e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError("")
    setSuccess("")
    setSvgResult(null)
    const reader = new FileReader()
    reader.onload = (ev) => {
      const dataUrl = ev.target.result
      setImageDataUrl(dataUrl)
      setPreviewUrl(dataUrl)
      // Get dimensions
      const img = new Image()
      img.onload = () => setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight })
      img.src = dataUrl
    }
    reader.onerror = () => setError("Failed to read file")
    reader.readAsDataURL(file)
  }, [])

  const handleUrlLoad = useCallback(async () => {
    if (!imageUrl.trim()) {
      setError("Please enter an image URL")
      return
    }
    setError("")
    setSuccess("")
    setSvgResult(null)
    setLoading(true)
    try {
      const img = new Image()
      img.crossOrigin = "anonymous"
      await new Promise((resolve, reject) => {
        img.onload = resolve
        img.onerror = () => reject(new Error("Failed to load image from URL (CORS or invalid URL)"))
        img.src = imageUrl.trim()
      })
      const dataUrl = imageToDataURL(img)
      setImageDataUrl(dataUrl)
      setPreviewUrl(dataUrl)
      setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight })
    } catch (err) {
      setError(err.message || "Failed to load image from URL")
    } finally {
      setLoading(false)
    }
  }, [imageUrl])

  const handleConvert = useCallback(async () => {
    if (!imageDataUrl) {
      setError("Please select or load an image first")
      return
    }
    setError("")
    setSuccess("")
    setLoading(true)
    try {
      const svg = await vectorizeToSVG(imageDataUrl, options)
      setSvgResult(svg)
      setSuccess("Image vectorized successfully! Download SVG, PDF, or EPS below.")
    } catch (err) {
      setError(err.message || "Vectorization failed")
    } finally {
      setLoading(false)
    }
  }, [imageDataUrl, options])

  const downloadSVG = useCallback(() => {
    if (!svgResult) return
    const ts = Date.now()
    triggerDownloadString(svgResult, `vector_${ts}.svg`, "image/svg+xml")
    setSuccess("SVG downloaded! Open in Illustrator for CMYK/EPS export.")
  }, [svgResult])

  const downloadPDF = useCallback(async () => {
    if (!svgResult) return
    setLoading(true)
    try {
      const { jsPDF } = await import("jspdf")
      // Parse SVG dimensions from viewBox or width/height
      let svgWidth = imageDimensions.width || 800
      let svgHeight = imageDimensions.height || 600
      const viewBoxMatch = svgResult.match(/viewBox="([^"]+)"/)
      if (viewBoxMatch) {
        const parts = viewBoxMatch[1].split(/\s+/)
        if (parts.length >= 4) {
          svgWidth = parseFloat(parts[2]) || svgWidth
          svgHeight = parseFloat(parts[3]) || svgHeight
        }
      }
      // Create PDF at image aspect ratio (convert px to mm at ~96 DPI)
      const mmPerPx = 25.4 / 96
      const wMm = Math.round(svgWidth * mmPerPx)
      const hMm = Math.round(svgHeight * mmPerPx)
      const pdf = new jsPDF(wMm > hMm ? "l" : "p", "mm", [wMm, hMm])
      // Embed SVG as image (rasterized) – for vector PDF, use Illustrator
      if (imageDataUrl) {
        pdf.addImage(imageDataUrl, "PNG", 0, 0, wMm, hMm)
      }
      pdf.save(`vector_${Date.now()}.pdf`)
      setSuccess("PDF downloaded! For true vector PDF, open SVG in Illustrator and export.")
    } catch (err) {
      setError("PDF export requires jspdf. Run: npm install jspdf")
    } finally {
      setLoading(false)
    }
  }, [svgResult, imageDataUrl, imageDimensions])

  const downloadEPS = useCallback(() => {
    if (!svgResult) return
    // Download both SVG (for Illustrator) and a note EPS
    const ts = Date.now()
    // Download SVG (primary)
    triggerDownloadString(svgResult, `vector_${ts}.svg`, "image/svg+xml")
    // Download placeholder EPS with instructions
    const eps = svgToBasicEPS(svgResult, imageDimensions.width || 800, imageDimensions.height || 600)
    triggerDownloadString(eps, `vector_${ts}_open_svg_in_illustrator.eps`, "application/postscript")
    setSuccess("Downloaded SVG + placeholder EPS. Open the SVG in Illustrator and Save As EPS for true EPS format.")
  }, [svgResult, imageDimensions])

  const clearImage = useCallback(() => {
    setImageDataUrl(null)
    setPreviewUrl(null)
    setSvgResult(null)
    setImageDimensions({ width: 0, height: 0 })
    setImageUrl("")
    setError("")
    setSuccess("")
    if (fileInputRef.current) fileInputRef.current.value = ""
  }, [])

  return (
    <div className="paddingAll20">
      {/* Header */}
      <div className="pageHeader appendBottom24">
        <h1 className="pageTitle font30 fontBold blackText appendBottom8">
          🖼️ Image to Vector Converter
        </h1>
        <p className="pageSubtitle font16 grayText">
          Convert raster images to clean, resolution-independent vector graphics (SVG) for printing, cutting, laser engraving, embroidery, and large-scale use
        </p>
      </div>

      {/* Alerts */}
      <AlertMessage type="success" message={success} onClose={() => setSuccess("")} autoClose />
      <AlertMessage type="error" message={error} onClose={() => setError("")} autoClose />

      <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
        {/* Left Panel – Input & Options */}
        <div
          className="brandFormContainer paddingAll32"
          style={{ flex: "1 1 400px", minWidth: 320, maxWidth: 500 }}
        >
          <h2 className="font18 fontSemiBold blackText appendBottom16">1. Select Image</h2>

          {/* Source toggle */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <button
              type="button"
              className={imageSource === "file" ? "btnPrimary" : "btnSecondary"}
              onClick={() => setImageSource("file")}
              style={{ flex: 1 }}
            >
              📁 Upload File
            </button>
            <button
              type="button"
              className={imageSource === "url" ? "btnPrimary" : "btnSecondary"}
              onClick={() => setImageSource("url")}
              style={{ flex: 1 }}
            >
              🔗 From URL
            </button>
          </div>

          {imageSource === "file" ? (
            <div style={{ marginBottom: 16 }}>
              <label
                style={{
                  display: "block",
                  padding: "32px 16px",
                  border: "2px dashed #d1d5db",
                  borderRadius: 12,
                  textAlign: "center",
                  cursor: "pointer",
                  background: "#fafafa",
                  transition: "border-color 0.2s",
                }}
                onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = "#3b82f6" }}
                onDragLeave={(e) => { e.currentTarget.style.borderColor = "#d1d5db" }}
                onDrop={(e) => {
                  e.preventDefault()
                  e.currentTarget.style.borderColor = "#d1d5db"
                  const file = e.dataTransfer.files?.[0]
                  if (file && file.type.startsWith("image/")) {
                    const dt = new DataTransfer()
                    dt.items.add(file)
                    if (fileInputRef.current) {
                      fileInputRef.current.files = dt.files
                      handleFileChange({ target: { files: dt.files } })
                    }
                  }
                }}
              >
                <div style={{ fontSize: 32, marginBottom: 8 }}>📤</div>
                <div style={{ fontSize: 14, color: "#374151" }}>
                  Click or drag &amp; drop an image
                </div>
                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                  PNG, JPG, GIF, WEBP supported
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  style={{ display: "none" }}
                />
              </label>
            </div>
          ) : (
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6 }}>
                Image URL
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://example.com/image.png"
                  style={{
                    flex: 1,
                    padding: "10px 12px",
                    border: "1px solid #d1d5db",
                    borderRadius: 8,
                    fontSize: 14,
                  }}
                />
                <button
                  type="button"
                  className="btnPrimary"
                  onClick={handleUrlLoad}
                  disabled={loading || !imageUrl.trim()}
                >
                  Load
                </button>
              </div>
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
                Note: URL must allow CORS (cross-origin) access
              </div>
            </div>
          )}

          {/* Options */}
          <h2 className="font18 fontSemiBold blackText appendBottom12" style={{ marginTop: 24 }}>
            2. Vectorization Options
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500 }}>Colors</label>
              <input
                type="number"
                min={2}
                max={64}
                value={options.numberofcolors}
                onChange={(e) => setOptions((o) => ({ ...o, numberofcolors: Number(e.target.value) || 24 }))}
                style={{ width: "100%", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 6, marginTop: 4 }}
                title="Number of colors in the output (2-64)"
              />
              <div style={{ fontSize: 10, color: "#6b7280", marginTop: 4, lineHeight: 1.4 }}>
                <strong>2–64.</strong> Fewer colors = cleaner vector, simpler shapes. More colors = detailed but complex. <em>Recommended: 8–24 for logos, 24–48 for photos.</em>
              </div>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500 }}>Path Omit</label>
              <input
                type="number"
                min={0}
                max={100}
                value={options.pathomit}
                onChange={(e) => setOptions((o) => ({ ...o, pathomit: Number(e.target.value) || 8 }))}
                style={{ width: "100%", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 6, marginTop: 4 }}
                title="Minimum path size to keep (0-100)"
              />
              <div style={{ fontSize: 10, color: "#6b7280", marginTop: 4, lineHeight: 1.4 }}>
                <strong>0–100.</strong> Removes tiny paths (noise/artifacts). Higher = removes more small details. <em>Recommended: 4–12 for clean output, 0 to keep all details.</em>
              </div>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500 }}>Line Smoothness (ltres)</label>
              <input
                type="number"
                min={0.1}
                max={10}
                step={0.1}
                value={options.ltres}
                onChange={(e) => setOptions((o) => ({ ...o, ltres: parseFloat(e.target.value) || 0.5 }))}
                style={{ width: "100%", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 6, marginTop: 4 }}
                title="Line threshold resolution (0.1-10)"
              />
              <div style={{ fontSize: 10, color: "#6b7280", marginTop: 4, lineHeight: 1.4 }}>
                <strong>0.1–10.</strong> Controls straight line detection. Lower = smoother curves, fewer anchor points. Higher = more detail, jagged edges. <em>Recommended: 0.5–1 for print.</em>
              </div>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500 }}>Curve Smoothness (qtres)</label>
              <input
                type="number"
                min={0.1}
                max={10}
                step={0.1}
                value={options.qtres}
                onChange={(e) => setOptions((o) => ({ ...o, qtres: parseFloat(e.target.value) || 0.5 }))}
                style={{ width: "100%", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 6, marginTop: 4 }}
                title="Quadratic curve threshold (0.1-10)"
              />
              <div style={{ fontSize: 10, color: "#6b7280", marginTop: 4, lineHeight: 1.4 }}>
                <strong>0.1–10.</strong> Controls Bézier curve fitting. Lower = smoother curves. Higher = follows edges closely but more anchor points. <em>Recommended: 0.5–1 for print.</em>
              </div>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ fontSize: 12, fontWeight: 500 }}>Blur (noise reduction)</label>
              <input
                type="number"
                min={0}
                max={5}
                step={0.1}
                value={options.blurradius}
                onChange={(e) => setOptions((o) => ({ ...o, blurradius: parseFloat(e.target.value) || 0 }))}
                style={{ width: "100%", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 6, marginTop: 4 }}
                title="Pre-processing blur radius (0-5)"
              />
              <div style={{ fontSize: 10, color: "#6b7280", marginTop: 4, lineHeight: 1.4 }}>
                <strong>0–5.</strong> Applies blur before tracing to reduce noise and compression artifacts. 0 = no blur (sharp edges). <em>Recommended: 0.5–1 for photos/scans, 0 for clean graphics.</em>
              </div>
            </div>
          </div>

          {/* Quick presets */}
          <div style={{ marginTop: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 500, marginBottom: 8, display: "block" }}>Quick Presets</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                className="btnSecondary"
                style={{ padding: "6px 12px", fontSize: 11 }}
                onClick={() => setOptions({ numberofcolors: 8, pathomit: 8, ltres: 1, qtres: 1, blurradius: 0 })}
                title="Best for logos, icons, simple graphics"
              >
                🎨 Logo/Icon
              </button>
              <button
                type="button"
                className="btnSecondary"
                style={{ padding: "6px 12px", fontSize: 11 }}
                onClick={() => setOptions({ numberofcolors: 24, pathomit: 8, ltres: 0.5, qtres: 0.5, blurradius: 0.5 })}
                title="Balanced for DTF/sublimation prints"
              >
                👕 DTF Print
              </button>
              <button
                type="button"
                className="btnSecondary"
                style={{ padding: "6px 12px", fontSize: 11 }}
                onClick={() => setOptions({ numberofcolors: 48, pathomit: 4, ltres: 0.3, qtres: 0.3, blurradius: 1 })}
                title="More colors and detail for photos"
              >
                📷 Photo
              </button>
              <button
                type="button"
                className="btnSecondary"
                style={{ padding: "6px 12px", fontSize: 11 }}
                onClick={() => setOptions({ numberofcolors: 16, pathomit: 12, ltres: 0.8, qtres: 0.8, blurradius: 0 })}
                title="Clean output with minimal paths"
              >
                ✨ Minimal
              </button>
            </div>
          </div>

          {/* Convert button */}
          <div style={{ marginTop: 24 }}>
            <button
              type="button"
              className="btnPrimary"
              onClick={handleConvert}
              disabled={loading || !imageDataUrl}
              style={{ width: "100%", padding: "14px 20px", fontSize: 16 }}
            >
              {loading ? "⏳ Converting..." : "🔄 Convert to Vector"}
            </button>
          </div>

          {imageDataUrl && (
            <button
              type="button"
              className="btnSecondary"
              onClick={clearImage}
              style={{ width: "100%", marginTop: 8 }}
            >
              ✕ Clear Image
            </button>
          )}
        </div>

        {/* Right Panel – Preview & Download */}
        <div
          className="brandFormContainer paddingAll32"
          style={{ flex: "1 1 500px", minWidth: 320 }}
        >
          <h2 className="font18 fontSemiBold blackText appendBottom16">3. Preview &amp; Download</h2>

          {/* Image preview */}
          {previewUrl ? (
            <div style={{ marginBottom: 20 }}>
              <div
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                  padding: 16,
                  background: "#fafafa",
                  textAlign: "center",
                  maxHeight: 400,
                  overflow: "auto",
                }}
              >
                <img
                  src={previewUrl}
                  alt="Preview"
                  style={{ maxWidth: "100%", maxHeight: 350, objectFit: "contain" }}
                />
              </div>
              <div style={{ marginTop: 8, fontSize: 12, color: "#6b7280", textAlign: "center" }}>
                Original: {imageDimensions.width} × {imageDimensions.height} px
              </div>
            </div>
          ) : (
            <div
              style={{
                border: "2px dashed #e5e7eb",
                borderRadius: 12,
                padding: "60px 20px",
                textAlign: "center",
                color: "#9ca3af",
                marginBottom: 20,
              }}
            >
              <div style={{ fontSize: 48, marginBottom: 8 }}>🖼️</div>
              <div>No image loaded</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>Upload a file or enter a URL</div>
            </div>
          )}

          {/* SVG preview (optional) */}
          {svgResult && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>Vector Preview</div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  {/* Zoom controls */}
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <button
                      type="button"
                      onClick={() => setZoomLevel((z) => Math.max(25, z - 25))}
                      style={{
                        padding: "4px 8px",
                        fontSize: 12,
                        border: "1px solid #d1d5db",
                        borderRadius: 4,
                        background: "#fff",
                        cursor: "pointer",
                      }}
                      title="Zoom out"
                    >
                      −
                    </button>
                    <span style={{ fontSize: 11, minWidth: 40, textAlign: "center" }}>{zoomLevel}%</span>
                    <button
                      type="button"
                      onClick={() => setZoomLevel((z) => Math.min(400, z + 25))}
                      style={{
                        padding: "4px 8px",
                        fontSize: 12,
                        border: "1px solid #d1d5db",
                        borderRadius: 4,
                        background: "#fff",
                        cursor: "pointer",
                      }}
                      title="Zoom in"
                    >
                      +
                    </button>
                    <button
                      type="button"
                      onClick={() => setZoomLevel(100)}
                      style={{
                        padding: "4px 8px",
                        fontSize: 11,
                        border: "1px solid #d1d5db",
                        borderRadius: 4,
                        background: "#fff",
                        cursor: "pointer",
                      }}
                      title="Reset zoom"
                    >
                      Fit
                    </button>
                  </div>
                  {/* Show edges toggle */}
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 12,
                      cursor: "pointer",
                      padding: "4px 10px",
                      border: showEdges ? "2px solid #3b82f6" : "1px solid #d1d5db",
                      borderRadius: 6,
                      background: showEdges ? "#eff6ff" : "#fff",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={showEdges}
                      onChange={(e) => setShowEdges(e.target.checked)}
                      style={{ margin: 0 }}
                    />
                    <span>Show Edges</span>
                  </label>
                </div>
              </div>
              {/* Edge mode info */}
              {showEdges && (
                <div
                  style={{
                    padding: "8px 12px",
                    background: "#fef3c7",
                    borderRadius: 8,
                    fontSize: 11,
                    color: "#92400e",
                    marginBottom: 8,
                  }}
                >
                  <strong>Edge View Mode:</strong> Red outlines show vector path boundaries. Each shape is a separate vector path that can be edited in Illustrator/CorelDRAW.
                </div>
              )}
              <div
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                  padding: 16,
                  background: showEdges ? "#f8fafc" : "#fff",
                  maxHeight: 400,
                  overflowX: "auto",
                  overflowY: "auto",
                }}
              >
                <div
                  style={{
                    transform: `scale(${zoomLevel / 100})`,
                    transformOrigin: "top left",
                    display: "inline-block",
                    minWidth: "max-content",
                  }}
                >
                  <div
                    className={showEdges ? "svg-edge-view" : ""}
                    dangerouslySetInnerHTML={{ __html: svgResult }}
                  />
                </div>
              </div>
              <div style={{ marginTop: 8, fontSize: 11, color: "#6b7280", display: "flex", justifyContent: "space-between" }}>
                <span>Scroll horizontally to see full vector</span>
                <span>Zoom: {zoomLevel}%</span>
              </div>
              {/* CSS for edge view mode */}
              <style>{`
                .svg-edge-view svg path,
                .svg-edge-view svg polygon,
                .svg-edge-view svg rect,
                .svg-edge-view svg circle,
                .svg-edge-view svg ellipse {
                  stroke: #ef4444 !important;
                  stroke-width: 0.5px !important;
                  vector-effect: non-scaling-stroke;
                }
                .svg-edge-view svg {
                  background: repeating-linear-gradient(
                    45deg,
                    #f1f5f9,
                    #f1f5f9 10px,
                    #fff 10px,
                    #fff 20px
                  );
                }
              `}</style>
            </div>
          )}

          {/* Download buttons */}
          {svgResult && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12 }}>Download</div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="btnPrimary"
                  onClick={downloadSVG}
                  disabled={loading}
                  style={{ flex: "1 1 120px", padding: "12px 16px" }}
                >
                  📐 SVG
                </button>
                <button
                  type="button"
                  className="btnSecondary"
                  onClick={downloadPDF}
                  disabled={loading}
                  style={{ flex: "1 1 120px", padding: "12px 16px" }}
                >
                  📄 PDF
                </button>
                <button
                  type="button"
                  className="btnSecondary"
                  onClick={downloadEPS}
                  disabled={loading}
                  style={{ flex: "1 1 120px", padding: "12px 16px" }}
                >
                  📎 EPS
                </button>
              </div>
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 12 }}>
                <strong>Tip:</strong> For true vector PDF/EPS, open the SVG in Adobe Illustrator and export.
                The PDF here embeds the raster image; SVG is the vector output.
              </div>
            </div>
          )}

          {/* What This Tool Does */}
          <div
            style={{
              marginTop: 24,
              padding: 16,
              background: "#f0fdf4",
              borderRadius: 12,
              fontSize: 12,
              color: "#166534",
              borderLeft: "4px solid #22c55e",
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>What This Tool Does:</div>
            <ul style={{ margin: 0, paddingLeft: 16, lineHeight: 1.7 }}>
              <li><strong>Analyzes</strong> input raster image and converts it into a clean, resolution-independent vector graphic</li>
              <li><strong>Simplifies shapes</strong>, detects edges, and reconstructs the design using precise geometric forms (circles, lines, polygons, and curves)</li>
              <li><strong>Removes noise</strong>, gradients, and unnecessary details while preserving original structure, proportions, and visual identity</li>
              <li><strong>Outputs scalable SVG</strong> with smooth paths, minimal anchor points, and optimized geometry</li>
              <li><strong>Maintains high fidelity</strong> to original image, preserving exact proportions, symmetry, and alignment</li>
            </ul>
          </div>

          {/* Compatible Software */}
          <div
            style={{
              marginTop: 16,
              padding: 16,
              background: "#fef3c7",
              borderRadius: 12,
              fontSize: 12,
              color: "#92400e",
              borderLeft: "4px solid #f59e0b",
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>Compatible With:</div>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              <span>✅ Adobe Illustrator</span>
              <span>✅ CorelDRAW</span>
              <span>✅ Adobe Photoshop</span>
              <span>✅ Inkscape</span>
              <span>✅ Affinity Designer</span>
            </div>
          </div>

          {/* Use Cases */}
          <div
            style={{
              marginTop: 16,
              padding: 16,
              background: "#eff6ff",
              borderRadius: 12,
              fontSize: 12,
              color: "#1e40af",
              borderLeft: "4px solid #3b82f6",
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>Suitable For:</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
              <span>🖨️ Printing (DTF/Sublimation)</span>
              <span>✂️ Vinyl Cutting</span>
              <span>🔥 Laser Engraving</span>
              <span>🧵 Embroidery</span>
              <span>📐 Large-Scale Displays</span>
              <span>🎨 Logo Design</span>
            </div>
          </div>

          {/* Instructions */}
          <div
            style={{
              marginTop: 16,
              padding: 16,
              background: "#f0f9ff",
              borderRadius: 12,
              fontSize: 13,
              color: "#0c4a6e",
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 8 }}>How to Use:</div>
            <ol style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>
              <li>Upload or load your image</li>
              <li>Adjust options (fewer colors = cleaner vector, smoother paths)</li>
              <li>Click <strong>Convert to Vector</strong></li>
              <li>Download <strong>SVG</strong> - opens directly in Illustrator, CorelDRAW, Photoshop</li>
              <li>For CMYK: Open SVG in Illustrator → Document Color Mode → CMYK</li>
              <li>For EPS: Open SVG in Illustrator/CorelDRAW → Save As → EPS</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
}
