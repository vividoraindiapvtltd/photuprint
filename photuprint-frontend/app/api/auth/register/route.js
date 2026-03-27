// Server-side API route that proxies auth/register to the backend
// This ensures X-Website-Id header is always forwarded correctly
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function POST(request) {
  const backendUrl = process.env.API_URL || "http://localhost:8080/api"
  
  // Get website ID from environment variable OR from incoming request header
  const incomingWebsiteId = request.headers.get("x-website-id") || request.headers.get("X-Website-Id")
  const envWebsiteId = process.env.NEXT_PUBLIC_WEBSITE_ID
  const websiteId = incomingWebsiteId || envWebsiteId

  // Debug logging
  console.log("[API Route /auth/register] Incoming x-website-id header:", incomingWebsiteId)
  console.log("[API Route /auth/register] Environment NEXT_PUBLIC_WEBSITE_ID:", envWebsiteId)
  console.log("[API Route /auth/register] Using Website ID:", websiteId)
  console.log("[API Route /auth/register] Backend URL:", backendUrl)

  if (!websiteId) {
    console.error("[API Route /auth/register] Website ID not found in header or environment!")
    return NextResponse.json({ error: "Website ID not configured" }, { status: 500 })
  }

  try {
    const body = await request.json()

    // Verify reCAPTCHA token server-side
    const { captchaToken, ...registrationData } = body
    const recaptchaSecret = process.env.RECAPTCHA_SECRET_KEY
    if (recaptchaSecret && captchaToken) {
      const verifyRes = await fetch("https://www.google.com/recaptcha/api/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `secret=${encodeURIComponent(recaptchaSecret)}&response=${encodeURIComponent(captchaToken)}`,
      })
      const verifyData = await verifyRes.json()
      if (!verifyData.success) {
        return NextResponse.json({ msg: "CAPTCHA verification failed. Please try again." }, { status: 400 })
      }
    } else if (recaptchaSecret && !captchaToken) {
      return NextResponse.json({ msg: "CAPTCHA verification required." }, { status: 400 })
    }

    const requestHeaders = {
      "x-website-id": websiteId,
      "Content-Type": "application/json",
    }

    const response = await fetch(`${backendUrl}/auth/register`, {
      method: "POST",
      headers: requestHeaders,
      body: JSON.stringify(registrationData),
      cache: "no-store",
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[API Route] Register failed:", response.status, errorText)
      return NextResponse.json(
        { error: "Registration failed", details: errorText },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("[API Route] Register error:", error.message)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
