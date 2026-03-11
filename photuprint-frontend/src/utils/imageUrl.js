/**
 * Resolve image URL for next/image (must be full URL for remote patterns).
 * Handles relative backend paths and absolute URLs (Cloudinary, etc.).
 */
export function getImageSrc(url) {
  if (!url || typeof url !== "string") return null
  const trimmed = url.trim()
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed
  const apiUrl = (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_API_URL) || "http://localhost:8080/api"
  const base = String(apiUrl).replace(/\/api\/?$/, "") || "http://localhost:8080"
  return base + (trimmed.startsWith("/") ? trimmed : "/" + trimmed)
}
