/**
 * Resolve MRP, sale price, and % off for storefront cards and PDP.
 * Prefer stored `discountedPrice`; if missing but `discountPercentage` + `price` exist, derive sale (matches admin intent).
 */

export function resolveProductOfferPricing(productLike) {
  if (!productLike) {
    return { mrp: 0, sale: 0, pctOff: null, hasOffer: false }
  }
  const mrp = Number(productLike.price)
  if (!Number.isFinite(mrp) || mrp < 0) {
    return { mrp: 0, sale: 0, pctOff: null, hasOffer: false }
  }

  const rawDisc = productLike.discountedPrice
  let sale =
    rawDisc != null && rawDisc !== ""
      ? Number(rawDisc)
      : NaN

  const pctFromField =
    productLike.discountPercentage != null && productLike.discountPercentage !== ""
      ? Number(productLike.discountPercentage)
      : null

  if (!Number.isFinite(sale) || sale < 0 || sale > mrp) {
    sale = mrp
  }

  // When discountedPrice is missing, derive sale from discount %.
  // Naive round(price * (1 - pct/100)) can be off vs admin (e.g. ₹699 @ 29% → 496 vs intended ₹499).
  // If discount amount is large, many catalogs round the rupee discount to the nearest ₹100; when that
  // is within ₹3 of the naive rounded sale, prefer it so cards/PDP match admin.
  if (sale >= mrp - 0.01) {
    if (pctFromField != null && Number.isFinite(pctFromField) && pctFromField > 0 && pctFromField < 100) {
      const rawDiscountRupees = (mrp * pctFromField) / 100
      const standardRounded = Math.round(mrp * (1 - pctFromField / 100))
      let derived = standardRounded
      if (rawDiscountRupees >= 100) {
        const discountRoundedTo100 = Math.round(rawDiscountRupees / 100) * 100
        const saleIfDiscountTo100 = mrp - discountRoundedTo100
        if (Math.abs(standardRounded - saleIfDiscountTo100) <= 3) {
          derived = saleIfDiscountTo100
        }
      }
      sale = derived
    } else {
      sale = mrp
    }
  }

  const hasOffer = sale < mrp - 0.01
  let pctOff = null
  if (hasOffer && mrp > 0) {
    pctOff = Math.round(((mrp - sale) / mrp) * 100)
  } else if (pctFromField != null && Number.isFinite(pctFromField) && pctFromField > 0) {
    pctOff = Math.round(pctFromField)
  }

  return { mrp, sale, pctOff, hasOffer }
}
