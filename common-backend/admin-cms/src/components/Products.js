import React, { useState, useEffect, useRef, useMemo, useCallback } from "react"
import { useSearchParams } from "react-router-dom"
import api from "../api/axios"
import { 
  PageHeader, 
  AlertMessage, 
  ViewToggle, 
  Pagination, 
  EntityCard, 
  EntityCardHeader,
  FormField, 
  ActionButtons,
  SearchField,
  StatusFilter,
  DeleteConfirmationPopup,
  calculateStandardStatusCounts,
  filterEntitiesByStatus,
  generateEntityColor
} from "../common"
import { useAuth } from "../context/AuthContext"
import ProductVariationsTab from "./tabs/ProductVariationsTab"
import SearchableSelect from "../common/SearchableSelect"
import ProductDetailsTab from "./tabs/ProductDetailsTab"
import ProductMediaTab from "./tabs/ProductMediaTab"
import ProductSEOTab from "./tabs/ProductSEOTab"
import ProductTemplatesTab from "./tabs/ProductTemplatesTab"

// Helper to force browsers to load the latest image/video after updates
const addCacheBuster = (url, cacheBuster) => {
  if (!url) return url
  // Avoid duplicating the cache-buster if it's already present
  if (url.includes("v=")) return url
  const separator = url.includes("?") ? "&" : "?"
  return `${url}${separator}v=${cacheBuster}`
}

/** Compare populated or raw Mongoose refs (ObjectId vs string) reliably */
function refIdToString(ref) {
  if (ref == null) return ""
  if (typeof ref === "object" && ref._id != null) return String(ref._id)
  return String(ref)
}

