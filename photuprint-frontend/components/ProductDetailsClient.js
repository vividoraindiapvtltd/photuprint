"use client"

import { useEffect, useState, useRef, useCallback, useMemo } from "react"
import { createPortal } from "react-dom"
import dynamic from "next/dynamic"
import Link from "next/link"
import Image from "next/image"
import DOMPurify from "isomorphic-dompurify"
import { getImageSrc } from "../src/utils/imageUrl"
import PrintSideSelector from "../src/components/product/PrintSideSelector"

function sanitizeHtml(html) {
  if (!html || typeof html !== "string") return ""
  const purifier = DOMPurify?.default ?? DOMPurify
  const sanitize = purifier?.sanitize ?? (typeof purifier === "function" ? purifier : null)
  if (typeof sanitize === "function") return sanitize.call(purifier, html)
  return html.replace(/<[^>]+>/g, " ")
}

/** Brand may be a string id, populated { name }, or similar — align with ProductPdpBelowFold */
function productBrandDisplayName(product) {
  const b = product?.brand
  if (b == null || b === "") return ""
  if (typeof b === "string") return b.trim()
  if (typeof b === "object") return String(b.name || b.title || "").trim()
  return String(b)
}

function formatInr(n) {
  const x = Number(n)
  if (!Number.isFinite(x)) return "—"
  return x.toLocaleString("en-IN", { maximumFractionDigits: 0 })
}
const ColorSelector = dynamic(() => import("../src/components/product/ColorSelector"), { ssr: false })
const SizeSelector = dynamic(() => import("../src/components/product/SizeSelector"), { ssr: false })
const SelectMultipleSizesModal = dynamic(() => import("../src/components/product/SelectMultipleSizesModal"), {
  ssr: false,
})
const SizeGuideModal = dynamic(() => import("../src/components/product/SizeGuideModal"), { ssr: false })
const MaterialSelector = dynamic(() => import("../src/components/product/MaterialSelector"), { ssr: false })
const ProductImageCarousel = dynamic(() => import("../src/components/product/ProductImageCarousel"), { ssr: false })
import NavigationBar from "./NavigationBar"
import Footer from "./Footer"
import { useAuth } from "../src/context/AuthContext"
import { useCart } from "../src/context/CartContext"
import { useFlyToCart } from "../src/hooks/useFlyToCart"
import { useMediaQuery } from "../src/hooks/useMediaQuery"
import api from "../src/utils/api"
import { addGuestRecentlyViewed } from "../src/utils/guestRecentlyViewed"
import { getProductSlug, slugify } from "../src/utils/slugify"
import {
  getVolumeAdjustedUnitPrice,
  getEffectiveBaseUnitPrice,
  getQuantityTierExtraPercent,
} from "../src/utils/quantityTierPricing"
import { resolveProductOfferPricing } from "../src/utils/productOfferPricing"
import { fetchPincodeDetails } from "../src/utils/pincode"
import {
  buildColorOptionsFromProduct,
  buildPrintSideOptionsFromProduct,
  getDefaultPrintSideId,
  getNonDeselectableFrontPrintSideId,
  pickDefaultColorOption,
  isDefaultColorSelection,
  isFirstRealVariantSelectedWithSyntheticDefaultSwatch,
  productVariationsDefineSize,
  buildUniqueSizeOptionsFromVariations,
  buildMaterialOptionsFromProduct,
  buildVariationSizeStockByIndex,
  findVariantOptionByAttributes,
  getSizeIdFromVariantAttributes,
  getMaterialIdFromVariantAttributes,
  getColorIdFromVariantAttributes,
  buildProductPdpGalleryImages,
  buildVariationPdpGalleryImages,
  buildDisplayColorOptionsWithDefaultSwatch,
  resolveCartVariantForPdp,
} from "../src/utils/productVariationOptions"
import { getSizeDisplayLabel } from "../src/utils/sizeDisplayLabel"
import { PDP_PAGE_CONTAINER_CLASS, PDP_PAGE_INNER_WIDTH_CLASS } from "../src/constants/pdpLayout"
import {
  APPAREL_STANDARD_SIZE_LABELS,
  apparelLadderStockBySlots,
  mapSizesToApparelLadder,
  productShouldShowApparelSizeLadder,
} from "../src/utils/apparelSizeLadder"
const ProductPdpBelowFold = dynamic(() => import("../src/components/product/ProductPdpBelowFold"), { ssr: false })
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
  const [selected, setSelected] = useState(() => {
    const raw = buildColorOptionsFromProduct(initialProduct)
    const display = buildDisplayColorOptionsWithDefaultSwatch(initialProduct)
    const opts = display.length ? display : raw
    return pickDefaultColorOption(initialProduct, opts)
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
  const plainModalOpenDelayRef = useRef(null)
  const runFlyToCart = useFlyToCart()
  const [quantity, setQuantity] = useState(1)
  const [selectedSizeId, setSelectedSizeId] = useState(null)
  const [multiSizeModalOpen, setMultiSizeModalOpen] = useState(false)
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false)
  const [plainWithoutCustomModalOpen, setPlainWithoutCustomModalOpen] = useState(false)
  const [plainWithoutCustomCheckbox, setPlainWithoutCustomCheckbox] = useState(false)
  /** After confirming the plain modal: PDP + tier table use plain MRP until cleared or product changes. */
  const [plainPricingActive, setPlainPricingActive] = useState(false)
  /** Draft quantities for "Select multiple sizes" — drives tier total + blue chip borders. */
  const [multiSizeDraftQty, setMultiSizeDraftQty] = useState(() => ({}))
  const [selectedMaterialId, setSelectedMaterialId] = useState(null)
  const [selectedPrintSideIds, setSelectedPrintSideIds] = useState([])
  const [deliveryPincode, setDeliveryPincode] = useState("")
  const [deliveryChecking, setDeliveryChecking] = useState(false)
  const [deliveryResult, setDeliveryResult] = useState(null)
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
  const isMdUp = useMediaQuery("(min-width: 768px)")
  const [enquirySheetDragY, setEnquirySheetDragY] = useState(0)
  const enquirySheetDragYRef = useRef(0)
  const enquiryTouchStartY = useRef(null)
  const buyButtonsRef = useRef(null)
  const [showStickyBar, setShowStickyBar] = useState(false)

  useEffect(() => {
    if (isMdUp) { setShowStickyBar(false); return }
    const el = buyButtonsRef.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => setShowStickyBar(!entry.isIntersecting),
      { threshold: 0 }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [isMdUp])

  const closeEnquiry = useCallback(() => {
    setEnquiryOpen(false)
    setEnquirySheetDragY(0)
    enquirySheetDragYRef.current = 0
    enquiryTouchStartY.current = null
    setEnquirySuccess(false)
    setEnquiryError("")
  }, [])

  const onEnquirySheetTouchStart = useCallback((e) => {
    enquiryTouchStartY.current = e.touches[0].clientY
  }, [])
  const onEnquirySheetTouchMove = useCallback((e) => {
    if (enquiryTouchStartY.current == null) return
    const dy = e.touches[0].clientY - enquiryTouchStartY.current
    if (dy > 0) {
      enquirySheetDragYRef.current = dy
      setEnquirySheetDragY(dy)
    }
  }, [])
  const onEnquirySheetTouchEnd = useCallback(() => {
    if (enquirySheetDragYRef.current > 100) closeEnquiry()
    else {
      setEnquirySheetDragY(0)
      enquirySheetDragYRef.current = 0
    }
    enquiryTouchStartY.current = null
  }, [closeEnquiry])

  useEffect(() => {
    if (isMdUp) {
      setEnquirySheetDragY(0)
      enquirySheetDragYRef.current = 0
    }
  }, [isMdUp])

  useEffect(() => {
    if (!enquiryOpen) return
    const onKey = (e) => {
      if (e.key === "Escape") closeEnquiry()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [enquiryOpen, closeEnquiry])

  useEffect(() => {
    if (!enquiryOpen || isMdUp) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [enquiryOpen, isMdUp])

  /** API must receive a string ObjectId — never pass a populated category object. */
  const categoryId = useMemo(() => {
    const p = product
    if (!p) return null
    if (p.category && typeof p.category === "object" && p.category._id != null) {
      return String(p.category._id)
    }
    if (p.categoryId && typeof p.categoryId === "object" && p.categoryId._id != null) {
      return String(p.categoryId._id)
    }
    if (typeof p.categoryId === "string" && p.categoryId.trim()) {
      return p.categoryId.trim()
    }
    return null
  }, [product])
  const displayMode = product?.displayMode || "both"
  /** Right-column layout: size → material → colour (matches reference customized PDP). */
  const customizedPdpLayout =
    displayMode === "customized" || (displayMode === "both" && viewMode === "customized")
  const productId = product?._id || product?.id
  const productSlug = product ? getProductSlug(product) : ""

  const sizeOptions = useMemo(() => {
    const raw = product?.sizes
    if (!Array.isArray(raw)) return []
    return raw
      .map((s) => {
        if (!s || typeof s !== "object") return null
        const id = s._id ?? s.id
        if (id == null) return null
        return {
          _id: String(id),
          id: String(id),
          name: getSizeDisplayLabel(s),
          initial: s.initial,
        }
      })
      .filter(Boolean)
  }, [product?.sizes])

  const sizeStockByIndex = useMemo(() => {
    const count = sizeOptions.length
    if (count === 0) return []
    const stock = product?.stock
    if (stock === -1 || stock == null) return sizeOptions.map(() => ({ available: true, left: null }))
    const n = Number(stock)
    if (!Number.isFinite(n) || n <= 0) return sizeOptions.map(() => ({ available: false, left: 0 }))
    const base = Math.floor(n / count)
    const rem = n % count
    return sizeOptions.map((_, i) => {
      const left = base + (i < rem ? 1 : 0)
      return { available: left > 0, left }
    })
  }, [sizeOptions, product?.stock])

  const variationColorOptions = useMemo(() => buildColorOptionsFromProduct(product), [product])
  /** Colour row: main image swatch (default colour) + other variation thumbnails. */
  const colorOptions = useMemo(() => buildDisplayColorOptionsWithDefaultSwatch(product), [product])

  useEffect(() => {
    if (!colorOptions.length) {
      setSelected(null)
      return
    }
    setSelected((prev) => {
      if (prev && colorOptions.some((o) => String(o._id) === String(prev._id))) {
        return colorOptions.find((o) => String(o._id) === String(prev._id)) || prev
      }
      return pickDefaultColorOption(product, colorOptions)
    })
  }, [product?._id, product?.defaultVariant, colorOptions])

  const variationDefinesSize = useMemo(() => productVariationsDefineSize(product), [product])

  const variationSizeOptions = useMemo(() => buildUniqueSizeOptionsFromVariations(product), [product])
  const materialOptions = useMemo(() => buildMaterialOptionsFromProduct(product), [product])

  const apparelSizeUi = useMemo(() => {
    if (variationDefinesSize) return null
    if (!productShouldShowApparelSizeLadder(product, sizeOptions)) return null
    const { byKey, unmapped } = mapSizesToApparelLadder(sizeOptions)
    const ladder = APPAREL_STANDARD_SIZE_LABELS.map((label) => {
      const hit = byKey.get(label)
      if (hit) return { ...hit, name: label }
      return { _id: null, name: label, initial: label }
    })
    const options = [...ladder, ...unmapped]
    const ladderFlags = APPAREL_STANDARD_SIZE_LABELS.map((label) => !!byKey.get(label))
    const extraFlags = unmapped.map(() => true)
    const stock = apparelLadderStockBySlots([...ladderFlags, ...extraFlags], product?.stock)
    return { options, stock }
  }, [product, variationDefinesSize, sizeOptions, product?.stock])

  /** Customized apparel: full XXS–7XL ladder; sizes not in catalog show disabled. */
  const customizationApparelLadderUi = useMemo(() => {
    if (!variationDefinesSize || !customizedPdpLayout || variationSizeOptions.length === 0) return null
    if (!productShouldShowApparelSizeLadder(product, variationSizeOptions)) return null
    const { byKey, unmapped } = mapSizesToApparelLadder(variationSizeOptions)
    const ladder = APPAREL_STANDARD_SIZE_LABELS.map((label) => {
      const hit = byKey.get(label)
      if (hit) return { ...hit, name: label }
      return { _id: null, name: label, initial: label }
    })
    const options = [...ladder, ...unmapped]
    const perVariationStock = buildVariationSizeStockByIndex(product, variationSizeOptions)
    const stockById = new Map(
      variationSizeOptions.map((opt, i) => [String(opt._id), perVariationStock[i]]),
    )
    const stock = options.map((opt) => {
      if (opt._id == null || opt._id === "") return { available: false, left: null }
      return stockById.get(String(opt._id)) ?? { available: false, left: 0 }
    })
    return { options, stock }
  }, [variationDefinesSize, customizedPdpLayout, variationSizeOptions, product])

  const sizeOptionsForUi = useMemo(() => {
    if (variationDefinesSize) {
      if (customizationApparelLadderUi) return customizationApparelLadderUi.options
      if (customizedPdpLayout && variationSizeOptions.length > 0) return variationSizeOptions
      return []
    }
    if (apparelSizeUi) return apparelSizeUi.options
    return sizeOptions
  }, [variationDefinesSize, customizedPdpLayout, variationSizeOptions, customizationApparelLadderUi, apparelSizeUi, sizeOptions])

  /** Rows for size guide modal — merge catalog size docs by id for chest / lengths. */
  const sizeGuideRows = useMemo(() => {
    const catalog = Array.isArray(product?.sizes) ? product.sizes : []
    const byId = new Map(catalog.map((s) => [String(s._id || s.id), s]))
    return sizeOptionsForUi
      .map((opt) => {
        const id = opt._id ?? opt.id
        if (id == null || id === "") return null
        const full = byId.get(String(id)) || opt
        return {
          sizeLabel: getSizeDisplayLabel(opt),
          chestIn: full.chestInch ?? null,
          chestCm: full.chestCm ?? null,
          frontIn: full.frontLengthInch ?? null,
          frontCm: full.frontLengthCm ?? null,
          sleeveIn: full.sleeveLengthInch ?? null,
          sleeveCm: full.sleeveLengthCm ?? null,
        }
      })
      .filter(Boolean)
  }, [product?.sizes, product?._id, sizeOptionsForUi])

  /** Catalog sizes (non-variation) vs variation-derived sizes — used only for apparel eligibility. */
  const sizesForApparelEligibility = useMemo(() => {
    if (variationDefinesSize) return variationSizeOptions
    return sizeOptions
  }, [variationDefinesSize, variationSizeOptions, sizeOptions])

  /** Use productShouldShowApparelSizeLadder (keywords OR ladder-shaped sizes), not only productUsesApparelSizeLadder — fixes clothing PDPs whose category/name text does not match the keyword regex. */
  const showSizeSelector = useMemo(
    () => productShouldShowApparelSizeLadder(product, sizesForApparelEligibility) && sizeOptionsForUi.length > 0,
    [product, sizesForApparelEligibility, sizeOptionsForUi.length, sizeOptionsForUi],
  )

  const pricingPayload = useMemo(() => {
    const tiers = product?.quantityDiscountTiers
    if (selected?.isVariation && (selected.price != null || selected.discountedPrice != null)) {
      const o = resolveProductOfferPricing({
        price: selected.price ?? product?.price,
        discountedPrice: selected.discountedPrice ?? null,
        discountPercentage: selected.discountPercentage ?? product?.discountPercentage,
      })
      return {
        price: o.mrp,
        discountedPrice: o.hasOffer ? o.sale : null,
        quantityDiscountTiers: tiers,
      }
    }
    const o = resolveProductOfferPricing({
      price: product?.price,
      discountedPrice: product?.discountedPrice,
      discountPercentage: product?.discountPercentage,
    })
    return {
      price: o.mrp,
      discountedPrice: o.hasOffer ? o.sale : null,
      quantityDiscountTiers: tiers,
    }
  }, [
    product?.price,
    product?.discountedPrice,
    product?.discountPercentage,
    product?.quantityDiscountTiers,
    selected,
  ])

  const plainProductDisplayPrice = useMemo(() => {
    const raw = product?.plainProductPrice
    if (raw == null || raw === "") return null
    const n = Number(raw)
    return Number.isFinite(n) && n > 0 ? n : null
  }, [product?.plainProductPrice])

  const effectivePricingPayload = useMemo(() => {
    if (!plainPricingActive) return pricingPayload
    const plain =
      plainProductDisplayPrice != null && Number(plainProductDisplayPrice) > 0
        ? Number(plainProductDisplayPrice)
        : getEffectiveBaseUnitPrice(pricingPayload)
    return {
      price: plain,
      discountedPrice: null,
      quantityDiscountTiers: product?.quantityDiscountTiers || null,
    }
  }, [plainPricingActive, pricingPayload, plainProductDisplayPrice, product?.quantityDiscountTiers])

  const baseUnit = useMemo(() => getEffectiveBaseUnitPrice(effectivePricingPayload), [effectivePricingPayload])

  const printSideOptions = useMemo(
    () => buildPrintSideOptionsFromProduct(product),
    [product?._id, product?.printSidePricing],
  )

  const lockedPrintSideId = useMemo(
    () => getNonDeselectableFrontPrintSideId(printSideOptions),
    [printSideOptions],
  )

  useEffect(() => {
    if (printSideOptions.length === 0) {
      setSelectedPrintSideIds([])
      return
    }
    setSelectedPrintSideIds((prev) => {
      const valid = prev.filter((id) => printSideOptions.some((o) => String(o._id) === String(id)))
      if (valid.length) {
        if (lockedPrintSideId && !valid.some((id) => String(id) === String(lockedPrintSideId))) {
          return [...valid, lockedPrintSideId]
        }
        return valid
      }
      const def = getDefaultPrintSideId(printSideOptions)
      return def ? [def] : []
    })
  }, [product?._id, printSideOptions, lockedPrintSideId])

  const togglePrintSide = useCallback(
    (id) => {
      const sid = String(id)
      setSelectedPrintSideIds((prev) => {
        const set = new Set(prev.map(String))
        if (set.has(sid)) {
          if (lockedPrintSideId && sid === String(lockedPrintSideId)) {
            return prev
          }
          set.delete(sid)
        } else {
          set.add(sid)
        }
        return [...set]
      })
    },
    [lockedPrintSideId],
  )

  const printSideAddon = useMemo(() => {
    if (!selectedPrintSideIds.length) return 0
    const selected = new Set(selectedPrintSideIds.map(String))
    return printSideOptions.reduce((sum, o) => {
      if (!selected.has(String(o._id))) return sum
      return sum + (Number.isFinite(o.addonPrice) ? o.addonPrice : 0)
    }, 0)
  }, [printSideOptions, selectedPrintSideIds])

  /** Plain SKU has no print-side add-ons in the price breakdown. */
  const printSideAddonForPricing = plainPricingActive ? 0 : printSideAddon

  const selectedPrintSides = useMemo(() => {
    if (!selectedPrintSideIds.length) return []
    const selected = new Set(selectedPrintSideIds.map(String))
    return printSideOptions.filter((o) => selected.has(String(o._id)))
  }, [printSideOptions, selectedPrintSideIds])

  const multiSizeTotalUnits = useMemo(() => {
    if (!multiSizeDraftQty || typeof multiSizeDraftQty !== "object") return 0
    return Object.values(multiSizeDraftQty).reduce((s, n) => s + Math.max(0, Number(n) || 0), 0)
  }, [multiSizeDraftQty])

  /** Volume tier band uses total units from multi-size draft when set, else main quantity stepper. */
  const effectiveTierQty = multiSizeTotalUnits > 0 ? multiSizeTotalUnits : quantity

  const volumeUnitForQty = useMemo(
    () => getVolumeAdjustedUnitPrice(effectivePricingPayload, effectiveTierQty),
    [effectivePricingPayload, effectiveTierQty],
  )
  const unitForQty = volumeUnitForQty + printSideAddonForPricing

  const tierQtySamples = useMemo(() => [1, 6, 11, 21], [])
  const tierBandLabels = useMemo(() => ["1-5", "6-10", "11-20", "21+"], [])
  /** Extra bulk % from product quantityDiscountTiers for each band (same rules as checkout). */
  const tierColumnExtraPercents = useMemo(
    () => tierQtySamples.map((q) => getQuantityTierExtraPercent(effectivePricingPayload, q)),
    [effectivePricingPayload, tierQtySamples],
  )
  const tierColumnUnitPrices = useMemo(
    () => tierQtySamples.map((q) => getVolumeAdjustedUnitPrice(effectivePricingPayload, q)),
    [effectivePricingPayload, tierQtySamples],
  )
  const activeTierColumnIndex = useMemo(() => {
    const q = effectiveTierQty
    if (q >= 21) return 3
    if (q >= 11) return 2
    if (q >= 6) return 1
    return 0
  }, [effectiveTierQty])

  const sizeStockForUi = useMemo(() => {
    if (variationDefinesSize) {
      if (customizationApparelLadderUi) return customizationApparelLadderUi.stock
      if (customizedPdpLayout && variationSizeOptions.length > 0) {
        return buildVariationSizeStockByIndex(product, variationSizeOptions)
      }
      return []
    }
    if (apparelSizeUi) return apparelSizeUi.stock
    if (sizeOptions.length === 0) return []
    return sizeStockByIndex
  }, [
    variationDefinesSize,
    customizedPdpLayout,
    variationSizeOptions,
    customizationApparelLadderUi,
    product,
    apparelSizeUi,
    sizeOptions.length,
    sizeStockByIndex,
  ])

  /** Sync size/material from selected variant when user picks a colour (customized + variations). */
  useEffect(() => {
    if (!customizedPdpLayout || !selected?.isVariation || !selected.attributes) return
    const mid = getMaterialIdFromVariantAttributes(selected.attributes)
    if (mid) setSelectedMaterialId(mid)
    if (!showSizeSelector) return
    const sid = getSizeIdFromVariantAttributes(selected.attributes)
    if (sid) setSelectedSizeId(sid)
  }, [customizedPdpLayout, product, selected?._id, selected?.attributes, showSizeSelector])

  /** Resolve variant when size or material changes (keep current colour). */
  useEffect(() => {
    if (!customizedPdpLayout || !variationDefinesSize || !product?.variations?.length) return
    if (!selected?.isVariation || !selected.attributes) return
    const colorId = getColorIdFromVariantAttributes(selected.attributes)
    if (!colorId) return
    if (showSizeSelector && !selectedSizeId) return
    const next = findVariantOptionByAttributes(product, {
      sizeId: showSizeSelector ? selectedSizeId : null,
      materialId: selectedMaterialId,
      colorId,
    })
    if (!next) return

    if (selected.isProductDefaultSwatch) {
      const first = variationColorOptions[0]
      const firstColorId = first ? getColorIdFromVariantAttributes(first.attributes) : null
      if (
        firstColorId != null &&
        colorId === firstColorId &&
        String(next._id) !== String(selected.linkedVariantId)
      ) {
        setSelected((prev) => {
          if (!prev?.isProductDefaultSwatch) return prev
          return {
            ...prev,
            attributes: next.attributes,
            linkedVariantId: next._id,
            price: next.price,
            discountedPrice: next.discountedPrice,
            stock: next.stock,
            isOutOfStock: next.isOutOfStock,
          }
        })
      }
      return
    }

    if (String(next._id) !== String(selected._id)) {
      setSelected(next)
    }
  }, [
    selectedSizeId,
    selectedMaterialId,
    customizedPdpLayout,
    variationDefinesSize,
    product?._id,
    selected,
    variationColorOptions,
    showSizeSelector,
  ])

  useEffect(() => {
    if (!showSizeSelector) {
      setSelectedSizeId(null)
      return
    }
    const firstAvail = sizeOptionsForUi.find(
      (s, i) => sizeStockForUi[i]?.available && s._id != null && String(s._id).trim() !== "",
    )
    setSelectedSizeId((prev) => {
      if (prev) {
        const i = sizeOptionsForUi.findIndex((s) => String(s._id) === String(prev))
        if (i >= 0 && sizeStockForUi[i]?.available !== false) return prev
      }
      return firstAvail?._id ?? null
    })
  }, [product?._id, showSizeSelector, sizeOptionsForUi, sizeStockForUi])

  const selectedSize = useMemo(() => {
    if (!showSizeSelector || !selectedSizeId || !sizeOptionsForUi.length) return null
    return sizeOptionsForUi.find((s) => String(s._id) === String(selectedSizeId)) || null
  }, [showSizeSelector, selectedSizeId, sizeOptionsForUi])

  const selectedMaterialRow = useMemo(() => {
    if (!selectedMaterialId || !materialOptions.length) return null
    return materialOptions.find((m) => String(m._id) === String(selectedMaterialId)) || null
  }, [selectedMaterialId, materialOptions])

  const cartVariant = useMemo(() => resolveCartVariantForPdp(selected), [selected])

  const getPricingPayloadForSizeRow = useCallback(
    (sizeRow) => {
      const tiers = product?.quantityDiscountTiers
      let variantOpt = selected
      if (variationDefinesSize && product?.variations?.length && sizeRow?._id != null && String(sizeRow._id).trim() !== "") {
        let colorId = selected?.attributes ? getColorIdFromVariantAttributes(selected.attributes) : null
        if (!colorId && variationColorOptions.length) {
          const first = variationColorOptions[0]
          if (first?.attributes) colorId = getColorIdFromVariantAttributes(first.attributes)
        }
        const found = colorId
          ? findVariantOptionByAttributes(product, {
              sizeId: sizeRow._id,
              materialId: selectedMaterialId || null,
              colorId,
            })
          : null
        if (found) variantOpt = found
      }
      if (variantOpt?.isVariation && (variantOpt.price != null || variantOpt.discountedPrice != null)) {
        const o = resolveProductOfferPricing({
          price: variantOpt.price ?? product?.price,
          discountedPrice: variantOpt.discountedPrice ?? null,
          discountPercentage: variantOpt.discountPercentage ?? product?.discountPercentage,
        })
        return {
          price: o.mrp,
          discountedPrice: o.hasOffer ? o.sale : null,
          quantityDiscountTiers: tiers,
        }
      }
      const o = resolveProductOfferPricing({
        price: product?.price,
        discountedPrice: product?.discountedPrice,
        discountPercentage: product?.discountPercentage,
      })
      return {
        price: o.mrp,
        discountedPrice: o.hasOffer ? o.sale : null,
        quantityDiscountTiers: tiers,
      }
    },
    [
      product,
      selected,
      variationDefinesSize,
      selectedMaterialId,
      variationColorOptions,
    ],
  )

  const lineTotal = useMemo(() => {
    if (multiSizeTotalUnits <= 0) return unitForQty * quantity
    const tierQty = multiSizeTotalUnits
    let sum = 0
    for (const [sizeIdStr, raw] of Object.entries(multiSizeDraftQty)) {
      const qn = Math.max(0, Number(raw) || 0)
      if (qn <= 0) continue
      const sizeRow = sizeOptionsForUi.find((s) => String(s._id) === String(sizeIdStr))
      if (!sizeRow) continue
      const payload = plainPricingActive ? effectivePricingPayload : getPricingPayloadForSizeRow(sizeRow)
      const vol = getVolumeAdjustedUnitPrice(payload, tierQty) + (plainPricingActive ? 0 : printSideAddon)
      sum += vol * qn
    }
    return sum
  }, [
    multiSizeTotalUnits,
    multiSizeDraftQty,
    unitForQty,
    quantity,
    sizeOptionsForUi,
    getPricingPayloadForSizeRow,
    printSideAddon,
    plainPricingActive,
    effectivePricingPayload,
  ])

  const multiSizeModalRows = useMemo(() => {
    if (!showSizeSelector) return []
    const out = []
    for (let i = 0; i < sizeOptionsForUi.length; i++) {
      const s = sizeOptionsForUi[i]
      const stock = sizeStockForUi[i]
      const id = s._id ?? s.id
      if (id == null || id === "") continue
      if (stock?.available === false) continue
      const label = `${getSizeDisplayLabel(s)}:`
      const maxQty = stock?.left == null ? null : Math.max(0, Number(stock.left))
      out.push({ id: String(id), label, maxQty })
    }
    return out
  }, [showSizeSelector, sizeOptionsForUi, sizeStockForUi])

  const multiSizeFooterNote = useMemo(() => {
    if (!multiSizeModalRows.length) return null
    const has = multiSizeModalRows.some((r) => /\b(3XL|4XL|5XL)\b/i.test(r.label))
    return has ? "3XL, 4XL, 5XL sizes need to be selected separately." : null
  }, [multiSizeModalRows])

  useEffect(() => {
    if (!multiSizeModalOpen) return
    setMultiSizeDraftQty((prev) => {
      const next = { ...prev }
      for (const r of multiSizeModalRows) {
        if (next[r.id] == null) next[r.id] = 0
      }
      return next
    })
  }, [multiSizeModalOpen, multiSizeModalRows])

  const runMultiSizeAddToCart = useCallback(
    (quantities) => {
      const image = savedDesign?.image || selected?.image || product?.mainImage || product?.images?.[0]
      const containerEl = productImageRef.current
      const mainImgEl = containerEl?.querySelector?.("[data-main-image]")
      const sourceRect = (mainImgEl || containerEl)?.getBoundingClientRect?.()
      let didFly = false
      let addedCount = 0
      for (const [sizeIdStr, rawQ] of Object.entries(quantities)) {
        const qn = Math.max(0, Number(rawQ) || 0)
        if (qn <= 0) continue
        const sizeRow = sizeOptionsForUi.find((s) => String(s._id) === String(sizeIdStr))
        if (!sizeRow) continue
        const idx = sizeOptionsForUi.findIndex((s) => String(s._id) === String(sizeIdStr))
        if (idx < 0 || sizeStockForUi[idx]?.available === false) continue

        let variantForLine = cartVariant
        if (variationDefinesSize && product?.variations?.length) {
          let colorId = selected?.attributes ? getColorIdFromVariantAttributes(selected.attributes) : null
          if (!colorId && variationColorOptions.length) {
            const first = variationColorOptions[0]
            if (first?.attributes) colorId = getColorIdFromVariantAttributes(first.attributes)
          }
          if (!colorId) continue
          const found = findVariantOptionByAttributes(product, {
            sizeId: sizeRow._id,
            materialId: selectedMaterialId || null,
            colorId,
          })
          if (!found) continue
          variantForLine = resolveCartVariantForPdp(found)
        }

        if (!didFly && image && sourceRect) {
          runFlyToCart(image, sourceRect)
          didFly = true
        }

        const plainPrice = Number(effectivePricingPayload?.price)
        addToCart({
          productId,
          slug: productSlug,
          name: product?.name,
          price: plainPricingActive && Number.isFinite(plainPrice)
            ? plainPrice
            : variantForLine?.isVariation && variantForLine.price != null
              ? variantForLine.price
              : product?.price,
          discountedPrice: plainPricingActive
            ? null
            : variantForLine?.isVariation
              ? variantForLine.discountedPrice ?? null
              : product?.discountedPrice,
          quantityDiscountTiers: product?.quantityDiscountTiers || null,
          quantity: qn,
          image,
          variant: variantForLine || null,
          size: sizeRow,
          material: selectedMaterialRow,
          customDesign: plainPricingActive ? null : savedDesign || null,
          printSides:
            plainPricingActive || !(printSideOptions.length > 0 && selectedPrintSides.length > 0)
              ? []
              : selectedPrintSides.map(({ _id, name }) => ({ _id, name })),
          printSide: null,
          printSideAddon: plainPricingActive ? 0 : printSideOptions.length > 0 ? printSideAddon : 0,
          plainWithoutCustomization: plainPricingActive || undefined,
        })
        addedCount += 1
      }
      if (addedCount === 0) {
        window.alert("Could not add these sizes. Pick a colour and ensure sizes are in stock, then try again.")
        return false
      }
      /** Keep multiSizeDraftQty so totals / blue borders stay in sync on the PDP after Proceed. */
      setAddToCartSuccess(true)
      setTimeout(() => setAddToCartSuccess(false), 3000)
      return true
    },
    [
      addToCart,
      cartVariant,
      printSideAddon,
      printSideOptions.length,
      product,
      productId,
      productSlug,
      resolveCartVariantForPdp,
      runFlyToCart,
      savedDesign,
      selected,
      selectedMaterialId,
      selectedMaterialRow,
      selectedPrintSides,
      sizeOptionsForUi,
      sizeStockForUi,
      variationDefinesSize,
      variationColorOptions,
      plainPricingActive,
      effectivePricingPayload,
    ],
  )

  /** Single material option (e.g. product.material only): default selection for customized PDP. */
  useEffect(() => {
    if (!customizedPdpLayout || materialOptions.length !== 1) return
    setSelectedMaterialId((prev) => prev ?? materialOptions[0]._id)
  }, [customizedPdpLayout, materialOptions])

  /**
   * PDP gallery thumbnails + main:
   * - Legacy / no variations: full product gallery (main + all product.images).
   * - Synthetic default swatch (first thumbnail): full product gallery.
   * - Default colour (same colour as first sorted option), except when UI prepends a synthetic
   *   swatch and the user picked the real first variant (second thumbnail): that colour uses
   *   variation gallery so thumbnails match the variant.
   * - Any other colour: full gallery for that colour (all variant rows with that colour id, deduped).
   */
  const pdpGalleryImages = useMemo(() => {
    if (!product) return []
    const sel = selected
    if (!sel || !sel.isVariation) {
      return buildProductPdpGalleryImages(product)
    }
    if (sel.isProductDefaultSwatch) {
      return buildProductPdpGalleryImages(product)
    }
    if (!Array.isArray(product.variations) || product.variations.length === 0) {
      return buildProductPdpGalleryImages(product)
    }
    if (
      isFirstRealVariantSelectedWithSyntheticDefaultSwatch(
        product,
        sel,
        variationColorOptions
      )
    ) {
      return buildVariationPdpGalleryImages(product, sel)
    }
    if (isDefaultColorSelection(product, sel, variationColorOptions)) {
      return buildProductPdpGalleryImages(product)
    }
    return buildVariationPdpGalleryImages(product, sel)
  }, [product, selected, variationColorOptions])

  /** Primary image for customized left preview (variant-aware via pdpGalleryImages). */
  const customizedMainImageSrc = useMemo(() => {
    const u = pdpGalleryImages?.[0] || product?.mainImage || product?.images?.[0] || null
    return u && String(u).trim() ? String(u).trim() : null
  }, [pdpGalleryImages, product?.mainImage, product?.images])

  /** Same gallery list as normal PDP; fallback to a single main image so the thumbnail carousel still works. */
  const customizedCarouselImages = useMemo(() => {
    if (pdpGalleryImages.length > 0) return pdpGalleryImages
    if (customizedMainImageSrc) return [customizedMainImageSrc]
    return []
  }, [pdpGalleryImages, customizedMainImageSrc])

  const handleDeliveryCheck = useCallback(async () => {
    const pc = deliveryPincode.replace(/\D/g, "").slice(0, 6)
    setDeliveryPincode(pc)
    if (pc.length !== 6) {
      setDeliveryResult({ valid: false, message: "Enter a 6-digit pincode" })
      return
    }
    setDeliveryChecking(true)
    setDeliveryResult(null)
    try {
      const { city, state, valid } = await fetchPincodeDetails(pc)
      if (valid) {
        setDeliveryResult({ valid: true, city, state, pincode: pc })
      } else {
        setDeliveryResult({ valid: false, message: "We could not verify this pincode. Please check and try again." })
      }
    } finally {
      setDeliveryChecking(false)
    }
  }, [deliveryPincode])

  useEffect(() => {
    const slug = initialProduct ? getProductSlug(initialProduct) : ""
    if (!slug) return undefined
    const ac = new AbortController()
    fetch(`/api/products/slug/${encodeURIComponent(slug)}`, { cache: "no-store", signal: ac.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data || data.msg) return
        if (data._id || data.id) setProduct(data)
      })
      .catch(() => {})
    return () => ac.abort()
  }, [initialProduct?._id, initialProduct?.slug])

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
      const resolved = typeof url === "string" ? getImageSrc(url) || url : String(url)
      img.crossOrigin = "anonymous"
      img.onload = () => {
        preloadedImagesRef.current.add(url)
        resolve(true)
      }
      img.onerror = () => resolve(false)
      img.src = resolved
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

  /** Refetch templates when category id changes (avoid stale cache from wrong id). */
  useEffect(() => {
    templatesFetchedRef.current = ""
  }, [categoryId])

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

  const pdpHeroPricing = useMemo(() => {
    if (product?.price == null || product?.price === "") return null
    const basePrice = Number(effectivePricingPayload?.price)
    const discountPrice = getEffectiveBaseUnitPrice(effectivePricingPayload)
    if (!Number.isFinite(basePrice) || basePrice < 0) return null
    const addon = printSideAddonForPricing
    const showStrike = Number.isFinite(discountPrice) && discountPrice < basePrice - 0.01
    let pct = product?.discountPercentage != null ? Math.round(Number(product.discountPercentage)) : null
    if ((pct == null || pct <= 0) && showStrike && basePrice > 0) {
      pct = Math.round(((basePrice - discountPrice) / basePrice) * 100)
    }
    return {
      discountPrice: discountPrice + addon,
      basePrice: basePrice + addon,
      showStrike,
      pctOff: pct != null && pct > 0 ? pct : null,
    }
  }, [product?.price, product?.discountPercentage, effectivePricingPayload, printSideAddonForPricing])

  useEffect(() => {
    if (product) {
      const mode = product.displayMode || "both"
      if (mode === "customized") setViewMode("customized")
      else if (mode === "standard") setViewMode("standard")
    }
  }, [product])

  useEffect(() => {
    setPlainPricingActive(false)
  }, [product?._id, product?.id])

  useEffect(() => {
    return () => {
      if (plainModalOpenDelayRef.current != null) {
        clearTimeout(plainModalOpenDelayRef.current)
        plainModalOpenDelayRef.current = null
      }
    }
  }, [])

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

  const confirmPlainWithoutCustomization = useCallback(() => {
    if (!product) return
    const plain =
      plainProductDisplayPrice != null && Number(plainProductDisplayPrice) > 0
        ? Number(plainProductDisplayPrice)
        : getEffectiveBaseUnitPrice(pricingPayload)
    if (!Number.isFinite(plain) || plain <= 0) return
    setPlainPricingActive(true)
    setPlainWithoutCustomModalOpen(false)
    setPlainWithoutCustomCheckbox(true)
  }, [product, plainProductDisplayPrice, pricingPayload])

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <header className="sticky top-0 z-50 w-full">
          <NavigationBar />
        </header>
        <div className={PDP_PAGE_CONTAINER_CLASS}>
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
      <div className="min-h-screen bg-white">
        <header className="sticky top-0 z-50 w-full">
          <NavigationBar />
        </header>
        <div className={`${PDP_PAGE_CONTAINER_CLASS} pt-8`}>
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
  const productCarouselBadge = product?.fit || product?.category?.name || (product?.categoryId?.name ?? null)
  const activeTemplate = selectedTemplate || (templates.length > 0 ? templates[0] : null)
  const brandName = productBrandDisplayName(product)

  const avgRating = product?.avgRating ?? product?.averageRating
  const reviewCount = Number(product?.reviewCount) || 0
  const showRatingPill = (avgRating != null && Number(avgRating) > 0) || reviewCount > 0
  const ratingDisplay = avgRating != null && Number(avgRating) > 0 ? Number(avgRating).toFixed(1) : "—"

  const scrollToReviewsSection = useCallback(() => {
    if (typeof window === "undefined") return
    window.dispatchEvent(new CustomEvent("pdp-reviews:focus-product"))
    document.getElementById("pdp-reviews")?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [])

  const buyButtons = (
    <>
      <button
        type="button"
        onClick={() => {
          if (showSizeSelector) {
            if (!selectedSizeId) {
              window.alert("Please select an available size.")
              return
            }
            const idx = sizeOptionsForUi.findIndex((s) => String(s._id) === String(selectedSizeId))
            if (idx < 0 || !sizeStockForUi[idx]?.available) {
              window.alert("Please select an available size.")
              return
            }
          }
          const image = savedDesign?.image || selected?.image || product?.mainImage || product?.images?.[0]
          const containerEl = productImageRef.current
          const mainImgEl = containerEl?.querySelector?.("[data-main-image]")
          const sourceRect = (mainImgEl || containerEl)?.getBoundingClientRect?.()
          if (image && sourceRect) {
            runFlyToCart(image, sourceRect)
          }
          const plainMrp = Number(effectivePricingPayload?.price)
          if (plainPricingActive && Number.isFinite(plainMrp)) {
            addToCart({
              productId: productId,
              slug: productSlug,
              name: product?.name,
              price: plainMrp,
              discountedPrice: null,
              quantityDiscountTiers: product?.quantityDiscountTiers || null,
              quantity: effectiveTierQty,
              image,
              variant: cartVariant || null,
              size: selectedSize,
              material: selectedMaterialRow,
              customDesign: null,
              printSides: [],
              printSide: null,
              printSideAddon: 0,
              plainWithoutCustomization: true,
            })
          } else {
            addToCart({
              productId: productId,
              slug: productSlug,
              name: product?.name,
              price:
                selected?.isVariation && selected.price != null ? selected.price : product?.price,
              discountedPrice: selected?.isVariation
                ? selected.discountedPrice ?? null
                : product?.discountedPrice,
              quantityDiscountTiers: product?.quantityDiscountTiers || null,
              quantity,
              image,
              variant: cartVariant || null,
              size: selectedSize,
              material: selectedMaterialRow,
              customDesign: savedDesign || null,
              printSides:
                printSideOptions.length > 0 && selectedPrintSides.length > 0
                  ? selectedPrintSides.map(({ _id, name }) => ({ _id, name }))
                  : [],
              printSide: null,
              printSideAddon: printSideOptions.length > 0 ? printSideAddon : 0,
            })
          }
          setAddToCartSuccess(true)
          setTimeout(() => setAddToCartSuccess(false), 3000)
        }}
        className="inline-flex w-full min-w-0 min-h-[48px] items-center justify-center gap-2 px-4 py-3.5 rounded-lg bg-[#FFD633] hover:bg-[#f5cc2e] text-gray-900 font-bold uppercase tracking-wide text-sm shadow-sm border border-amber-300/60 transition-colors active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2 sm:w-auto sm:px-6"
      >
        <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
          />
        </svg>
        Add to bag
      </button>
      {/* "Go to bag" + Wishlist share one row on mobile, revert to inline on sm+ */}
      <div className="flex w-full gap-3 sm:w-auto sm:contents">
        <Link
          href="/cart"
          className="min-h-[48px] flex-1 inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-gray-100 px-4 text-sm font-semibold text-gray-800 transition-colors hover:bg-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 sm:h-[3.25rem] sm:w-auto sm:flex-none sm:shrink-0"
        >
          <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
            />
          </svg>
          Go to bag
        </Link>
        <button
          type="button"
          onClick={() => {
            if (!isAuthenticated) {
              window.alert("Please log in to save items to your wishlist.")
              return
            }
            toggleWishlist()
          }}
          className={`min-h-[48px] w-14 shrink-0 inline-flex items-center justify-center rounded-lg border-2 transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 ${
            isInWishlist ? "text-red-500 border-red-200 bg-red-50" : "text-gray-500 border-gray-300 bg-white"
          }`}
          title={isInWishlist ? "Remove from wishlist" : "Add to wishlist"}
          aria-label={isInWishlist ? "Remove from wishlist" : "Add to wishlist"}
        >
          <svg className="w-6 h-6" fill={isInWishlist ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
            />
          </svg>
        </button>
      </div>
    </>
  )

  return (
    <div className="min-h-screen w-full min-w-0 max-w-full bg-white">
      <header className="sticky top-0 z-50 w-full">
        <NavigationBar />
      </header>

      <div className={`${PDP_PAGE_CONTAINER_CLASS} pt-4 md:pt-6 md:pb-0 ${showStickyBar && !isMdUp ? "pb-[max(5rem,calc(4.5rem+env(safe-area-inset-bottom)))]" : "pb-[max(1rem,env(safe-area-inset-bottom))]"}`}>
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

        <div className="mb-6 grid min-w-0 w-full gap-3 md:mb-8 md:gap-5 lg:mb-10 lg:grid-cols-2 lg:gap-8">
          <div className="min-w-0 max-md:-mx-4 lg:col-span-1">
            <div className="max-md:static lg:sticky lg:top-24">
              <div
                className={
                  showCustomizedView
                    ? "bg-white max-md:rounded-none md:rounded-lg border-2 border-gray-300 shadow-lg overflow-hidden"
                    : "bg-white max-md:rounded-none md:rounded-lg overflow-hidden"
                }
              >
                {(showCustomizedView || printSideOptions.length > 0) && (
                  <div
                    className={
                      showCustomizedView
                        ? "bg-white border-b border-gray-200 px-4 py-3 flex flex-wrap items-center gap-x-3 gap-y-2"
                        : "bg-white border-b border-gray-100 px-3 py-2 flex flex-wrap items-center gap-x-3 gap-y-1"
                    }
                  >
                    {showCustomizedView ? (
                      <h3 className="text-sm font-semibold text-gray-700 shrink-0">Product Preview</h3>
                    ) : null}
                    {printSideOptions.length > 0 && (
                      <div className="flex flex-1 min-w-0 flex-wrap items-center justify-center gap-x-3 gap-y-1">
                        {printSideOptions.map((o) => {
                          const sid = String(o._id)
                          const selected = selectedPrintSideIds.some((id) => String(id) === sid)
                          const locked =
                            lockedPrintSideId && sid === String(lockedPrintSideId) && selected
                          return (
                            <label
                              key={sid}
                              className="inline-flex items-center gap-1.5 cursor-pointer select-none text-xs text-gray-700"
                            >
                              <input
                                type="checkbox"
                                className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                checked={selected}
                                disabled={locked}
                                onChange={() => togglePrintSide(o._id)}
                                aria-label={o.name}
                              />
                              <span>{o.name}</span>
                            </label>
                          )
                        })}
                      </div>
                    )}
                    {showCustomizedView && activeTemplate && (
                      <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded shrink-0 ml-auto">
                        Editing: {activeTemplate.name}
                      </span>
                    )}
                  </div>
                )}

                <div
                  ref={productImageRef}
                  className="relative w-full overflow-hidden bg-white max-md:aspect-[4/5] max-md:max-h-[min(88svh,560px)] max-md:min-h-[280px] md:aspect-[5/5] md:min-h-[500px] md:max-h-[700px]"
                >
                  {templatesLoading && showCustomizedView && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white z-20">
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
                    <div className="absolute inset-0 flex p-3 min-h-0">
                      <ProductImageCarousel
                        key={selected?._id ? String(selected._id) : "customized-template"}
                        images={customizedCarouselImages}
                        alt={product?.name ?? "Product"}
                        badgeText={productCarouselBadge}
                        className="flex-1 min-h-0 w-full"
                        mainImageOverlay={
                          <div className="flex h-full w-full items-center justify-center">
                            <div className="h-1/2 w-1/2 min-h-0 min-w-0 overflow-hidden rounded-lg border border-gray-200/90 bg-white/90 shadow-lg">
                              <div className="h-full w-full min-h-0">
                                <TemplateEditor
                                  key={activeTemplate._id || activeTemplate.id}
                                  template={activeTemplate}
                                  onSave={handleDesignSave}
                                  simplified={true}
                                  constrained={true}
                                />
                              </div>
                            </div>
                          </div>
                        }
                      />
                    </div>
                  ) : showCustomizedView ? (
                    <div className="absolute inset-0 flex p-3 min-h-0">
                      <ProductImageCarousel
                        key={selected?._id ? String(selected._id) : "customized"}
                        images={
                          customizedCarouselImages.length > 0
                            ? customizedCarouselImages
                            : backgroundImage
                              ? [backgroundImage]
                              : []
                        }
                        alt={product?.name ?? ""}
                        badgeText={productCarouselBadge}
                        className="flex-1 min-h-0 w-full"
                      />
                    </div>
                  ) : (
                    <div
                      className={`absolute inset-0 flex flex-col bg-white transition-opacity duration-300 ${
                        savedDesign && viewMode === "customized" ? "p-3" : "p-0"
                      }`}
                      style={{ opacity: 1 }}
                    >
                      {savedDesign && viewMode === "customized" ? (
                        <div className="relative w-full h-full">
                          {savedDesign.image?.startsWith("data:") || savedDesign.image?.startsWith("blob:") ? (
                            <img src={savedDesign.image} alt={`Customized ${product?.name}`} className="w-full h-full object-contain" data-main-image />
                          ) : (
                            <Image src={getImageSrc(savedDesign.image) || savedDesign.image} alt={`Customized ${product?.name}`} fill className="object-contain" sizes="(max-width: 768px) 100vw, 50vw" data-main-image />
                          )}
                          <div className="absolute top-2 left-2 bg-green-500 text-white text-xs px-2 py-1 rounded">Customized Design</div>
                        </div>
                      ) : pdpGalleryImages.length > 0 ? (
                        <ProductImageCarousel
                          key={selected?._id ? String(selected._id) : "default"}
                          images={pdpGalleryImages}
                          alt={product?.name}
                          badgeText={productCarouselBadge}
                          className="flex-1 min-h-0 h-full"
                          borderlessChrome
                        />
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
                    <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 z-10">
                      <div className="flex items-center space-x-2 overflow-x-auto pb-2">
                        {templates.map((tmpl) => {
                          const isSelected =
                            selectedTemplate?._id === tmpl._id ||
                            selectedTemplate?.id === tmpl.id ||
                            (!selectedTemplate && templates[0]?._id === tmpl._id)
                          const previewImg = tmpl.previewImage || tmpl.backgroundImages?.[0]
                          return (
                            <button
                              key={tmpl._id || tmpl.id}
                              type="button"
                              onClick={() => handleTemplateSelect(tmpl)}
                              className={`relative flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all duration-200 transform hover:scale-105 ${isSelected ? "border-blue-400 ring-2 ring-blue-300 shadow-lg scale-110" : "border-gray-200 hover:border-gray-400"}`}
                              title={tmpl.name}
                            >
                              {previewImg ? (
                                <Image
                                  src={getImageSrc(previewImg) || previewImg}
                                  alt={tmpl.name}
                                  fill
                                  sizes="64px"
                                  className="object-cover"
                                />
                              ) : (
                                <div className="w-full h-full bg-gray-300 flex items-center justify-center">
                                  <span className="text-xs text-gray-600">{tmpl.name?.charAt(0)}</span>
                                </div>
                              )}
                            </button>
                          )
                        })}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Select a template to customize</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="min-w-0 lg:col-span-1" suppressHydrationWarning>
            {brandName ? (
              <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-1">{brandName}</p>
            ) : null}
            <h1 className="text-xl font-bold text-gray-900 mb-2 leading-snug sm:text-2xl">{product?.name}</h1>

            {pdpHeroPricing && (
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
                <div className="flex min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 sm:gap-x-3">
                    {pdpHeroPricing.showStrike ? (
                      <>
                        <span className="text-2xl font-bold text-emerald-700 tabular-nums">
                          ₹{formatInr(pdpHeroPricing.discountPrice)}
                        </span>
                        <span className="text-base font-medium text-gray-400 line-through decoration-gray-400 tabular-nums sm:text-lg">
                          ₹{formatInr(pdpHeroPricing.basePrice)}
                        </span>
                        {pdpHeroPricing.pctOff != null ? (
                          <span className="text-sm font-bold text-green-600 sm:text-base">{pdpHeroPricing.pctOff}% OFF</span>
                        ) : null}
                        <span className="basis-full text-xs text-slate-500 sm:basis-auto sm:text-sm">Inclusive of all taxes</span>
                      </>
                    ) : (
                      <>
                        <span className="text-2xl font-bold text-gray-900 tabular-nums">
                          ₹{formatInr(pdpHeroPricing.discountPrice)}
                        </span>
                        <span className="text-xs text-slate-500 sm:text-sm">Inclusive of all taxes</span>
                      </>
                    )}
                  </div>
                </div>
                {showRatingPill ? (
                  <button
                    type="button"
                    onClick={scrollToReviewsSection}
                    className="inline-flex w-fit shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-900 shadow-sm transition-colors hover:border-gray-300 hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 min-h-[44px] sm:py-1.5"
                    aria-label={`Rating ${ratingDisplay}, ${reviewCount} reviews — go to reviews`}
                  >
                    <svg className="h-4 w-4 shrink-0 text-amber-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    <span>{ratingDisplay}</span>
                    <span className="font-normal text-gray-400">|</span>
                    <span>{reviewCount.toLocaleString("en-IN")}</span>
                  </button>
                ) : null}
              </div>
            )}

            {(displayMode === "customized" || displayMode === "both") &&
              (plainProductDisplayPrice ?? baseUnit) > 0 && (
              <div className="mb-6 rounded-lg border border-dashed border-blue-200 bg-blue-50 px-4 py-3 text-sm text-gray-700">
                <label className="flex items-start gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={plainWithoutCustomCheckbox}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setPlainWithoutCustomCheckbox(true)
                        if (plainModalOpenDelayRef.current != null) {
                          clearTimeout(plainModalOpenDelayRef.current)
                        }
                        plainModalOpenDelayRef.current = setTimeout(() => {
                          plainModalOpenDelayRef.current = null
                          setPlainWithoutCustomModalOpen(true)
                        }, 500)
                      } else {
                        if (plainModalOpenDelayRef.current != null) {
                          clearTimeout(plainModalOpenDelayRef.current)
                          plainModalOpenDelayRef.current = null
                        }
                        setPlainWithoutCustomCheckbox(false)
                        setPlainPricingActive(false)
                        setPlainWithoutCustomModalOpen(false)
                      }
                    }}
                    className="mt-1 h-4 w-4 shrink-0 rounded border-gray-400 text-blue-600 focus:ring-blue-500"
                  />
                  <span>
                    Buy this item <span className="font-bold">without customization</span> from{" "}
                    <span className="font-bold text-red-600 tabular-nums">
                      ₹{plainProductDisplayPrice ?? baseUnit}
                    </span>
                  </span>
                </label>
              </div>
            )}

            {product?.price != null && product?.price !== "" && (
              <div className="mb-4 flex min-w-0 w-full flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div className="flex min-w-0 w-full max-w-full flex-1 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
                  <span className="text-sm text-gray-800">
                    <span className="font-bold">Quantity:</span>
                  </span>
                  <div className="inline-flex w-fit max-w-full items-center rounded-md border border-gray-300 bg-white overflow-hidden">
                    <button
                      type="button"
                      onClick={() => {
                        setMultiSizeDraftQty({})
                        setQuantity((q) => Math.max(1, q - 1))
                      }}
                      className="min-h-[44px] min-w-[44px] px-3 py-2 text-lg text-gray-700 hover:bg-gray-50 active:bg-gray-100 sm:min-h-0 sm:min-w-0 sm:py-1.5 sm:text-base"
                      aria-label="Decrease quantity"
                    >
                      −
                    </button>
                    <span className="min-h-[44px] min-w-[2.75rem] px-4 py-2 text-center text-sm font-semibold text-gray-900 border-x border-gray-200 tabular-nums sm:min-h-0 sm:py-1.5">
                      {effectiveTierQty}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setMultiSizeDraftQty({})
                        setQuantity((q) => q + 1)
                      }}
                      className="min-h-[44px] min-w-[44px] px-3 py-2 text-lg text-gray-700 hover:bg-gray-50 active:bg-gray-100 sm:min-h-0 sm:min-w-0 sm:py-1.5 sm:text-base"
                      aria-label="Increase quantity"
                    >
                      +
                    </button>
                  </div>
                  {multiSizeTotalUnits > 0 ? (
                    <span className="text-xs leading-snug text-sky-800 sm:inline">Total units from multiple sizes (edit in Select Multiple Sizes)</span>
                  ) : null}
                </div>
                <div ref={buyButtonsRef} className="flex w-full min-w-0 shrink-0 flex-col gap-3 sm:ml-4 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">{buyButtons}</div>
              </div>
            )}

            <PrintSideSelector
              options={printSideOptions}
              selectedIds={selectedPrintSideIds}
              lockedIds={lockedPrintSideId ? [lockedPrintSideId] : []}
              onToggle={(id) => togglePrintSide(id)}
              variant={showCustomizedView ? "customization" : "default"}
            />

            {showCustomizedView ? (
              <>
                {showSizeSelector ? (
                  <SizeSelector
                    variant="customization"
                    sizes={sizeOptionsForUi}
                    stockByIndex={sizeStockForUi}
                    selectedId={selectedSizeId}
                    onChange={(id) => setSelectedSizeId(id)}
                    onSizeGuideClick={() => setSizeGuideOpen(true)}
                    onNotifyClick={() => window.alert("We will notify you when this size is back in stock.")}
                    showMultipleSizesLink={multiSizeModalRows.length >= 2}
                    onOpenMultipleSizes={() => setMultiSizeModalOpen(true)}
                    multiSizeQuantities={multiSizeDraftQty}
                  />
                ) : null}
                {materialOptions.length > 0 ? (
                  <MaterialSelector
                    materials={materialOptions}
                    selectedId={selectedMaterialId}
                    onChange={(id) => setSelectedMaterialId(id)}
                  />
                ) : null}
                <ColorSelector
                  variant="customization"
                  variants={colorOptions}
                  selectedId={selected?._id}
                  onChange={(_, v) => setSelected(v)}
                />
              </>
            ) : (
              <>
                {showSizeSelector ? (
                  <SizeSelector
                    sizes={sizeOptionsForUi}
                    stockByIndex={sizeStockForUi}
                    selectedId={selectedSizeId}
                    onChange={(id) => setSelectedSizeId(id)}
                    onSizeGuideClick={() => setSizeGuideOpen(true)}
                    onNotifyClick={() => window.alert("We will notify you when this size is back in stock.")}
                    showMultipleSizesLink={multiSizeModalRows.length >= 2}
                    onOpenMultipleSizes={() => setMultiSizeModalOpen(true)}
                    multiSizeQuantities={multiSizeDraftQty}
                  />
                ) : null}
                <ColorSelector variants={colorOptions} selectedId={selected?._id} onChange={(_, v) => setSelected(v)} />
              </>
            )}

            {product?.price != null && product?.price !== "" && (
              <>
              <div className="mb-6 w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm max-md:shadow-md">
                <div className="bg-[#FFF8DC] px-2 py-2.5 text-center text-[11px] font-bold leading-tight text-[#B45309] sm:px-4 sm:text-sm md:text-base">
                  <span aria-hidden>🎉</span> Shop more, Save more!
                </div>

                <div className="w-full min-w-0 max-w-full max-md:overflow-x-auto max-md:overscroll-x-contain max-md:touch-pan-x max-md:[-webkit-overflow-scrolling:touch]">
                <div className="grid min-w-[340px] grid-cols-5 text-xs border-b border-gray-200 sm:text-sm md:min-w-0">
                  <div className="bg-white py-3 px-1.5 sm:px-3 text-gray-800 font-medium text-left flex items-center">
                    Qty:
                  </div>
                  {tierBandLabels.map((label, i) => (
                    <div
                      key={label}
                      className={`bg-white py-3 px-1 text-center text-gray-900 font-medium flex items-center justify-center ${
                        activeTierColumnIndex === i ? "ring-2 ring-inset ring-amber-400 z-[1]" : ""
                      }`}
                    >
                      {label}
                    </div>
                  ))}
                </div>

                <div className="grid min-w-[340px] grid-cols-5 text-xs sm:text-sm md:min-w-0">
                  <div className="bg-white py-3 px-1.5 sm:px-3 text-gray-800 font-medium text-left flex items-center border-b border-gray-100">
                    Price / unit:
                  </div>
                  {tierColumnUnitPrices.map((unit, i) => {
                    const volPct = tierColumnExtraPercents[i]
                    const showBulkStrike =
                      volPct > 0 && baseUnit > 0 && unit < baseUnit - 0.01
                    const displayBase = baseUnit + printSideAddonForPricing
                    const displayUnit = unit + printSideAddonForPricing
                    return (
                      <div
                        key={i}
                        className={`bg-white py-3 px-1 text-center flex flex-col items-center justify-center gap-0.5 border-b border-gray-100 min-h-[4.25rem] ${
                          activeTierColumnIndex === i ? "bg-amber-50 ring-2 ring-inset ring-amber-400 z-[1]" : ""
                        }`}
                      >
                        {showBulkStrike ? (
                          <>
                            <span className="text-xs text-gray-400 line-through tabular-nums">₹{formatInr(displayBase)}</span>
                            <span className="text-base font-semibold text-emerald-700 tabular-nums">₹{formatInr(displayUnit)}</span>
                          </>
                        ) : (
                          <span className="text-base font-semibold text-gray-900 tabular-nums">₹{formatInr(displayUnit)}</span>
                        )}
                      </div>
                    )
                  })}
                </div>
                </div>

                <div className="bg-sky-100 px-4 py-4 space-y-2 rounded-b-xl">
                  <p className="text-sm text-gray-900">
                    <span className="font-bold">Quantity :</span>{" "}
                    <span className="font-semibold tabular-nums">{effectiveTierQty}</span>
                  </p>
                  <p className="text-sm text-gray-900">
                    <span className="font-bold">Total Price:</span>{" "}
                    <span className="font-semibold tabular-nums">₹{lineTotal.toFixed(0)}</span>
                  </p>
                </div>
              </div>
              </>
            )}

            {showToggle && (
              <div className="mb-4 mt-6 rounded-xl border border-gray-100 bg-gray-50/80 px-4 py-3 md:border-0 md:bg-transparent md:px-0 md:py-0">
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

            <div className="mt-6 border-t border-gray-200 pt-6 space-y-6">
              {(product?.price == null || product?.price === "") && (
                <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                  {buyButtons}
                </div>
              )}

              <div className="border-t border-gray-200 pt-6">
                <h2 className="text-base font-bold text-gray-900 mb-3">Check for Delivery Details</h2>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="Enter Pincode"
                    value={deliveryPincode}
                    onChange={(e) => setDeliveryPincode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className="w-full rounded-lg border-2 border-gray-200 py-3 pl-4 pr-24 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                  />
                  <button
                    type="button"
                    onClick={handleDeliveryCheck}
                    disabled={deliveryChecking}
                    className="absolute right-2 min-h-[44px] min-w-[4.5rem] rounded-md px-2 text-sm font-semibold text-blue-600 hover:bg-blue-50 hover:text-blue-800 disabled:opacity-50 sm:right-3"
                  >
                    {deliveryChecking ? "…" : "Check"}
                  </button>
                </div>
                {deliveryResult?.valid && (
                  <p className="mt-2 text-sm text-gray-700">
                    Delivery available to <span className="font-medium">{deliveryResult.city}</span>,{" "}
                    <span className="font-medium">{deliveryResult.state}</span>
                  </p>
                )}
                {deliveryResult && deliveryResult.valid === false && deliveryResult.message && (
                  <p className="mt-2 text-sm text-red-600">{deliveryResult.message}</p>
                )}
                <div className="mt-4 flex items-start gap-2 rounded-lg bg-sky-100 px-3 py-3 text-xs font-bold leading-snug text-sky-900 sm:items-center sm:px-4 sm:text-sm">
                  <svg className="w-5 h-5 shrink-0 text-sky-800" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"
                    />
                  </svg>
                  This product is eligible for FREE SHIPPING
                </div>
              </div>

              <ProductPdpBelowFold product={product} productId={productId} productSlug={productSlug} />

              <button
                type="button"
                onClick={() => {
                  setEnquiryForm((f) => ({ ...f, quantity }))
                  setEnquiryOpen(true)
                  setEnquirySuccess(false)
                  setEnquiryError("")
                }}
                className="inline-flex min-h-[44px] items-center text-sm font-medium text-blue-600 underline decoration-2 underline-offset-2 hover:text-blue-800"
              >
                Bulk product enquiry
              </button>
            </div>

            {enquiryOpen &&
              typeof document !== "undefined" &&
              createPortal(
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
                </>,
                document.body,
              )}

            {addToCartSuccess && (
              <p className="mt-3 text-sm text-green-600 font-medium">
                Added to bag.{" "}
                <Link href="/cart" className="underline hover:no-underline">
                  View bag
                </Link>
              </p>
            )}
          </div>
        </div>

        {relatedProducts.length > 0 && (
          <section className="mb-8 mt-2 md:mb-10">
            <h2 className="text-base font-bold uppercase tracking-wide text-gray-900 mb-3 md:mb-4 md:text-lg">You May Also Like</h2>
            <GridLayout products={relatedProducts} columns={4} />
          </section>
        )}
      </div>

      <RecentlyViewedProducts contentClassName={PDP_PAGE_INNER_WIDTH_CLASS} />
      <Footer />

      <SelectMultipleSizesModal
        open={multiSizeModalOpen}
        onClose={() => setMultiSizeModalOpen(false)}
        rows={multiSizeModalRows}
        quantities={multiSizeDraftQty}
        onQuantitiesChange={setMultiSizeDraftQty}
        onProceed={runMultiSizeAddToCart}
        footerNote={multiSizeFooterNote}
      />

      <SizeGuideModal open={sizeGuideOpen} onClose={() => setSizeGuideOpen(false)} rows={sizeGuideRows} />

      {plainWithoutCustomModalOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center p-0 bg-black/50 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="plain-without-custom-title"
          onClick={() => {
            if (plainModalOpenDelayRef.current != null) {
              clearTimeout(plainModalOpenDelayRef.current)
              plainModalOpenDelayRef.current = null
            }
            setPlainWithoutCustomModalOpen(false)
            setPlainWithoutCustomCheckbox(false)
          }}
        >
          <div
            className="w-full rounded-t-2xl bg-white p-5 shadow-xl sm:max-w-md sm:rounded-xl sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <p id="plain-without-custom-title" className="text-center text-gray-700 text-sm sm:text-base">
              You will receive plain product without any customization.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={confirmPlainWithoutCustomization}
                className="min-w-[7rem] rounded-md bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              >
                Confirm
              </button>
              <button
                type="button"
                onClick={() => {
                  if (plainModalOpenDelayRef.current != null) {
                    clearTimeout(plainModalOpenDelayRef.current)
                    plainModalOpenDelayRef.current = null
                  }
                  setPlainWithoutCustomModalOpen(false)
                  setPlainWithoutCustomCheckbox(false)
                }}
                className="min-w-[7rem] rounded-md border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-900 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showStickyBar && !isMdUp && typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-x-0 bottom-0 z-[90] border-t border-gray-200 bg-white/95 px-4 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-2px_12px_rgb(0,0,0,0.08)] backdrop-blur-sm md:hidden">
            <div className="flex items-center gap-3">
              {pdpHeroPricing && (
                <div className="mr-auto min-w-0 flex-1">
                  <span className="block text-base font-bold text-gray-900 tabular-nums leading-tight">
                    ₹{formatInr(pdpHeroPricing.discountPrice)}
                  </span>
                  {pdpHeroPricing.showStrike && (
                    <span className="text-xs text-gray-400 line-through tabular-nums">
                      ₹{formatInr(pdpHeroPricing.basePrice)}
                    </span>
                  )}
                </div>
              )}
              <button
                type="button"
                onClick={() => {
                  if (showSizeSelector && !selectedSizeId) {
                    window.alert("Please select an available size.")
                    return
                  }
                  const image = savedDesign?.image || selected?.image || product?.mainImage || product?.images?.[0]
                  const containerEl = productImageRef.current
                  const mainImgEl = containerEl?.querySelector?.("[data-main-image]")
                  const sourceRect = (mainImgEl || containerEl)?.getBoundingClientRect?.()
                  if (image && sourceRect) runFlyToCart(image, sourceRect)
                  const plainMrp = Number(effectivePricingPayload?.price)
                  if (plainPricingActive && Number.isFinite(plainMrp)) {
                    addToCart({
                      productId, slug: productSlug, name: product?.name,
                      price: plainMrp, discountedPrice: null,
                      quantityDiscountTiers: product?.quantityDiscountTiers || null,
                      quantity: effectiveTierQty, image,
                      variant: cartVariant || null, size: selectedSize,
                      material: selectedMaterialRow, customDesign: null,
                      printSides: [], printSide: null, printSideAddon: 0,
                      plainWithoutCustomization: true,
                    })
                  } else {
                    addToCart({
                      productId, slug: productSlug, name: product?.name,
                      price: selected?.isVariation && selected.price != null ? selected.price : product?.price,
                      discountedPrice: selected?.isVariation ? (selected.discountedPrice ?? null) : product?.discountedPrice,
                      quantityDiscountTiers: product?.quantityDiscountTiers || null,
                      quantity, image, variant: cartVariant || null,
                      size: selectedSize, material: selectedMaterialRow,
                      customDesign: savedDesign || null,
                      printSides: printSideOptions.length > 0 && selectedPrintSides.length > 0
                        ? selectedPrintSides.map(({ _id, name }) => ({ _id, name }))
                        : [],
                      printSide: null,
                      printSideAddon: printSideOptions.length > 0 ? printSideAddon : 0,
                    })
                  }
                  setAddToCartSuccess(true)
                  setTimeout(() => setAddToCartSuccess(false), 3000)
                }}
                className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-lg bg-[#FFD633] px-5 py-3 text-sm font-bold uppercase tracking-wide text-gray-900 shadow-sm transition-colors hover:bg-[#f5cc2e] active:scale-[0.98]"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
                Add to bag
              </button>
            </div>
          </div>,
          document.body
        )
      }
    </div>
  )
}
