"use client"

import React, { useEffect, useMemo, useState } from "react"

/**
 * @param {boolean} open
 * @param {() => void} onClose
 * @param {Array<{
 *   sizeLabel: string,
 *   chestIn?: number | null,
 *   chestCm?: number | null,
 *   frontIn?: number | null,
 *   frontCm?: number | null,
 *   sleeveIn?: number | null,
 *   sleeveCm?: number | null,
 * }>} rows
 */
export default function SizeGuideModal({ open, onClose, rows = [] }) {
  const [unit, setUnit] = useState("in") // "in" | "cm"

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  const fmt = (n) => {
    if (n == null || !Number.isFinite(Number(n))) return "—"
    const v = Number(n)
    return Number.isInteger(v) ? String(v) : String(Math.round(v * 1000) / 1000)
  }

  const headers = useMemo(() => {
    if (unit === "cm") {
      return ["Size", "Chest (Cm)", "Front Length (Cm)", "Sleeve Length (Cm)"]
    }
    return ["Size", "Chest (In Inch)", "Front Length (In Inch)", "Sleeve Length (In Inch)"]
  }, [unit])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="size-guide-title">
      <button type="button" className="absolute inset-0 bg-black/50" aria-label="Close" onClick={onClose} />
      <div className="relative max-h-[90vh] w-full overflow-y-auto rounded-t-2xl bg-white p-4 shadow-xl sm:max-w-2xl sm:rounded-2xl sm:p-6">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-gray-700 hover:bg-gray-100 sm:right-4 sm:top-4 sm:min-h-0 sm:min-w-0 sm:p-1"
          aria-label="Close"
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="pr-10 text-center">
          <h2 id="size-guide-title" className="text-lg font-bold uppercase tracking-wide text-gray-900">
            Size guide
          </h2>
          <div className="mx-auto mt-2 h-0.5 w-24 bg-teal-500" />
        </div>

        <div className="mt-6 flex justify-center px-2">
          <ShirtMeasureDiagram />
        </div>

        <div className="mt-6 flex justify-center">
          <div className="inline-flex overflow-hidden rounded-md border border-gray-900">
            <button
              type="button"
              onClick={() => setUnit("in")}
              className={`min-h-[44px] min-w-[4.5rem] px-4 py-2 text-sm font-semibold transition-colors sm:min-h-0 ${
                unit === "in" ? "bg-gray-900 text-white" : "bg-white text-gray-900 hover:bg-gray-50"
              }`}
            >
              In
            </button>
            <button
              type="button"
              onClick={() => setUnit("cm")}
              className={`min-h-[44px] min-w-[4.5rem] border-l border-gray-900 px-4 py-2 text-sm font-semibold transition-colors sm:min-h-0 ${
                unit === "cm" ? "bg-gray-900 text-white" : "bg-white text-gray-900 hover:bg-gray-50"
              }`}
            >
              Cms
            </button>
          </div>
        </div>

        <div className="mt-6 overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full min-w-[320px] border-collapse text-center text-sm">
            <thead>
              <tr className="bg-gray-100">
                {headers.map((h) => (
                  <th key={h} className="border-b border-gray-200 px-3 py-3 font-semibold text-gray-800">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-gray-500">
                    No size rows available.
                  </td>
                </tr>
              ) : (
                rows.map((row, i) => (
                  <tr key={`${row.sizeLabel}-${i}`} className="border-b border-gray-100 last:border-0">
                    <td className="px-3 py-2.5 font-medium text-gray-900">{row.sizeLabel}</td>
                    <td className="px-3 py-2.5 text-gray-800">{unit === "cm" ? fmt(row.chestCm) : fmt(row.chestIn)}</td>
                    <td className="px-3 py-2.5 text-gray-800">{unit === "cm" ? fmt(row.frontCm) : fmt(row.frontIn)}</td>
                    <td className="px-3 py-2.5 text-gray-800">{unit === "cm" ? fmt(row.sleeveCm) : fmt(row.sleeveIn)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-center text-xs text-gray-500">Measurements are approximate. Add values in Admin → Size Management.</p>
      </div>
    </div>
  )
}

/** Simple shirt line diagram with teal measurement hints (decorative). */
function ShirtMeasureDiagram() {
  return (
    <svg viewBox="0 0 200 220" className="h-48 w-auto max-w-full text-teal-600" aria-hidden>
      <rect x="1" y="1" width="198" height="218" fill="none" stroke="#e5e7eb" strokeWidth="1" rx="4" />
      {/* Shirt outline */}
      <path
        d="M70 45 L100 25 L130 45 L145 50 L155 65 L155 195 L45 195 L45 65 L55 50 Z"
        fill="none"
        stroke="#111827"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Collar */}
      <ellipse cx="100" cy="38" rx="14" ry="8" fill="none" stroke="currentColor" strokeWidth="1.2" />
      {/* Across shoulder */}
      <line x1="58" y1="52" x2="142" y2="52" stroke="currentColor" strokeWidth="1" />
      <polygon points="58,52 62,48 62,56" fill="currentColor" />
      <polygon points="142,52 138,48 138,56" fill="currentColor" />
      {/* Chest */}
      <ellipse cx="100" cy="95" rx="38" ry="14" fill="none" stroke="currentColor" strokeWidth="1" />
      {/* Length */}
      <line x1="158" y1="55" x2="158" y2="190" stroke="currentColor" strokeWidth="1" />
      <polygon points="158,55 154,59 162,59" fill="currentColor" />
      <polygon points="158,190 154,186 162,186" fill="currentColor" />
    </svg>
  )
}
