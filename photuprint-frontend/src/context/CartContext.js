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

function makeLineId(productId, variantId = "", isCustom = false) {
  return `${productId}|${variantId || ""}|${isCustom ? "custom" : "std"}`
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
        quantity = 1,
        image,
        variant,
        customDesign,
      } = payload
      const lineId = makeLineId(productId, variant?._id || variant?.id, !!customDesign)
      setItems((prev) => {
        const i = prev.findIndex((x) => x.lineId === lineId)
        const next = [...prev]
        const q = Math.max(1, Number(quantity) || 1)
        if (i >= 0) {
          next[i] = { ...next[i], quantity: next[i].quantity + q }
          return next
        }
        next.push({
          lineId,
          productId,
          slug: slug || "",
          name: name || "Product",
          price: Number(price) || 0,
          discountedPrice: discountedPrice != null ? Number(discountedPrice) : null,
          quantity: q,
          image: image || null,
          variant: variant || null,
          customDesign: customDesign || null,
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
