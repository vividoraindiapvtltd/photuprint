"use client"

import { Suspense, useState, useEffect, useRef } from "react"
import { useGoogleLogin } from "@react-oauth/google"
import { useAuth } from "../../src/context/AuthContext"
import api from "../../src/utils/api"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import ReCAPTCHA from "react-google-recaptcha"
import { validatePassword, PASSWORD_RULES } from "../../src/utils/passwordValidation"

function RegisterContent() {
  const { login, isAuthenticated } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    mobile: "",
    password: "",
    confirmPassword: "",
  })
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [verificationSent, setVerificationSent] = useState(false)
  const [verificationEmail, setVerificationEmail] = useState("")
  const [resendLoading, setResendLoading] = useState(false)
  const [resendMsg, setResendMsg] = useState("")
  const [captchaToken, setCaptchaToken] = useState(null)
  const captchaRef = useRef(null)

  // Get the redirect URL from query params
  const from = searchParams.get("from") || "/"

  // Redirect if already logged in
  useEffect(() => {
    if (isAuthenticated) {
      router.push(from)
    }
  }, [isAuthenticated, router, from])

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
    if (!formData.name || !formData.email || !formData.mobile || !formData.password) {
      setError("All fields are required")
      setLoading(false)
      return
    }

    const pwError = validatePassword(formData.password)
    if (pwError) {
      setError(pwError)
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

    // Mobile validation (required, must be 10 digits)
    const mobileRegex = /^[0-9]{10}$/
    if (!mobileRegex.test(formData.mobile)) {
      setError("Please enter a valid 10-digit mobile number")
      setLoading(false)
      return
    }

    if (!captchaToken) {
      setError("Please complete the CAPTCHA verification")
      setLoading(false)
      return
    }

    try {
      const registerResponse = await api.post("/auth/register", {
        name: formData.name,
        email: formData.email,
        mobile: formData.mobile,
        password: formData.password,
        captchaToken,
      })

      const data = registerResponse.data || {}

      // Backend sends verification email and returns msg/email (no user+token) when verification required
      const hasVerificationResponse = !data.user && !data.token && (data.email || data.msg)

      if (hasVerificationResponse) {
        setVerificationSent(true)
        setVerificationEmail(data.email || formData.email)
      } else if (data.user && data.token) {
        // Auto-login when no verification required
        login(registerResponse.data)
        router.push(from)
      } else {
        router.push(`/login?message=${encodeURIComponent("Registration successful! Please login.")}`)
      }
    } catch (err) {
      console.error("Registration error:", err)
      const errorMessage = err.response?.data?.msg || err.message || "Registration failed. Please try again."
      setError(errorMessage)
      setCaptchaToken(null)
      captchaRef.current?.reset()
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

        // Store user data and redirect
        login(res.data)
        console.log("Google registration/login successful, redirecting to product listing page")
        router.push("/")
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

  const handleResendVerification = async () => {
    if (!verificationEmail) return
    setResendLoading(true)
    setResendMsg("")
    try {
      await api.post("/auth/resend-verification", { email: verificationEmail })
      setResendMsg("Verification email sent. Please check your inbox.")
    } catch (err) {
      setResendMsg(err.response?.data?.msg || err.message || "Failed to resend. Please try again.")
    } finally {
      setResendLoading(false)
    }
  }

  // Verification email sent success screen
  if (verificationSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full">
          <div className="rounded-xl bg-white shadow-lg border border-gray-200 p-8 text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-6">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Check your email</h2>
            <p className="text-gray-600 mb-4">
              We&apos;ve sent a verification link to <span className="font-medium text-gray-900">{verificationEmail}</span>. Click the link in the email to verify your account and sign in.
            </p>
            <p className="text-sm text-gray-500 mb-4">Didn&apos;t receive the email? Check your spam folder or click below to resend.</p>
            {resendMsg && <p className={`text-sm mb-4 ${resendMsg.includes("Failed") ? "text-red-600" : "text-green-600"}`}>{resendMsg}</p>}
            <button type="button" onClick={handleResendVerification} disabled={resendLoading} className="w-full py-2 px-4 rounded-lg text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50 disabled:opacity-60 mb-4">
              {resendLoading ? "Sending..." : "Resend verification email"}
            </button>
            <div className="space-y-3">
              <Link href="/login" className="block w-full py-2 px-4 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700">
                Go to Sign in
              </Link>
              <Link href="/register" className="block w-full py-2 px-4 rounded-lg text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50">
                Back to Register
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">Create your account</h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-blue-600 hover:text-blue-500">
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
              <label htmlFor="mobile" className="block text-sm font-medium text-gray-700 mb-1">
                Mobile Number
              </label>
              <input
                id="mobile"
                name="mobile"
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="tel"
                required
                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Enter 10-digit mobile number"
                value={formData.mobile}
                onChange={(e) => {
                  // Only allow numeric input
                  const value = e.target.value.replace(/\D/g, "")
                  setFormData({ ...formData, mobile: value })
                }}
                maxLength={10}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input id="password" name="password" type="password" autoComplete="new-password" required className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm" placeholder="Min 8 chars, 1 uppercase, 1 special" value={formData.password} onChange={handleChange} />
              <p className="mt-1 text-xs text-gray-500">{PASSWORD_RULES}</p>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                Confirm Password
              </label>
              <input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm" placeholder="Confirm your password" value={formData.confirmPassword} onChange={handleChange} />
            </div>
          </div>

          {process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY && (
            <div className="flex justify-center">
              <ReCAPTCHA ref={captchaRef} sitekey={process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY} onChange={(token) => setCaptchaToken(token)} onExpired={() => setCaptchaToken(null)} />
            </div>
          )}

          <div>
            <button type="submit" disabled={loading || !captchaToken} className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed">
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

export default function Register() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-gray-50">Loading...</div>}>
      <RegisterContent />
    </Suspense>
  )
}
