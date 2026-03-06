// Server-side API route that proxies auth/google to the backend
// This ensures X-Website-Id header is always forwarded correctly
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function POST(request) {
  const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api"
  
  // Get website ID from environment variable OR from incoming request header
  const incomingWebsiteId = request.headers.get("x-website-id") || request.headers.get("X-Website-Id")
  const envWebsiteId = process.env.NEXT_PUBLIC_WEBSITE_ID
  const websiteId = incomingWebsiteId || envWebsiteId

  // Debug logging
  console.log("[API Route /auth/google] Incoming x-website-id header:", incomingWebsiteId)
  console.log("[API Route /auth/google] Environment NEXT_PUBLIC_WEBSITE_ID:", envWebsiteId)
  console.log("[API Route /auth/google] Using Website ID:", websiteId)
  console.log("[API Route /auth/google] Backend URL:", backendUrl)

  if (!websiteId) {
    console.error("[API Route /auth/google] Website ID not found in header or environment!")
    return NextResponse.json({ error: "Website ID not configured" }, { status: 500 })
  }

  try {
    const body = await request.json()

    const requestHeaders = {
      "x-website-id": websiteId,
      "Content-Type": "application/json",
    }

    console.log("[API Route /auth/google] Forwarding to backend with headers:", requestHeaders)

    const response = await fetch(`${backendUrl}/auth/google`, {
      method: "POST",
      headers: requestHeaders,
      body: JSON.stringify(body),
      cache: "no-store",
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[API Route] Google auth failed:", response.status, errorText)
      return NextResponse.json(
        { error: "Google authentication failed", details: errorText },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("[API Route] Google auth error:", error.message)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
