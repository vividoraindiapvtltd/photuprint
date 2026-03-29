"use client"

import { createContext, useContext, useState, useCallback, useEffect } from "react"

const CART_STORAGE_KEY = "pp_cart"

const defaultCartValue = {
  items: [],
  totalCount: 0,
  addItem: () => {},
  removeItem: () => {},
  updateQuantity: () => {},
  clearCart: () => {},
}

const CartContext = createContext(defaultCartValue)

function loadCart() {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveCart(items) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items))
  } catch {
    // ignore
  }
}

/** Stable key from multiple print sides (sorted ids) or legacy single id string. */
function makeLineId(
  productId,
  variantId = "",
  isCustom = false,
  sizeId = "",
  printSidesKey = "",
  materialId = "",
  plainWithoutCustomization = false,
  gsmId = "",
  capacityId = "",
) {
  const v = variantId || ""
  const s = sizeId || ""
  const p = printSidesKey || ""
  const m = materialId || ""
  const g = gsmId || ""
  const c = capacityId || ""
  const mode = plainWithoutCustomization ? "plain" : isCustom ? "custom" : "std"
  return `${productId}|${v}|${s}|${mode}|${p}|${m}|${g}|${c}`
}

export function CartProvider({ children }) {
  const [items, setItems] = useState([])

  useEffect(() => {
    setItems(loadCart())
  }, [])

  useEffect(() => {
    saveCart(items)
  }, [items])

  const addItem = useCallback(
    (payload) => {
      const {
        productId,
        slug,
        name,
        price,
        discountedPrice,
        quantityDiscountTiers,
        quantity = 1,
        image,
        variant,
        size,
        customDesign,
        printSide,
        printSides,
        printSideAddon,
        materialAddon,
        material,
        plainWithoutCustomization,
        gsm,
        capacity,
      } = payload
      const printSidesKey = (() => {
        if (Array.isArray(printSides) && printSides.length) {
          return [...printSides]
            .map((p) => String(p._id || p.id || "").trim())
            .filter(Boolean)
            .sort()
            .join(",")
        }
        const one = printSide?._id || printSide?.id
        return one != null ? String(one) : ""
      })()
      const gsmId = gsm?._id || gsm?.id || ""
      const capacityId = capacity?._id || capacity?.id || ""
      const lineId = makeLineId(
        productId,
        variant?._id || variant?.id,
        !!customDesign,
        size?._id || size?.id || "",
        printSidesKey,
        material?._id || material?.id || "",
        plainWithoutCustomization === true,
        gsmId,
        capacityId,
      )
      setItems((prev) => {
        const i = prev.findIndex((x) => x.lineId === lineId)
        const next = [...prev]
        const q = Math.max(1, Number(quantity) || 1)
        if (i >= 0) {
          next[i] = { ...next[i], quantity: next[i].quantity + q }
          return next
        }
        const addon = printSideAddon != null ? Number(printSideAddon) : 0
        const matAdd = materialAddon != null ? Number(materialAddon) : 0
        const normalizedPrintSides = Array.isArray(printSides)
          ? printSides.map((p) => ({ _id: String(p._id || p.id), name: p.name || "" })).filter((p) => p._id)
          : printSide
            ? [{ _id: String(printSide._id || printSide.id), name: printSide.name || "" }]
            : []
        next.push({
          lineId,
          productId,
          slug: slug || "",
          name: name || "Product",
          price: Number(price) || 0,
          discountedPrice: discountedPrice != null ? Number(discountedPrice) : null,
          quantityDiscountTiers: quantityDiscountTiers || null,
          quantity: q,
          image: image || null,
          variant: variant || null,
          size: size || null,
          material: material || null,
          gsm: gsm || null,
          capacity: capacity || null,
          customDesign: customDesign || null,
          printSides: normalizedPrintSides,
          printSide: printSide || null,
          printSideAddon: Number.isFinite(addon) && addon >= 0 ? Math.round(addon) : 0,
          materialAddon: Number.isFinite(matAdd) && matAdd >= 0 ? Math.round(matAdd) : 0,
          plainWithoutCustomization: plainWithoutCustomization === true,
        })
        return next
      })
    },
    [],
  )

  const removeItem = useCallback((lineId) => {
    setItems((prev) => prev.filter((x) => x.lineId !== lineId))
  }, [])

  const updateQuantity = useCallback((lineId, quantity) => {
    const q = Math.max(0, Number(quantity) || 0)
    if (q === 0) {
      setItems((prev) => prev.filter((x) => x.lineId !== lineId))
      return
    }
    setItems((prev) =>
      prev.map((x) => (x.lineId === lineId ? { ...x, quantity: q } : x)),
    )
  }, [])

  const clearCart = useCallback(() => setItems([]), [])

  const totalCount = items.reduce((sum, x) => sum + (x.quantity || 0), 0)

  return (
    <CartContext.Provider
      value={{
        items,
        totalCount,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
      }}
    >
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const ctx = useContext(CartContext)
  return ctx || defaultCartValue
}
