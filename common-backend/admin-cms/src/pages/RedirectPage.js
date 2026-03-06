import React, { useEffect } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { useAuth } from "../context/AuthContext"

export default function RedirectPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated, user, selectedWebsite } = useAuth()

  useEffect(() => {
    // Redirect to dashboard if authenticated
    if (isAuthenticated) {
      const timer = setTimeout(() => {
        // If website is selected, go to dashboard, otherwise go to website selection
        if (selectedWebsite) {
          navigate("/dashboard", { replace: true })
        } else {
          navigate("/select-website", { replace: true })
        }
      }, 2000) // 2 second delay to show the message

      return () => clearTimeout(timer)
    } else {
      // Redirect to login if not authenticated
      navigate("/", { replace: true })
    }
  }, [isAuthenticated, navigate, selectedWebsite])

  // Show which route was accessed (for debugging/info)
  const attemptedRoute = location.pathname !== "/redirect" ? location.pathname : "unknown route"

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#f8f9fa",
        padding: "20px",
      }}
    >
      <div
        style={{
          backgroundColor: "white",
          borderRadius: "12px",
          padding: "40px",
          boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
          textAlign: "center",
          maxWidth: "500px",
        }}
      >
        <div style={{ fontSize: "48px", marginBottom: "20px" }}>🔄</div>
        <h2 style={{ marginBottom: "16px", color: "#333" }}>Redirecting...</h2>
        {isAuthenticated && user ? (
          <>
            <p style={{ color: "#666", marginBottom: "8px" }}>
              You are already logged in as <strong>{user.user?.name || user.user?.email}</strong>
            </p>
            {attemptedRoute !== "unknown route" && attemptedRoute !== "/redirect" && <p style={{ color: "#999", fontSize: "12px", marginBottom: "8px", fontStyle: "italic" }}>Route accessed: {attemptedRoute}</p>}
            <p style={{ color: "#666", fontSize: "14px" }}>Redirecting you to the dashboard...</p>
          </>
        ) : (
          <>
            {attemptedRoute !== "unknown route" && attemptedRoute !== "/redirect" && <p style={{ color: "#999", fontSize: "12px", marginBottom: "8px", fontStyle: "italic" }}>Route accessed: {attemptedRoute}</p>}
            <p style={{ color: "#666" }}>Redirecting you to the login page...</p>
          </>
        )}
        <div
          style={{
            marginTop: "30px",
            width: "100%",
            height: "4px",
            backgroundColor: "#e9ecef",
            borderRadius: "2px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              backgroundColor: "#007bff",
              animation: "loading 2s ease-in-out infinite",
            }}
          />
        </div>
        <style>
          {`
            @keyframes loading {
              0% {
                transform: translateX(-100%);
              }
              100% {
                transform: translateX(100%);
              }
            }
          `}
        </style>
      </div>
    </div>
  )
}
