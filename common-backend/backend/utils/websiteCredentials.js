import Website from "../models/website.model.js"

const cache = new Map()
const CACHE_TTL_MS = 5 * 60 * 1000

function isSet(val) {
  return typeof val === "string" && val.trim().length > 0
}

/** Only the `cloudinary://...` form works with the SDK; ignore stored dashboard/https URLs so env can apply. */
function mergedCloudinaryUrl(siteRaw, envRaw) {
  const s = typeof siteRaw === "string" ? siteRaw.trim() : ""
  const e = typeof envRaw === "string" ? envRaw.trim() : ""
  if (s.startsWith("cloudinary://")) return s
  if (e.startsWith("cloudinary://")) return e
  return ""
}

/**
 * Load credentials for a website, with in-memory cache.
 * Falls back to process.env when per-website values are empty.
 */
export async function getWebsiteCredentials(websiteId) {
  if (!websiteId) return getEnvFallback()

  const key = String(websiteId)
  const cached = cache.get(key)
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.creds

  try {
    const site = await Website.findById(websiteId)
      .select("razorpayKeyId razorpayKeySecret cloudinaryUrl cloudinaryCloudName cloudinaryApiKey cloudinaryApiSecret")
      .lean()
    if (!site) return getEnvFallback()

    const creds = {
      razorpayKeyId: isSet(site.razorpayKeyId) ? site.razorpayKeyId.trim() : (process.env.RAZORPAY_KEY_ID || "").trim(),
      razorpayKeySecret: isSet(site.razorpayKeySecret) ? site.razorpayKeySecret.trim() : (process.env.RAZORPAY_KEY_SECRET || "").trim(),
      cloudinaryUrl: mergedCloudinaryUrl(site.cloudinaryUrl, process.env.CLOUDINARY_URL),
      cloudinaryCloudName: isSet(site.cloudinaryCloudName) ? site.cloudinaryCloudName.trim() : (process.env.CLOUDINARY_CLOUD_NAME || "").trim(),
      cloudinaryApiKey: isSet(site.cloudinaryApiKey) ? site.cloudinaryApiKey.trim() : (process.env.CLOUDINARY_API_KEY || "").trim(),
      cloudinaryApiSecret: isSet(site.cloudinaryApiSecret) ? site.cloudinaryApiSecret.trim() : (process.env.CLOUDINARY_API_SECRET || "").trim(),
    }

    cache.set(key, { creds, ts: Date.now() })
    return creds
  } catch (err) {
    console.error("[websiteCredentials] Error loading credentials for website", websiteId, err.message)
    return getEnvFallback()
  }
}

function getEnvFallback() {
  return {
    razorpayKeyId: (process.env.RAZORPAY_KEY_ID || "").trim(),
    razorpayKeySecret: (process.env.RAZORPAY_KEY_SECRET || "").trim(),
    cloudinaryUrl: (process.env.CLOUDINARY_URL || "").trim(),
    cloudinaryCloudName: (process.env.CLOUDINARY_CLOUD_NAME || "").trim(),
    cloudinaryApiKey: (process.env.CLOUDINARY_API_KEY || "").trim(),
    cloudinaryApiSecret: (process.env.CLOUDINARY_API_SECRET || "").trim(),
  }
}

/**
 * Evict cache entry when credentials are updated via admin.
 */
export function evictCredentialsCache(websiteId) {
  if (websiteId) cache.delete(String(websiteId))
}
