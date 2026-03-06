import React, { useRef, useState, useEffect, useCallback } from "react"

/**
 * Reusable Edit Tool dialog for PixelCraft editor.
 * Shows text, shape, or image controls based on selected element type.
 * Uses controlled inputs and callbacks; supports draggable positioning.
 *
 * Example state structure (parent):
 *   editToolOpen: boolean
 *   editToolPosition: { x: number, y: number }
 *   selectedElement.type = 'text' | 'shape' | 'image' (derived from canvas selection)
 *
 * Example usage:
 *   const elementType = isTextSelected ? 'text' : isShapeSelected ? 'shape' : isImageSelected ? 'image' : null
 *   <EditToolDialog
 *     open={editToolOpen && !!elementType}
 *     onClose={() => setEditToolOpen(false)}
 *     position={editToolPosition}
 *     onPositionChange={setEditToolPosition}
 *     elementType={elementType}
 *     textValues={{ fontFamily, fontSize, fill, ... }}
 *     onTextChange={applyTextStyle}
 *     shapeValues={{ fill, stroke, strokeWidth, rx, opacity, shadow, width, height, angle }}
 *     onShapeStyleChange={applyShapeStyle}
 *     onShapeTransformChange={(updates) => { ... }}
 *     shapeHasImage={isShapeWithImage}
 *     imageValues={{ opacity, borderRadius, shadow, angle, aspectLock }}
 *     onImageChange={applyImageStyle}
 *     onReplaceImage={replaceSelectedImage}
 *     onCropClick={() => {}}
 *   />
 */

// ============================================================================
// IMAGE EFFECTS - Client-side processing (no API required)
// ============================================================================

/** Clamp value between min and max */
const clamp = (val, min = 0, max = 255) => Math.max(min, Math.min(max, val))

/** Apply gaussian blur to ImageData */
function gaussianBlur(imageData, radius = 2) {
  const { data, width, height } = imageData
  const output = new Uint8ClampedArray(data)
  const kernel = []
  const sigma = radius / 2
  let sum = 0
  for (let i = -radius; i <= radius; i++) {
    const val = Math.exp(-(i * i) / (2 * sigma * sigma))
    kernel.push(val)
    sum += val
  }
  for (let i = 0; i < kernel.length; i++) kernel[i] /= sum

  const temp = new Uint8ClampedArray(data)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0, g = 0, b = 0
      for (let k = -radius; k <= radius; k++) {
        const px = clamp(x + k, 0, width - 1)
        const idx = (y * width + px) * 4
        const weight = kernel[k + radius]
        r += data[idx] * weight
        g += data[idx + 1] * weight
        b += data[idx + 2] * weight
      }
      const idx = (y * width + x) * 4
      temp[idx] = r
      temp[idx + 1] = g
      temp[idx + 2] = b
    }
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0, g = 0, b = 0
      for (let k = -radius; k <= radius; k++) {
        const py = clamp(y + k, 0, height - 1)
        const idx = (py * width + x) * 4
        const weight = kernel[k + radius]
        r += temp[idx] * weight
        g += temp[idx + 1] * weight
        b += temp[idx + 2] * weight
      }
      const idx = (y * width + x) * 4
      output[idx] = r
      output[idx + 1] = g
      output[idx + 2] = b
    }
  }
  return new ImageData(output, width, height)
}

/** Posterize/quantize colors */
function posterize(imageData, levels = 4) {
  const { data, width, height } = imageData
  const output = new Uint8ClampedArray(data)
  const step = 255 / (levels - 1)
  for (let i = 0; i < data.length; i += 4) {
    output[i] = Math.round(data[i] / step) * step
    output[i + 1] = Math.round(data[i + 1] / step) * step
    output[i + 2] = Math.round(data[i + 2] / step) * step
  }
  return new ImageData(output, width, height)
}

/** Edge detection using Sobel operator */
function detectEdges(imageData, threshold = 30) {
  const { data, width, height } = imageData
  const output = new Uint8ClampedArray(data.length)
  const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1]
  const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1]
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let gx = 0, gy = 0
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const idx = ((y + ky) * width + (x + kx)) * 4
          const gray = (data[idx] + data[idx + 1] + data[idx + 2]) / 3
          const ki = (ky + 1) * 3 + (kx + 1)
          gx += gray * sobelX[ki]
          gy += gray * sobelY[ki]
        }
      }
      const magnitude = Math.sqrt(gx * gx + gy * gy)
      const edge = magnitude > threshold ? 0 : 255
      const idx = (y * width + x) * 4
      output[idx] = edge
      output[idx + 1] = edge
      output[idx + 2] = edge
      output[idx + 3] = 255
    }
  }
  return new ImageData(output, width, height)
}

/** Convert to grayscale */
function grayscale(imageData) {
  const { data, width, height } = imageData
  const output = new Uint8ClampedArray(data)
  for (let i = 0; i < data.length; i += 4) {
    const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114
    output[i] = gray
    output[i + 1] = gray
    output[i + 2] = gray
  }
  return new ImageData(output, width, height)
}

/** Adjust brightness and contrast */
function adjustBrightnessContrast(imageData, brightness = 0, contrast = 1) {
  const { data, width, height } = imageData
  const output = new Uint8ClampedArray(data)
  for (let i = 0; i < data.length; i += 4) {
    output[i] = clamp((data[i] - 128) * contrast + 128 + brightness)
    output[i + 1] = clamp((data[i + 1] - 128) * contrast + 128 + brightness)
    output[i + 2] = clamp((data[i + 2] - 128) * contrast + 128 + brightness)
  }
  return new ImageData(output, width, height)
}

/** Adjust saturation */
function adjustSaturation(imageData, saturation = 1) {
  const { data, width, height } = imageData
  const output = new Uint8ClampedArray(data)
  for (let i = 0; i < data.length; i += 4) {
    const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114
    output[i] = clamp(gray + (data[i] - gray) * saturation)
    output[i + 1] = clamp(gray + (data[i + 1] - gray) * saturation)
    output[i + 2] = clamp(gray + (data[i + 2] - gray) * saturation)
  }
  return new ImageData(output, width, height)
}

