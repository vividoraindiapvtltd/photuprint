/**
 * Build storefront color/option rows from API product (legacy `colors` or `variations` from ProductVariant).
 */

import { normalizeToApparelSizeKey } from "./apparelSizeLadder"
import { getSizeDisplayLabel } from "./sizeDisplayLabel"

const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/

/**
 * Collect id → display name from product reference arrays (colors, sizes, etc.).
 */
function buildIdLookupMap(product) {
  const map = new Map()
  if (!product || typeof product !== "object") return map

  const addItem = (item) => {
    if (!item || typeof item !== "object") return
    const id = item._id ?? item.id
    if (id == null) return
    const name = item.name ?? item.label ?? item.title
    if (name != null && String(name).trim()) {
      map.set(String(id), String(name).trim())
    }
  }

  const addArray = (arr) => {
    if (!Array.isArray(arr)) return
    arr.forEach(addItem)
  }

  addArray(product.colors)
  addArray(product.sizes)
  addArray(product.brands)
  addArray(product.materials)
  addArray(product.patterns)
  if (product.material && typeof product.material === "object") addItem(product.material)

  if (Array.isArray(product.printSidePricing)) {
    for (const row of product.printSidePricing) {
      const ps = row?.printSide
      if (ps && typeof ps === "object") addItem(ps)
    }
  }

  return map
}

function resolveAttributeValue(val, idMap) {
  if (val == null || val === "") return ""
  if (typeof val === "string") {
    const t = val.trim()
    if (!t) return ""
    if (OBJECT_ID_RE.test(t)) {
      if (idMap.has(t)) return idMap.get(t)
      return ""
    }
    return val
  }
  if (typeof val === "object" && !Array.isArray(val)) {
    const name = val.name ?? val.label ?? val.title
    if (name != null && String(name).trim()) return String(name).trim()
    const id = val._id != null ? String(val._id) : null
    if (id && OBJECT_ID_RE.test(id)) {
      if (idMap.has(id)) return idMap.get(id)
      return ""
    }
    // Mongoose / BSON ObjectId (no .name) — stringify then idMap lookup
    if (typeof val.toString === "function") {
      const s = String(val.toString()).trim()
      if (OBJECT_ID_RE.test(s)) {
        if (idMap.has(s)) return idMap.get(s)
        return ""
      }
    }
    return ""
  }
  return String(val)
}

function attrsToPlainObject(attrs) {
  if (!attrs || typeof attrs !== "object") return {}
  if (attrs instanceof Map) return Object.fromEntries(attrs)
  return attrs
}

function variationDisplayName(attrs, idMap) {
  const plain = attrsToPlainObject(attrs)
  if (!plain || typeof plain !== "object") return "Option"
  const vals = Object.entries(plain).map(([, val]) => resolveAttributeValue(val, idMap))
  const filtered = vals.filter(Boolean)
  if (filtered.length) return filtered.join(" · ")
  // Fallback: non-ID strings or any displayable primitive (backend may send plain text)
  const raw = Object.values(plain)
    .map((v) => {
      if (v == null || v === "") return ""
      if (typeof v === "string") return v.trim()
      if (typeof v === "object" && !Array.isArray(v)) {
        return String(v.name ?? v.label ?? v.title ?? "").trim()
      }
      return ""
    })
    .filter(Boolean)
  return raw.length ? raw.join(" · ") : "Option"
}

/** Attribute keys treated as size (exclude from colour swatch label). */
function isSizeAttributeKey(key) {
  const k = String(key).toLowerCase()
  return k.includes("size") || k === "talla" || k.includes("waist") || k.includes("inseam") || k.includes("length")
}

function isMaterialAttributeKey(key) {
  return String(key).toLowerCase().includes("material")
}

function isColorAttributeKey(key) {
  const k = String(key).toLowerCase()
  return k.includes("color") || k.includes("colour")
}

/**
 * Colour-only label for PDP swatches — colour facet only (not size or material).
 */
export function variationSwatchLabel(attrs, idMap) {
  const plain = attrsToPlainObject(attrs)
  if (!plain || typeof plain !== "object") return ""
  const parts = []
  for (const [key, val] of Object.entries(plain)) {
    if (!isColorAttributeKey(key)) continue
    const resolved = resolveAttributeValue(val, idMap)
    if (resolved) parts.push(resolved)
  }
  return parts.length ? parts.join(" · ") : ""
}

