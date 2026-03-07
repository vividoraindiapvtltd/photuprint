"use client"

import { useState, useEffect, useRef } from "react"
import api from "../src/utils/api"

const API_URL = "/testimonials"
const CAROUSEL_GAP = 12
const COLUMNS = 4

function resolveImageUrl(url) {
  if (!url) return ""
  if (typeof url === "string" && (url.startsWith("http://") || url.startsWith("https://"))) return url
  const base = typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_URL ? process.env.NEXT_PUBLIC_API_URL.replace(/\/api\/?$/, "") : "http://localhost:8080"
  return base + (url.startsWith("/") ? url : "/" + url)
}

function normalizeTestimonials(res) {
  const data = res?.data ?? res
  if (Array.isArray(data)) return data
  if (data?.testimonials && Array.isArray(data.testimonials)) return data.testimonials
  if (data?.data && Array.isArray(data.data)) return data.data
  if (data?.items && Array.isArray(data.items)) return data.items
  return []
}

function getVisibleCount(maxCol) {
  if (typeof window === "undefined") return Math.min(maxCol, 2)
  const w = window.innerWidth
  if (w >= 1280) return maxCol
  if (w >= 1024) return Math.min(maxCol, 5)
  if (w >= 768) return Math.min(maxCol, 4)
  if (w >= 640) return Math.min(maxCol, 3)
  return 2
}

function getVisibleCountSSR(maxCol) {
  return Math.min(maxCol, 2)
}

