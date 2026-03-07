"use client"

import { Suspense, useState, useEffect, useRef } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { useAuth } from "../../src/context/AuthContext"
import api from "../../src/utils/api"

// When first verify request succeeds, we add token here. Second request (React Strict Mode)
// gets 400 (token already used) - we check this and don't show error.
const verifiedTokens = new Set()

function VerifyEmailErrorView({ error }) {
  const [email, setEmail] = useState("")
  const [resendLoading, setResendLoading] = useState(false)
  const [resendMsg, setResendMsg] = useState("")

  const handleResend = async (e) => {
    e.preventDefault()
    if (!email.trim()) {
      setResendMsg("Please enter your email address.")
      return
    }
    setResendLoading(true)
    setResendMsg("")
    try {
      const res = await api.post("/auth/resend-verification", { email: email.trim() }, { skipAuth: true })
      const data = res?.data || {}
      if (data.emailSent) {
        setResendMsg("Verification email sent. Please check your inbox and spam folder.")
      } else {
        setResendMsg(data.msg || "We could not send the email. Please try again later.")
      }
    } catch (err) {
      setResendMsg(err.response?.data?.msg || err.message || "Failed to resend. Please try again.")
    } finally {
      setResendLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="max-w-md w-full text-center">
        <div className="rounded-xl bg-white shadow-lg border border-gray-200 p-8">
          <div className="mx-auto w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-6">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Verification failed</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <p className="text-sm text-gray-500 mb-4">Request a new verification link to be sent to your email.</p>
          <form onSubmit={handleResend} className="space-y-3 mb-6">
            <input type="email" placeholder="Your email address" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" required />
            <button type="submit" disabled={resendLoading} className="w-full py-2 px-4 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60">
              {resendLoading ? "Sending..." : "Resend verification email"}
            </button>
          </form>
          {resendMsg && <p className={`text-sm mb-4 ${resendMsg.toLowerCase().includes("verification email sent") ? "text-green-600" : resendMsg.toLowerCase().includes("failed") ? "text-red-600" : "text-amber-600"}`}>{resendMsg}</p>}
          <div className="space-y-3 pt-2 border-t border-gray-200">
            <Link href="/register" className="block w-full py-2 px-4 rounded-lg text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50">
              Register again
            </Link>
            <Link href="/login" className="block w-full py-2 px-4 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

function VerifyEmailContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { login, isAuthenticated } = useAuth()
  const [status, setStatus] = useState("verifying")
  const [error, setError] = useState("")
  const token = searchParams.get("token")
  const rawReturn = searchParams.get("returnTo") || "/"
  const returnTo = rawReturn.startsWith("/") && !rawReturn.startsWith("//") ? rawReturn : "/"
  const successRef = useRef(false)

  useEffect(() => {
    if (!token) {
      setStatus("error")
      setError("Invalid or missing verification link. Please request a new verification email.")
      return
    }

    if (verifiedTokens.has(token)) {
      setStatus("success")
      return
    }

    let cancelled = false
    const verify = async () => {
      try {
        const res = await api.post("/auth/verify-email", { token }, { skipAuth: true })
        if (cancelled) return
        const data = res.data || {}

        if (data.user && data.token) {
          verifiedTokens.add(token)
          successRef.current = true
          login(data)
          setStatus("success")
          setTimeout(() => router.push(returnTo), 2000)
        } else {
          setStatus("success")
        }
      } catch (err) {
        if (cancelled || successRef.current || verifiedTokens.has(token)) return
        setStatus("error")
        const code = err.response?.data?.code
        const msg = err.response?.data?.msg || err.message || "Verification failed."
        if (code === "TOKEN_EXPIRED") {
          setError("This link has expired. Please request a new verification email below.")
        } else if (code === "TOKEN_INVALID" || code === "TOKEN_MISSING") {
          setError("This link is invalid or has already been used. Please request a new verification email.")
        } else {
          setError(msg)
        }
      }
    }

    verify()
    return () => {
      cancelled = true
    }
  }, [token, returnTo, login, router])

  if (isAuthenticated && status === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
        <div className="max-w-md w-full text-center">
          <div className="rounded-xl bg-white shadow-lg border border-gray-200 p-8">
            <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-6">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Email verified!</h2>
            <p className="text-gray-600 mb-6">Redirecting you...</p>
            <Link href={returnTo} className="text-blue-600 hover:text-blue-700 font-medium">
              Continue
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (status === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
        <div className="max-w-md w-full text-center">
          <div className="rounded-xl bg-white shadow-lg border border-gray-200 p-8">
            <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-6">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Email verified!</h2>
            <p className="text-gray-600 mb-6">You can now sign in to your account.</p>
            <Link href="/login" className="inline-block w-full py-2 px-4 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (status === "error") {
    return <VerifyEmailErrorView error={error} />
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="max-w-md w-full text-center">
        <div className="rounded-xl bg-white shadow-lg border border-gray-200 p-8">
          <div className="mx-auto w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-6 animate-pulse">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Verifying your email...</h2>
          <p className="text-gray-600">Please wait.</p>
        </div>
      </div>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <p className="text-gray-500">Loading...</p>
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  )
}
