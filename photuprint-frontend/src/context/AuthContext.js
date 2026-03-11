"use client"

import React, { createContext, useContext, useState, useEffect } from "react"
import { syncGuestRecentlyViewedToBackend } from "../utils/guestRecentlyViewed"

// Backend auth response shape: { user: { id, name, email, role, picture, ... }, token: "..." }
// Stored in localStorage and in context as-is; use user.user for profile fields, user.token for the JWT.

// Default context value to prevent undefined errors during SSR/prerendering
const defaultAuthValue = {
  user: null,
  isAuthenticated: false,
  login: () => {},
  logout: () => {},
  loginModalOpen: false,
  loginReturnPath: "/",
  loginModalMessage: null,
  openLoginModal: () => {},
  closeLoginModal: () => {},
}

const AuthContext = createContext(defaultAuthValue)

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loginModalOpen, setLoginModalOpen] = useState(false)
  const [loginReturnPath, setLoginReturnPath] = useState("/")
  const [loginModalMessage, setLoginModalMessage] = useState(null)
  const [logoutRedirectTo, setLogoutRedirectTo] = useState(null)

  // Initialize from localStorage on mount (client-side only)
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("user")
        if (stored) {
          const parsed = JSON.parse(stored)
          setUser(parsed)
          setIsAuthenticated(!!parsed)
        }
      } catch {
        // Ignore parse errors
      }
    }
  }, [])

  // After logout, perform redirect if requested (e.g. from profile/account page)
  useEffect(() => {
    if (!isAuthenticated && logoutRedirectTo && typeof window !== "undefined") {
      const path = logoutRedirectTo
      setLogoutRedirectTo(null)
      window.location.replace(path)
    }
  }, [isAuthenticated, logoutRedirectTo])

  const login = (data) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("user", JSON.stringify(data))
    }
    setUser(data)
    setIsAuthenticated(true)
    syncGuestRecentlyViewedToBackend()
  }

  /**
   * @param {{ redirectTo?: string }} [options] - If redirectTo is set (e.g. "/"), redirect to that URL after logout (used when logging out from account page).
   */
  const logout = (options) => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("user")
    }
    setUser(null)
    setIsAuthenticated(false)
    setLoginModalOpen(false)
    if (options?.redirectTo) {
      setLogoutRedirectTo(options.redirectTo)
    }
  }

  const openLoginModal = (returnPath, message) => {
    const path = returnPath ?? (typeof window !== "undefined" ? window.location.pathname + window.location.search : "/")
    setLoginReturnPath(path)
    setLoginModalMessage(message ?? null)
    setLoginModalOpen(true)
  }

  const closeLoginModal = () => {
    setLoginModalOpen(false)
    setLoginModalMessage(null)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        isAuthenticated,
        loginModalOpen,
        loginReturnPath,
        loginModalMessage,
        openLoginModal,
        closeLoginModal,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  // Return default value if context is undefined (shouldn't happen with default value, but extra safety)
  return context || defaultAuthValue
}
