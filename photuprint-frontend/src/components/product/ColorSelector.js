import React, { useState } from "react"
import { getImageSrc } from "../../utils/imageUrl"

function looksLikeCssColor(code) {
  if (!code || typeof code !== "string") return false
  const t = code.trim()
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(t) || /^[0-9a-fA-F]{6}$/i.test(t)
}

function normalizeColorCode(code) {
  const t = String(code).trim()
  if (t.startsWith("#")) return t
  if (/^[0-9a-fA-F]{6}$/i.test(t)) return `#${t}`
  return t
}

/**
 * Colour row — thin border on selected, white circle + checkmark (reference PDP layout).
 * Props:
 * - variants: [{_id, name, code, image}]
 * - selectedId
 * - onChange(id, variant)
 * - variant: "default" | "customization" — customization: circular swatches use 1px gray border; rectangular image swatches stay borderless until selected
 */
function labelForVariant(v) {
  if (!v) return "—"
  return v.isVariation
    ? String(v.swatchLabel ?? "").trim() || "—"
    : v.name || "—"
}

export default function ColorSelector({ variants = [], selectedId, onChange, variant = "default" }) {
  const [hoveredId, setHoveredId] = useState(null)
  const selected = variants.find((v) => String(v._id) === String(selectedId))
  const hovered =
    hoveredId != null ? variants.find((v) => String(v._id) === String(hoveredId)) ?? null : null
  /** Hover previews name; otherwise selected. Variations use swatchLabel. */
  const labelName = labelForVariant(hovered ?? selected)
  const customization = variant === "customization"

  if (variants.length === 0) return null

  return (
    <div className="w-full min-w-0 max-w-full border-t border-gray-200 pt-5 mt-5 first:border-t-0 first:pt-0 first:mt-0 md:pt-6 md:mt-6">
      <p
        className={`text-base font-bold mb-3 ${customization ? "text-gray-700" : "text-gray-900"}`}
      >
        Colour: <span className="font-bold">{labelName}</span>
      </p>
      <div className="-mx-1 flex min-w-0 max-w-full gap-3 overflow-x-auto overscroll-x-contain px-1 pb-1 [scrollbar-width:thin] touch-pan-x snap-x snap-mandatory [-webkit-overflow-scrolling:touch]">
        {variants.map((v) => {
          const isSelected = String(v._id) === String(selectedId)
          const hasImage = v.image != null && String(v.image).trim() !== ""
          /** Hex/code swatches stay 50×50 circles even if CMS also stores a swatch image (e.g. white). */
          const useRectImage = hasImage && !looksLikeCssColor(v.code)
          /** Rectangular image swatches: customization keeps unselected borderless. */
          const imageThumbBorder = customization
            ? isSelected
              ? "border border-green-600"
              : "border-0"
            : isSelected
              ? "border-2 border-green-600"
              : "border border-gray-200"
          /** Circular swatches: customized PDP uses 1px gray on all circles; green when selected. */
          const solidThumbBorder = customization
            ? isSelected
              ? "border border-green-600"
              : "border border-gray-200"
            : isSelected
              ? "border-2 border-green-600"
              : "border border-gray-200"
          const imageThumbClass = `rounded-lg overflow-hidden bg-gray-50 w-[4.25rem] aspect-[3/4] sm:w-[5rem] ${imageThumbBorder}`
          const solidThumbClass = `rounded-full overflow-hidden bg-gray-50 w-[50px] h-[50px] shrink-0 ${solidThumbBorder}`
          return (
            <button
              key={v._id}
              type="button"
              onClick={() => onChange?.(v._id, v)}
              onMouseEnter={() => setHoveredId(String(v._id))}
              onMouseLeave={() => setHoveredId(null)}
              title={v.name}
              className={`relative shrink-0 snap-start focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2 ${
                useRectImage ? "rounded-lg" : "rounded-full"
              }`}
            >
              <div className={useRectImage ? imageThumbClass : solidThumbClass}>
                {useRectImage ? (
                  <img
                    src={getImageSrc(v.image) || v.image}
                    alt={v.name || ""}
                    className="w-full h-full object-cover"
                  />
                ) : looksLikeCssColor(v.code) ? (
                  <div
                    className="w-full h-full"
                    style={{ backgroundColor: normalizeColorCode(v.code) }}
                    title={v.name}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-500 px-1 text-center leading-tight">
                    {v.name}
                  </div>
                )}
              </div>
              {isSelected && (
                <span
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center pointer-events-none"
                  aria-hidden
                >
                  <svg className="h-2.5 w-2.5 shrink-0 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