function extractRefId(val) {
  if (val == null || val === "") return null
  if (typeof val === "string") {
    const t = val.trim()
    return OBJECT_ID_RE.test(t) ? t : null
  }
  if (typeof val === "object" && !Array.isArray(val)) {
    if (val._id != null) return String(val._id)
    if (typeof val.toString === "function") {
      const s = String(val.toString()).trim()
      if (OBJECT_ID_RE.test(s)) return s
    }
  }
  return null
}

/** First matching attribute id (e.g. size / material / color) from variant attributes. */
export function getVariantAttributeId(attrs, keyPredicate) {
  const plain = attrsToPlainObject(attrs)
  if (!plain || typeof plain !== "object") return null
  for (const [k, v] of Object.entries(plain)) {
    if (!keyPredicate(k)) continue
    const id = extractRefId(v)
    if (id) return id
  }
  return null
}

export function getSizeIdFromVariantAttributes(attrs) {
  return getVariantAttributeId(attrs, (k) => isSizeAttributeKey(k))
}

export function getMaterialIdFromVariantAttributes(attrs) {
  return getVariantAttributeId(attrs, (k) => isMaterialAttributeKey(k))
}

export function getColorIdFromVariantAttributes(attrs) {
  return getVariantAttributeId(attrs, (k) => isColorAttributeKey(k))
}

/** True when every variation row is keyed by color only (no size in attributes); size inventory lives on sizeStock. */
export function productVariationsAreColorOnly(product) {
  const vars = product?.variations
  if (!Array.isArray(vars) || vars.length === 0) return false
  return vars.every((v) => {
    const a = attrsToPlainObject(v?.attributes)
    return getColorIdFromVariantAttributes(a) != null && !getSizeIdFromVariantAttributes(a)
  })
}

/**
 * Unique size options from product.variations (for customized PDP rows).
 */
export function buildUniqueSizeOptionsFromVariations(product) {
  const idMap = buildIdLookupMap(product)
  if (productVariationsAreColorOnly(product) && Array.isArray(product.sizes) && product.sizes.length > 0) {
    return product.sizes.map((s) => {
      const id = s._id ?? s.id
      if (id == null) return null
      const name = resolveAttributeValue(s, idMap) || s.name || String(id)
      return { _id: String(id), name, initial: s.initial }
    }).filter(Boolean)
  }
  const variations = product?.variations
  if (!Array.isArray(variations) || variations.length === 0) return []
  const seen = new Map()
  for (const v of variations) {
    const attrs = attrsToPlainObject(v.attributes)
    for (const [k, val] of Object.entries(attrs)) {
      if (!isSizeAttributeKey(k)) continue
      const id = extractRefId(val)
      if (!id || seen.has(id)) continue
      const name = resolveAttributeValue(val, idMap) || id
      seen.set(id, { _id: id, name, initial: name })
    }
  }
  return [...seen.values()]
}

/**
 * Unique material options: prefer product.materialPricing (customized, per-material add-on),
 * else variations + optional product.material.
 * @returns {Array<{ _id: string, name: string, addonPrice?: number }>}
 */
export function buildMaterialOptionsFromProduct(product) {
  const pricingRows = product?.materialPricing
  if (Array.isArray(pricingRows) && pricingRows.length > 0) {
    const out = []
    for (const row of pricingRows) {
      if (row.enabled === false) continue
      const mat = row.material
      if (mat == null || mat === "") continue
      let id = null
      let baseName = "Material"
      if (typeof mat === "object") {
        if (mat.deleted) continue
        const rawId = mat._id ?? mat.id
        if (rawId != null) id = String(rawId)
        if (mat.name != null && String(mat.name).trim()) baseName = String(mat.name).trim()
      } else if (typeof mat === "string" && /^[0-9a-fA-F]{24}$/.test(mat.trim())) {
        id = mat.trim()
      }
      if (!id) continue
      const p = row.price
      const price = p != null && p !== "" && Number.isFinite(Number(p)) ? Math.round(Number(p)) : 0
      if (!Number.isFinite(price) || price < 0) continue
      out.push({
        _id: id,
        name: baseName,
        addonPrice: price,
      })
    }
    out.sort((a, b) => (a.name || "").localeCompare(b.name || ""))
    if (out.length) return out
  }

  const idMap = buildIdLookupMap(product)
  const seen = new Map()
  const variations = product?.variations
  if (Array.isArray(variations)) {
    for (const v of variations) {
      const attrs = attrsToPlainObject(v.attributes)
      for (const [k, val] of Object.entries(attrs)) {
        if (!isMaterialAttributeKey(k)) continue
        const id = extractRefId(val)
        if (!id || seen.has(id)) continue
        const name = resolveAttributeValue(val, idMap) || id
        seen.set(id, { _id: id, name })
      }
    }
  }
  const m = product?.material
  if (m && typeof m === "object" && m._id != null) {
    const id = String(m._id)
    if (!seen.has(id)) {
      const name = m.name != null ? String(m.name).trim() : id
      seen.set(id, { _id: id, name })
    }
  }
  return [...seen.values()]
}

