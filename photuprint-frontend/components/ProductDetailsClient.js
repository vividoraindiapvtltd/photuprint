"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { useMediaQuery } from "../src/hooks/useMediaQuery"
import dynamic from "next/dynamic"
import Link from "next/link"
import Image from "next/image"
import DOMPurify from "isomorphic-dompurify"
import { getImageSrc } from "../src/utils/imageUrl"

function sanitizeHtml(html) {
  if (!html || typeof html !== "string") return ""
  const purifier = DOMPurify?.default ?? DOMPurify
  const sanitize = purifier?.sanitize ?? (typeof purifier === "function" ? purifier : null)
  if (typeof sanitize === "function") return sanitize.call(purifier, html)
  return html.replace(/<[^>]+>/g, " ")
}
<<<<<<< Updated upstream
import ColorSelector from "../src/components/product/ColorSelector"
import ProductImageCarousel from "../src/components/product/ProductImageCarousel"
import TopBar from "./TopBar"
=======
const ColorSelector = dynamic(() => import("../src/components/product/ColorSelector"), { ssr: false })
const ProductImageCarousel = dynamic(() => import("../src/components/product/ProductImageCarousel"), { ssr: false })
>>>>>>> Stashed changes
import NavigationBar from "./NavigationBar"
import Footer from "./Footer"
import { useAuth } from "../src/context/AuthContext"
import { useCart } from "../src/context/CartContext"
import { useFlyToCart } from "../src/hooks/useFlyToCart"
import api from "../src/utils/api"
import { addGuestRecentlyViewed } from "../src/utils/guestRecentlyViewed"
import { getProductSlug, slugify } from "../src/utils/slugify"
import { GridLayout } from "./FeaturedProductSection"

const ProductReviews = dynamic(() => import("../src/components/ProductReviews"), { ssr: false })
const TemplateEditor = dynamic(() => import("../src/components/TemplateEditor"), { ssr: false })
const RecentlyViewedProducts = dynamic(
  () => import("./FeaturedProductSection").then((m) => ({ default: m.RecentlyViewedProducts })),
  { ssr: false },
)

export default function ProductDetailsClient({ initialProduct }) {
  const { isAuthenticated } = useAuth()
  const { addItem: addToCart } = useCart()
  const [isInWishlist, setIsInWishlist] = useState(false)
  const [addToCartSuccess, setAddToCartSuccess] = useState(false)
  const [product, setProduct] = useState(initialProduct || null)
  const [variants, setVariants] = useState(() => {
    const colors = initialProduct?.colors || []
    return Array.isArray(colors) ? colors : []
  })
  const [selected, setSelected] = useState(() => {
    const colors = initialProduct?.colors || []
    return colors.length ? colors[0] : null
  })
  const [loading, setLoading] = useState(!initialProduct)
  const [error, setError] = useState("")
  const [viewMode, setViewMode] = useState(() => {
    const mode = initialProduct?.displayMode || "both"
    if (mode === "customized") return "customized"
    if (mode === "standard") return "standard"
    return "standard"
  })
  const [savedDesign, setSavedDesign] = useState(null)
  const [showSaveSuccess, setShowSaveSuccess] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [templates, setTemplates] = useState([])
  const [backgroundImage, setBackgroundImage] = useState(null)
  const [templatesLoading, setTemplatesLoading] = useState(false)
  const templatesFetchedRef = useRef(false)
  const preloadedImagesRef = useRef(new Set())
  const [relatedProducts, setRelatedProducts] = useState([])
  const productImageRef = useRef(null)
  const runFlyToCart = useFlyToCart()
<<<<<<< Updated upstream
=======
  const [quantity, setQuantity] = useState(1)
  const [enquiryOpen, setEnquiryOpen] = useState(false)
  const [enquirySubmitting, setEnquirySubmitting] = useState(false)
  const [enquirySuccess, setEnquirySuccess] = useState(false)
  const [enquiryError, setEnquiryError] = useState("")
  const [enquiryForm, setEnquiryForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    company: "",
    quantity: 1,
    notes: "",
  })
  const [isMounted, setIsMounted] = useState(false)
  const isMdUp = useMediaQuery("(min-width: 768px)")
  const [enquirySheetDragY, setEnquirySheetDragY] = useState(0)
  const enquirySheetDragYRef = useRef(0)
  const enquiryTouchStartY = useRef(null)

  const closeEnquiry = useCallback(() => {
    setEnquiryOpen(false)
    setEnquirySheetDragY(0)
    enquirySheetDragYRef.current = 0
    enquiryTouchStartY.current = null
  }, [])

  useEffect(() => {
    if (!enquiryOpen || isMdUp) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKey = (e) => {
      if (e.key === "Escape") closeEnquiry()
    }
    window.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener("keydown", onKey)
    }
  }, [enquiryOpen, isMdUp, closeEnquiry])

  const onEnquirySheetTouchStart = (e) => {
    enquiryTouchStartY.current = e.touches[0].clientY
  }
  const onEnquirySheetTouchMove = (e) => {
    if (enquiryTouchStartY.current == null) return
    const dy = e.touches[0].clientY - enquiryTouchStartY.current
    if (dy > 0) {
      enquirySheetDragYRef.current = dy
      setEnquirySheetDragY(dy)
    }
  }
  const onEnquirySheetTouchEnd = () => {
    if (enquirySheetDragYRef.current > 100) closeEnquiry()
    else {
      setEnquirySheetDragY(0)
      enquirySheetDragYRef.current = 0
    }
    enquiryTouchStartY.current = null
  }

  useEffect(() => {
    if (isMdUp) {
      setEnquirySheetDragY(0)
      enquirySheetDragYRef.current = 0
    }
  }, [isMdUp])