const VariationImagesDisplay = ({ productId, fetchVariations, openMediaPopup, variationsCache, expandedVariations, onToggleVariationExpansion }) => {
  const [variations, setVariations] = useState([])
  const [loading, setLoading] = useState(false)
  const [colors, setColors] = useState([])
  const [sizes, setSizes] = useState([])

  useEffect(() => {
    const fetchAttributes = async () => {
      try {
        const [colorsRes, sizesRes] = await Promise.all([
          api.get("/colors?showInactive=true&includeDeleted=true"),
          api.get("/sizes?showInactive=true&includeDeleted=true"),
        ])
        setColors(colorsRes.data || [])
        setSizes(sizesRes.data || [])
      } catch (err) {
        // Error handled silently
      }
    }
    fetchAttributes()
  }, [])

  useEffect(() => {
    if (variationsCache[productId]) {
      setVariations(variationsCache[productId])
    } else {
      setLoading(true)
      fetchVariations(productId).then(variants => {
        setVariations(variants || [])
        setLoading(false)
      }).catch(() => {
        setVariations([])
        setLoading(false)
      })
    }
  }, [productId, fetchVariations, variationsCache])

  // Helper function to get attribute display string
  const getAttributeDisplay = (variant) => {
    let attrs = variant.attributes || {}
    if (attrs instanceof Map) {
      attrs = Object.fromEntries(attrs)
    }
    
    const attrDisplay = []
    for (const [key, value] of Object.entries(attrs)) {
      let displayValue = value
      
      const keyLower = key.toLowerCase()
      
      if (value && typeof value === 'object' && value.name) {
        displayValue = value.name
      } else {
        if (keyLower === 'color') {
          const colorId = typeof value === 'object' && value._id ? value._id : value
          const color = colors.find(c => {
            if (!c || !c._id) return false
            return c._id === colorId || c._id.toString() === colorId?.toString() || c._id.toString() === String(colorId)
          })
          if (color && color.name) {
            displayValue = color.name
          } else if (typeof value === 'string' && !color) {
            displayValue = value
          }
        } else if (keyLower === 'size') {
          const sizeId = typeof value === 'object' && value._id ? value._id : value
          const size = sizes.find(s => {
            if (!s || !s._id) return false
            return s._id === sizeId || s._id.toString() === sizeId?.toString() || s._id.toString() === String(sizeId)
          })
          if (size && size.name) {
            displayValue = size.name
          } else if (typeof value === 'string' && !size) {
            displayValue = value
          }
        } else if (typeof value === 'string') {
          displayValue = value
        }
      }
      
      if (displayValue && typeof displayValue === 'object' && displayValue.toString) {
        displayValue = displayValue.toString()
      }
      
      attrDisplay.push(`${key.charAt(0).toUpperCase() + key.slice(1)}: ${displayValue}`)
    }
    
    return attrDisplay.length > 0 ? attrDisplay.join(", ") : "No attributes"
  }

  const normalizeImageUrl = (url) => {
    if (!url) return null
    if (url.startsWith("http")) return url
    if (url.startsWith("/uploads/")) return `${url}`
    return `${url}`
  }

  if (loading) {
    return <div style={{ fontSize: '12px', color: '#999' }}>Loading variations...</div>
  }

  if (!variations || variations.length === 0) {
    return <div style={{ fontSize: '12px', color: '#999' }}>No variations found</div>
  }

  const processedVariations = variations.map((variant, index) => {
    const images = []
    const mainImage = variant.primaryImage || variant.image
    if (mainImage) images.push({ url: mainImage, type: 'main' })
    
    if (variant.images && Array.isArray(variant.images)) {
      variant.images.forEach(img => {
        if (img) images.push({ url: img, type: 'gallery' })
      })
    }
    
    return {
      ...variant,
      variationNumber: index + 1,
      attributeDisplay: getAttributeDisplay(variant),
      images: images.filter(img => img.url)
    }
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {processedVariations.map((variant) => {
        const allVariantImages = variant.images
        const variantKey = variant._id || `variant-${variant.variationNumber}`
        const isExpanded = expandedVariations[variantKey] || false
        const imagesToShow = isExpanded ? allVariantImages : allVariantImages.slice(0, 6)
        const remainingCount = allVariantImages.length - 6
        
        return (
          <div key={variantKey} style={{ marginBottom: '8px' }}>
            <div style={{ fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
              Variation {variant.variationNumber}: {variant.attributeDisplay}
            </div>
            <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>
              Images: {allVariantImages.length > 0 ? 'Main image' : 'No images'} 
              {allVariantImages.length > 1 ? ` + ${allVariantImages.length - 1} gallery image${allVariantImages.length - 1 > 1 ? 's' : ''}` : ''}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'flex-start' }}>
              {imagesToShow.map((imgObj, imgIndex) => {
                const fullUrl = normalizeImageUrl(imgObj.url)
                if (!fullUrl) return null
                
                const isVideo = (() => {
                  if (!fullUrl) return false
                  const videoExtensions = ['.mp4', '.webm', '.mov', '.avi']
                  const lowerUrl = fullUrl.toLowerCase()
                  return videoExtensions.some(ext => lowerUrl.includes(ext)) || lowerUrl.includes('video')
                })()
                
                return (
                  <div 
                    key={`variant-${variant.variationNumber}-img-${imgIndex}`} 
                    style={{ 
                      position: 'relative', 
                      width: '50px', 
                      height: '50px', 
                      borderRadius: '4px', 
                      overflow: 'hidden', 
                      cursor: 'pointer', 
                      border: '1px solid #e5e7eb',
                      backgroundColor: '#f3f4f6'
                    }}
                    onClick={() => openMediaPopup(fullUrl, isVideo)}
                  >
                    {isVideo ? (
                      <video
                        src={fullUrl}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        muted
                        onError={(e) => {
                          e.target.style.display = 'none'
                        }}
                      />
                    ) : (
                      <img
                        src={fullUrl}
                        alt={`Variation ${variant.variationNumber} ${imgObj.type === 'main' ? 'Main' : 'Gallery'} ${imgIndex + 1}`}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(e) => {
                          e.target.style.display = 'none'
                        }}
                      />
                    )}
                    {imgObj.type === 'main' && (
                      <div style={{
                        position: 'absolute',
                        top: '2px',
                        left: '2px',
                        backgroundColor: 'rgba(0, 0, 0, 0.6)',
                        color: 'white',
                        fontSize: '8px',
                        padding: '1px 3px',
                        borderRadius: '2px',
                        fontWeight: '600'
                      }}>
                        Main
                      </div>
                    )}
                  </div>
                )
              })}
              {remainingCount > 0 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onToggleVariationExpansion(variantKey)
                  }}
                  style={{
                    width: '50px',
                    height: '50px',
                    borderRadius: '4px',
                    border: '1px solid #e5e7eb',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: isExpanded ? '#dc2626' : '#f3f4f6',
                    color: isExpanded ? 'white' : '#666',
                    fontSize: '12px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (!isExpanded) {
                      e.target.style.backgroundColor = '#e5e7eb'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isExpanded) {
                      e.target.style.backgroundColor = '#f3f4f6'
                    }
                  }}
                  title={isExpanded ? `Hide ${remainingCount} images` : `Show ${remainingCount} more images`}
                >
                  {isExpanded ? `-${remainingCount}` : `+${remainingCount}`}
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function Products() {
  const { selectedWebsite } = useAuth()
  const [searchParams] = useSearchParams()
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [editingId, setEditingId] = useState(null)
  const [activeTab, setActiveTab] = useState("details")
  const [showAdvancedSEO, setShowAdvancedSEO] = useState(false)
  const [viewMode, setViewMode] = useState('card')
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(10)
  const [hasMoreCards, setHasMoreCards] = useState(true)
  const [displayedCards, setDisplayedCards] = useState([])
  const [mediaPopup, setMediaPopup] = useState({
    isOpen: false,
    mediaUrl: null,
    isVideo: false
  })
  const [productVariationsCache, setProductVariationsCache] = useState({})
  const [expandedImages, setExpandedImages] = useState({
    gallery: {},
    variations: {}
  })

  const isVideoUrl = (url) => {
    if (!url) return false
    const videoExtensions = ['.mp4', '.webm', '.mov', '.avi']
    const lowerUrl = url.toLowerCase()
    return videoExtensions.some(ext => lowerUrl.includes(ext)) || lowerUrl.includes('video')
  }

  const toggleGalleryExpansion = (productId) => {
    setExpandedImages(prev => ({
      ...prev,
      gallery: {
        ...prev.gallery,
        [productId]: !prev.gallery[productId]
      }
    }))
  }
  
  const toggleVariationExpansion = (productId, variantId) => {
    setExpandedImages(prev => ({
      ...prev,
      variations: {
        ...prev.variations,
        [productId]: {
          ...(prev.variations[productId] || {}),
          [variantId]: !(prev.variations[productId]?.[variantId] || false)
        }
      }
    }))
  }
  
  // Delete confirmation popup state
  const [deletePopup, setDeletePopup] = useState({
    isVisible: false,
    productId: null,
    message: "",
    isPermanentDelete: false,
    action: "delete"
  })
  
  // Get filter from URL params
  const statusFilterFromUrl = searchParams.get('status')
  const filterFromUrl = searchParams.get('filter')
  
  // Refs
  const formRef = useRef(null)

  // Dropdown data
  const [categories, setCategories] = useState([])
  const [subcategories, setSubcategories] = useState([])
  const [brands, setBrands] = useState([])
  const [colors, setColors] = useState([])
  const [sizes, setSizes] = useState([])
  const [templates, setTemplates] = useState([])
  const [heights, setHeights] = useState([])
  const [lengths, setLengths] = useState([])
  const [widths, setWidths] = useState([])
  const [gstSlabs, setGstSlabs] = useState([])
  const [collarStyles, setCollarStyles] = useState([])
  const [materials, setMaterials] = useState([])
  const [patterns, setPatterns] = useState([])
  const [fitTypes, setFitTypes] = useState([])
  const [sleeveTypes, setSleeveTypes] = useState([])
  const [printingTypes, setPrintingTypes] = useState([])
  const [managedPrintSides, setManagedPrintSides] = useState([])
  const [managedProductAddons, setManagedProductAddons] = useState([])
  const [countries, setCountries] = useState([])

  // Store name for SEO defaults (multi-tenant safe) - memoize to prevent re-renders
  const storeName = useMemo(() => selectedWebsite?.name || "Store", [selectedWebsite?.name])

  const getUnitAbbreviation = (unit) => {
    const unitMap = {
      'millimeters': 'mm',
      'centimeters': 'cm',
      'inches': 'in',
      'feet': 'ft',
      'meters': 'm'
    }
    return unitMap[unit] || 'cm'
  }

  const generateSlug = (name) => {
    if (!name) return ""
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "") // Remove special characters
      .replace(/\s+/g, "-") // Replace spaces with hyphens
      .replace(/-+/g, "-") // Replace multiple hyphens with single hyphen
  }

  const quantityTierBandsForForm = [
    { minQty: 1, maxQty: 5 },
    { minQty: 6, maxQty: 10 },
    { minQty: 11, maxQty: 20 },
    { minQty: 21, maxQty: null },
  ]

  const tiersToFormQuantityDiscounts = (tiers) =>
    quantityTierBandsForForm.map((b) => {
      const row = (tiers || []).find(
        (t) =>
          Number(t.minQty) === b.minQty &&
          (b.maxQty == null ? t.maxQty == null || t.maxQty === undefined : Number(t.maxQty) === b.maxQty)
      )
      return row != null && row.discountPercent != null && Number(row.discountPercent) > 0
        ? String(row.discountPercent)
        : ""
    })

  const mergePricingMapFromProductRows = (rows, refKey) => {
    const map = {}
    ;(rows || []).forEach((row) => {
      const ref = row?.[refKey]
      const id = ref?._id ?? ref
      if (id == null || id === "") return
      const pr = row.price
      map[String(id)] = {
        enabled: Boolean(row.enabled),
        price: pr != null && pr !== "" && !Number.isNaN(Number(pr)) ? String(Math.round(Number(pr))) : "",
      }
    })
    return map
  }

  const initialFormData = {
    name: "",
    productType: "standard", // "standard" or "customized"
    shortDescription: "",
    longDescription: "",
    category: "",
    subcategory: "",
    brand: "",
    tags: "",
    productStatus: "draft", // "draft", "active", "archived"
    
    // Product Attributes
    collarStyle: "",
    material: "",
    pattern: "",
    fitType: "",
    sleeveType: "",
    printingType: "",
    countryOfOrigin: "",
    includedComponents: "",
    productCareInstructions: "",
    recommendedUsesForProduct: "",
    reusability: "",
    shape: "",
    specialFeature: "",
    specificUsesForProduct: "",
    style: "",
    design: "",
    occasion: "",
    
    // Pricing & Inventory (keys = PrintSide / ProductAddon _id)
    printSidePricing: {},
    addOnPricing: {},
    basePrice: "",
    plainProductPrice: "",
    discountPrice: "",
    discountPercentage: "",
    /** Extra % off per quantity band (1–5, 6–10, 11–20, 21+); strings for inputs */
    quantityTierDiscounts: ["", "", "", ""],
    taxClass: "",
    sku: "",
    stockManagement: "unlimited", // "unlimited" or "track"
    quantity: "",
    lowStockThreshold: "10",
    noOfPcsIncluded: "",
    
    featuredImage: null,
    galleryImages: [],
    existingFeaturedImage: null,
    existingGalleryImages: [],
    
    customizationEnabled: false,
    textCustomization: {
      enabled: false,
      maxCharacters: 100,
      placeholder: "Enter your text here",
      fontOptions: [],
      required: false
    },
    imageUploadCustomization: {
      enabled: false,
      allowedFileTypes: ["jpg", "jpeg", "png"],
      maxFileSize: 5, // MB
      required: false
    },
    predefinedOptions: [],
    livePreviewEnabled: false,
    
    // Shipping & Fulfillment
    weight: "",
    dimensions: {
      length: "",
      width: "",
      height: ""
    },
    shippingClass: "",
    processingTime: "",
    madeToOrder: false, // Will be set to true automatically for customized products
    
    // SEO Fields
    seoTitle: "",
    metaDescription: "",
    urlSlug: "",
    index: true, // Allow search engines to index
    primaryKeyword: "",
    secondaryKeywords: "",
    openGraphImage: "",
    canonicalUrl: "",
    schemaType: "Product",
    customSchema: "",
    robotsMeta: {
      noimageindex: false,
      nosnippet: false
    },
    
    selectedTemplates: [],
    selectedColors: [],
    selectedSizes: [],
    selectedHeights: [],
    selectedLengths: [],
    /** Mirrors API; used to keep Variations tab visible when editing products that already use variants */
    hasVariations: false,
  }

  const [formData, setFormData] = useState(initialFormData)
  const fileInputRef = useRef(null)
  const prevNameRef = useRef("")
  const prevProductTypeRef = useRef("")
  const seoAutoGeneratedRef = useRef(false)
  
  const handleVariantsChange = useCallback(() => {
    // Variants are managed by ProductVariationsTab component
    // Don't refresh products list - only variants are updated
  }, [])

  // Same API as PrintingTypeManager – fetches printing types for the dropdown
  const fetchPrintingTypes = useCallback(async () => {
    try {
      const res = await api.get("/printing-types?showInactive=true&includeDeleted=true")
      setPrintingTypes(res.data || [])
    } catch (err) {
      console.error("Failed to fetch printing types:", err)
    }
  }, [])

  const fetchManagedPrintSides = useCallback(async () => {
    try {
      const res = await api.get("/print-sides?includeDeleted=true&_t=" + Date.now())
      setManagedPrintSides(Array.isArray(res.data) ? res.data : [])
    } catch (err) {
      console.error("Failed to fetch print sides:", err)
    }
  }, [])

  const fetchManagedProductAddons = useCallback(async () => {
    try {
      const res = await api.get("/product-addons?includeDeleted=true&_t=" + Date.now())
      setManagedProductAddons(Array.isArray(res.data) ? res.data : [])
    } catch (err) {
      console.error("Failed to fetch product add-ons:", err)
    }
  }, [])

  useEffect(() => {
    fetchDropdownData()
  }, [])

  const fetchDropdownData = async () => {
    try {
      const [
        categoriesRes, 
        brandsRes, 
        colorsRes, 
        sizesRes, 
        heightsRes, 
        lengthsRes, 
        widthsRes, 
        gstSlabsRes,
        collarStylesRes,
        materialsRes,
        patternsRes,
        fitTypesRes,
        sleeveTypesRes,
        printingTypesRes,
        printSidesRes,
        productAddonsRes,
        countriesRes
      ] = await Promise.all([
        api.get(`/categories?_t=${Date.now()}`),
        api.get(`/brands?showInactive=true&includeDeleted=true&_t=${Date.now()}`),
        api.get(`/colors?showInactive=true&includeDeleted=true&_t=${Date.now()}`),
        api.get(`/sizes?showInactive=true&includeDeleted=true&_t=${Date.now()}`),
        api.get(`/heights?showInactive=true&includeDeleted=true&_t=${Date.now()}`),
        api.get(`/lengths?showInactive=true&includeDeleted=true&_t=${Date.now()}`),
        api.get(`/widths?showInactive=true&includeDeleted=true&_t=${Date.now()}`),
        api.get(`/gst-slabs?showInactive=true&includeDeleted=true&_t=${Date.now()}`),
        api.get(`/collar-styles?showInactive=true&includeDeleted=true&_t=${Date.now()}`),
        api.get(`/materials?showInactive=true&includeDeleted=true&_t=${Date.now()}`),
        api.get(`/patterns?showInactive=true&includeDeleted=true&_t=${Date.now()}`),
        api.get(`/fit-types?showInactive=true&includeDeleted=true&_t=${Date.now()}`),
        api.get(`/sleeve-types?showInactive=true&includeDeleted=true&_t=${Date.now()}`),
        api.get(`/printing-types?showInactive=true&includeDeleted=true&_t=${Date.now()}`),
        api.get(`/print-sides?includeDeleted=true&_t=${Date.now()}`),
        api.get(`/product-addons?includeDeleted=true&_t=${Date.now()}`),
        api.get(`/countries?showInactive=true&includeDeleted=true&_t=${Date.now()}`)
      ])

      setCategories(categoriesRes.data || [])
      setBrands(brandsRes.data || [])
      setColors(colorsRes.data || [])
      setSizes(sizesRes.data || [])
      setHeights(heightsRes.data || [])
      setLengths(lengthsRes.data || [])
      setWidths(widthsRes.data || [])
      setGstSlabs(gstSlabsRes.data || [])
      setCollarStyles(collarStylesRes.data || [])
      setMaterials(materialsRes.data || [])
      setPatterns(patternsRes.data || [])
      setFitTypes(fitTypesRes.data || [])
      setSleeveTypes(sleeveTypesRes.data || [])
      setPrintingTypes(printingTypesRes.data || [])
      setManagedPrintSides(Array.isArray(printSidesRes.data) ? printSidesRes.data : [])
      setManagedProductAddons(Array.isArray(productAddonsRes.data) ? productAddonsRes.data : [])
      setCountries(countriesRes.data || [])
      setSubcategories([])
    } catch (err) {
      setError("Failed to load dropdown data")
    }
  }

  // Refetch attribute lists when user opens Product Details tab (stays in sync with managers)
  useEffect(() => {
    if (activeTab === "details") {
      fetchPrintingTypes()
      fetchManagedPrintSides()
      fetchManagedProductAddons()
    }
  }, [activeTab, fetchPrintingTypes, fetchManagedPrintSides, fetchManagedProductAddons])

  // Fetch templates for the selected category (includes templates created in PixelCraft)
  const fetchTemplates = async (categoryId) => {
    if (!categoryId || formData.productType !== "customized") {
      setTemplates([])
      return
    }
    // Normalize: ensure we have a string id (form may pass object when populated)
    const categoryStr = typeof categoryId === "object" && categoryId?._id != null
      ? String(categoryId._id)
      : String(categoryId)
    if (!categoryStr || categoryStr === "undefined" || categoryStr === "null") {
      setTemplates([])
      return
    }
    try {
      // Cache-bust so browser doesn't use 304 cached (possibly empty) response
      const cacheBust = `_t=${Date.now()}`
      // 1) Load by category from server (primary – ensures templates for this category show)
      const categoryRes = await api.get(`/templates/category/${categoryStr}?isActive=true&${cacheBust}`)
      let list = Array.isArray(categoryRes.data) ? categoryRes.data : []

      // 2) Also load full list and add any PixelCraft templates for this category that may be missing from category endpoint
      try {
        const allRes = await api.get(`/templates?includeDeleted=false&isActive=true&${cacheBust}`)
        const all = Array.isArray(allRes.data) ? allRes.data : []
        const seenIds = new Set(list.map((t) => t._id?.toString()).filter(Boolean))
        all.forEach((t) => {
          const catId = t.categoryId?._id ?? t.categoryId
          const cat = t.category?._id ?? t.category
          const idStr = t._id?.toString()
          const match =
            (catId && String(catId) === categoryStr) || (cat && String(cat) === categoryStr)
          if (match && idStr && !seenIds.has(idStr)) {
            list = list.concat(t)
            seenIds.add(idStr)
          }
        })
      } catch (_) {
        // Ignore – category list is already set
      }
      setTemplates(list)
    } catch (err) {
      console.error("Error fetching templates:", err)
      setTemplates([])
    }
  }

  const fetchSubcategories = async (categoryId) => {
    if (!categoryId) {
      setSubcategories([])
      return
    }
    try {
      const response = await api.get(`/subcategories?categoryId=${categoryId}&showInactive=true&includeDeleted=true&_t=${Date.now()}`)
      setSubcategories(response.data || [])
    } catch (err) {
      setSubcategories([])
    }
  }

  const fetchProducts = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        showInactive: statusFilterFromUrl === 'active' ? 'false' : 'true',
        includeDeleted: 'true'
      })
      
      const response = await api.get(`/products?${params.toString()}`)
      let productsData = response.data.products || response.data || []
      
      // Use a single cache-buster value for this fetch so all updated
      // images get a new URL and reload immediately after edits.
      const cacheBuster = Date.now()
      const processedProducts = productsData.map(product => {
        let mainImageUrl = product.mainImage
        if (mainImageUrl && !mainImageUrl.startsWith('http')) {
          if (mainImageUrl.startsWith('/uploads/')) {
            mainImageUrl = `${mainImageUrl}`
          }
        }
        // Append cache-buster for main image
        mainImageUrl = addCacheBuster(mainImageUrl, cacheBuster)
        
        const processedImages = (product.images || []).map(img => {
          if (img && !img.startsWith('http')) {
            if (img.startsWith('/uploads/')) {
              img = `${img}`
            }
          }
          // Append cache-buster for gallery images
          return addCacheBuster(img, cacheBuster)
        })
        
        return {
          ...product,
          mainImage: mainImageUrl,
          images: processedImages
        }
      })
      
      if (filterFromUrl === 'lowStock') {
        productsData = processedProducts.filter(p => p.stock !== undefined && p.stock <= 10 && p.stock > 0)
      } else if (filterFromUrl === 'outOfStock') {
        productsData = processedProducts.filter(p => p.stock === undefined || p.stock <= 0)
      } else {
        productsData = processedProducts
      }
      
      setProducts(Array.isArray(productsData) ? productsData : [])
      setError("")
    } catch (err) {
      setError("Failed to fetch products")
      console.error("Error fetching products:", err)
    } finally {
      setLoading(false)
    }
  }
  
  useEffect(() => {
    fetchProducts()
  }, [statusFilterFromUrl, filterFromUrl])
  
  // Filter products based on search query and status
  const filteredProducts = useMemo(() => {
    let filtered = products
    
    // Apply status filter
    filtered = filterEntitiesByStatus(filtered, statusFilter)
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      filtered = filtered.filter(product => 
        product.name?.toLowerCase().includes(query) ||
        product.sku?.toLowerCase().includes(query) ||
        product.category?.name?.toLowerCase().includes(query) ||
        product.brand?.name?.toLowerCase().includes(query)
      )
    }
    
    return filtered
  }, [products, searchQuery, statusFilter])
  
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentProducts = filteredProducts.slice(startIndex, endIndex)
  
  useEffect(() => {
    if (viewMode === 'card' && filteredProducts.length > 0) {
      const initialCards = filteredProducts.slice(0, 16)
      setDisplayedCards(initialCards)
      setHasMoreCards(filteredProducts.length > 16)
      setCurrentPage(1)
    }
  }, [filteredProducts, viewMode])
  
  useEffect(() => {
    setCurrentPage(1)
    if (viewMode === 'card') {
      const initialCards = filteredProducts.slice(0, 16)
      setDisplayedCards(initialCards)
      setHasMoreCards(filteredProducts.length > 16)
    }
  }, [searchQuery, viewMode, filteredProducts])
  
  // Handle page change for list view
  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  
  const handleLoadMoreCards = () => {
    const currentCardCount = displayedCards.length
    const nextCards = filteredProducts.slice(currentCardCount, currentCardCount + 16)
    
    if (nextCards.length > 0) {
      setDisplayedCards([...displayedCards, ...nextCards])
      setHasMoreCards(currentCardCount + nextCards.length < filteredProducts.length)
    } else {
      setHasMoreCards(false)
    }
  }
  
  const handleViewModeChange = (mode) => {
    setViewMode(mode)
    setCurrentPage(1)
    if (mode === 'card') {
      const initialCards = filteredProducts.slice(0, 16)
      setDisplayedCards(initialCards)
      setHasMoreCards(filteredProducts.length > 16)
    }
  }

  useEffect(() => {
    if (editingId || !formData.name) {
      seoAutoGeneratedRef.current = false
      return
    }
    
    if (formData.name === prevNameRef.current && seoAutoGeneratedRef.current) {
      return
    }
    
    const hasSeoFields = formData.seoTitle && formData.metaDescription && formData.urlSlug
    
    if (hasSeoFields && formData.name === prevNameRef.current) {
      seoAutoGeneratedRef.current = true
      return
    }
    
    if (!formData.seoTitle || !formData.metaDescription || !formData.urlSlug) {
      prevNameRef.current = formData.name
      seoAutoGeneratedRef.current = true
      
      setFormData(prev => ({
        ...prev,
        seoTitle: prev.seoTitle || `${prev.name} | ${storeName}`,
        metaDescription: prev.metaDescription || `Create a personalized ${prev.name}. Perfect gift for birthdays, anniversaries & special moments.`,
        urlSlug: prev.urlSlug || generateSlug(prev.name)
      }))
    } else {
      prevNameRef.current = formData.name
      seoAutoGeneratedRef.current = true
    }
  }, [formData.name, editingId, storeName])

  useEffect(() => {
    if (formData.category) {
      fetchSubcategories(formData.category)
      if (formData.productType === "customized") {
        fetchTemplates(formData.category)
      }
    } else {
      setSubcategories([])
      if (formData.productType !== "customized") {
        setTemplates([])
      }
    }
  }, [formData.category, formData.productType])

  // Reset templates tab when product type changes
  useEffect(() => {
    // Only run if product type actually changed
    if (formData.productType !== prevProductTypeRef.current) {
      prevProductTypeRef.current = formData.productType
      
      if (formData.productType === "standard") {
        setFormData(prev => {
          // Only update if selectedTemplates has values
          if (prev.selectedTemplates.length === 0) {
            return prev // Return same object to prevent re-render
          }
          return { ...prev, selectedTemplates: [] }
        })
        setTemplates([])
        // Hide templates tab if it's active
        if (activeTab === "templates") {
          setActiveTab("details")
        }
      } else if (formData.productType === "customized" && formData.category) {
        fetchTemplates(formData.category)
      }
    }
  }, [formData.productType, formData.category, activeTab])

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target
    
    // Handle productType change - set madeToOrder to true for customized products
    if (name === "productType") {
      setFormData(prev => ({
        ...prev,
        productType: value,
        madeToOrder: value === "customized" ? true : prev.madeToOrder
      }))
      return
    }
    
    if (name === "sku") {
      const cleanedValue = value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 9)
      setFormData(prev => ({
        ...prev,
        sku: cleanedValue
      }))
      return
    }
    
    if (name.startsWith("quantityTierDiscounts__")) {
      const idx = parseInt(name.replace("quantityTierDiscounts__", ""), 10)
      if (!Number.isFinite(idx) || idx < 0 || idx > 3) return
      setFormData((prev) => {
        const next = [...(prev.quantityTierDiscounts || ["", "", "", ""])]
        next[idx] = value
        return { ...prev, quantityTierDiscounts: next }
      })
      return
    }

    if (name === "plainProductPrice") {
      setFormData((prev) => {
        if (value === "" || value === null || value === undefined) {
          return { ...prev, plainProductPrice: "" }
        }
        const n = parseFloat(value)
        if (!Number.isFinite(n)) return prev
        return { ...prev, plainProductPrice: String(Math.round(n)) }
      })
      return
    }

    if (name === "basePrice" || name === "discountPrice") {
      setFormData(prev => {
        const rounded = value === "" || value === null || value === undefined ? "" : Math.round(parseFloat(value))
        const basePrice = name === "basePrice" ? (rounded === "" ? 0 : rounded) : parseFloat(prev.basePrice) || 0
        const discountPrice = name === "discountPrice" ? (rounded === "" ? 0 : rounded) : parseFloat(prev.discountPrice) || 0
        
        let discountPercentage = ""
        if (basePrice > 0 && discountPrice > 0 && discountPrice < basePrice) {
          discountPercentage = Math.round((basePrice - discountPrice) / basePrice * 100)
        }
        
        return {
          ...prev,
          [name]: value === "" ? "" : String(rounded),
          discountPercentage: discountPercentage
        }
      })
      return
    }
    
    if (name.includes('.')) {
      const [parent, child] = name.split('.')
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: type === "checkbox" ? checked : value
        }
      }))
      return
    }

    // Handle dimensions object
    if (name.startsWith('dimension_')) {
      const dimensionField = name.replace('dimension_', '')
      setFormData(prev => ({
        ...prev,
        dimensions: {
          ...prev.dimensions,
          [dimensionField]: value
        }
      }))
      return
    }

    // Handle robotsMeta checkboxes
    if (name.startsWith('robotsMeta_')) {
      const robotsField = name.replace('robotsMeta_', '')
      setFormData(prev => ({
        ...prev,
        robotsMeta: {
          ...prev.robotsMeta,
          [robotsField]: checked
        }
      }))
      return
    }

    // Handle text customization nested fields
    if (name.startsWith('textCustomization_')) {
      const field = name.replace('textCustomization_', '')
      setFormData(prev => ({
        ...prev,
        textCustomization: {
          ...prev.textCustomization,
          [field]: type === "checkbox" ? checked : value
        }
      }))
      return
    }

    // Handle image upload customization nested fields
    if (name.startsWith('imageUploadCustomization_')) {
      const field = name.replace('imageUploadCustomization_', '')
      setFormData(prev => ({
        ...prev,
        imageUploadCustomization: {
          ...prev.imageUploadCustomization,
          [field]: type === "checkbox" ? checked : (field === "allowedFileTypes" ? value.split(",").map(t => t.trim()) : value)
        }
      }))
      return
    }

    // Clear subcategory when category changes
    if (name === "category") {
      setFormData(prev => ({
        ...prev,
        [name]: value,
        subcategory: "" // Clear subcategory when category changes
      }))
      return
    }

    // Auto-generate slug when name changes (only if slug is empty or matches old name)
    if (name === "name" && value) {
      const newSlug = generateSlug(value)
      setFormData(prev => {
        // Only auto-update slug if it's empty or matches the old name's slug
        const oldSlug = generateSlug(prev.name)
        const shouldUpdateSlug = !prev.urlSlug || prev.urlSlug === oldSlug
        return {
          ...prev,
          [name]: value,
          urlSlug: shouldUpdateSlug ? newSlug : prev.urlSlug
        }
      })
      return
    }

    setFormData(prev => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }))
  }

  const handleMultiSelect = (name, valueArray) => {
    setFormData(prev => ({ ...prev, [name]: Array.isArray(valueArray) ? valueArray : [] }))
  }

  const handlePrintSidePricingChange = useCallback((printSideId, field, value) => {
    const id = String(printSideId)
    setFormData((prev) => {
      const cur = prev.printSidePricing?.[id] || { enabled: false, price: "" }
      let next = { ...cur }
      if (field === "enabled") {
        next.enabled = Boolean(value)
        if (!value) next.price = ""
      } else if (field === "price") {
        if (value === "" || value == null) next.price = ""
        else {
          const n = parseFloat(value)
          next.price = Number.isFinite(n) ? String(Math.round(n)) : ""
        }
      }
      return {
        ...prev,
        printSidePricing: { ...(prev.printSidePricing || {}), [id]: next },
      }
    })
  }, [])

  const handleAddOnPricingChange = useCallback((productAddonId, field, value) => {
    const id = String(productAddonId)
    setFormData((prev) => {
      const cur = prev.addOnPricing?.[id] || { enabled: false, price: "" }
      let next = { ...cur }
      if (field === "enabled") {
        next.enabled = Boolean(value)
        if (!value) next.price = ""
      } else if (field === "price") {
        if (value === "" || value == null) next.price = ""
        else {
          const n = parseFloat(value)
          next.price = Number.isFinite(n) ? String(Math.round(n)) : ""
        }
      }
      return {
        ...prev,
        addOnPricing: { ...(prev.addOnPricing || {}), [id]: next },
      }
    })
  }, [])

  const validateFeaturedImage = (file) => {
    return new Promise((resolve) => {
      if (!file) {
        resolve({ isValid: true, error: "" })
        return
      }

      // Check file type
      const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif"]
      if (!allowedTypes.includes(file.type.toLowerCase())) {
        resolve({ isValid: false, error: "Featured image must be JPG, PNG, or GIF format only." })
        return
      }

      const maxSize = 5 * 1024 * 1024 // 5MB
      if (file.size > maxSize) {
        resolve({ isValid: false, error: `Image size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds maximum allowed size of 5MB.` })
        return
      }

      // Check dimensions (max 1200x1200px)
      const img = new Image()
      const objectUrl = URL.createObjectURL(file)

      img.onload = () => {
        URL.revokeObjectURL(objectUrl)
        const maxDimension = 1200
        
        if (img.width > maxDimension || img.height > maxDimension) {
          resolve({ 
            isValid: false, 
            error: `Featured image dimensions (${img.width}x${img.height}px) exceed the maximum allowed size of ${maxDimension}x${maxDimension}px. Please resize your image.` 
          })
        } else {
          resolve({ isValid: true, error: "" })
        }
      }

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl)
        resolve({ isValid: false, error: "Failed to load image. Please select a valid image file." })
      }

      img.src = objectUrl
    })
  }

  // Validate gallery media: up to 9 items, 1200x1200px, images max 5MB, videos max 100MB
  const validateGalleryMedia = (file) => {
    return new Promise((resolve) => {
      if (!file) {
        resolve({ isValid: true, error: "" })
        return
      }

      const isImage = file.type.startsWith("image/")
      const isVideo = file.type.startsWith("video/")

      if (!isImage && !isVideo) {
        resolve({ isValid: false, error: "Only images and videos are allowed in gallery." })
        return
      }

      // Check file size
      if (isImage) {
        const maxSize = 5 * 1024 * 1024 // 5MB for images
        if (file.size > maxSize) {
          resolve({ isValid: false, error: `Image size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds maximum allowed size of 5MB.` })
          return
        }
      } else if (isVideo) {
        const maxSize = 100 * 1024 * 1024 // 100MB for videos
        if (file.size > maxSize) {
          resolve({ isValid: false, error: `Video size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds maximum allowed size of 100MB.` })
          return
        }
      }

      if (isImage) {
        const img = new Image()
        const objectUrl = URL.createObjectURL(file)

        img.onload = () => {
          URL.revokeObjectURL(objectUrl)
          const maxDimension = 1200
          
          if (img.width > maxDimension || img.height > maxDimension) {
            resolve({ 
              isValid: false, 
              error: `Gallery image dimensions (${img.width}x${img.height}px) exceed the maximum allowed size of ${maxDimension}x${maxDimension}px. Please resize your image.` 
            })
          } else {
            resolve({ isValid: true, error: "" })
          }
        }

        img.onerror = () => {
          URL.revokeObjectURL(objectUrl)
          resolve({ isValid: false, error: "Failed to load image. Please select a valid image file." })
        }

        img.src = objectUrl
      } else {
        // Videos don't need dimension validation
        resolve({ isValid: true, error: "" })
      }
    })
  }

  const handleFeaturedImageUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    // Validate featured image
    const validation = await validateFeaturedImage(file)
    if (!validation.isValid) {
      setError(validation.error)
      e.target.value = "" // Clear the input
      return
    }

      setFormData(prev => ({
        ...prev,
        featuredImage: file
      }))
    // Clear any previous errors
    if (error && error.includes("Featured image")) {
      setError("")
    }
  }

  const handleGalleryImagesUpload = async (e) => {
    const files = Array.from(e.target.files)
    if (files.length === 0) return

    // Check total count limit (9 items max including existing)
    const currentCount = formData.galleryImages.length + (formData.existingGalleryImages?.length || 0)
    const remainingSlots = 9 - currentCount

    if (remainingSlots <= 0) {
      setError(`Maximum 9 items allowed in gallery. You have reached the limit.`)
      e.target.value = ""
      return
    }

    if (files.length > remainingSlots) {
      setError(`You can only upload up to ${remainingSlots} more item(s). Maximum 9 items allowed in gallery.`)
      e.target.value = ""
      return
    }

    // Check for duplicate files by comparing name and size
    const existingFileNames = new Set(formData.galleryImages.map(f => `${f.name}-${f.size}`))
    const newFiles = files.filter(file => !existingFileNames.has(`${file.name}-${file.size}`))

    if (newFiles.length < files.length) {
      setError(`Some files are already selected. Only ${newFiles.length} new file(s) will be added.`)
    }

    if (newFiles.length === 0) {
      e.target.value = ""
      return
    }

    // Check if adding new files would exceed the limit
    if (newFiles.length > remainingSlots) {
      setError(`You can only upload up to ${remainingSlots} more item(s). Maximum 9 items allowed in gallery.`)
      e.target.value = ""
      return
    }

    const validFiles = []
    for (const file of newFiles) {
      const validation = await validateGalleryMedia(file)
      if (validation.isValid) {
        validFiles.push(file)
      } else {
        setError(validation.error)
        e.target.value = ""
        return // Stop on first invalid file
      }
    }

    if (validFiles.length > 0) {
    setFormData(prev => ({
      ...prev,
        galleryImages: [...prev.galleryImages, ...validFiles]
      }))
      // Clear any previous errors
      if (error && error.includes("Gallery")) {
        setError("")
      }
      // Clear the file input after successful upload
      e.target.value = ""
    }
  }

  const removeGalleryImage = (index) => {
    setFormData(prev => ({
      ...prev,
      galleryImages: prev.galleryImages.filter((_, i) => i !== index)
    }))
  }

  const removeExistingGalleryImage = (index) => {
    setFormData(prev => ({
      ...prev,
      existingGalleryImages: prev.existingGalleryImages.filter((_, i) => i !== index)
    }))
  }

  const removeFeaturedImage = () => {
    setFormData(prev => ({
      ...prev,
      existingFeaturedImage: null
    }))
  }

  const handleTemplateToggle = (templateId) => {
    setFormData(prev => ({
      ...prev,
      selectedTemplates: prev.selectedTemplates.includes(templateId)
        ? prev.selectedTemplates.filter(id => id !== templateId)
        : [...prev.selectedTemplates, templateId]
    }))
  }

  const buildProductData = (currentTab = activeTab) => {
    const productData = new FormData()
    productData.append("name", formData.name.trim())
    productData.append("productType", formData.productType)
    productData.append("shortDescription", formData.shortDescription || "")
    productData.append("description", formData.longDescription || "")
    productData.append("category", formData.category)
    if (formData.subcategory) productData.append("subcategory", formData.subcategory)
    if (formData.brand) productData.append("brand", formData.brand)
      productData.append("tags", formData.tags || "")
      productData.append("productStatus", formData.productStatus)
      productData.append("isActive", formData.productStatus === "active")
      
    // Product Attributes (Details tab)
      if (formData.collarStyle) productData.append("collarStyle", formData.collarStyle)
      if (formData.material) productData.append("material", formData.material)
      if (formData.pattern) productData.append("pattern", formData.pattern)
      if (formData.fitType) productData.append("fitType", formData.fitType)
      if (formData.sleeveType) productData.append("sleeveType", formData.sleeveType)
      if (formData.printingType) productData.append("printingType", formData.printingType)
      if (formData.countryOfOrigin) productData.append("countryOfOrigin", formData.countryOfOrigin)
    productData.append("includedComponents", formData.includedComponents || "")
    productData.append("productCareInstructions", formData.productCareInstructions || "")
    productData.append("recommendedUsesForProduct", formData.recommendedUsesForProduct || "")
    productData.append("reusability", formData.reusability || "")
    productData.append("shape", formData.shape || "")
    productData.append("specialFeature", formData.specialFeature || "")
    productData.append("specificUsesForProduct", formData.specificUsesForProduct || "")
    productData.append("style", formData.style || "")
    productData.append("design", formData.design || "")
    productData.append("occasion", formData.occasion || "")

    productData.append("price", formData.basePrice)
    if (formData.productType === "customized") {
      const printSidePricingPayload = (managedPrintSides || [])
        .filter((d) => !d.deleted)
        .map((d) => {
          const id = String(d._id)
          const v = formData.printSidePricing?.[id] || { enabled: false, price: "" }
          let price = null
          if (v.enabled && v.price !== "" && v.price != null) {
            const n = parseFloat(v.price)
            price = Number.isFinite(n) ? Math.round(n) : null
          }
          return { printSide: id, enabled: Boolean(v.enabled), price }
        })
      productData.append("printSidePricing", JSON.stringify(printSidePricingPayload))
      const addOnPricingPayload = (managedProductAddons || [])
        .filter((d) => !d.deleted)
        .map((d) => {
          const id = String(d._id)
          const v = formData.addOnPricing?.[id] || { enabled: false, price: "" }
          let price = null
          if (v.enabled && v.price !== "" && v.price != null) {
            const n = parseFloat(v.price)
            price = Number.isFinite(n) ? Math.round(n) : null
          }
          return { productAddon: id, enabled: Boolean(v.enabled), price }
        })
      productData.append("addOnPricing", JSON.stringify(addOnPricingPayload))
    } else {
      productData.append("printSidePricing", JSON.stringify([]))
      productData.append("addOnPricing", JSON.stringify([]))
    }
    productData.append(
      "plainProductPrice",
      formData.productType === "customized" ? (formData.plainProductPrice ?? "").toString().trim() : ""
    )
    if (formData.discountPrice) productData.append("discountedPrice", formData.discountPrice)
    if (formData.discountPercentage) productData.append("discountPercentage", formData.discountPercentage)
    const quantityTierBands = [
      { minQty: 1, maxQty: 5 },
      { minQty: 6, maxQty: 10 },
      { minQty: 11, maxQty: 20 },
      { minQty: 21, maxQty: null },
    ]
    const quantityDiscountTiersPayload = quantityTierBands.map((band, i) => {
      const raw = formData.quantityTierDiscounts?.[i]
      const n = parseFloat(raw)
      const discountPercent =
        raw === "" || raw == null || !Number.isFinite(n) ? 0 : Math.min(100, Math.max(0, n))
      return { minQty: band.minQty, maxQty: band.maxQty, discountPercent }
    })
    productData.append("quantityDiscountTiers", JSON.stringify(quantityDiscountTiersPayload))
    if (formData.taxClass) productData.append("taxClass", formData.taxClass)
    if (formData.sku) productData.append("sku", formData.sku)
    if (formData.noOfPcsIncluded) productData.append("noOfPcsIncluded", formData.noOfPcsIncluded)
    productData.append("stockManagement", formData.stockManagement)
    if (formData.stockManagement === "track") {
      productData.append("stock", formData.quantity || 0)
      productData.append("lowStockThreshold", formData.lowStockThreshold || 10)
    } else {
      productData.append("stock", -1)
    }

    if (formData.weight) productData.append("weight", formData.weight)
    if (formData.dimensions && (formData.dimensions.length || formData.dimensions.width || formData.dimensions.height)) {
      productData.append("dimensions", JSON.stringify(formData.dimensions))
    }
    if (formData.shippingClass) productData.append("shippingClass", formData.shippingClass)
    if (formData.processingTime) productData.append("processingTime", formData.processingTime)
    productData.append("madeToOrder", formData.madeToOrder ? "true" : "false")

    // Customization fields (edited on Templates tab; only sent for customized products)
    if (formData.productType === "customized") {
      productData.append("customizationEnabled", "true")
      productData.append("textCustomization", JSON.stringify(formData.textCustomization))
      productData.append("imageUploadCustomization", JSON.stringify(formData.imageUploadCustomization))
      productData.append("livePreviewEnabled", formData.livePreviewEnabled ? "true" : "false")
    }

    // Media - Only include when saving from Media tab or final submit
    if (currentTab === "media" || currentTab === "seo" || currentTab === "templates" || currentTab === "variations" || currentTab === "final") {
      // Handle featured image
    if (formData.featuredImage) {
        // New featured image uploaded
      productData.append("mainImage", formData.featuredImage)
      } else if (editingId && !formData.existingFeaturedImage) {
        // Featured image was removed, send empty string to clear it
        productData.append("mainImage", "")
      }
      // Note: If editing and existingFeaturedImage exists and no new image, backend preserves existing mainImage
      
      // Handle gallery images
      if (editingId) {
        // When editing, send remaining existing images as JSON array
        // This allows backend to replace the images array with the correct set
        if (formData.existingGalleryImages && formData.existingGalleryImages.length > 0) {
          productData.append("existingImages", JSON.stringify(formData.existingGalleryImages))
        } else {
          // If all existing images were removed, send empty array
          productData.append("existingImages", JSON.stringify([]))
        }
        // Send new files
    formData.galleryImages.forEach(image => {
      if (image instanceof File) {
        productData.append("images", image)
      }
    })
      } else {
        // For new products, just send new files
        formData.galleryImages.forEach(image => {
          if (image instanceof File) {
            productData.append("images", image)
          }
        })
      }
    }


    // Templates - Only include when saving from Templates tab or final submit
    if (currentTab === "templates" || currentTab === "seo" || currentTab === "variations" || currentTab === "final") {
    if (formData.productType === "customized") {
      formData.selectedTemplates.forEach(templateId => {
        productData.append("templates", templateId)
      })
      }
    }

    if (currentTab === "seo" || currentTab === "templates" || currentTab === "variations" || currentTab === "final") {
    productData.append("metaDescription", formData.metaDescription || `Create a personalized ${formData.name}. Perfect gift for birthdays, anniversaries & special moments.`)
    if (formData.primaryKeyword || formData.secondaryKeywords) {
      const metaKeywords = [formData.primaryKeyword, formData.secondaryKeywords].filter(Boolean).join(", ")
      productData.append("metaKeywords", metaKeywords)
    }
    if (formData.canonicalUrl) productData.append("canonicalLink", formData.canonicalUrl)
    if (formData.customSchema) productData.append("jsonLd", formData.customSchema)
    
    productData.append("seoTitle", formData.seoTitle || `${formData.name} | ${storeName}`)
    productData.append("urlSlug", formData.urlSlug || generateSlug(formData.name))
    productData.append("index", formData.index ? "true" : "false")
    if (formData.primaryKeyword) productData.append("primaryKeyword", formData.primaryKeyword)
    if (formData.secondaryKeywords) productData.append("secondaryKeywords", formData.secondaryKeywords)
    if (formData.openGraphImage) productData.append("openGraphImage", formData.openGraphImage)
    productData.append("schemaType", formData.schemaType)
    productData.append("robotsMeta", JSON.stringify(formData.robotsMeta))
    }

    formData.selectedColors.forEach(colorId => productData.append("colors", colorId))
    formData.selectedSizes.forEach(sizeId => productData.append("sizes", sizeId))
    formData.selectedHeights.forEach(heightId => productData.append("heights", heightId))
    formData.selectedLengths.forEach(lengthId => productData.append("lengths", lengthId))

    return productData
  }

  // Tab-specific validation functions
  const validateTab = (tabId) => {
    switch (tabId) {
      case "details":
        // Product Details tab validation
        if (!formData.name.trim()) {
          setError("Product name is required")
          return false
        }
        if (!formData.basePrice || parseFloat(formData.basePrice) <= 0) {
          setError("Base price is required and must be greater than 0")
          return false
        }
        if (!formData.category) {
          setError("Category is required")
          return false
        }
        if (formData.stockManagement === "track" && (!formData.quantity || parseFloat(formData.quantity) < 0)) {
          setError("Quantity is required when stock tracking is enabled")
          return false
        }
        if (formData.sku && formData.sku.trim()) {
          const skuRegex = /^[A-Z0-9]{9}$/
          if (!skuRegex.test(formData.sku)) {
            setError("SKU must be exactly 9 alphanumeric characters (A-Z, 0-9)")
            return false
          }
        }
        return true

      case "variations":
        // Variations tab - no validation needed (handled by ProductVariationsTab component)
        return true

      case "media":
        // Media tab validation
        if (!formData.featuredImage && !formData.existingFeaturedImage) {
          setError("Featured image is required")
          return false
        }
        return true

      case "seo":
        return true

      case "templates":
        if (formData.productType === "customized" && !formData.selectedTemplates.length) {
          setError("At least one template is required for customized products")
          return false
        }
        
        // Validate madeToOrder for customized products
        if (formData.productType === "customized" && !formData.madeToOrder) {
          setError("Made-to-Order must be enabled for customized products")
          return false
        }
        return true

      default:
        return true
    }
  }

  const saveProductDraft = async (moveToNextTab = false) => {
    if (!validateTab(activeTab)) {
      return false
    }

    try {
      setLoading(true)
      setError("")
      setSuccess("")

      const productData = buildProductData(activeTab)

      let savedProductId = editingId

      if (editingId) {
        await api.put(`/products/${editingId}`, productData, {
          headers: { "Content-Type": "multipart/form-data" }
        })
        setSuccess(`✅ Product details saved!`)
      } else {
        const response = await api.post("/products", productData, {
          headers: { "Content-Type": "multipart/form-data" }
        })
        savedProductId = response.data.product?._id || response.data._id
        setEditingId(savedProductId)
        setSuccess(`✅ Product created! You can now add variations, images, and SEO details.`)
      }

      if (moveToNextTab) {
        const currentTabIndex = tabs.findIndex(tab => tab.id === activeTab)
        if (currentTabIndex < tabs.length - 1) {
          setActiveTab(tabs[currentTabIndex + 1].id)
        }
      }

      fetchProducts()
      return true
    } catch (err) {
      setError(err.response?.data?.msg || err.response?.data?.message || "Failed to save product")
      return false
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Only allow form submission from the last tab
    const currentTabIndex = tabs.findIndex(tab => tab.id === activeTab)
    const isLastTab = currentTabIndex === tabs.length - 1
    if (!isLastTab) {
      // Not on last tab - don't submit, just return
      console.log("Form submission prevented - not on last tab")
      return
    }
    
    if (!formData.name.trim()) {
      setError("Product name is required")
      return
    }
    if (!formData.basePrice || parseFloat(formData.basePrice) <= 0) {
      setError("Base price is required and must be greater than 0")
      return
    }
    if (!formData.category) {
      setError("Category is required")
      return
    }
    if (!formData.featuredImage && !formData.existingFeaturedImage) {
      setError("Featured image is required")
      return
    }
    if (formData.stockManagement === "track" && (!formData.quantity || parseFloat(formData.quantity) < 0)) {
      setError("Quantity is required when stock tracking is enabled")
      return
    }
    // SKU validation - if provided, must be exactly 9 alphanumeric characters
    if (formData.sku && formData.sku.trim()) {
      const skuRegex = /^[A-Z0-9]{9}$/
      if (!skuRegex.test(formData.sku)) {
        setError("SKU must be exactly 9 alphanumeric characters (A-Z, 0-9)")
        return
      }
    }
    if (formData.productType === "customized" && !formData.selectedTemplates.length) {
      setError("At least one template is required for customized products")
      return
    }
    
    // Validate madeToOrder for customized products
    if (formData.productType === "customized" && !formData.madeToOrder) {
      setError("Made-to-Order must be enabled for customized products")
      return
    }

    try {
      setLoading(true)
      setError("")
      setSuccess("")

      const productData = buildProductData("final")

      if (editingId) {
        await api.put(`/products/${editingId}`, productData, {
          headers: { "Content-Type": "multipart/form-data" }
        })
        setSuccess(`✅ Product "${formData.name}" has been updated successfully!`)
      } else {
        await api.post("/products", productData, {
          headers: { "Content-Type": "multipart/form-data" }
        })
        setSuccess(`✅ Product "${formData.name}" has been created successfully!`)
      }

      resetForm()
      fetchProducts()
    } catch (err) {
      setError(err.response?.data?.msg || err.response?.data?.message || "Failed to save product")
    } finally {
      setLoading(false)
    }
  }

  const fetchProductVariations = async (productId) => {
    if (productVariationsCache[productId]) {
      return productVariationsCache[productId]
    }
    
    try {
      const response = await api.get(`/products/${productId}/variants`)
      const variants = response.data.variants || response.data || []
      
      // Use a single cache-buster value per product variation fetch
      const cacheBuster = Date.now()
      const processedVariants = variants.map(variant => {
        const variantImage = variant.primaryImage || variant.images?.[0] || variant.image
        let processedImage = variantImage
        if (variantImage && !variantImage.startsWith('http')) {
          if (variantImage.startsWith('/uploads/')) {
            processedImage = `${variantImage}`
          }
        }
        // Append cache-buster for the primary image
        processedImage = addCacheBuster(processedImage, cacheBuster)
        
        const processedImages = (variant.images || []).map(img => {
          if (img && !img.startsWith('http')) {
            if (img.startsWith('/uploads/')) {
              img = `${img}`
            }
          }
          // Append cache-buster for gallery images
          return addCacheBuster(img, cacheBuster)
        })
        
        return {
          ...variant,
          image: processedImage,
          primaryImage: processedImage,
          images: processedImages.length > 0 ? processedImages : (processedImage ? [processedImage] : [])
        }
      })
      
      setProductVariationsCache(prev => ({
        ...prev,
        [productId]: processedVariants
      }))
      
      return processedVariants
    } catch (err) {
      return []
    }
  }

  const openMediaPopup = (mediaUrl, isVideo = false) => {
    setMediaPopup({
      isOpen: true,
      mediaUrl,
      isVideo
    })
  }

  const closeMediaPopup = () => {
    setMediaPopup({
      isOpen: false,
      mediaUrl: null,
      isVideo: false
    })
  }

  const toOptionId = (v) => (v != null && v !== "" ? String(typeof v === "object" && v !== null && v._id != null ? v._id : v) : "")

  const normalizeProductForForm = (p) => {
    if (!p) return p
    const dim = p.dimensions && typeof p.dimensions === "object" ? p.dimensions : {}
    return {
      ...p,
      shortDescription: p.shortDescription ?? "",
      tags: p.tags ?? "",
      weight: p.weight != null && p.weight !== "" ? String(p.weight) : "",
      shippingClass: p.shippingClass != null && p.shippingClass !== "" ? String(p.shippingClass) : "",
      processingTime: p.processingTime != null && p.processingTime !== "" ? String(p.processingTime) : "",
      dimensions: {
        length: dim.length != null && dim.length !== "" ? (typeof dim.length === "object" && dim.length?._id != null ? String(dim.length._id) : String(dim.length)) : "",
        width: dim.width != null && dim.width !== "" ? (typeof dim.width === "object" && dim.width?._id != null ? String(dim.width._id) : String(dim.width)) : "",
        height: dim.height != null && dim.height !== "" ? (typeof dim.height === "object" && dim.height?._id != null ? String(dim.height._id) : String(dim.height)) : "",
      },
    }
  }

  const handleEdit = async (product) => {
    setEditingId(product._id)
    prevNameRef.current = product.name || ""
    prevProductTypeRef.current = product.productType || (product.displayMode === "customized" ? "customized" : "standard")
    seoAutoGeneratedRef.current = false
    let p = normalizeProductForForm(product)
    let apiProduct = null
    try {
      const res = await api.get(`/products/${product._id}?_t=${Date.now()}`)
      const raw = res.data?.product ?? res.data
      if (raw && raw._id) {
        apiProduct = raw
        p = normalizeProductForForm(raw)
      }
    } catch (e) {
      console.warn("Could not fetch full product, using list data:", e?.message)
    }
    const listProduct = normalizeProductForForm(product)
    const fallback = (key, def = "") => (p[key] !== undefined && p[key] !== null && p[key] !== "" ? p[key] : (listProduct[key] !== undefined && listProduct[key] !== null && listProduct[key] !== "" ? listProduct[key] : def))
    const fallbackStr = (key, def = "") => String(fallback(key, def) || "")

    // Shipping & fulfillment: prefer values directly from API response so they always load in edit
    const apiWeight = apiProduct != null && apiProduct.weight != null && apiProduct.weight !== "" ? String(apiProduct.weight) : ""
    const apiShippingClass = apiProduct?.shippingClass != null && apiProduct.shippingClass !== "" ? String(apiProduct.shippingClass).trim() : ""
    const apiProcessingTime = apiProduct?.processingTime != null && apiProduct.processingTime !== "" ? String(apiProduct.processingTime) : ""
    const apiDim = apiProduct?.dimensions && typeof apiProduct.dimensions === "object" ? apiProduct.dimensions : {}
    const apiDimLength = apiDim.length != null && apiDim.length !== "" ? (typeof apiDim.length === "object" && apiDim.length?._id != null ? String(apiDim.length._id) : String(apiDim.length)) : ""
    const apiDimWidth = apiDim.width != null && apiDim.width !== "" ? (typeof apiDim.width === "object" && apiDim.width?._id != null ? String(apiDim.width._id) : String(apiDim.width)) : ""
    const apiDimHeight = apiDim.height != null && apiDim.height !== "" ? (typeof apiDim.height === "object" && apiDim.height?._id != null ? String(apiDim.height._id) : String(apiDim.height)) : ""
    const apiCollarStyle = apiProduct != null ? toOptionId(apiProduct.collarStyle?._id ?? apiProduct.collarStyle) : ""
    const apiPattern = apiProduct != null ? toOptionId(apiProduct.pattern?._id ?? apiProduct.pattern) : ""
    const apiFitType = apiProduct != null ? toOptionId(apiProduct.fitType?._id ?? apiProduct.fitType) : ""

    setFormData({
      name: p.name || listProduct.name || "",
      productType: p.productType || (p.displayMode === "customized" ? "customized" : "standard"),
      shortDescription: fallbackStr("shortDescription"),
      longDescription: (p.description ?? listProduct.description) ?? "",
      category: toOptionId(p.category?._id || p.category || listProduct.category?._id || listProduct.category),
      subcategory: toOptionId(p.subcategory?._id || p.subcategory || listProduct.subcategory?._id || listProduct.subcategory),
      brand: toOptionId(p.brand?._id || p.brand || listProduct.brand?._id || listProduct.brand),
      tags: fallbackStr("tags"),
      productStatus: p.productStatus || (p.isActive ? "active" : "draft"),
      collarStyle: apiCollarStyle !== "" ? apiCollarStyle : toOptionId(p.collarStyle?._id || p.collarStyle || listProduct.collarStyle?._id || listProduct.collarStyle),
      material: toOptionId(p.material?._id || p.material || listProduct.material?._id || listProduct.material),
      pattern: apiPattern !== "" ? apiPattern : toOptionId(p.pattern?._id || p.pattern || listProduct.pattern?._id || listProduct.pattern),
      fitType: apiFitType !== "" ? apiFitType : toOptionId(p.fitType?._id || p.fitType || listProduct.fitType?._id || listProduct.fitType),
      sleeveType: toOptionId(p.sleeveType?._id || p.sleeveType),
      printingType: toOptionId(p.printingType?._id || p.printingType),
      countryOfOrigin: toOptionId(p.countryOfOrigin?._id || p.countryOfOrigin),
      includedComponents: (p.includedComponents ?? listProduct.includedComponents) ?? "",
      productCareInstructions: (p.productCareInstructions ?? listProduct.productCareInstructions) ?? "",
      recommendedUsesForProduct: (p.recommendedUsesForProduct ?? listProduct.recommendedUsesForProduct) ?? "",
      reusability: (p.reusability ?? listProduct.reusability) ?? "",
      shape: (p.shape ?? listProduct.shape) ?? "",
      specialFeature: (p.specialFeature ?? listProduct.specialFeature) ?? "",
      specificUsesForProduct: (p.specificUsesForProduct ?? listProduct.specificUsesForProduct) ?? "",
      style: (p.style ?? listProduct.style) ?? "",
      design: (p.design ?? listProduct.design) ?? "",
      occasion: (p.occasion ?? listProduct.occasion) ?? "",
      printSidePricing: mergePricingMapFromProductRows(
        apiProduct?.printSidePricing ?? p.printSidePricing ?? listProduct.printSidePricing,
        "printSide"
      ),
      addOnPricing: mergePricingMapFromProductRows(
        apiProduct?.addOnPricing ?? p.addOnPricing ?? listProduct.addOnPricing,
        "productAddon"
      ),
      basePrice: p.price != null && p.price !== "" ? Math.round(Number(p.price)) : "",
      plainProductPrice:
        p.plainProductPrice != null && p.plainProductPrice !== ""
          ? Math.round(Number(p.plainProductPrice))
          : "",
      discountPrice: p.discountedPrice != null && p.discountedPrice !== "" ? Math.round(Number(p.discountedPrice)) : "",
      discountPercentage: p.discountPercentage || (p.price && p.discountedPrice && p.price > p.discountedPrice ? Math.round(((p.price - p.discountedPrice) / p.price * 100)) : ""),
      quantityTierDiscounts: tiersToFormQuantityDiscounts(
        apiProduct?.quantityDiscountTiers ?? p.quantityDiscountTiers ?? listProduct.quantityDiscountTiers
      ),
      taxClass: toOptionId(p.taxClass),
      sku: (p.sku ?? listProduct.sku) ?? "",
      noOfPcsIncluded: (p.noOfPcsIncluded ?? listProduct.noOfPcsIncluded) ?? "",
      stockManagement: p.stock === -1 ? "unlimited" : "track",
      quantity: p.stock === -1 ? "" : (p.stock ?? listProduct.stock ?? ""),
      lowStockThreshold: (p.lowStockThreshold ?? listProduct.lowStockThreshold) ?? "10",
      featuredImage: null,
      galleryImages: [],
      existingFeaturedImage: p.mainImage || listProduct.mainImage || null,
      existingGalleryImages: p.images || listProduct.images || [],
      customizationEnabled: p.customizationEnabled ?? listProduct.customizationEnabled ?? false,
      textCustomization: p.textCustomization ?? listProduct.textCustomization ?? initialFormData.textCustomization,
      imageUploadCustomization: p.imageUploadCustomization ?? listProduct.imageUploadCustomization ?? initialFormData.imageUploadCustomization,
      predefinedOptions: p.predefinedOptions ?? listProduct.predefinedOptions ?? [],
      livePreviewEnabled: p.livePreviewEnabled ?? listProduct.livePreviewEnabled ?? false,
      weight: apiWeight !== "" ? apiWeight : fallbackStr("weight"),
      dimensions: {
        length: apiDimLength !== "" ? apiDimLength : toOptionId(p.dimensions?.length?._id ?? p.dimensions?.length ?? listProduct.dimensions?.length?._id ?? listProduct.dimensions?.length),
        width: apiDimWidth !== "" ? apiDimWidth : toOptionId(p.dimensions?.width?._id ?? p.dimensions?.width ?? listProduct.dimensions?.width?._id ?? listProduct.dimensions?.width),
        height: apiDimHeight !== "" ? apiDimHeight : toOptionId(p.dimensions?.height?._id ?? p.dimensions?.height ?? listProduct.dimensions?.height?._id ?? listProduct.dimensions?.height),
      },
      shippingClass: (() => {
        const raw = (apiShippingClass !== "" ? apiShippingClass : (p.shippingClass != null && p.shippingClass !== "" ? String(p.shippingClass) : (listProduct.shippingClass != null && listProduct.shippingClass !== "" ? String(listProduct.shippingClass) : ""))).trim()
        const lower = raw.toLowerCase()
        if (lower === "standard" || lower === "express") return lower
        return raw || ""
      })(),
      processingTime: apiProcessingTime !== "" ? apiProcessingTime : (p.processingTime ?? listProduct.processingTime) ?? "",
      madeToOrder: p.madeToOrder !== undefined ? p.madeToOrder : (p.productType === "customized" || p.displayMode === "customized"),
      seoTitle: p.seo?.seoTitle || p.seoTitle || "",
      metaDescription: p.seo?.metaDescription || p.metaDescription || "",
      urlSlug: p.seo?.urlSlug || p.urlSlug || "",
      index: p.seo?.index !== undefined ? p.seo.index : true,
      primaryKeyword: p.seo?.primaryKeyword || "",
      secondaryKeywords: p.seo?.secondaryKeywords || "",
      openGraphImage: p.seo?.openGraphImage || "",
      canonicalUrl: p.seo?.canonicalUrl || p.canonicalLink || "",
      schemaType: p.seo?.schemaType || "Product",
      customSchema: p.seo?.customSchema || p.jsonLd || "",
      robotsMeta: p.seo?.robotsMeta || { noimageindex: false, nosnippet: false },
      selectedTemplates: (p.templates || []).map(t => String(typeof t === "object" && t != null && t._id != null ? t._id : t)),
      selectedColors: (p.colors || []).map(c => String(typeof c === "object" && c != null && c._id != null ? c._id : c)),
      selectedSizes: (p.sizes || []).map(s => String(typeof s === "object" && s != null && s._id != null ? s._id : s)),
      selectedHeights: (p.heights || []).map(h => String(typeof h === "object" && h != null && h._id != null ? h._id : h)),
      selectedLengths: (p.lengths || []).map(l => String(typeof l === "object" && l != null && l._id != null ? l._id : l)),
      hasVariations: Boolean(p.hasVariations ?? listProduct.hasVariations),
    })

    // Subcategories/templates are fetched by useEffect when formData.category (and productType) update
    setActiveTab("details")
    setTimeout(() => {
      if (formRef.current) formRef.current.scrollIntoView({ behavior: "smooth", block: "start" })
    }, 100)
  }

  const resetForm = () => {
    setFormData(initialFormData)
    setEditingId(null)
    setActiveTab("details")
    setShowAdvancedSEO(false)
    // Reset refs
    prevNameRef.current = ""
    prevProductTypeRef.current = ""
    seoAutoGeneratedRef.current = false
    setSubcategories([])
    setTemplates([])
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleDelete = (productId) => {
    const product = products.find(p => p._id === productId)
    const isAlreadyDeleted = product?.deleted
    
    let message
    let isPermanentDelete = false
    
    if (isAlreadyDeleted) {
      message = "This product is already marked as deleted. Click OK to permanently remove it from the database. This action cannot be undone."
      isPermanentDelete = true
    } else {
      message = "This will mark the product as inactive and add a deleted flag. Click OK to continue."
      isPermanentDelete = false
    }
    
    setDeletePopup({
      isVisible: true,
      productId,
      message,
      isPermanentDelete,
      action: "delete"
    })
  }

  const handleDeleteConfirm = async () => {
    const { productId, isPermanentDelete } = deletePopup
    const product = products.find(p => p._id === productId)
    
    try {
      setLoading(true)
      setSuccess("")
      setError("")
      
      if (isPermanentDelete) {
        await api.delete(`/products/${productId}/hard`)
        setSuccess(`🗑️ Product "${product.name}" has been permanently deleted from the database.`)
      } else {
        await api.delete(`/products/${productId}`)
        setSuccess(`⏸️ Product "${product.name}" has been marked as deleted and inactive.`)
      }
      
      await fetchProducts()
    } catch (err) {
      const action = isPermanentDelete ? "permanently delete" : "mark as deleted"
      setError(`❌ Failed to ${action} product "${product.name}". ${err.response?.data?.msg || 'Please try again.'}`)
    } finally {
      setLoading(false)
      setDeletePopup({
        isVisible: false,
        productId: null,
        message: "",
        isPermanentDelete: false,
        action: "delete"
      })
    }
  }

  const handleDeleteCancel = () => {
    setDeletePopup({
      isVisible: false,
      productId: null,
      message: "",
      isPermanentDelete: false,
      action: "delete"
    })
  }

  // Revert deleted product
  const handleRevert = (productId) => {
    const product = products.find(p => (p._id && (p._id === productId || String(p._id) === String(productId))))

    if (!product) {
      setError("Product not found")
      return
    }

    if (!product.deleted) {
      setError("This product is not deleted")
      return
    }

    const idStr = product._id?.toString?.() || product._id
    setDeletePopup({
      isVisible: true,
      productId: idStr,
      message: `Are you sure you want to restore the product "${product.name}"? This will make it active again.`,
      isPermanentDelete: false,
      action: "revert"
    })
  }

  // Handle revert confirmation
  const handleRevertConfirm = async () => {
    const { productId } = deletePopup
    const product = products.find(p => (p._id && (p._id === productId || String(p._id) === String(productId))))

    if (!productId || !product) {
      setError("Product not found. It may have been removed from the list.")
      setDeletePopup({
        isVisible: false,
        productId: null,
        message: "",
        isPermanentDelete: false,
        action: "delete"
      })
      return
    }

    try {
      setLoading(true)
      setSuccess("")
      setError("")

      // Revert the product using dedicated restore endpoint (no multer/FormData)
      const id = product._id?.toString?.() || productId?.toString?.() || productId
      await api.put(`/products/${id}/restore`)

      setSuccess(`✅ Product "${product.name}" has been restored and is now active!`)
      await fetchProducts()
    } catch (err) {
      setError(`❌ Failed to restore product "${product.name}". ${err.response?.data?.msg || 'Please try again.'}`)
    } finally {
      setLoading(false)
      setDeletePopup({
        isVisible: false,
        productId: null,
        message: "",
        isPermanentDelete: false,
        action: "delete"
      })
    }
  }

  // Handle revert cancellation
  const handleRevertCancel = () => {
    setDeletePopup({
      isVisible: false,
      productId: null,
      message: "",
      isPermanentDelete: false,
      action: "delete"
    })
  }

  const [variationSettings, setVariationSettings] = useState([])

  const fetchVariationSettings = useCallback(async () => {
    try {
      const response = await api.get("/variation-settings")
      const data = response?.data
      setVariationSettings(Array.isArray(data) ? data : [])
    } catch (err) {
      setVariationSettings([])
    }
  }, [])

  useEffect(() => {
    fetchVariationSettings()
  }, [fetchVariationSettings])

  // Check if current category/subcategory supports variations (variation-settings manager)
  const categorySupportsVariations = useMemo(() => {
    if (!formData.category) return false
    const catStr = String(formData.category)
    const subStr = formData.subcategory ? String(formData.subcategory) : ""

    if (subStr) {
      const subcategorySetting = variationSettings.find((setting) => {
        const sid = refIdToString(setting.subcategory)
        return (
          sid !== "" &&
          sid === subStr &&
          setting.enabled === true &&
          !setting.deleted
        )
      })
      if (subcategorySetting) return true
    }

    const categorySetting = variationSettings.find((setting) => {
      const cid = refIdToString(setting.category)
      const noSub = !setting.subcategory || refIdToString(setting.subcategory) === ""
      return (
        cid !== "" &&
        cid === catStr &&
        noSub &&
        setting.enabled === true &&
        !setting.deleted
      )
    })

    return !!categorySetting
  }, [formData.category, formData.subcategory, variationSettings])

  // Resolve variation setting for current product (subcategory first, then category)
  const variationSettingForProduct = useMemo(() => {
    if (!formData.category) return null
    const catStr = String(formData.category)
    const subStr = formData.subcategory ? String(formData.subcategory) : ""
    if (subStr) {
      const sub = variationSettings.find((setting) => {
        const sid = refIdToString(setting.subcategory)
        return sid !== "" && sid === subStr && setting.enabled === true && !setting.deleted
      })
      if (sub) return sub
    }
    return (
      variationSettings.find((setting) => {
        const cid = refIdToString(setting.category)
        const noSub = !setting.subcategory || refIdToString(setting.subcategory) === ""
        return (
          cid !== "" &&
          cid === catStr &&
          noSub &&
          setting.enabled === true &&
          !setting.deleted
        )
      }) || null
    )
  }, [formData.category, formData.subcategory, variationSettings])

  // Show Variations tab when category is configured for variants, or when editing a product that already has variants
  const showVariationsTab = useMemo(
    () => categorySupportsVariations || (!!editingId && formData.hasVariations === true),
    [categorySupportsVariations, editingId, formData.hasVariations],
  )

  // Which attributes are required when creating variants (from variation setting basis)
  const variationRequiredAttributes = useMemo(() => {
    const basis = variationSettingForProduct?.variationBasis || "size_and_color"
    if (basis === "color_only") return ["color"]
    if (basis === "size_only") return ["size"]
    return ["color", "size"]
  }, [variationSettingForProduct])

  // Attribute order for variant UI: color_first => [color, size], size_first => [size, color]
  const variationAttributeOrder = useMemo(() => {
    const basis = variationSettingForProduct?.variationBasis || "size_and_color"
    const displayBasis = variationSettingForProduct?.displayBasis || "color_first"
    if (basis === "color_only") return ["color"]
    if (basis === "size_only") return ["size"]
    return displayBasis === "size_first" ? ["size", "color"] : ["color", "size"]
  }, [variationSettingForProduct])

  // Switch away from variations tab if it should no longer be shown
  useEffect(() => {
    if (activeTab === "variations" && !showVariationsTab) {
      setActiveTab("details")
    }
  }, [showVariationsTab, activeTab])

  // Tabs configuration - Templates tab only shows for customized products
  // Variations tab only shows for specific categories (tshirt, caps, etc.)
  // Memoize tabs to prevent infinite re-renders
  const tabs = useMemo(() => [
    { id: "details", label: "📝 Product Details", icon: "📝" },
    ...(showVariationsTab ? [{ id: "variations", label: "🔀 Variations", icon: "🔀" }] : []),
    { id: "media", label: "🖼️ Media/Images", icon: "🖼️" },
    { id: "seo", label: "🔍 SEO", icon: "🔍" },
    ...(formData.productType === "customized" ? [{ id: "templates", label: "📐 Templates", icon: "📐" }] : [])
  ], [formData.productType, showVariationsTab])

  // Move to next tab after variations update (defined after tabs so tabs is initialized)
  const handleMoveToNextTab = useCallback(() => {
    const currentTabIndex = tabs.findIndex(tab => tab.id === activeTab)
    if (currentTabIndex >= 0 && currentTabIndex < tabs.length - 1) {
      setActiveTab(tabs[currentTabIndex + 1].id)
    }
  }, [activeTab, tabs])

  return (
    <div className="paddingAll20">
      {/* Header */}
      <PageHeader
        title="Product Management"
        subtitle="Manage your product catalog and inventory"
        isEditing={!!editingId}
        editText="Edit Product"
        createText="Add New Product"
      />

      {/* Success/Error Messages */}
      <AlertMessage
        type="success"
        message={success}
        onClose={() => setSuccess("")}
        autoClose={true}
      />
      
      <AlertMessage
        type="error"
        message={error}
        onClose={() => setError("")}
        autoClose={true}
      />

      {/* Product Form */}
      <div className="brandFormContainer paddingAll32 appendBottom30" ref={formRef}>
        <form onSubmit={handleSubmit} className="brandForm">
            <style>{`
              @keyframes fadeInSlideUp {
                0% {
                  opacity: 0;
                  transform: translateY(10px);
                }
                100% {
                  opacity: 1;
                  transform: translateY(0);
                }
              }
              .tab-content-enter {
                animation: fadeInSlideUp 0.3s ease-out;
              }
            `}</style>
            {/* Tabs */}
            <div style={{ 
              display: 'flex', 
              gap: '0', 
              borderBottom: '2px solid #e5e7eb',
              marginBottom: '24px',
              marginTop: '-24px',
              marginLeft: '-32px',
              marginRight: '-32px'
            }}>
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    padding: '12px 24px',
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    fontSize: '16px',
                    fontWeight: activeTab === tab.id ? '600' : '400',
                    color: activeTab === tab.id ? '#007bff' : '#666',
                    borderBottom: activeTab === tab.id ? '3px solid #007bff' : '3px solid transparent',
                    marginBottom: '-2px',
                    transition: 'all 0.2s',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '10px'
                  }}
                >
                  <span style={{ fontSize: '20px', lineHeight: '1', display: 'inline-block' }}>{tab.icon}</span>
                  <span>{tab.label.replace(/^[^\s]+\s/, "")}</span>
                </button>
              ))}
            </div>
            {/* Product Details Tab */}
            {activeTab === "details" && (
              <div className="tab-content-enter" key={`details-${editingId || "new"}`}>
                <ProductDetailsTab
                  formData={formData}
                  handleInputChange={handleInputChange}
                  handleMultiSelect={handleMultiSelect}
                  managedPrintSides={managedPrintSides}
                  managedProductAddons={managedProductAddons}
                  onPrintSidePricingChange={handlePrintSidePricingChange}
                  onAddOnPricingChange={handleAddOnPricingChange}
                  quantityTierLabels={["1–5 units", "6–10 units", "11–20 units", "21+ units"]}
                  categories={categories}
                  subcategories={subcategories}
                  brands={brands}
                  gstSlabs={gstSlabs}
                  collarStyles={collarStyles}
                  materials={materials}
                  patterns={patterns}
                  fitTypes={fitTypes}
                  sleeveTypes={sleeveTypes}
                  printingTypes={printingTypes}
                  countries={countries}
                  lengths={lengths}
                  widths={widths}
                  heights={heights}
                  colors={colors}
                  sizes={sizes}
                  categorySupportsVariations={categorySupportsVariations}
                  getUnitAbbreviation={getUnitAbbreviation}
                />
              </div>
            )}

            {/* Product Details Tab - Now handled by ProductDetailsTab component */}

            {/* Product Variations Tab */}
            {activeTab === "variations" && (
              <div className="tab-content-enter" onKeyDown={(e) => {
                // Prevent Enter key from submitting the parent form when on variations tab
                if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
                  e.preventDefault();
                  e.stopPropagation();
                }
              }}>
                {editingId ? (
                  <ProductVariationsTab
                    key={`variations-${editingId}`}
                    productId={editingId}
                    productName={editingId ? (formData.name || "Product") : "Product"}
                    productQuantity={formData.stockManagement === "track" ? (parseInt(formData.quantity) || 0) : -1}
                    requiredAttributes={variationRequiredAttributes}
                    attributeOrder={variationAttributeOrder}
                    onVariantsChange={handleVariantsChange}
                    onNextTab={handleMoveToNextTab}
                  />
                ) : (
                  <div style={{ 
                    padding: "40px", 
                    textAlign: "center", 
                    backgroundColor: "#f8f9fa",
                    borderRadius: "8px",
                    border: "1px solid #dee2e6"
                  }}>
                    <div style={{ fontSize: "18px", marginBottom: "10px", color: "#666" }}>
                      Save the product first to manage variations
                    </div>
                    <div style={{ fontSize: "14px", color: "#999" }}>
                      Create the product with basic information, then come back to add variations
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Media/Images Tab */}
            {activeTab === "media" && (
              <div className="tab-content-enter">
                <ProductMediaTab
                  formData={formData}
                  handleFeaturedImageUpload={handleFeaturedImageUpload}
                  handleGalleryImagesUpload={handleGalleryImagesUpload}
                  removeGalleryImage={removeGalleryImage}
                  removeExistingGalleryImage={removeExistingGalleryImage}
                  removeFeaturedImage={removeFeaturedImage}
                  editingId={editingId}
                />
              </div>
            )}

            {/* Media/Images Tab - Now handled by ProductMediaTab component */}

            {/* SEO Tab */}
            {activeTab === "seo" && (
              <div className="tab-content-enter">
                <ProductSEOTab
                  formData={formData}
                  handleInputChange={handleInputChange}
                  storeName={storeName}
                  generateSlug={generateSlug}
                />
              </div>
            )}

            {/* SEO Tab - Now handled by ProductSEOTab component */}

            {/* Templates Tab - Only for Customized Products */}
            {activeTab === "templates" && formData.productType === "customized" && (
              <div className="tab-content-enter">
                <ProductTemplatesTab
                  formData={formData}
                  templates={templates}
                  handleTemplateToggle={handleTemplateToggle}
                  handleInputChange={handleInputChange}
                />
              </div>
            )}

            {/* Templates Tab - Now handled by ProductTemplatesTab component */}

          {/* Submit Button */}
          <div className="formActions paddingTop16">
            {(() => {
              const currentTabIndex = tabs.findIndex(tab => tab.id === activeTab)
              const isLastTab = currentTabIndex === tabs.length - 1
              
              if (isLastTab) {
                // Last tab - show Create/Update button
                return (
                  <>
                    <button type="submit" className="btnPrimary" disabled={loading}>
                      {loading ? (
                        <span className="loadingSpinner">⏳</span>
                      ) : (
                        <span>{editingId ? "Update Product" : "Create Product"}</span>
                      )}
                    </button>
                    {editingId && (
                      <button type="button" onClick={resetForm} className="btnSecondary">
                        Cancel
                      </button>
                    )}
                  </>
                )
              } else {
                // Not last tab - show Save and move to next tab button
                const handleSaveAndNext = () => {
                  saveProductDraft(true).then(saved => {
                    if (!saved && !editingId) {
                      // If save failed and it's a new product, user needs to fix errors
                      return
                    }
                  })
                }
                
                return (
                  <>
                    <button 
                      type="button" 
                      className="btnPrimary" 
                      disabled={loading}
                      onClick={handleSaveAndNext}
                    >
                      {loading ? (
                        <span className="loadingSpinner">⏳</span>
                      ) : (
                        <span>Save Details and Move to Next Tab →</span>
                      )}
                    </button>
                    {editingId && (
                      <button type="button" onClick={resetForm} className="btnSecondary">
                        Cancel
                      </button>
                    )}
                  </>
                )
              }
            })()}
          </div>
        </form>
      </div>

      {/* Products List */}
      <div className="brandsListContainer paddingAll32">
        <div className="listHeader makeFlex spaceBetween end appendBottom24">
          <div className="leftSection">
            <h2 className="listTitle font30 fontBold blackText appendBottom16">Products ({filteredProducts.length})</h2>
            <StatusFilter
              statusFilter={statusFilter}
              onStatusChange={setStatusFilter}
              counts={calculateStandardStatusCounts(products)}
              disabled={loading}
            />
          </div>
          <div className="rightSection makeFlex end gap10">
            <SearchField
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products..."
              disabled={loading}
              minWidth="250px"
            />
            {loading && <div className="loadingIndicator grayText">Loading...</div>}
            <ViewToggle
              viewMode={viewMode}
              onViewChange={handleViewModeChange}
              disabled={loading}
            />
          </div>
        </div>

        {filteredProducts.length === 0 && !loading ? (
          <div className="emptyState textCenter paddingAll60">
            <div className="emptyIcon appendBottom16">📦</div>
            <h3 className="font22 fontSemiBold grayText appendBottom8">No Products Found</h3>
            <p className="font16 grayText appendBottom16">Start by adding your first product above</p>
          </div>
        ) : (
          <>
            {/* Card View */}
            {viewMode === 'card' && (
              <div className="brandsGrid">
                {displayedCards.map((product) => (
                  <EntityCard
                    key={product._id}
                    entity={product}
                    imageField="mainImage"
                    titleField="name"
                    idField="_id"
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    loading={loading}
                    imagePlaceholderColor={generateEntityColor(product._id, product.name)}
                    renderHeader={(product) => {
                      // Normalize image URL for popup
                      const normalizeImageUrl = (url) => {
                        if (!url) return null
                        if (url.startsWith("http")) return url
                        if (url.startsWith("/uploads/") || url.startsWith("/")) {
                          return `${url}`
                        }
                        return `/uploads/${url}`
                      }
                      
                      return (
                      <EntityCardHeader
                        entity={product}
                        imageField="mainImage"
                        titleField="name"
                        dateField="createdAt"
                        generateColor={generateEntityColor}
                          onImageClick={(imageUrl) => {
                            if (imageUrl) {
                              const normalizedUrl = normalizeImageUrl(imageUrl)
                              openMediaPopup(normalizedUrl, isVideoUrl(normalizedUrl))
                            }
                          }}
                        />
                      )
                    }}
                    renderDetails={(product) => (
                      <>
                        <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                          <span className="detailLabel font14 fontSemiBold grayText textUppercase">Product ID:</span>
                          <span className="detailValue font14 blackText appendLeft6">{product.productId || product._id}</span>
                        </div>
                        <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                          <span className="detailLabel font14 fontSemiBold grayText textUppercase">SKU:</span>
                          <span className="detailValue font14 blackText appendLeft6">{product.sku || "—"}</span>
                        </div>
                        <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                          <span className="detailLabel font14 fontSemiBold grayText textUppercase">Type:</span>
                          <span className={`detailValue font14 ${(product.productType === "customized" || product.displayMode === "customized" || product.type === "customized") ? 'blueText' : 'grayText'} appendLeft6`}>
                            {(product.productType === "customized" || product.displayMode === "customized" || product.type === "customized") ? "Customized" : "Standard"}
                          </span>
                        </div>
                        {/* Template ID and Image for customized products only */}
                        {(product.productType === "customized" || product.displayMode === "customized" || product.type === "customized") && (() => {
                          const hasTemplates = product.templates && Array.isArray(product.templates) && product.templates.length > 0
                          if (!hasTemplates) {
                            return (
                              <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                                <span className="detailLabel font14 fontSemiBold grayText textUppercase">Templates:</span>
                                <span className="detailValue font14 grayText appendLeft6">No templates assigned</span>
                              </div>
                            )
                          }
                          const firstTemplate = product.templates[0]
                          const templateId = typeof firstTemplate === "object" ? (firstTemplate.templateId || firstTemplate._id) : firstTemplate
                          const templateImage = typeof firstTemplate === "object" ? (firstTemplate.previewImage || firstTemplate.image) : null
                          const templateImageUrl = templateImage 
                            ? (templateImage.startsWith("http") ? templateImage : `${templateImage.startsWith("/") ? templateImage : "/" + templateImage}`)
                            : null
                          return (
                            <>
                              <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                                <span className="detailLabel font14 fontSemiBold grayText textUppercase">Template ID:</span>
                                <span className="detailValue font14 blackText appendLeft6">{templateId || "—"}</span>
                              </div>
                              {templateImageUrl && (
                                <div className="brandDetail paddingTop8 paddingBottom8">
                                  <span className="detailLabel font14 fontSemiBold grayText textUppercase appendBottom8" style={{ display: 'block', marginBottom: '8px' }}>Template Image:</span>
                                  <div style={{ width: '100px', height: '100px', borderRadius: '4px', overflow: 'hidden', cursor: 'pointer', border: '1px solid #e5e7eb' }}>
                                    <img
                                      src={templateImageUrl}
                                      alt="Template"
                                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                      onClick={() => openMediaPopup(templateImageUrl, false)}
                                    />
                                  </div>
                                </div>
                              )}
                            </>
                          )
                        })()}
                        {(product.productType === "customized" ||
                          product.displayMode === "customized" ||
                          product.type === "customized") && (
                          <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                            <span className="detailLabel font14 fontSemiBold grayText textUppercase">
                              Plain Product Price:
                            </span>
                            <span className="detailValue font14 blackText appendLeft6">
                              {product.plainProductPrice != null && product.plainProductPrice !== ""
                                ? `₹${Math.round(Number(product.plainProductPrice))}`
                                : "—"}
                            </span>
                          </div>
                        )}
                        <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                          <span className="detailLabel font14 fontSemiBold grayText textUppercase">Price:</span>
                          <span className="detailValue font14 blackText appendLeft6" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            {product.discountedPrice ? (
                              <>
                                <span style={{ textDecoration: 'line-through', color: '#6b7280' }}>₹{product.price}</span>
                                <span style={{ color: '#059669', fontWeight: '600' }}>₹{product.discountedPrice}</span>
                                {(() => {
                                  const discountPercent = product.discountPercentage || 
                                    (product.price && product.discountedPrice && product.price > product.discountedPrice
                                      ? Math.round(((product.price - product.discountedPrice) / product.price * 100))
                                      : null)
                                  return discountPercent ? (
                                    <span style={{ color: '#dc2626', fontSize: '12px' }}>({discountPercent}% off)</span>
                                  ) : null
                                })()}
                              </>
                            ) : (
                              <span>₹{product.price}</span>
                            )}
                          </span>
                        </div>
                        <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                          <span className="detailLabel font14 fontSemiBold grayText textUppercase">Stock:</span>
                          <span className="detailValue font14 blackText appendLeft6">{product.stock === -1 ? "Unlimited" : (product.stock || 0)}</span>
                        </div>
                        <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                          <span className="detailLabel font14 fontSemiBold grayText textUppercase">Category:</span>
                          <span className="detailValue font14 blackText appendLeft6">{product.category?.name || product.category || "N/A"}</span>
                        </div>
                        <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                          <span className="detailLabel font14 fontSemiBold grayText textUppercase">Variations:</span>
                          <span className={`detailValue font14 ${product.hasVariations ? 'greenText' : 'grayText'} appendLeft6`}>
                            {product.hasVariations ? 'Yes' : 'No'}
                          </span>
                        </div>
                        <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                          <span className="detailLabel font14 fontSemiBold grayText textUppercase">Status:</span>
                          <span className={`detailValue font14 ${product.deleted ? 'deleted' : (product.isActive ? 'greenText' : 'inactive')} appendLeft6`}>
                            {product.deleted ? 'Deleted' : (product.isActive ? 'Active' : 'Inactive')}
                          </span>
                        </div>
                        
                        {/* Gallery Images */}
                        {product.images && product.images.length > 0 && (
                          <div className="brandDetail paddingTop8 paddingBottom8">
                            <span className="detailLabel font14 fontSemiBold grayText textUppercase appendBottom8" style={{ display: 'block', marginBottom: '8px' }}>Gallery Images:</span>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                              {(expandedImages.gallery[product._id] ? product.images : product.images.slice(0, 6)).map((imgUrl, index) => {
                                const isVideo = typeof imgUrl === "string" && (imgUrl.includes(".mp4") || imgUrl.includes(".webm") || imgUrl.includes(".mov") || imgUrl.includes("video"))
                                const fullUrl = imgUrl.startsWith("http") ? imgUrl : `${imgUrl}`
                                
                                return (
                                  <div key={`gallery-${index}`} style={{ position: 'relative', width: '50px', height: '50px', borderRadius: '4px', overflow: 'hidden', cursor: 'pointer', border: '1px solid #e5e7eb' }}>
                                    {isVideo ? (
                                      <video
                                        src={fullUrl}
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        onClick={() => openMediaPopup(fullUrl, true)}
                                      />
                                    ) : (
                                      <img
                                        src={fullUrl}
                                        alt={`Gallery ${index + 1}`}
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        onClick={() => openMediaPopup(fullUrl, false)}
                                      />
                                    )}
                                  </div>
                                )
                              })}
                              {product.images.length > 6 && (
                                <button
                                  type="button"
                                  onClick={() => toggleGalleryExpansion(product._id)}
                                  style={{
                                    width: '50px',
                                    height: '50px',
                                    borderRadius: '4px',
                                    border: '1px solid #e5e7eb',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    backgroundColor: expandedImages.gallery[product._id] ? '#dc2626' : '#f3f4f6',
                                    color: expandedImages.gallery[product._id] ? 'white' : '#666',
                                    fontSize: '12px',
                                    cursor: 'pointer',
                                    fontWeight: '600',
                                    transition: 'all 0.2s ease'
                                  }}
                                  onMouseEnter={(e) => {
                                    if (!expandedImages.gallery[product._id]) {
                                      e.target.style.backgroundColor = '#e5e7eb'
                                    }
                                  }}
                                  onMouseLeave={(e) => {
                                    if (!expandedImages.gallery[product._id]) {
                                      e.target.style.backgroundColor = '#f3f4f6'
                                    }
                                  }}
                                  title={expandedImages.gallery[product._id] ? `Hide ${product.images.length - 6} images` : `Show ${product.images.length - 6} more images`}
                                >
                                  {expandedImages.gallery[product._id] ? `-${product.images.length - 6}` : `+${product.images.length - 6}`}
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {/* Variation Images */}
                        {product.hasVariations && (
                          <div className="brandDetail paddingTop8 paddingBottom8">
                            <span className="detailLabel font14 fontSemiBold grayText textUppercase appendBottom8" style={{ display: 'block', marginBottom: '8px' }}>Variation Images:</span>
                            <VariationImagesDisplay 
                              productId={product._id}
                              fetchVariations={fetchProductVariations}
                              openMediaPopup={openMediaPopup}
                              variationsCache={productVariationsCache}
                              expandedVariations={expandedImages.variations[product._id] || {}}
                              onToggleVariationExpansion={(variantId) => toggleVariationExpansion(product._id, variantId)}
                            />
                          </div>
                        )}
                      </>
                    )}
                    renderActions={(product) => (
                      <ActionButtons
                        onEdit={product.deleted ? undefined : () => handleEdit(product)}
                        onDelete={() => handleDelete(product._id)}
                        onRevert={product.deleted ? () => handleRevert(product._id) : undefined}
                        loading={loading}
                        size="normal"
                        editText="✏️ Edit"
                        deleteText={product.deleted ? "🗑️ Final Del" : "🗑️ Delete"}
                        revertText="🔄 Revert Back"
                        editTitle="Edit Product"
                        deleteTitle={product.deleted ? "Final Del" : "Mark product as deleted"}
                        revertTitle="Restore this product back to active"
                        editDisabled={product.deleted}
                      />
                    )}
                    className="brandCard"
                  />
                ))}
                {hasMoreCards && (
                  <div className="loadMoreContainer textCenter paddingAll20">
                    <button
                      type="button"
                      onClick={handleLoadMoreCards}
                      className="btnPrimary"
                      disabled={loading}
                    >
                      {loading ? (
                        <span className="loadingSpinner">⏳</span>
                      ) : (
                        <span>Load More</span>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* List View */}
            {viewMode === 'list' && (
              <div className="brandsListTable">
                <div className="tableContainer">
                  <table className="brandsTable">
                    <thead>
                      <tr>
                        <th className="tableHeader">Image</th>
                        <th className="tableHeader">Product ID</th>
                        <th className="tableHeader">SKU</th>
                        <th className="tableHeader">Name</th>
                        <th className="tableHeader">Type</th>
                        <th className="tableHeader">Price</th>
                        <th className="tableHeader">Stock</th>
                        <th className="tableHeader">Category</th>
                        <th className="tableHeader">Variations</th>
                        <th className="tableHeader">Status</th>
                        <th className="tableHeader">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentProducts.map((product) => (
                        <tr key={product._id} className="tableRow">
                          <td className="tableCell width5">
                            <div className="tableLogo">
                              {product.mainImage ? (
                                <img
                                  src={product.mainImage.startsWith("http") ? product.mainImage : `${product.mainImage}`}
                                  alt={product.name}
                                  className="tableLogoImage"
                                  style={{ cursor: 'pointer' }}
                                  onClick={() => {
                                    const mainImageUrl = product.mainImage.startsWith("http") ? product.mainImage : `${product.mainImage}`
                                    openMediaPopup(mainImageUrl, isVideoUrl(mainImageUrl))
                                  }}
                                />
                              ) : (
                                <div className="tableLogoPlaceholder" style={{ backgroundColor: generateEntityColor(product._id, product.name) }}>
                                  {product.name.charAt(0).toUpperCase()}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="tableCell width10 font14 blackText">{product.productId || product._id}</td>
                          <td className="tableCell width10 font14 blackText">{product.sku || "—"}</td>
                          <td className="tableCell width15 font14 blackText">{product.name}</td>
                          <td className="tableCell width10 font14 blackText">
                            <span className={`statusText ${(product.productType === "customized" || product.displayMode === "customized" || product.type === "customized") ? 'active' : 'inactive'}`}>
                              {(product.productType === "customized" || product.displayMode === "customized" || product.type === "customized") ? "Customized" : "Standard"}
                            </span>
                          </td>
                          <td className="tableCell width10 font14 blackText">
                            {product.discountedPrice ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                <span style={{ textDecoration: 'line-through', color: '#6b7280' }}>₹{product.price}</span>
                                <span style={{ color: '#059669', fontWeight: '600' }}>₹{product.discountedPrice}</span>
                                {(() => {
                                  const discountPercent = product.discountPercentage || 
                                    (product.price && product.discountedPrice && product.price > product.discountedPrice
                                      ? Math.round(((product.price - product.discountedPrice) / product.price * 100))
                                      : null)
                                  return discountPercent ? (
                                    <span style={{ color: '#dc2626', fontSize: '12px' }}>({discountPercent}% off)</span>
                                  ) : null
                                })()}
                              </div>
                            ) : (
                              <span>₹{product.price}</span>
                            )}
                          </td>
                          <td className="tableCell width10 font14 blackText">{product.stock === -1 ? "Unlimited" : (product.stock || 0)}</td>
                          <td className="tableCell width15 font14 blackText">{product.category?.name || product.category || "N/A"}</td>
                          <td className="tableCell width10 font14 blackText">
                            <span className={`statusText ${product.hasVariations ? 'active' : 'inactive'}`}>
                              {product.hasVariations ? 'Yes' : 'No'}
                            </span>
                          </td>
                          <td className="tableCell width5 font14 blackText">
                            <span className={`statusText ${product.deleted ? 'deleted' : (product.isActive ? 'active' : 'inactive')}`}>
                              {product.deleted ? 'Deleted' : (product.isActive ? 'Active' : 'Inactive')}
                            </span>
                          </td>
                          <td className="tableCell width5">
                            <div className="tableActions makeFlex gap8">
                                <ActionButtons
                                  onEdit={product.deleted ? undefined : () => handleEdit(product)}
                                  onDelete={() => handleDelete(product._id)}
                                  onRevert={product.deleted ? () => handleRevert(product._id) : undefined}
                                  loading={loading}
                                  size="small"
                                  editText="✏️"
                                  deleteText={product.deleted ? "🗑️ Final Del" : "🗑️ Delete"}
                                  revertText="🔄 Revert Back"
                                  editTitle="Edit Product"
                                  deleteTitle={product.deleted ? "Final Del" : "Mark product as deleted"}
                                  revertTitle="Restore this product back to active"
                                  editDisabled={product.deleted}
                                />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {totalPages > 1 && (
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={handlePageChange}
                    disabled={loading}
                    showGoToPage={true}
                  />
                )}
              </div>
            )}
          </>
        )}
      </div>

      <DeleteConfirmationPopup
        isVisible={deletePopup.isVisible}
        message={deletePopup.message}
        onConfirm={deletePopup.action === "delete" ? handleDeleteConfirm : handleRevertConfirm}
        onCancel={deletePopup.action === "delete" ? handleDeleteCancel : handleRevertCancel}
        confirmText={deletePopup.action === "delete" ? (deletePopup.isPermanentDelete ? "Final Del" : "Delete") : "Restore"}
        cancelText="Cancel"
        loading={loading}
      />

      {/* Media Popup for Card View */}
      {mediaPopup.isOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.9)",
            zIndex: 10000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer"
          }}
          onClick={closeMediaPopup}
        >
          <div
            style={{
              position: "relative",
              maxWidth: "90%",
              maxHeight: "90%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {mediaPopup.isVideo ? (
              <video
                src={mediaPopup.mediaUrl}
                controls
                autoPlay
                style={{
                  maxWidth: "90vw",
                  maxHeight: "90vh",
                  objectFit: "contain"
                }}
                onError={(e) => {
                  e.target.style.display = 'none'
                }}
              />
            ) : (
              <img
                src={mediaPopup.mediaUrl}
                alt="Preview"
                style={{
                  maxWidth: "90vw",
                  maxHeight: "90vh",
                  objectFit: "contain"
                }}
                onError={(e) => {
                  e.target.style.display = 'none'
                }}
              />
            )}
            <button
              type="button"
              onClick={closeMediaPopup}
              style={{
                position: "absolute",
                top: "20px",
                right: "20px",
                backgroundColor: "rgba(255, 255, 255, 0.9)",
                color: "#333",
                border: "none",
                borderRadius: "50%",
                width: "40px",
                height: "40px",
                cursor: "pointer",
                fontSize: "24px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 8px rgba(0,0,0,0.3)",
                transition: "all 0.2s ease"
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = "white"
                e.target.style.transform = "scale(1.1)"
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = "rgba(255, 255, 255, 0.9)"
                e.target.style.transform = "scale(1)"
              }}
              title="Close"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
