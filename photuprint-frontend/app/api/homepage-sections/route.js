// Server-side API route that proxies homepage-sections from the backend
// This route is publicly accessible — no authentication required
import { NextResponse } from "next/server"

// Disable static caching so homepage sections are always fresh
export const dynamic = "force-dynamic"

export async function GET() {
  const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api"
  const websiteId = process.env.NEXT_PUBLIC_WEBSITE_ID

  console.log("[API Route /homepage-sections] Starting request...")
  console.log("[API Route /homepage-sections] Website ID:", websiteId)
  console.log("[API Route /homepage-sections] Backend URL:", backendUrl)

  if (!websiteId) {
    console.error("[API Route /homepage-sections] Website ID not configured!")
    return NextResponse.json({ error: "Website ID not configured" }, { status: 500 })
  }

  try {
    const requestUrl = `${backendUrl}/homepage-sections`
    const requestHeaders = {
      "x-website-id": websiteId,
      "Content-Type": "application/json",
    }

    console.log("[API Route /homepage-sections] Fetching from:", requestUrl)
    console.log("[API Route /homepage-sections] Headers:", requestHeaders)

    const response = await fetch(requestUrl, {
      headers: requestHeaders,
      cache: "no-store",
    })

    console.log("[API Route /homepage-sections] Response status:", response.status, response.statusText)

    if (!response.ok) {
      let errorText = ""
      let errorData = null

      try {
        errorText = await response.text()
        try {
          errorData = JSON.parse(errorText)
        } catch {
          // Not JSON, use as text
        }
      } catch (e) {
        errorText = `Failed to read error response: ${e.message}`
      }

      console.error("[API Route /homepage-sections] Fetch failed:", {
        status: response.status,
        statusText: response.statusText,
        errorText,
        errorData,
      })

      const errorMessage = errorData?.msg || errorData?.error || errorText || "Failed to fetch homepage sections"

      return NextResponse.json(
        {
          error: "Failed to fetch homepage sections",
          details: errorMessage,
          status: response.status,
        },
        { status: response.status }
      )
    }

    const data = await response.json()
    console.log("[API Route /homepage-sections] Success! Sections count:", data?.sections?.length || 0)
    return NextResponse.json(data)
  } catch (error) {
    console.error("[API Route /homepage-sections] Error:", {
      message: error.message,
      stack: error.stack,
      name: error.name,
    })
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error.message,
      },
      { status: 500 }
    )
  }
}