/** Apply color tint */
function colorTint(imageData, r, g, b, amount = 0.3) {
  const { data, width, height } = imageData
  const output = new Uint8ClampedArray(data)
  for (let i = 0; i < data.length; i += 4) {
    output[i] = clamp(data[i] * (1 - amount) + r * amount)
    output[i + 1] = clamp(data[i + 1] * (1 - amount) + g * amount)
    output[i + 2] = clamp(data[i + 2] * (1 - amount) + b * amount)
  }
  return new ImageData(output, width, height)
}

/** Invert colors */
function invert(imageData) {
  const { data, width, height } = imageData
  const output = new Uint8ClampedArray(data)
  for (let i = 0; i < data.length; i += 4) {
    output[i] = 255 - data[i]
    output[i + 1] = 255 - data[i + 1]
    output[i + 2] = 255 - data[i + 2]
  }
  return new ImageData(output, width, height)
}

/** Blend two ImageData arrays */
function blend(imgData1, imgData2, mode = "multiply", opacity = 0.5) {
  const { data: d1, width, height } = imgData1
  const d2 = imgData2.data
  const output = new Uint8ClampedArray(d1)
  for (let i = 0; i < d1.length; i += 4) {
    let r, g, b
    if (mode === "multiply") {
      r = (d1[i] * d2[i]) / 255
      g = (d1[i + 1] * d2[i + 1]) / 255
      b = (d1[i + 2] * d2[i + 2]) / 255
    } else if (mode === "screen") {
      r = 255 - ((255 - d1[i]) * (255 - d2[i])) / 255
      g = 255 - ((255 - d1[i + 1]) * (255 - d2[i + 1])) / 255
      b = 255 - ((255 - d1[i + 2]) * (255 - d2[i + 2])) / 255
    } else {
      r = d2[i]; g = d2[i + 1]; b = d2[i + 2]
    }
    output[i] = clamp(d1[i] * (1 - opacity) + r * opacity)
    output[i + 1] = clamp(d1[i + 1] * (1 - opacity) + g * opacity)
    output[i + 2] = clamp(d1[i + 2] * (1 - opacity) + b * opacity)
  }
  return new ImageData(output, width, height)
}

/** Add noise to image */
function addNoise(imageData, amount = 20) {
  const { data, width, height } = imageData
  const output = new Uint8ClampedArray(data)
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * amount * 2
    output[i] = clamp(data[i] + noise)
    output[i + 1] = clamp(data[i + 1] + noise)
    output[i + 2] = clamp(data[i + 2] + noise)
  }
  return new ImageData(output, width, height)
}

// Image Effect Presets with adjustable parameters
const IMAGE_EFFECT_PRESETS = [
  { id: "none", name: "None (Original)", params: {} },
  {
    id: "cartoon",
    name: "🎨 Cartoon/Anime",
    params: { blur: 2, colors: 6, saturation: 1.3, edgeStrength: 0.7 },
    apply: (imgData, p) => {
      let result = gaussianBlur(imgData, p.blur || 2)
      result = posterize(result, p.colors || 6)
      result = adjustSaturation(result, p.saturation || 1.3)
      const edges = detectEdges(imgData, 25)
      result = blend(result, edges, "multiply", p.edgeStrength || 0.7)
      return result
    },
  },
  {
    id: "ghibli",
    name: "🏯 Studio Ghibli",
    params: { blur: 3, colors: 8, saturation: 1.2, brightness: 10, warmth: 0.15 },
    apply: (imgData, p) => {
      let result = gaussianBlur(imgData, p.blur || 3)
      result = posterize(result, p.colors || 8)
      result = colorTint(result, 255, 240, 220, p.warmth || 0.15)
      result = adjustBrightnessContrast(result, p.brightness || 10, 0.9)
      result = adjustSaturation(result, p.saturation || 1.2)
      const edges = detectEdges(imgData, 40)
      result = blend(result, edges, "multiply", 0.3)
      return result
    },
  },
  {
    id: "watercolor",
    name: "💧 Watercolor",
    params: { blur: 4, colors: 6, saturation: 0.8, noise: 8, brightness: 15 },
    apply: (imgData, p) => {
      let result = gaussianBlur(imgData, p.blur || 4)
      result = posterize(result, p.colors || 6)
      result = adjustSaturation(result, p.saturation || 0.8)
      result = addNoise(result, p.noise || 8)
      result = adjustBrightnessContrast(result, p.brightness || 15, 0.95)
      return result
    },
  },
  {
    id: "oilpainting",
    name: "🖼️ Oil Painting",
    params: { blur: 3, colors: 10, saturation: 1.4, contrast: 1.2, noise: 12 },
    apply: (imgData, p) => {
      let result = gaussianBlur(imgData, p.blur || 3)
      result = posterize(result, p.colors || 10)
      result = adjustBrightnessContrast(result, 5, p.contrast || 1.2)
      result = adjustSaturation(result, p.saturation || 1.4)
      result = addNoise(result, p.noise || 12)
      return result
    },
  },
  {
    id: "pencilsketch",
    name: "✏️ Pencil Sketch",
    params: { blur: 3, contrast: 1.3, brightness: 10 },
    apply: (imgData, p) => {
      let result = grayscale(imgData)
      const inverted = invert(result)
      const blurred = gaussianBlur(inverted, p.blur || 3)
      const { data: d1 } = result
      const { data: d2 } = blurred
      const output = new Uint8ClampedArray(d1)
      for (let i = 0; i < d1.length; i += 4) {
        output[i] = d2[i] === 255 ? 255 : clamp((d1[i] * 256) / (256 - d2[i]))
        output[i + 1] = d2[i + 1] === 255 ? 255 : clamp((d1[i + 1] * 256) / (256 - d2[i + 1]))
        output[i + 2] = d2[i + 2] === 255 ? 255 : clamp((d1[i + 2] * 256) / (256 - d2[i + 2]))
        output[i + 3] = 255
      }
      result = new ImageData(output, imgData.width, imgData.height)
      result = adjustBrightnessContrast(result, p.brightness || 10, p.contrast || 1.3)
      return result
    },
  },
  {
    id: "popart",
    name: "🎭 Pop Art",
    params: { colors: 4, saturation: 2, contrast: 1.5, edgeStrength: 0.8 },
    apply: (imgData, p) => {
      let result = adjustBrightnessContrast(imgData, 0, p.contrast || 1.5)
      result = posterize(result, p.colors || 4)
      result = adjustSaturation(result, p.saturation || 2)
      const edges = detectEdges(imgData, 20)
      result = blend(result, edges, "multiply", p.edgeStrength || 0.8)
      return result
    },
  },
  {
    id: "vintage",
    name: "📷 Vintage/Sepia",
    params: { contrast: 0.9, brightness: 10, noise: 15 },
    apply: (imgData, p) => {
      const { data, width, height } = imgData
      const output = new Uint8ClampedArray(data)
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2]
        output[i] = clamp(r * 0.393 + g * 0.769 + b * 0.189)
        output[i + 1] = clamp(r * 0.349 + g * 0.686 + b * 0.168)
        output[i + 2] = clamp(r * 0.272 + g * 0.534 + b * 0.131)
      }
      let result = new ImageData(output, width, height)
      result = adjustBrightnessContrast(result, p.brightness || 10, p.contrast || 0.9)
      result = addNoise(result, p.noise || 15)
      return result
    },
  },
  {
    id: "cyberpunk",
    name: "🌆 Cyberpunk/Neon",
    params: { colors: 6, saturation: 1.5, contrast: 1.4, brightness: -20 },
    apply: (imgData, p) => {
      let result = adjustBrightnessContrast(imgData, p.brightness || -20, p.contrast || 1.4)
      result = posterize(result, p.colors || 6)
      const { data, width, height } = result
      const output = new Uint8ClampedArray(data)
      for (let i = 0; i < data.length; i += 4) {
        output[i] = clamp(data[i] * 0.8 + data[i + 2] * 0.4)
        output[i + 1] = clamp(data[i + 1] * 0.6 + data[i + 2] * 0.3)
        output[i + 2] = clamp(data[i + 2] * 1.3)
      }
      result = new ImageData(output, width, height)
      result = adjustSaturation(result, p.saturation || 1.5)
      return result
    },
  },
  {
    id: "minimalist",
    name: "◯ Minimalist",
    params: { blur: 5, colors: 3, saturation: 0.7, contrast: 1.2 },
    apply: (imgData, p) => {
      let result = gaussianBlur(imgData, p.blur || 5)
      result = posterize(result, p.colors || 3)
      result = adjustSaturation(result, p.saturation || 0.7)
      result = adjustBrightnessContrast(result, 0, p.contrast || 1.2)
      return result
    },
  },
  {
    id: "comicbook",
    name: "💥 Comic Book",
    params: { colors: 4, saturation: 1.5, contrast: 1.4, edgeStrength: 0.9 },
    apply: (imgData, p) => {
      let result = posterize(imgData, p.colors || 4)
      result = adjustSaturation(result, p.saturation || 1.5)
      result = adjustBrightnessContrast(result, 0, p.contrast || 1.4)
      const edges = detectEdges(imgData, 15)
      result = blend(result, edges, "multiply", p.edgeStrength || 0.9)
      return result
    },
  },
]

