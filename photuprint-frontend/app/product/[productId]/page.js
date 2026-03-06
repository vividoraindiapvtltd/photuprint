"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import DOMPurify from "dompurify"
import ColorSelector from "../../../src/components/product/ColorSelector"
import ProductReviews from "../../../src/components/ProductReviews"
import TemplateEditor from "../../../src/components/TemplateEditor"
import Header from "../../../src/components/Header"
import { useAuth } from "../../../src/context/AuthContext"
import api from "../../../src/utils/api"

export default function ProductDetails() {
  const params = useParams()
  const productId = params.productId
  const { isAuthenticated } = useAuth()
  const [isInWishlist, setIsInWishlist] = useState(false)
  const [product, setProduct] = useState(null)
  const [variants, setVariants] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [viewMode, setViewMode] = useState("standard") // "standard" or "customized"
  const [savedDesign, setSavedDesign] = useState(null)
  const [showSaveSuccess, setShowSaveSuccess] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [templates, setTemplates] = useState([])
  const [backgroundImage, setBackgroundImage] = useState(null)

  // Loading states for smooth transitions
  const [templatesLoading, setTemplatesLoading] = useState(false)
  const templatesFetchedRef = useRef(false)
  const preloadedImagesRef = useRef(new Set())

  // Get category ID from product
  const categoryId = product?.category?._id || product?.categoryId?._id || product?.categoryId || product?.category

  // Get display mode from product (defaults to 'both' for backwards compatibility)
  const displayMode = product?.displayMode || "both"

  const fetchProductDetails = async () => {
    try {
      setLoading(true)
      setError("")
      const pRes = await api.get(`/products/${productId}`)
      setProduct(pRes.data)
      // Use colors from the product (already populated)
      const productColors = pRes.data?.colors || []
      setVariants(Array.isArray(productColors) ? productColors : [])
      if (productColors?.length) setSelected(productColors[0])
    } catch (err) {
      console.error("Error fetching product details:", err)
      if (err.response?.status === 404) {
        setError("Product not found. It may have been removed or the link is invalid.")
      } else {
        setError("Failed to load product details. Please try again later.")
      }
    } finally {
      setLoading(false)
    }
  }

  // Preload an image and cache it
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

  // Preload all template images
  const preloadTemplateImages = useCallback(
    async (templateList) => {
      const imagesToPreload = []
      templateList.forEach((t) => {
        if (t.previewImage) imagesToPreload.push(t.previewImage)
        if (t.backgroundImages?.length) imagesToPreload.push(...t.backgroundImages)
      })
      await Promise.all(imagesToPreload.map(preloadImage))
    },
    [preloadImage]
  )

  // Fetch templates when category is available and in customized mode
  useEffect(() => {
    const fetchTemplates = async () => {
      console.log("fetchTemplates called - categoryId:", categoryId, "displayMode:", displayMode, "viewMode:", viewMode)

      // Skip if already fetched for this category and mode combination
      const fetchKey = `${categoryId}-${displayMode}-${viewMode}`
      if (templatesFetchedRef.current === fetchKey) {
        console.log("Templates already fetched for this key, skipping")
        return
      }

      if (categoryId && (displayMode === "customized" || (displayMode === "both" && viewMode === "customized"))) {
        try {
          setTemplatesLoading(true)

          console.log("Fetching templates for category:", categoryId)
          const response = await api.get(`/templates/category/${categoryId}?isActive=true`)
          const fetchedTemplates = response.data || []
          console.log(
            "Fetched templates:",
            fetchedTemplates.length,
            fetchedTemplates.map((t) => ({ name: t.name, bgImages: t.backgroundImages?.length }))
          )

          // Preload all template images before showing them
          await preloadTemplateImages(fetchedTemplates)

          setTemplates(fetchedTemplates)
          templatesFetchedRef.current = fetchKey

          // Auto-select first template if available
          if (fetchedTemplates.length > 0) {
            const firstTemplate = fetchedTemplates[0]
            console.log("Auto-selecting first template:", firstTemplate.name, "backgroundImages:", firstTemplate.backgroundImages)
            setSelectedTemplate(firstTemplate)
            const bgImages = firstTemplate.backgroundImages || []
            if (bgImages.length > 0) {
              // Ensure the background image is preloaded
              await preloadImage(bgImages[0])
              setBackgroundImage(bgImages[0])
            } else {
              setBackgroundImage(null)
            }
          } else {
            console.log("No templates found for category")
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
        // Not in customized mode
        console.log("Not in customized mode, skipping template fetch")
        setTemplatesLoading(false)
      }
    }
    fetchTemplates()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId, displayMode, viewMode, preloadTemplateImages, preloadImage])

  // Set background image based on mode - always use template background in customized mode
  useEffect(() => {
    if (displayMode === "customized" || (displayMode === "both" && viewMode === "customized")) {
      // In customized mode, always use template background
      const activeTemplate = selectedTemplate || (templates.length > 0 ? templates[0] : null)
      if (activeTemplate) {
        const bgImages = activeTemplate.backgroundImages || []
        if (bgImages.length > 0) {
          setBackgroundImage(bgImages[0])
          console.log("Setting background image from template:", activeTemplate.name, "image:", bgImages[0])
        } else {
          setBackgroundImage(null)
        }
      } else {
        setBackgroundImage(null)
      }
    } else {
      // In standard mode, use main product image
      const mainImage = selected?.image || product?.mainImage || product?.images?.[0]
      setBackgroundImage(mainImage)
    }
  }, [viewMode, selectedTemplate, templates, displayMode, selected, product])

  // Track recently viewed and check wishlist status
  useEffect(() => {
    const trackAndCheck = async () => {
      if (productId && isAuthenticated) {
        try {
          // Track recently viewed
          await api.post(`/users/recently-viewed/${productId}`)
          // Check wishlist status
          const res = await api.get(`/users/wishlist/check/${productId}`)
          setIsInWishlist(res.data.isInWishlist)
        } catch (err) {
          console.log("Error tracking/checking:", err)
        }
      }
    }
    trackAndCheck()
  }, [productId, isAuthenticated])

  // Toggle wishlist
  const toggleWishlist = async () => {
    if (!isAuthenticated) return
    try {
      if (isInWishlist) {
        await api.delete(`/users/wishlist/${productId}`)
        setIsInWishlist(false)
      } else {
        await api.post(`/users/wishlist/${productId}`)
        setIsInWishlist(true)
      }
    } catch (err) {
      console.error("Error toggling wishlist:", err)
    }
  }

  useEffect(() => {
    if (productId) {
      fetchProductDetails()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId])

  // Set initial viewMode based on product displayMode
  useEffect(() => {
    if (product) {
      const mode = product.displayMode || "both"
      if (mode === "customized") {
        setViewMode("customized")
      } else if (mode === "standard") {
        setViewMode("standard")
      }
      // For 'both', keep the default 'standard' viewMode (user can toggle)
    }
  }, [product])

  const handleTemplateSelect = async (template) => {
    console.log("handleTemplateSelect called:", template?.name, "current:", selectedTemplate?.name)
    console.log("Template backgroundImages:", template?.backgroundImages)

    // Don't re-select the same template
    if (selectedTemplate?._id === template._id) {
      console.log("Same template, skipping")
      return
    }

    // Update selected template immediately
    setSelectedTemplate(template)

    // Update background image
    const bgImages = template.backgroundImages || []
    if (bgImages.length > 0) {
      setBackgroundImage(bgImages[0])
      console.log("Set background image:", bgImages[0])
    }
  }

  const handleDesignSave = (designData) => {
    console.log("Design saved:", designData)
    setSavedDesign(designData)
    setShowSaveSuccess(true)

    // Hide success message after 3 seconds
    setTimeout(() => {
      setShowSaveSuccess(false)
    }, 3000)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header title="Loading..." />
        <div className="max-w-7xl mx-auto p-4">
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
      </div>
    )
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header title="Product Not Found" />
        <div className="max-w-7xl mx-auto p-4 pt-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
            <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Product Not Found</h2>
            <p className="text-gray-500 mb-6">{error || "The product you're looking for doesn't exist or has been removed."}</p>
            <div className="flex justify-center gap-4">
              <Link href="/" className="px-6 py-3 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
                Browse Products
              </Link>
              <button onClick={() => window.history.back()} className="px-6 py-3 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                Go Back
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Determine what to show based on displayMode
  const showToggle = displayMode === "both"
  const showCustomizedView = displayMode === "customized" || (displayMode === "both" && viewMode === "customized")

  // Get the template to use for editor (selected or first template)
  const activeTemplate = selectedTemplate || (templates.length > 0 ? templates[0] : null)

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title={product?.name || "Product Details"} />

      <div className="max-w-7xl mx-auto p-4 pt-6">
        {/* Success Toast */}
        {showSaveSuccess && (
          <div className="fixed top-20 right-4 z-50 animate-pulse">
            <div className="bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center space-x-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Design saved successfully!</span>
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          {/* Left Side - Product Preview with Integrated Template Editor (50% width) */}
          <div className="lg:col-span-1">
            <div className="sticky top-20">
              <div className="bg-white rounded-lg border-2 border-gray-300 shadow-lg overflow-hidden">
                {/* Header */}
                <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-700">Product Preview</h3>
                  {showCustomizedView && activeTemplate && <span className="text-xs text-gray-500">{activeTemplate.name}</span>}
                </div>

                {/* Preview Area with Integrated Editor */}
                <div className="relative bg-gray-100" style={{ aspectRatio: "5/5", minHeight: "500px", maxHeight: "700px" }}>
                  {/* Loading Overlay - shows during template loading */}
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
                    /* Template Editor - Integrated directly in preview area, always show in customized mode */
                    <div className="absolute inset-0">
                      <TemplateEditor key={activeTemplate._id || activeTemplate.id} template={activeTemplate} onSave={handleDesignSave} simplified={true} constrained={true} />
                    </div>
                  ) : showCustomizedView ? (
                    /* Customized mode but no templates - show background image */
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
                      {backgroundImage ? (
                        <img src={backgroundImage.startsWith("http") ? backgroundImage : `http://localhost:8080${backgroundImage}`} alt={product?.name} className="w-full h-full object-contain" />
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
                    /* Standard View - Background Image (no product image) */
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-50 transition-opacity duration-300" style={{ opacity: 1 }}>
                      {savedDesign && viewMode === "customized" ? (
                        <div className="relative w-full h-full">
                          <img src={savedDesign.image} alt={`Customized ${product?.name}`} className="w-full h-full object-contain" />
                          <div className="absolute top-2 left-2 bg-green-500 text-white text-xs px-2 py-1 rounded">Customized Design</div>
                        </div>
                      ) : backgroundImage ? (
                        <img src={backgroundImage.startsWith("http") ? backgroundImage : `http://localhost:8080${backgroundImage}`} alt={product?.name} className="w-full h-full object-contain" />
                      ) : (
                        <div className="text-gray-400 text-center">
                          <svg className="w-16 h-16 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <p className="text-sm">No image available</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Template Thumbnails Overlay - Always visible in Customized Mode, at bottom */}
                  {showCustomizedView && templates.length > 0 && (
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4 z-10">
                      <div className="flex items-center space-x-2 overflow-x-auto pb-2">
                        {templates.map((tmpl) => {
                          const isSelected = selectedTemplate?._id === tmpl._id || selectedTemplate?.id === tmpl.id || (!selectedTemplate && templates[0]?._id === tmpl._id)
                          const previewImg = tmpl.previewImage || tmpl.backgroundImages?.[0]
                          return (
                            <button key={tmpl._id || tmpl.id} onClick={() => handleTemplateSelect(tmpl)} className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all duration-200 transform hover:scale-105 ${isSelected ? "border-blue-400 ring-2 ring-blue-300 shadow-lg scale-110" : "border-white/50 hover:border-white"}`} title={tmpl.name}>
                              {previewImg ? (
                                <img src={previewImg.startsWith("http") ? previewImg : `http://localhost:8080${previewImg}`} alt={tmpl.name} className="w-full h-full object-cover" loading="eager" />
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

          {/* Right Side - Product Details (50% width) */}
          <div className="lg:col-span-1">
            <div className="flex items-start justify-between mb-4">
              <h1 className="text-3xl font-bold text-gray-900">{product?.name}</h1>
              {/* Wishlist Button */}
              <button onClick={toggleWishlist} className={`p-2 rounded-full transition-all ${isInWishlist ? "bg-red-50 text-red-500" : "bg-gray-100 text-gray-400 hover:bg-red-50 hover:text-red-500"}`} title={isInWishlist ? "Remove from wishlist" : "Add to wishlist"}>
                <svg className="w-6 h-6" fill={isInWishlist ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </button>
            </div>

            {product?.price && (
              <p className="text-2xl font-semibold text-gray-800 mb-4">
                ₹{product.discountedPrice || product.price}
                {product.discountedPrice && <span className="text-sm text-gray-500 line-through ml-2">₹{product.price}</span>}
                {product.discountPercentage && <span className="ml-2 text-sm text-green-600 font-medium">({product.discountPercentage}% off)</span>}
              </p>
            )}

            {product?.description && <div className="text-gray-700 mb-6 prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(product.description) }} />}

            <ColorSelector variants={variants} selectedId={selected?._id} onChange={(_, v) => setSelected(v)} />

            {/* Standard / Customized Toggle - Only show when displayMode is 'both' */}
            {showToggle && (
              <div className="mt-6 mb-4">
                <div className="flex items-center space-x-4">
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

            {/* Display mode indicator when not 'both' */}
            {displayMode === "customized" && (
              <div className="mt-6 mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                <p className="text-sm text-blue-800">
                  <span className="font-medium">✨ Customizable Product</span> - Select a template from the thumbnails and upload your image to customize
                </p>
              </div>
            )}

            {/* Saved Design Indicator */}
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

            {/* Action Buttons */}
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href={`/product/${productId}/review`} className="inline-flex items-center px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Write a Review
              </Link>

              {savedDesign && (
                <button
                  className="inline-flex items-center px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 transition-colors"
                  onClick={() => {
                    console.log("Adding to cart with design:", savedDesign)
                    alert("Added to cart with your customized design!")
                  }}
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  Add to Cart (Customized)
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Reviews Section */}
        <ProductReviews productId={productId} />
      </div>
    </div>
  )
}
