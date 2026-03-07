// Proxies auth/resend-verification to the backend
// Backend sends a new verification email to the given address
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function POST(request) {
  const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api"
  const websiteId = request.headers.get("x-website-id") || request.headers.get("X-Website-Id") || process.env.NEXT_PUBLIC_WEBSITE_ID

  if (!websiteId) {
    return NextResponse.json({ msg: "Website ID not configured" }, { status: 500 })
  }

  try {
    const body = await request.json()
    const response = await fetch(`${backendUrl}/auth/resend-verification`, {
      method: "POST",
      headers: {
        "x-website-id": websiteId,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    })

    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      return NextResponse.json(data, { status: response.status })
    }
    return NextResponse.json(data)
  } catch (error) {
    console.error("[API] Resend verification error:", error.message)
    return NextResponse.json({ msg: "Failed to resend verification email" }, { status: 500 })
  }
}
