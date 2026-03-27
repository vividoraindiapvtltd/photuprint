"use client"

import { useEffect, useState, useRef } from "react"
import Image from "next/image"
import { getImageSrc } from "../../utils/imageUrl"

const THUMB_GAP = 8

function resolveUrl(url) {
  return getImageSrc(url) || ""
}

export default function ProductImageCarousel({ images = [], alt = "Product", badgeText, className = "" }) {
  const thumbRefVertical = useRef(null)
  const thumbRefHorizontal = useRef(null)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [canThumbUp, setCanThumbUp] = useState(false)
  const [canThumbDown, setCanThumbDown] = useState(false)

  const list = Array.isArray(images) && images.length > 0 ? images : []
  const hasMultiple = list.length > 1

  const updateThumbButtons = () => {
    const el = thumbRefVertical.current
    if (!el) return
    const { scrollTop, scrollHeight, clientHeight } = el
    setCanThumbUp(scrollTop > 2)
    setCanThumbDown(scrollTop + clientHeight < scrollHeight - 2)
  }

  useEffect(() => {
    const el = thumbRefVertical.current
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

  // Scroll active thumbnail into view (desktop: vertical strip; mobile: horizontal strip)
  useEffect(() => {
    if (!hasMultiple) return
    const isMd = typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches
    const container = isMd ? thumbRefVertical.current : thumbRefHorizontal.current
    if (!container) return
    const thumb = container.querySelector(`[data-thumb-index="${selectedIndex}"]`)
    if (thumb) thumb.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" })
  }, [selectedIndex, hasMultiple])

  const goMain = (delta) => {
    const next = selectedIndex + delta
    if (next >= 0 && next < list.length) setSelectedIndex(next)
  }

  const scrollThumb = (dir) => {
    const el = thumbRefVertical.current
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

  const thumbBtnClass = (isActive) =>
    `relative shrink-0 overflow-hidden rounded-lg border-2 transition-all ${isActive ? "border-gray-800 shadow-md ring-2 ring-gray-400" : "border-gray-200 hover:border-gray-400"}`

  return (
    <div className={`flex h-full min-h-0 flex-col gap-2 md:flex-row md:gap-3 ${className}`}>
      {/* md+: vertical thumbnails + scroll arrows */}
      {hasMultiple && (
        <div className="hidden w-[20%] min-w-[72px] max-w-[100px] shrink-0 flex-col md:flex">
          <button type="button" onClick={() => scrollThumb(-1)} disabled={!canThumbUp} className="mx-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-30" aria-label="Previous thumbnails">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          </button>
          <div ref={thumbRefVertical} className="flex flex-1 flex-col gap-[8px] overflow-y-auto overflow-x-hidden py-1 [scrollbar-width:none] [-ms-overflow-style:none] scroll-smooth [&::-webkit-scrollbar]:hidden">
            {list.map((src, idx) => {
              const isActive = idx === selectedIndex
              return (
                <button key={`d-${idx}-${resolveUrl(src)}`} type="button" data-thumb-index={idx} onClick={() => setSelectedIndex(idx)} className={`${thumbBtnClass(isActive)} aspect-square w-full`} aria-label={`View image ${idx + 1}`}>
                  <Image src={resolveUrl(src)} alt="" fill sizes="100px" className="object-cover" loading={idx < 4 ? "eager" : "lazy"} />
                </button>
              )
            })}
          </div>
          <button type="button" onClick={() => scrollThumb(1)} disabled={!canThumbDown} className="mx-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-30" aria-label="Next thumbnails">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      )}

      {/* Main image */}
      <div className="relative order-first flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-hidden rounded-lg bg-gray-50 md:order-none">
        {badgeText && <div className="absolute top-3 left-3 z-10 px-2.5 py-1 rounded-md bg-gray-900/80 text-white text-xs font-medium uppercase tracking-wide">{badgeText}</div>}
        {hasMultiple && (
          <>
            <button type="button" onClick={() => goMain(-1)} className="absolute left-1 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white/95 text-gray-700 shadow-md hover:bg-white sm:left-2 sm:h-10 sm:w-10" aria-label="Previous image">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button type="button" onClick={() => goMain(1)} className="absolute right-1 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white/95 text-gray-700 shadow-md hover:bg-white sm:right-2 sm:h-10 sm:w-10" aria-label="Next image">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </>
        )}
        <Image src={mainSrc} alt={alt} fill className="object-contain" sizes="(max-width: 768px) 100vw, 50vw" priority={list.length > 0} data-main-image />
      </div>

      {/* Mobile: horizontal thumbnail strip (full-width main above) */}
      {hasMultiple && (
        <div ref={thumbRefHorizontal} className="flex snap-x snap-mandatory gap-2 overflow-x-auto px-0.5 pb-1 [-ms-overflow-style:none] [scrollbar-width:thin] md:hidden [&::-webkit-scrollbar]:h-1.5">
          {list.map((src, idx) => {
            const isActive = idx === selectedIndex
            return (
              <button key={`m-${idx}-${resolveUrl(src)}`} type="button" data-thumb-index={idx} onClick={() => setSelectedIndex(idx)} className={`${thumbBtnClass(isActive)} h-16 w-16 snap-start`} aria-label={`View image ${idx + 1}`}>
                <Image src={resolveUrl(src)} alt="" fill sizes="64px" className="object-cover" loading={idx < 4 ? "eager" : "lazy"} />
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