/**
 * Per-size stock for variation products (sum matching variants; unlimited when any variant has stock -1).
 * For color-only variants, pass `selectedOption` (PDP colour row) so stock comes from that variant's sizeStock.
 */
export function buildVariationSizeStockByIndex(product, sizeOptions, selectedOption) {
  const variations = product?.variations
  if (!Array.isArray(variations) || !sizeOptions?.length) return []

  if (productVariationsAreColorOnly(product)) {
    const wantId = selectedOption?.linkedVariantId || selectedOption?._id
    let v = wantId
      ? variations.find((x) => String(x._id) === String(wantId))
      : null
    if (!v && selectedOption?.attributes) {
      const a = attrsToPlainObject(selectedOption.attributes)
      const cid = getColorIdFromVariantAttributes(a)
      if (cid) {
        v = variations.find((x) => {
          const xa = attrsToPlainObject(x.attributes)
          return String(getColorIdFromVariantAttributes(xa) || "") === String(cid)
        })
      }
    }
    if (!v) v = variations[0]
    if (!v) return sizeOptions.map(() => ({ available: false, left: 0 }))

    /**
     * Prefer per-colour sizeStock from the PDP swatch row (normalizeApiVariation copies it from the variant).
     * That matches the admin Variations tab. Falling back only to `v.sizeStock` avoids wrong colour when
     * variant lookup/order is ambiguous (e.g. fallback to variations[0]).
     */
    const rows =
      Array.isArray(selectedOption?.sizeStock) && selectedOption.sizeStock.length > 0
        ? selectedOption.sizeStock
        : v.sizeStock || []
    /** By Size document id (after extractRefId). */
    const map = new Map()
    /**
     * By canonical apparel key (XXS, S, M, …) when variant.sizeStock refs differ from product.sizes ids
     * but describe the same label (common with duplicate Size docs or legacy data).
     */
    const stockByLabelKey = new Map()
    for (const row of rows) {
      const id = extractRefId(row?.size)
      if (!id) continue
      const n = Number(row.stock)
      map.set(id, n)
      const sizeDoc = Array.isArray(product?.sizes)
        ? product.sizes.find((s) => String(s._id ?? s.id) === String(id))
        : null
      let labelKey = null
      if (sizeDoc) {
        labelKey = normalizeToApparelSizeKey(getSizeDisplayLabel(sizeDoc))
      } else if (row.size && typeof row.size === "object" && (row.size.name || row.size.initial)) {
        labelKey = normalizeToApparelSizeKey(
          getSizeDisplayLabel({
            name: row.size.name,
            initial: row.size.initial,
          }),
        )
      }
      if (labelKey) stockByLabelKey.set(labelKey, n)
    }

    /** Legacy: no per-size rows but variant has aggregate stock — treat every catalog size as sellable. */
    if (rows.length === 0) {
      const agg = Number(v.stock)
      if (agg === -1) {
        return sizeOptions.map((opt) =>
          opt._id == null || opt._id === "" ? { available: false, left: null } : { available: true, left: null },
        )
      }
      if (Number.isFinite(agg) && agg > 0) {
        return sizeOptions.map((opt) =>
          opt._id == null || opt._id === "" ? { available: false, left: null } : { available: true, left: null },
        )
      }
    }

    return sizeOptions.map((opt) => {
      if (opt._id == null || opt._id === "") return { available: false, left: null }
      const target = String(opt._id)
      let n = map.get(target)
      if (n == null) {
        const optKey = normalizeToApparelSizeKey(getSizeDisplayLabel(opt))
        if (optKey != null && stockByLabelKey.has(optKey)) {
          n = stockByLabelKey.get(optKey)
        }
      }
      if (n == null) return { available: false, left: 0 }
      if (n === -1) return { available: true, left: null }
      if (!Number.isFinite(n) || n <= 0) return { available: false, left: 0 }
      return { available: true, left: n <= 5 ? n : null }
    })
  }

  return sizeOptions.map((opt) => {
    const target = String(opt._id)
    let sum = 0
    let any = false
    let unlimited = false
    for (const v of variations) {
      const sid = getSizeIdFromVariantAttributes(v.attributes)
      if (sid !== target) continue
      any = true
      const n = v.stock
      if (n === -1 || n == null) {
        unlimited = true
        break
      }
      if (Number.isFinite(Number(n))) sum += Number(n)
    }
    if (!any) return { available: false, left: 0 }
    if (unlimited) return { available: true, left: null }
    if (sum <= 0) return { available: false, left: 0 }
    return { available: true, left: sum <= 5 ? sum : null }
  })
}

