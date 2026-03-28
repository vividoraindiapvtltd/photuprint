/** Mirror backend quantity tier rules for cart / checkout display. */

export function getEffectiveBaseUnitPrice(productLike) {
  if (!productLike) return 0
  const price = Number(productLike.price)
  const disc = productLike.discountedPrice != null ? Number(productLike.discountedPrice) : null
  if (!Number.isFinite(price) || price < 0) return 0
  if (disc != null && Number.isFinite(disc) && disc >= 0 && disc < price) return disc
  return price
}

function clampPercent(v) {
  const n = Number(v)
  if (!Number.isFinite(n) || n <= 0) return 0
  return Math.min(100, Math.max(0, n))
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

export function getVolumeAdjustedUnitPrice(productLike, quantity) {
  const base = getEffectiveBaseUnitPrice(productLike)
  const pct = getQuantityTierExtraPercent(productLike, quantity)
  return Math.round(base * (1 - pct / 100))
}

/** Cart line: unit price after volume tier for current line quantity. */
export function getCartLineUnitPrice(item) {
  if (!item) return 0
  const vol = getVolumeAdjustedUnitPrice(
    {
      price: item.price,
      discountedPrice: item.discountedPrice,
      quantityDiscountTiers: item.quantityDiscountTiers,
    },
    item.quantity || 1
  )
  const addon = Number(item.printSideAddon)
  const a = Number.isFinite(addon) && addon > 0 ? addon : 0
  return Math.round(vol + a)
}

/** Per-unit price before quantity-band discount (product offer + print-side add-on). */
export function getCartLineUnitPriceBeforeVolumeTier(item) {
  if (!item) return 0
  const base = getEffectiveBaseUnitPrice({
    price: item.price,
    discountedPrice: item.discountedPrice,
  })
  const addon = Number(item.printSideAddon)
  const a = Number.isFinite(addon) && addon > 0 ? addon : 0
  return base + a
}

export function getCartLineTotal(item) {
  const unit = getCartLineUnitPrice(item)
  return unit * (item.quantity || 0)
}