/** Apply effect to Fabric.js image object and return new data URL */
async function applyEffectToFabricImage(fabricImage, effectId, params = {}) {
  if (!fabricImage || effectId === "none") return null
  
  const preset = IMAGE_EFFECT_PRESETS.find((p) => p.id === effectId)
  if (!preset || !preset.apply) return null

  // Get the image element from Fabric object
  const imgElement = fabricImage.getElement?.() || fabricImage._element
  if (!imgElement) return null

  // Draw to canvas to get ImageData
  const canvas = document.createElement("canvas")
  const width = imgElement.naturalWidth || imgElement.width
  const height = imgElement.naturalHeight || imgElement.height
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  ctx.drawImage(imgElement, 0, 0)
  const imageData = ctx.getImageData(0, 0, width, height)

  // Apply effect with merged params
  const mergedParams = { ...preset.params, ...params }
  const resultData = preset.apply(imageData, mergedParams)

  // Put result back and return data URL
  ctx.putImageData(resultData, 0, 0)
  return canvas.toDataURL("image/png")
}

// ---- Shared UI primitives – Edit Text matches reference: light gray bg, red accent, blue sliders ----
const RED_ACCENT = "#dc2626"
const RED_ACCENT_BORDER = "#dc2626"
const GRAY_BG = "#f5f5f5"
const GRAY_BORDER = "#d4d4d4"
const DARK_GRAY = "#404040"
const SLIDER_ACCENT = "#3b82f6"

