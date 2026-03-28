"use client"

import { useEffect, useState, useRef } from "react"
import Link from "next/link"
import Image from "next/image"
import api from "../src/utils/api"
import { getImageSrc } from "../src/utils/imageUrl"
import { useAuth } from "../src/context/AuthContext"
import { getGuestRecentlyViewed, GUEST_RECENTLY_VIEWED_UPDATED_EVENT } from "../src/utils/guestRecentlyViewed"
import { getProductSlug } from "../src/utils/slugify"
import { resolveProductOfferPricing } from "../src/utils/productOfferPricing"

function ProductCardPriceBlock({ product, size = "default" }) {
  const { mrp, sale, hasOffer, pctOff } = resolveProductOfferPricing(product)
  const saleClass =
    size === "lg"
      ? "text-lg font-bold text-emerald-700"
      : size === "sm"
        ? "text-sm font-bold text-emerald-700"
        : "text-[16px] font-bold text-emerald-700"
  const strikeClass = size === "lg" ? "text-sm text-gray-400" : "text-xs text-gray-400"
  const pctClass = size === "lg" ? "text-sm text-red-600 font-medium" : "text-xs text-red-600 font-medium"
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
      {hasOffer && <span className={`line-through ${strikeClass}`}>₹{Math.round(mrp)}</span>}
      <span className={saleClass}>₹{Math.round(sale)}</span>
      {pctOff != null && pctOff > 0 && <span className={pctClass}>({pctOff}% off)</span>}
    </div>
  )
}

function ProductRatingRow({ avgRating, reviewCount }) {
  const hasReviews = (reviewCount != null && reviewCount > 0) || (avgRating != null && avgRating > 0)
  if (!hasReviews) {
    return null
  }
  const r = Math.min(5, Math.max(0, Number(avgRating) || 0))
  return (
    <div
      className="flex items-center mt-0 mb-0 py-0 leading-none [&>div]:leading-none"
      aria-label={`Rated ${r.toFixed(1)} out of 5`}
    >
      <div className="flex items-center gap-0.5" role="img">
        {[1, 2, 3, 4, 5].map((star) => (
          <span
            key={star}
            className={`inline-block text-xl sm:text-2xl leading-none align-middle ${star <= Math.round(r) ? "text-amber-400" : "text-gray-200"}`}
          >
            ★
          </span>
        ))}
      </div>
    </div>
  )
}

function CashbackWalletStrip({ amount }) {
  const n = Number(amount)
  if (!Number.isFinite(n) || n <= 0) return null
  const rounded = Math.round(n)
  if (rounded <= 0) return null
  return (
    <div className="mt-1.5 rounded-md bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50 border border-emerald-200/90 px-2 py-1.5 text-[11px] leading-snug">
      <span className="font-medium text-emerald-900">Cashback in Wallet of </span>
      <span className="font-bold tabular-nums text-red-600">₹{rounded}</span>
    </div>
  )
}

