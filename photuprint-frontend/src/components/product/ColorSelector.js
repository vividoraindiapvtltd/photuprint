// frontend/src/components/product/ColorSelector.jsx
import React from "react"

/**
 * Props:
 * - variants: [{_id, name, code, image}]
 * - selectedId
 * - onChange(id, variant)
 */
export default function ColorSelector({ variants = [], selectedId, onChange }) {
  if (!variants.length) return null

  return (
    <div>
      <div className="text-base font-semibold mb-2">Color</div>
      <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-8 gap-4">
        {variants.map((v) => {
          const selected = v._id === selectedId
          return (
            <button
              key={v._id}
              type="button"
              onClick={() => onChange?.(v._id, v)}
              className={`rounded-lg p-1 border transition focus:outline-none ${
                selected ? "ring-2 ring-blue-500" : "hover:shadow"
              }`}
              title={v.name}
            >
              <div className="aspect-square w-20 sm:w-24 overflow-hidden rounded-md bg-gray-50">
                {v.image ? (
                  <img src={v.image} alt={v.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">{v.name}</div>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
