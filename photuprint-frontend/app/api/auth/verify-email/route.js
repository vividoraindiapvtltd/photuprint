// Proxies auth/verify-email to the backend
// Backend validates token, marks email verified, activates account, returns user + token
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function POST(request) {
  const backendUrl = process.env.API_URL || "http://localhost:8080/api"
  const websiteId = request.headers.get("x-website-id") || request.headers.get("X-Website-Id") || process.env.NEXT_PUBLIC_WEBSITE_ID

  if (!websiteId) {
    return NextResponse.json({ msg: "Website ID not configured" }, { status: 500 })
  }

  try {
    const body = await request.json()
    const response = await fetch(`${backendUrl}/auth/verify-email`, {
      method: "POST",
      headers: {
        "x-website-id": websiteId,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    })

    const data = await response.json().catch(() => ({}))
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error("[API] Verify email error:", error.message)
    return NextResponse.json({ msg: "Verification failed" }, { status: 500 })
  }
}