const styles = {
  dialog: {
    position: "fixed",
    zIndex: 10010,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 0,
    width: 360,
    maxHeight: "90vh",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
    userSelect: "none",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 14px",
    borderBottom: "1px solid #e5e7eb",
    cursor: "grab",
    flexShrink: 0,
  },
  headerTitle: { margin: 0, fontSize: 14, fontWeight: 600, color: "#111827", pointerEvents: "none" },
  closeBtn: {
    background: "none",
    border: "none",
    fontSize: 20,
    cursor: "pointer",
    color: "#6b7280",
    padding: "0 4px",
    lineHeight: 1,
  },
  body: {
    padding: 12,
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  sectionLabel: {
    display: "block",
    fontSize: 11,
    fontWeight: 600,
    color: "#6b7280",
    marginBottom: 4,
  },
  row: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" },
  input: {
    padding: "6px 10px",
    borderRadius: 8,
    border: "1px solid #d1d5db",
    fontSize: 12,
    backgroundColor: "#fff",
  },
  inputSmall: { width: 56, padding: "4px 6px", fontSize: 12 },
  select: { flex: 1, padding: "6px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 12, backgroundColor: "#fff" },
  colorInput: { width: 32, height: 32, padding: 0, border: "1px solid #d1d5db", borderRadius: 8, cursor: "pointer" },
  toggleBtn: {
    width: 32,
    height: 32,
    padding: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    borderRadius: 8,
    border: "1px solid #d1d5db",
    background: "#fff",
    cursor: "pointer",
  },
  toggleBtnActive: { background: "#eff6ff", borderColor: SLIDER_ACCENT, color: "#1d4ed8" },
  divider: { borderTop: "1px solid #e5e7eb", marginTop: 4, paddingTop: 8 },
  // Edit Text specific
  textPanelBody: {
    padding: 14,
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: 12,
    backgroundColor: GRAY_BG,
  },
  textArea: {
    width: "100%",
    minHeight: 80,
    padding: 10,
    borderRadius: 8,
    border: "1px solid #d1d5db",
    fontSize: 14,
    resize: "vertical",
    backgroundColor: "#fff",
    fontFamily: "inherit",
  },
  checkboxRed: {
    accentColor: RED_ACCENT,
  },
  btnAiEdit: {
    padding: "6px 12px",
    fontSize: 12,
    fontWeight: 600,
    border: `2px solid ${RED_ACCENT_BORDER}`,
    color: RED_ACCENT,
    background: "#fff",
    borderRadius: 8,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
  },
  btnAddText: {
    padding: "6px 12px",
    fontSize: 12,
    fontWeight: 600,
    border: "2px solid #404040",
    color: DARK_GRAY,
    background: "#fff",
    borderRadius: 8,
    cursor: "pointer",
  },
  sliderRow: { display: "flex", alignItems: "center", gap: 10 },
  sliderInput: { width: 48, padding: "4px 6px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 12 },
}

const DEFAULT_FONT_OPTIONS = [
  "Arial",
  "Helvetica",
  "Times New Roman",
  "Georgia",
  "Courier New",
  "Verdana",
  "Trebuchet MS",
  "Impact",
  "Comic Sans MS",
  "Coyote BC",
]

/**
 * Text editing panel – matches reference: Edit Text layout with textarea, font row,
 * Spacing slider, Curved text / Outline / Shadow checkboxes, shadow controls.
 */
function TextPanel({ values, onChange, onAddText, onAiEdit, fontOptions }) {
  const {
    text = "",
    fontFamily = "Arial",
    fontSize = 32,
    fill = "#111827",
    fontWeight,
    fontStyle,
    textAlign = "left",
    charSpacing = 0,
    textTransform = "none",
    stroke = "",
    strokeWidth = 0,
    shadow,
    curvedText = false,
    curvedTextDirection = "down",
    outline = false,
  } = values
  const bold = fontWeight === "bold" || fontWeight === 700
  const italic = fontStyle === "italic"
  const shadowOn = Boolean(shadow && (shadow.color != null || shadow.blur != null || shadow.offsetX != null || shadow.offsetY != null))
  const spacingVal = typeof charSpacing === "number" ? charSpacing : Number(charSpacing) || 0
  const shadowBlur = shadow?.blur ?? 0
  const shadowOffsetX = shadow?.offsetX ?? 0
  const shadowOffsetY = shadow?.offsetY ?? 5

  return (
    <div style={styles.textPanelBody} onMouseDown={(e) => e.stopPropagation()}>
      {/* Large multi-line text content area */}
      <textarea
        value={text}
        onChange={(e) => onChange({ text: e.target.value })}
        placeholder="Enter text..."
        style={styles.textArea}
        rows={3}
      />

      {/* Font row: family, color, size (- num +), aA, alignment (L/C/R), B, I */}
      <div style={{ ...styles.row, flexWrap: "wrap", gap: 6 }}>
        <select
          value={fontFamily}
          onChange={(e) => onChange({ fontFamily: e.target.value })}
          style={{ ...styles.select, minWidth: 100, flex: "1 1 120px" }}
        >
          {(Array.isArray(fontOptions) && fontOptions.length > 0 ? fontOptions : DEFAULT_FONT_OPTIONS).map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
        <input
          type="color"
          value={typeof fill === "string" && fill.startsWith("#") ? fill : "#111827"}
          onChange={(e) => onChange({ fill: e.target.value })}
          style={styles.colorInput}
          title="Text color"
        />
        <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
          <button type="button" style={styles.toggleBtn} onClick={() => onChange({ fontSize: Math.max(8, (fontSize || 16) - 1) })}>−</button>
          <input
            type="number"
            min={8}
            max={400}
            value={fontSize}
            onChange={(e) => onChange({ fontSize: Number(e.target.value) || 16 })}
            style={{ ...styles.input, width: 48, textAlign: "center" }}
          />
          <button type="button" style={styles.toggleBtn} onClick={() => onChange({ fontSize: Math.min(400, (fontSize || 16) + 1) })}>+</button>
        </div>
        <select
          value={textTransform || "none"}
          onChange={(e) => onChange({ textTransform: e.target.value })}
          style={{ ...styles.input, width: 52, padding: "6px 8px", textAlign: "center" }}
          title="Text transform"
        >
          <option value="none">aA</option>
          <option value="uppercase">AA</option>
          <option value="lowercase">aa</option>
          <option value="capitalize">Aa</option>
        </select>
        {[
          { value: "left", label: "L", title: "Align left" },
          { value: "center", label: "C", title: "Align center" },
          { value: "right", label: "R", title: "Align right" },
        ].map(({ value, label, title }) => (
          <button
            key={value}
            type="button"
            title={title}
            style={{
              ...styles.toggleBtn,
              ...(textAlign === value ? styles.toggleBtnActive : {}),
            }}
            onClick={() => onChange({ textAlign: value })}
          >
            <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
          </button>
        ))}
        <button
          type="button"
          style={{ ...styles.toggleBtn, ...(bold ? styles.toggleBtnActive : {}) }}
          onClick={() => onChange({ fontWeight: bold ? "normal" : "bold" })}
        >
          <b>B</b>
        </button>
        <button
          type="button"
          style={{ ...styles.toggleBtn, ...(italic ? styles.toggleBtnActive : {}) }}
          onClick={() => onChange({ fontStyle: italic ? "normal" : "italic" })}
        >
          <i>I</i>
        </button>
      </div>

      {/* Spacing: label + slider + number (charSpacing) */}
      <div>
        <span style={styles.sectionLabel}>Spacing</span>
        <div style={styles.sliderRow}>
          <input
            type="range"
            min={-50}
            max={300}
            value={Math.max(-50, Math.min(300, spacingVal))}
            onChange={(e) => onChange({ charSpacing: Number(e.target.value) })}
            style={{ flex: 1, accentColor: SLIDER_ACCENT }}
          />
          <input
            type="number"
            value={spacingVal}
            onChange={(e) => onChange({ charSpacing: Number(e.target.value) || 0 })}
            style={styles.sliderInput}
          />
        </div>
      </div>

      {/* Text effects: Curved text (with Up/Down), Outline, Shadow (red checkmark when checked) */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#374151", cursor: "pointer" }}>
          <input type="checkbox" checked={curvedText} onChange={(e) => onChange({ curvedText: e.target.checked })} style={styles.checkboxRed} />
          Curved text
        </label>
        {curvedText && (
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginLeft: 24 }}>
            <span style={{ fontSize: 12, color: "#6b7280" }}>Direction:</span>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, cursor: "pointer" }}>
              <input type="radio" name="curvedDirection" checked={curvedTextDirection === "up"} onChange={() => onChange({ curvedTextDirection: "up" })} style={styles.checkboxRed} />
              Up
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, cursor: "pointer" }}>
              <input type="radio" name="curvedDirection" checked={curvedTextDirection === "down"} onChange={() => onChange({ curvedTextDirection: "down" })} style={styles.checkboxRed} />
              Down
            </label>
          </div>
        )}
        <div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#374151", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={outline}
              onChange={(e) => {
                const checked = e.target.checked
                onChange(checked ? { outline: true, stroke: stroke || "#000000", strokeWidth: strokeWidth || 1, paintFirst: "stroke" } : { outline: false, stroke: "", strokeWidth: 0, paintFirst: "fill" })
              }}
              style={styles.checkboxRed}
            />
            Outline
          </label>
          {outline && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 24, marginTop: 8 }}>
              <input
                type="color"
                value={typeof stroke === "string" && stroke.startsWith("#") ? stroke : "#000000"}
                onChange={(e) => onChange({ stroke: e.target.value })}
                style={styles.colorInput}
                title="Outline color"
              />
              <input
                type="number"
                min={0}
                max={20}
                value={strokeWidth}
                onChange={(e) => onChange({ strokeWidth: Number(e.target.value) || 0 })}
                placeholder="Width"
                style={{ ...styles.input, width: 56 }}
              />
            </div>
          )}
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#374151", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={shadowOn}
            onChange={(e) => {
              if (e.target.checked) onChange({ shadow: { color: shadow?.color || "#000000", blur: shadowBlur || 4, offsetX: shadowOffsetX, offsetY: shadowOffsetY } })
              else onChange({ shadow: null })
            }}
            style={styles.checkboxRed}
          />
          Shadow
        </label>
      </div>

      {/* Shadow controls – visible when Shadow is checked */}
      {shadowOn && shadow && (
        <div style={{ backgroundColor: "#fff", padding: 10, borderRadius: 8, border: "1px solid #e5e7eb", display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={styles.row}>
            <input
              type="color"
              value={typeof shadow.color === "string" && shadow.color.startsWith("#") ? shadow.color : "#d1d5db"}
              onChange={(e) => onChange({ shadow: { ...shadow, color: e.target.value } })}
              style={styles.colorInput}
              title="Shadow color"
            />
            <span style={{ fontSize: 12, color: "#6b7280" }}>Blur</span>
            <input type="range" min={0} max={30} value={shadowBlur} onChange={(e) => onChange({ shadow: { ...shadow, blur: Number(e.target.value) } })} style={{ flex: 1, accentColor: SLIDER_ACCENT }} />
            <input type="number" value={shadowBlur} onChange={(e) => onChange({ shadow: { ...shadow, blur: Number(e.target.value) || 0 } })} style={styles.sliderInput} />
          </div>
          <div style={styles.sliderRow}>
            <span style={{ fontSize: 12, color: "#6b7280", minWidth: 56 }}>Offset X</span>
            <input type="range" min={-20} max={20} value={shadowOffsetX} onChange={(e) => onChange({ shadow: { ...shadow, offsetX: Number(e.target.value) } })} style={{ flex: 1, accentColor: SLIDER_ACCENT }} />
            <input type="number" value={shadowOffsetX} onChange={(e) => onChange({ shadow: { ...shadow, offsetX: Number(e.target.value) || 0 } })} style={styles.sliderInput} />
          </div>
          <div style={styles.sliderRow}>
            <span style={{ fontSize: 12, color: "#6b7280", minWidth: 56 }}>Offset Y</span>
            <input type="range" min={-20} max={20} value={shadowOffsetY} onChange={(e) => onChange({ shadow: { ...shadow, offsetY: Number(e.target.value) } })} style={{ flex: 1, accentColor: SLIDER_ACCENT }} />
            <input type="number" value={shadowOffsetY} onChange={(e) => onChange({ shadow: { ...shadow, offsetY: Number(e.target.value) || 0 } })} style={styles.sliderInput} />
          </div>
        </div>
      )}

    </div>
  )
}