>>>>>>> Stashed changes

  const categoryId = product?.category?._id || product?.categoryId?._id || product?.categoryId || product?.category
  const displayMode = product?.displayMode || "both"
  const productId = product?._id || product?.id
  const productSlug = product ? getProductSlug(product) : ""

  const preloadImage = useCallback((url) => {
    return new Promise((resolve) => {
      if (!url || preloadedImagesRef.current.has(url)) {
        resolve(true)
        return
      }
      const img = new Image()
      img.crossOrigin = "anonymous"
      img.onload = () => {
        preloadedImagesRef.current.add(url)
        resolve(true)
      }
      img.onerror = () => resolve(false)
      img.src = url.startsWith("http") ? url : `http://localhost:8080${url}`
    })
  }, [])

  const preloadTemplateImages = useCallback(
    async (templateList) => {
      const imagesToPreload = []
      templateList.forEach((t) => {
        if (t.previewImage) imagesToPreload.push(t.previewImage)
        if (t.backgroundImages?.length) imagesToPreload.push(...t.backgroundImages)
      })
      await Promise.all(imagesToPreload.map(preloadImage))
    },
    [preloadImage],
  )

  useEffect(() => {
    const fetchTemplates = async () => {
      const fetchKey = `${categoryId}-${displayMode}-${viewMode}`
      if (templatesFetchedRef.current === fetchKey) return

      if (categoryId && (displayMode === "customized" || (displayMode === "both" && viewMode === "customized"))) {
        try {
          setTemplatesLoading(true)
          const response = await api.get(`/templates/category/${categoryId}?isActive=true`)
          const fetchedTemplates = response.data || []
          await preloadTemplateImages(fetchedTemplates)
          setTemplates(fetchedTemplates)
          templatesFetchedRef.current = fetchKey
          if (fetchedTemplates.length > 0) {
            const firstTemplate = fetchedTemplates[0]
            setSelectedTemplate(firstTemplate)
            const bgImages = firstTemplate.backgroundImages || []
            if (bgImages.length > 0) {
              await preloadImage(bgImages[0])
              setBackgroundImage(bgImages[0])
            } else {
              setBackgroundImage(null)
            }
          } else {
            setSelectedTemplate(null)
            setBackgroundImage(null)
          }
          setTemplatesLoading(false)
        } catch (err) {
          console.error("Error fetching templates:", err)
          setTemplates([])
          setSelectedTemplate(null)
          setTemplatesLoading(false)
        }
      } else {
        setTemplatesLoading(false)
      }
    }
    fetchTemplates()
  }, [categoryId, displayMode, viewMode, preloadTemplateImages, preloadImage])

  useEffect(() => {
    if (displayMode === "customized" || (displayMode === "both" && viewMode === "customized")) {
      const activeTemplate = selectedTemplate || (templates.length > 0 ? templates[0] : null)
      if (activeTemplate) {
        const bgImages = activeTemplate.backgroundImages || []
        setBackgroundImage(bgImages.length > 0 ? bgImages[0] : null)
      } else {
        setBackgroundImage(null)
      }
    } else {
      const mainImage = selected?.image || product?.mainImage || product?.images?.[0]
      setBackgroundImage(mainImage)
    }
  }, [viewMode, selectedTemplate, templates, displayMode, selected, product])

  useEffect(() => {
    if (typeof window === "undefined" || !productId) return
    const id = String(productId).trim()
    if (!id) return
    if (isAuthenticated) {
      const ac = new AbortController()
      api.post("/recently-viewed-products", { productId: id }, { signal: ac.signal }).catch(() => {})
      return () => ac.abort()
    }
    addGuestRecentlyViewed(id)
  }, [productId, isAuthenticated])

  const toggleWishlist = async () => {
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
      console.error("Error toggling wishlist:", err)
    }
  }

  useEffect(() => {
    if (!isAuthenticated || !productId) return
    api
      .get(`/wishlist/check/${productId}`)
      .then((res) => setIsInWishlist(res.data?.inWishlist === true))
      .catch(() => setIsInWishlist(false))
  }, [isAuthenticated, productId])

  useEffect(() => {
    if (!categoryId || !productId) return
    api
      .get(`/products?categoryId=${categoryId}&showInactive=false&includeDeleted=false&limit=20`, { skipAuth: true })
      .then((res) => {
        const data = res?.data ?? res
        const list = data?.products ?? (Array.isArray(data) ? data : [])
        const others = (Array.isArray(list) ? list : []).filter((p) => (p._id || p.id) !== productId).slice(0, 8)
        setRelatedProducts(others)
      })
      .catch(() => setRelatedProducts([]))
  }, [categoryId, productId])

  useEffect(() => {
    if (product) {
      const mode = product.displayMode || "both"
      if (mode === "customized") setViewMode("customized")
      else if (mode === "standard") setViewMode("standard")
    }
  }, [product])

  const handleTemplateSelect = async (template) => {
    if (selectedTemplate?._id === template._id) return
    setSelectedTemplate(template)
    const bgImages = template.backgroundImages || []
    if (bgImages.length > 0) setBackgroundImage(bgImages[0])
  }

  const handleDesignSave = (designData) => {
    setSavedDesign(designData)
    setShowSaveSuccess(true)
    setTimeout(() => setShowSaveSuccess(false), 3000)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="sticky top-0 z-50 w-full">
          <NavigationBar />
        </header>
        <div className="w-full mx-auto p-4 sm:px-6 lg:px-8">
          <div className="text-center py-16">
            <div className="inline-flex items-center space-x-3">
              <svg className="animate-spin h-8 w-8 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="text-gray-600 text-lg">Loading product...</span>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    )
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="sticky top-0 z-50 w-full">
          <NavigationBar />
        </header>
        <div className="w-full mx-auto p-4 sm:px-6 lg:px-8 pt-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
            <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Product Not Found</h2>
            <p className="text-gray-500 mb-6">{error || "The product you're looking for doesn't exist or has been removed."}</p>
            <div className="flex justify-center gap-4">
              <Link href="/products" className="px-6 py-3 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
                Browse Products
              </Link>
              <button onClick={() => window.history.back()} className="px-6 py-3 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                Go Back
              </button>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    )
  }

  const showToggle = displayMode === "both"
  const showCustomizedView = displayMode === "customized" || (displayMode === "both" && viewMode === "customized")
  const mainProductImage = product?.mainImage || product?.images?.[0]
  const galleryList = product?.images?.length ? [...product.images] : mainProductImage ? [mainProductImage] : []
  const productGalleryImages = mainProductImage ? [mainProductImage, ...galleryList.filter((u) => u !== mainProductImage)] : galleryList
  const productCarouselBadge = product?.fit || product?.category?.name || (product?.categoryId?.name ?? null)
  const activeTemplate = selectedTemplate || (templates.length > 0 ? templates[0] : null)

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-50 w-full">
        <NavigationBar />
      </header>

      <div className="mx-auto w-full max-w-[100vw] overflow-x-hidden px-3 pt-4 pb-2 sm:px-6 sm:pt-6 lg:px-8">
        {showSaveSuccess && (
          <div className="fixed bottom-4 left-1/2 z-50 max-w-[calc(100%-2rem)] -translate-x-1/2 animate-pulse md:bottom-auto md:left-auto md:translate-x-0 md:top-24 md:right-4">
            <div className="bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center space-x-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Design saved successfully!</span>
            </div>
          </div>
        )}

        <nav className="mb-4 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-gray-500 sm:mb-6 sm:gap-2 sm:text-sm" aria-label="Breadcrumb">
          <Link href="/" className="shrink-0 hover:text-gray-900">
            Home
          </Link>
          <span className="shrink-0" aria-hidden>
            /
          </span>
          {product?.category?.name && (
            <>
              <Link href={product?.category?.slug ? `/${product.category.slug}` : `/${slugify(product.category.name)}`} className="min-w-0 truncate hover:text-gray-900">
                {product.category.name}
              </Link>
              <span className="shrink-0" aria-hidden>
                /
              </span>
            </>
          )}
          <span className="min-w-0 font-medium text-gray-900 line-clamp-2 sm:line-clamp-none sm:max-w-none">{product?.name}</span>
        </nav>

        <div className="mb-8 grid gap-6 lg:mb-10 lg:grid-cols-2 lg:gap-8">
          <div className="lg:col-span-1">
