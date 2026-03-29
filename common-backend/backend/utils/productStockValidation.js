/**
 * When parent product stock is negative (e.g. -1), it means unlimited / not capped
 * at the product level — variant stock must not be compared with that sentinel.
 * Variant stock &lt; 0 means unlimited at variant level — only valid when product is unlimited;
 * that case is enforced by callers; here we only compare finite caps.
 */
export function variantStockExceedsProductStock(variantStock, productStock) {
  const v = variantStock != null && variantStock !== "" ? Number(variantStock) : 0
  if (Number.isNaN(v)) return false
  if (v < 0) return false
  if (productStock != null && Number(productStock) < 0) return false
  const limit = productStock == null || productStock === "" ? 0 : Number(productStock)
  const lim = Number.isFinite(limit) ? limit : 0
  return v > lim
}