/**
 * Pick storefront color option (normalized variant) matching size + material + color ids.
 */
export function findVariantOptionByAttributes(product, { sizeId, materialId, colorId }) {
  const options = buildColorOptionsFromProduct(product)
  const vars = product?.variations
  if (!Array.isArray(vars) || !options.length) return null
  const wantS = sizeId != null ? String(sizeId) : null
  const wantM = materialId != null ? String(materialId) : null
  const wantC = colorId != null ? String(colorId) : null
  const colorOnly = productVariationsAreColorOnly(product)
  for (const v of vars) {
    const attrs = attrsToPlainObject(v.attributes)
    const s = getSizeIdFromVariantAttributes(attrs)
    const m = getMaterialIdFromVariantAttributes(attrs)
    const c = getColorIdFromVariantAttributes(attrs)
    if (wantS != null && s != null && wantS !== s) continue
    if (!colorOnly && wantS != null && s == null) continue
    if (wantM && m && m !== wantM) continue
    if (wantM && !m) continue
    if (wantC && c !== wantC) continue
    const id = String(v._id)
    const found = options.find((o) => String(o._id) === id)
    if (found) return found
  }
  return null
}

export function productVariationsDefineMaterial(product) {
  const vars = product?.variations
  if (!Array.isArray(vars) || vars.length === 0) return false
  return vars.some((v) => {
    const a = attrsToPlainObject(v?.attributes)
    return Object.keys(a).some((k) => k.toLowerCase().includes("material"))
  })
}

function normalizeLegacyColor(v, idMap) {
  if (!v || typeof v !== "object") return null
  const id = v._id ?? v.id
  if (id == null) return null
  const sid = String(id)
  const img = v.image ?? v.primaryImage ?? v.images?.[0]
  const imageUrl = img && String(img).trim() ? String(img).trim() : null
  let name = v.name ?? v.label ?? ""
  if (!name && idMap?.has(sid)) name = idMap.get(sid)
  return {
    _id: sid,
    name: name || "",
    code: v.code ?? "",
    image: imageUrl,
    images: imageUrl ? [imageUrl] : [],
    isVariation: false,
  }
}

/** Swatch image from enriched attribute objects { name, image } when variant has no primaryImage. */
function firstImageFromAttributes(attrs) {
  const plain = attrsToPlainObject(attrs)
  if (!plain || typeof plain !== "object") return null
  for (const val of Object.values(plain)) {
    if (!val || typeof val !== "object" || Array.isArray(val)) continue
    const img = val.image ?? val.primaryImage
    if (img != null && String(img).trim()) return String(img).trim()
  }
  return null
}

/** Prefer catalog color hex/code from enriched attributes for swatch fill. */
function colorCodeFromAttributes(attrs) {
  const plain = attrsToPlainObject(attrs)
  if (!plain || typeof plain !== "object") return ""
  for (const val of Object.values(plain)) {
    if (!val || typeof val !== "object" || Array.isArray(val)) continue
    const c = val.code
    if (c != null && String(c).trim()) return String(c).trim()
  }
  return ""
}

