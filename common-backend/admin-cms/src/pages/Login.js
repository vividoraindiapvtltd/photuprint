import React, { useState, useEffect } from "react"
import { useAuth } from "../context/AuthContext"
import api from "../api/axios"
import { useNavigate } from "react-router-dom"

export default function Login() {
  const { login, isAuthenticated } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
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
          <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="inputStyle" required />
          <button type="submit" className="buttonStyle" disabled={loading}>
            {loading ? "Logging in..." : "Login"}
          </button>
          {error && <p className="errorStyle">{error}</p>}
        </form>
      </div>
    </div>
  )
}
