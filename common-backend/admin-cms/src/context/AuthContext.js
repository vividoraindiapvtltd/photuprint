import React, { createContext, useContext, useState } from "react"

const AuthContext = createContext()

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("adminUser"))
    } catch {
      return null
    }
  })
  
  const [selectedWebsite, setSelectedWebsiteState] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("selectedWebsite"))
    } catch {
      return null
    }
  })

  const login = (data) => {
    localStorage.setItem("adminUser", JSON.stringify(data))
    // Also store user data separately for PermissionContext
    if (data?.user) {
      localStorage.setItem("user", JSON.stringify(data.user))
    }
    setUser(data)
    
    // Dispatch custom event to notify PermissionContext to refresh
    window.dispatchEvent(new Event('userLogin'))
  }

  const logout = () => {
    localStorage.removeItem("adminUser")
    localStorage.removeItem("selectedWebsite")
    localStorage.removeItem("user") // Clear user permissions data
    setUser(null)
    setSelectedWebsiteState(null)
  }

  const setSelectedWebsite = (website) => {
    if (website) {
      localStorage.setItem("selectedWebsite", JSON.stringify(website))
      setSelectedWebsiteState(website)
    } else {
      localStorage.removeItem("selectedWebsite")
      setSelectedWebsiteState(null)
    }
  }

  return (
    <AuthContext.Provider 
      value={{ 
        user, 
        login, 
        logout, 
        isAuthenticated: !!user,
        selectedWebsite,
        setSelectedWebsite
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
