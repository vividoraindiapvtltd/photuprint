/**
 * Server-only: fetches product and category data from the backend.
 * Used by SSR page components for product detail and listing pages.
 */

const backendUrl = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api"
const websiteId = process.env.NEXT_PUBLIC_WEBSITE_ID

const headers = {
  "x-website-id": websiteId || "",
  "Content-Type": "application/json",
}

/**
 * Fetch a single product by slug or ID.
 * @param {string} slugOrId
 * @returns {Promise<Object|null>}
 */
export async function getProductBySlug(slugOrId) {
  if (!slugOrId) return null
  const isObjectId = /^[0-9a-fA-F]{24}$/.test(slugOrId)
  const url = isObjectId ? `${backendUrl}/products/${slugOrId}` : `${backendUrl}/products/slug/${encodeURIComponent(slugOrId)}`
  try {
    const res = await fetch(url, { headers, cache: "no-store" })
    if (!res.ok) return null
    return await res.json()
  } catch (e) {
    console.error("[product-data] Failed to fetch product:", e.message)
    return null
  }
}

/**
 * Fetch products for a category (or all products if no categoryId).
 * @param {string|null} categoryId
 * @returns {Promise<Array>}
 */
export async function getProductsByCategory(categoryId) {
  const params = new URLSearchParams({
    showInactive: "false",
    includeDeleted: "false",
    limit: "24",
  })
  if (categoryId) params.set("categoryId", categoryId)
  try {
    const res = await fetch(`${backendUrl}/products?${params}`, { headers, next: { revalidate: 300 } })
    if (!res.ok) return []
    const data = await res.json()
    return data?.products ?? (Array.isArray(data) ? data : [])
  } catch (e) {
    console.error("[product-data] Failed to fetch products:", e.message)
    return []
  }
}

/**
 * Fetch product slugs for static generation (e.g. generateStaticParams).
 * @param {number} limit
 * @returns {Promise<string[]>}
 */
export async function getProductSlugs(limit = 50) {
  const params = new URLSearchParams({
    showInactive: "false",
    includeDeleted: "false",
    limit: String(limit),
  })
  try {
    const res = await fetch(`${backendUrl}/products?${params}`, { headers, next: { revalidate: 600 } })
    if (!res.ok) return []
    const data = await res.json()
    const list = data?.products ?? (Array.isArray(data) ? data : [])
    return list
      .map((p) => p.slug || p._id || p.id)
      .filter(Boolean)
      .map(String)
      .slice(0, limit)
  } catch (e) {
    console.error("[product-data] Failed to fetch product slugs:", e.message)
    return []
  }
}

/**
 * Fetch all active categories.
 * @returns {Promise<Array>}
 */
export async function getCategories() {
  try {
    const res = await fetch(`${backendUrl}/categories?showInactive=false&includeDeleted=false`, {
      headers,
      next: { revalidate: 300 },
    })
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data) ? data : []
  } catch (e) {
    console.error("[product-data] Failed to fetch categories:", e.message)
    return []
  }
}

/**
 * Fetch subcategories for a category.
 * @param {string} categoryId
 * @returns {Promise<Array>}
 */
export async function getSubcategories(categoryId) {
  if (!categoryId) return []
  try {
    const res = await fetch(`${backendUrl}/subcategories?category=${encodeURIComponent(categoryId)}&showInactive=false&includeDeleted=false`, { headers, next: { revalidate: 300 } })
    if (!res.ok) return []
    const data = await res.json()
    return data?.subcategories ?? (Array.isArray(data) ? data : [])
  } catch (e) {
    console.error("[product-data] Failed to fetch subcategories:", e.message)
    return []
  }
}

/**
 * Resolve a category slug to its ID and name.
 * @param {string} slug
 * @returns {Promise<{ id: string, name: string } | null>}
 */
export async function getCategoryBySlug(slug) {
  if (!slug) return null
  const categories = await getCategories()
  const slugLower = slug.toLowerCase()
  const found = categories.find((c) => {
    const catSlug = (c.slug || c.name || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
    return catSlug === slugLower
  })
  if (!found) return null
  return { id: found._id || found.id, name: found.name }
}
