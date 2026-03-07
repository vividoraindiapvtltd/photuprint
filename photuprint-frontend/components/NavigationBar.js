"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCart } from "../src/context/CartContext"
import MenuDropdown from "./MenuDropdown"
import UserProfileDropdown from "./UserProfileDropdown"

export default function NavigationBar() {
  const [activeMenu, setActiveMenu] = useState(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [cartShake, setCartShake] = useState(false)
  const { totalCount: cartCount } = useCart()
  const router = useRouter()

  useEffect(() => {
    let timeoutId
    const handleCartShake = () => {
      setCartShake(true)
      clearTimeout(timeoutId)
      timeoutId = setTimeout(() => setCartShake(false), 500)
    }
    document.addEventListener("cart-shake", handleCartShake)
    return () => {
      document.removeEventListener("cart-shake", handleCartShake)
      clearTimeout(timeoutId)
    }
  }, [])

  const handleMenuHover = (menu) => {
    setActiveMenu(menu)
  }

  const handleMenuLeave = () => {
    setActiveMenu(null)
  }

  const handleSearch = (e) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      router.push(`/products?search=${encodeURIComponent(searchQuery)}`)
    }
  }

  return (
    <nav className="bg-white border-b border-gray-200 relative">
      <div className="w-full mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center flex-shrink-0">
            <span className="text-2xl font-bold text-gray-900">PP</span>
          </Link>

          {/* Main Navigation Links - Centered */}
          <div className="hidden md:flex items-center space-x-8 flex-1 justify-center mx-8">
            <div className="relative" onMouseEnter={() => handleMenuHover("men")} onMouseLeave={handleMenuLeave}>
              <Link href="/products?category=men" className={`text-sm font-semibold py-2 px-1 transition-colors ${activeMenu === "men" ? "text-blue-600" : "text-gray-700 hover:text-blue-600"}`}>
                MEN
              </Link>
              {activeMenu === "men" && <MenuDropdown category="men" isOpen={activeMenu === "men"} onClose={handleMenuLeave} />}
            </div>

            <div className="relative" onMouseEnter={() => handleMenuHover("women")} onMouseLeave={handleMenuLeave}>
              <Link href="/products?category=women" className={`text-sm font-semibold py-2 px-1 transition-colors ${activeMenu === "women" ? "text-blue-600" : "text-gray-700 hover:text-blue-600"}`}>
                WOMEN
              </Link>
              {activeMenu === "women" && <MenuDropdown category="women" isOpen={activeMenu === "women"} onClose={handleMenuLeave} />}
            </div>

            <Link href="/products?category=mobile-covers" className="text-sm font-semibold text-gray-700 hover:text-blue-600 transition-colors py-2 px-1">
              MOBILE COVERS
            </Link>
          </div>

          {/* Right Side - Search and Icons */}
          <div className="flex items-center space-x-4 flex-shrink-0">
            {/* Search Bar */}
            <div className="hidden lg:flex">
              <form onSubmit={handleSearch} className="w-full">
                <div className="relative">
                  <input type="text" placeholder="Search by products" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-64 pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm" />
                  <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </form>
            </div>

            {/* Icons - Same as Header (Account page) */}
            <div className="flex items-center space-x-4">
              {/* User Profile Dropdown - same as Header.js */}
              <UserProfileDropdown />

              {/* Wishlist */}
              <Link href="/account?tab=wishlist" className="relative p-2 text-gray-600 hover:text-blue-600 transition-colors" title="Wishlist">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </Link>

              {/* Cart - data-cart-icon used by fly-to-cart animation */}
              <Link href="/cart" data-cart-icon className={`relative p-2 text-gray-600 hover:text-blue-600 transition-colors ${cartShake ? "animate-cart-shake" : ""}`} title="Cart">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
                {cartCount > 0 && <span className="absolute top-0 right-0 bg-blue-600 text-white text-xs rounded-full min-w-[1.25rem] h-5 px-1 flex items-center justify-center">{cartCount > 99 ? "99+" : cartCount}</span>}
              </Link>
            </div>
          </div>
        </div>

        {/* Mobile Search */}
        <div className="lg:hidden pb-4">
          <form onSubmit={handleSearch}>
            <input type="text" placeholder="Search by products" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
          </form>
        </div>
      </div>
    </nav>
  )
}
