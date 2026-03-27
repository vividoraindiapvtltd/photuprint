/**
 * Server-only: fetches active categories from the backend.
 * Used by the homepage Server Component to enable SSR for the categories section.
 */

const backendUrl = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api"
const websiteId = process.env.NEXT_PUBLIC_WEBSITE_ID

const headers = {
  "x-website-id": websiteId || "",
  "Content-Type": "application/json",
}

/**
 * @returns {Promise<Array>}
 */
export async function getCategoriesData() {
  if (!websiteId) {
    console.warn("[categories-data] NEXT_PUBLIC_WEBSITE_ID not set; skipping categories fetch")
    return []
  }

  try {
    const res = await fetch(`${backendUrl}/categories?showInactive=false&includeDeleted=false`, {
      headers,
      next: { revalidate: 60 },
    })

    if (res.ok) {
      const data = await res.json()
      return Array.isArray(data) ? data : []
    }
  } catch (e) {
    console.error("[categories-data] Failed to fetch categories:", e.message)
  }

  return []
}