function normalizeApiVariation(v, idMap) {
  if (!v || typeof v !== "object") return null
  const id = v._id ?? v.id
  if (id == null) return null
  const attrs = attrsToPlainObject(v.attributes)
  const rawImages = Array.isArray(v.images)
    ? v.images.map((x) => (x != null && String(x).trim() ? String(x).trim() : null)).filter(Boolean)
    : []
  const primaryRaw = v.primaryImage && String(v.primaryImage).trim() ? String(v.primaryImage).trim() : null
  const orderedGallery = []
  const pushUnique = (u) => {
    if (!u || orderedGallery.includes(u)) return
    orderedGallery.push(u)
  }
  if (primaryRaw) pushUnique(primaryRaw)
  rawImages.forEach(pushUnique)
  const fromAttrs = firstImageFromAttributes(attrs)
  if (orderedGallery.length === 0 && fromAttrs) pushUnique(fromAttrs)
  const imageUrl = orderedGallery[0] ?? null
  const attrCode = colorCodeFromAttributes(attrs)
  const displayName = variationDisplayName(attrs, idMap)
  const swatchOnly = variationSwatchLabel(attrs, idMap)
  return {
    _id: String(id),
    name: displayName,
    /** Colour row only — no size (e.g. "White"); empty if attributes are size-only */
    swatchLabel: swatchOnly,
    code: attrCode || v.sku || "",
    image: imageUrl,
    /** All variant image URLs (primary first) for PDP gallery */
    images: orderedGallery,
    isVariation: true,
    price: v.price,
    discountedPrice: v.discountedPrice != null ? v.discountedPrice : null,
    stock: v.stock,
    isOutOfStock: Boolean(v.isOutOfStock),
    attributes: attrs,
    sizeStock: Array.isArray(v.sizeStock) ? v.sizeStock : [],
  }
}

/**
 * @param {object | null | undefined} product
 * @returns {Array<{ _id: string, name: string, code: string, image: string | null, isVariation: boolean, ... }>}
 */
export function buildColorOptionsFromProduct(product) {
  if (!product) return []
  const idMap = buildIdLookupMap(product)
  const variations = product.variations
  if (Array.isArray(variations) && variations.length > 0) {
    const opts = variations.map((v) => normalizeApiVariation(v, idMap)).filter(Boolean)
    opts.sort((a, b) => {
      const va = variations.find((x) => String(x._id) === String(a._id))
      const vb = variations.find((x) => String(x._id) === String(b._id))
      const ao = va != null && Number.isFinite(Number(va.sortOrder)) ? Number(va.sortOrder) : 0
      const bo = vb != null && Number.isFinite(Number(vb.sortOrder)) ? Number(vb.sortOrder) : 0
      if (ao !== bo) return ao - bo
      return String(a.name || "").localeCompare(String(b.name || ""), undefined, { numeric: true })
    })
    return opts
  }
  const colors = product.colors ?? product.variants ?? []
  const arr = Array.isArray(colors) ? colors : []
  return arr.map((v) => normalizeLegacyColor(v, idMap)).filter(Boolean)
}

export function productVariationsDefineSize(product) {
  const vars = product?.variations
  if (!Array.isArray(vars) || vars.length === 0) return false
  if (productVariationsAreColorOnly(product)) return true
  return vars.some((v) => {
    const a = attrsToPlainObject(v?.attributes)
    return Object.keys(a).some((k) => k.toLowerCase().includes("size"))
  })
}

export function pickDefaultColorOption(product, options) {
  if (!options?.length) return null
  /** Variation PDP: first option after ascending sort (sortOrder → name) — not admin defaultVariant. */
  if (options.every((o) => o.isVariation)) {
    return options[0]
  }
  const raw = product?.defaultVariant
  const defId = raw && typeof raw === "object" ? raw._id ?? raw.id : raw
  if (defId != null) {
    const found = options.find((o) => String(o._id) === String(defId))
    if (found) return found
  }
  return options[0]
}

/**
 * True when the PDP should show the product-level gallery (main + all product images).
 * Matches the default colour: same colour id as the first sorted option when attributes have colour;
 * otherwise same option id (legacy / size-only rows).
 */
