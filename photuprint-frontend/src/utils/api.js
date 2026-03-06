import axios from "axios"

// Get the current hostname and port for flexible API configuration
const getBaseURL = () => {
  // For Next.js, use environment variable or default
  if (typeof window !== 'undefined') {
    // const hostname = window.location.hostname
    // const port = "8080" // Backend port

    // // If accessing from localhost, use localhost for API
    // if (hostname === "localhost" || hostname === "127.0.0.1") {
    //   return `http://localhost:${port}/api`
    // }

    // // If accessing from IP address, use the same IP for API
    // return `http://${hostname}:${port}/api`

     // Use Next.js proxy path to avoid CORS issues
    // The proxy rewrites /api/* to http://localhost:8080/api/*
    return '/api'
  }

  // Server-side: use environment variable or default
  return process.env.NEXT_PUBLIC_API_URL || `http://localhost:8080/api`
}

const api = axios.create({
  baseURL: getBaseURL(),
})

// Add request interceptor for authentication and website ID
api.interceptors.request.use((config) => {
  // Check for user token (frontend uses "user", admin-cms uses "adminUser")
  if (typeof window !== 'undefined') {
    try {
      const user = JSON.parse(localStorage.getItem("user") || localStorage.getItem("adminUser") || "null")
      if (user?.token) {
        config.headers.Authorization = `Bearer ${user.token}`
      }
    } catch {
      // Ignore parse errors
    }
  }
  
  // Add X-Website-Id header from environment variable
  // In Next.js, NEXT_PUBLIC_* variables are available in both client and server
  // Access it from window if available (for client-side), otherwise use process.env
  let websiteId = null
  if (typeof window !== 'undefined') {
    // Client-side: NEXT_PUBLIC_* vars are injected at build time
    websiteId = process.env.NEXT_PUBLIC_WEBSITE_ID || window.__NEXT_DATA__?.env?.NEXT_PUBLIC_WEBSITE_ID
  } else {
    // Server-side
    websiteId = process.env.NEXT_PUBLIC_WEBSITE_ID
  }
  
  if (websiteId) {
    // Set header with lowercase key (HTTP headers are case-insensitive, but lowercase is standard)
    config.headers['x-website-id'] = websiteId
    
    // Debug logging (remove in production)
    if (process.env.NODE_ENV === 'development') {
      console.log('[API] Adding X-Website-Id header:', websiteId)
      console.log('[API] Request URL:', config.url)
      console.log('[API] Full request config:', {
        url: config.url,
        method: config.method,
        headers: {
          'x-website-id': config.headers['x-website-id'],
          'Authorization': config.headers['Authorization'] ? 'Bearer ***' : undefined,
          'Content-Type': config.headers['Content-Type'],
        }
      })
    }
  } else {
    // Warn if website ID is not set
    if (process.env.NODE_ENV === 'development') {
      console.warn('[API] NEXT_PUBLIC_WEBSITE_ID is not set. X-Website-Id header will not be sent.')
      console.warn('[API] Available env vars:', Object.keys(process.env).filter(k => k.includes('WEBSITE')))
    }
  }
  
  return config
})

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error("API Error:", error)
    // Return error response for handling in components
    return Promise.reject(error)
  }
)

export default api
