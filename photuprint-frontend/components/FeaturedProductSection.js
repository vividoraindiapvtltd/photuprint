"use client"

import { useEffect, useState, useRef } from "react"
import Link from "next/link"
import api from "../src/utils/api"

// ─── Shared ProductCard ──────────────────────────────────────────────────────
function ProductCard({ product }) {
  const productId = product._id || product.id
  const imgRaw = product.mainImage || product.images?.[0]
  const imageUrl = imgRaw
    ? imgRaw.startsWith("http") ? imgRaw : `http://localhost:8080${imgRaw}`
    : null

  return (
    <Link
      href={`/product/${productId}`}
      className="group block bg-white rounded-lg overflow-hidden border border-gray-100 hover:shadow-lg transition-all duration-200 h-full"
    >
      <div className="relative aspect-square bg-gray-100 overflow-hidden">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-200 to-gray-300">
            <span className="text-gray-400 text-xs">No Image</span>
          </div>
        )}
        {product.discountPercentage > 0 && (
          <span className="absolute top-2 left-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
            {product.discountPercentage}% OFF
          </span>
        )}
        {product.homepageTags?.hot && (
          <span className="absolute top-2 right-2 bg-orange-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">HOT</span>
        )}
        {product.homepageTags?.newArrival && !product.homepageTags?.hot && (
          <span className="absolute top-2 right-2 bg-blue-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">NEW</span>
        )}
      </div>
      <div className="p-3">
        <h3 className="text-sm font-medium text-gray-900 mb-1 line-clamp-2 group-hover:text-blue-600 transition-colors leading-tight">
          {product.name}
        </h3>
        <div className="flex items-center space-x-2 mt-1">
          <span className="text-sm font-bold text-gray-900">₹{product.discountedPrice || product.price}</span>
          {product.discountedPrice && product.discountedPrice < product.price && (
            <span className="text-xs text-gray-400 line-through">₹{product.price}</span>
          )}
        </div>
        {product.category && <p className="text-[10px] text-gray-500 mt-1">{product.category.name}</p>}
      </div>
    </Link>
  )
}