/**
 * Shape editing panel: fill, stroke, mask image into shape, corner radius, opacity, shadow, rotation.
 */
function ShapePanel({ values, onStyleChange, onTransformChange, hasImage, onMaskImageIntoShape }) {
  const {
    fill = "#f3f4f6",
    stroke = "#9ca3af",
    strokeWidth = 2,
    strokeDashArray,
    rx = 0,
    ry = 0,
    opacity = 1,
    shadow,
    width,
    height,
    angle = 0,
  } = values
  const dashValue = !strokeDashArray || strokeDashArray.length === 0 ? "solid" : strokeDashArray[0] === 2 && strokeDashArray[1] === 2 ? "dotted" : "dashed"
  const shadowOn = Boolean(shadow && (shadow.color || shadow.blur))

  return (
    <div style={styles.body} onMouseDown={(e) => e.stopPropagation()}>
      {/* Mask image into shape (Photoshop-style clipping mask) */}
      {onMaskImageIntoShape && (
        <div style={{ marginBottom: 12, padding: 10, background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
          <label style={styles.sectionLabel}>Mask image into shape</label>
          <p style={{ fontSize: 11, color: "#64748b", margin: "4px 0 8px 0" }}>
            Clip an image to this shape. Choose a file to add or replace the masked image.
          </p>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 500 }}>
            <span style={{ opacity: 0.9 }}>🖼</span>
            {hasImage ? "Replace masked image…" : "Choose image…"}
            <input
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) onMaskImageIntoShape(f)
                e.target.value = ""
              }}
            />
          </label>
        </div>
      )}
      <div>
        <label style={styles.sectionLabel}>Fill</label>
        <input
          type="color"
          value={typeof fill === "string" && fill.startsWith("#") ? fill : "#f3f4f6"}
          onChange={(e) => onStyleChange({ fill: e.target.value })}
          style={{ width: "100%", height: 36, padding: 0, border: "1px solid #d1d5db", borderRadius: 8, cursor: "pointer" }}
        />
      </div>
      <div>
        <label style={styles.sectionLabel}>Stroke</label>
        <input
          type="color"
          value={typeof stroke === "string" && stroke.startsWith("#") ? stroke : "#9ca3af"}
          onChange={(e) => onStyleChange({ stroke: e.target.value })}
          style={{ width: "100%", height: 36, padding: 0, border: "1px solid #d1d5db", borderRadius: 8, cursor: "pointer" }}
        />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div>
          <label style={styles.sectionLabel}>Stroke width</label>
          <input
            type="number"
            min={0}
            max={50}
            value={strokeWidth}
            onChange={(e) => onStyleChange({ strokeWidth: Number(e.target.value) ?? 0 })}
            style={{ ...styles.input, width: "100%" }}
          />
        </div>
        <div>
          <label style={styles.sectionLabel}>Border style</label>
          <select
            value={dashValue}
            onChange={(e) => {
              const v = e.target.value
              onStyleChange({ strokeDashArray: v === "solid" ? null : v === "dashed" ? [8, 4] : [2, 2] })
            }}
            style={{ ...styles.input, width: "100%" }}
          >
            <option value="solid">Solid</option>
            <option value="dashed">Dashed</option>
            <option value="dotted">Dotted</option>
          </select>
        </div>
      </div>
      <div>
        <label style={styles.sectionLabel}>Corner radius</label>
        <input
          type="number"
          min={0}
          max={200}
          value={rx ?? 0}
          onChange={(e) => { const v = Number(e.target.value) || 0; onStyleChange({ rx: v, ry: v }) }}
          style={{ ...styles.input, width: "100%" }}
        />
      </div>
      <div>
        <label style={styles.sectionLabel}>Opacity {Math.round((opacity != null ? Number(opacity) : 1) * 100)}%</label>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={opacity != null ? Number(opacity) : 1}
          onChange={(e) => onStyleChange({ opacity: Number(e.target.value) })}
          style={{ width: "100%", accentColor: "#3b82f6" }}
        />
      </div>
      <div>
        <label style={styles.sectionLabel}>Shadow</label>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
          <input
            type="checkbox"
            checked={shadowOn}
            onChange={(e) => {
              if (e.target.checked) onStyleChange({ shadow: { color: shadow?.color || "#000", blur: shadow?.blur ?? 8, offsetX: shadow?.offsetX ?? 0, offsetY: shadow?.offsetY ?? 0 } })
              else onStyleChange({ shadow: null })
            }}
          />
          Enable shadow
        </label>
        {shadowOn && shadow && (
          <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
            <input
              type="color"
              value={typeof shadow.color === "string" && shadow.color.startsWith("#") ? shadow.color : "#000000"}
              onChange={(e) => onStyleChange({ shadow: { ...shadow, color: e.target.value } })}
              style={styles.colorInput}
            />
            <input
              type="number"
              placeholder="Blur"
              value={shadow.blur ?? ""}
              onChange={(e) => onStyleChange({ shadow: { ...shadow, blur: Number(e.target.value) || 0 } })}
              style={{ ...styles.input, width: 64 }}
            />
          </div>
        )}
      </div>
      <div>
        <label style={styles.sectionLabel}>Rotation (°)</label>
        <input
          type="number"
          min={-360}
          max={360}
          value={angle ?? ""}
          onChange={(e) => onTransformChange({ angle: Number(e.target.value) || 0 })}
          style={{ ...styles.input, width: "100%" }}
        />
      </div>
      {!hasImage && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div>
              <label style={styles.sectionLabel}>Width</label>
              <input
                type="number"
                min={20}
                max={2000}
                value={width ?? ""}
                onChange={(e) => onTransformChange({ width: Number(e.target.value) || width })}
                style={{ ...styles.input, width: "100%" }}
              />
            </div>
            <div>
              <label style={styles.sectionLabel}>Height</label>
              <input
                type="number"
                min={20}
                max={2000}
                value={height ?? ""}
                onChange={(e) => onTransformChange({ height: Number(e.target.value) || height })}
                style={{ ...styles.input, width: "100%" }}
              />
            </div>
          </div>
          <div style={styles.row}>
            <button type="button" style={{ ...styles.toggleBtn, flex: 1 }} onClick={() => onTransformChange({ flipH: true })}>Flip H</button>
            <button type="button" style={{ ...styles.toggleBtn, flex: 1 }} onClick={() => onTransformChange({ flipV: true })}>Flip V</button>
          </div>
        </>
      )}
    </div>
  )
}

