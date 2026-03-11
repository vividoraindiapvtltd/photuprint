"use client"

import { useEffect, useState, useRef } from "react"
import Image from "next/image"
import { getImageSrc } from "../../utils/imageUrl"

const THUMB_GAP = 8

function resolveUrl(url) {
  return getImageSrc(url) || ""
}

export default function ProductImageCarousel({ images = [], alt = "Product", badgeText, className = "" }) {
  const thumbRef = useRef(null)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [canThumbUp, setCanThumbUp] = useState(false)
  const [canThumbDown, setCanThumbDown] = useState(false)

  const list = Array.isArray(images) && images.length > 0 ? images : []
  const hasMultiple = list.length > 1

  const updateThumbButtons = () => {
    const el = thumbRef.current
    if (!el) return
    const { scrollTop, scrollHeight, clientHeight } = el
    setCanThumbUp(scrollTop > 2)
    setCanThumbDown(scrollTop + clientHeight < scrollHeight - 2)
  }

  useEffect(() => {
    const el = thumbRef.current
    if (!el) return
    updateThumbButtons()
    el.addEventListener("scroll", updateThumbButtons, { passive: true })
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(updateThumbButtons) : null
    if (ro) ro.observe(el)
    return () => {
      el.removeEventListener("scroll", updateThumbButtons)
      if (ro) ro.disconnect()
    }
  }, [list.length])

  // Keep selected index in range
  useEffect(() => {
    if (selectedIndex >= list.length) setSelectedIndex(Math.max(0, list.length - 1))
  }, [list.length, selectedIndex])

  // Scroll active thumbnail into view in vertical strip
  useEffect(() => {
    const el = thumbRef.current
    if (!el || !hasMultiple) return
    const thumb = el.querySelector(`[data-thumb-index="${selectedIndex}"]`)
    if (thumb) thumb.scrollIntoView({ block: "nearest", behavior: "smooth" })
  }, [selectedIndex, hasMultiple])

  const goMain = (delta) => {
    const next = selectedIndex + delta
    if (next >= 0 && next < list.length) setSelectedIndex(next)
  }

  const scrollThumb = (dir) => {
    const el = thumbRef.current
    if (!el) return
    const thumbHeight = el.firstElementChild?.offsetHeight ?? 80
    const step = (thumbHeight + THUMB_GAP) * 1
    el.scrollBy({ top: dir * step, behavior: "smooth" })
  }

  if (list.length === 0) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 rounded-lg aspect-square ${className}`}>
        <div className="text-gray-400 text-center">
          <svg className="w-16 h-16 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-sm">No image available</p>
        </div>
      </div>
    )
  }

  const mainSrc = resolveUrl(list[selectedIndex])

  return (
    <div className={`flex gap-3 h-full min-h-0 ${className}`}>
      {/* Left: vertical thumbnail strip with up/down arrows */}
      {hasMultiple && (
        <div className="flex flex-col flex-shrink-0 w-[20%] max-w-[100px] min-w-[72px]">
          <button type="button" onClick={() => scrollThumb(-1)} disabled={!canThumbUp} className="flex-shrink-0 w-8 h-8 mx-auto rounded-full bg-white border border-gray-200 shadow flex items-center justify-center text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed" aria-label="Previous thumbnails">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          </button>
          <div ref={thumbRef} className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col gap-[8px] py-1 scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {list.map((src, idx) => {
              const isActive = idx === selectedIndex
              return (
                <button key={`${idx}-${resolveUrl(src)}`} type="button" data-thumb-index={idx} onClick={() => setSelectedIndex(idx)} className={`relative flex-shrink-0 w-full aspect-square rounded-lg overflow-hidden border-2 transition-all ${isActive ? "border-gray-800 ring-2 ring-gray-400 shadow-md" : "border-gray-200 hover:border-gray-400"}`} aria-label={`View image ${idx + 1}`}>
                  <Image src={resolveUrl(src)} alt="" fill sizes="100px" className="object-cover" loading={idx < 4 ? "eager" : "lazy"} />
                </button>
              )
            })}
          </div>
          <button type="button" onClick={() => scrollThumb(1)} disabled={!canThumbDown} className="flex-shrink-0 w-8 h-8 mx-auto rounded-full bg-white border border-gray-200 shadow flex items-center justify-center text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed" aria-label="Next thumbnails">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      )}

      {/* Right: main image with left/right arrows and optional badge */}
      <div className="relative flex-1 min-w-0 bg-gray-50 rounded-lg overflow-hidden flex items-center justify-center">
        {badgeText && <div className="absolute top-3 left-3 z-10 px-2.5 py-1 rounded-md bg-gray-900/80 text-white text-xs font-medium uppercase tracking-wide">{badgeText}</div>}
        {hasMultiple && (
          <>
            <button type="button" onClick={() => goMain(-1)} className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white/90 border border-gray-200 shadow flex items-center justify-center text-gray-700 hover:bg-white" aria-label="Previous image">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button type="button" onClick={() => goMain(1)} className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white/90 border border-gray-200 shadow flex items-center justify-center text-gray-700 hover:bg-white" aria-label="Next image">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </>
        )}
        <Image src={mainSrc} alt={alt} fill className="object-contain" sizes="(max-width: 768px) 100vw, 50vw" priority={list.length > 0} data-main-image />
      </div>
    </div>
  )
}
