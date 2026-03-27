"use client"

import { useState, useEffect, useRef } from "react"
import { useGoogleLogin } from "@react-oauth/google"
import { usePathname, useRouter } from "next/navigation"
import { useAuth } from "../context/AuthContext"
import api from "../utils/api"
import ReCAPTCHA from "react-google-recaptcha"
import { validatePassword, PASSWORD_RULES } from "../utils/passwordValidation"

export default function LoginModal() {
  const pathname = usePathname()
  const router = useRouter()
  const { login, loginModalOpen, loginReturnPath, loginModalMessage, closeLoginModal } = useAuth()
  const [mode, setMode] = useState("signin")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [verificationSent, setVerificationSent] = useState(false)
  const [verificationEmail, setVerificationEmail] = useState("")
  const [resendLoading, setResendLoading] = useState(false)
  const [resendMsg, setResendMsg] = useState("")
  const [unverifiedEmailLogin, setUnverifiedEmailLogin] = useState(false)
  const [authMethod, setAuthMethod] = useState("password") // "password" | "otp"
  const [otpStep, setOtpStep] = useState("phone") // "phone" | "otp"
  const [phone, setPhone] = useState("")
  const [otp, setOtp] = useState("")
  const [sendOtpLoading, setSendOtpLoading] = useState(false)
  const [verifyOtpLoading, setVerifyOtpLoading] = useState(false)
  const [captchaToken, setCaptchaToken] = useState(null)
  const captchaRef = useRef(null)

  useEffect(() => {
    if (!loginModalOpen) {
      setError("")
      setMode("signin")
      setVerificationSent(false)
      setResendMsg("")
      setCaptchaToken(null)
      captchaRef.current?.reset()
      setUnverifiedEmailLogin(false)
      setAuthMethod("password")
      setOtpStep("phone")
      setPhone("")
      setOtp("")
    }
  }, [loginModalOpen])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const res = await api.post("/auth/login", { email, password })
      if (!res.data?.user) {
        setError("Invalid response from server. Please try again.")
        setLoading(false)
        return
      }
      login(res.data)
      closeLoginModal()
      const current = pathname + (typeof window !== "undefined" ? window.location.search : "")
      if (loginReturnPath && loginReturnPath !== current) router.push(loginReturnPath)
    } catch (err) {
      const status = err.response?.status
      const msg = err.response?.data?.msg || err.message || "Login failed. Please check your credentials."
      const isUnverified = status === 403 || /verif|verify your email|email not verified/i.test(String(msg))
      if (isUnverified) {
        setError("Please verify your email before signing in. Check your inbox for the verification link.")
        setVerificationEmail(email)
        setUnverifiedEmailLogin(true)
      } else {
        setError(msg)
        setUnverifiedEmailLogin(false)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleRegisterSubmit = async (e) => {
    e.preventDefault()
    setError("")
    if (!name || !email || !password) {
      setError("All fields are required")
      return
    }
    const pwError = validatePassword(password)
    if (pwError) {
      setError(pwError)
      return
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match")
      return
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      setError("Please enter a valid email address")
      return
    }
    if (!captchaToken) {
      setError("Please complete the CAPTCHA verification")
      return
    }
    setLoading(true)
    try {
      const res = await api.post("/auth/register", { name, email, password, captchaToken, returnPath: loginReturnPath || "/" })
      const data = res.data || {}

      // Backend sends verification email and returns msg/email (no user+token) when verification required
      const hasVerificationResponse = !data.user && !data.token && (data.email || data.msg)

      if (hasVerificationResponse) {
        setVerificationSent(true)
        setVerificationEmail(data.email || email)
      } else if (data.user && data.token) {
        login(res.data)
        closeLoginModal()
        const current = pathname + (typeof window !== "undefined" ? window.location.search : "")
        if (loginReturnPath && loginReturnPath !== current) router.push(loginReturnPath)
      } else {
        setError("Registration successful. Please sign in.")
        setMode("signin")
      }
    } catch (err) {
      setError(err.response?.data?.msg || err.message || "Registration failed. Please try again.")
      setCaptchaToken(null)
      captchaRef.current?.reset()
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setLoading(true)
      setError("")
      try {
        const googleUserInfoResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
        })
        if (!googleUserInfoResponse.ok) throw new Error("Failed to fetch user info from Google")
        const googleUserInfo = await googleUserInfoResponse.json()
        if (!googleUserInfo.sub || !googleUserInfo.email) throw new Error("Missing required information from Google account")
        const res = await api.post("/auth/google", {
          googleId: googleUserInfo.sub,
          email: googleUserInfo.email,
          name: googleUserInfo.name || googleUserInfo.email.split("@")[0],
          picture: googleUserInfo.picture || null,
        })
        if (!res.data?.user) {
          setError("Invalid response from server. Please try again.")
          setLoading(false)
          return
        }
        login(res.data)
        closeLoginModal()
        const current = pathname + (typeof window !== "undefined" ? window.location.search : "")
        if (loginReturnPath && loginReturnPath !== current) router.push(loginReturnPath)
      } catch (err) {
        const msg = err.response?.data?.msg || err.response?.data?.message || err.message
        setError(msg || "Google sign-in failed. Please try again.")
      } finally {
        setLoading(false)
      }
    },
    onError: () => {
      setError("Google sign-in failed. Please try again.")
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

  const handleSendOtp = async (e) => {
    e.preventDefault()
    setError("")
    setSendOtpLoading(true)
    try {
      await api.post("/auth/send-otp", { phone }, { skipAuth: true })
      setOtpStep("otp")
      setOtp("")
    } catch (err) {
      setError(err.response?.data?.msg || err.message || "Failed to send OTP. Please try again.")
    } finally {
      setSendOtpLoading(false)
    }
  }

  const handleVerifyOtp = async (e) => {
    e.preventDefault()
    setError("")
    setVerifyOtpLoading(true)
    try {
      const res = await api.post("/auth/verify-otp", { phone, otp }, { skipAuth: true })
      if (!res.data?.user) {
        setError("Invalid response. Please try again.")
        setVerifyOtpLoading(false)
        return
      }
      login(res.data)
      closeLoginModal()
      const current = pathname + (typeof window !== "undefined" ? window.location.search : "")
      if (loginReturnPath && loginReturnPath !== current) router.push(loginReturnPath)
    } catch (err) {
      const code = err.response?.data?.code
      const msg = err.response?.data?.msg || err.message || "Verification failed. Please try again."
      if (code === "NO_ACCOUNT") {
        setError("No account linked to this number. Create an account with email first or add this number in your profile.")
      } else {
        setError(msg)
      }
    } finally {
      setVerifyOtpLoading(false)
    }
  }

  if (!loginModalOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" aria-hidden="true" />
      <div className="relative w-full max-w-md rounded-xl bg-white shadow-xl max-h-[90vh] overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="login-title">
        <div className="p-6 sm:p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 id="login-title" className="text-xl font-bold text-gray-900">
              {verificationSent ? "Verify your email" : mode === "signin" ? "Sign in" : "Create account"}
            </h2>
            <button type="button" onClick={closeLoginModal} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100" aria-label="Close">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {loginModalMessage && (
            <div className="mb-4 rounded-lg bg-blue-50 border border-blue-200 p-4 text-center">
              <p className="text-sm font-semibold text-blue-900 uppercase tracking-wide">PLEASE LOG IN</p>
              <p className="text-sm text-blue-800 mt-1">{loginModalMessage}</p>
            </div>
          )}
          {verificationSent ? (
            <div className="space-y-4">
              <div className="mx-auto w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
                <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 text-center">Check your email</h3>
              <p className="text-sm text-gray-600 text-center">
                We&apos;ve sent a verification link to <span className="font-medium text-gray-900">{verificationEmail}</span>. Click the link in the email to verify your account, then sign in.
              </p>
              <p className="text-xs text-gray-500 text-center">Didn&apos;t receive it? Check spam or resend below.</p>
              {resendMsg && <p className={`text-sm text-center ${resendMsg.includes("Failed") ? "text-red-600" : "text-green-600"}`}>{resendMsg}</p>}
              <button type="button" onClick={handleResendVerification} disabled={resendLoading} className="w-full py-2 px-4 rounded-lg text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50 disabled:opacity-60">
                {resendLoading ? "Sending..." : "Resend verification email"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setVerificationSent(false)
                  setMode("signin")
                }}
                className="w-full py-2 px-4 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
              >
                Back to Sign in
              </button>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-600 mb-4">
                {mode === "signin" ? (
                  <>
                    Don&apos;t have an account?{" "}
                    <button type="button" onClick={() => setMode("create")} className="font-medium text-blue-600 hover:text-blue-500">
                      Create account
                    </button>
                  </>
                ) : (
                  <>
                    Already have an account?{" "}
                    <button type="button" onClick={() => setMode("signin")} className="font-medium text-blue-600 hover:text-blue-500">
                      Sign in
                    </button>
                  </>
                )}
              </p>

              {mode === "signin" ? (
                authMethod === "otp" ? (
                  <div className="space-y-4">
                    {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</div>}
                    {otpStep === "phone" ? (
                      <form onSubmit={handleSendOtp} className="space-y-4">
                        <div>
                          <label htmlFor="modal-phone" className="sr-only">
                            Mobile number
                          </label>
                          <input id="modal-phone" type="tel" inputMode="numeric" autoComplete="tel" required placeholder="10-digit mobile number" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent sm:text-sm" />
                        </div>
                        <button type="submit" disabled={sendOtpLoading} className="w-full py-2 px-4 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed">
                          {sendOtpLoading ? "Sending OTP…" : "Send OTP"}
                        </button>
                      </form>
                    ) : (
                      <form onSubmit={handleVerifyOtp} className="space-y-4">
                        <p className="text-sm text-gray-600">OTP sent to {phone}. Enter it below.</p>
                        <div>
                          <label htmlFor="modal-otp" className="sr-only">
                            OTP
                          </label>
                          <input id="modal-otp" type="text" inputMode="numeric" autoComplete="one-time-code" required placeholder="Enter 6-digit OTP" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} maxLength={6} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent sm:text-sm text-center tracking-widest" />
                        </div>
                        <button type="submit" disabled={verifyOtpLoading} className="w-full py-2 px-4 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed">
                          {verifyOtpLoading ? "Verifying…" : "Verify & sign in"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setOtpStep("phone")
                            setError("")
                            setOtp("")
                          }}
                          className="w-full py-2 px-4 rounded-lg text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50"
                        >
                          Change number
                        </button>
                      </form>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMethod("password")
                        setError("")
                        setOtpStep("phone")
                        setPhone("")
                        setOtp("")
                      }}
                      className="w-full text-sm text-gray-500 hover:text-gray-700"
                    >
                      ← Back to password sign in
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</div>}
                    <div>
                      <label htmlFor="modal-email" className="sr-only">
                        Email address
                      </label>
                      <input id="modal-email" type="email" autoComplete="email" required placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent sm:text-sm" />
                    </div>
                    <div>
                      <label htmlFor="modal-password" className="sr-only">
                        Password
                      </label>
                      <input id="modal-password" type="password" autoComplete="current-password" required placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent sm:text-sm" />
                    </div>
                    <button type="submit" disabled={loading} className="w-full py-2 px-4 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed">
                      {loading ? "Signing in..." : "Sign in"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMethod("otp")
                        setError("")
                      }}
                      className="w-full text-sm text-gray-500 hover:text-gray-700"
                    >
                      Sign in with OTP instead
                    </button>
                    {unverifiedEmailLogin && (
                      <div className="pt-2 border-t border-gray-100">
                        <p className="text-xs text-gray-600 mb-2">Didn&apos;t get the email? Request a new verification link.</p>
                        <button
                          type="button"
                          onClick={async () => {
                            const toEmail = verificationEmail || email
                            if (!toEmail) return
                            setResendLoading(true)
                            setResendMsg("")
                            try {
                              await api.post("/auth/resend-verification", { email: toEmail })
                              setResendMsg("Verification email sent. Check your inbox.")
                            } catch (e) {
                              setResendMsg(e.response?.data?.msg || e.message || "Failed to resend.")
                            } finally {
                              setResendLoading(false)
                            }
                          }}
                          disabled={resendLoading}
                          className="w-full py-2 px-4 rounded-lg text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50 disabled:opacity-60"
                        >
                          {resendLoading ? "Sending..." : "Resend verification email"}
                        </button>
                        {resendMsg && <p className={`mt-2 text-xs ${resendMsg.includes("Failed") ? "text-red-600" : "text-green-600"}`}>{resendMsg}</p>}
                      </div>
                    )}
                  </form>
                )
              ) : (
                <form onSubmit={handleRegisterSubmit} className="space-y-4">
                  {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</div>}
                  <div>
                    <label htmlFor="modal-name" className="sr-only">
                      Full name
                    </label>
                    <input id="modal-name" type="text" autoComplete="name" required placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent sm:text-sm" />
                  </div>
                  <div>
                    <label htmlFor="modal-reg-email" className="sr-only">
                      Email address
                    </label>
                    <input id="modal-reg-email" type="email" autoComplete="email" required placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent sm:text-sm" />
                  </div>
                  <div>
                    <label htmlFor="modal-reg-password" className="sr-only">
                      Password
                    </label>
                    <input id="modal-reg-password" type="password" autoComplete="new-password" required placeholder="Min 8 chars, 1 uppercase, 1 special" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent sm:text-sm" />
                    <p className="mt-1 text-xs text-gray-500">{PASSWORD_RULES}</p>
                  </div>
                  <div>
                    <label htmlFor="modal-confirm-password" className="sr-only">
                      Confirm password
                    </label>
                    <input id="modal-confirm-password" type="password" autoComplete="new-password" required placeholder="Confirm password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent sm:text-sm" />
                  </div>
                  {process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY && (
                    <div className="flex justify-center" style={{ transform: "scale(0.9)", transformOrigin: "center" }}>
                      <ReCAPTCHA ref={captchaRef} sitekey={process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY} onChange={(token) => setCaptchaToken(token)} onExpired={() => setCaptchaToken(null)} />
                    </div>
                  )}
                  <button type="submit" disabled={loading || !captchaToken} className="w-full py-2 px-4 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed">
                    {loading ? "Creating account..." : "Create account"}
                  </button>
                </form>
              )}
              <div className="mt-4">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-gray-500">Or continue with</span>
                  </div>
                </div>
                <button type="button" onClick={() => handleGoogleLogin()} disabled={loading} className="mt-4 w-full flex items-center justify-center gap-3 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-60">
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  {mode === "signin" ? "Sign in with Google" : "Sign up with Google"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
