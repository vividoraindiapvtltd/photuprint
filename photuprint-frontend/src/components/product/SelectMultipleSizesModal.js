"use client"

import React, { useEffect, useMemo } from "react"

/**
 * @param {boolean} open
 * @param {() => void} onClose
 * @param {Array<{ id: string, label: string, maxQty: number | null }>} rows — only in-stock / sellable sizes
 * @param {Record<string, number>} quantities — controlled draft quantities per size id
 * @param {(next: Record<string, number>) => void} onQuantitiesChange
 * @param {(quantities: Record<string, number>) => void} onProceed — non-zero qty per size id
 * @param {string} [footerNote]
 */
export default function SelectMultipleSizesModal({
  open,
  onClose,
  rows = [],
  quantities = {},
  onQuantitiesChange,
  onProceed,
  footerNote,
}) {
  const totalQty = useMemo(() => {
    let t = 0
    for (const r of rows) {
      const n = Number(quantities[r.id])
      if (Number.isFinite(n) && n > 0) t += n
    }
    return t
  }, [quantities, rows])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  if (!open) return null

  const setRowQty = (id, raw) => {
    if (typeof onQuantitiesChange !== "function") return
    onQuantitiesChange((prev) => {
      const base = { ...(prev || {}) }
      if (raw === "") {
        return { ...base, [id]: 0 }
      }
      let n = parseInt(String(raw), 10)
      if (!Number.isFinite(n) || n < 0) n = 0
      const row = rows.find((r) => r.id === id)
      if (row?.maxQty != null) n = Math.min(n, row.maxQty)
      return { ...base, [id]: n }
    })
  }

  const handleProceed = () => {
    const out = {}
    for (const r of rows) {
      const n = Number(quantities[r.id])
      if (!Number.isFinite(n) || n <= 0) continue
      const cap = r.maxQty
      const q = cap != null ? Math.min(n, cap) : n
      if (q > 0) out[r.id] = q
    }
    if (Object.keys(out).length === 0) return
    const ok = onProceed?.(out)
    if (ok === false) return
    onClose?.()
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="multi-size-modal-title">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative max-h-[90vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:max-w-md sm:rounded-2xl sm:p-6">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-800 sm:right-4 sm:top-4 sm:min-h-0 sm:min-w-0 sm:p-1"
          aria-label="Close"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <h2 id="multi-size-modal-title" className="pr-10 text-lg font-bold text-gray-900">
          Select sizes
        </h2>

        <div className="mt-6 border-t border-gray-200">
          <div className="grid grid-cols-[1fr_auto] gap-x-4 border-b border-gray-200 py-2 text-xs font-medium uppercase tracking-wide text-gray-500">
            <span>Size</span>
            <span className="text-right">Quantity</span>
          </div>
          {rows.map((r) => {
            const q = quantities[r.id]
            const display = q == null || q === 0 ? "" : String(q)
            return (
              <div key={r.id} className="grid grid-cols-[1fr_auto] gap-x-4 items-center border-b border-gray-100 py-3">
                <span className="text-sm font-medium text-gray-900">{r.label}</span>
                <input
                  type="number"
                  min={0}
                  max={r.maxQty != null ? r.maxQty : undefined}
                  inputMode="numeric"
                  value={display}
                  onChange={(e) => setRowQty(r.id, e.target.value)}
                  className="w-20 min-h-[44px] rounded-md border border-gray-200 bg-white px-2 py-2 text-right text-sm text-gray-900 shadow-inner focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 sm:min-h-0 sm:py-1.5"
                />
              </div>
            )
          })}
        </div>

        <div className="mt-6 flex flex-col items-center gap-3">
          <button
            type="button"
            disabled={totalQty <= 0}
            onClick={handleProceed}
            className="min-h-[48px] min-w-[10rem] w-full rounded-lg px-6 py-3 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500 transition-colors disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-blue-600 sm:min-h-0 sm:w-auto sm:py-2.5"
          >
            Proceed
          </button>
          {footerNote ? <p className="w-full text-left text-xs text-gray-600">{footerNote}</p> : null}
        </div>
      </div>
    </div>
  )
}
