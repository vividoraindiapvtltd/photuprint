"use client"

import { useState, useEffect } from "react"
import api from "../src/utils/api"

const STORAGE_KEY = "pp_subscribe_overlay_dismissed"
const SHOW_DELAY_MS = 1800

// Icons as inline SVG for offers, discount, early access
const IconOffer = () => (
  <svg className="w-5 h-5 text-amber-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
  </svg>
)
const IconDiscount = () => (
  <svg className="w-5 h-5 text-emerald-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
  </svg>
)
const IconEarlyAccess = () => (
  <svg className="w-5 h-5 text-indigo-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
)

export default function SubscribeOverlay() {
  const [visible, setVisible] = useState(false)
  const [email, setEmail] = useState("")
  const [status, setStatus] = useState("idle") // idle | loading | success | error
  const [message, setMessage] = useState("")

  useEffect(() => {
    if (typeof window === "undefined") return
    const dismissed = sessionStorage.getItem(STORAGE_KEY)
    if (dismissed === "1") return
    // No auto popup on small viewports (mobile-first; avoids intrusive overlays)
    if (!window.matchMedia("(min-width: 768px)").matches) return
    const t = setTimeout(() => setVisible(true), SHOW_DELAY_MS)
    return () => clearTimeout(t)
  }, [])

  const close = () => {
    setVisible(false)
    if (typeof window !== "undefined") sessionStorage.setItem(STORAGE_KEY, "1")
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setStatus("loading")
    setMessage("")
    try {
      const { data } = await api.post("/newsletter/subscribe", { email }, { skipAuth: true })
      setStatus("success")
      setEmail("")
      setMessage(data?.msg ?? data?.message ?? "Thank you for subscribing! Check your inbox.")
      if (typeof window !== "undefined") sessionStorage.setItem(STORAGE_KEY, "1")
      setTimeout(close, 2200)
    } catch (err) {
      setStatus("error")
      setMessage(err.response?.data?.msg ?? err.response?.data?.message ?? "Something went wrong. Please try again.")
    }
  }

  if (!visible) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4"
      aria-modal="true"
      role="dialog"
    >
      {/* Backdrop */}
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-pp-backdrop-in"
        onClick={close}
        aria-label="Close overlay"
      />

      {/* Card — bottom sheet on narrow screens, centered modal on sm+ */}
      <div className="relative w-full max-w-md rounded-t-2xl border border-gray-200 border-b-0 bg-white shadow-xl sm:rounded-2xl sm:border-b overflow-hidden max-h-[min(92vh,640px)] sm:max-h-none flex flex-col">
        <button
          type="button"
          onClick={close}
          className="absolute top-3 right-3 p-1.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          aria-label="Close"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="p-6 sm:p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-1">Stay in the loop</h2>
          <p className="text-gray-600 text-sm mb-5">Get the best of PhotuPrint delivered to your inbox.</p>

          <ul className="space-y-2.5 mb-6">
            <li className="flex items-center gap-3 text-sm text-gray-700">
              <IconOffer />
              <span>Exclusive offers and member-only deals</span>
            </li>
            <li className="flex items-center gap-3 text-sm text-gray-700">
              <IconDiscount />
              <span>Special discounts and seasonal sales</span>
            </li>
            <li className="flex items-center gap-3 text-sm text-gray-700">
              <IconEarlyAccess />
              <span>First access to new collections and launches</span>
            </li>
          </ul>

          <p className="text-sm font-medium text-gray-800 mb-3">Subscribe now — it&apos;s free.</p>

          {status === "success" ? (
            <p className="text-sm text-green-600 font-medium py-2">{message}</p>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
                disabled={status === "loading"}
                className="flex-1 min-w-0 rounded-lg border border-gray-300 px-3 py-2.5 text-sm placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              <button
                type="submit"
                disabled={status === "loading"}
                className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60 transition-colors shrink-0"
              >
                {status === "loading" ? "Subscribing…" : "Subscribe"}
              </button>
            </form>
          )}

          {status === "error" && message && (
            <p className="mt-2 text-sm text-red-600" role="alert">{message}</p>
          )}

          <button
            type="button"
            onClick={close}
            className="mt-4 text-xs text-gray-500 hover:text-gray-700"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  )
}
