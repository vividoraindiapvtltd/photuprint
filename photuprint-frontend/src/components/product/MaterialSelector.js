import React from "react"

/**
 * Material pills — used on customized PDP; keep neutral borders (Print/Colour styles unchanged elsewhere).
 */
export default function MaterialSelector({ materials = [], selectedId, onChange, label = "Material" }) {
  if (!materials.length) return null

  return (
    <div className="w-full min-w-0 max-w-full border-t border-gray-200 pt-5 mt-5 md:pt-6 md:mt-6">
      <p className="text-base font-bold text-gray-700 mb-3">{label}</p>
      <div className="flex flex-wrap gap-2 sm:gap-3 max-md:gap-y-2">
        {materials.map((m) => {
          const isSel = selectedId != null && String(selectedId) === String(m._id)
          return (
            <button
              key={m._id}
              type="button"
              onClick={() => onChange?.(m._id, m)}
              className={`min-h-[48px] px-3 py-2 rounded-lg border text-sm font-semibold transition-colors active:scale-[0.98] sm:min-h-0 ${
                isSel
                  ? "border-2 border-green-600 bg-white text-gray-700"
                  : "border border-gray-300 bg-white text-gray-700 hover:border-gray-400"
              }`}
            >
              {m.addonPrice != null && Number(m.addonPrice) > 0 ? `${m.name} (+₹${m.addonPrice})` : m.name}
            </button>
          )
        })}
      </div>
    </div>
  )
}
