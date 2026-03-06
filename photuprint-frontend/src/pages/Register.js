import React, { useState, useEffect } from "react"
import { useGoogleLogin } from "@react-oauth/google"
import { useAuth } from "../context/AuthContext"
import api from "../utils/api"
import { useNavigate, useLocation, Link } from "react-router-dom"

export default function Register() {
  const { login, isAuthenticated } = useAuth()
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  })
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  // Get the page user was trying to access before login
  const from = location.state?.from?.pathname || "/"

  // Redirect if already logged in
  useEffect(() => {
    if (isAuthenticated) {
      navigate(from, { replace: true })
    }
  }, [isAuthenticated, navigate, from])

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    // Validation
    if (!formData.name || !formData.email || !formData.password) {
      setError("All fields are required")
      setLoading(false)
      return
    }

    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters long")
      setLoading(false)
      return
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match")
      setLoading(false)
      return
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(formData.email)) {
      setError("Please enter a valid email address")
      setLoading(false)
      return
    }

    try {
      // Register the user
      const registerResponse = await api.post("/auth/register", {
        name: formData.name,
        email: formData.email,
        password: formData.password,
      })

      console.log("Registration successful:", registerResponse.data)

      // Automatically log in the user after successful registration
      if (registerResponse.data && registerResponse.data.user && registerResponse.data.token) {
        login(registerResponse.data)
        console.log("Auto-login successful, redirecting to:", from)

        // Redirect to the page they were trying to access, or home
        navigate(from, { replace: true })
      } else {
        // If auto-login data not provided, redirect to login page
        navigate("/login", {
          state: {
            message: "Registration successful! Please login.",
            from: location.state?.from,
          },
        })
      }
    } catch (err) {
      console.error("Registration error:", err)
      const errorMessage = err.response?.data?.msg || err.message || "Registration failed. Please try again."
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  // Google OAuth registration/login handler
  const handleGoogleSignUp = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        setLoading(true)
        setError("")

        // Get user info from Google
        const googleUserInfo = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
        }).then((res) => res.json())

        // Send to backend for authentication/registration
        const res = await api.post("/auth/google", {
          googleId: googleUserInfo.sub,
          email: googleUserInfo.email,
          name: googleUserInfo.name,
          picture: googleUserInfo.picture,
        })

        if (!res.data || !res.data.user) {
          setError("Invalid response from server. Please try again.")
          setLoading(false)
          return
        }

        // Store user data and redirect to product listing page
        login(res.data)
        console.log("Google registration/login successful, redirecting to product listing page")
        navigate("/", { replace: true })
      } catch (err) {
        console.error("Google sign-up error:", err)
        const errorMessage = err.response?.data?.msg || err.message || "Google sign-up failed. Please try again."
        setError(errorMessage)
      } finally {
        setLoading(false)
      }
    },
    onError: () => {
      setError("Google sign-up failed. Please try again.")
      setLoading(false)
    },
  })

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">Create your account</h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Already have an account?{" "}
            <Link to="/login" state={location.state} className="font-medium text-blue-600 hover:text-blue-500">
              Sign in
            </Link>
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="text-sm text-red-800">{error}</div>
            </div>
          )}

          <div className="rounded-md shadow-sm space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Full Name
              </label>
              <input id="name" name="name" type="text" autoComplete="name" required className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm" placeholder="John Doe" value={formData.name} onChange={handleChange} />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email address
              </label>
              <input id="email" name="email" type="email" autoComplete="email" required className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm" placeholder="john@example.com" value={formData.email} onChange={handleChange} />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input id="password" name="password" type="password" autoComplete="new-password" required className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm" placeholder="Minimum 6 characters" value={formData.password} onChange={handleChange} />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                Confirm Password
              </label>
              <input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm" placeholder="Confirm your password" value={formData.confirmPassword} onChange={handleChange} />
            </div>
          </div>

          <div>
            <button type="submit" disabled={loading} className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed">
              {loading ? "Creating account..." : "Create account"}
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

          {/* Google Sign-Up Button */}
          <div className="mt-6">
            <button type="button" onClick={() => handleGoogleSignUp()} disabled={loading} className="w-full flex items-center justify-center gap-3 px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed">
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              {loading ? "Signing up..." : "Sign up with Google"}
            </button>
          </div>
        </div>

        <div className="text-xs text-center text-gray-500 mt-4">By creating an account, you can submit product reviews and track your submissions.</div>
      </div>
    </div>
  )
}
