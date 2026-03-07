import axios from "axios"

// Use backend URL directly so Authorization and other headers are sent correctly
// (Next.js rewrites can strip headers when proxying; direct call ensures token is sent)
const getBaseURL = () => {
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api"
}

const api = axios.create({
  baseURL: getBaseURL(),
})

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
  // For authentication-related routes (e.g., register, login, verify-email), the backend does not require
  // a website context, because these actions are not tied to a specific website/tenant—they are global.
  // Therefore, we intentionally do NOT send the X-Website-Id header for any /auth/ route, or if explicitly skipped.
  const isAuthRoute = config.url?.includes("/auth/")
  if (config.skipWebsiteId === true || isAuthRoute) {
    delete config.skipWebsiteId
    return config
  }

  // Add X-Website-Id header from environment variable
  let websiteId = null
  if (typeof window !== "undefined") {
    websiteId = process.env.NEXT_PUBLIC_WEBSITE_ID || window.__NEXT_DATA__?.env?.NEXT_PUBLIC_WEBSITE_ID
  } else {
    websiteId = process.env.NEXT_PUBLIC_WEBSITE_ID
  }

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
