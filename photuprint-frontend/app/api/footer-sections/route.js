// Server-side API route that proxies footer-sections from the backend
// Uses public endpoint - no auth required
// Returns { sections: [] } on failure so the storefront footer degrades gracefully
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

const FETCH_TIMEOUT_MS = 8000

export async function GET() {
  const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api"
  const websiteId = process.env.NEXT_PUBLIC_WEBSITE_ID

  if (!websiteId) {
    console.warn("[API Route] Footer sections: NEXT_PUBLIC_WEBSITE_ID not configured")
    return NextResponse.json({ sections: [] })
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const response = await fetch(`${backendUrl}/footer-sections/public`, {
      headers: {
        "x-website-id": websiteId,
        "Content-Type": "application/json",
      },
      cache: "no-store",
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[API Route] Footer sections fetch failed:", response.status, errorText)
      return NextResponse.json({ sections: [] })
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    clearTimeout(timeoutId)
    if (error.name === "AbortError") {
      console.error("[API Route] Footer sections: request timeout after", FETCH_TIMEOUT_MS, "ms")
    } else {
      console.error("[API Route] Footer sections error:", error.message)
    }
    return NextResponse.json({ sections: [] })
  }
}
