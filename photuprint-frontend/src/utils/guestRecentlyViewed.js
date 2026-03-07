const STORAGE_KEY = "pp_recently_viewed_guest"
const MAX_ITEMS = 20
export const GUEST_RECENTLY_VIEWED_UPDATED_EVENT = "pp_guest_recently_viewed_updated"

function safeStorage() {
  if (typeof window === "undefined" || !window.localStorage) return null
  return window.localStorage
}

/**
 * @returns {{ productId: string, viewedAt: string }[]}
 */
export function getGuestRecentlyViewed() {
  const storage = safeStorage()
  if (!storage) return []
  try {
    const raw = storage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item) => item && typeof item.productId === "string")
  } catch {
    return []
  }
}

/**
 * Append or move productId to the end of the list; enforce max length.
 * @param {string} productId
 */
export function addGuestRecentlyViewed(productId) {
  const storage = safeStorage()
  if (!storage) {
    if (process.env.NODE_ENV === "development") console.warn("[guestRecentlyViewed] No localStorage (e.g. SSR or private mode)")
    return
  }
  if (!productId || typeof productId !== "string") return
  const id = productId.trim()
  if (!id) return
  try {
    let list = getGuestRecentlyViewed()
    list = list.filter((item) => item.productId !== id)
    list.push({ productId: id, viewedAt: new Date().toISOString() })
    if (list.length > MAX_ITEMS) list = list.slice(-MAX_ITEMS)
    storage.setItem(STORAGE_KEY, JSON.stringify(list))
    if (typeof window !== "undefined" && window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent(GUEST_RECENTLY_VIEWED_UPDATED_EVENT))
    }
    if (process.env.NODE_ENV === "development") {
      console.log("[guestRecentlyViewed] Stored productId:", id, "total items:", list.length)
    }
  } catch (e) {
    if (process.env.NODE_ENV === "development") console.warn("[guestRecentlyViewed] Failed to store:", e)
  }
}

export function clearGuestRecentlyViewed() {
  const storage = safeStorage()
  if (!storage) return
  try {
    storage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

import api from "./api.js"

/**
 * Sync guest recently viewed list to backend (POST each productId), then clear guest storage.
 * Call after login. Uses same endpoint as product page.
 */
export function syncGuestRecentlyViewedToBackend() {
  const list = getGuestRecentlyViewed()
  if (list.length === 0) return
  list.forEach(({ productId }) => {
    api.post("/recently-viewed-products", { productId }).catch(() => {})
  })
  clearGuestRecentlyViewed()
}
