import { getSizeDisplayLabel } from "./sizeDisplayLabel"

/** Fixed PDP order for apparel (t-shirts, shirts, sweatshirts, etc.). */
export const APPAREL_STANDARD_SIZE_LABELS = [
  "XXS",
  "XS",
  "S",
  "M",
  "L",
  "XL",
  "2XL",
  "3XL",
  "4XL",
  "5XL",
  "6XL",
  "7XL",
]

const LADDER_SET = new Set(APPAREL_STANDARD_SIZE_LABELS)

/**
 * Map a display label (from getSizeDisplayLabel or admin text) to a canonical ladder key, or null.
 */
export function normalizeToApparelSizeKey(raw) {
  if (raw == null || raw === "") return null
  const t = String(raw).trim().toUpperCase().replace(/[\s-]+/g, "")
  if (LADDER_SET.has(t)) return t
  if (t === "XXL" || t === "2XL") return "2XL"
  if (t === "XXXL" || t === "3XL") return "3XL"
  if (t === "XXSMALL" || t === "DOUBLEEXTRASMALL") return "XXS"
  if (t === "XSMALL" || t === "EXTRASMALL") return "XS"
  const m = t.match(/^(\d)XL$/)
  if (m) {
    const n = Number(m[1])
    if (n >= 2 && n <= 7) return `${n}XL`
  }
  return null
}

function categoryText(product) {
  const parts = []
  if (product?.name) parts.push(String(product.name))
  if (product?.tags) parts.push(String(product.tags))
  if (product?.fit) parts.push(String(product.fit))
  const c = product?.category
  const sc = product?.subcategory
  if (typeof c === "string" && c.trim()) {
    parts.push(c.trim())
  } else if (c && typeof c === "object") {
    if (c.name) parts.push(String(c.name))
    if (c.slug) parts.push(String(c.slug))
  }
  if (typeof sc === "string" && sc.trim()) {
    parts.push(sc.trim())
  } else if (sc && typeof sc === "object") {
    if (sc.name) parts.push(String(sc.name))
    if (sc.slug) parts.push(String(sc.slug))
  }
  return parts.join(" ").toLowerCase()
}

const APPAREL_KEYWORD_RE =
  /\b(clothing|clothes|garments?|t[\s-]?shirt|tshirt|tee|tees|sweat\s*shirt|sweatshirt|hoodie|hoodies|polo|polos|tank|tanks|long[\s-]?sleeve|full[\s-]?sleeve|shirt|shirts|top|tops|apparel|jacket|jackets|sweater|sweaters|fleece|joggers|shorts?|leggings?|innerwear|vest|vests|kurta|kurti|dress|dresses|denim|knitwear|trousers?|jeans?)\b/i

/**
 * Use the fixed XXS–7XL ladder on PDP for typical apparel categories (name, tags, category, etc.).
 */
export function productUsesApparelSizeLadder(product) {
  const hay = categoryText(product)
  if (!hay) return false
  return APPAREL_KEYWORD_RE.test(hay)
}

/**
 * Show the full XXS–7XL grid when category keywords match OR when linked sizes look like standard apparel (handles unpopulated category).
 */
export function productShouldShowApparelSizeLadder(product, sizeOptions) {
  if (productUsesApparelSizeLadder(product)) return true
  if (!Array.isArray(sizeOptions) || sizeOptions.length === 0) return false
  return sizeOptions.some((s) => {
    const label = getSizeDisplayLabel(s)
    return normalizeToApparelSizeKey(label) != null
  })
}

/**
 * @param {Array<{ _id: string, name: string, initial?: string }>} sizeOptions — PDP rows (name = display label)
 * @returns {{ byKey: Map<string, typeof sizeOptions[0]>, unmapped: typeof sizeOptions }}
 */
export function mapSizesToApparelLadder(sizeOptions) {
  const byKey = new Map()
  const unmapped = []
  for (const s of sizeOptions) {
    const label = getSizeDisplayLabel(s)
    const key = normalizeToApparelSizeKey(label)
    if (key) {
      if (!byKey.has(key)) byKey.set(key, s)
      else unmapped.push(s)
    } else {
      unmapped.push(s)
    }
  }
  return { byKey, unmapped }
}

/**
 * Stock split only across in-stock ladder slots that have a catalog size (matched keys).
 */
export function apparelLadderStockBySlots(matchedFlags, productStock) {
  const nSlots = matchedFlags.length
  if (nSlots === 0) return []
  const stock = productStock
  if (stock === -1 || stock == null) {
    return matchedFlags.map((m) => (m ? { available: true, left: null } : { available: false, left: null }))
  }
  const num = Number(stock)
  if (!Number.isFinite(num) || num <= 0) {
    return matchedFlags.map(() => ({ available: false, left: 0 }))
  }
  const indices = []
  for (let i = 0; i < nSlots; i++) {
    if (matchedFlags[i]) indices.push(i)
  }
  const m = indices.length
  if (m === 0) return matchedFlags.map(() => ({ available: false, left: 0 }))
  const base = Math.floor(num / m)
  const rem = num % m
  const leftByIndex = {}
  indices.forEach((slotIdx, j) => {
    leftByIndex[slotIdx] = base + (j < rem ? 1 : 0)
  })
  return matchedFlags.map((isMatched, i) => {
    if (!isMatched) return { available: false, left: 0 }
    const left = leftByIndex[i] ?? 0
    return { available: left > 0, left }
  })
}