/** Single testimonial card — same visual weight as ProductCard (rounded-lg, border, hover) */
function TestimonialCard({ item }) {
  const quote = item.quote ?? item.text ?? item.content ?? item.review ?? item.testimonial ?? ""
  const photoUrl = item.photo ?? item.photo ?? ""
  const author = item.author ?? item.name ?? item.userName ?? item.customerName ?? "Customer"
  const title = item.title ?? item.role ?? item.designation ?? item.subtitle ?? ""
  const rating = item.rating ?? item.stars
  const avatar = item.avatar ?? item.image ?? item.avatarUrl ?? item.imageUrl ?? null
  const createdDate = item.createdAt ?? item.createdDate ?? item.date ?? null

  return (
    <div className="group block bg-white rounded-lg overflow-hidden border border-gray-100 hover:shadow-lg transition-all duration-200 h-full flex flex-col text-center">
      {/* Photo: own block so it’s fully visible (no clipping) */}
      {photoUrl && (
        <div className="flex justify-center pt-4 pb-1 bg-gray-50">
          <img src={resolveImageUrl(photoUrl)} alt="" className="w-20 h-20 rounded-full object-cover border-2 border-gray-100 flex-shrink-0" />
        </div>
      )}
      {/* Quote + rating area */}
      <div className="relative flex-1 min-h-[120px] p-4 flex flex-col justify-center bg-gray-50">
        {rating != null && (
          <div className="flex gap-0.5 mb-2 mx-auto" aria-hidden="true">
            {[1, 2, 3, 4, 5].map((star) => (
              <span key={star} className={star <= (typeof rating === "number" ? rating : 5) ? "text-amber-400" : "text-gray-200"} style={{ fontSize: "12px" }}>
                ★
              </span>
            ))}
          </div>
        )}
        <blockquote className="text-gray-700 text-sm leading-relaxed line-clamp-4">&ldquo;{quote}&rdquo;</blockquote>
        {createdDate && (
          <span className="text-xs text-gray-500 mt-0.5">
            {(() => {
              const date = new Date(createdDate)
              if (isNaN(date.getTime())) return createdDate
              const options = { weekday: "long" }
              const day = date.toLocaleDateString(undefined, options)
              const d = String(date.getDate()).padStart(2, "0")
              const m = date.toLocaleString("default", { month: "long" })
              const y = String(date.getFullYear())
              return `${day}, ${d} ${m} ${y}`
            })()}
          </span>
        )}
      </div>
      {/* Bottom: author (same padding as ProductCard p-3) */}
      <div className="p-3 border-t border-gray-100">
        <div className="text-center">
          {avatar && <img src={resolveImageUrl(avatar)} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0 border border-gray-200" />}
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{author}</p>
            {title && <p className="text-[10px] text-gray-500 truncate">{title}</p>}
          </div>
        </div>
      </div>
    </div>
  )
}

function TestimonialCardShimmer() {
  return (
    <div className="rounded-lg overflow-hidden border border-gray-100 bg-white h-full">
      <div className="min-h-[140px] bg-gray-200 animate-pulse p-4 space-y-2">
        <div className="h-3 bg-gray-300 rounded animate-pulse w-full" />
        <div className="h-3 bg-gray-300 rounded animate-pulse w-4/5" />
        <div className="h-3 bg-gray-300 rounded animate-pulse w-3/5" />
      </div>
      <div className="p-3 border-t border-gray-100 flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse" />
        <div className="flex-1 space-y-1">
          <div className="h-3 bg-gray-200 rounded animate-pulse w-24" />
          <div className="h-2 bg-gray-200 rounded animate-pulse w-16" />
        </div>
      </div>
    </div>
  )
}

function TestimonialsCarouselShimmer() {
  return (
    <div className="bg-white py-8 border-b border-gray-200">
      <div className="w-full mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <div className="h-7 w-48 bg-gray-200 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {Array.from({ length: COLUMNS }).map((_, i) => (
            <TestimonialCardShimmer key={i} />
          ))}
        </div>
      </div>
    </div>
  )
}

export default function TestimonialsCarousel() {
  const trackRef = useRef(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [canPrev, setCanPrev] = useState(false)
  const [canNext, setCanNext] = useState(true)
  const [activeIdx, setActiveIdx] = useState(0)
  const maxCol = Math.max(2, Math.min(COLUMNS, 6))
  const [visibleCount, setVisibleCount] = useState(() => getVisibleCountSSR(maxCol))

  useEffect(() => {
    setLoading(true)
    api
      .get(API_URL, { skipAuth: true })
      .then((res) => {
        const list = normalizeTestimonials(res)
        setItems(Array.isArray(list) ? list : [])
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const onResize = () => setVisibleCount(getVisibleCount(maxCol))
    onResize()
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [maxCol])

  const updateButtons = () => {
    const el = trackRef.current
    if (!el) return
    const { scrollLeft, scrollWidth, clientWidth } = el
    setCanPrev(scrollLeft > 2)
    setCanNext(scrollLeft + clientWidth < scrollWidth - 2)
  }

  useEffect(() => {
    const el = trackRef.current
    if (!el) return
    updateButtons()
    el.addEventListener("scroll", updateButtons, { passive: true })
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(updateButtons) : null
    if (ro) ro.observe(el)
    return () => {
      el.removeEventListener("scroll", updateButtons)
      if (ro) ro.disconnect()
    }
  }, [items, visibleCount])

  useEffect(() => {
    const el = trackRef.current
    if (!el) return
    const handleScroll = () => {
      const slideW = el.firstElementChild?.offsetWidth || 1
      const idx = Math.round(el.scrollLeft / (slideW + CAROUSEL_GAP))
      setActiveIdx(idx)
    }
    el.addEventListener("scroll", handleScroll, { passive: true })
    return () => el.removeEventListener("scroll", handleScroll)
  }, [items])

  const scrollTo = (idx) => {
    const el = trackRef.current
    if (!el) return
    const slideW = el.firstElementChild?.offsetWidth || 200
    el.scrollTo({ left: idx * (slideW + CAROUSEL_GAP), behavior: "smooth" })
  }

  const scroll = (dir) => {
    const el = trackRef.current
    if (!el) return
    const slideW = el.firstElementChild?.offsetWidth || 200
    const amount = (slideW + CAROUSEL_GAP) * Math.max(1, Math.floor(visibleCount / 2))
    el.scrollBy({ left: dir * amount, behavior: "smooth" })
  }

  const dotCount = Math.max(1, items.length - visibleCount + 1)
  const hasOverflow = items.length > visibleCount
  const showNav = hasOverflow

  if (loading) return <TestimonialsCarouselShimmer />
  if (items.length === 0) return null

  return (
    <div className="bg-white py-8 border-b border-gray-200">
      <div className="w-full mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-6 ">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">What Our Customers Say</h2>
          </div>

          <div>
            {" "}
            <a href="/testimonials" className="text-sm text-gray-500">
              View All
            </a>
          </div>
        </div>

        <div className="relative w-full group">
          {showNav && (
            <button onClick={() => scroll(-1)} disabled={!canPrev} className={`absolute -left-4 top-1/2 -translate-y-1/2 z-10 w-9 h-9 bg-white shadow-md rounded-full flex items-center justify-center text-gray-600 hover:text-gray-900 hover:shadow-lg transition-all border border-gray-200 ${!canPrev ? "opacity-30 cursor-not-allowed" : "opacity-100"}`} aria-label="Previous">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}

          <div
            ref={trackRef}
            className="carousel-track flex overflow-x-auto scroll-smooth snap-x snap-mandatory pb-2"
            style={{
              gap: `${CAROUSEL_GAP}px`,
              scrollbarWidth: "none",
              msOverflowStyle: "none",
              WebkitOverflowScrolling: "touch",
            }}
          >
            {items.map((item, i) => (
              <div key={item._id ?? item.id ?? i} className="snap-start flex-shrink-0" style={{ width: `calc((100% - ${(visibleCount - 1) * CAROUSEL_GAP}px) / ${visibleCount})` }}>
                <TestimonialCard item={item} />
              </div>
            ))}
          </div>

          {showNav && (
            <button onClick={() => scroll(1)} disabled={!canNext} className={`absolute -right-4 top-1/2 -translate-y-1/2 z-10 w-9 h-9 bg-white shadow-md rounded-full flex items-center justify-center text-gray-600 hover:text-gray-900 hover:shadow-lg transition-all border border-gray-200 ${!canNext ? "opacity-30 cursor-not-allowed" : "opacity-100"}`} aria-label="Next">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}

          {dotCount > 1 && dotCount <= 12 && (
            <div className="flex justify-center gap-1.5 mt-4">
              {Array.from({ length: dotCount }).map((_, i) => (
                <button key={i} onClick={() => scrollTo(i)} className={`h-2 rounded-full transition-all ${i === activeIdx ? "w-6 bg-blue-600" : "w-2 bg-gray-300 hover:bg-gray-400"}`} aria-label={`Go to slide ${i + 1}`} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
