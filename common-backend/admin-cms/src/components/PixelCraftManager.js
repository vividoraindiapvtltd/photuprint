import React, { useEffect, useMemo, useRef, useState, useCallback } from "react"
import api from "../api/axios"
import {
  AlertMessage,
  FormField,
  ViewToggle,
  Pagination,
  EntityCard,
  EntityCardHeader,
  ActionButtons,
  SearchField,
  StatusFilter,
  calculateStandardStatusCounts,
  filterEntitiesByStatus,
  generateBrandColor,
} from "../common"
import EditToolDialog from "./EditToolDialog"
import { vectorizeImageToSVG } from "../utils/vectorizeImage"
import * as fabric from "fabric"

// Prevents group from recalculating position/size when adding image into shape (Fabric 7 layout would otherwise move the group)
class NoopLayoutManager extends fabric.LayoutManager {
  performLayout() {}
}

const getBaseUploadUrl = () => {
  return ""
}

function normalizePreviewUrl(url) {
  if (!url) return null
  if (url.startsWith("http://") || url.startsWith("https://")) return url
  if (url.startsWith("/uploads/")) return `${getBaseUploadUrl()}${url}`
  return url
}

// Fallback used only when template has no dimension selected (e.g. new template before first save).
// Canvas size is always intended to come from template dimensions; this avoids undefined width/height.
const FALLBACK_CANVAS_SPEC = { width: 600, height: 400, dpi: 300, bleed: 0, safeAreaInset: 0 }

// Convert dimension unit to inches for pixel calculation at given dpi
function unitToInches(value, unit) {
  if (unit === "mm") return value / 25.4
  if (unit === "cm") return value / 2.54
  if (unit === "inch") return value
  if (unit === "ft") return value * 12
  if (unit === "m") return value * 39.3701
  return value / 25.4 // default mm
}

/**
 * Converts template dimension metadata (width, height, unit, dpi) into pixel dimensions for the canvas.
 * Template dimensions control the canvas size; aspect ratio is preserved (no stretching).
 * Returns null if dimension is missing or invalid so callers can fall through.
 */
function dimensionToCanvasSpec(dimension) {
  if (!dimension || dimension.width == null || dimension.height == null) return null
  const dpi = Number(dimension.dpi) || 300
  const widthInches = unitToInches(Number(dimension.width), dimension.unit || "mm")
  const heightInches = unitToInches(Number(dimension.height), dimension.unit || "mm")
  return {
    width: Math.round(widthInches * dpi),
    height: Math.round(heightInches * dpi),
    dpi,
    bleed: Number(dimension.bleed) || 0,
    safeAreaInset: Number(dimension.safeAreaInset) || 0,
  }
}

/**
 * Derives canvas dimensions from the selected template's dimensions.
 * - Primary: template's dimensionId → lookup dimension → width/height from dimension metadata.
 * - Fallback when loading saved template: pixelcraftDocument.canvas (saved width/height).
 * - Last resort: FALLBACK_CANVAS_SPEC only when no dimension is selected (e.g. new template).
 * When the template or dimension changes, canvas is reinitialized with the new size (see useEffect).
 */
function getCanvasSpec(activeTemplate, dimensions) {
  const dimensionId = activeTemplate?.dimensionId || activeTemplate?.pixelcraftDocument?.dimensionId
  if (dimensionId && dimensions?.length) {
    const dim = dimensions.find((d) => String(d._id) === String(dimensionId))
    if (dim) {
      const spec = dimensionToCanvasSpec(dim)
      if (spec) return spec
    }
  }
  const doc = activeTemplate?.pixelcraftDocument
  if (doc?.canvas && typeof doc.canvas.width === "number" && typeof doc.canvas.height === "number") {
    return {
      width: doc.canvas.width,
      height: doc.canvas.height,
      dpi: doc.canvas.dpi ?? 300,
      bleed: doc.canvas.bleed ?? 0,
      safeAreaInset: doc.canvas.safeAreaInset ?? 0,
    }
  }
  return FALLBACK_CANVAS_SPEC
}

function buildDefaultPixelcraftDocument(canvasJson, canvasSpec) {
  return {
    schemaVersion: "1.0",
    canvas: canvasSpec ?? FALLBACK_CANVAS_SPEC,
    fabricJson: canvasJson,
  }
}

function dataUrlToFile(dataUrl, filename) {
  const [meta, content] = dataUrl.split(",")
  const mime = meta.match(/data:(.*?);base64/)?.[1] || "image/png"
  const binStr = atob(content)
  const len = binStr.length
  const arr = new Uint8Array(len)
  for (let i = 0; i < len; i++) arr[i] = binStr.charCodeAt(i)
  return new File([arr], filename, { type: mime })
}

/** Trigger browser download from a data URL or Blob. */
function triggerDownload(dataUrlOrBlob, filename) {
  const isBlob = dataUrlOrBlob instanceof Blob
  const url = isBlob ? URL.createObjectURL(dataUrlOrBlob) : dataUrlOrBlob
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.style.display = "none"
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  if (isBlob) URL.revokeObjectURL(url)
}

/** Download a string as a file (e.g. SVG). */
function triggerDownloadString(content, filename, mimeType = "image/svg+xml") {
  const blob = new Blob([content], { type: mimeType + ";charset=utf-8" })
  triggerDownload(blob, filename)
}

function collectImageObjects(obj, out = []) {
  if (!obj) return out
  if (obj.type === "image" || (obj.getSrc && typeof obj.getSrc === "function")) {
    out.push(obj)
    return out
  }
  if (obj.type === "group" && obj.getObjects) {
    obj.getObjects().forEach((child) => collectImageObjects(child, out))
  }
  return out
}

function blobToDataURL(imgElement) {
  return new Promise((resolve, reject) => {
    if (!imgElement || !imgElement.src || !imgElement.src.startsWith("blob:")) {
      resolve(null)
      return
    }
    const w = imgElement.naturalWidth || imgElement.width
    const h = imgElement.naturalHeight || imgElement.height
    if (!w || !h) {
      resolve(null)
      return
    }
    const canvas = document.createElement("canvas")
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext("2d")
    ctx.drawImage(imgElement, 0, 0)
    try {
      resolve(canvas.toDataURL("image/png"))
    } catch (e) {
      reject(e)
    }
  })
}

const PLACEHOLDER_IMAGE_DATAURL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

function stripBlobUrlsFromFabricJson(json) {
  if (!json) return json
  const out = Array.isArray(json) ? [...json] : { ...json }
  if (out.objects && Array.isArray(out.objects)) {
    out.objects = out.objects.map((obj) => {
      const o = typeof obj === "object" && obj !== null ? { ...obj } : obj
      if (o && typeof o === "object" && o.src && String(o.src).startsWith("blob:")) {
        o.src = PLACEHOLDER_IMAGE_DATAURL
      }
      if (o && o.objects && Array.isArray(o.objects)) {
        o.objects = o.objects.map((child) => stripBlobUrlsFromFabricJson({ objects: [child] }).objects[0])
      }
      return o
    })
  }
  return out
}

