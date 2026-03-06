'use client'

import { useState, useEffect } from "react"
import { useGoogleLogin } from "@react-oauth/google"
import { useAuth } from "../../src/context/AuthContext"
import api from "../../src/utils/api"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"

export default function Login() {
  const { login, isAuthenticated } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  // Get the redirect URL from query params
  const from = searchParams.get("from") || "/"

  // Redirect if already logged in
  useEffect(() => {
    if (isAuthenticated) {
      router.push(from)
    }
  }, [isAuthenticated, router, from])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const res = await api.post("/auth/login", { email, password })

      if (!res.data || !res.data.user) {
        setError("Invalid response from server. Please try again.")
        setLoading(false)
        return
      }

      // Store user data
      login(res.data)

      console.log("Login successful, redirecting to:", from)
      router.push(from)
    } catch (err) {
      console.error("Login error:", err)
      const errorMessage = err.response?.data?.msg || err.message || "Login failed. Please check your credentials."
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  // Google OAuth login handler
  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        setLoading(true)
        setError("")

        // Get user info from Google
        const googleUserInfoResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
        })
        
        if (!googleUserInfoResponse.ok) {
          throw new Error("Failed to fetch user info from Google")
        }
        
        const googleUserInfo = await googleUserInfoResponse.json()

        // Validate required fields from Google
        if (!googleUserInfo.sub || !googleUserInfo.email) {
          throw new Error("Missing required information from Google account")
        }

        // Prepare request payload
        const requestPayload = {
          googleId: googleUserInfo.sub,
          email: googleUserInfo.email,
          name: googleUserInfo.name || googleUserInfo.email.split("@")[0],
          picture: googleUserInfo.picture || null,
        }

        console.log("[Google Login] Sending request to backend:", {
          url: "/auth/google",
          payload: { ...requestPayload, picture: requestPayload.picture ? "[present]" : null },
        })

        // Send to backend for authentication
        const res = await api.post("/auth/google", requestPayload)

        console.log("[Google Login] Backend response:", res.data)

        if (!res.data || !res.data.user) {
          setError("Invalid response from server. Please try again.")
          setLoading(false)
          return
        }

        // Store user data and redirect
        login(res.data)
        console.log("Google login successful, redirecting to:", from)
        router.push(from)
      } catch (err) {
        console.error("Google login error:", err)
        console.error("Error details:", {
          message: err.message,
          response: err.response?.data,
          status: err.response?.status,
          statusText: err.response?.statusText,
          headers: err.response?.headers,
        })
        
        // Extract detailed error message
        let errorMessage = "Google sign-in failed. Please try again."
        if (err.response?.data) {
          if (err.response.data.msg) {
            errorMessage = err.response.data.msg
          } else if (err.response.data.message) {
            errorMessage = err.response.data.message
          } else if (typeof err.response.data === "string") {
            errorMessage = err.response.data
          } else if (err.response.data.error) {
            errorMessage = err.response.data.error
          }
        } else if (err.message) {
          errorMessage = err.message
        }
        
        setError(errorMessage)
        setLoading(false)
      }
    },
    onError: (error) => {
      console.error("Google OAuth error:", error)
      setError("Google sign-in failed. Please try again.")
      setLoading(false)
    },
  })

  // Show success message if redirected from registration
  const successMessage = searchParams.get("message")

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">Sign in to your account</h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Don't have an account?{" "}
            <Link href="/register" className="font-medium text-blue-600 hover:text-blue-500">
              Create account
            </Link>
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {successMessage && (
            <div className="rounded-md bg-green-50 p-4">
              <div className="text-sm text-green-800">{successMessage}</div>
            </div>
          )}
          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="text-sm text-red-800">{error}</div>
            </div>
          )}
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="email" className="sr-only">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </div>
        </form>

        {/* Divider */}
        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-gray-50 text-gray-500">Or continue with</span>
            </div>
          </div>

          {/* Google Sign-In Button */}
          <div className="mt-6">
            <button
              type="button"
              onClick={() => handleGoogleLogin()}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              {loading ? "Signing in..." : "Sign in with Google"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
