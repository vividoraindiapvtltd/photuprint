/**
 * Server-only: fetches footer sections and theme from the backend.
 * Used by the homepage Server Component to enable SSR for the footer.
 */

const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api"
const websiteId = process.env.NEXT_PUBLIC_WEBSITE_ID

const headers = {
  "x-website-id": websiteId || "",
  "Content-Type": "application/json",
}

/**
 * @returns {Promise<{ sections: Array, theme: Object }>}
 */
export async function getFooterData() {
  const sections = []
  let theme = {}

  if (!websiteId) {
    console.warn("[footer-data] NEXT_PUBLIC_WEBSITE_ID not set; skipping footer fetch")
    return { sections, theme }
  }

  try {
    const res = await fetch(`${backendUrl}/footer-sections/public`, {
      headers,
      next: { revalidate: 60 },
    })

    if (res.ok) {
      const data = await res.json()
      if (Array.isArray(data.sections)) {
        sections.push(...data.sections)
      }
      if (data.theme && typeof data.theme === "object") {
        theme = data.theme
      }
    }
  } catch (e) {
    console.error("[footer-data] Failed to fetch footer sections:", e.message)
  }

  return { sections, theme }
}