export function isDefaultColorSelection(product, selected, colorOptions) {
  if (!selected || !colorOptions?.length) return true
  if (selected.isProductDefaultSwatch) return true
  const def = pickDefaultColorOption(product, colorOptions)
  if (!def) return false
  const defAttrs = def.attributes
  const selAttrs = selected.attributes
  const defColor = defAttrs ? getColorIdFromVariantAttributes(attrsToPlainObject(defAttrs)) : null
  const selColor = selAttrs ? getColorIdFromVariantAttributes(attrsToPlainObject(selAttrs)) : null
  if (defColor != null && selColor != null) {
    return String(defColor) === String(selColor)
  }
  return String(selected._id) === String(def._id)
}

/** Ordered unique URLs: product mainImage first, then every entry in product.images. */
export function buildProductPdpGalleryImages(product) {
  if (!product || typeof product !== "object") return []
  const out = []
  const add = (u) => {
    if (u == null || u === "") return
    const s = String(u).trim()
    if (!s || out.includes(s)) return
    out.push(s)
  }
  const main = product.mainImage || (Array.isArray(product.images) && product.images.length ? product.images[0] : null)
  if (main) add(main)
  if (Array.isArray(product.images)) {
    for (const u of product.images) add(u)
  }
  return out
}

/**
 * Full gallery for a non-default colour: primary + images from every variant row with the same colour id
 * (all sizes), stable order by sortOrder then createdAt — same URLs deduped.
 */
export function buildVariationPdpGalleryImages(product, selected) {
  if (!product || !selected?.isVariation) return []
  const vars = product.variations
  if (!Array.isArray(vars) || vars.length === 0) return []

  const selAttrs = attrsToPlainObject(selected.attributes)
  const colorId = getColorIdFromVariantAttributes(selAttrs)

  const rows =
    colorId != null
      ? vars.filter((v) => {
          const a = attrsToPlainObject(v.attributes)
          return getColorIdFromVariantAttributes(a) === colorId
        })
      : vars.filter((v) => String(v._id) === String(selected._id))

  rows.sort((a, b) => {
    const ao = Number.isFinite(Number(a.sortOrder)) ? Number(a.sortOrder) : 0
    const bo = Number.isFinite(Number(b.sortOrder)) ? Number(b.sortOrder) : 0
    if (ao !== bo) return ao - bo
    const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0
    const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0
    return ta - tb
  })

  const out = []
  const add = (u) => {
    if (u == null || u === "") return
    const s = String(u).trim()
    if (!s || out.includes(s)) return
    out.push(s)
  }

  for (const v of rows) {
    if (v.primaryImage != null && String(v.primaryImage).trim()) add(v.primaryImage)
    if (Array.isArray(v.images)) {
      for (const u of v.images) add(u)
    }
  }

  if (Array.isArray(selected.images)) {
    for (const u of selected.images) add(u)
  }
  if (selected.image) add(selected.image)

  return out
}

/** Synthetic swatch id: product main image + default colour label, cart uses linkedVariantId. */
export const PDP_DEFAULT_COLOR_SWATCH_ID = "__pdp_default_color__"

function firstNonEmptyUrl(...candidates) {
  for (const u of candidates) {
    if (u == null || u === "") continue
    const s = String(u).trim()
    if (s) return s
  }
  return null
}

/**
 * PDP colour row: [default — product/hero image for the first colour, selected by default] + [every variation swatch].
 * Image source order: product.mainImage → product.images[0] → first variant image → raw variation row primaryImage.
 */
export function buildDisplayColorOptionsWithDefaultSwatch(product) {
  const raw = buildColorOptionsFromProduct(product)
  if (!product || raw.length === 0) return raw

  const hasVariationRows = Array.isArray(product.variations) && product.variations.length > 0
  if (!hasVariationRows) return raw
  if (!raw.every((o) => o.isVariation)) return raw

  const first = raw[0]
  const rawRow = product.variations.find((v) => String(v._id) === String(first._id))

  const main = firstNonEmptyUrl(
    product.mainImage,
    Array.isArray(product.images) && product.images.length ? product.images[0] : null,
    first.image,
    Array.isArray(first.images) && first.images.length ? first.images[0] : null,
    rawRow?.primaryImage,
    Array.isArray(rawRow?.images) && rawRow.images.length ? rawRow.images[0] : null,
  )

  if (!main) return raw

  const synthetic = {
    _id: PDP_DEFAULT_COLOR_SWATCH_ID,
    isProductDefaultSwatch: true,
    isVariation: true,
    swatchLabel: first.swatchLabel ?? first.name,
    name: first.name,
    code: first.code ?? "",
    image: main,
    images: buildProductPdpGalleryImages(product),
    attributes: first.attributes ? { ...attrsToPlainObject(first.attributes) } : {},
    price: first.price,
    discountedPrice: first.discountedPrice,
    discountPercentage: first.discountPercentage,
    stock: first.stock,
    isOutOfStock: first.isOutOfStock,
    linkedVariantId: first._id,
  }

  /** Default swatch first, then all variation rows (each colour/size combo as returned by the API). */
  return [synthetic, ...raw]
}

