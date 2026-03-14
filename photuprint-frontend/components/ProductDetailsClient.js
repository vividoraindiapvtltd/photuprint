"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import Image from "next/image"
import { getImageSrc } from "../src/utils/imageUrl"

function sanitizeHtml(html) {
  if (!html || typeof html !== "string") return ""
  return String(html).replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "").replace(/<[^>]+>/g, " ")
}
const ColorSelector = dynamic(() => import("../src/components/product/ColorSelector"), { ssr: false })
const ProductImageCarousel = dynamic(() => import("../src/components/product/ProductImageCarousel"), { ssr: false })
import TopBar from "./TopBar"
import NavigationBar from "./NavigationBar"
import Footer from "./Footer"
import { useAuth } from "../src/context/AuthContext"
import { useCart } from "../src/context/CartContext"
import { useFlyToCart } from "../src/hooks/useFlyToCart"
import api from "../src/utils/api"
import { addGuestRecentlyViewed } from "../src/utils/guestRecentlyViewed"
import { getProductSlug, slugify } from "../src/utils/slugify"
const ProductReviews = dynamic(() => import("../src/components/ProductReviews"), { ssr: false })
const GridLayout = dynamic(
  () => import("./FeaturedProductSection").then((m) => ({ default: m.GridLayout })),
  { ssr: false },
)
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
  // Normalize variants for consistent SSR/client shape (avoids hydration mismatch)
  const [variants, setVariants] = useState(() => {
    const colors = initialProduct?.colors ?? initialProduct?.variants ?? []
    const arr = Array.isArray(colors) ? colors : []
    return arr.map((v) => {
      if (!v || typeof v !== "object") return null
      const img = v.image ?? v.primaryImage ?? v.images?.[0]
      const imageUrl = img && String(img).trim() ? img : null
      return { _id: v._id ?? v.id, name: v.name ?? "", code: v.code ?? "", image: imageUrl }
    }).filter(Boolean)
  })
  const [selected, setSelected] = useState(() => {
    const colors = initialProduct?.colors ?? initialProduct?.variants ?? []
    const arr = Array.isArray(colors) ? colors : []
    const normalized = arr.map((v) => {
      if (!v || typeof v !== "object") return null
      const img = v.image ?? v.primaryImage ?? v.images?.[0]
      const imageUrl = img && String(img).trim() ? img : null
      return { _id: v._id ?? v.id, name: v.name ?? "", code: v.code ?? "", image: imageUrl }
    }).filter(Boolean)
    return normalized.length ? normalized[0] : null
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
      const img = typeof window !== "undefined" ? new window.Image() : null
      if (!img) {
        resolve(false)
        return
      }
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
    setIsMounted(true)
  }, [])

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
            const preview = firstTemplate.previewImage
            const imgToUse = bgImages.length > 0 ? bgImages[0] : preview
            if (imgToUse) {
              await preloadImage(imgToUse)
              setBackgroundImage(imgToUse)
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
        const preview = activeTemplate.previewImage
        setBackgroundImage(bgImages.length > 0 ? bgImages[0] : preview || null)
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
          <TopBar />
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
          <TopBar />
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
        <TopBar />
        <NavigationBar />
      </header>

      <div className="w-full mx-auto p-4 sm:px-6 lg:px-8 pt-6">
        {showSaveSuccess && (
          <div className="fixed top-24 right-4 z-50 animate-pulse">
            <div className="bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center space-x-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Design saved successfully!</span>
            </div>
          </div>
        )}

        <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6 flex-wrap">
          <Link href="/" className="hover:text-gray-900">
            Home
          </Link>
          <span>/</span>
          {product?.category?.name && (
            <>
              <Link href={product?.category?.slug ? `/${product.category.slug}` : `/${slugify(product.category.name)}`} className="hover:text-gray-900">
                {product.category.name}
              </Link>
              <span>/</span>
            </>
          )}
          <span className="text-gray-900 font-medium truncate max-w-[200px] sm:max-w-none">{product?.name}</span>
        </nav>

        <div className="grid lg:grid-cols-2 gap-8 mb-10">
          <div className="lg:col-span-1">
            <div className="sticky top-24">
              <div className="bg-white rounded-lg border-2 border-gray-300 shadow-lg overflow-hidden">
                <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-700">Product Preview</h3>
                  {showCustomizedView && activeTemplate && (
                    <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded">
                      Editing: {activeTemplate.name}
                    </span>
                  )}
                </div>

                <div ref={productImageRef} className="relative bg-gray-100" style={{ aspectRatio: "5/5", minHeight: "500px", maxHeight: "700px" }}>
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
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4 z-10">
                      <div className="flex items-center space-x-2 overflow-x-auto pb-2">
                        {templates.map((tmpl) => {
                          const isSelected = selectedTemplate?._id === tmpl._id || selectedTemplate?.id === tmpl.id || (!selectedTemplate && templates[0]?._id === tmpl._id)
                          const previewImg = tmpl.previewImage || tmpl.backgroundImages?.[0]
                          return (
                            <button key={tmpl._id || tmpl.id} onClick={() => handleTemplateSelect(tmpl)} className={`relative flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all duration-200 transform hover:scale-105 ${isSelected ? "border-blue-400 ring-2 ring-blue-300 shadow-lg scale-110" : "border-white/50 hover:border-white"}`} title={tmpl.name}>
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

          <div className="lg:col-span-1" suppressHydrationWarning>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3 leading-tight">{product?.name}</h1>
            {isMounted && isAuthenticated && (
              <button onClick={toggleWishlist} className={`mb-3 p-2 rounded-full transition-all ${isInWishlist ? "bg-red-50 text-red-500" : "bg-gray-100 text-gray-400 hover:bg-red-50 hover:text-red-500"}`} title={isInWishlist ? "Remove from wishlist" : "Add to wishlist"}>
                <svg className="w-6 h-6" fill={isInWishlist ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </button>
            )}

            {product?.price && (
              <p className="text-2xl font-bold text-gray-900 mb-4">
                ₹{product.discountedPrice || product.price}
                {product.discountedPrice && <span className="text-base text-gray-500 line-through ml-2 font-normal">₹{product.price}</span>}
                {product.discountPercentage && <span className="ml-2 text-sm text-green-600 font-medium">({product.discountPercentage}% off)</span>}
              </p>
            )}
            {product?.description && (
              <div
                className="text-gray-700 mb-6 prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(product.description) }}
                suppressHydrationWarning
              />
            )}

            <ColorSelector variants={variants} selectedId={selected?._id} onChange={(_, v) => setSelected(v)} />

            {showToggle && (
              <div className="mt-6 mb-4">
                <div className="flex items-center space-x-4">
                  <span className={`text-sm font-medium ${viewMode === "standard" ? "text-gray-900" : "text-gray-500"}`}>Standard</span>
                  <button
                    type="button"
                    onClick={() => {
                      setViewMode(viewMode === "standard" ? "customized" : "standard")
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

            <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-4">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-gray-700">Quantity</span>
                <div className="inline-flex items-center border border-gray-300 rounded-md overflow-hidden bg-white">
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="px-3 py-2 text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-1 focus:ring-gray-400"
                    aria-label="Decrease quantity"
                  >
                    −
                  </button>
                  <span className="px-4 py-2 min-w-[2.5rem] text-center font-medium text-gray-900" aria-live="polite">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => q + 1)}
                    className="px-3 py-2 text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-1 focus:ring-gray-400"
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
              <div className="flex flex-col sm:flex-row gap-3 pt-1">
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
                    quantity,
                    image,
                    variant: selected || null,
                    customDesign: savedDesign || null,
                  })
                  setAddToCartSuccess(true)
                  setTimeout(() => setAddToCartSuccess(false), 3000)
                }}
                className="inline-flex items-center justify-center px-8 py-3.5 bg-gray-900 text-white font-semibold rounded-md hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 transition-colors uppercase tracking-wide text-sm"
              >
                Add to bag
              </button>
              <Link href="/cart" className="inline-flex items-center justify-center px-8 py-3.5 border-2 border-gray-900 text-gray-900 font-semibold rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 transition-colors uppercase tracking-wide text-sm">
                Go to bag
              </Link>
            </div>
            </div>

            <div
              className={`fixed inset-0 z-[100] bg-black/40 transition-opacity duration-300 ${
                enquiryOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
              }`}
              aria-hidden
              onClick={() => {
                if (!enquiryOpen) return
                setEnquiryOpen(false)
              }}
            />
            <div
              className={`fixed top-0 right-0 bottom-0 z-[101] w-full max-w-md bg-white shadow-xl flex flex-col transform transition-transform duration-300 ease-out ${
                enquiryOpen ? "translate-x-0" : "translate-x-full"
              }`}
              role="dialog"
              aria-modal="true"
              aria-labelledby="enquiry-title"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
                <h2 id="enquiry-title" className="text-lg font-semibold text-gray-900">Bulk product enquiry</h2>
                <button
                  type="button"
                  onClick={() => setEnquiryOpen(false)}
                  className="p-2 text-gray-500 hover:text-gray-700 rounded-md hover:bg-gray-200"
                  aria-label="Close"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
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
                      <button
                        type="button"
                        onClick={() => setEnquiryOpen(false)}
                        className="px-4 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-md hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>

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
            <h2 className="text-lg font-bold text-gray-900 uppercase tracking-wide mb-4">Product Attributes</h2>
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <dl className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
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
