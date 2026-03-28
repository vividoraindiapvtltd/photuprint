import React, { useState, useEffect } from "react"
import { useAuth } from "../context/AuthContext"
import api from "../api/axios"
import { useNavigate } from "react-router-dom"

export default function Login() {
  const { login, isAuthenticated } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  // Redirect if already logged in
  useEffect(() => {
    if (isAuthenticated) {
      navigate("/redirect", { replace: true })
    }
  }, [isAuthenticated, navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const res = await api.post("/auth/login", { email, password })

      if (!res.data || !res.data.user) {
        setError("Invalid response from server. Please try again.")
        return
      }

      // Allow admin, super_admin, and editor roles
      const allowedRoles = ["admin", "super_admin", "editor"]
      if (!allowedRoles.includes(res.data.user.role)) {
        setError("Access denied. Only admin users can log in to the admin panel.")
        return
      }

      login(res.data)
      navigate("/select-website")
    } catch (err) {
      const serverMsg = err.response?.data?.msg
      const serverCode = err.response?.data?.code
      console.error("Login error:", { status: err.response?.status, msg: serverMsg, code: serverCode, data: err.response?.data })
      const errorMessage = serverMsg || err.message || "Login failed. Please check your credentials."
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }
  return (
    <div className="containerStyle">
      <div className="formStyle">
        <div className="logoStyle marginAuto appendBottom20 textLogo">PhotuPrint</div>
        <h2 className="textCenter font24 fontMedium appendBottom10 blackText ">Admin Login</h2>
        <form onSubmit={handleSubmit}>
          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="inputStyle" required />
          <div className="passwordFieldWrap">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="inputStyle"
              required
              autoComplete="current-password"
            />
            <button
              type="button"
              className="passwordToggleBtn"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              tabIndex={0}
            >
              {showPassword ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                  />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                </svg>
              )}
            </button>
          </div>
          <button type="submit" className="buttonStyle" disabled={loading}>
            {loading ? "Logging in..." : "Login"}
          </button>
          {error && <p className="errorStyle">{error}</p>}
        </form>
      </div>
    </div>
  )
}
