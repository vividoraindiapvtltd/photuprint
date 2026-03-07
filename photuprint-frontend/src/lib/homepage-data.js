/**
 * Server-only: fetches homepage sections and fallback products from the backend.
 * Used by the homepage Server Component to enable SSR.
 */

const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api"
const websiteId = process.env.NEXT_PUBLIC_WEBSITE_ID

const headers = {
  "x-website-id": websiteId || "",
  "Content-Type": "application/json",
}

/**
 * @returns {Promise<{ sections: Array, fallbackProducts: Array }>}
 */
export async function getHomepageData() {
  const sections = []
  let fallbackProducts = []

  if (!websiteId) {
    console.warn("[homepage-data] NEXT_PUBLIC_WEBSITE_ID not set; skipping sections fetch")
    return { sections, fallbackProducts }
  }

  try {
    const res = await fetch(`${backendUrl}/homepage-sections`, {
      headers,
      cache: "no-store",
    })

    if (res.ok) {
      const data = await res.json()
      if (data?.sections && Array.isArray(data.sections)) {
        const active = data.sections.filter((s) => s.isActive !== false && s.status === "active").sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0))
        sections.push(...active)
      }
    }
  } catch (e) {
    console.error("[homepage-data] Failed to fetch homepage sections:", e.message)
  }

  if (sections.length === 0) {
    try {
      const res = await fetch(`${backendUrl}/products?showInactive=false&includeDeleted=false&limit=12`, { headers, cache: "no-store" })
      if (res.ok) {
        const data = await res.json()
        const list = data.products ?? data
        fallbackProducts = Array.isArray(list) ? list : []
      }
    } catch (e) {
      console.error("[homepage-data] Fallback products fetch failed:", e.message)
    }
  }

  return { sections, fallbackProducts }
}
