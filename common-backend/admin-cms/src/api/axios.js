import axios from "axios"

// Get the current hostname and port for flexible API configuration
const getBaseURL = () => {
  const hostname = window.location.hostname
  const port = "8080" // Backend port

  // If accessing from localhost, use localhost for API
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return `http://localhost:${port}/api`
  }

  // If accessing from IP address, use the same IP for API
  return `http://${hostname}:${port}/api`
}

// Base URL for static uploads (same host as API, no /api suffix)
export const getUploadBaseURL = () => {
  const base = getBaseURL()
  if (typeof base === "string" && base) {
    return base.replace(/\/api\/?$/, "") || `http://localhost:8080`
  }
  return "http://localhost:8080"
}

const api = axios.create({
  baseURL: getBaseURL(),
})

// Add request interceptor for authentication and multi-tenancy
api.interceptors.request.use((config) => {
  const isAuthRequest = /\/auth\/(login|register|google|create-super-admin|setup-super-admin)/.test(config.url || '')
  try {
    const userStr = localStorage.getItem("adminUser")
    if (userStr) {
      const user = JSON.parse(userStr)
      if (user?.token) {
        config.headers.Authorization = `Bearer ${user.token}`
      } else if (!isAuthRequest) {
        console.warn("No token found in adminUser")
      }
    } else if (!isAuthRequest) {
      console.warn("No adminUser found in localStorage")
    }
  } catch (error) {
    console.error("Error parsing adminUser from localStorage:", error)
  }
  
  // Multi-tenant: Add X-Website-Id header for admin/CMS requests
  try {
    const selectedWebsiteStr = localStorage.getItem("selectedWebsite")
    if (selectedWebsiteStr) {
      const selectedWebsite = JSON.parse(selectedWebsiteStr)
      if (selectedWebsite?._id) {
        config.headers['X-Website-Id'] = selectedWebsite._id
      }
    }
  } catch (error) {
    console.warn("Failed to get selected website for tenant context:", error)
  }
  
  // Don't override Content-Type for FormData - let axios set it automatically with boundary
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type']
  }
  return config
}, (error) => {
  return Promise.reject(error)
})

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error("API Error:", error)
    
    // Handle 401 errors - token expired or invalid
    if (error.response?.status === 401) {
      const errorMsg = error.response?.data?.msg || ""
      if (errorMsg.toLowerCase().includes("token") || errorMsg.toLowerCase().includes("authorized")) {
        // Token is invalid or expired - suggest re-login
        console.warn("Authentication token is invalid or expired. User may need to log in again.")
        // Don't automatically log out here - let the component handle it
      }
    }
    
    return Promise.reject(error)
  }
)

export default api
