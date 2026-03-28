"use client"

import { useEffect, useLayoutEffect, useRef, useState, useCallback } from "react"
import { Canvas, getEnv, setEnv } from "fabric"
import { getImageSrc } from "../utils/imageUrl"

const PLACEHOLDER_IMAGE_DATAURL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

/** Browsers may return null from getContext("2d") if dimensions are invalid or too large — Fabric then crashes on clearRect. */
const MAX_FABRIC_CANVAS_SIDE = 4096

function parseFabricCanvasSize(value, fallback) {
  const n = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(n) || n <= 0) return fallback
  return Math.min(MAX_FABRIC_CANVAS_SIDE, Math.max(1, Math.round(n)))
}

/**
 * Resolve image URLs in fabric JSON for cross-origin loading.
 * Replaces blob: URLs with placeholder, resolves /uploads and relative paths.
 */
function resolveImageUrlsInFabricJson(json, resolveUrl) {
  if (!json) return json
  const out = Array.isArray(json) ? [...json] : { ...json }
  if (out.objects && Array.isArray(out.objects)) {
    out.objects = out.objects.map((obj) => {
      const o = typeof obj === "object" && obj !== null ? { ...obj } : obj
      if (o && typeof o === "object" && o.src) {
        const src = String(o.src)
        if (src.startsWith("blob:")) {
          o.src = PLACEHOLDER_IMAGE_DATAURL
        } else if (!src.startsWith("data:") && !src.startsWith("http")) {
          o.src = resolveUrl(src) || src
        }
      }
      if (o && o.objects && Array.isArray(o.objects)) {
        o.objects = o.objects.map((child) =>
          resolveImageUrlsInFabricJson({ objects: [child] }, resolveUrl).objects[0]
        )
      }
      return o
    })
  }
  return out
}

/**
 * PixelCraftEditor - Customer-facing editor for PixelCraft templates.
 * Loads pixelcraftDocument.fabricJson and allows editing (move, resize, text).
 * Exports design as PNG data URL for onSave.
 */
export default function PixelCraftEditor({ template, onSave, constrained = false, simplified = false }) {
  const containerRef = useRef(null)
  const canvasRef = useRef(null)
  const fabricRef = useRef(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")

  const resolveUrl = useCallback((url) => {
    if (!url || typeof url !== "string") return null
    return getImageSrc(url) || url
  }, [])

  /**
   * Synchronous cleanup via useLayoutEffect.
   * React calls useLayoutEffect cleanup BEFORE removing DOM nodes during unmount.
   * This is critical because Fabric.js wraps the canvas in a container div,
   * modifying the DOM tree. If we don't dispose Fabric before React tries to
   * reconcile the DOM, React encounters unexpected nodes and throws removeChild errors.
   */
  useLayoutEffect(() => {
    return () => {
      const c = fabricRef.current
      if (c) {
        try {
          if (c.discardActiveObject) c.discardActiveObject()
          c.dispose()
        } catch (e) {
          // Ignore - canvas may already be disposed
        }
        fabricRef.current = null
      }
      if (containerRef.current) {
        containerRef.current.innerHTML = ""
      }
    }
  }, [])

  useEffect(() => {
    if (!template?.pixelcraftDocument?.fabricJson || !containerRef.current) return

    let cancelled = false

    const init = async () => {
      if (cancelled) return

      const doc = template.pixelcraftDocument
      const canvasSpec = doc?.canvas || {}
      const width = parseFabricCanvasSize(canvasSpec.width, 600)
      const height = parseFabricCanvasSize(canvasSpec.height, 400)

      if (typeof window !== "undefined" && typeof document !== "undefined") {
        try {
          setEnv({ ...getEnv(), window, document })
        } catch (_) {
          /* ignore */
        }
      }

      const fabricJson =
        typeof doc.fabricJson === "string" ? JSON.parse(doc.fabricJson) : doc.fabricJson
      const resolvedJson = resolveImageUrlsInFabricJson(fabricJson, resolveUrl)

      // Dispose any previous Fabric instance before creating a new one
      const prev = fabricRef.current
      if (prev) {
        try {
          prev.discardActiveObject?.()
          prev.dispose()
        } catch (_) {}
        fabricRef.current = null
      }

      if (!containerRef.current || cancelled) return

      const canvasEl = document.createElement("canvas")
      canvasEl.width = width
      canvasEl.height = height
      containerRef.current.innerHTML = ""
      containerRef.current.appendChild(canvasEl)

      if (!canvasEl.getContext("2d")) {
        console.error("PixelCraftEditor: Canvas 2d context unavailable (check template dimensions)")
        setError("Failed to load template design")
        setIsLoading(false)
        return
      }

      let c
      try {
        c = new Canvas(canvasEl, {
          width,
          height,
          selection: true,
          preserveObjectStacking: true,
        })
      } catch (fabricErr) {
        console.error("PixelCraftEditor: Fabric Canvas init failed:", fabricErr)
        setError("Failed to load template design")
        setIsLoading(false)
        return
      }
      fabricRef.current = c

      try {
        await c.loadFromJSON(resolvedJson)
        if (cancelled) {
          c.dispose()
          fabricRef.current = null
          return
        }
        c.requestRenderAll()
        setIsLoading(false)
      } catch (err) {
        console.error("PixelCraftEditor: Failed to load fabric JSON:", err)
        setError("Failed to load template design")
        setIsLoading(false)
      }
    }

    init()

    return () => {
      cancelled = true
    }
  }, [template?._id, template?.pixelcraftDocument, resolveUrl])

  const handleSave = useCallback(() => {
    const c = fabricRef.current
    if (!c || !onSave) return

    const dataUrl = c.toDataURL({
      format: "png",
      quality: 1,
      multiplier: 2,
    })
    onSave({
      image: dataUrl,
      template,
      pixelcraft: true,
    })
  }, [template, onSave])

  if (!template) {
    return (
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
        <p className="text-yellow-800 text-sm">No template selected.</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-md">
        <p className="text-red-800 text-sm">{error}</p>
      </div>
    )
  }

  return (
    <div className={constrained ? "h-full flex flex-col" : "space-y-4"}>
      {!constrained && (
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800">Edit: {template.name}</h3>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
          >
            Save Design
          </button>
        </div>
      )}
      <div className={`relative ${constrained ? "flex-1 min-h-0 flex items-center justify-center overflow-auto" : ""} ${isLoading ? "min-h-[200px]" : ""}`}>
        <div
          ref={containerRef}
          className={`relative bg-gray-100 ${constrained ? "w-full h-full flex items-center justify-center" : "rounded-lg border-2 border-gray-300"}`}
        />
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
            <div className="flex flex-col items-center space-y-2">
              <svg
                className="animate-spin h-8 w-8 text-blue-500"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span className="text-sm text-gray-500">Loading template...</span>
            </div>
          </div>
        )}
      </div>
      {constrained && (
        <button
          onClick={handleSave}
          className="mt-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm w-full"
        >
          Save Design
        </button>
      )}
    </div>
  )
}