<<<<<<< Updated upstream
            <div className="sticky top-24">
              <div className="bg-white rounded-lg border-2 border-gray-300 shadow-lg overflow-hidden">
                <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-700">Product Preview</h3>
                  {showCustomizedView && activeTemplate && <span className="text-xs text-gray-500">{activeTemplate.name}</span>}
=======
            <div className="lg:sticky lg:top-24">
              <div className="overflow-hidden rounded-xl border-2 border-gray-300 bg-white shadow-lg sm:rounded-lg">
                <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-3 py-2.5 sm:px-4 sm:py-3">
                  <h3 className="text-xs font-semibold text-gray-700 sm:text-sm">Product Preview</h3>
                  {showCustomizedView && activeTemplate && (
                    <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded">
                      Editing: {activeTemplate.name}
                    </span>
                  )}
>>>>>>> Stashed changes
                </div>

                <div
                  ref={productImageRef}
                  className="relative bg-gray-100 aspect-square min-h-[min(88vw,22rem)] max-h-[min(78vh,36rem)] sm:min-h-[24rem] sm:max-h-[min(85vh,40rem)] lg:min-h-[28rem] lg:max-h-[700px]"
                >
                  {templatesLoading && showCustomizedView && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-20">
                      <div className="flex flex-col items-center space-y-3">
                        <svg className="animate-spin h-8 w-8 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span className="text-sm text-gray-500">Loading templates...</span>
                      </div>
                    </div>
                  )}

                  {showCustomizedView && activeTemplate ? (
                    <div className="absolute inset-0">
                      <TemplateEditor key={activeTemplate._id || activeTemplate.id} template={activeTemplate} onSave={handleDesignSave} simplified={true} constrained={true} />
                    </div>
                  ) : showCustomizedView ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-50 relative">
                      {backgroundImage ? (
                        <Image src={getImageSrc(backgroundImage) || backgroundImage} alt={product?.name ?? ""} fill className="object-contain" sizes="(max-width: 768px) 100vw, 50vw" data-main-image />
                      ) : (
                        <div className="text-gray-400 text-center">
                          <svg className="w-16 h-16 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <p className="text-sm">No templates available</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="absolute inset-0 flex flex-col bg-gray-50 transition-opacity duration-300 p-3" style={{ opacity: 1 }}>
                      {savedDesign && viewMode === "customized" ? (
                        <div className="relative w-full h-full">
                          {savedDesign.image?.startsWith("data:") || savedDesign.image?.startsWith("blob:") ? (
                            <img src={savedDesign.image} alt={`Customized ${product?.name}`} className="w-full h-full object-contain" data-main-image />
                          ) : (
                            <Image src={getImageSrc(savedDesign.image) || savedDesign.image} alt={`Customized ${product?.name}`} fill className="object-contain" sizes="(max-width: 768px) 100vw, 50vw" data-main-image />
                          )}
                          <div className="absolute top-2 left-2 bg-green-500 text-white text-xs px-2 py-1 rounded">Customized Design</div>
                        </div>
                      ) : productGalleryImages.length > 0 ? (
                        <ProductImageCarousel images={productGalleryImages} alt={product?.name} badgeText={productCarouselBadge} className="flex-1 min-h-0" />
                      ) : (
                        <div className="flex-1 flex items-center justify-center text-gray-400 text-center">
                          <div>
                            <svg className="w-16 h-16 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <p className="text-sm">No image available</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {showCustomizedView && templates.length > 0 && (
                    <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/70 to-transparent p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4">
                      <div className="-mx-1 flex snap-x snap-mandatory items-center gap-2 overflow-x-auto px-1 pb-2 [scrollbar-width:thin]">
                        {templates.map((tmpl) => {
                          const isSelected = selectedTemplate?._id === tmpl._id || selectedTemplate?.id === tmpl.id || (!selectedTemplate && templates[0]?._id === tmpl._id)
                          const previewImg = tmpl.previewImage || tmpl.backgroundImages?.[0]
                          return (
                            <button
                              key={tmpl._id || tmpl.id}
                              type="button"
                              onClick={() => handleTemplateSelect(tmpl)}
                              className={`relative h-14 w-14 shrink-0 snap-start overflow-hidden rounded-lg border-2 transition-transform duration-200 sm:h-16 sm:w-16 ${isSelected ? "scale-105 border-blue-400 shadow-lg ring-2 ring-blue-300" : "border-white/50 hover:scale-105 hover:border-white active:scale-95"}`}
                              title={tmpl.name}
                            >
                              {previewImg ? (
                                <Image src={getImageSrc(previewImg) || previewImg} alt={tmpl.name} fill sizes="64px" className="object-cover" />
                              ) : (
                                <div className="w-full h-full bg-gray-300 flex items-center justify-center">
                                  <span className="text-xs text-gray-600">{tmpl.name?.charAt(0)}</span>
                                </div>
                              )}
                            </button>
                          )
                        })}
                      </div>
                      <p className="text-xs text-white/80 mt-1">Select a template to customize</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

<<<<<<< Updated upstream
          <div className="lg:col-span-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3 leading-tight">{product?.name}</h1>
            {isAuthenticated && (
              <button onClick={toggleWishlist} className={`mb-3 p-2 rounded-full transition-all ${isInWishlist ? "bg-red-50 text-red-500" : "bg-gray-100 text-gray-400 hover:bg-red-50 hover:text-red-500"}`} title={isInWishlist ? "Remove from wishlist" : "Add to wishlist"}>
                <svg className="w-6 h-6" fill={isInWishlist ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </button>
            )}
=======
          <div className="min-w-0 lg:col-span-1" suppressHydrationWarning>
            <div className="mb-3 flex items-start gap-3">
              <h1 className="min-w-0 flex-1 text-xl font-bold leading-tight text-gray-900 sm:text-2xl md:text-3xl">{product?.name}</h1>
              {isMounted && isAuthenticated && (
                <button
                  type="button"
                  onClick={toggleWishlist}
                  className={`mt-0.5 shrink-0 rounded-full p-2.5 transition-all min-h-[44px] min-w-[44px] flex items-center justify-center ${isInWishlist ? "bg-red-50 text-red-500" : "bg-gray-100 text-gray-400 hover:bg-red-50 hover:text-red-500"}`}
                  title={isInWishlist ? "Remove from wishlist" : "Add to wishlist"}
                  aria-label={isInWishlist ? "Remove from wishlist" : "Add to wishlist"}
                >
                  <svg className="h-6 w-6" fill={isInWishlist ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </button>
              )}
            </div>
>>>>>>> Stashed changes

            {product?.price && (
              <p className="mb-4 text-xl font-bold text-gray-900 sm:text-2xl">
                ₹{product.discountedPrice || product.price}
                {product.discountedPrice && <span className="text-base text-gray-500 line-through ml-2 font-normal">₹{product.price}</span>}
                {product.discountPercentage && <span className="ml-2 text-sm text-green-600 font-medium">({product.discountPercentage}% off)</span>}
              </p>
            )}
<<<<<<< Updated upstream
            {product?.description && <div className="text-gray-700 mb-6 prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: sanitizeHtml(product.description) }} />}
=======
            {product?.description && (
              <div
                className="prose prose-sm mb-6 max-w-none break-words text-gray-700 prose-p:text-[15px] prose-p:leading-relaxed sm:prose-p:text-base"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(product.description) }}
                suppressHydrationWarning
              />
            )}
>>>>>>> Stashed changes

            <ColorSelector variants={variants} selectedId={selected?._id} onChange={(_, v) => setSelected(v)} />

            {showToggle && (
              <div className="mb-4 mt-6">
                <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                  <span className={`text-sm font-medium ${viewMode === "standard" ? "text-gray-900" : "text-gray-500"}`}>Standard</span>
                  <button
                    type="button"
                    onClick={() => {
                      setViewMode(viewMode === "standard" ? "customized" : "standard")
                      setSelectedTemplate(null)
                    }}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${viewMode === "customized" ? "bg-blue-600" : "bg-gray-200"}`}
                    role="switch"
                    aria-checked={viewMode === "customized"}
                  >
                    <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${viewMode === "customized" ? "translate-x-5" : "translate-x-0"}`} />
                  </button>
                  <span className={`text-sm font-medium ${viewMode === "customized" ? "text-gray-900" : "text-gray-500"}`}>Customized</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">{viewMode === "standard" ? "View standard product design" : "Select a template and customize your design in the preview area"}</p>
              </div>
            )}

            {displayMode === "customized" && (
              <div className="mt-6 mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                <p className="text-sm text-blue-800">
                  <span className="font-medium">✨ Customizable Product</span> - Select a template from the thumbnails and upload your image to customize
                </p>
              </div>
            )}

            {savedDesign && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-sm text-green-800">You have a saved customized design</span>
                  </div>
                  <button onClick={() => setSavedDesign(null)} className="text-xs text-green-700 underline hover:no-underline">
                    Clear
                  </button>
                </div>
              </div>
            )}

<<<<<<< Updated upstream
            <div className="mt-6 flex flex-col sm:flex-row gap-3">
=======
            <div className="mt-6 space-y-4 rounded-xl border border-gray-200 bg-gray-50 p-4 sm:rounded-lg">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                <span className="text-sm font-medium text-gray-700">Quantity</span>
                <div className="inline-flex w-fit shrink-0 items-center overflow-hidden rounded-md border border-gray-300 bg-white">
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="flex min-h-[44px] min-w-[44px] items-center justify-center px-2 text-lg text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-400 sm:min-h-0 sm:min-w-0 sm:px-3 sm:py-2 sm:text-base"
                    aria-label="Decrease quantity"
                  >
                    −
                  </button>
                  <span className="min-w-[3rem] px-3 py-2 text-center text-base font-medium tabular-nums text-gray-900 sm:min-w-[2.5rem] sm:px-4 sm:text-sm" aria-live="polite">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => q + 1)}
                    className="flex min-h-[44px] min-w-[44px] items-center justify-center px-2 text-lg leading-none text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-400 sm:min-h-0 sm:min-w-0 sm:px-3 sm:py-2 sm:text-base"
                    aria-label="Increase quantity"
                  >
                    +
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEnquiryForm((f) => ({ ...f, quantity }))
                  setEnquiryOpen(true)
                  setEnquirySuccess(false)
                  setEnquiryError("")
                }}
                className="text-sm text-blue-600 hover:text-blue-800 underline"
              >
                Bulk product enquiry
              </button>
              <div className="flex flex-col gap-3 pt-1 sm:flex-row">