/**
 * Image editing panel: replace, effects, opacity, border radius, shadow, crop (placeholder), aspect lock, rotation.
 */
function ImagePanel({ values, onChange, onReplaceImage, onCropClick, onApplyEffect, fabricImage }) {
  const { opacity = 1, borderRadius = 0, shadow, angle = 0, aspectLock = false } = values
  const shadowOn = Boolean(shadow && (shadow.color || shadow.blur))

  // Effect state
  const [selectedEffect, setSelectedEffect] = useState("none")
  const [effectParams, setEffectParams] = useState({})
  const [effectLoading, setEffectLoading] = useState(false)

  // Get current effect preset
  const currentPreset = IMAGE_EFFECT_PRESETS.find((p) => p.id === selectedEffect)

  // Apply effect function
  const applyCurrentEffect = useCallback(async (effectId, params) => {
    if (effectId === "none" || !onApplyEffect || !fabricImage) return
    setEffectLoading(true)
    try {
      const newDataUrl = await applyEffectToFabricImage(fabricImage, effectId, params)
      if (newDataUrl && onApplyEffect) {
        onApplyEffect(newDataUrl)
      }
    } catch (err) {
      console.error("Effect application failed:", err)
    } finally {
      setEffectLoading(false)
    }
  }, [fabricImage, onApplyEffect])

  // Auto-apply when effect is selected from dropdown
  const handleEffectChange = useCallback((effectId) => {
    setSelectedEffect(effectId)
    const preset = IMAGE_EFFECT_PRESETS.find((p) => p.id === effectId)
    if (preset?.params) {
      const defaultParams = { ...preset.params }
      setEffectParams(defaultParams)
      // Auto-apply with default params
      if (effectId !== "none") {
        applyCurrentEffect(effectId, defaultParams)
      }
    } else {
      setEffectParams({})
    }
  }, [applyCurrentEffect])

  // Auto-apply when params change (with debounce)
  const handleParamChange = useCallback((key, value) => {
    setEffectParams((prev) => {
      const newParams = { ...prev, [key]: value }
      // Apply effect with new params
      if (selectedEffect !== "none") {
        applyCurrentEffect(selectedEffect, newParams)
      }
      return newParams
    })
  }, [selectedEffect, applyCurrentEffect])

  // Parameter control renderer with auto-apply on change
  const renderParamControl = (key, value, label, min, max, step = 1) => (
    <div key={key} style={{ marginBottom: 8 }}>
      <label style={{ fontSize: 10, color: "#6b7280", display: "flex", justifyContent: "space-between" }}>
        <span>{label}</span>
        <span>{typeof value === "number" ? (step < 1 ? value.toFixed(1) : value) : value}</span>
      </label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => handleParamChange(key, Number(e.target.value))}
        style={{ width: "100%", accentColor: "#3b82f6" }}
        disabled={effectLoading}
      />
    </div>
  )

  return (
    <div style={styles.body} onMouseDown={(e) => e.stopPropagation()}>
      {onReplaceImage && (
        <div>
          <label style={styles.sectionLabel}>Replace image</label>
          <label style={{ display: "inline-block", padding: "8px 14px", borderRadius: 8, border: "1px solid #d1d5db", background: "#f9fafb", cursor: "pointer", fontSize: 12, fontWeight: 500 }}>
            Choose file…
            <input
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onReplaceImage(f); e.target.value = "" }}
            />
          </label>
        </div>
      )}

      {/* Image Effects Section */}
      {onApplyEffect && (
        <div style={{ padding: 12, background: "#f0f9ff", borderRadius: 8, marginBottom: 4 }}>
          <label style={{ ...styles.sectionLabel, marginBottom: 8 }}>✨ Image Effects {effectLoading && <span style={{ color: "#3b82f6" }}>(applying...)</span>}</label>
          
          {/* Effect Dropdown */}
          <select
            value={selectedEffect}
            onChange={(e) => handleEffectChange(e.target.value)}
            style={{ ...styles.select, width: "100%", marginBottom: 8 }}
            disabled={effectLoading}
          >
            {IMAGE_EFFECT_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.name}
              </option>
            ))}
          </select>

          {/* Effect Parameter Controls - Auto-shown when effect is selected */}
          {selectedEffect !== "none" && currentPreset?.params && Object.keys(currentPreset.params).length > 0 && (
            <div style={{ padding: 10, background: "#fff", borderRadius: 6, marginBottom: 8 }}>
              <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 8, fontWeight: 500 }}>
                Adjust {currentPreset.name.replace(/^[^\s]+\s/, "")} Settings:
              </div>
              {effectParams.blur !== undefined && renderParamControl("blur", effectParams.blur, "Blur", 0, 10, 1)}
              {effectParams.colors !== undefined && renderParamControl("colors", effectParams.colors, "Colors", 2, 24, 1)}
              {effectParams.saturation !== undefined && renderParamControl("saturation", effectParams.saturation, "Saturation", 0, 3, 0.1)}
              {effectParams.contrast !== undefined && renderParamControl("contrast", effectParams.contrast, "Contrast", 0.5, 2, 0.1)}
              {effectParams.brightness !== undefined && renderParamControl("brightness", effectParams.brightness, "Brightness", -50, 50, 5)}
              {effectParams.edgeStrength !== undefined && renderParamControl("edgeStrength", effectParams.edgeStrength, "Edge Strength", 0, 1, 0.1)}
              {effectParams.noise !== undefined && renderParamControl("noise", effectParams.noise, "Noise/Texture", 0, 30, 1)}
              {effectParams.warmth !== undefined && renderParamControl("warmth", effectParams.warmth, "Warmth", 0, 0.5, 0.05)}
              
              {/* Reset to defaults and re-apply */}
              <button
                type="button"
                onClick={() => {
                  const defaultParams = { ...currentPreset.params }
                  setEffectParams(defaultParams)
                  applyCurrentEffect(selectedEffect, defaultParams)
                }}
                disabled={effectLoading}
                style={{
                  width: "100%",
                  padding: "4px 8px",
                  fontSize: 10,
                  border: "1px solid #d1d5db",
                  borderRadius: 4,
                  background: "#f9fafb",
                  cursor: effectLoading ? "not-allowed" : "pointer",
                  marginTop: 4,
                }}
              >
                Reset to Defaults
              </button>
            </div>
          )}

          <div style={{ fontSize: 9, color: "#6b7280", marginTop: 4, textAlign: "center" }}>
            {selectedEffect === "none" 
              ? "Select an effect to apply" 
              : "Changes apply automatically"}
          </div>
        </div>
      )}

      <div>
        <label style={styles.sectionLabel}>Opacity {Math.round((opacity != null ? Number(opacity) : 1) * 100)}%</label>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={opacity != null ? Number(opacity) : 1}
          onChange={(e) => onChange({ opacity: Number(e.target.value) })}
          style={{ width: "100%", accentColor: "#3b82f6" }}
        />
      </div>
      <div>
        <label style={styles.sectionLabel}>Border radius</label>
        <input
          type="number"
          min={0}
          max={500}
          value={borderRadius ?? 0}
          onChange={(e) => onChange({ borderRadius: Number(e.target.value) || 0 })}
          style={{ ...styles.input, width: "100%" }}
        />
      </div>
      <div>
        <label style={styles.sectionLabel}>Shadow</label>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
          <input
            type="checkbox"
            checked={shadowOn}
            onChange={(e) => {
              if (e.target.checked) onChange({ shadow: { color: shadow?.color || "#000", blur: shadow?.blur ?? 8, offsetX: shadow?.offsetX ?? 0, offsetY: shadow?.offsetY ?? 0 } })
              else onChange({ shadow: null })
            }}
          />
          Enable shadow
        </label>
      </div>
      {onCropClick && (
        <div>
          <button type="button" style={{ ...styles.toggleBtn, width: "100%", height: 36 }} onClick={onCropClick}>
            Crop (coming soon)
          </button>
        </div>
      )}
      <div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
          <input
            type="checkbox"
            checked={aspectLock}
            onChange={(e) => onChange({ aspectLock: e.target.checked })}
          />
          Lock aspect ratio
        </label>
      </div>
      <div>
        <label style={styles.sectionLabel}>Rotation (°)</label>
        <input
          type="number"
          min={-360}
          max={360}
          value={angle ?? ""}
          onChange={(e) => onChange({ angle: Number(e.target.value) || 0 })}
          style={{ ...styles.input, width: "100%" }}
        />
      </div>
    </div>
  )
}

