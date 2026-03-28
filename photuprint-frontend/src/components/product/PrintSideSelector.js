import React from "react"

/**
 * @param {Array<{ _id: string, name: string, addonPrice: number }>} options
 * @param {string[]} selectedIds — selected print-side ids (multi-select)
 * @param {string[]} [lockedIds] — ids that cannot be deselected when selected (e.g. Front Side)
 * @param {(id: string, option: object) => void} onToggle — toggle id in selection
 * @param {"default" | "customization"} [variant] — customization uses softer gray text (not near-black)
 */
export default function PrintSideSelector({
  options = [],
  selectedIds = [],
  lockedIds = [],
  onToggle,
  variant = "default",
}) {
  if (!options.length) return null

  const customization = variant === "customization"
  const labelText = customization ? "text-gray-700" : "text-gray-900"
  const chipText = customization ? "text-gray-700" : "text-gray-900"

  const selectedSet = new Set((selectedIds || []).map((id) => String(id)))
  const lockedSet = new Set((lockedIds || []).map((id) => String(id)))
  const hasLocked = lockedSet.size > 0

  return (
    <div className="w-full min-w-0 max-w-full border-t border-gray-200 pt-5 mt-5 md:pt-6 md:mt-6">
      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <span className={`text-base font-bold ${labelText}`}>Print Sides</span>
        <span className="text-xs font-medium text-gray-500">
          {hasLocked ? "Add more sides · Front is always included" : "Select one or more"}
        </span>
      </div>
      <div className="flex flex-wrap gap-2 sm:gap-3 max-md:gap-y-2.5">
        {options.map((o) => {
          const id = o._id
          const selected = selectedSet.has(String(id))
          const locked = lockedSet.has(String(id)) && selected
          const addon = o.addonPrice > 0 ? `+₹${o.addonPrice.toLocaleString("en-IN")}` : "Included"
          const borderClass = !selected
            ? "border-gray-300 hover:border-gray-500"
            : "border-green-600"
          return (
            <button
              key={id}
              type="button"
              onClick={() => onToggle?.(id, o)}
              aria-pressed={selected}
              title={locked ? "Always included — cannot be deselected" : undefined}
              className={`min-h-[48px] min-w-[5rem] px-3 py-2.5 rounded-lg border-2 text-sm font-semibold transition-colors bg-white active:scale-[0.98] sm:min-h-0 ${chipText} ${borderClass} ${locked ? "cursor-default" : ""}`}
            >
              <span className="block text-xs font-normal text-gray-500 mb-0.5">{addon}</span>
              {o.name}
            </button>
          )
        })}
      </div>
    </div>
  )
}
