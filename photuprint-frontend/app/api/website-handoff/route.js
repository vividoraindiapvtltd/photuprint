import { NextResponse } from "next/server"

/** Must match `src/utils/api.js` — client reads this cookie and sends `X-Website-Id` on API calls. */
const WEBSITE_ID_COOKIE = "photuprint_x_website_id"

const MAX_AGE_SEC = 60 * 60 * 24 * 7

function parseAllowedOrigins() {
  const raw = process.env.WEBSITE_HANDOFF_ALLOWED_ORIGINS || ""
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
}

function withCors(request, response) {
  const origin = request.headers.get("origin")
  const allowed = parseAllowedOrigins()
  if (origin && allowed.includes(origin)) {
    response.headers.set("Access-Control-Allow-Origin", origin)
    response.headers.set("Access-Control-Allow-Credentials", "true")
  }
  response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS")
  response.headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, X-Website-Id, x-website-id",
  )
  return response
}

export async function OPTIONS(request) {
  return withCors(request, new NextResponse(null, { status: 204 }))
}

/**
 * Cross-origin handoff (e.g. Vividora): POST with `X-Website-Id` and JSON `{ path: "/tshirts" }`.
 * Sets a first-party cookie so the shop sends the same tenant on axios `/api/*` requests.
 */
export async function POST(request) {
  const allowed = parseAllowedOrigins()
  if (allowed.length === 0) {
    return NextResponse.json(
      { error: "WEBSITE_HANDOFF_ALLOWED_ORIGINS is not configured" },
      { status: 503 },
    )
  }

  const origin = request.headers.get("origin")
  if (!origin || !allowed.includes(origin)) {
    return withCors(
      request,
      NextResponse.json({ error: "Origin not allowed" }, { status: 403 }),
    )
  }

  const websiteId = (
    request.headers.get("x-website-id") ||
    request.headers.get("X-Website-Id") ||
    ""
  ).trim()
  if (!websiteId) {
    return withCors(
      request,
      NextResponse.json({ error: "Missing X-Website-Id header" }, { status: 400 }),
    )
  }

  let body
  try {
    body = await request.json()
  } catch {
    return withCors(
      request,
      NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }),
    )
  }

  const path = typeof body.path === "string" ? body.path.trim() : ""
  if (
    !path.startsWith("/") ||
    path.includes("//") ||
    /[\s\r\n]/.test(path) ||
    path.toLowerCase().includes("http")
  ) {
    return withCors(request, NextResponse.json({ error: "Invalid path" }, { status: 400 }))
  }

  const res = NextResponse.json({ ok: true, redirectPath: path })
  const isProd = process.env.NODE_ENV === "production"
  res.cookies.set(WEBSITE_ID_COOKIE, websiteId, {
    path: "/",
    maxAge: MAX_AGE_SEC,
    sameSite: isProd ? "none" : "lax",
    secure: isProd,
    httpOnly: false,
  })

  return withCors(request, res)
}