// ─── Shared ProductCard ──────────────────────────────────────────────────────
export function ProductCard({ product }) {
  const { isAuthenticated } = useAuth()
  const [isInWishlist, setIsInWishlist] = useState(false)
  const productSlug = getProductSlug(product)
  const productId = product._id || product.id
  const imgRaw = product.mainImage || product.images?.[0]
  const imageUrl = getImageSrc(imgRaw)
  const offer = resolveProductOfferPricing(product)

  useEffect(() => {
    if (!isAuthenticated || !productId) return
    api.get(`/wishlist/check/${productId}`).then((r) => setIsInWishlist(r.data?.inWishlist === true)).catch(() => {})
  }, [isAuthenticated, productId])

  const handleWishlistClick = async (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (!isAuthenticated || !productId) return
    try {
      if (isInWishlist) {
        await api.delete(`/wishlist/${productId}`)
        setIsInWishlist(false)
      } else {
        await api.post("/wishlist", { productId: String(productId) })
        setIsInWishlist(true)
      }
    } catch (err) {
      console.error("Wishlist toggle error:", err)
    }
  }

  return (
    <Link href={productSlug ? `/products/${productSlug}` : "/products"} className="group block bg-white rounded-lg overflow-hidden border border-gray-100 hover:shadow-lg transition-all duration-200 h-full relative">
      <div className="relative aspect-square bg-gray-100 overflow-hidden">
        {imageUrl ? (
          <Image src={imageUrl} alt={product.name} fill sizes="(max-width: 768px) 50vw, 25vw" className="object-cover group-hover:scale-105 transition-transform duration-200" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-200 to-gray-300">
            <span className="text-gray-400 text-xs">No Image</span>
          </div>
        )}
        {offer.pctOff > 0 && (
          <span className="absolute top-2 left-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">{offer.pctOff}% OFF</span>
        )}
        {isAuthenticated && (
          <button onClick={handleWishlistClick} className={`absolute top-2 right-2 p-1.5 rounded-full shadow-sm transition-colors z-10 ${isInWishlist ? "bg-red-50 text-red-500" : "bg-white/90 text-gray-500 hover:bg-white"}`} title={isInWishlist ? "Remove from wishlist" : "Add to wishlist"}>
            <svg className="w-4 h-4" fill={isInWishlist ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </button>
        )}
        {!isAuthenticated && product.homepageTags?.hot && <span className="absolute top-2 right-2 bg-orange-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">HOT</span>}
        {!isAuthenticated && product.homepageTags?.newArrival && !product.homepageTags?.hot && <span className="absolute top-2 right-2 bg-blue-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">NEW</span>}
        {isAuthenticated && product.homepageTags?.hot && <span className="absolute top-2 right-10 bg-orange-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">HOT</span>}
        {isAuthenticated && product.homepageTags?.newArrival && !product.homepageTags?.hot && <span className="absolute top-2 right-10 bg-blue-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">NEW</span>}
      </div>
      <div className="p-3">
        <h3 className="text-sm font-bold text-gray-900 mb-0 line-clamp-2 group-hover:text-blue-600 transition-colors leading-tight">{product.name}</h3>
        <ProductRatingRow avgRating={product.avgRating} reviewCount={product.reviewCount} />
        <div className="mt-0.5">
          <ProductCardPriceBlock product={product} />
        </div>
        <CashbackWalletStrip amount={product.estimatedCashbackWallet} />
      </div>
    </Link>
  )
}

// ─── Shimmer placeholders (reduce CLS) ───────────────────────────────────────
function ProductCardShimmer() {
  return (
    <div className="rounded-lg overflow-hidden border border-gray-100 bg-white h-full">
      <div className="aspect-square bg-gray-200 animate-pulse" />
      <div className="p-3 space-y-2">
        <div className="h-3 bg-gray-200 rounded animate-pulse w-[85%]" />
        <div className="h-3 bg-gray-200 rounded animate-pulse w-2/5" />
        <div className="h-4 bg-gray-200 rounded animate-pulse w-1/3 mt-2" />
      </div>
    </div>
  )
}

function SectionShimmer({ columns = 4, rows = 2 }) {
  const colClass = {
    2: "grid-cols-2",
    3: "grid-cols-2 sm:grid-cols-3",
    4: "grid-cols-2 sm:grid-cols-3 md:grid-cols-4",
    5: "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5",
    6: "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6",
  }
  const count = columns * rows
  return (
    <div className="py-8 bg-white">
      <div className="w-full mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-gray-200 rounded animate-pulse" />
            <div className="h-7 w-40 bg-gray-200 rounded animate-pulse" />
          </div>
          <div className="h-4 w-16 bg-gray-200 rounded animate-pulse" />
        </div>
        <div className={`grid ${colClass[columns] || colClass[4]} gap-4`}>
          {Array.from({ length: count }).map((_, i) => (
            <ProductCardShimmer key={i} />
          ))}
        </div>
      </div>
    </div>
  )
}

function CarouselRowShimmer({ columns = 4 }) {
  return (
    <div className="bg-white py-8 border-b border-gray-200">
      <div className="w-full mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-gray-200 rounded animate-pulse" />
            <div className="h-7 w-36 bg-gray-200 rounded animate-pulse" />
          </div>
          <div className="h-4 w-16 bg-gray-200 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {Array.from({ length: columns }).map((_, i) => (
            <ProductCardShimmer key={i} />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Layout: Grid ────────────────────────────────────────────────────────────
export function GridLayout({ products, columns = 4 }) {
  const colClass = {
    2: "grid-cols-2",
    3: "grid-cols-2 sm:grid-cols-3",
    4: "grid-cols-2 sm:grid-cols-3 md:grid-cols-4",
    5: "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5",
    6: "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6",
  }
  return (
    <div className={`grid ${colClass[columns] || colClass[4]} gap-4`}>
      {products.map((p) => (
        <ProductCard key={p._id || p.id} product={p} />
      ))}
    </div>
  )
}

// ─── Layout: Carousel (pure CSS scroll-snap — no external plugin) ────────────
// `columns` = the number from homepage manager displayConfig.columns
// Responsive: adapts visible count per breakpoint, native scroll + snap
const CAROUSEL_GAP = 12

function getVisibleCount(maxCol) {
  if (typeof window === "undefined") return Math.min(maxCol, 2)
  const w = window.innerWidth
  if (w >= 1280) return maxCol
  if (w >= 1024) return Math.min(maxCol, 5)
  if (w >= 768) return Math.min(maxCol, 4)
  if (w >= 640) return Math.min(maxCol, 3)
  return 2
}

// SSR-safe initial visible count (must match server; client updates in useEffect)
function getVisibleCountSSR(maxCol) {
  return Math.min(maxCol, 2)
}

function CarouselLayout({ products, columns = 4, showThumbs = false }) {
  const trackRef = useRef(null)
  const [canPrev, setCanPrev] = useState(false)
  const [canNext, setCanNext] = useState(true)
  const [activeIdx, setActiveIdx] = useState(0)
  const maxCol = Math.max(2, Math.min(columns, 6))
  const [visibleCount, setVisibleCount] = useState(() => getVisibleCountSSR(maxCol))

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
  }, [products, visibleCount])

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
  }, [products])

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

  const dotCount = Math.max(1, products.length - visibleCount + 1)
  const hasOverflow = products.length > visibleCount
  const showNav = showThumbs ? products.length > 1 : hasOverflow

  return (
    <div className="relative w-full group">
      {/* Prev Arrow */}
      {showNav && (
        <button onClick={() => scroll(-1)} disabled={!canPrev} className={`absolute -left-4 top-1/2 -translate-y-1/2 z-10 w-9 h-9 bg-white shadow-md rounded-full flex items-center justify-center text-gray-600 hover:text-gray-900 hover:shadow-lg transition-all border border-gray-200 ${!canPrev ? "opacity-30 cursor-not-allowed" : "opacity-100"}`} aria-label="Previous">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}

      {/* Scrollable track — CSS scroll-snap, no DOM mutations */}
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
        {products.map((p) => (
          <div key={p._id || p.id} className="snap-start flex-shrink-0" style={{ width: `calc((100% - ${(visibleCount - 1) * CAROUSEL_GAP}px) / ${visibleCount})` }}>
            <ProductCard product={p} />
          </div>
        ))}
      </div>

      {/* Next Arrow */}
      {showNav && (
        <button onClick={() => scroll(1)} disabled={!canNext} className={`absolute -right-4 top-1/2 -translate-y-1/2 z-10 w-9 h-9 bg-white shadow-md rounded-full flex items-center justify-center text-gray-600 hover:text-gray-900 hover:shadow-lg transition-all border border-gray-200 ${!canNext ? "opacity-30 cursor-not-allowed" : "opacity-100"}`} aria-label="Next">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}

      {/* Thumbnails strip */}
      {showThumbs && showNav && (
        <div className="flex justify-center gap-2 mt-4">
          {products.map((p, i) => {
            const imgRaw = p.mainImage || p.images?.[0]
            const thumbUrl = getImageSrc(imgRaw)
            const isActive = i === activeIdx
            return (
              <button key={p._id || p.id} onClick={() => scrollTo(i)} className={`relative w-10 h-10 rounded-lg overflow-hidden border-2 flex-shrink-0 transition-all ${isActive ? "border-blue-600 shadow-md scale-110" : "border-gray-200 opacity-60 hover:opacity-100 hover:border-gray-400"}`} aria-label={`Go to ${p.name || `product ${i + 1}`}`}>
                {thumbUrl ? (
                  <Image src={thumbUrl} alt="" fill className="object-cover" sizes="40px" />
                ) : (
                  <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                    <span className="text-gray-400 text-[8px]">N/A</span>
                  </div>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* Dots (when thumbs are off) */}
      {!showThumbs && dotCount > 1 && dotCount <= 12 && (
        <div className="flex justify-center gap-1.5 mt-4">
          {Array.from({ length: dotCount }).map((_, i) => (
            <button key={i} onClick={() => scrollTo(i)} className={`h-2 rounded-full transition-all ${i === activeIdx ? "w-6 bg-blue-600" : "w-2 bg-gray-300 hover:bg-gray-400"}`} aria-label={`Go to slide ${i + 1}`} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Layout: List ────────────────────────────────────────────────────────────
function ListLayout({ products }) {
  return (
    <div className="space-y-3">
      {products.map((product) => {
        const productSlug = getProductSlug(product)
        const productId = product._id || product.id
        const imageUrl = getImageSrc(product.mainImage || product.images?.[0])
        const offer = resolveProductOfferPricing(product)
        return (
          <Link key={productId} href={productSlug ? `/products/${productSlug}` : "/products"} className="group flex items-center bg-white rounded-lg border border-gray-100 overflow-hidden hover:shadow-md transition-all duration-200">
            <div className="relative w-28 h-28 sm:w-36 sm:h-36 flex-shrink-0 bg-gray-100 overflow-hidden">
              {imageUrl ? (
                <Image src={imageUrl} alt={product.name} fill sizes="144px" className="object-cover group-hover:scale-105 transition-transform duration-200" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-200 to-gray-300">
                  <span className="text-gray-400 text-xs">No Image</span>
                </div>
              )}
              {offer.pctOff > 0 && (
                <span className="absolute top-1.5 left-1.5 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                  {offer.pctOff}% OFF
                </span>
              )}
            </div>
            <div className="flex-1 p-4 min-w-0">
              <h3 className="text-base font-semibold text-gray-900 mb-0 line-clamp-1 group-hover:text-blue-600 transition-colors">{product.name}</h3>
              <ProductRatingRow avgRating={product.avgRating} reviewCount={product.reviewCount} />
              {product.description && <p className="text-xs text-gray-500 mb-2 line-clamp-2 mt-0.5">{product.description.replace(/<[^>]*>/g, "").substring(0, 120)}</p>}
              <div className="flex items-center space-x-3">
                <ProductCardPriceBlock product={product} size="lg" />
              </div>
              <CashbackWalletStrip amount={product.estimatedCashbackWallet} />
            </div>
          </Link>
        )
      })}
    </div>
  )
}

// ─── Layout: Masonry ─────────────────────────────────────────────────────────
function MasonryLayout({ products }) {
  const aspects = ["aspect-[3/4]", "aspect-square", "aspect-[4/5]", "aspect-[3/5]", "aspect-[4/3]"]
  return (
    <div className="columns-2 sm:columns-3 md:columns-4 lg:columns-5 gap-3 space-y-3">
      {products.map((product, i) => {
        const productSlug = getProductSlug(product)
        const productId = product._id || product.id
        const imageUrl = getImageSrc(product.mainImage || product.images?.[0])
        const offer = resolveProductOfferPricing(product)
        return (
          <Link key={productId} href={productSlug ? `/products/${productSlug}` : "/products"} className="group block bg-white rounded-lg overflow-hidden border border-gray-100 hover:shadow-lg transition-all duration-200 break-inside-avoid">
            <div className={`relative ${aspects[i % 5]} bg-gray-100 overflow-hidden`}>
              {imageUrl ? (
                <Image src={imageUrl} alt={product.name} fill sizes="(max-width: 768px) 50vw, 25vw" className="object-cover group-hover:scale-105 transition-transform duration-200" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-200 to-gray-300">
                  <span className="text-gray-400 text-xs">No Image</span>
                </div>
              )}
              {offer.pctOff > 0 && (
                <span className="absolute top-2 left-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">{offer.pctOff}% OFF</span>
              )}
            </div>
            <div className="p-3">
              <h3 className="text-sm font-medium text-gray-900 mb-0 line-clamp-2 group-hover:text-blue-600 transition-colors leading-tight">{product.name}</h3>
              <ProductRatingRow avgRating={product.avgRating} reviewCount={product.reviewCount} />
              <div className="mt-0.5">
                <ProductCardPriceBlock product={product} size="sm" />
              </div>
              <CashbackWalletStrip amount={product.estimatedCashbackWallet} />
            </div>
          </Link>
        )
      })}
    </div>
  )
}

// ─── Layout Renderer (reads layoutStyle + columns from backend displayConfig) ─
function LayoutRenderer({ layout, products, columns }) {
  switch (layout) {
    case "carousel":
      return <CarouselLayout products={products} columns={columns} />
    case "list":
      return <ListLayout products={products} />
    case "masonry":
      return <MasonryLayout products={products} />
    case "grid":
    default:
      return <GridLayout products={products} columns={columns} />
  }
}

// ─── TYPE → ICON ─────────────────────────────────────────────────────────────
const TYPE_ICON = {
  featured: "⭐",
  bestsellers: "🏆",
  new_arrivals: "✨",
  trending: "📈",
  on_sale: "🏷️",
  custom: "🎯",
}

// ─── Single Section (driven by backend homepage-sections data) ───────────────
function HomepageSection({ section }) {
  const products = (section.products || [])
    .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0))
    .map((entry) => entry.product || entry)
    .filter((p) => p && (p._id || p.id))

  if (products.length === 0) return null

  const dc = section.displayConfig || {}
  const layout = dc.layoutStyle || "grid"
  const columns = dc.columns || 4
  const showViewAll = dc.showViewAll !== false
  const viewAllLink = dc.viewAllLink || `/products?section=${section.slug || section._id}`
  const bgColor = dc.backgroundColor || "#ffffff"
  const textColor = dc.textColor || "#000000"
  const showCount = dc.showProductCount || false
  const customClass = dc.customClass || ""
  const icon = TYPE_ICON[section.type] || TYPE_ICON.custom

  return (
    <div className={`py-8 ${customClass}`} style={{ backgroundColor: bgColor }}>
      <div className="w-full mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6 flex justify-center align-center">
          <div className="flex items-center space-x-2">
            <span className="text-xl">{icon}</span>
            <h2 className="text-2xl font-bold" style={{ color: textColor }}>
              {section.name}
            </h2>
            {showCount && <span className="text-sm text-gray-500 ml-2">({products.length})</span>}
          </div>

          {showViewAll && (
            <div>
              <Link href={viewAllLink} className="text-blue-600 hover:text-blue-700 font-semibold text-sm flex items-center">
                View All
                <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          )}
        </div>

        {section.description && <p className="text-sm text-gray-500 mb-4 -mt-2">{section.description}</p>}

        {/* Layout: grid | carousel | list | masonry — from displayConfig.layoutStyle */}
        <LayoutRenderer layout={layout} products={products} columns={columns} />
      </div>
    </div>
  )
}

// ─── Fixed Carousel Section (always carousel, Hot/Trending style) ───────────
export function HomepageCarouselSection() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .get("/products?showInactive=false&includeDeleted=false&limit=12")
      .then((res) => {
        const d = res.data?.products ?? res.data
        setProducts(Array.isArray(d) ? d : [])
      })
      .catch(() => setProducts([]))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <CarouselRowShimmer columns={4} />
  }

  if (products.length === 0) return null

  return (
    <div className="bg-white py-8 border-b border-gray-200">
      <div className="w-full mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-2">
            <span className="text-xl">📈</span>
            <h2 className="text-2xl font-bold text-gray-900">Hot & Trending</h2>
          </div>
          <Link href="/products" className="text-blue-600 hover:text-blue-700 font-semibold text-sm flex items-center">
            View All
            <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
        <CarouselLayout products={products} columns={4} />
      </div>
    </div>
  )
}

// Normalize GET /recently-viewed-products response (backend may use different shapes)
function normalizeRecentlyViewedResponse(data) {
  if (!data || typeof data !== "object") return []
  const raw = data.products ?? data.items ?? data.recentViewed ?? data.recentlyViewed ?? (Array.isArray(data) ? data : [])
  const list = Array.isArray(raw) ? raw : []
  return list.map((item) => (item && item.product != null ? item.product : item)).filter((p) => p && (p._id || p.id))
}

const GUEST_RECENTLY_VIEWED_DISPLAY_LIMIT = 8

// ─── Recently Viewed Products (carousel: guest = localStorage + fetch; logged-in = API) ──────────────
// Backend: GET /products/:id must be allowed for unauthenticated users so guest product cards load.
// If it returns 401, we still show the section with simple links (fallback below).
/** @param {{ contentClassName?: string }} props — inner width; default full width. PDP passes `PDP_PAGE_INNER_WIDTH_CLASS` from `src/constants/pdpLayout`. */
export function RecentlyViewedProducts({ contentClassName = "w-full mx-auto" } = {}) {
  const { isAuthenticated } = useAuth()
  const [products, setProducts] = useState([])
  const [guestIds, setGuestIds] = useState([]) // ids we tried to fetch (for fallback when API fails)
  const [loading, setLoading] = useState(true)

  const loadGuestRecentlyViewed = () => {
    const guestList = getGuestRecentlyViewed()
    const ids = guestList
      .map((item) => item.productId)
      .slice(-GUEST_RECENTLY_VIEWED_DISPLAY_LIMIT)
      .reverse()
    if (ids.length === 0) {
      setProducts([])
      setGuestIds([])
      setLoading(false)
      return
    }
    setGuestIds(ids)
    setLoading(true)
    Promise.all(
      ids.map((id) =>
        api
          .get(`/products/${id}`)
          .then((r) => r.data)
          .catch((err) => {
            if (process.env.NODE_ENV === "development" && err?.response?.status === 401) {
              console.warn("[RecentlyViewed] GET /products/:id returned 401 for guest. Backend should allow unauthenticated access for product details.")
            }
            return null
          }),
      ),
    )
      .then((results) => results.filter(Boolean))
      .then(setProducts)
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (isAuthenticated) {
      setGuestIds([])
      const ac = new AbortController()
      setLoading(true)
      api
        .get("/recently-viewed-products", { signal: ac.signal })
        .then((res) => {
          const data = res.data
          setProducts(normalizeRecentlyViewedResponse(data))
        })
        .catch((err) => {
          if (err.name !== "CanceledError" && err.code !== "ERR_CANCELED") setProducts([])
        })
        .finally(() => setLoading(false))
      return () => ac.abort()
    }
    // Guest: read from localStorage, fetch product details; refetch when list is updated.
    // Defer initial load so parent (e.g. product page) has run its effect and written to localStorage.
    const timer = setTimeout(loadGuestRecentlyViewed, 0)
    if (typeof window === "undefined") return () => clearTimeout(timer)
    const handleUpdated = () => loadGuestRecentlyViewed()
    window.addEventListener(GUEST_RECENTLY_VIEWED_UPDATED_EVENT, handleUpdated)
    return () => {
      clearTimeout(timer)
      window.removeEventListener(GUEST_RECENTLY_VIEWED_UPDATED_EVENT, handleUpdated)
    }
  }, [isAuthenticated])

  if (loading)
    return (
      <div className="bg-white py-8 border-b border-gray-200">
        <div className={`${contentClassName} px-4 sm:px-6 lg:px-8`}>
          <CarouselRowShimmer columns={4} />
        </div>
      </div>
    )
  // Show section if we have products (full cards) or, for guests, if we have ids but API failed (fallback links)
  const hasProducts = products.length > 0
  const showGuestFallback = !isAuthenticated && guestIds.length > 0 && !hasProducts
  if (!hasProducts && !showGuestFallback) return null

  return (
    <div className="bg-white py-8 border-b border-gray-200">
      <div className={`${contentClassName} px-4 sm:px-6 lg:px-8`}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-2">
            <span className="text-xl">🕐</span>
            <h2 className="text-xl font-bold text-gray-900 sm:text-2xl">Recently Viewed</h2>
          </div>
          <Link href="/account?tab=recently-viewed" className="text-blue-600 hover:text-blue-700 font-semibold text-sm flex items-center">
            View All
            <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
        {hasProducts ? (
          <CarouselLayout products={products} columns={4} />
        ) : (
          <div className="flex flex-wrap gap-3">
            {guestIds.map((id) => (
              <Link key={id} href={`/product/${id}`} className="inline-flex items-center px-4 py-2 rounded-lg border border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100 text-sm font-medium">
                View product
                <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            ))}
          </div>
        )}
        {!isAuthenticated && <p className="text-center text-sm text-gray-500 mt-3">Sign in to sync across devices</p>}
      </div>
    </div>
  )
}

// ─── Main Export ─────────────────────────────────────────────────────────────
export function FeaturedProductSections({ initialSections = [], fallbackProducts: initialFallbackProducts = [] } = {}) {
  const [sections, setSections] = useState(initialSections)
  const [fallbackProducts, setFallbackProducts] = useState(Array.isArray(initialFallbackProducts) ? initialFallbackProducts : [])
  const hasInitialData = initialSections?.length > 0 || (Array.isArray(initialFallbackProducts) && initialFallbackProducts.length > 0)
  const [loading, setLoading] = useState(!hasInitialData)

  useEffect(() => {
    if (hasInitialData) return
    fetchHomepageSections()
  }, [hasInitialData])

  useEffect(() => {
    if (initialSections?.length) {
      setSections(initialSections)
      setLoading(false)
    }
    if (Array.isArray(initialFallbackProducts) && initialFallbackProducts.length) {
      setFallbackProducts(initialFallbackProducts)
      setLoading(false)
    }
  }, [initialSections, initialFallbackProducts])

  const fetchHomepageSections = async () => {
    try {
      setLoading(true)

      const res = await fetch("/api/homepage-sections", { cache: "no-store" })

      if (!res.ok) {
        // Try to get error details from response
        let errorData = null
        let errorText = ""

        try {
          // Try to read as text first
          errorText = await res.text()
          if (errorText) {
            try {
              errorData = JSON.parse(errorText)
            } catch {
              // Not JSON, keep as text
            }
          }
        } catch (e) {
          errorText = `Failed to read response: ${e.message}`
        }

        const errorMessage = errorData?.error || errorData?.details || errorText || res.statusText || "Unknown error"

        // Build error log object with guaranteed non-undefined values
        const errorLog = {
          status: res.status,
          statusText: res.statusText || "Unknown status",
        }

        if (errorData?.error) errorLog.error = errorData.error
        if (errorData?.details) errorLog.details = errorData.details
        if (errorText && !errorData) errorLog.responseText = errorText
        if (!errorLog.error && !errorLog.details && !errorLog.responseText) {
          errorLog.message = "No error details available"
        }

        console.error("[Homepage] Failed to fetch sections:", errorLog)

        throw new Error(`HTTP ${res.status}: ${errorMessage}`)
      }

      const data = await res.json()

      if (data?.sections && Array.isArray(data.sections)) {
        const activeSections = data.sections.filter((s) => s.isActive !== false && s.status === "active").sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0))

        console.log(
          `[Homepage] ${activeSections.length} sections:`,
          activeSections.map((s) => `${s.name} (${s.displayConfig?.layoutStyle || "grid"}, ${s.products?.length || 0} products)`),
        )
        setSections(activeSections)
      } else {
        console.warn("[Homepage] No sections found in response, using fallback")
        await fetchFallbackProducts()
      }
    } catch (err) {
      console.warn("[Homepage] Could not load sections:", err.message)
      console.warn("[Homepage] Error details:", err)
      await fetchFallbackProducts()
    } finally {
      setLoading(false)
    }
  }

  const fetchFallbackProducts = async () => {
    try {
      // Try fetching products with proper error handling
      const response = await api.get("/products?showInactive=false&includeDeleted=false&limit=12")
      const d = response.data.products || response.data || []
      setFallbackProducts(Array.isArray(d) ? d : [])
    } catch (err) {
      console.warn("[Homepage] Failed to fetch fallback products:", err.message)
      console.warn("[Homepage] Error details:", {
        status: err.response?.status,
        statusText: err.response?.statusText,
        url: err.config?.url,
      })
      // Set empty array on error to prevent UI issues
      setFallbackProducts([])
    }
  }

  if (loading) {
    return (
      <>
        <SectionShimmer columns={4} rows={2} />
        <SectionShimmer columns={4} rows={1} />
      </>
    )
  }

  // Backend-driven sections
  if (sections.length > 0) {
    return (
      <>
        {sections.map((section) => (
          <HomepageSection key={section._id || section.id} section={section} />
        ))}
      </>
    )
  }

  // Fallback
  if (fallbackProducts.length > 0) {
    return (
      <div className="bg-white py-8">
        <div className="w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-2">
              <span className="text-xl">⭐</span>
              <h2 className="text-2xl font-bold text-gray-900">Featured Products</h2>
            </div>
            <Link href="/products" className="text-blue-600 hover:text-blue-700 font-semibold text-sm flex items-center">
              View All
              <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
          <GridLayout products={fallbackProducts} columns={4} />
        </div>
      </div>
    )
  }

  // Empty
  return (
    <div className="bg-white py-16 text-center">
      <div className="max-w-md mx-auto">
        <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
        <p className="text-gray-500 text-lg">No products available yet.</p>
        <p className="text-gray-400 text-sm mt-1">Check back soon for new products!</p>
      </div>
    </div>
  )
}

export default HomepageSection
