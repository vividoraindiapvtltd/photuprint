import React from "react"

/**
 * @param {Array<{ _id: string, name: string }>} sizes
 * @param {Array<{ available: boolean, left: number | null }>} stockByIndex — per-size availability from parent
 * @param {"default" | "customization"} variant — customization: same chip styles as default (layout differs: shrink-0, px-2)
 */
export default function SizeSelector({
  sizes = [],
  stockByIndex = [],
  selectedId,
  onChange,
  onSizeGuideClick,
  onNotifyClick,
  showMultipleSizesLink = false,
  onOpenMultipleSizes,
  /** Sizes with qty &gt; 0 in multi-size draft — blue border (customized + default). */
  multiSizeQuantities = null,
  variant = "default",
}) {
  if (!sizes.length) return null

  const customization = variant === "customization"

  /** Single row: horizontal scroll when the ladder does not fit (XXS–7XL). Parent must have min-w-0 so overflow-x-auto gets a bounded width. */
  const chipsClass =
    "flex w-full max-w-full min-w-0 flex-nowrap gap-2 overflow-x-auto overflow-y-visible overscroll-x-contain pb-1 pt-0.5 [-webkit-overflow-scrolling:touch] touch-pan-x snap-x snap-mandatory [scrollbar-width:thin] justify-start"

  return (
    <div className="w-full min-w-0 max-w-full border-t border-gray-200 pt-5 mt-5 md:pt-6 md:mt-6">
      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <span className={`text-base font-bold ${customization ? "text-gray-700" : "text-gray-900"}`}>Select Size</span>
        <button
          type="button"
          onClick={onSizeGuideClick}
          className="min-h-[44px] shrink-0 self-start px-1 py-2 text-sm font-medium text-blue-600 hover:text-blue-800 sm:min-h-0 sm:p-0 sm:pt-0.5 sm:font-normal"
        >
          Size guide &gt;
        </button>
      </div>
      <div className={chipsClass} role="region" aria-label="Size options">
        {sizes.map((s, i) => {
          const id = s._id ?? s.id
          const stock = stockByIndex[i] || { available: true, left: null }
          const noCatalogSize = id == null || id === ""
          const unavailable = stock.available === false || noCatalogSize
          const selected =
            selectedId != null &&
            id != null &&
            id !== "" &&
            String(selectedId) === String(id)
          const label = s.name || s.initial || "—"
          const multiQty =
            multiSizeQuantities && id != null && id !== ""
              ? Math.max(0, Number(multiSizeQuantities[String(id)]) || 0)
              : 0
          const hasMultiQty = multiQty > 0
          const btnClass = unavailable
            ? customization
              ? "h-11 min-w-[2.75rem] shrink-0 rounded-md border border-gray-200 bg-white text-gray-400 cursor-not-allowed px-2"
              : "h-11 min-w-[2.75rem] rounded-md border border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed px-2.5"
            : hasMultiQty
              ? customization
                ? "inline-flex h-11 min-w-[2.75rem] shrink-0 items-center justify-center rounded-md border-2 border-blue-600 bg-white text-gray-900 px-2 text-sm font-semibold transition-colors"
                : "inline-flex h-11 min-w-[2.75rem] items-center justify-center rounded-md border-2 border-blue-600 bg-white text-gray-900 px-2.5 text-sm font-semibold transition-colors"
              : selected
                ? customization
                  ? "inline-flex h-11 min-w-[2.75rem] shrink-0 items-center justify-center rounded-md border-2 border-green-600 bg-white text-gray-900 px-2 text-sm font-semibold transition-colors"
                  : "inline-flex h-11 min-w-[2.75rem] items-center justify-center rounded-md border-2 border-green-600 bg-white text-gray-900 px-2.5 text-sm font-semibold transition-colors"
                : customization
                  ? "inline-flex h-11 min-w-[2.75rem] shrink-0 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-900 hover:border-gray-400 px-2 text-sm font-semibold transition-colors"
                  : "inline-flex h-11 min-w-[2.75rem] items-center justify-center rounded-md border border-gray-300 bg-white text-gray-900 hover:border-gray-400 px-2.5 text-sm font-semibold transition-colors"

          return (
            <div
              key={id != null && id !== "" ? String(id) : `size-slot-${i}`}
              className="flex shrink-0 snap-start flex-col items-center gap-1"
            >
              <button
                type="button"
                disabled={unavailable}
                onClick={() => !unavailable && onChange?.(id, s)}
                className={`inline-flex items-center justify-center text-sm font-semibold transition-colors ${btnClass}`}
              >
                <span className={unavailable ? "line-through" : ""}>{label}</span>
              </button>
              {!unavailable && hasMultiQty ? (
                <span className="text-xs font-medium text-blue-600">×{multiQty}</span>
              ) : !unavailable && stock.left != null && stock.left > 0 && stock.left <= 5 ? (
                <span className="text-xs font-medium text-red-600">{stock.left} left</span>
              ) : null}
            </div>
          )
        })}
      </div>
      {customization && showMultipleSizesLink && typeof onOpenMultipleSizes === "function" ? (
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onOpenMultipleSizes}
            className="text-sm font-normal text-blue-600 underline underline-offset-2 hover:text-blue-800"
          >
            Select Multiple Sizes
          </button>
        </div>
      ) : null}
      {!customization && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm text-gray-600">
          <p className="m-0">
            Size not available?{" "}
            <button
              type="button"
              onClick={onNotifyClick}
              className="text-blue-600 font-medium hover:text-blue-800 inline-flex items-center gap-1"
            >
              Notify me
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                />
              </svg>
            </button>
          </p>
          {showMultipleSizesLink && typeof onOpenMultipleSizes === "function" ? (
            <button
              type="button"
              onClick={onOpenMultipleSizes}
              className="shrink-0 text-sm font-normal text-blue-600 underline underline-offset-2 hover:text-blue-800"
            >
              Select Multiple Sizes
            </button>
          ) : null}
        </div>
      )}
    </div>
  )
}
