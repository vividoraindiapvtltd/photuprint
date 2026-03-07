// Server-side API route that proxies footer-sections from the backend
// Uses public endpoint - no auth required
// Returns { sections: [] } on failure so the storefront footer degrades gracefully
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

const FETCH_TIMEOUT_MS = 8000

export async function GET(request) {
  const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api"
  const websiteId = process.env.NEXT_PUBLIC_WEBSITE_ID

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  const headers = { "Content-Type": "application/json" }
  if (websiteId) {
    headers["x-website-id"] = websiteId
  } else {
    // Fallback: forward host so backend can resolve tenant by domain (e.g. localhost -> first website in dev)
    const host = request.headers.get("host") || request.headers.get("x-forwarded-host")
    if (host) headers["x-forwarded-host"] = host
  }

  try {
    const response = await fetch(`${backendUrl}/footer-sections/public`, {
      headers,
      cache: "no-store",
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[API Route] Footer sections fetch failed:", response.status, errorText)
      return NextResponse.json({ sections: [], theme: {} })
    }

    const data = await response.json()
    const sections = Array.isArray(data.sections) ? data.sections : []
    const theme = data.theme && typeof data.theme === "object" ? data.theme : {}
    return NextResponse.json({ sections, theme })
  } catch (error) {
    clearTimeout(timeoutId)
    if (error.name === "AbortError") {
      console.error("[API Route] Footer sections: request timeout after", FETCH_TIMEOUT_MS, "ms")
    } else {
      console.error("[API Route] Footer sections error:", error.message)
    }
    return NextResponse.json({ sections: [], theme: {} })
  }
}
