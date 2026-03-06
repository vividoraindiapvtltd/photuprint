'use client'

import React, { createContext, useContext, useState, useEffect } from "react"

// Default context value to prevent undefined errors during SSR/prerendering
const defaultAuthValue = {
  user: null,
  isAuthenticated: false,
  login: () => {},
  logout: () => {},
}

const AuthContext = createContext(defaultAuthValue)

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  // Initialize from localStorage on mount (client-side only)
  useEffect(() => {
    if (typeof window !== 'undefined') {
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

  const login = (data) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem("user", JSON.stringify(data))
    }
    setUser(data)
    setIsAuthenticated(true)
  }

  const logout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem("user")
    }
    setUser(null)
    setIsAuthenticated(false)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        isAuthenticated,
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
