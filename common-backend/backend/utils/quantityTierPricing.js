/**
 * Per-product quantity-band extra discount (% off effective base unit price).
 * Bands: 1–5, 6–10, 11–20, 21+ (maxQty null = open-ended).
 */

export const QUANTITY_TIER_BANDS = [
  { minQty: 1, maxQty: 5 },
  { minQty: 6, maxQty: 10 },
  { minQty: 11, maxQty: 20 },
  { minQty: 21, maxQty: null },
]

export function getEffectiveBaseUnitPrice(productLike) {
  if (!productLike) return 0
  const price = Number(productLike.price)
  const disc = productLike.discountedPrice != null ? Number(productLike.discountedPrice) : null
  if (!Number.isFinite(price) || price < 0) return 0
  if (disc != null && Number.isFinite(disc) && disc >= 0 && disc < price) return disc
  return price
}

export function getQuantityTierExtraPercent(productLike, quantity) {
  const q = Math.max(0, Math.floor(Number(quantity) || 0))
  if (q < 1) return 0
  const tiers = productLike?.quantityDiscountTiers
  if (!Array.isArray(tiers) || tiers.length === 0) return 0
  for (const t of tiers) {
    const min = Number(t.minQty)
    const max = t.maxQty == null || t.maxQty === "" ? null : Number(t.maxQty)
    if (!Number.isFinite(min)) continue
    if (q < min) continue
    if (max == null || !Number.isFinite(max)) {
      return clampPercent(t.discountPercent)
    }
    if (q <= max) {
      return clampPercent(t.discountPercent)
    }
  }
  return 0
}

function clampPercent(v) {
  const n = Number(v)
  if (!Number.isFinite(n) || n <= 0) return 0
  return Math.min(100, Math.max(0, n))
}

export function getVolumeAdjustedUnitPrice(productLike, quantity) {
  const base = getEffectiveBaseUnitPrice(productLike)
  const pct = getQuantityTierExtraPercent(productLike, quantity)
  return Math.round(base * (1 - pct / 100))
}

/**
 * Parse and normalize tiers from API/FormData. Ensures standard four bands, non-overlapping.
 */
export function parseQuantityDiscountTiers(raw) {
  if (raw == null || raw === "") return []
  let arr
  try {
    arr = typeof raw === "string" ? JSON.parse(raw) : raw
  } catch {
    return []
  }
  if (!Array.isArray(arr)) return []

  const byKey = new Map()
  for (const item of arr) {
    if (!item || typeof item !== "object") continue
    const minQty = Math.floor(Number(item.minQty))
    const maxRaw = item.maxQty
    const maxQty = maxRaw == null || maxRaw === "" ? null : Math.floor(Number(maxRaw))
    if (!Number.isFinite(minQty)) continue
    const discountPercent = clampPercent(item.discountPercent)
    const key = `${minQty}_${maxQty == null ? "inf" : maxQty}`
    byKey.set(key, { minQty, maxQty: maxQty == null || !Number.isFinite(maxQty) ? null : maxQty, discountPercent })
  }

  return QUANTITY_TIER_BANDS.map((band) => {
    const key = `${band.minQty}_${band.maxQty == null ? "inf" : band.maxQty}`
    const found = byKey.get(key)
    return {
      minQty: band.minQty,
      maxQty: band.maxQty,
      discountPercent: found ? found.discountPercent : 0,
    }
  })
}
