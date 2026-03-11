// Server-side API route that proxies carousel public data from the backend
// Returns { slides: [], layout: "fullWidth", ... } on failure so the storefront degrades gracefully
import { NextResponse } from "next/server"

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
    const host = request.headers.get("host") || request.headers.get("x-forwarded-host")
    if (host) headers["x-forwarded-host"] = host
  }

  try {
    const { searchParams } = new URL(request.url)
    const key = searchParams.get("key") || "hero"
    const url = `${backendUrl}/carousel/public?key=${encodeURIComponent(key)}`
    const response = await fetch(url, {
      headers,
      next: { revalidate: 60 },
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[API Route] Carousel fetch failed:", response.status, errorText)
      return NextResponse.json({
        slides: [],
        layout: "fullWidth",
        name: "",
        autoplay: true,
        autoplayInterval: 5,
        showArrows: true,
        showDots: true,
        pauseOnHover: true,
      })
    }

    const data = await response.json()
    return NextResponse.json({
      slides: Array.isArray(data.slides) ? data.slides : [],
      layout: data.layout || "fullWidth",
      name: data.name ?? "",
      showDisplayName: data.showDisplayName !== false,
      slideEffect: data.slideEffect || "fade",
      isActive: data.isActive !== false,
      autoplay: data.autoplay !== false,
      autoplayInterval: data.autoplayInterval ?? 5,
      transitionDuration: Math.max(0.2, Math.min(2, Number(data.transitionDuration) || 0.5)),
      loop: data.loop !== false,
      showArrows: data.showArrows !== false,
      arrowsPosition: data.arrowsPosition || "inside",
      showDots: data.showDots !== false,
      dotsOutside: !!data.dotsOutside,
      pauseOnHover: data.pauseOnHover !== false,
      showSlideTitle: data.showSlideTitle !== false,
      showSlideSubtitle: data.showSlideSubtitle !== false,
      captionPosition: data.captionPosition || "overlay",
      imageFit: data.imageFit || "cover",
      backgroundColor: data.backgroundColor || "#111827",
      displayNameColor: data.displayNameColor || "#ffffff",
      displayNameFontSize: data.displayNameFontSize || "20px",
      captionColor: data.captionColor || "#ffffff",
      captionSubtitleColor: data.captionSubtitleColor || "#e5e7eb",
      captionTitleFontSize: data.captionTitleFontSize || "18px",
      captionSubtitleFontSize: data.captionSubtitleFontSize || "14px",
      captionOverlayOpacity: Math.max(0, Math.min(1, Number(data.captionOverlayOpacity) ?? 0.8)),
    })
  } catch (error) {
    clearTimeout(timeoutId)
    if (error.name === "AbortError") {
      console.error("[API Route] Carousel: request timeout after", FETCH_TIMEOUT_MS, "ms")
    } else {
      console.error("[API Route] Carousel error:", error.message)
    }
    return NextResponse.json({
      slides: [],
      layout: "fullWidth",
      name: "",
      autoplay: true,
      autoplayInterval: 5,
      showArrows: true,
      showDots: true,
      pauseOnHover: true,
    })
  }
}
