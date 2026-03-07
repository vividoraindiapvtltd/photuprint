import { NextResponse } from "next/server"

const backendBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api"

/**
 * Public proxy for GET product by slug (no auth).
 * Backend may return 401 when browser sends expired token; calling from server avoids that.
 */
export async function GET(request, context) {
  const params = await (context.params || Promise.resolve({}))
  const slug = params?.slug
  if (!slug) {
    return NextResponse.json({ error: "Slug required" }, { status: 400 })
  }
  try {
    const url = `${backendBase}/products/slug/${encodeURIComponent(slug)}`
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.NEXT_PUBLIC_WEBSITE_ID && { "x-website-id": process.env.NEXT_PUBLIC_WEBSITE_ID }),
      },
      cache: "no-store",
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return NextResponse.json(data || { error: "Product not found" }, { status: res.status })
    }
    return NextResponse.json(data)
  } catch (err) {
    console.error("[api/products/slug] proxy error:", err)
    return NextResponse.json({ error: "Failed to fetch product" }, { status: 502 })
  }
}
