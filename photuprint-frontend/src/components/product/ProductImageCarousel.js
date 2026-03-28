"use client"

import { useEffect, useState, useRef, useMemo } from "react"
import Image from "next/image"
import { getImageSrc } from "../../utils/imageUrl"

const THUMB_GAP = 8

/**
 * Single resolver for thumbnails + main so both show the same pixels.
 * (Previously main used getImageSrc-only; thumbs also used raw URL fallback → mismatch.)
 */
function displaySrc(url) {
  const r = getImageSrc(url)
  if (r) return r
  if (url != null && String(url).trim()) return String(url).trim()
  return ""
}

export default function ProductImageCarousel({
  images = [],
  alt = "Product",
  badgeText,
  className = "",
  /** Rendered above the main image (e.g. template editor on customized PDP). */
  mainImageOverlay = null,
  /** Standard PDP: no borders on thumbnails / chrome (customized flow keeps bordered thumbs). */
  borderlessChrome = false,
}) {
  const thumbRefVertical = useRef(null)
  const thumbRefHorizontal = useRef(null)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [canThumbUp, setCanThumbUp] = useState(false)
  const [canThumbDown, setCanThumbDown] = useState(false)

  const list = Array.isArray(images) && images.length > 0 ? images : []
  const hasMultiple = list.length > 1

  /** Content-based key so we reset selection when URLs change, not when array identity changes. */
  const imagesSignature = useMemo(
    () => (Array.isArray(images) && images.length > 0 ? images.map((u) => displaySrc(u)).join("|") : ""),
    [images]
  )

  useEffect(() => {
    setSelectedIndex(0)
  }, [imagesSignature])

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
      <div className={`flex items-center justify-center bg-white rounded-lg aspect-square ${className}`}>
        <div className="text-gray-400 text-center">
          <svg className="w-16 h-16 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-sm">No image available</p>
        </div>
      </div>
    )
  }

  const n = list.length
  const slidePct = n > 0 ? 100 / n : 100

  const thumbBtnClass = (isActive) =>
    `relative shrink-0 overflow-hidden rounded-lg border-2 transition-all ${isActive ? "border-gray-800 shadow-md ring-2 ring-gray-400" : "border-gray-200 hover:border-gray-400"}`

  return (
    <div
      className={`flex h-full min-h-0 min-w-0 w-full max-w-full flex-col md:flex-row ${borderlessChrome ? "gap-1.5 md:gap-1.5" : "gap-2 md:gap-3"} ${className}`}
    >
      {/* Desktop: vertical thumbnail strip — hidden on mobile (horizontal strip below main instead) */}
      {hasMultiple && (
        <div className="hidden h-full min-h-0 min-w-[72px] max-w-[100px] w-[20%] flex-shrink-0 flex-col self-stretch md:flex">
          <button
            type="button"
            onClick={() => scrollThumb(-1)}
            disabled={!canThumbUp}
            className={`flex-shrink-0 w-8 h-8 mx-auto rounded-full bg-white shadow flex items-center justify-center text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed ${borderlessChrome ? "" : "border border-gray-200"}`}
            aria-label="Previous thumbnails"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          </button>
          <div ref={thumbRefVertical} className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden flex flex-col gap-[8px] py-1 scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {list.map((src, idx) => {
              const isActive = idx === selectedIndex
              const tSrc = displaySrc(src)
              const thumbClass = `relative flex-shrink-0 w-full aspect-square rounded-lg overflow-hidden border transition-all duration-200 ${
                isActive ? "border-green-600 shadow-sm" : "border-gray-200 hover:border-gray-400"
              }`
              return (
                <button key={`${idx}-${tSrc || String(src)}`} type="button" data-thumb-index={idx} onClick={() => setSelectedIndex(idx)} className={thumbClass} aria-label={`View image ${idx + 1}`}>
                  {tSrc ? (
                    <img
                      src={tSrc}
                      alt=""
                      className="absolute inset-0 h-full w-full rounded-lg bg-white object-contain"
                      loading={idx < 4 ? "eager" : "lazy"}
                      decoding="async"
                    />
                  ) : (
                    <div className="absolute inset-0 rounded-lg bg-gray-200" aria-hidden />
                  )}
                </button>
              )
            })}
          </div>
          <button
            type="button"
            onClick={() => scrollThumb(1)}
            disabled={!canThumbDown}
            className={`flex-shrink-0 w-8 h-8 mx-auto rounded-full bg-white shadow flex items-center justify-center text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed ${borderlessChrome ? "" : "border border-gray-200"}`}
            aria-label="Next thumbnails"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      )}

      {/* Main gallery — full width on mobile; inset margin on md+ */}
      <div className="relative min-h-0 w-full min-w-0 flex-1 max-md:m-0 md:m-1.5">
        <div className="relative flex h-full min-h-0 w-full flex-col overflow-hidden rounded-xl bg-white">
          {badgeText && (
            <div
              className={`pointer-events-none absolute left-2 top-2 z-30 max-w-[calc(100%-1rem)] truncate px-2 py-1 text-[10px] font-semibold uppercase leading-tight tracking-wide text-white shadow-md sm:text-xs ${
                borderlessChrome ? "rounded bg-gray-900/90" : "rounded-md bg-gray-900/80"
              }`}
            >
              {badgeText}
            </div>
          )}
          {hasMultiple && (
            <>
              <button
                type="button"
                onClick={() => goMain(-1)}
                className={`absolute left-1 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-gray-700 shadow-md hover:bg-white max-md:active:scale-95 md:left-2 md:h-10 md:w-10 ${borderlessChrome ? "" : "border border-gray-200"}`}
                aria-label="Previous image"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => goMain(1)}
                className={`absolute right-1 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-gray-700 shadow-md hover:bg-white max-md:active:scale-95 md:right-2 md:h-10 md:w-10 ${borderlessChrome ? "" : "border border-gray-200"}`}
                aria-label="Next image"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </>
          )}
          <div className="relative min-h-0 w-full flex-1">
            <div
              className="flex h-full w-full motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-out motion-reduce:transition-none"
              style={{
                width: `${n * 100}%`,
                transform: `translateX(-${selectedIndex * slidePct}%)`,
              }}
            >
              {list.map((src, idx) => {
                const srcResolved = displaySrc(src)
                const unopt = srcResolved.startsWith("data:") || srcResolved.startsWith("blob:")
                return (
                  <div
                    key={`slide-${idx}-${srcResolved}`}
                    className="relative h-full shrink-0 overflow-hidden"
                    style={{ width: `${slidePct}%` }}
                  >
                    {srcResolved ? (
                      <Image
                        src={srcResolved}
                        alt={idx === selectedIndex ? alt : ""}
                        fill
                        className={`rounded-xl bg-white ${borderlessChrome ? "object-cover" : "object-contain"}`}
                      sizes="(max-width: 768px) 100vw, 50vw"
                      priority={idx === 0}
                      unoptimized={unopt}
                      data-main-image={idx === selectedIndex ? true : undefined}
                    />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-white text-gray-400 text-sm">No image</div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
          {mainImageOverlay ? <div className="absolute inset-0 z-20 pointer-events-none [&>*]:pointer-events-auto">{mainImageOverlay}</div> : null}
        </div>
      </div>

      {/* Mobile: horizontal thumbnail strip under main image */}
      {hasMultiple && (
        <div
          ref={thumbRefHorizontal}
          className="flex w-full min-w-0 max-w-full flex-none snap-x snap-mandatory gap-2 overflow-x-auto overscroll-x-contain px-1 pb-1 pt-1 touch-pan-x [-ms-overflow-style:none] [scrollbar-width:thin] md:hidden [&::-webkit-scrollbar]:h-1.5"
        >
          {list.map((src, idx) => {
            const isActive = idx === selectedIndex
            const thumbSrc = displaySrc(src)
            return (
              <button
                key={`m-${idx}-${thumbSrc || String(src)}`}
                type="button"
                data-thumb-index={idx}
                onClick={() => setSelectedIndex(idx)}
                className={`${thumbBtnClass(isActive)} h-[4.5rem] w-[4.5rem] shrink-0 snap-start sm:h-16 sm:w-16`}
                aria-label={`View image ${idx + 1}`}
              >
                {thumbSrc ? (
                  <Image src={thumbSrc} alt="" fill sizes="72px" className="object-cover" loading={idx < 4 ? "eager" : "lazy"} />
                ) : (
                  <div className="absolute inset-0 bg-gray-200" aria-hidden />
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
