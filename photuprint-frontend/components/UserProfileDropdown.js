"use client"

import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { useAuth } from "../src/context/AuthContext"

function getInitials(name) {
  if (!name) return "U"
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .substring(0, 2)
}

export default function UserProfileDropdown() {
  const { isAuthenticated, user, logout, openLoginModal } = useAuth()
  const pathname = usePathname()
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleLogout = () => {
    const onAccountPage = pathname?.startsWith("/account")
    if (onAccountPage) {
      logout({ redirectTo: "/" })
    } else {
      logout()
    }
  }

  const currentPath = typeof window !== "undefined" ? pathname + window.location.search : pathname || ""

  if (!isAuthenticated || !user) {
    return (
      <button type="button" onClick={() => openLoginModal(currentPath)} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
        Sign In
      </button>
    )
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button onClick={() => setShowDropdown(!showDropdown)} className="flex items-center space-x-2 p-1 rounded-full hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500">
        {user.user?.picture ? <Image src={user.user.picture} alt={user.user.name ?? ""} width={36} height={36} className="w-9 h-9 rounded-full object-cover border-2 border-gray-200" /> : <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm">{getInitials(user.user?.name)}</div>}
        <span className="text-sm font-medium text-gray-700 hidden lg:block max-w-[120px] truncate">{user.user?.name}</span>
        <svg className={`w-4 h-4 text-gray-500 transition-transform ${showDropdown ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {showDropdown && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-50 animate-fade-in">
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-900">{user.user?.name}</p>
            <p className="text-xs text-gray-500 truncate">{user.user?.email}</p>
          </div>

          <div className="py-1">
            <Link href="/account" onClick={() => setShowDropdown(false)} className="flex items-center px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors">
              <svg className="w-5 h-5 mr-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Your Account
            </Link>
            <Link href="/account?tab=orders" onClick={() => setShowDropdown(false)} className="flex items-center px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors">
              <svg className="w-5 h-5 mr-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              Your Orders
            </Link>
            <Link href="/account?tab=wishlist" onClick={() => setShowDropdown(false)} className="flex items-center px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors">
              <svg className="w-5 h-5 mr-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              Wish List
            </Link>
            <Link href="/account?tab=recently-viewed" onClick={() => setShowDropdown(false)} className="flex items-center px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors">
              <svg className="w-5 h-5 mr-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Keep Shopping For
            </Link>
            <Link href="/account?tab=recommendations" onClick={() => setShowDropdown(false)} className="flex items-center px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors">
              <svg className="w-5 h-5 mr-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
              Recommendations
            </Link>
            <Link href="/account?tab=returns" onClick={() => setShowDropdown(false)} className="flex items-center px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors">
              <svg className="w-5 h-5 mr-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
              Returns
            </Link>
          </div>

          <div className="border-t border-gray-100 pt-1">
            <button
              onClick={() => {
                setShowDropdown(false)
                handleLogout()
              }}
              className="flex items-center w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
            >
              <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign Out
            </button>
          </div>
        </div>
      )}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in { animation: fade-in 0.2s ease-out; }
      `,
        }}
      />
    </div>
  )
}
