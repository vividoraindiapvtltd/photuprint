import axios from "axios"

const getBaseURL = () => {
  // Browser: use relative "/api" so requests stay same-origin (no CORS)
  // and go through Next.js rewrites which proxy to the backend.
  if (typeof window !== "undefined") {
    return "/api"
  }
  // Server (SSR): use internal backend URL directly.
  return process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api"
}

const api = axios.create({
  baseURL: getBaseURL(),
})

/** Set by POST /api/website-handoff (e.g. Vividora). Must match app/api/website-handoff/route.js */
const WEBSITE_ID_COOKIE = "photuprint_x_website_id"

function readWebsiteIdFromCookie() {
  if (typeof document === "undefined") return null
  try {
    const match = document.cookie.match(
      new RegExp(`(?:^|;\\s*)${WEBSITE_ID_COOKIE}=([^;]*)`),
    )
    const raw = match?.[1]
    return raw ? decodeURIComponent(raw) : null
  } catch {
    return null
  }
}

function getWebsiteIdForRequest() {
  if (typeof window !== "undefined") {
    return (
      readWebsiteIdFromCookie() ||
      process.env.NEXT_PUBLIC_WEBSITE_ID ||
      window.__NEXT_DATA__?.env?.NEXT_PUBLIC_WEBSITE_ID ||
      null
    )
  }
  return process.env.NEXT_PUBLIC_WEBSITE_ID
}

// Add request interceptor for authentication and website ID
// Backend auth response: { user: { id, name, email, role, ... }, token: "..." }
// Use config.skipAuth: true for public endpoints (e.g. GET product by slug) so expired/invalid tokens don't cause 401
api.interceptors.request.use(
  (config) => {
    const skipAuth = config.skipAuth === true
    if (skipAuth && config.headers) {
      delete config.headers.Authorization
    } else if (typeof window !== "undefined") {
      try {
        const stored = JSON.parse(localStorage.getItem("user") || localStorage.getItem("adminUser") || "null")
        const token = stored?.token
        if (token) {
          config.headers.Authorization = `Bearer ${token}`
        }
      } catch {
        // Ignore parse errors
      }
    }
    delete config.skipAuth // don't send to server
    return config
  },
  (err) => Promise.reject(err),
)

api.interceptors.request.use((config) => {
  // Skip website ID only when explicitly requested.
  // Auth routes like /auth/google and /auth/register DO need website context
  // so the backend can associate the user with the correct website.
  if (config.skipWebsiteId === true) {
    delete config.skipWebsiteId
    return config
  }

  const websiteId = getWebsiteIdForRequest()

  if (websiteId) {
    config.headers["x-website-id"] = websiteId
  } else if (process.env.NODE_ENV === "development") {
    console.warn("[API] NEXT_PUBLIC_WEBSITE_ID is not set. X-Website-Id header will not be sent.")
  }

  delete config.skipWebsiteId
  return config
})

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Don't log aborted requests (AbortController / Strict Mode)
    if (axios.isCancel(error)) return Promise.reject(error)
    // Don't log expected 400 on verify-email (duplicate request from Strict Mode)
    const isVerifyEmail400 = error.config?.url?.includes("verify-email") && error.response?.status === 400
    if (!isVerifyEmail400) {
      console.error("API Error:", error)
    }
    return Promise.reject(error)
  },
)

export default api
