/**
 * Resolve image URL for next/image (must be full URL for remote patterns).
 * Handles relative backend paths and absolute URLs (Cloudinary, etc.).
 * For /uploads/* paths, returns relative URL so they load via frontend proxy (same-origin).
 */
export function getImageSrc(url) {
  if (!url || typeof url !== "string") return null
  const trimmed = url.trim()
  if (!trimmed) return null
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed
  const path = trimmed.startsWith("/") ? trimmed : "/" + trimmed
  // Use relative path for uploads so they load via next.config rewrites (same-origin, avoids CORS)
  if (path.startsWith("/uploads/")) return path
  const apiUrl = (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_API_URL) || "http://localhost:8080/api"
  const base = String(apiUrl).replace(/\/api\/?$/, "") || "http://localhost:8080"
  return base + path
}