// ─── Layout: Grid ────────────────────────────────────────────────────────────
function GridLayout({ products, columns = 4 }) {
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

// ─── Layout: Carousel (Glider.js — loaded dynamically, browser-only) ─────────
// `columns` = the number from homepage manager displayConfig.columns
function CarouselLayout({ products, columns = 4 }) {
  const gliderRef = useRef(null)
  const prevRef = useRef(null)
  const nextRef = useRef(null)
  const dotsRef = useRef(null)
  const instanceRef = useRef(null)
  const [ready, setReady] = useState(false)

  // Dynamically import Glider.js + CSS only on the client
  useEffect(() => {
    let cancelled = false

    async function loadGlider() {
      try {
        await import("glider-js/glider.min.css")
        await import("../components/glider-custom.css")
        if (!cancelled) setReady(true)
      } catch (e) {
        console.error("[Carousel] Failed to load Glider.js assets:", e)
      }
    }

    loadGlider()
    return () => { cancelled = true }
  }, [])

  // Initialise Glider once CSS is loaded and DOM is ready
  useEffect(() => {
    if (!ready || !gliderRef.current || products.length === 0) return

    const timer = setTimeout(() => {
      const GliderJS = require("glider-js")

      if (instanceRef.current) {
        instanceRef.current.destroy()
      }

      // Build responsive breakpoints based on backend `columns` setting
      // On mobile always show 2, then scale up to the configured `columns` value
      const col = Math.max(2, Math.min(columns, 6))
      instanceRef.current = new GliderJS(gliderRef.current, {
        slidesToShow: 2,
        slidesToScroll: 1,
        draggable: true,
        dots: dotsRef.current,
        arrows: {
          prev: prevRef.current,
          next: nextRef.current,
        },
        responsive: [
          { breakpoint: 480,  settings: { slidesToShow: Math.min(col, 2), slidesToScroll: 1 } },
          { breakpoint: 640,  settings: { slidesToShow: Math.min(col, 3), slidesToScroll: 1 } },
          { breakpoint: 768,  settings: { slidesToShow: Math.min(col, 4), slidesToScroll: 2 } },
          { breakpoint: 1024, settings: { slidesToShow: Math.min(col, 5), slidesToScroll: 2 } },
          { breakpoint: 1280, settings: { slidesToShow: col,              slidesToScroll: 2 } },
        ],
      })
    }, 50)

    return () => {
      clearTimeout(timer)
      if (instanceRef.current) {
        instanceRef.current.destroy()
        instanceRef.current = null
      }
    }
  }, [ready, products, columns])

  return (
    <div className="relative glider-carousel-wrapper">
      {/* Prev Arrow */}
      <button
        ref={prevRef}
        className="absolute -left-4 top-1/2 -translate-y-1/2 z-10 w-9 h-9 bg-white shadow-md rounded-full flex items-center justify-center text-gray-600 hover:text-gray-900 hover:shadow-lg transition-all border border-gray-200"
        aria-label="Previous"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      {/* Glider Track */}
      <div ref={gliderRef} className="glider">
        {products.map((p) => (
          <div key={p._id || p.id} className="px-1.5">
            <ProductCard product={p} />
          </div>
        ))}
      </div>

      {/* Next Arrow */}
      <button
        ref={nextRef}
        className="absolute -right-4 top-1/2 -translate-y-1/2 z-10 w-9 h-9 bg-white shadow-md rounded-full flex items-center justify-center text-gray-600 hover:text-gray-900 hover:shadow-lg transition-all border border-gray-200"
        aria-label="Next"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {/* Dots */}
      <div ref={dotsRef} className="mt-4"></div>
    </div>
  )
}

// ─── Layout: List ────────────────────────────────────────────────────────────
function ListLayout({ products }) {
  return (
    <div className="space-y-3">
      {products.map((product) => {
        const productId = product._id || product.id
        const imgRaw = product.mainImage || product.images?.[0]
        const imageUrl = imgRaw ? (imgRaw.startsWith("http") ? imgRaw : `http://localhost:8080${imgRaw}`) : null
        return (
          <Link key={productId} href={`/product/${productId}`} className="group flex items-center bg-white rounded-lg border border-gray-100 overflow-hidden hover:shadow-md transition-all duration-200">
            <div className="relative w-28 h-28 sm:w-36 sm:h-36 flex-shrink-0 bg-gray-100 overflow-hidden">
              {imageUrl ? (
                <img src={imageUrl} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-200 to-gray-300">
                  <span className="text-gray-400 text-xs">No Image</span>
                </div>
              )}
              {product.discountPercentage > 0 && (
                <span className="absolute top-1.5 left-1.5 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">{product.discountPercentage}% OFF</span>
              )}
            </div>
            <div className="flex-1 p-4 min-w-0">
              <h3 className="text-base font-semibold text-gray-900 mb-1 line-clamp-1 group-hover:text-blue-600 transition-colors">{product.name}</h3>
              {product.description && (
                <p className="text-xs text-gray-500 mb-2 line-clamp-2">{product.description.replace(/<[^>]*>/g, "").substring(0, 120)}</p>
              )}
              <div className="flex items-center space-x-3">
                <span className="text-lg font-bold text-gray-900">₹{product.discountedPrice || product.price}</span>
                {product.discountedPrice && product.discountedPrice < product.price && (
                  <span className="text-sm text-gray-400 line-through">₹{product.price}</span>
                )}
              </div>
              {product.category && (
                <span className="inline-block mt-2 text-[10px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{product.category.name}</span>
              )}
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
        const productId = product._id || product.id
        const imgRaw = product.mainImage || product.images?.[0]
        const imageUrl = imgRaw ? (imgRaw.startsWith("http") ? imgRaw : `http://localhost:8080${imgRaw}`) : null
        return (
          <Link key={productId} href={`/product/${productId}`} className="group block bg-white rounded-lg overflow-hidden border border-gray-100 hover:shadow-lg transition-all duration-200 break-inside-avoid">
            <div className={`relative ${aspects[i % 5]} bg-gray-100 overflow-hidden`}>
              {imageUrl ? (
                <img src={imageUrl} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-200 to-gray-300">
                  <span className="text-gray-400 text-xs">No Image</span>
                </div>
              )}
              {product.discountPercentage > 0 && (
                <span className="absolute top-2 left-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">{product.discountPercentage}% OFF</span>
              )}
            </div>
            <div className="p-3">
              <h3 className="text-sm font-medium text-gray-900 mb-1 line-clamp-2 group-hover:text-blue-600 transition-colors leading-tight">{product.name}</h3>
              <div className="flex items-center space-x-2 mt-1">
                <span className="text-sm font-bold text-gray-900">₹{product.discountedPrice || product.price}</span>
                {product.discountedPrice && product.discountedPrice < product.price && (
                  <span className="text-xs text-gray-400 line-through">₹{product.price}</span>
                )}
              </div>
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-2">
            <span className="text-xl">{icon}</span>
            <h2 className="text-2xl font-bold" style={{ color: textColor }}>{section.name}</h2>
            {showCount && (
              <span className="text-sm text-gray-500 ml-2">({products.length})</span>
            )}
          </div>
          {showViewAll && (
            <Link href={viewAllLink} className="text-blue-600 hover:text-blue-700 font-semibold text-sm flex items-center">
              View All
              <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          )}
        </div>

        {section.description && (
          <p className="text-sm text-gray-500 mb-4 -mt-2">{section.description}</p>
        )}

        {/* Layout: grid | carousel | list | masonry — from displayConfig.layoutStyle */}
        <LayoutRenderer layout={layout} products={products} columns={columns} />
      </div>
    </div>
  )
}

// ─── Main Export ─────────────────────────────────────────────────────────────
export function FeaturedProductSections() {
  const [sections, setSections] = useState([])
  const [loading, setLoading] = useState(true)
  const [fallbackProducts, setFallbackProducts] = useState([])

  useEffect(() => {
    fetchHomepageSections()
  }, [])

  const fetchHomepageSections = async () => {
    try {
      setLoading(true)

      const res = await fetch("/api/homepage-sections", { cache: "no-store" })
      
      if (!res.ok) {
        // Try to get error details from response
        let errorData = null
        try {
          errorData = await res.json()
        } catch {
          // Response might not be JSON
        }
        
        console.error("[Homepage] Failed to fetch sections:", {
          status: res.status,
          statusText: res.statusText,
          error: errorData?.error || "Unknown error",
          details: errorData?.details || errorData,
        })
        
        throw new Error(`HTTP ${res.status}: ${errorData?.error || res.statusText}`)
      }
      
      const data = await res.json()

      if (data?.sections && Array.isArray(data.sections)) {
        const activeSections = data.sections
          .filter((s) => s.isActive !== false && s.status === "active")
          .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0))

        console.log(
          `[Homepage] ${activeSections.length} sections:`,
          activeSections.map((s) => `${s.name} (${s.displayConfig?.layoutStyle || "grid"}, ${s.products?.length || 0} products)`)
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
      <div className="py-12 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-3 text-sm text-gray-500">Loading products...</p>
      </div>
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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