>>>>>>> Stashed changes
              <button
                type="button"
                onClick={() => {
                  const image = savedDesign?.image || selected?.image || product?.mainImage || product?.images?.[0]
                  const containerEl = productImageRef.current
                  const mainImgEl = containerEl?.querySelector?.("[data-main-image]")
                  const sourceRect = (mainImgEl || containerEl)?.getBoundingClientRect?.()
                  if (image && sourceRect) {
                    runFlyToCart(image, sourceRect)
                  }
                  addToCart({
                    productId: productId,
                    slug: productSlug,
                    name: product?.name,
                    price: product?.price,
                    discountedPrice: product?.discountedPrice,
                    quantity: 1,
                    image,
                    variant: selected || null,
                    customDesign: savedDesign || null,
                  })
                  setAddToCartSuccess(true)
                  setTimeout(() => setAddToCartSuccess(false), 3000)
                }}
                className="inline-flex min-h-[48px] w-full items-center justify-center rounded-md bg-gray-900 px-6 py-3.5 text-sm font-semibold uppercase tracking-wide text-white transition-colors hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 sm:w-auto sm:px-8"
              >
                Add to bag
              </button>
              <Link href="/cart" className="inline-flex min-h-[48px] w-full items-center justify-center rounded-md border-2 border-gray-900 px-6 py-3.5 text-sm font-semibold uppercase tracking-wide text-gray-900 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 sm:w-auto sm:px-8">
                Go to bag
              </Link>
            </div>
