/**
 * Convert a string to a URL-safe slug (lowercase, hyphens, no special chars).
 * @param {string} text
 * @returns {string}
 */
export function slugify(text) {
  if (!text || typeof text !== "string") return ""
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "")
    .replace(/--+/g, "-")
    .replace(/^-+|-+$/g, "")
}

/**
 * Return whether a string looks like a MongoDB ObjectId (24 hex chars).
 * @param {string} value
 * @returns {boolean}
 */
export function isObjectId(value) {
  if (!value || typeof value !== "string") return false
  return /^[a-f0-9]{24}$/i.test(value.trim())
}

/**
 * Get the URL slug for a product. Uses only slug from API or slugified name — never product ID.
 * Product detail URLs must be formed with slug only.
 * @param {{ slug?: string, name?: string, _id?: string, id?: string }} product
 * @returns {string}
 */
export function getProductSlug(product) {
  if (!product) return ""
  if (product.slug && String(product.slug).trim()) return String(product.slug).trim()
  if (product.name) return slugify(product.name)
  return ""
}