function makeId(prefix = "layer") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export default function PixelCraftManager() {
  const [templates, setTemplates] = useState([])
  const [categories, setCategories] = useState([])
  const [dimensions, setDimensions] = useState([])
  const [fonts, setFonts] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const [mode, setMode] = useState("list") // list | edit
  const [activeTemplate, setActiveTemplate] = useState(null)

  // Pre-fill form when not editing: set name, category, dimension then click "New template"
  const [newTemplateName, setNewTemplateName] = useState("")
  const [newTemplateCategoryId, setNewTemplateCategoryId] = useState("")
  const [newTemplateDimensionId, setNewTemplateDimensionId] = useState("")

  const [viewMode, setViewMode] = useState("card")
  const [statusFilter, setStatusFilter] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(10)
  const [displayedCards, setDisplayedCards] = useState([])
  const [hasMoreCards, setHasMoreCards] = useState(false)
  const [imagePopupUrl, setImagePopupUrl] = useState(null)

  const canvasContainerRef = useRef(null)
  // Callback ref to detect when the canvas container DOM node mounts/unmounts
  const canvasContainerCallbackRef = useCallback((node) => {
    canvasContainerRef.current = node
    setCanvasContainerMounted(!!node)
  }, [])
  const fabricRef = useRef(null)
  const [selectionVersion, setSelectionVersion] = useState(0)
  // Unified Edit Tool dialog (text / shape / image) – single position and open state
  const [editToolOpen, setEditToolOpen] = useState(false)
  const [editToolPosition, setEditToolPosition] = useState({ x: 10, y: 10 }) // Position within canvas area
  const [layersDialogOpen, setLayersDialogOpen] = useState(false)
  const [layersTab, setLayersTab] = useState("layers")
  const [canvasBackgroundColor, setCanvasBackgroundColor] = useState("#ffffff")
  const [backgroundType, setBackgroundType] = useState("color") // "color" | "image" | "gradient"
  const [backgroundImage, setBackgroundImage] = useState(null) // { url, fit: "cover" | "contain" | "tile" }
  const [backgroundGradient, setBackgroundGradient] = useState({ type: "linear", angle: 0, color1: "#ffffff", color2: "#000000" })
  const backgroundInputRef = useRef(null)
  const [layersDialogPosition, setLayersDialogPosition] = useState({ x: 1014, y: 678.5 })
  // isLayersDragging removed — drag uses direct DOM cursor manipulation
  // layersDragOffset removed — drag uses direct DOM manipulation to avoid flicker
  const layersDialogRef = useRef(null)
  const layersPositionRef = useRef({ x: 1014, y: 678.5 }) // Track position in ref to avoid re-renders
  
  // Sync ref with state when dialog opens (ensures ref has correct initial position)
  useEffect(() => {
    if (layersDialogOpen) {
      layersPositionRef.current = { ...layersDialogPosition }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layersDialogOpen]) // Only sync when dialog opens, not on every position change
  const [canvasZoom, setCanvasZoom] = useState(100) // 100% default
  
  // Full screen editor modal state
  const [fullscreenEditorOpen, setFullscreenEditorOpen] = useState(false)
  // Track when the canvas container DOM node is actually mounted (ref callback)
  const [canvasContainerMounted, setCanvasContainerMounted] = useState(false)

  // Undo/redo: up to 10 steps (11 states). Refs for use inside canvas effect.
  const UNDO_MAX = 10
  const [undoHistory, setUndoHistory] = useState([])
  const [undoIndex, setUndoIndex] = useState(-1)
  const undoHistoryRef = useRef([])
  const undoIndexRef = useRef(-1)
  const skipUndoRecordRef = useRef(false)

  const isEditing = mode === "edit"

  // Shared list for canvas serialization (save draft + undo history)
  const CANVAS_PROPERTIES_TO_INCLUDE = [
    "layerId",
    "editable",
    "variableId",
    "layerType",
    "constraints",
    "curvedText",
    "curvedTextDirection",
    "paintFirst",
    "borderRadius",
  ]

  /** Restore curved text paths after loadFromJSON (path may not revive from JSON). */
  const restoreCurvedTextPaths = useCallback((c) => {
    if (!c || !c.getObjects) return
    const objs = c.getObjects()
    objs.forEach((obj) => {
      const isText = obj.type === "textbox" || obj.get?.("layerType") === "text"
      if (!isText) return
      if (!obj.get("curvedText")) return
      const path = obj.get("path")
      if (path && typeof path.path !== "undefined") return
      
      const w = Math.max(100, Number(obj.get("width")) || 400)
      const curveH = Math.min(w * 0.3, 120)
      const midX = w / 2
      const direction = obj.get("curvedTextDirection") || "down"
      
      // Match the createCurvedTextPath logic
      let svgPath
      if (direction === "up") {
        // Arc curves UPWARD (like a rainbow/smile)
        svgPath = `M 0 ${curveH} Q ${midX} 0 ${w} ${curveH}`
      } else {
        // Arc curves DOWNWARD (like a frown)
        svgPath = `M 0 0 Q ${midX} ${curveH} ${w} 0`
      }
      
      try {
        const newPath = new fabric.Path(svgPath, { visible: false, fill: '', stroke: '' })
        obj.set("path", newPath)
        obj.set("pathAlign", "center")
        obj.set("pathSide", "left")
        obj.set("clipPath", null)
      } catch (err) {
        console.error("Failed to restore curved text path:", err)
      }
      
      // Ensure proper height
      const fontSize = obj.get("fontSize") || 32
      const baseHeight = fontSize * 1.5
      const minHeight = baseHeight + curveH * 2
      if ((obj.get("height") || 0) < minHeight) {
        obj.set("height", minHeight)
      }
    })
  }, [])

  // Canvas size is derived from the selected template's dimensions (dimensionId → dimension metadata).
  // When template or dimension changes, canvasSpec updates and the canvas effect reinitializes with new width/height.
  const canvasSpec = useMemo(
    () => getCanvasSpec(activeTemplate, dimensions),
    [activeTemplate, dimensions]
  )

  const pixelcraftTemplates = useMemo(() => {
    return templates.filter((t) => Boolean(t.pixelcraftDocument))
  }, [templates])

  const filteredTemplates = useMemo(() => {
    let filtered = filterEntitiesByStatus(pixelcraftTemplates, statusFilter)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      filtered = filtered.filter(
        (t) =>
          (t.name && t.name.toLowerCase().includes(q)) ||
          (t.description && t.description.toLowerCase().includes(q)) ||
          (t.categoryName && t.categoryName.toLowerCase().includes(q))
      )
    }
    return filtered
  }, [pixelcraftTemplates, statusFilter, searchQuery])

  const totalPages = Math.ceil(filteredTemplates.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const currentTemplates = filteredTemplates.slice(startIndex, startIndex + itemsPerPage)

  useEffect(() => {
    if (viewMode === "card" && filteredTemplates.length > 0) {
      setDisplayedCards(filteredTemplates.slice(0, 16))
      setHasMoreCards(filteredTemplates.length > 16)
      setCurrentPage(1)
    }
  }, [filteredTemplates, viewMode])

  useEffect(() => {
    setCurrentPage(1)
    if (viewMode === "card") {
      setDisplayedCards(filteredTemplates.slice(0, 16))
      setHasMoreCards(filteredTemplates.length > 16)
    }
  }, [searchQuery, statusFilter])

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const handleLoadMoreCards = useCallback(() => {
    setDisplayedCards((prev) => {
      const next = filteredTemplates.slice(prev.length, prev.length + 16)
      return next.length > 0 ? [...prev, ...next] : prev
    })
  }, [filteredTemplates])

  useEffect(() => {
    if (viewMode === "card") {
      setHasMoreCards(displayedCards.length < filteredTemplates.length)
    }
  }, [viewMode, displayedCards.length, filteredTemplates.length])

  const handleViewModeChange = useCallback((newMode) => {
    setViewMode(newMode)
    setCurrentPage(1)
  }, [])

  const fetchCategories = async () => {
    try {
      const res = await api.get("/categories?showInactive=true&includeDeleted=true")
      setCategories(res.data || [])
    } catch (e) {
      setCategories([])
    }
  }

  const fetchDimensions = async () => {
    try {
      const res = await api.get("/template-dimensions?includeDeleted=false")
      setDimensions(res.data || [])
    } catch (e) {
      setDimensions([])
    }
  }

  const fetchFonts = async () => {
    try {
      const res = await api.get("/fonts/active")
      const all = res?.data?.all || []
      const normalized = all.map((f) => ({
        ...f,
        fileUrl: f.fileUrl ? normalizePreviewUrl(f.fileUrl) || f.fileUrl : null,
      }))
      setFonts(normalized)
    } catch (e) {
      setFonts([])
    }
  }

  const fetchTemplates = async (mergeTemplate = null) => {
    try {
      setLoading(true)
      setError("")
      const res = await api.get("/templates?includeDeleted=false")
      const raw = res.data || []
      let processed = raw.map((t) => {
        const categoryName = t.category?.name || t.categoryId?.name || "No category"
        return {
          ...t,
          previewImage: normalizePreviewUrl(t.previewImage) || t.previewImage,
          categoryName,
        }
      })
      // Merge saved template (with preview image from save response) so card updates immediately
      if (mergeTemplate && mergeTemplate._id) {
        const normalized = {
          ...mergeTemplate,
          previewImage: normalizePreviewUrl(mergeTemplate.previewImage) || mergeTemplate.previewImage,
          categoryName: mergeTemplate.category?.name || mergeTemplate.categoryId?.name || mergeTemplate.categoryName || "No category",
        }
        const idx = processed.findIndex((t) => t._id === mergeTemplate._id)
        if (idx >= 0) {
          processed = processed.slice()
          processed[idx] = { ...processed[idx], ...normalized }
        } else {
          processed = [normalized, ...processed]
        }
      }
      setTemplates(processed)
    } catch (e) {
      setError(e.response?.data?.msg || "Failed to load templates")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCategories()
    fetchDimensions()
    fetchFonts()
    fetchTemplates()
  }, [])

  // Load active fonts for PixelCraft (Google link + @font-face for uploads)
  useEffect(() => {
    // Google fonts: load a single combined stylesheet
    const googleFonts = fonts.filter((f) => f.type === "google" && f.isActive && !f.deleted)
    const existingLink = document.querySelector('link[data-pixelcraft-google-fonts="true"]')
    if (googleFonts.length > 0) {
      const fontFamilies = googleFonts.map((f) => (f.family || f.name || "").trim()).filter(Boolean).map((fam) => fam.replace(/ /g, "+")).join("&family=")
      const googleFontsUrl = `https://fonts.googleapis.com/css2?family=${fontFamilies}&display=swap`
      if (existingLink) {
        if (existingLink.href !== googleFontsUrl) existingLink.href = googleFontsUrl
      } else {
        const link = document.createElement("link")
        link.href = googleFontsUrl
        link.rel = "stylesheet"
        link.setAttribute("data-pixelcraft-google-fonts", "true")
        document.head.appendChild(link)
      }
    } else if (existingLink) {
      existingLink.remove()
    }

    // Uploaded fonts: inject @font-face rules
    const uploadFonts = fonts.filter((f) => f.type === "upload" && f.isActive && !f.deleted && f.fileUrl)
    const existingStyle = document.querySelector('style[data-pixelcraft-upload-fonts="true"]')
    if (uploadFonts.length === 0) {
      if (existingStyle) existingStyle.remove()
      return
    }

    const guessFormat = (fileUrl) => {
      const lower = String(fileUrl || "").toLowerCase()
      if (lower.endsWith(".woff2")) return "woff2"
      if (lower.endsWith(".woff")) return "woff"
      if (lower.endsWith(".ttf")) return "truetype"
      if (lower.endsWith(".otf")) return "opentype"
      return "woff2"
    }

    const css = uploadFonts
      .map((f) => {
        const fileUrl = normalizePreviewUrl(f.fileUrl) || f.fileUrl
        const fam = (f.family || f.name || "").replace(/"/g, '\\"')
        if (!fileUrl || !fam) return ""
        return `@font-face{font-family:"${fam}";src:url("${fileUrl}") format("${guessFormat(fileUrl)}");font-display:swap;}`
      })
      .filter(Boolean)
      .join("\n")

    if (existingStyle) {
      existingStyle.textContent = css
    } else {
      const style = document.createElement("style")
      style.setAttribute("data-pixelcraft-upload-fonts", "true")
      style.textContent = css
      document.head.appendChild(style)
    }
  }, [fonts])

  const fontOptions = useMemo(() => {
    const families = (fonts || [])
      .filter((f) => f && f.isActive && !f.deleted)
      .map((f) => (f.family || f.name || "").trim())
      .filter(Boolean)
    // Ensure common defaults are present
    const base = ["Arial", "Helvetica", "Times New Roman", "Georgia", "Courier New", "Verdana"]
    const unique = Array.from(new Set([...base, ...families]))
    return unique.sort((a, b) => a.localeCompare(b))
  }, [fonts])

  // Canvas dimensions come from the selected template's dimension (getCanvasSpec).
  // When the template, dimension, or dimensions list changes, this effect re-runs and
  // reinitializes the canvas with the new width/height from template metadata.
  // For new template: if user selected a dimension, wait for dimensions to load before
  // creating canvas so we use the correct size (not fallback).
  useEffect(() => {
    if (!isEditing) return
    if (!fullscreenEditorOpen) return
    const container = canvasContainerRef.current
    if (!container) {
      console.warn("⏳ PixelCraft: canvas container not mounted yet, waiting...")
      return
    }

    const dimensionId = activeTemplate?.dimensionId || activeTemplate?.pixelcraftDocument?.dimensionId
    const hasDimensionSelected = !!dimensionId
    const dimensionsLoaded = dimensions && dimensions.length > 0
    // If a dimension is selected but dimensions haven't loaded yet, wait —
    // UNLESS the template already has saved canvas dimensions in pixelcraftDocument
    // (fallback so legacy templates still load even if dimensions list is empty).
    const hasSavedCanvasSize = activeTemplate?.pixelcraftDocument?.canvas?.width > 0
    if (hasDimensionSelected && !dimensionsLoaded && !hasSavedCanvasSize) {
      console.warn("⏳ PixelCraft: waiting for dimensions to load...", { dimensionId, dimensionsLoaded, hasSavedCanvasSize })
      return
    }

    console.log("✅ PixelCraft: initializing canvas", {
      templateId: activeTemplate?._id,
      hasFabricJson: !!activeTemplate?.pixelcraftDocument?.fabricJson,
      canvasSpec,
    })

    // Width and height from template dimensions (getCanvasSpec returns dimension spec or fallback)
    const width = canvasSpec?.width ?? FALLBACK_CANVAS_SPEC.width
    const height = canvasSpec?.height ?? FALLBACK_CANVAS_SPEC.height

    // Dispose previous and clear container
    if (fabricRef.current) {
      fabricRef.current.dispose()
      fabricRef.current = null
    }
    while (container.firstChild) {
      container.removeChild(container.firstChild)
    }

    const canvasEl = document.createElement("canvas")
    container.appendChild(canvasEl)
    const c = new fabric.Canvas(canvasEl, {
      width,
      height,
      backgroundColor: "#ffffff",
      preserveObjectStacking: true,
      selection: true,
    })
    fabricRef.current = c

    // Patch pointer coordinates for CSS transform scaling.
    // Fabric.js doesn't know about the CSS scale() on the parent wrapper,
    // so mouse events need coordinate adjustment.
    // IMPORTANT: Must return a fabric.Point (not plain {x,y}) to preserve .transform() etc.
    c._zoomScaleRef = zoomScaleRef
    const pointerMethod = typeof c.getScenePoint === 'function' ? 'getScenePoint'
      : typeof c.getPointer === 'function' ? 'getPointer'
      : null
    if (pointerMethod) {
      const origFn = c[pointerMethod].bind(c)
      c[pointerMethod] = function (...args) {
        const pointer = origFn(...args)
        const cssScale = this._zoomScaleRef?.current || 1
        if (cssScale !== 1) {
          // Return a proper fabric.Point so internal methods like .transform() still work
          return new fabric.Point(pointer.x / cssScale, pointer.y / cssScale)
        }
        return pointer
      }
    }
    
    undoHistoryRef.current = []
    undoIndexRef.current = -1
    setUndoHistory([])
    setUndoIndex(-1)

    const bumpSelection = () => setSelectionVersion((v) => v + 1)
    c.on("selection:created", bumpSelection)
    c.on("selection:updated", bumpSelection)
    c.on("selection:cleared", bumpSelection)
    c.on("object:modified", bumpSelection)

    // When user clicks the image inside a shape group, set active object to the image so they get resize/rotate controls
    const preferSubTargetImage = (opt) => {
      const sel = opt?.selected?.[0]
      const e = opt?.e
      if (!e) return
      try {
        const info = c.findTarget(e)
        const target = info?.target
        const sub = info?.subTargets?.[0]
        const imageObj = target && (target.type === "image" || target.get?.("layerType") === "image") ? target : sub && (sub.type === "image" || sub.get?.("layerType") === "image") ? sub : null
        if (imageObj) {
          const group = imageObj.group ?? imageObj.parent
          if (group && group.get?.("layerType") === "shape" && (group.getObjects?.()?.length ?? 0) >= 2) {
            requestAnimationFrame(() => {
              if (c.getActiveObject() !== imageObj) {
                c.setActiveObject(imageObj, e)
                c.requestRenderAll()
                setSelectionVersion((v) => v + 1)
              }
            })
          }
        } else if (sel && sel.type === "group" && sel.get?.("layerType") === "shape" && (sel.getObjects?.()?.length ?? 0) >= 2) {
          requestAnimationFrame(() => {
            const info2 = c.findTarget(e)
            const sub2 = info2?.subTargets?.[0]
            if (sub2 && (sub2.type === "image" || sub2.get?.("layerType") === "image")) {
              c.setActiveObject(sub2, e)
              c.requestRenderAll()
              setSelectionVersion((v) => v + 1)
            }
          })
        }
      } catch (err) {
        // ignore
      }
    }
    c.on("selection:created", preferSubTargetImage)
    c.on("selection:updated", preferSubTargetImage)

    // Undo/redo: record canvas state on object:modified, object:added, object:removed (max 10 steps)
    const pushHistory = () => {
      if (skipUndoRecordRef.current) return
      try {
        const state = c.toObject(CANVAS_PROPERTIES_TO_INCLUDE)
        const hist = undoHistoryRef.current
        const idx = undoIndexRef.current
        const next = [...hist.slice(0, idx + 1), state]
        if (next.length > UNDO_MAX + 1) next.shift()
        undoHistoryRef.current = next
        undoIndexRef.current = next.length - 1
        setUndoHistory([...next])
        setUndoIndex(next.length - 1)
      } catch (e) {
        // ignore serialization errors
      }
    }
    c.on("object:modified", pushHistory)
    c.on("object:added", pushHistory)
    c.on("object:removed", pushHistory)

    // Keep objects inside canvas bounds (template dimension)
    const constrainObjectToCanvas = (e) => {
      const obj = e?.target
      if (!obj || !c) return
      const w = c.getWidth()
      const h = c.getHeight()
      const br = obj.getBoundingRect()
      const minX = br.left
      const maxX = br.left + br.width
      const minY = br.top
      const maxY = br.top + br.height
      let dx = 0
      let dy = 0
      if (minX < 0) dx = -minX
      else if (maxX > w) dx = w - maxX
      if (minY < 0) dy = -minY
      else if (maxY > h) dy = h - maxY
      if (dx !== 0 || dy !== 0) {
        obj.set({ left: obj.left + dx, top: obj.top + dy })
        obj.setCoords?.()
      }
    }
    c.on("object:moving", constrainObjectToCanvas)
    c.on("object:scaling", constrainObjectToCanvas)
    c.on("object:resizing", constrainObjectToCanvas)

    // Load existing template JSON.
    // Originally this only ran when the canvas size matched the saved document exactly to avoid stretching.
    // In practice, dimensions or DPI can change slightly, which prevented older templates from loading at all.
    // Now we always load when a pixelcraftDocument exists so the user can see/edit the design;
    // minor size differences can be adjusted manually if needed.
    const doc = activeTemplate?.pixelcraftDocument
    if (doc?.fabricJson) {
      const fabricJson = stripBlobUrlsFromFabricJson(
        typeof doc.fabricJson === "string" ? JSON.parse(doc.fabricJson) : doc.fabricJson
      )
      c.loadFromJSON(fabricJson)
        .then(() => {
          restoreCurvedTextPaths(c)
          c.requestRenderAll()
          pushHistory()
          const bg = c.backgroundColor
          setCanvasBackgroundColor(typeof bg === "string" ? bg : "#ffffff")
          setLayersDialogOpen(true)
          setLayersTab("layers")
        })
        .catch((err) => console.error("Canvas load error:", err))
    } else {
      // Legacy / non-PixelCraft templates: no fabricJson saved yet.
      // Use existing preview/background image as a non-editable background so user
      // can see the old artwork while redesigning in PixelCraft.
      const bgUrl =
        activeTemplate?.previewImage ||
        (Array.isArray(activeTemplate?.backgroundImages) && activeTemplate.backgroundImages[0]) ||
        (Array.isArray(activeTemplate?.logoImages) && activeTemplate.logoImages[0])

      if (bgUrl) {
        const normalizedBg = normalizePreviewUrl(bgUrl) || bgUrl
        fabric.Image.fromURL(normalizedBg, { crossOrigin: "anonymous" })
          .then((img) => {
            try {
              const canvasW = c.getWidth()
              const canvasH = c.getHeight()
              const scaleX = canvasW / img.width
              const scaleY = canvasH / img.height
              const scale = Math.max(scaleX, scaleY) || 1

              img.set({
                left: 0,
                top: 0,
                originX: "left",
                originY: "top",
                selectable: false,
                evented: false,
                hasBorders: false,
                hasControls: false,
              })
              img.scale(scale)

              c.backgroundImage = img
              c.requestRenderAll()
              setCanvasBackgroundColor("transparent")
              pushHistory()
              setLayersDialogOpen(true)
              setLayersTab("layers")
            } catch (e) {
              console.error("Failed to set legacy background image in PixelCraft:", e)
              pushHistory()
            }
          })
          .catch((err) => {
            console.error("Failed to load legacy background image:", err)
            pushHistory()
          })
      } else {
        // No legacy image either – just start with a blank canvas
        pushHistory()
      }
    }

    return () => {
      c.off("selection:created", bumpSelection)
      c.off("selection:updated", bumpSelection)
      c.off("selection:cleared", bumpSelection)
      c.off("selection:created", preferSubTargetImage)
      c.off("selection:updated", preferSubTargetImage)
      c.off("object:modified", bumpSelection)
      c.off("object:modified", pushHistory)
      c.off("object:added", pushHistory)
      c.off("object:removed", pushHistory)
      c.off("object:moving", constrainObjectToCanvas)
      c.off("object:scaling", constrainObjectToCanvas)
      c.off("object:resizing", constrainObjectToCanvas)
      c.dispose()
      fabricRef.current = null
      // Clear container so React never tries to remove nodes Fabric may have moved
      if (canvasContainerRef.current) {
        while (canvasContainerRef.current.firstChild) {
          canvasContainerRef.current.removeChild(canvasContainerRef.current.firstChild)
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing, fullscreenEditorOpen, canvasContainerMounted, activeTemplate?._id, activeTemplate?.dimensionId, canvasSpec?.width, canvasSpec?.height, dimensions?.length])

  const openNew = () => {
    setError("")
    setSuccess("")
    setActiveTemplate({
      _id: null,
      name: (newTemplateName || "").trim() || "Untitled PixelCraft Template",
      description: "",
      categoryId: newTemplateCategoryId || "",
      dimensionId: newTemplateDimensionId || "",
      isActive: false,
      pixelcraftStatus: "draft",
      pixelcraftVersion: 1,
      pixelcraftDocument: null,
    })
    setMode("edit")
    setFullscreenEditorOpen(true) // Open fullscreen editor
    setLayersDialogOpen(false)
    setLayersTab("layers")
    // Zoom will be auto-calculated by useEffect based on template dimensions
  }

  const openEdit = async (id) => {
    try {
      setLoading(true)
      setError("")
      setSuccess("")
      const res = await api.get(`/templates/${id}`)
      const t = res.data
      const categoryId =
        t.categoryId?._id != null
          ? String(t.categoryId._id)
          : t.category?._id != null
            ? String(t.category._id)
            : t.categoryId != null
              ? String(t.categoryId)
              : ""
      const dimensionId = t.pixelcraftDocument?.dimensionId
        ? String(t.pixelcraftDocument.dimensionId)
        : ""
      setActiveTemplate({ ...t, categoryId, dimensionId })
      setMode("edit")
      setFullscreenEditorOpen(true) // Open fullscreen editor
      // Zoom will be auto-calculated by useEffect based on template dimensions
    } catch (e) {
      setError(e.response?.data?.msg || "Failed to load template")
    } finally {
      setLoading(false)
    }
  }

  /** Close fullscreen editor and return to list */
  const closeFullscreenEditor = () => {
    setFullscreenEditorOpen(false)
    setActiveTemplate(null)
    setMode("list")
    setEditToolOpen(false)
    setLayersDialogOpen(false)
    // Zoom will reset when next template opens
  }

  const addText = () => {
    const c = fabricRef.current
    if (!c) return
    const id = makeId("text")
    
    // Get canvas center position
    const canvasW = canvasSpec?.width || 600
    const canvasH = canvasSpec?.height || 400
    const textWidth = 400
    const textHeight = 50 // Approximate height for single line
    
    const t = new fabric.Textbox("Your text", {
      left: (canvasW - textWidth) / 2,
      top: (canvasH - textHeight) / 2,
      width: textWidth,
      fontSize: 32,
      fill: "#111827",
      originX: "left",
      originY: "top",
    })
    t.set({ layerId: id, editable: true, variableId: "", layerType: "text" })
    c.add(t)
    c.setActiveObject(t)
    c.requestRenderAll()
  }

  /** Adds a shape (rectangle) that can act as a fixed mask/container for an image. */
  const addRect = () => {
    const c = fabricRef.current
    if (!c) return
    const shapeId = makeId("shape")
    
    // Get canvas center position
    const canvasW = canvasSpec?.width || 600
    const canvasH = canvasSpec?.height || 400
    const shapeWidth = 300
    const shapeHeight = 200
    
    const rect = new fabric.Rect({
      left: 0,
      top: 0,
      width: shapeWidth,
      height: shapeHeight,
      fill: "#f3f4f6",
      stroke: "#9ca3af",
      strokeWidth: 2,
    })
    rect.set({ layerId: shapeId, variableId: "", layerType: "shape" })
    const group = new fabric.Group([rect], {
      left: (canvasW - shapeWidth) / 2,
      top: (canvasH - shapeHeight) / 2,
      subTargetCheck: true,
    })
    group.set({ layerId: shapeId, editable: true, variableId: "", layerType: "shape" })
    c.add(group)
    c.setActiveObject(group)
    c.requestRenderAll()
  }

  const getSelectedShapeGroup = () => {
    const obj = fabricRef.current?.getActiveObject()
    if (!obj) return null
    if (obj.type === "group" && obj.get?.("layerType") === "shape") return obj
    return null
  }

  /** Returns the currently selected image (standalone or image inside a shape). */
  const getSelectedImage = () => {
    const obj = fabricRef.current?.getActiveObject()
    if (!obj) return null
    if (obj.type === "image" || obj.get?.("layerType") === "image") return obj
    return null
  }

  const addImageFromFile = (file) => {
    const c = fabricRef.current
    if (!c) return
    if (!file) {
      setError("Please select an image file.")
      return
    }
    if (!file.type || !file.type.startsWith("image/")) {
      setError("Please select an image file (e.g. JPEG, PNG, GIF).")
      return
    }
    const url = URL.createObjectURL(file)
    const group = getSelectedShapeGroup()

    if (group) {
      insertImageIntoShape(c, group, url)
    } else {
      addStandaloneImage(c, url)
    }
  }

  /** Mask image into the selected shape (Photoshop-style clipping mask). Call when a shape is selected. */
  const handleMaskImageIntoShape = (file) => {
    const c = fabricRef.current
    if (!c) return
    const group = getSelectedShapeGroup()
    if (!group) {
      setError("Select a shape first, then use Mask image into shape.")
      return
    }
    if (!file) {
      setError("Please select an image file.")
      return
    }
    if (!file.type || !file.type.startsWith("image/")) {
      setError("Please select an image file (e.g. JPEG, PNG, GIF).")
      return
    }
    insertImageIntoShape(c, group, URL.createObjectURL(file))
  }

  /**
   * Inserts an image into the selected shape so the shape acts as a fixed mask/container.
   * - Shape position and size are preserved (group scaled and repositioned after add).
   * - Shape outline (stroke/fill) is fully visible; only the image is clipped to the inner area.
   * - The image can be selected, dragged, resized, and rotated inside the shape (subTargetCheck).
   */
  const insertImageIntoShape = (c, group, url) => {
    const objects = group.getObjects()
    const rect = objects[0]
    if (!rect) {
      URL.revokeObjectURL(url)
      setError("Invalid shape: no content. Add a shape first, then insert image.")
      return
    }
    const boxWidth = (rect.get("width") ?? 300) * (rect.get("scaleX") ?? 1)
    const boxHeight = (rect.get("height") ?? 200) * (rect.get("scaleY") ?? 1)

    fabric.Image.fromURL(url)
      .then((img) => {
        try {
          const natW = img.get("width") || img.width || 1
          const natH = img.get("height") || img.height || 1
          const scaleX = boxWidth / natW
          const scaleY = boxHeight / natH
          // Scale image to fit inside shape (allow scale up so small images are visible)
          const scale = Math.min(scaleX, scaleY)
          img.set({
            left: 0,
            top: 0,
            scaleX: scale,
            scaleY: scale,
            originX: "left",
            originY: "top",
            visible: true,
          })
          img.set({
            layerId: makeId("img"),
            editable: true,
            variableId: "",
            layerType: "image",
            lockMovementX: false,
            lockMovementY: false,
            selectable: true,
            evented: true,
            hasBorders: true,
            hasControls: true,
          })

          if (objects.length >= 2) {
            group.remove(objects[1])
          }

          // Prevent Fabric 7 layout from recalculating group position/size when we add the image (and when image is transformed)
          group.layoutManager = new NoopLayoutManager()
          group.add(img)

          // Keep rect (shape) styles intact; lock so only image is transformed
          rect.set({
            selectable: false,
            evented: false,
            lockMovementX: true,
            lockMovementY: true,
            lockScalingX: true,
            lockScalingY: true,
            lockRotation: true,
          })

          // No clip: image is inserted inside shape only; shape stroke/outline stays visible
          img.set({ clipPath: undefined })

          // No group clipPath; allow selecting nested image
          group.set({
            clipPath: undefined,
            subTargetCheck: true,
            interactive: true,
            lockScalingX: true,
            lockScalingY: true,
          })

          // Force group to re-render with the new image (invalidate cache so image shows)
          if (typeof group.set === "function") group.set("dirty", true)
          if (typeof group.setCoords === "function") group.setCoords()
          c.setActiveObject(group)
          c.requestRenderAll()
          setSelectionVersion((v) => v + 1)
        } catch (err) {
          setError(err?.message || "Failed to insert image into shape.")
        } finally {
          URL.revokeObjectURL(url)
        }
      })
      .catch((err) => {
        URL.revokeObjectURL(url)
        setError(err?.message || "Failed to load image. Try another file.")
      })
  }

  const addStandaloneImage = (c, url) => {
    // Get canvas center position
    const canvasW = canvasSpec?.width || 600
    const canvasH = canvasSpec?.height || 400
    const maxW = 400
    const maxH = 300

    fabric.Image.fromURL(url)
      .then((img) => {
        try {
          const natW = img.get("width") || img.width || 1
          const natH = img.get("height") || img.height || 1
          const scaleX = maxW / natW
          const scaleY = maxH / natH
          const scale = Math.min(scaleX, scaleY, 1)
          
          // Calculate scaled dimensions for centering
          const scaledW = natW * scale
          const scaledH = natH * scale
          
          img.set({
            left: (canvasW - scaledW) / 2,
            top: (canvasH - scaledH) / 2,
            scaleX: scale,
            scaleY: scale,
            originX: "left",
            originY: "top",
          })
          img.set({
            layerId: makeId("img"),
            editable: true,
            variableId: "",
            layerType: "image",
          })
          c.add(img)
          c.setActiveObject(img)
          c.requestRenderAll()
          setSelectionVersion((v) => v + 1)
        } catch (err) {
          setError(err?.message || "Failed to add image.")
        } finally {
          URL.revokeObjectURL(url)
        }
      })
      .catch((err) => {
        URL.revokeObjectURL(url)
        setError(err?.message || "Failed to load image. Try another file.")
      })
  }

  const applyShapeTransform = (props) => {
    const group = getSelectedShapeGroup()
    if (!group || !fabricRef.current) return
    // Do not resize shape when it contains an image (fixed mask)
    if ((group.getObjects?.()?.length ?? 0) >= 2) return
    if (props.width != null || props.height != null) {
      const curW = (group.get("width") || 300) * (group.get("scaleX") ?? 1)
      const curH = (group.get("height") || 200) * (group.get("scaleY") ?? 1)
      const newW = props.width != null ? Number(props.width) : curW
      const newH = props.height != null ? Number(props.height) : curH
      const scaleX = curW > 0 ? newW / curW : 1
      const scaleY = curH > 0 ? newH / curH : 1
      const sX = (group.get("scaleX") ?? 1) * scaleX
      const sY = (group.get("scaleY") ?? 1) * scaleY
      group.set({ scaleX: sX, scaleY: sY })
    } else {
      group.set(props)
    }
    fabricRef.current.requestRenderAll()
    setSelectionVersion((v) => v + 1)
  }

  const flipShapeH = () => {
    const group = getSelectedShapeGroup()
    if (!group || !fabricRef.current) return
    if ((group.getObjects?.()?.length ?? 0) >= 2) return
    const s = group.get("scaleX") ?? 1
    group.set("scaleX", -s)
    fabricRef.current.requestRenderAll()
    setSelectionVersion((v) => v + 1)
  }

  const flipShapeV = () => {
    const group = getSelectedShapeGroup()
    if (!group || !fabricRef.current) return
    if ((group.getObjects?.()?.length ?? 0) >= 2) return
    const s = group.get("scaleY") ?? 1
    group.set("scaleY", -s)
    fabricRef.current.requestRenderAll()
    setSelectionVersion((v) => v + 1)
  }

  const applyShapeStyle = (props) => {
    const group = getSelectedShapeGroup()
    if (!group || !fabricRef.current) return
    const objects = group.getObjects()
    const rect = objects[0]
    if (!rect) return
    // Support corner radius (Fabric Rect rx/ry) and shadow
    rect.set(props)
    fabricRef.current.requestRenderAll()
    setSelectionVersion((v) => v + 1)
  }

  /** Apply style/transform to the selected image (standalone or inside shape). */
  const applyImageStyle = (props) => {
    const img = getSelectedImage()
    const c = fabricRef.current
    if (!c || !img) return
    // Border radius: apply via clipPath (rounded rect) if Fabric supports it; otherwise store for export
    const { borderRadius, aspectLock, ...rest } = props
    img.set(rest)
    if (borderRadius != null) img.set("borderRadius", borderRadius)
    if (aspectLock != null) {
      img.set("lockUniScaling", aspectLock)
    }
    c.requestRenderAll()
    setSelectionVersion((v) => v + 1)
  }

  /** Replace the selected image's source with a new file (standalone or inside shape). */
  const replaceSelectedImage = (file) => {
    const img = getSelectedImage()
    const c = fabricRef.current
    if (!c || !img || !file?.type?.startsWith("image/")) return
    const url = URL.createObjectURL(file)
    const done = () => {
      c.requestRenderAll()
      setSelectionVersion((v) => v + 1)
      URL.revokeObjectURL(url)
    }
    if (typeof img.setSrc === "function") {
      const p = img.setSrc(url)
      if (p && typeof p.then === "function") {
        p.then(done).catch(() => {
          URL.revokeObjectURL(url)
          setError("Failed to load replacement image.")
        })
      } else {
        done()
      }
    } else {
      done()
    }
  }

  /** Apply an effect to the selected image by replacing its source with the new data URL. */
  const applyImageEffect = (newDataUrl) => {
    const img = getSelectedImage()
    const c = fabricRef.current
    if (!c || !img || !newDataUrl) return
    const done = () => {
      c.requestRenderAll()
      setSelectionVersion((v) => v + 1)
      setSuccess("✨ Effect applied to image")
    }
    if (typeof img.setSrc === "function") {
      const p = img.setSrc(newDataUrl)
      if (p && typeof p.then === "function") {
        p.then(done).catch(() => {
          setError("Failed to apply effect to image.")
        })
      } else {
        done()
      }
    } else {
      done()
    }
  }

  const canvasLayers = useMemo(() => {
    const objs = fabricRef.current?.getObjects() ?? []
    return [...objs].reverse()
  }, [selectionVersion])

  const selectLayer = (obj) => {
    const c = fabricRef.current
    if (!c) return
    c.setActiveObject(obj)
    c.requestRenderAll()
    setSelectionVersion((v) => v + 1)
  }

  const deleteLayer = (obj) => {
    const c = fabricRef.current
    if (!c) return
    c.remove(obj)
    c.requestRenderAll()
    setSelectionVersion((v) => v + 1)
  }

  const moveLayerUp = (obj) => {
    const c = fabricRef.current
    if (!c) return
    c.bringObjectForward(obj)
    c.requestRenderAll()
    setSelectionVersion((v) => v + 1)
  }

  const moveLayerDown = (obj) => {
    const c = fabricRef.current
    if (!c) return
    c.sendObjectBackwards(obj)
    c.requestRenderAll()
    setSelectionVersion((v) => v + 1)
  }

  const toggleLayerVisibility = (obj, e) => {
    if (e) e.stopPropagation()
    const c = fabricRef.current
    if (!c || !obj) return
    const visible = obj.get("visible") !== false
    obj.set("visible", !visible)
    c.requestRenderAll()
    setSelectionVersion((v) => v + 1)
  }

  const toggleLayerLock = (obj, e) => {
    if (e) e.stopPropagation()
    const c = fabricRef.current
    if (!c || !obj) return
    // Use Fabric's lock properties for state (editable is custom and may not persist)
    const isLocked = obj.get("lockMovementX") && obj.get("lockMovementY")
    const unlock = isLocked
    obj.set("editable", unlock)
    obj.set({
      lockMovementX: !unlock,
      lockMovementY: !unlock,
      lockScalingX: !unlock,
      lockScalingY: !unlock,
      lockRotation: !unlock,
      selectable: unlock,
      evented: unlock,
    })
    if (typeof obj.setCoords === "function") obj.setCoords()
    c.discardActiveObject?.()
    c.requestRenderAll()
    setSelectionVersion((v) => v + 1)
  }

  const getLayerLabel = (obj) => {
    const layerType = obj.get?.("layerType") || obj.type || "object"
    const layerId = obj.get?.("layerId") || ""
    if (layerType === "text" || obj.type === "textbox") return layerId || "Text"
    if (layerType === "image") return layerId || "Image"
    if (obj.type === "group" || layerType === "shape") {
      const hasImage = (obj.getObjects?.()?.length ?? 0) >= 2
      return layerId || (hasImage ? "Shape (image)" : "Shape")
    }
    if (obj.type === "rect" || obj.type === "Rect") return layerId || "Shape"
    return layerId || layerType || "Layer"
  }

  const getLayerIcon = (obj) => {
    const layerType = obj.get?.("layerType") || obj.type || ""
    if (layerType === "text" || obj.type === "textbox") return "T"
    if (obj.type === "group") {
      const hasImage = (obj.getObjects?.()?.length ?? 0) >= 2
      return hasImage ? "🖼" : "▭"
    }
    if (layerType === "image" || obj.type === "image") return "🖼"
    if (obj.type === "rect" || obj.type === "Rect") return "▭"
    return "•"
  }

  const toggleLayersDialog = () => {
    if (layersDialogOpen) {
      setLayersDialogOpen(false)
      return
    }
    const bg = fabricRef.current?.backgroundColor
    setCanvasBackgroundColor(typeof bg === "string" ? bg : "#ffffff")
    setLayersTab("layers")
    setLayersDialogOpen(true)
  }

  const applyBackgroundColor = (color) => {
    const c = fabricRef.current
    if (!c) return
    setCanvasBackgroundColor(color)
    setBackgroundType("color")
    setBackgroundImage(null)
    c.set("backgroundColor", color)
    c.backgroundImage = null
    c.requestRenderAll()
  }

  // Preset background colors
  const presetColors = [
    "#ffffff", "#f8f9fa", "#e9ecef", "#dee2e6", "#ced4da", "#adb5bd", "#6c757d", "#495057", "#343a40", "#212529", "#000000",
    "#ff6b6b", "#ee5a5a", "#fa5252", "#e03131", "#c92a2a",
    "#ffa94d", "#ff922b", "#fd7e14", "#e8590c", "#d9480f",
    "#ffd43b", "#fcc419", "#fab005", "#f59f00", "#e67700",
    "#69db7c", "#51cf66", "#40c057", "#37b24d", "#2f9e44",
    "#4dabf7", "#339af0", "#228be6", "#1c7ed6", "#1971c2",
    "#748ffc", "#5c7cfa", "#4c6ef5", "#4263eb", "#3b5bdb",
    "#da77f2", "#cc5de8", "#be4bdb", "#ae3ec9", "#9c36b5",
    "#f783ac", "#f06595", "#e64980", "#d6336c", "#c2255c",
  ]

  // Apply background image
  const applyBackgroundImage = (file, fit = "cover") => {
    const c = fabricRef.current
    if (!c || !file) return
    
    const url = URL.createObjectURL(file)
    
    // Load image using HTML Image element for compatibility
    const imgEl = new Image()
    imgEl.crossOrigin = "anonymous"
    imgEl.onload = () => {
      const canvasW = canvasSpec?.width || 600
      const canvasH = canvasSpec?.height || 400
      const imgW = imgEl.width
      const imgH = imgEl.height
      
      // Create Fabric image from HTML element
      const img = new fabric.Image(imgEl)
      
      if (fit === "cover") {
        // Scale to cover entire canvas
        const scaleX = canvasW / imgW
        const scaleY = canvasH / imgH
        const scale = Math.max(scaleX, scaleY)
        img.set({
          scaleX: scale,
          scaleY: scale,
          originX: "center",
          originY: "center",
          left: canvasW / 2,
          top: canvasH / 2,
        })
      } else if (fit === "contain") {
        // Scale to fit within canvas
        const scaleX = canvasW / imgW
        const scaleY = canvasH / imgH
        const scale = Math.min(scaleX, scaleY)
        img.set({
          scaleX: scale,
          scaleY: scale,
          originX: "center",
          originY: "center",
          left: canvasW / 2,
          top: canvasH / 2,
        })
      } else if (fit === "tile") {
        // Create pattern for tiling
        const patternSourceCanvas = document.createElement("canvas")
        patternSourceCanvas.width = imgW
        patternSourceCanvas.height = imgH
        const ctx = patternSourceCanvas.getContext("2d")
        ctx.drawImage(imgEl, 0, 0)
        
        const pattern = new fabric.Pattern({
          source: patternSourceCanvas,
          repeat: "repeat",
        })
        c.set("backgroundColor", pattern)
        c.backgroundImage = null
        setBackgroundType("image")
        setBackgroundImage({ url, fit })
        setCanvasBackgroundColor("")
        c.requestRenderAll()
        return
      } else if (fit === "stretch") {
        // Stretch to fill canvas exactly
        img.set({
          scaleX: canvasW / imgW,
          scaleY: canvasH / imgH,
          left: 0,
          top: 0,
          originX: "left",
          originY: "top",
        })
      }
      
      // Set background image (Fabric.js 7 compatible)
      c.set("backgroundColor", "")
      c.backgroundImage = img
      setBackgroundType("image")
      setBackgroundImage({ url, fit })
      setCanvasBackgroundColor("")
      c.requestRenderAll()
    }
    imgEl.onerror = () => {
      console.error("Failed to load background image")
      setError("Failed to load background image")
    }
    imgEl.src = url
  }

  // Change background image fit mode
  const changeBackgroundFit = (fit) => {
    if (!backgroundImage?.url) return
    // Re-apply with new fit mode by fetching from URL
    fetch(backgroundImage.url)
      .then((res) => res.blob())
      .then((blob) => {
        const file = new File([blob], "background.jpg", { type: blob.type })
        applyBackgroundImage(file, fit)
      })
      .catch(() => {})
  }

  // Apply gradient background
  const applyBackgroundGradient = (gradientConfig) => {
    const c = fabricRef.current
    if (!c) return
    
    const { type, angle, color1, color2 } = gradientConfig
    const canvasW = c.getWidth()
    const canvasH = c.getHeight()
    
    let gradient
    if (type === "linear") {
      // Calculate gradient coordinates based on angle
      const angleRad = (angle * Math.PI) / 180
      const x1 = canvasW / 2 - Math.cos(angleRad) * canvasW / 2
      const y1 = canvasH / 2 - Math.sin(angleRad) * canvasH / 2
      const x2 = canvasW / 2 + Math.cos(angleRad) * canvasW / 2
      const y2 = canvasH / 2 + Math.sin(angleRad) * canvasH / 2
      
      gradient = new fabric.Gradient({
        type: "linear",
        coords: { x1, y1, x2, y2 },
        colorStops: [
          { offset: 0, color: color1 },
          { offset: 1, color: color2 },
        ],
      })
    } else {
      // Radial gradient
      gradient = new fabric.Gradient({
        type: "radial",
        coords: { x1: canvasW / 2, y1: canvasH / 2, r1: 0, x2: canvasW / 2, y2: canvasH / 2, r2: Math.max(canvasW, canvasH) / 2 },
        colorStops: [
          { offset: 0, color: color1 },
          { offset: 1, color: color2 },
        ],
      })
    }
    
    c.set("backgroundColor", gradient)
    c.backgroundImage = null
    setBackgroundType("gradient")
    setBackgroundGradient(gradientConfig)
    setBackgroundImage(null)
    c.requestRenderAll()
  }

  // Remove background (set to transparent/white)
  const removeBackground = () => {
    const c = fabricRef.current
    if (!c) return
    c.set("backgroundColor", "#ffffff")
    c.backgroundImage = null
    setBackgroundType("color")
    setBackgroundImage(null)
    setCanvasBackgroundColor("#ffffff")
    c.requestRenderAll()
  }

  // Keyboard arrow controls for moving selected objects
  const MOVE_STEP = 1 // pixels per key press
  const MOVE_STEP_SHIFT = 10 // pixels when shift is held
  
  const moveSelectedObject = (direction, shiftKey = false) => {
    const c = fabricRef.current
    const obj = c?.getActiveObject()
    if (!c || !obj) return
    
    // Check if object is locked
    if (obj.get("lockMovementX") && obj.get("lockMovementY")) return
    
    const step = shiftKey ? MOVE_STEP_SHIFT : MOVE_STEP
    let left = obj.get("left") || 0
    let top = obj.get("top") || 0
    
    switch (direction) {
      case "up":
        if (!obj.get("lockMovementY")) top -= step
        break
      case "down":
        if (!obj.get("lockMovementY")) top += step
        break
      case "left":
        if (!obj.get("lockMovementX")) left -= step
        break
      case "right":
        if (!obj.get("lockMovementX")) left += step
        break
      default:
        return
    }
    
    obj.set({ left, top })
    obj.setCoords?.()
    c.requestRenderAll()
    setSelectionVersion((v) => v + 1)
  }
  
  // Keyboard event handler for arrow keys
  useEffect(() => {
    if (!fullscreenEditorOpen) return
    
    const handleKeyDown = (e) => {
      const c = fabricRef.current
      if (!c) return
      
      // Don't handle if user is typing in an input field
      const tagName = e.target.tagName.toLowerCase()
      if (tagName === "input" || tagName === "textarea" || tagName === "select" || e.target.isContentEditable) {
        return
      }
      
      // Check if there's a selected object
      const obj = c.getActiveObject()
      if (!obj) return
      
      // Handle arrow keys
      switch (e.key) {
        case "ArrowUp":
          e.preventDefault()
          moveSelectedObject("up", e.shiftKey)
          break
        case "ArrowDown":
          e.preventDefault()
          moveSelectedObject("down", e.shiftKey)
          break
        case "ArrowLeft":
          e.preventDefault()
          moveSelectedObject("left", e.shiftKey)
          break
        case "ArrowRight":
          e.preventDefault()
          moveSelectedObject("right", e.shiftKey)
          break
        case "Delete":
        case "Backspace":
          // Delete selected object (if not editing text)
          if (obj.type !== "textbox" || !obj.isEditing) {
            e.preventDefault()
            c.remove(obj)
            c.discardActiveObject()
            c.requestRenderAll()
            setSelectionVersion((v) => v + 1)
          }
          break
        default:
          break
      }
    }
    
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [fullscreenEditorOpen])

  // Fixed canvas viewport dimensions
  const CANVAS_VIEWPORT_WIDTH = 900
  const CANVAS_VIEWPORT_HEIGHT = 600
  // Zoom range: 5% to 500% (stored as 5 to 500)
  const CANVAS_ZOOM_MIN = 5
  const CANVAS_ZOOM_MAX = 500
  const ZOOM_STEP = 10 // 10% per click
  
  // Calculate optimal zoom to fit template width within viewport (height scrolls)
  const calculateFitZoom = (templateWidth) => {
    if (!templateWidth) return 100
    const availableWidth = CANVAS_VIEWPORT_WIDTH
    const fitPercent = Math.round((availableWidth / templateWidth) * 100)
    // Clamp to zoom range
    return Math.max(CANVAS_ZOOM_MIN, Math.min(CANVAS_ZOOM_MAX, fitPercent))
  }
  
  // Zoom is purely visual via CSS transform on the canvas wrapper.
  // Fabric.js canvas stays at original template dimensions (1:1 coordinates).
  // The outer scrollable container shows scrollbars when zoomed canvas exceeds viewport.
  const canvasZoomIn = () => setCanvasZoom((z) => Math.min(CANVAS_ZOOM_MAX, z + ZOOM_STEP))
  const canvasZoomOut = () => setCanvasZoom((z) => Math.max(CANVAS_ZOOM_MIN, z - ZOOM_STEP))
  const setCanvasZoomFromSlider = (value) => setCanvasZoom(Math.max(CANVAS_ZOOM_MIN, Math.min(CANVAS_ZOOM_MAX, Math.round(Number(value)))))
  
  // Auto-fit zoom when template dimensions change (fit to width)
  useEffect(() => {
    if (fullscreenEditorOpen && canvasSpec?.width) {
      const fitZoom = calculateFitZoom(canvasSpec.width)
      setCanvasZoom(fitZoom)
    }
  }, [fullscreenEditorOpen, canvasSpec?.width])

  // Keep a ref for any code that still reads the zoom scale
  const zoomScaleRef = useRef(1)
  
  // Sync zoom scale ref when canvasZoom changes
  useEffect(() => {
    zoomScaleRef.current = canvasZoom / 100
  }, [canvasZoom])

  const canUndo = undoHistory.length > 0 && undoIndex > 0
  const canRedo = undoHistory.length > 0 && undoIndex < undoHistory.length - 1
  const handleUndo = () => {
    const c = fabricRef.current
    if (!c || !canUndo) return
    if (undoIndexRef.current <= 0) return
    skipUndoRecordRef.current = true
    undoIndexRef.current -= 1
    const state = undoHistoryRef.current[undoIndexRef.current]
    c.loadFromJSON(state)
      .then(() => {
        restoreCurvedTextPaths(c)
        skipUndoRecordRef.current = false
        c.requestRenderAll()
        setSelectionVersion((v) => v + 1)
        setUndoIndex(undoIndexRef.current)
      })
      .catch(() => {
        skipUndoRecordRef.current = false
      })
    setUndoIndex(undoIndexRef.current)
  }
  const handleRedo = () => {
    const c = fabricRef.current
    if (!c || !canRedo) return
    if (undoIndexRef.current >= undoHistoryRef.current.length - 1) return
    skipUndoRecordRef.current = true
    undoIndexRef.current += 1
    const state = undoHistoryRef.current[undoIndexRef.current]
    c.loadFromJSON(state)
      .then(() => {
        restoreCurvedTextPaths(c)
        skipUndoRecordRef.current = false
        c.requestRenderAll()
        setSelectionVersion((v) => v + 1)
        setUndoIndex(undoIndexRef.current)
      })
      .catch(() => {
        skipUndoRecordRef.current = false
      })
    setUndoIndex(undoIndexRef.current)
  }

  const handleLayersDragStart = (e) => {
    if (e.target.closest("button") || e.target.closest("input") || e.target.closest("select")) return
    e.preventDefault() // Prevent text selection during drag
    const el = layersDialogRef.current
    if (!el) return
    // Use ref as source of truth (avoids reading state, which might be stale)
    const currentPos = layersPositionRef.current
    const initialX = currentPos.x
    const initialY = currentPos.y
    // Calculate offset based on current position
    const offsetX = e.clientX - initialX
    const offsetY = e.clientY - initialY
    const startX = e.clientX
    const startY = e.clientY
    let hasMoved = false

    // Set grabbing cursor on body so it persists even when mouse moves fast
    document.body.style.cursor = "grabbing"
    el.style.cursor = "grabbing"

    const handleMouseMove = (ev) => {
      ev.preventDefault()
      // Check if mouse actually moved (threshold to account for tiny movements)
      const deltaX = Math.abs(ev.clientX - startX)
      const deltaY = Math.abs(ev.clientY - startY)
      if (deltaX > 2 || deltaY > 2) {
        if (!hasMoved) {
          hasMoved = true
        }
        // Update DOM position directly
        const newX = ev.clientX - offsetX
        const newY = ev.clientY - offsetY
        el.style.left = `${newX}px`
        el.style.top = `${newY}px`
        // Update ref immediately (no re-render)
        layersPositionRef.current = { x: newX, y: newY }
      }
    }
    const handleMouseUp = (ev) => {
      document.body.style.cursor = ""
      el.style.cursor = ""
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", handleMouseUp)
      
      if (hasMoved) {
        // Mouse moved - sync final position from ref to React state (only one state update)
        // This ensures position persists across re-renders
        setLayersDialogPosition(layersPositionRef.current)
      } else {
        // No movement - ensure DOM matches ref position
        el.style.left = `${initialX}px`
        el.style.top = `${initialY}px`
      }
    }

    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("mouseup", handleMouseUp)
  }

  const toggleLockSelected = () => {
    const c = fabricRef.current
    const obj = c?.getActiveObject()
    if (!c || !obj) return
    const editable = Boolean(obj.get("editable"))
    const nextEditable = !editable
    obj.set("editable", nextEditable)
    obj.set({
      lockMovementX: !nextEditable,
      lockMovementY: !nextEditable,
      lockScalingX: !nextEditable,
      lockScalingY: !nextEditable,
      lockRotation: !nextEditable,
      selectable: true,
      evented: true,
    })
    c.requestRenderAll()
  }

  const setVariableIdSelected = (value) => {
    const c = fabricRef.current
    const obj = c?.getActiveObject()
    if (!c || !obj) return
    obj.set("variableId", value)
    c.requestRenderAll()
  }

  /**
   * Creates a Fabric Path (arc/semicircle) for curved text.
   * @param {number} width - Text width
   * @param {'up'|'down'} direction - 'up' = text curves upward (rainbow/smile), 'down' = text curves downward (frown)
   * @param {number} fontSize - Font size for calculating proper curve height
   * 
   * The curve is a semicircle-like arc where text follows the path.
   * For 'up': Text arcs upward - highest point in the middle
   * For 'down': Text arcs downward - lowest point in the middle
   */
  const createCurvedTextPath = (width, direction = "down", fontSize = 32) => {
    const w = Math.max(100, Number(width) || 400)
    // Create a semicircle-like curve - height proportional to width
    const curveH = Math.min(w * 0.3, 120) // Curve height proportional to width, max 120px
    const midX = w / 2
    
    let svgPath
    if (direction === "up") {
      // Arc curves UPWARD (like a rainbow/smile)
      // Using a quadratic bezier curve
      svgPath = `M 0 ${curveH} Q ${midX} 0 ${w} ${curveH}`
    } else {
      // Arc curves DOWNWARD (like a frown)
      // Using a quadratic bezier curve
      svgPath = `M 0 0 Q ${midX} ${curveH} ${w} 0`
    }
    
    try {
      const path = new fabric.Path(svgPath, { 
        visible: false,
        fill: '',
        stroke: '',
      })
      return path
    } catch (err) {
      console.error("Failed to create curved text path:", err)
      return null
    }
  }

  const applyTextStyle = (props) => {
    const c = fabricRef.current
    const obj = c?.getActiveObject()
    if (!c || !obj || (obj.type !== "textbox" && obj.get?.("layerType") !== "text")) return
    const { outline, ...rest } = props
    // Apply textTransform to actual text content when transform changes (not when user edits text)
    if (rest.textTransform != null && rest.text == null) {
      const current = obj.get("text") || ""
      const t = rest.textTransform
      const transformed =
        t === "uppercase" ? current.toUpperCase() : t === "lowercase" ? current.toLowerCase() : t === "capitalize" ? current.replace(/\b\w/g, (ch) => ch.toUpperCase()) : current
      rest.text = transformed
    }
    // Curved text: create or remove path so text follows curve (Fabric.js path-on-text feature).
    // Update path when curvedText is toggled OR when direction changes (curvedText already true).
    const isCurvedOn = rest.curvedText === true || (rest.curvedText !== false && obj.get("curvedText"))
    const directionChange = rest.curvedTextDirection != null
    if (isCurvedOn && (rest.curvedText === true || directionChange)) {
      const textWidth = obj.get("width") || 400
      const fontSize = obj.get("fontSize") || 32
      const direction = rest.curvedTextDirection ?? obj.get("curvedTextDirection") ?? "down"
      const newPath = createCurvedTextPath(textWidth, direction, fontSize)
      
      if (newPath) {
        // Apply path to text object
        obj.set('path', newPath)
        obj.set('pathAlign', 'center')
        obj.set('pathSide', 'left')
        rest.curvedText = true
        rest.curvedTextDirection = direction
        
        // Calculate curve height for proper bounding box
        const curveH = Math.min(textWidth * 0.3, 120)
        
        // Ensure enough height so text isn't clipped for both directions
        const baseHeight = fontSize * 1.5
        const minHeight = baseHeight + curveH * 2
        if ((obj.get("height") || 0) < minHeight) {
          rest.height = minHeight
        }
        
        // Remove path from rest to avoid double-setting
        delete rest.path
        delete rest.pathAlign
        delete rest.pathSide
      }
      
      // Adjust clipPath to null to prevent any clipping
      rest.clipPath = null
    } else if (rest.curvedText === false) {
      // Remove curved text
      obj.set('path', null)
      rest.curvedText = false
      rest.clipPath = null
    }
    // Outline: draw stroke first so outline appears on outer side of text (paintFirst: 'stroke')
    if (rest.stroke != null && rest.stroke !== "" && (rest.strokeWidth ?? 0) > 0) {
      rest.paintFirst = "stroke"
    } else {
      rest.paintFirst = "fill"
    }
    obj.set(rest)
    c.requestRenderAll()
    setSelectionVersion((v) => v + 1)
  }

  const saveDraft = async () => {
    const c = fabricRef.current
    if (!c) return
    if (!activeTemplate?.name?.trim()) {
      setError("Template name is required")
      return
    }
    if (!activeTemplate?.categoryId) {
      setError("Category is required")
      return
    }

    try {
      setLoading(true)
      setError("")
      setSuccess("")

      const allObjects = c.getObjects()
      const images = []
      allObjects.forEach((obj) => collectImageObjects(obj, images))
      for (const img of images) {
        const src = img.getSrc ? img.getSrc() : ""
        if (src && src.startsWith("blob:")) {
          const el = img.getElement ? img.getElement() : null
          if (el) {
            const dataUrl = await blobToDataURL(el)
            if (dataUrl) await img.setSrc(dataUrl)
          }
        }
      }

      const canvasJson = c.toObject(CANVAS_PROPERTIES_TO_INCLUDE)
      const spec = getCanvasSpec(activeTemplate, dimensions)
      const pixelcraftDocument = {
        ...buildDefaultPixelcraftDocument(canvasJson, spec),
        dimensionId: activeTemplate.dimensionId || null,
      }

      const formData = new FormData()
      formData.append("name", activeTemplate.name)
      formData.append("description", activeTemplate.description || "")
      formData.append("categoryId", activeTemplate.categoryId)
      formData.append("isActive", "false")
      formData.append("pixelcraftStatus", "draft")
      formData.append("pixelcraftVersion", String(activeTemplate.pixelcraftVersion || 1))
      formData.append("pixelcraftDocument", JSON.stringify(pixelcraftDocument))

      // Thumbnail/preview: ensure canvas is painted then capture (use toBlob for reliable file)
      try {
        const w = c.get("width") || 0
        const h = c.get("height") || 0
        if (w > 0 && h > 0) {
          c.requestRenderAll()
          await new Promise((resolve) => requestAnimationFrame(resolve))
          await new Promise((resolve) => requestAnimationFrame(resolve))
          const blob = await c.toBlob({ format: "png", multiplier: 0.25 })
          if (blob && blob.size > 0) {
            const filename = `pixelcraft_preview_${Date.now()}.png`
            formData.append("previewImage", blob, filename)
          }
        }
      } catch (e) {
        console.warn("Thumbnail capture failed:", e)
      }

      let res
      if (activeTemplate._id) {
        res = await api.put(`/templates/${activeTemplate._id}`, formData)
      } else {
        res = await api.post("/templates", formData)
      }

      const saved = res?.data
      setActiveTemplate(saved)
      setSuccess("✅ Draft saved")
      await fetchTemplates(saved)
    } catch (e) {
      setError(e.response?.data?.msg || "Failed to save draft")
    } finally {
      setLoading(false)
    }
  }

  /** Download the canvas as a flattened image in the given format (png, jpeg, gif, pdf, tiff). */
  const downloadFlattened = async (format) => {
    const c = fabricRef.current
    if (!c) return
    const baseName = (activeTemplate?.name || "template").replace(/[^\w.-]/g, "_") || "template"
    const ts = Date.now()

    try {
      if (format === "pdf") {
        const imgW = c.get("width") || 800
        const imgH = c.get("height") || 600
        // Cap resolution for smaller PDF (e.g. 300 DPI equivalent for ~A4 long side = 2480px)
        const MAX_PX = 2480
        const maxSide = Math.max(imgW, imgH)
        const multiplier = maxSide > MAX_PX ? MAX_PX / maxSide : 1
        const dataUrl = c.toDataURL({
          format: "jpeg",
          quality: 0.92,
          multiplier,
        })
        const mmPerPx = 25.4 / 300
        const wMm = imgW * mmPerPx
        const hMm = imgH * mmPerPx
        try {
          const { jsPDF } = await import("jspdf")
          const pdf = new jsPDF("p", "mm", [wMm, hMm])
          pdf.addImage(dataUrl, "JPEG", 0, 0, wMm, hMm)
          pdf.save(`${baseName}_${ts}.pdf`)
          setSuccess("Downloaded PDF")
        } catch (err) {
          setError("PDF export requires jspdf. Run: npm install jspdf")
        }
        return
      }

      if (format === "tiff") {
        const dataUrl = c.toDataURL({ format: "png", multiplier: 1 })
        triggerDownload(dataUrl, `${baseName}_${ts}.tiff`)
        setSuccess("Downloaded (PNG data in .tiff file; use PNG for standard TIFF)")
        return
      }

      const mimeMap = { png: "image/png", jpeg: "image/jpeg", jpg: "image/jpeg", gif: "image/gif" }
      const extMap = { png: "png", jpeg: "jpg", jpg: "jpg", gif: "gif" }
      const ext = extMap[format] || "png"
      const mime = mimeMap[format] || "image/png"
      let dataUrl
      try {
        dataUrl = c.toDataURL({
          format: format === "jpg" ? "jpeg" : format,
          quality: format === "jpeg" || format === "jpg" ? 0.92 : 1,
          multiplier: 1,
        })
      } catch (e) {
        dataUrl = c.toDataURL({ format: "png", multiplier: 1 })
      }
      triggerDownload(dataUrl, `${baseName}_${ts}.${ext}`)
      setSuccess(`Downloaded ${ext.toUpperCase()}`)
    } catch (e) {
      setError(e?.message || "Download failed")
    }
  }

  /** Vectorize canvas to print-ready SVG (DTF/sublimation). Requires imagetracerjs. */
  const downloadVectorSVG = async () => {
    const c = fabricRef.current
    if (!c) return
    const baseName = (activeTemplate?.name || "template").replace(/[^\w.-]/g, "_") || "template"
    const ts = Date.now()
    try {
      setError("")
      const dataUrl = c.toDataURL({ format: "png", multiplier: 1 })
      const svgString = await vectorizeImageToSVG(dataUrl)
      triggerDownloadString(svgString, `${baseName}_${ts}.svg`)
      setSuccess("Downloaded vector SVG (open in Illustrator for CMYK/EPS)")
    } catch (e) {
      setError(e?.message || "Vector export failed. Install imagetracerjs: npm install imagetracerjs")
    }
  }

  const publish = async () => {
    if (!activeTemplate?._id) {
      setError("Save draft first, then publish")
      return
    }
    try {
      setLoading(true)
      setError("")
      setSuccess("")
      const formData = new FormData()
      formData.append("pixelcraftStatus", "published")
      formData.append("isActive", "true")

      // If template has no thumbnail but canvas is available, generate and send one (always send thumbnail on publish so it's fresh)
      const c = fabricRef.current
      if (c) {
        try {
          const w = c.get("width") || 0
          const h = c.get("height") || 0
          if (w > 0 && h > 0) {
            c.requestRenderAll()
            await new Promise((resolve) => requestAnimationFrame(resolve))
            await new Promise((resolve) => requestAnimationFrame(resolve))
            const blob = await c.toBlob({ format: "png", multiplier: 0.25 })
            if (blob && blob.size > 0) {
              formData.append("previewImage", blob, `pixelcraft_preview_${Date.now()}.png`)
            }
          }
        } catch (e) {
          console.warn("Thumbnail capture on publish failed:", e)
        }
      }

      const putRes = await api.put(`/templates/${activeTemplate._id}`, formData)
      await api.patch(`/templates/${activeTemplate._id}/status`, { isActive: true })
      setSuccess("✅ Published")
      const updated = putRes?.data
      if (updated) setActiveTemplate(updated)
      await fetchTemplates(updated || null)
    } catch (e) {
      setError(e.response?.data?.msg || "Failed to publish")
    } finally {
      setLoading(false)
    }
  }

  const removeTemplate = async (id) => {
    if (!window.confirm("Delete this template?")) return
    try {
      setLoading(true)
      setError("")
      setSuccess("")
      await api.delete(`/templates/${id}`)
      setSuccess("🗑️ Deleted")
      await fetchTemplates()
    } catch (e) {
      setError(e.response?.data?.msg || "Failed to delete")
    } finally {
      setLoading(false)
    }
  }

  const selectedObj = fabricRef.current?.getActiveObject()
  const selectedVariableId = selectedObj?.get("variableId") || ""
  const selectedLayerId = selectedObj?.get("layerId") || ""
  const selectedEditable = selectedObj ? Boolean(selectedObj.get("editable")) : null
  const isTextSelected =
    selectedObj && (selectedObj.type === "textbox" || selectedObj.get?.("layerType") === "text")
  const isShapeSelected = selectedObj && selectedObj.type === "group" && selectedObj.get?.("layerType") === "shape"
  const isShapeWithImage = isShapeSelected && (selectedObj.getObjects?.()?.length ?? 0) >= 2
  const isImageSelected = selectedObj && (selectedObj.type === "image" || selectedObj.get?.("layerType") === "image")
  const isImageInShapeSelected =
    selectedObj?.get?.("layerType") === "image" && selectedObj?.group?.get?.("layerType") === "shape"
  const shapeWidth = isShapeSelected ? Math.round((selectedObj.get("width") || 0) * (selectedObj.get("scaleX") ?? 1)) : 0
  const shapeHeight = isShapeSelected ? Math.round((selectedObj.get("height") || 0) * (selectedObj.get("scaleY") ?? 1)) : 0
  const shapeAngle = isShapeSelected ? (selectedObj.get("angle") ?? 0) : 0
  const shapeRect = isShapeSelected && selectedObj.getObjects ? selectedObj.getObjects()[0] : null
  const shapeFill = shapeRect ? (shapeRect.get?.("fill") ?? "#f3f4f6") : "#f3f4f6"
  const shapeStroke = shapeRect ? (shapeRect.get?.("stroke") ?? "#9ca3af") : "#9ca3af"
  const shapeStrokeWidth = shapeRect ? (shapeRect.get?.("strokeWidth") ?? 2) : 2
  const shapeStrokeDashArray = shapeRect ? shapeRect.get?.("strokeDashArray") : null
  const shapeRx = shapeRect ? (shapeRect.get?.("rx") ?? 0) : 0
  const shapeShadow = shapeRect ? shapeRect.get?.("shadow") : null
  const shapeOpacity = shapeRect ? (shapeRect.get?.("opacity") ?? 1) : 1

  // Open unified Edit Tool when text, shape, or image is selected; close when nothing selected
  useEffect(() => {
    if (isTextSelected || isShapeSelected || isImageSelected) setEditToolOpen(true)
    else setEditToolOpen(false)
  }, [isTextSelected, isShapeSelected, isImageSelected])

  const textContent = isTextSelected ? (selectedObj.get("text") ?? "") : ""
  const textFontFamily = isTextSelected ? (selectedObj.get("fontFamily") || "Arial") : "Arial"
  const textFontSize = isTextSelected ? (selectedObj.get("fontSize") || 32) : 32
  const textFill = isTextSelected ? (selectedObj.get("fill") || "#111827") : "#111827"
  const textBold = isTextSelected ? (selectedObj.get("fontWeight") === "bold" || selectedObj.get("fontWeight") === 700) : false
  const textItalic = isTextSelected ? (selectedObj.get("fontStyle") === "italic") : false
  const textUnderline = isTextSelected ? Boolean(selectedObj.get("underline")) : false
  const textOverline = isTextSelected ? Boolean(selectedObj.get("overline")) : false
  const textLinethrough = isTextSelected ? Boolean(selectedObj.get("linethrough")) : false
  const textAlign = isTextSelected ? (selectedObj.get("textAlign") || "left") : "left"
  const textLineHeight = isTextSelected ? (selectedObj.get("lineHeight") ?? 1.16) : 1.16
  const textCharSpacing = isTextSelected ? (selectedObj.get("charSpacing") ?? 0) : 0
  const textTransform = isTextSelected ? (selectedObj.get("textTransform") || "none") : "none"
  const textOpacity = isTextSelected ? (selectedObj.get("opacity") ?? 1) : 1
  const textBackgroundColor = isTextSelected ? selectedObj.get("textBackgroundColor") : undefined
  const textStroke = isTextSelected ? (selectedObj.get("stroke") || "") : ""
  const textStrokeWidth = isTextSelected ? (selectedObj.get("strokeWidth") ?? 0) : 0
  const textShadow = isTextSelected ? selectedObj.get("shadow") : null
  const textCurvedText = isTextSelected ? Boolean(selectedObj.get("curvedText")) : false
  const textCurvedTextDirection = isTextSelected ? (selectedObj.get("curvedTextDirection") || "down") : "down"
  const textOutline = isTextSelected ? Boolean(textStroke && textStrokeWidth > 0) : false
  const textShadowOn = Boolean(textShadow && (textShadow.color || textShadow.blur))
  const textShadowColor = textShadow?.color || "#000000"
  const textShadowBlur = textShadow?.blur ?? 0
  const textShadowOffsetX = textShadow?.offsetX ?? 0
  const textShadowOffsetY = textShadow?.offsetY ?? 0

  // Image edit values (selected image = standalone or inside shape)
  const imageObj = isImageSelected ? selectedObj : null
  const imageOpacity = imageObj ? (imageObj.get?.("opacity") ?? 1) : 1
  const imageBorderRadius = imageObj ? (imageObj.get?.("borderRadius") ?? 0) : 0
  const imageShadow = imageObj ? imageObj.get?.("shadow") : null
  const imageAngle = imageObj ? (imageObj.get?.("angle") ?? 0) : 0
  const imageAspectLock = imageObj ? Boolean(imageObj.get?.("lockUniScaling")) : false

  return (
    <div className="paddingAll20">
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

      {/* Layers & Background – draggable panel (no overlay), same position as text tools */}
      {layersDialogOpen && activeTemplate && (
        <div
          ref={layersDialogRef}
          style={{
            position: "fixed",
            left: `${layersDialogPosition.x}px`,
            top: `${layersDialogPosition.y}px`,
            zIndex: 10001,
            backgroundColor: "white",
            borderRadius: 12,
            padding: 0,
            width: 420,
            maxHeight: "85vh",
            overflow: "hidden",
            boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
            display: "flex",
            flexDirection: "column",
            cursor: "default",
            userSelect: "none",
          }}
        >
          <div
            onMouseDown={handleLayersDragStart}
            style={{
              padding: "16px 20px",
              borderBottom: "1px solid #e5e7eb",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              cursor: "grab",
            }}
          >
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, pointerEvents: "none" }}>Layers & Background</h2>
            <button
              type="button"
              onClick={() => setLayersDialogOpen(false)}
              onMouseDown={(e) => e.stopPropagation()}
              style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", opacity: 0.7, lineHeight: 1 }}
              aria-label="Close"
            >
              ×
            </button>
          </div>
            <div style={{ display: "flex", borderBottom: "1px solid #e5e7eb" }} onMouseDown={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => setLayersTab("layers")}
                style={{
                  flex: 1,
                  padding: "12px 16px",
                  fontSize: 14,
                  fontWeight: 500,
                  border: "none",
                  background: layersTab === "layers" ? "#f3f4f6" : "transparent",
                  cursor: "pointer",
                  borderBottom: layersTab === "layers" ? "2px solid #111" : "2px solid transparent",
                }}
              >
                Layers
              </button>
              <button
                type="button"
                onClick={() => setLayersTab("background")}
                style={{
                  flex: 1,
                  padding: "12px 16px",
                  fontSize: 14,
                  fontWeight: 500,
                  border: "none",
                  background: layersTab === "background" ? "#f3f4f6" : "transparent",
                  cursor: "pointer",
                  borderBottom: layersTab === "background" ? "2px solid #111" : "2px solid transparent",
                }}
              >
                Background
              </button>
            </div>
            <div style={{ padding: 16, overflowY: "auto", flex: 1 }} onMouseDown={(e) => e.stopPropagation()}>
              {layersTab === "layers" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {canvasLayers.length === 0 ? (
                    <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>No layers. Add text, shapes, or images from the tools.</p>
                  ) : (
                    canvasLayers.map((obj, index) => {
                      const isSelected = selectedObj === obj
                      const isFirst = index === 0
                      const isLast = index === canvasLayers.length - 1
                      const isVisible = obj.get?.("visible") !== false
                      const isLocked = !!(obj.get?.("lockMovementX") && obj.get?.("lockMovementY"))
                      return (
                        <div
                          key={obj.get?.("layerId") || index}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "8px 10px",
                            borderRadius: 8,
                            background: isSelected ? "#e0e7ff" : "#f9fafb",
                            border: isSelected ? "1px solid #818cf8" : "1px solid transparent",
                            cursor: "pointer",
                            opacity: isVisible ? 1 : 0.7,
                          }}
                          onClick={() => selectLayer(obj)}
                        >
                          <span style={{ fontSize: 16, width: 24, textAlign: "center" }}>{getLayerIcon(obj)}</span>
                          <span style={{ flex: 1, fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {getLayerLabel(obj)}
                          </span>
                          <div style={{ display: "flex", alignItems: "center", gap: 2 }} onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              title={isVisible ? "Hide layer" : "Show layer"}
                              onClick={(e) => toggleLayerVisibility(obj, e)}
                              style={{
                                padding: "4px 6px",
                                fontSize: 14,
                                borderRadius: 4,
                                border: "1px solid #d1d5db",
                                background: "white",
                                cursor: "pointer",
                                opacity: isVisible ? 1 : 0.5,
                              }}
                            >
                              👁
                            </button>
                            <button
                              type="button"
                              title={isLocked ? "Unlock layer" : "Lock layer"}
                              onClick={(e) => toggleLayerLock(obj, e)}
                              style={{
                                padding: "4px 6px",
                                fontSize: 14,
                                borderRadius: 4,
                                border: "1px solid #d1d5db",
                                background: "white",
                                cursor: "pointer",
                              }}
                            >
                              {isLocked ? "🔒" : "🔓"}
                            </button>
                            <button
                              type="button"
                              title="Move down"
                              disabled={isLast}
                              onClick={() => moveLayerDown(obj)}
                              style={{ padding: "4px 8px", fontSize: 12, borderRadius: 4, border: "1px solid #d1d5db", background: "white", cursor: isLast ? "not-allowed" : "pointer" }}
                            >
                              ↓
                            </button>
                            <button
                              type="button"
                              title="Move up"
                              disabled={isFirst}
                              onClick={() => moveLayerUp(obj)}
                              style={{ padding: "4px 8px", fontSize: 12, borderRadius: 4, border: "1px solid #d1d5db", background: "white", cursor: isFirst ? "not-allowed" : "pointer" }}
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              title="Delete layer"
                              onClick={() => { if (window.confirm("Delete this layer?")) deleteLayer(obj); }}
                              style={{ padding: "4px 8px", fontSize: 12, borderRadius: 4, border: "1px solid #d1d5db", background: "#fef2f2", color: "#b91c1c", cursor: "pointer" }}
                            >
                              🗑
                            </button>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              )}
              {layersTab === "background" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {/* Background Type Selector */}
                  <div style={{ display: "flex", gap: 8 }}>
                    {["color", "image", "gradient"].map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setBackgroundType(type)}
                        style={{
                          flex: 1,
                          padding: "8px 12px",
                          fontSize: 12,
                          fontWeight: 500,
                          border: backgroundType === type ? "2px solid #3b82f6" : "1px solid #d1d5db",
                          borderRadius: 6,
                          background: backgroundType === type ? "#eff6ff" : "#fff",
                          color: backgroundType === type ? "#3b82f6" : "#374151",
                          cursor: "pointer",
                          textTransform: "capitalize",
                        }}
                      >
                        {type}
                      </button>
                    ))}
                  </div>

                  {/* Solid Color Options */}
                  {backgroundType === "color" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      <label style={{ fontSize: 13, fontWeight: 500 }}>Solid Color</label>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <input
                          type="color"
                          value={canvasBackgroundColor || "#ffffff"}
                          onChange={(e) => applyBackgroundColor(e.target.value)}
                          style={{ width: 48, height: 40, padding: 0, border: "1px solid #d1d5db", borderRadius: 8, cursor: "pointer" }}
                        />
                        <input
                          type="text"
                          value={canvasBackgroundColor || "#ffffff"}
                          onChange={(e) => applyBackgroundColor(e.target.value)}
                          style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13 }}
                        />
                      </div>
                      {/* Preset Colors */}
                      <label style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>Preset Colors</label>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {presetColors.map((color) => (
                          <button
                            key={color}
                            type="button"
                            onClick={() => applyBackgroundColor(color)}
                            style={{
                              width: 24,
                              height: 24,
                              padding: 0,
                              border: canvasBackgroundColor === color ? "2px solid #3b82f6" : "1px solid #d1d5db",
                              borderRadius: 4,
                              background: color,
                              cursor: "pointer",
                              boxShadow: canvasBackgroundColor === color ? "0 0 0 2px #bfdbfe" : "none",
                            }}
                            title={color}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Background Image Options */}
                  {backgroundType === "image" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      <label style={{ fontSize: 13, fontWeight: 500 }}>Background Image</label>
                      
                      {/* Upload Button */}
                      <input
                        ref={backgroundInputRef}
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) applyBackgroundImage(file, backgroundImage?.fit || "cover")
                          e.target.value = ""
                        }}
                        style={{ display: "none" }}
                      />
                      <button
                        type="button"
                        onClick={() => backgroundInputRef.current?.click()}
                        style={{
                          padding: "12px 16px",
                          fontSize: 13,
                          fontWeight: 500,
                          border: "2px dashed #d1d5db",
                          borderRadius: 8,
                          background: "#f9fafb",
                          color: "#374151",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 8,
                        }}
                      >
                        <span style={{ fontSize: 18 }}>📷</span>
                        Upload Background Image
                      </button>

                      {/* Current Image Preview */}
                      {backgroundImage?.url && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          <div style={{
                            width: "100%",
                            height: 100,
                            borderRadius: 8,
                            overflow: "hidden",
                            border: "1px solid #d1d5db",
                          }}>
                            <img
                              src={backgroundImage.url}
                              alt="Background"
                              style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            />
                          </div>
                          
                          {/* Fit Options */}
                          <label style={{ fontSize: 12, color: "#6b7280" }}>Fit Mode</label>
                          <div style={{ display: "flex", gap: 6 }}>
                            {["cover", "contain", "stretch", "tile"].map((fit) => (
                              <button
                                key={fit}
                                type="button"
                                onClick={() => changeBackgroundFit(fit)}
                                style={{
                                  flex: 1,
                                  padding: "6px 8px",
                                  fontSize: 11,
                                  fontWeight: 500,
                                  border: backgroundImage?.fit === fit ? "2px solid #3b82f6" : "1px solid #d1d5db",
                                  borderRadius: 4,
                                  background: backgroundImage?.fit === fit ? "#eff6ff" : "#fff",
                                  color: backgroundImage?.fit === fit ? "#3b82f6" : "#6b7280",
                                  cursor: "pointer",
                                  textTransform: "capitalize",
                                }}
                              >
                                {fit}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Gradient Options */}
                  {backgroundType === "gradient" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      <label style={{ fontSize: 13, fontWeight: 500 }}>Gradient Background</label>
                      
                      {/* Gradient Type */}
                      <div style={{ display: "flex", gap: 8 }}>
                        {["linear", "radial"].map((type) => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => {
                              const newGradient = { ...backgroundGradient, type }
                              setBackgroundGradient(newGradient)
                              applyBackgroundGradient(newGradient)
                            }}
                            style={{
                              flex: 1,
                              padding: "8px 12px",
                              fontSize: 12,
                              fontWeight: 500,
                              border: backgroundGradient.type === type ? "2px solid #3b82f6" : "1px solid #d1d5db",
                              borderRadius: 6,
                              background: backgroundGradient.type === type ? "#eff6ff" : "#fff",
                              color: backgroundGradient.type === type ? "#3b82f6" : "#374151",
                              cursor: "pointer",
                              textTransform: "capitalize",
                            }}
                          >
                            {type}
                          </button>
                        ))}
                      </div>

                      {/* Gradient Colors */}
                      <div style={{ display: "flex", gap: 12 }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 4 }}>Color 1</label>
                          <input
                            type="color"
                            value={backgroundGradient.color1}
                            onChange={(e) => {
                              const newGradient = { ...backgroundGradient, color1: e.target.value }
                              setBackgroundGradient(newGradient)
                              applyBackgroundGradient(newGradient)
                            }}
                            style={{ width: "100%", height: 36, padding: 0, border: "1px solid #d1d5db", borderRadius: 6, cursor: "pointer" }}
                          />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 4 }}>Color 2</label>
                          <input
                            type="color"
                            value={backgroundGradient.color2}
                            onChange={(e) => {
                              const newGradient = { ...backgroundGradient, color2: e.target.value }
                              setBackgroundGradient(newGradient)
                              applyBackgroundGradient(newGradient)
                            }}
                            style={{ width: "100%", height: 36, padding: 0, border: "1px solid #d1d5db", borderRadius: 6, cursor: "pointer" }}
                          />
                        </div>
                      </div>

                      {/* Gradient Angle (for linear) */}
                      {backgroundGradient.type === "linear" && (
                        <div>
                          <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 4 }}>
                            Angle: {backgroundGradient.angle}°
                          </label>
                          <input
                            type="range"
                            min="0"
                            max="360"
                            value={backgroundGradient.angle}
                            onChange={(e) => {
                              const newGradient = { ...backgroundGradient, angle: parseInt(e.target.value) }
                              setBackgroundGradient(newGradient)
                              applyBackgroundGradient(newGradient)
                            }}
                            style={{ width: "100%", cursor: "pointer" }}
                          />
                          {/* Angle Presets */}
                          <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
                            {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
                              <button
                                key={angle}
                                type="button"
                                onClick={() => {
                                  const newGradient = { ...backgroundGradient, angle }
                                  setBackgroundGradient(newGradient)
                                  applyBackgroundGradient(newGradient)
                                }}
                                style={{
                                  flex: 1,
                                  padding: "4px",
                                  fontSize: 10,
                                  border: backgroundGradient.angle === angle ? "2px solid #3b82f6" : "1px solid #d1d5db",
                                  borderRadius: 4,
                                  background: backgroundGradient.angle === angle ? "#eff6ff" : "#fff",
                                  color: backgroundGradient.angle === angle ? "#3b82f6" : "#6b7280",
                                  cursor: "pointer",
                                }}
                              >
                                {angle}°
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Gradient Preview */}
                      <div
                        style={{
                          width: "100%",
                          height: 40,
                          borderRadius: 8,
                          border: "1px solid #d1d5db",
                          background: backgroundGradient.type === "linear"
                            ? `linear-gradient(${backgroundGradient.angle}deg, ${backgroundGradient.color1}, ${backgroundGradient.color2})`
                            : `radial-gradient(circle, ${backgroundGradient.color1}, ${backgroundGradient.color2})`,
                        }}
                      />
                    </div>
                  )}

                  {/* Remove Background Button */}
                  <button
                    type="button"
                    onClick={removeBackground}
                    style={{
                      marginTop: 8,
                      padding: "10px 16px",
                      fontSize: 13,
                      fontWeight: 500,
                      border: "1px solid #fecaca",
                      borderRadius: 8,
                      background: "#fef2f2",
                      color: "#dc2626",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                    }}
                  >
                    <span>🗑️</span>
                    Reset to White
                  </button>
                </div>
              )}
            </div>
          </div>
      )}

      {/* First container – Create new template form */}
      <div className="brandFormContainer paddingAll32 appendBottom30">
        <h3 className="font18 fontSemiBold appendBottom16">Create New Template</h3>
        <div className="makeFlex row gap10 alignEnd" style={{ flexWrap: "wrap" }}>
          <FormField
            type="text"
            name="name"
            label="Template name"
            value={newTemplateName}
            onChange={(e) => setNewTemplateName(e.target.value)}
            placeholder="Enter template name"
            className="appendBottom0"
          />
          <FormField
            type="select"
            name="categoryId"
            label="Category"
            value={newTemplateCategoryId}
            onChange={(e) => setNewTemplateCategoryId(e.target.value)}
            placeholderOption="Select category"
            options={categories.filter((c) => !c.deleted).map((c) => ({ value: c._id, label: c.name }))}
            className="appendBottom0"
          />
          <FormField
            type="select"
            name="dimensionId"
            label="Template dimension"
            value={newTemplateDimensionId}
            onChange={(e) => setNewTemplateDimensionId(e.target.value)}
            placeholderOption="Select dimension (canvas size)"
            options={dimensions
              .filter((d) => d.isActive !== false && !d.deleted)
              .map((d) => ({ value: d._id, label: `${d.name} (${d.width}×${d.height} ${d.unit || "mm"})` }))}
            className="appendBottom0"
          />
          <button
            type="button"
            className="btnPrimary"
            onClick={openNew}
            disabled={loading || !newTemplateDimensionId}
          >
            {loading ? <span className="loadingSpinner">⏳</span> : "➕ Create & Edit Template"}
          </button>
        </div>
      </div>

      {/* ==================== FULLSCREEN EDITOR MODAL ==================== */}
      {fullscreenEditorOpen && activeTemplate && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 10000,
            background: "#f3f4f6",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Toast messages - must be inside the fullscreen modal to be visible above z-index 10000 */}
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
          {/* Top Header Bar */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 20px",
              background: "#1f2937",
              flexShrink: 0,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button
                type="button"
                onClick={closeFullscreenEditor}
                title="Back to List"
                style={{
                  width: 36,
                  height: 36,
                  fontSize: 16,
                  border: "none",
                  borderRadius: 6,
                  background: "rgba(255,255,255,0.1)",
                  color: "#fff",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                ←
              </button>
              <span style={{ color: "#fff", fontSize: 16, fontWeight: 600 }}>PixelCraft Editor</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button
                type="button"
                onClick={saveDraft}
                disabled={loading}
                style={{
                  padding: "8px 16px",
                  fontSize: 13,
                  fontWeight: 500,
                  border: "none",
                  borderRadius: 6,
                  background: "#3b82f6",
                  color: "#fff",
                  cursor: loading ? "not-allowed" : "pointer",
                }}
              >
                {loading ? "⏳" : "💾"} Save
              </button>
              <button
                type="button"
                onClick={publish}
                disabled={loading}
                style={{
                  padding: "8px 16px",
                  fontSize: 13,
                  fontWeight: 500,
                  border: "none",
                  borderRadius: 6,
                  background: "#10b981",
                  color: "#fff",
                  cursor: loading ? "not-allowed" : "pointer",
                }}
              >
                🚀 Publish
              </button>
              <div style={{ position: "relative", display: "inline-block" }}>
                <button
                  type="button"
                  disabled={loading}
                  onClick={(e) => {
                    const el = e.currentTarget.nextElementSibling
                    if (el) el.style.display = el.style.display === "none" ? "block" : "none"
                  }}
                  style={{
                    padding: "8px 16px",
                    fontSize: 13,
                    fontWeight: 500,
                    border: "none",
                    borderRadius: 6,
                    background: "rgba(255,255,255,0.1)",
                    color: "#fff",
                    cursor: "pointer",
                  }}
                >
                  ⬇ Download
                </button>
                <div
                  style={{
                    display: "none",
                    position: "absolute",
                    right: 0,
                    top: "100%",
                    marginTop: 4,
                    background: "#fff",
                    border: "1px solid #d1d5db",
                    borderRadius: 8,
                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                    zIndex: 100,
                    minWidth: 140,
                    padding: "6px 0",
                  }}
                  data-download-menu-fullscreen
                >
                  {["PNG", "JPG", "GIF", "PDF", "TIFF"].map((fmt) => (
                    <button
                      key={fmt}
                      type="button"
                      style={{
                        display: "block",
                        width: "100%",
                        padding: "8px 14px",
                        border: "none",
                        background: "none",
                        textAlign: "left",
                        cursor: "pointer",
                        fontSize: 14,
                      }}
                      onClick={() => {
                        downloadFlattened(fmt.toLowerCase())
                        const el = document.querySelector("[data-download-menu-fullscreen]")
                        if (el) el.style.display = "none"
                      }}
                    >
                      {fmt}
                    </button>
                  ))}
                  <button
                    type="button"
                    style={{
                      display: "block",
                      width: "100%",
                      padding: "8px 14px",
                      border: "none",
                      borderTop: "1px solid #e5e7eb",
                      background: "none",
                      textAlign: "left",
                      cursor: "pointer",
                      fontSize: 14,
                    }}
                    onClick={async () => {
                      const el = document.querySelector("[data-download-menu-fullscreen]")
                      if (el) el.style.display = "none"
                      await downloadVectorSVG()
                    }}
                  >
                    Vector (SVG)
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Template Settings Bar - brandFormContainer style */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              padding: "12px 20px",
              background: "#fff",
              borderBottom: "1px solid #e5e7eb",
              flexShrink: 0,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: "#374151" }}>Name:</label>
              <input
                type="text"
                value={activeTemplate?.name || ""}
                onChange={(e) => setActiveTemplate((t) => ({ ...t, name: e.target.value }))}
                placeholder="Template name"
                style={{
                  padding: "6px 12px",
                  fontSize: 13,
                  border: "1px solid #d1d5db",
                  borderRadius: 6,
                  width: 180,
                }}
              />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: "#374151" }}>Category:</label>
              <select
                value={
                  activeTemplate?.categoryId != null
                    ? typeof activeTemplate.categoryId === "object" && activeTemplate.categoryId?._id != null
                      ? String(activeTemplate.categoryId._id)
                      : String(activeTemplate.categoryId)
                    : ""
                }
                onChange={(e) => setActiveTemplate((t) => ({ ...t, categoryId: e.target.value }))}
                style={{
                  padding: "6px 12px",
                  fontSize: 13,
                  border: "1px solid #d1d5db",
                  borderRadius: 6,
                  minWidth: 140,
                }}
              >
                <option value="">Select</option>
                {categories.filter((c) => !c.deleted).map((c) => (
                  <option key={c._id} value={c._id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: "#374151" }}>Dimension:</label>
              <select
                value={activeTemplate?.dimensionId != null ? String(activeTemplate.dimensionId) : ""}
                onChange={(e) => setActiveTemplate((t) => ({ ...t, dimensionId: e.target.value }))}
                style={{
                  padding: "6px 12px",
                  fontSize: 13,
                  border: "1px solid #d1d5db",
                  borderRadius: 6,
                  minWidth: 160,
                }}
              >
                <option value="">Select</option>
                {dimensions.filter((d) => d.isActive !== false && !d.deleted).map((d) => (
                  <option key={d._id} value={d._id}>{d.name} ({d.width}×{d.height})</option>
                ))}
              </select>
            </div>
            <div style={{ marginLeft: "auto", fontSize: 12, color: "#6b7280", display: "flex", alignItems: "center", gap: 12 }}>
              <span>Template: {canvasSpec?.width || 600} × {canvasSpec?.height || 400} px</span>
              <span style={{ color: "#9ca3af" }}>|</span>
              <span>Canvas Area: 900 × 600 px</span>
            </div>
          </div>

          {/* Main Editor Area - Tools Left, Canvas Right */}
          <div style={{ display: "flex", flex: 1, overflow: "hidden", minHeight: 0 }}>
            {/* Left Side - Icon Tools Panel */}
            <div style={{ 
              width: 60, 
              background: "#1f2937", 
              display: "flex", 
              flexDirection: "column", 
              alignItems: "center", 
              padding: "16px 8px", 
              gap: 8,
              flexShrink: 0,
              overflow: "hidden"
            }}>
              <button
                type="button"
                onClick={addText}
                disabled={loading}
                title="Add Text"
                style={{
                  width: 44,
                  height: 44,
                  fontSize: 20,
                  border: "none",
                  borderRadius: 10,
                  background: "transparent",
                  color: "#fff",
                  cursor: loading ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "background 0.2s",
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = "#374151"}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
              >
                T
              </button>
              <button
                type="button"
                onClick={addRect}
                disabled={loading}
                title="Add Shape"
                style={{
                  width: 44,
                  height: 44,
                  fontSize: 20,
                  border: "none",
                  borderRadius: 10,
                  background: "transparent",
                  color: "#fff",
                  cursor: loading ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "background 0.2s",
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = "#374151"}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
              >
                ▢
              </button>
              <label
                title={isShapeSelected ? "Insert Image into Shape" : "Add Image"}
                style={{
                  width: 44,
                  height: 44,
                  fontSize: 20,
                  border: "none",
                  borderRadius: 10,
                  background: "transparent",
                  color: "#fff",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "background 0.2s",
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = "#374151"}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
              >
                🖼
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={(e) => { addImageFromFile(e.target.files?.[0]); e.target.value = "" }}
                />
              </label>
              <button
                type="button"
                onClick={toggleLockSelected}
                disabled={!selectedObj || loading}
                title={selectedEditable ? "Lock Element" : "Unlock Element"}
                style={{
                  width: 44,
                  height: 44,
                  fontSize: 20,
                  border: "none",
                  borderRadius: 10,
                  background: "transparent",
                  color: !selectedObj ? "#6b7280" : "#fff",
                  cursor: !selectedObj || loading ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "background 0.2s",
                }}
                onMouseEnter={(e) => { if (selectedObj) e.currentTarget.style.background = "#374151" }}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
              >
                {selectedEditable ? "🔒" : "🔓"}
              </button>
              <button
                type="button"
                onClick={toggleLayersDialog}
                disabled={loading}
                title="Layers & Background"
                style={{
                  width: 44,
                  height: 44,
                  fontSize: 20,
                  border: "none",
                  borderRadius: 10,
                  background: "transparent",
                  color: "#fff",
                  cursor: loading ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "background 0.2s",
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = "#374151"}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
              >
                ☰
              </button>
              
              {/* Divider */}
              <div style={{ width: 32, height: 1, background: "#4b5563", margin: "8px 0" }} />
              
              {/* Undo */}
              <button
                type="button"
                onClick={handleUndo}
                disabled={!canUndo}
                title="Undo"
                style={{
                  width: 44,
                  height: 44,
                  fontSize: 18,
                  border: "none",
                  borderRadius: 10,
                  background: "transparent",
                  color: canUndo ? "#fff" : "#6b7280",
                  cursor: canUndo ? "pointer" : "not-allowed",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "background 0.2s",
                }}
                onMouseEnter={(e) => { if (canUndo) e.currentTarget.style.background = "#374151" }}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
              >
                ↶
              </button>
              {/* Redo */}
              <button
                type="button"
                onClick={handleRedo}
                disabled={!canRedo}
                title="Redo"
                style={{
                  width: 44,
                  height: 44,
                  fontSize: 18,
                  border: "none",
                  borderRadius: 10,
                  background: "transparent",
                  color: canRedo ? "#fff" : "#6b7280",
                  cursor: canRedo ? "pointer" : "not-allowed",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "background 0.2s",
                }}
                onMouseEnter={(e) => { if (canRedo) e.currentTarget.style.background = "#374151" }}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
              >
                ↷
              </button>
            </div>

            {/* Right Side - Scrollable Canvas Area */}
            <div 
              style={{ 
                flex: 1, 
                overflow: "auto", 
                background: "#e5e7eb", 
                minHeight: 0, 
                position: "relative" 
              }}
            >
              {/* Canvas + CSS transform zoom — scrollable when zoomed beyond viewport */}
              {(() => {
                const templateW = canvasSpec?.width || 600
                const templateH = canvasSpec?.height || 400
                const scale = canvasZoom / 100
                const scaledW = Math.round(templateW * scale)
                const scaledH = Math.round(templateH * scale)
                const pad = 24

                return (
                  <div
                    style={{
                      /* This div sizes itself to the zoomed canvas + padding.
                         When it's larger than the viewport, the parent scrolls. */
                      width: scaledW + pad * 2,
                      minWidth: "100%",
                      height: scaledH + pad * 2,
                      minHeight: "100%",
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "flex-start",
                      padding: pad,
                      boxSizing: "border-box",
                    }}
                  >
                    {/* Scaled wrapper — CSS transform scales the canvas visually */}
                    <div
                      style={{
                        width: scaledW,
                        height: scaledH,
                        flexShrink: 0,
                        overflow: "hidden",
                        borderRadius: 4,
                        boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
                      }}
                    >
                      <div
                        style={{
                          transform: `scale(${scale})`,
                          transformOrigin: "top left",
                          width: templateW,
                          height: templateH,
                        }}
                      >
                        <div
                          ref={canvasContainerCallbackRef}
                          style={{
                            width: templateW,
                            height: templateH,
                            background: "#fff",
                            overflow: "hidden",
                            position: "relative",
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )
              })()}

              {/* Zoom Controls - Bottom Right */}
              <div
                style={{
                  position: "fixed",
                  bottom: 16,
                  right: 16,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  background: "rgba(31, 41, 55, 0.95)",
                  padding: "10px 14px",
                  borderRadius: 8,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                }}
              >
                {/* Zoom Out Button */}
                <button
                  type="button"
                  onClick={canvasZoomOut}
                  disabled={canvasZoom <= CANVAS_ZOOM_MIN}
                  title="Zoom Out (−)"
                  style={{
                    width: 32,
                    height: 32,
                    fontSize: 18,
                    fontWeight: "bold",
                    border: "none",
                    borderRadius: 6,
                    background: canvasZoom <= CANVAS_ZOOM_MIN ? "#4b5563" : "#3b82f6",
                    color: "#fff",
                    cursor: canvasZoom <= CANVAS_ZOOM_MIN ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "background 0.2s",
                  }}
                >
                  −
                </button>

                {/* Zoom Slider */}
                <input
                  type="range"
                  min={CANVAS_ZOOM_MIN}
                  max={CANVAS_ZOOM_MAX}
                  value={canvasZoom}
                  onChange={(e) => setCanvasZoomFromSlider(e.target.value)}
                  style={{
                    width: 120,
                    height: 6,
                    cursor: "pointer",
                    accentColor: "#3b82f6",
                  }}
                  title={`Zoom: ${canvasZoom}%`}
                />

                {/* Zoom In Button */}
                <button
                  type="button"
                  onClick={canvasZoomIn}
                  disabled={canvasZoom >= CANVAS_ZOOM_MAX}
                  title="Zoom In (+)"
                  style={{
                    width: 32,
                    height: 32,
                    fontSize: 18,
                    fontWeight: "bold",
                    border: "none",
                    borderRadius: 6,
                    background: canvasZoom >= CANVAS_ZOOM_MAX ? "#4b5563" : "#3b82f6",
                    color: "#fff",
                    cursor: canvasZoom >= CANVAS_ZOOM_MAX ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "background 0.2s",
                  }}
                >
                  +
                </button>

                {/* Zoom Percentage Display */}
                <span
                  style={{
                    color: "#fff",
                    fontSize: 13,
                    fontWeight: 600,
                    minWidth: 56,
                    textAlign: "center",
                    background: "rgba(0,0,0,0.3)",
                    padding: "4px 10px",
                    borderRadius: 4,
                  }}
                >
                  {canvasZoom}%
                </span>
              </div>

              {/* Unified Edit Tool dialog – text / shape / image; opens when element is selected */}
              {/* Positioned inside canvas area and constrained to move only within it */}
              <EditToolDialog
                open={editToolOpen && (isTextSelected || isShapeSelected || isImageSelected)}
                onClose={() => setEditToolOpen(false)}
                position={editToolPosition}
                onPositionChange={setEditToolPosition}
                elementType={isTextSelected ? "text" : isShapeSelected ? "shape" : isImageSelected ? "image" : null}
                fontOptions={fontOptions}
                textValues={{
                  text: textContent,
                  fontFamily: textFontFamily,
                  fontSize: textFontSize,
                  fill: textFill,
                  fontWeight: textBold ? "bold" : "normal",
                  fontStyle: textItalic ? "italic" : "normal",
                  textAlign,
                  lineHeight: textLineHeight,
                  charSpacing: textCharSpacing,
                  textTransform,
                  opacity: textOpacity,
                  textBackgroundColor,
                  stroke: textStroke,
                  strokeWidth: textStrokeWidth,
                  shadow: textShadow,
                  curvedText: textCurvedText,
                  curvedTextDirection: textCurvedTextDirection,
                  outline: textOutline,
                  underline: textUnderline,
                  overline: textOverline,
                  linethrough: textLinethrough,
                }}
                onTextChange={applyTextStyle}
                onAddText={addText}
                onAiEdit={undefined}
                shapeValues={{
                  fill: shapeFill,
                  stroke: shapeStroke,
                  strokeWidth: shapeStrokeWidth,
                  strokeDashArray: shapeStrokeDashArray,
                  rx: shapeRx,
                  ry: shapeRx,
                  opacity: shapeOpacity,
                  shadow: shapeShadow,
                  width: shapeWidth,
                  height: shapeHeight,
                  angle: shapeAngle,
                }}
                onShapeStyleChange={applyShapeStyle}
                onShapeTransformChange={(updates) => {
                  if (updates.flipH) { flipShapeH(); return }
                  if (updates.flipV) { flipShapeV(); return }
                  const { flipH, flipV, ...rest } = updates
                  applyShapeTransform(rest)
                }}
                shapeHasImage={isShapeWithImage}
                onMaskImageIntoShape={handleMaskImageIntoShape}
                imageValues={{
                  opacity: imageOpacity,
                  borderRadius: imageBorderRadius,
                  shadow: imageShadow,
                  angle: imageAngle,
                  aspectLock: imageAspectLock,
                }}
                onImageChange={applyImageStyle}
                onReplaceImage={replaceSelectedImage}
                onCropClick={() => {}}
                onApplyImageEffect={applyImageEffect}
                fabricImage={getSelectedImage()}
                useAbsolutePosition={true}
                bounds={{ minX: 0, minY: 0, maxX: 900, maxY: 600 }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Second container – all cards/list */}
      <div className="brandsListContainer paddingAll32">
        <div className="listHeader makeFlex spaceBetween end appendBottom24">
          <div className="leftSection">
            <h2 className="listTitle font30 fontBold blackText appendBottom16">
              PixelCraft Templates ({filteredTemplates.length})
            </h2>
            <StatusFilter
              statusFilter={statusFilter}
              onStatusChange={setStatusFilter}
              counts={calculateStandardStatusCounts(pixelcraftTemplates)}
              disabled={loading}
            />
          </div>
          <div className="rightSection makeFlex end gap10 alignCenter">
            <button
              type="button"
              className="btnSecondary"
              onClick={() => fetchTemplates()}
              disabled={loading}
            >
              🔄 Refresh
            </button>
            <SearchField
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search templates..."
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

        {filteredTemplates.length === 0 && !loading ? (
          <div className="emptyState textCenter paddingAll60">
            <div className="emptyIcon appendBottom16">🖼️</div>
            <h3 className="font22 fontSemiBold grayText appendBottom8">No PixelCraft Templates Found</h3>
            <p className="font16 grayText appendBottom16">Create a template above or save a draft from the editor.</p>
          </div>
        ) : (
          <>
            {viewMode === "card" && (
              <div className="brandsGrid">
                {displayedCards.map((t) => (
                  <EntityCard
                    key={t._id}
                    entity={t}
                    imageField="previewImage"
                    nameField="name"
                    idField="_id"
                    onEdit={() => openEdit(t._id)}
                    onDelete={() => removeTemplate(t._id)}
                    loading={loading}
                    imagePlaceholderColor={generateBrandColor(t._id, t.name)}
                    renderHeader={(template) => (
                      <EntityCardHeader
                        entity={template}
                        imageField="previewImage"
                        titleField="name"
                        dateField="createdAt"
                        generateColor={generateBrandColor}
                        onImageClick={template.previewImage ? (url) => setImagePopupUrl(url) : null}
                      />
                    )}
                    renderDetails={(template) => (
                      <>
                        <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                          <span className="detailLabel font14 fontSemiBold grayText textUppercase">Category:</span>
                          <span className="detailValue font14 blackText appendLeft6">{template.categoryName || "—"}</span>
                        </div>
                        <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                          <span className="detailLabel font14 fontSemiBold grayText textUppercase">Status:</span>
                          <span className="detailValue font14 blackText appendLeft6">{template.pixelcraftStatus || "draft"}</span>
                        </div>
                        <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                          <span className="detailLabel font14 fontSemiBold grayText textUppercase">Version:</span>
                          <span className="detailValue font14 blackText appendLeft6">{template.pixelcraftVersion ?? "—"}</span>
                        </div>
                      </>
                    )}
                    renderActions={(template) => (
                      <ActionButtons
                        onEdit={() => openEdit(template._id)}
                        onDelete={() => removeTemplate(template._id)}
                        loading={loading}
                        size="normal"
                        editText="✏️ Edit"
                        deleteText="🗑️ Delete"
                        editTitle="Edit template"
                        deleteTitle="Delete this template"
                      />
                    )}
                    className="brandCard"
                  />
                ))}
                {hasMoreCards && (
                  <div className="loadMoreContainer textCenter paddingAll20">
                    <button onClick={handleLoadMoreCards} className="btnPrimary" disabled={loading}>
                      {loading ? <span className="loadingSpinner">⏳</span> : <span>Load More</span>}
                    </button>
                  </div>
                )}
              </div>
            )}

            {viewMode === "list" && (
              <div className="brandsListTable">
                <div className="tableContainer">
                  <table className="brandsTable">
                    <thead>
                      <tr>
                        <th className="tableHeader">Preview</th>
                        <th className="tableHeader">Name</th>
                        <th className="tableHeader">Category</th>
                        <th className="tableHeader">Status</th>
                        <th className="tableHeader">Created</th>
                        <th className="tableHeader">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentTemplates.map((t) => (
                        <tr key={t._id} className="tableRow">
                          <td className="tableCell width5">
                            <div className="tableLogo">
                              {t.previewImage ? (
                                <img
                                  src={t.previewImage}
                                  alt={t.name}
                                  className="tableLogoImage"
                                  style={{ cursor: "pointer" }}
                                  onClick={() => setImagePopupUrl(t.previewImage)}
                                  role="button"
                                  tabIndex={0}
                                  onKeyDown={(e) => e.key === "Enter" && setImagePopupUrl(t.previewImage)}
                                />
                              ) : (
                                <div
                                  className="tableLogoPlaceholder"
                                  style={{ backgroundColor: generateBrandColor(t._id, t.name) }}
                                >
                                  {t.name ? t.name.charAt(0).toUpperCase() : "?"}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="tableCell width15 font14 blackText">{t.name}</td>
                          <td className="tableCell width15 font14 blackText">{t.categoryName || "—"}</td>
                          <td className="tableCell width10 font14 blackText">
                            <span className={`statusText ${t.pixelcraftStatus === "published" ? "active" : "inactive"}`}>
                              {t.pixelcraftStatus || "draft"}
                            </span>
                          </td>
                          <td className="tableCell width15 font14 grayText">
                            {t.createdAt ? new Date(t.createdAt).toLocaleDateString() : "—"}
                          </td>
                          <td className="tableCell width15">
                            <div className="tableActions makeFlex gap8">
                              <ActionButtons
                                onEdit={() => openEdit(t._id)}
                                onDelete={() => removeTemplate(t._id)}
                                loading={loading}
                                size="small"
                                editText="✏️"
                                deleteText="🗑️ Delete"
                                editTitle="Edit template"
                                deleteTitle="Delete this template"
                              />
                            </div>
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

      {/* Thumbnail image popup (card and list view) */}
      {imagePopupUrl && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Template preview"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 10020,
            background: "rgba(0,0,0,0.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
          onClick={() => setImagePopupUrl(null)}
        >
          <div
            style={{
              position: "relative",
              maxWidth: "90vw",
              maxHeight: "90vh",
              background: "#fff",
              borderRadius: 12,
              boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setImagePopupUrl(null)}
              style={{
                position: "absolute",
                top: 8,
                right: 8,
                zIndex: 1,
                width: 36,
                height: 36,
                borderRadius: "50%",
                border: "none",
                background: "rgba(0,0,0,0.5)",
                color: "#fff",
                fontSize: 20,
                cursor: "pointer",
                lineHeight: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              aria-label="Close"
            >
              ×
            </button>
            <img
              src={imagePopupUrl}
              alt="Template preview"
              style={{ display: "block", maxWidth: "90vw", maxHeight: "90vh", objectFit: "contain" }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