<<<<<<< Updated upstream
=======
            </div>

            {enquiryOpen && (
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-[100] bg-black/40 animate-pp-backdrop-in md:animate-none border-0 cursor-default"
                  aria-label="Close enquiry"
                  onClick={closeEnquiry}
                />
                <div
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="enquiry-title"
                  className={
                    isMdUp
                      ? "fixed top-0 right-0 bottom-0 z-[101] flex w-full max-w-md flex-col bg-white shadow-xl"
                      : "fixed bottom-0 left-0 right-0 z-[101] flex max-h-[90vh] flex-col rounded-t-2xl bg-white shadow-[0_-8px_30px_rgba(0,0,0,0.12)] animate-pp-sheet-up"
                  }
                  style={!isMdUp && enquirySheetDragY > 0 ? { transform: `translateY(${enquirySheetDragY}px)`, transition: "none" } : undefined}
                  onTouchStart={!isMdUp ? onEnquirySheetTouchStart : undefined}
                  onTouchMove={!isMdUp ? onEnquirySheetTouchMove : undefined}
                  onTouchEnd={!isMdUp ? onEnquirySheetTouchEnd : undefined}
                >
                  <div className={`flex shrink-0 flex-col border-b border-gray-200 ${isMdUp ? "bg-gray-50" : "items-center bg-white px-4 pt-3 pb-0"}`}>
                    {!isMdUp && <div className="mb-2 h-1 w-10 shrink-0 rounded-full bg-gray-300" aria-hidden />}
                    <div className={`flex w-full items-center justify-between ${isMdUp ? "px-4 py-3" : "px-0 pb-3"}`}>
                      <h2 id="enquiry-title" className="text-lg font-semibold text-gray-900">
                        Bulk product enquiry
                      </h2>
                      <button type="button" onClick={closeEnquiry} className="p-2 text-gray-500 hover:text-gray-700 rounded-md hover:bg-gray-200 min-h-[44px] min-w-[44px] flex items-center justify-center" aria-label="Close">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                {enquirySuccess ? (
                  <div className="py-6 text-center">
                    <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
                      <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <p className="text-gray-900 font-medium">Thank you!</p>
                    <p className="text-sm text-gray-600 mt-1">We have received your enquiry and will get back to you soon.</p>
                  </div>
                ) : (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault()
                      const email = (enquiryForm.email || "").trim()
                      const phone = (enquiryForm.phone || "").trim()
                      if (!email && !phone) {
                        setEnquiryError("Please enter your email or phone number.")
                        return
                      }
                      setEnquiryError("")
                      setEnquirySubmitting(true)
                      try {
                        await api.post(
                          "/clients/lead",
                          {
                            firstName: (enquiryForm.firstName || "").trim() || "Enquiry",
                            lastName: (enquiryForm.lastName || "").trim(),
                            email: email || undefined,
                            phone: phone || undefined,
                            company: (enquiryForm.company || "").trim() || undefined,
                            productName: product?.name || "",
                            quantity: enquiryForm.quantity != null ? Number(enquiryForm.quantity) : quantity,
                            notes: (enquiryForm.notes || "").trim() || undefined,
                          },
                          { skipAuth: true },
                        )
                        setEnquirySuccess(true)
                      } catch (err) {
                        const msg = err.response?.data?.msg || err.message || "Something went wrong. Please try again."
                        setEnquiryError(msg)
                      } finally {
                        setEnquirySubmitting(false)
                      }
                    }}
                    className="space-y-4"
                  >
                    <p className="text-sm text-gray-600">
                      Product: <strong>{product?.name}</strong>
                    </p>
                    <div>
                      <label htmlFor="enquiry-firstName" className="block text-sm font-medium text-gray-700 mb-1">
                        First name *
                      </label>
                      <input
                        id="enquiry-firstName"
                        type="text"
                        required
                        value={enquiryForm.firstName}
                        onChange={(e) => setEnquiryForm((f) => ({ ...f, firstName: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Your first name"
                      />
                    </div>
                    <div>
                      <label htmlFor="enquiry-lastName" className="block text-sm font-medium text-gray-700 mb-1">
                        Last name
                      </label>
                      <input
                        id="enquiry-lastName"
                        type="text"
                        value={enquiryForm.lastName}
                        onChange={(e) => setEnquiryForm((f) => ({ ...f, lastName: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Last name"
                      />
                    </div>
                    <div>
                      <label htmlFor="enquiry-email" className="block text-sm font-medium text-gray-700 mb-1">
                        Email
                      </label>
                      <input
                        id="enquiry-email"
                        type="email"
                        value={enquiryForm.email}
                        onChange={(e) => setEnquiryForm((f) => ({ ...f, email: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="you@example.com"
                      />
                    </div>
                    <div>
                      <label htmlFor="enquiry-phone" className="block text-sm font-medium text-gray-700 mb-1">
                        Phone
                      </label>
                      <input
                        id="enquiry-phone"
                        type="tel"
                        value={enquiryForm.phone}
                        onChange={(e) => setEnquiryForm((f) => ({ ...f, phone: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Phone number"
                      />
                    </div>
                    <div>
                      <label htmlFor="enquiry-company" className="block text-sm font-medium text-gray-700 mb-1">
                        Company
                      </label>
                      <input
                        id="enquiry-company"
                        type="text"
                        value={enquiryForm.company}
                        onChange={(e) => setEnquiryForm((f) => ({ ...f, company: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Company name"
                      />
                    </div>
                    <div>
                      <label htmlFor="enquiry-qty" className="block text-sm font-medium text-gray-700 mb-1">
                        Quantity
                      </label>
                      <input
                        id="enquiry-qty"
                        type="number"
                        min={1}
                        value={enquiryForm.quantity}
                        onChange={(e) =>
                          setEnquiryForm((f) => ({
                            ...f,
                            quantity: parseInt(e.target.value, 10) || 1,
                          }))
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label htmlFor="enquiry-notes" className="block text-sm font-medium text-gray-700 mb-1">
                        Message
                      </label>
                      <textarea
                        id="enquiry-notes"
                        rows={3}
                        value={enquiryForm.notes}
                        onChange={(e) => setEnquiryForm((f) => ({ ...f, notes: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Any additional details..."
                      />
                    </div>
                    <p className="text-xs text-gray-500">* Provide at least email or phone so we can contact you.</p>
                    {enquiryError && <p className="text-sm text-red-600">{enquiryError}</p>}
                    <div className="flex gap-2 pt-2">
                      <button
                        type="submit"
                        disabled={enquirySubmitting}
                        className="flex-1 px-4 py-2.5 bg-gray-900 text-white font-medium rounded-md hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {enquirySubmitting ? "Sending…" : "Submit enquiry"}
                      </button>
                      <button type="button" onClick={closeEnquiry} className="px-4 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-md hover:bg-gray-50">
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
                  </div>
                </div>
              </>
            )}

>>>>>>> Stashed changes
            {addToCartSuccess && (
              <p className="mt-3 text-sm text-green-600 font-medium">
                Added to bag.{" "}
                <Link href="/cart" className="underline hover:no-underline">
                  View bag
                </Link>
              </p>
            )}
            <Link href={`/products/${productSlug}/review`} className="mt-4 inline-block text-sm text-gray-500 hover:text-gray-900 underline">
              Write a Review
            </Link>

            <p className="mt-6 pt-6 border-t border-gray-200 text-xs text-gray-500">100% secure payments | Free return and exchange</p>
          </div>
        </div>

        {(product?.material || product?.fit || product?.careInstructions || product?.attributes) && (
          <section className="mb-10">
            <h2 className="mb-4 text-base font-bold uppercase tracking-wide text-gray-900 sm:text-lg">Product Attributes</h2>
            <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6">
              <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
                {product.material && (
                  <div>
                    <dt className="font-semibold text-gray-700 mb-1">Material</dt>
                    <dd className="text-gray-600">{product.material}</dd>
                  </div>
                )}
                {product.fit && (
                  <div>
                    <dt className="font-semibold text-gray-700 mb-1">Fit</dt>
                    <dd className="text-gray-600">{product.fit}</dd>
                  </div>
                )}
                {product.careInstructions && (
                  <div>
                    <dt className="font-semibold text-gray-700 mb-1">Care</dt>
                    <dd className="text-gray-600">{product.careInstructions}</dd>
                  </div>
                )}
                {product.attributes &&
                  typeof product.attributes === "object" &&
                  Object.entries(product.attributes).map(([k, v]) => (
                    <div key={k}>
                      <dt className="font-semibold text-gray-700 mb-1 capitalize">{k.replace(/([A-Z])/g, " $1").trim()}</dt>
                      <dd className="text-gray-600">{String(v)}</dd>
                    </div>
                  ))}
              </dl>
            </div>
          </section>
        )}

        <ProductReviews productId={productId} />

        {relatedProducts.length > 0 && (
          <section className="mb-10">
            <h2 className="text-lg font-bold text-gray-900 uppercase tracking-wide mb-4">You May Also Like</h2>
            <GridLayout products={relatedProducts} columns={4} />
          </section>
        )}
      </div>

      <RecentlyViewedProducts />
      <Footer />
    </div>
  )
}