/**
 * EditToolDialog – single dialog that shows text, shape, or image controls based on elementType.
 * Supports optional bounds constraints for containing within a specific area.
 */
export default function EditToolDialog({
  open,
  onClose,
  position,
  onPositionChange,
  elementType,
  fontOptions,
  textValues,
  onTextChange,
  onAddText,
  onAiEdit,
  shapeValues,
  onShapeStyleChange,
  onShapeTransformChange,
  shapeHasImage,
  onMaskImageIntoShape,
  imageValues,
  onImageChange,
  onReplaceImage,
  onCropClick,
  // Image effects
  onApplyImageEffect,
  fabricImage,
  // Optional bounds constraints { minX, minY, maxX, maxY }
  bounds,
  // Use absolute positioning instead of fixed (for containing within a parent)
  useAbsolutePosition = false,
}) {
  const dialogRef = useRef(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })

  const handleDragStart = (e) => {
    if (e.target.closest("button") || e.target.closest("input") || e.target.closest("select") || e.target.closest("label") || e.target.closest("textarea") || e.target.closest('a')) return
    setIsDragging(true)
    if (dialogRef.current) {
      const rect = dialogRef.current.getBoundingClientRect()
      setDragOffset({ x: e.clientX - rect.left, y: e.clientY - rect.top })
    }
  }

  // Constrain position within bounds
  const constrainPosition = useCallback((x, y) => {
    if (!bounds) return { x, y }
    const dialogWidth = dialogRef.current?.offsetWidth || 360
    const dialogHeight = dialogRef.current?.offsetHeight || 400
    const constrainedX = Math.max(bounds.minX || 0, Math.min(x, (bounds.maxX || 1000) - dialogWidth))
    const constrainedY = Math.max(bounds.minY || 0, Math.min(y, (bounds.maxY || 750) - dialogHeight))
    return { x: constrainedX, y: constrainedY }
  }, [bounds])

  useEffect(() => {
    if (!isDragging) return
    const handleMouseMove = (e) => {
      let newX, newY
      if (useAbsolutePosition && dialogRef.current) {
        // For absolute positioning, calculate relative to parent
        const parent = dialogRef.current.parentElement
        if (parent) {
          const parentRect = parent.getBoundingClientRect()
          newX = e.clientX - parentRect.left - dragOffset.x
          newY = e.clientY - parentRect.top - dragOffset.y
        } else {
          newX = e.clientX - dragOffset.x
          newY = e.clientY - dragOffset.y
        }
      } else {
        newX = e.clientX - dragOffset.x
        newY = e.clientY - dragOffset.y
      }
      const constrained = constrainPosition(newX, newY)
      onPositionChange?.(constrained)
    }
    const handleMouseUp = () => setIsDragging(false)
    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("mouseup", handleMouseUp)
    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", handleMouseUp)
    }
  }, [isDragging, dragOffset, onPositionChange, useAbsolutePosition, constrainPosition])

  if (!open) return null

  const title = elementType === "text" ? "Edit Text" : elementType === "shape" ? "Shape" : "Image"
  const isTextMode = elementType === "text"

  return (
    <div
      ref={dialogRef}
      style={{
        ...styles.dialog,
        position: useAbsolutePosition ? "absolute" : "fixed",
        left: position?.x ?? 0,
        top: position?.y ?? 0,
        cursor: isDragging ? "grabbing" : "default",
      }}
    >
      <div style={styles.header} onMouseDown={handleDragStart}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
          <h2 style={styles.headerTitle}>{isTextMode ? "Edit Text" : title + " tools"} </h2>
          {isTextMode && (
            <>
              {onAiEdit && (
                <button type="button" onClick={onAiEdit} onMouseDown={(e) => e.stopPropagation()} style={styles.btnAiEdit} aria-label="AI Edit">
                  ✨ AI EDIT
                </button>
              )}
              {onAddText && (
                <button type="button" onClick={onAddText} onMouseDown={(e) => e.stopPropagation()} style={styles.btnAddText} aria-label="Add text">
                  ADD TEXT
                </button>
              )}
            </>
          )}
        </div>
        <button type="button" onClick={onClose} onMouseDown={(e) => e.stopPropagation()} style={styles.closeBtn} aria-label="Close">
          ×
        </button>
      </div>
      {elementType === "text" && (
        <TextPanel
          values={textValues || {}}
          onChange={onTextChange}
          onAddText={onAddText}
          onAiEdit={onAiEdit}
          fontOptions={fontOptions}
        />
      )}
      {elementType === "shape" && (
        <ShapePanel
          values={shapeValues || {}}
          onStyleChange={onShapeStyleChange}
          onTransformChange={onShapeTransformChange}
          hasImage={shapeHasImage}
          onMaskImageIntoShape={onMaskImageIntoShape}
        />
      )}
      {elementType === "image" && (
        <ImagePanel
          values={imageValues || {}}
          onChange={onImageChange}
          onReplaceImage={onReplaceImage}
          onCropClick={onCropClick}
          onApplyEffect={onApplyImageEffect}
          fabricImage={fabricImage}
        />
      )}
    </div>
  )
}