/**
 * When the PDP prepends a synthetic default swatch, the real first variant (second thumbnail)
 * shares the same colour as the default, so `isDefaultColorSelection` is still true — but the
 * gallery should use that variant's images (thumbnails), not the product-only gallery.
 */
export function isFirstRealVariantSelectedWithSyntheticDefaultSwatch(
  product,
  selected,
  colorOptions
) {
  if (!selected?.isVariation || selected.isProductDefaultSwatch) return false
  if (!product || !colorOptions?.length) return false
  const display = buildDisplayColorOptionsWithDefaultSwatch(product)
  if (!display.length || !display[0]?.isProductDefaultSwatch) return false
  const firstReal = colorOptions[0]
  return firstReal != null && String(selected._id) === String(firstReal._id)
}

/** Cart / checkout must use real ProductVariant id, not the synthetic PDP swatch id. */
export function resolveCartVariantForPdp(selected) {
  if (!selected) return null
  if (selected.isProductDefaultSwatch && selected.linkedVariantId) {
    const id = selected.linkedVariantId
    return { ...selected, _id: id, id }
  }
  return selected
}

/**
 * Enabled print sides from product.printSidePricing (admin add-on per unit).
 * @returns {Array<{ _id: string, name: string, addonPrice: number }>}
 */
export function buildPrintSideOptionsFromProduct(product) {
  const rows = product?.printSidePricing
  if (!Array.isArray(rows)) return []
  const out = []
  for (const row of rows) {
    // Admin saves explicit `enabled: false`; treat missing/undefined as on (legacy rows).
    if (row.enabled === false) continue
    const ps = row.printSide
    if (ps == null || ps === "") continue

    let id = null
    let sortOrder = 0
    let name = "Print side"

    if (typeof ps === "string") {
      const t = ps.trim()
      if (/^[0-9a-fA-F]{24}$/.test(t)) id = t
    } else if (typeof ps === "object") {
      if (ps.deleted) continue
      const rawId = ps._id ?? ps.id
      if (rawId != null) id = String(rawId)
      if (ps.name != null && String(ps.name).trim()) name = String(ps.name).trim()
      sortOrder = ps.sortOrder ?? 0
    }

    if (!id) continue

    const price = row.price != null && row.price !== "" ? Number(row.price) : 0
    if (!Number.isFinite(price) || price < 0) continue
    out.push({
      _id: String(id),
      name,
      addonPrice: Math.round(price),
      sortOrder,
    })
  }
  out.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name))
  return out
}

/** Prefer “Front Side” by name; else first option whose name starts with “Front”; else first in list. */
export function getDefaultPrintSideId(options) {
  if (!Array.isArray(options) || options.length === 0) return null
  const norm = (s) => String(s || "").trim().toLowerCase()
  const exact = options.find((o) => norm(o.name) === "front side")
  if (exact?._id != null) return String(exact._id)
  const startsFront = options.find((o) => /^front\b/i.test(String(o.name || "").trim()))
  if (startsFront?._id != null) return String(startsFront._id)
  return String(options[0]._id)
}

/** Id of the Front print side that must stay selected (same name rules as default, without list fallback). */
export function getNonDeselectableFrontPrintSideId(options) {
  if (!Array.isArray(options) || options.length === 0) return null
  const norm = (s) => String(s || "").trim().toLowerCase()
  const exact = options.find((o) => norm(o.name) === "front side")
  if (exact?._id != null) return String(exact._id)
  const startsFront = options.find((o) => /^front\b/i.test(String(o.name || "").trim()))
  return startsFront?._id != null ? String(startsFront._id) : null
}
