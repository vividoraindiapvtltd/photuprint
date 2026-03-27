"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { createPortal } from "react-dom"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useCart } from "../src/context/CartContext"
import { useAuth } from "../src/context/AuthContext"
import { useMediaQuery } from "../src/hooks/useMediaQuery"
import MenuDropdown, { menuData } from "./MenuDropdown"
import UserProfileDropdown from "./UserProfileDropdown"

function MobileNavCategorySection({ categoryKey, onNavigate }) {
  const data = menuData[categoryKey]
  if (!data) return null
  return (
    <div className="border-t border-gray-100 pt-3 mt-3 first:mt-0 first:border-t-0 first:pt-0">
      <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">{categoryKey === "men" ? "Men" : "Women"}</p>
      {data.columns.map((column, colIndex) => (
        <details key={colIndex} className="group border-b border-gray-100 last:border-0">
          <summary className="cursor-pointer list-none py-3 font-semibold text-gray-900 flex items-center justify-between">
            {column.title}
            <svg className="w-4 h-4 text-gray-400 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </summary>
          <ul className="pb-3 pl-1 space-y-1">
            {column.items.map((item, itemIndex) => (
              <li key={itemIndex}>
                <Link href={`/products?category=${encodeURIComponent(item.toLowerCase())}`} onClick={onNavigate} className="text-sm text-gray-700 py-1.5 block hover:text-blue-600">
                  {item}
                </Link>
              </li>
            ))}
            {column.separator && column.nextTitle && column.nextItems && (
              <>
                <li className="pt-2 text-xs font-bold uppercase tracking-wide text-gray-500">{column.nextTitle}</li>
                {column.nextItems.map((item, itemIndex) => (
                  <li key={`n-${itemIndex}`}>
                    <Link href={`/products?category=${encodeURIComponent(item.toLowerCase())}`} onClick={onNavigate} className="text-sm text-gray-700 py-1.5 block hover:text-blue-600">
                      {item}
                    </Link>
                  </li>
                ))}
              </>
            )}
            {column.specials && (
              <li className="pt-2">
                <div className="grid grid-cols-2 gap-2">
                  {column.specials.map((special, specialIndex) => (
                    <Link key={specialIndex} href={`/products?special=${encodeURIComponent(special.text || "")}`} onClick={onNavigate} className="flex flex-col items-center p-2 border border-gray-200 rounded-lg text-center">
                      {special.icon && <span className="text-lg">{special.icon}</span>}
                      {special.text && <span className="text-[10px] font-semibold text-gray-800 leading-tight">{special.text}</span>}
                    </Link>
                  ))}
                </div>
              </li>
            )}
          </ul>
        </details>
      ))}
    </div>
  )
}

export default function NavigationBar() {
  const pathname = usePathname()
  const [activeMenu, setActiveMenu] = useState(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [cartShake, setCartShake] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [navPortalReady, setNavPortalReady] = useState(false)
  const [navSheetDragY, setNavSheetDragY] = useState(0)
  const navSheetDragYRef = useRef(0)
  const navTouchStartY = useRef(null)
  const { totalCount: cartCount } = useCart()
  const { isAuthenticated, openLoginModal } = useAuth()
  const router = useRouter()
  const isMdUp = useMediaQuery("(min-width: 768px)")

  useEffect(() => {
    setNavPortalReady(true)
  }, [])

  useEffect(() => {
    if (isMdUp) setMobileNavOpen(false)
  }, [isMdUp])

  useEffect(() => {
    setMobileNavOpen(false)
  }, [pathname])

  const closeMobileNav = useCallback(() => {
    setMobileNavOpen(false)
    setNavSheetDragY(0)
    navSheetDragYRef.current = 0
    navTouchStartY.current = null
  }, [])

  useEffect(() => {
    if (!mobileNavOpen || isMdUp) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKey = (e) => {
      if (e.key === "Escape") closeMobileNav()
    }
    window.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener("keydown", onKey)
    }
  }, [mobileNavOpen, isMdUp, closeMobileNav])

  const onNavSheetTouchStart = (e) => {
    navTouchStartY.current = e.touches[0].clientY
  }
  const onNavSheetTouchMove = (e) => {
    if (navTouchStartY.current == null) return
    const dy = e.touches[0].clientY - navTouchStartY.current
    if (dy > 0) {
      navSheetDragYRef.current = dy
      setNavSheetDragY(dy)
    }
  }
  const onNavSheetTouchEnd = () => {
    if (navSheetDragYRef.current > 100) closeMobileNav()
    else {
      setNavSheetDragY(0)
      navSheetDragYRef.current = 0
    }
    navTouchStartY.current = null
  }

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
          <div className="flex items-center gap-1 min-w-0 flex-shrink-0">
            <button
              type="button"
              className="md:hidden min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100 -ml-1"
              aria-label="Open menu"
              aria-expanded={mobileNavOpen}
              aria-controls="pp-mobile-nav-sheet"
              onClick={() => setMobileNavOpen(true)}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <Link href="/" className="flex items-center flex-shrink-0">
              <span className="text-2xl font-bold text-gray-900">PP</span>
            </Link>
          </div>

          {/* Main Navigation Links - Centered (md+) */}
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
          <div className="flex items-center space-x-2 sm:space-x-4 flex-shrink-0">
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

            <div className="flex items-center space-x-2 sm:space-x-4">
              <UserProfileDropdown />

              {isAuthenticated ? (
                <Link href="/account?tab=wishlist" className="relative p-2 text-gray-600 hover:text-blue-600 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center" title="Wishlist">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </Link>
              ) : (
                <button type="button" onClick={() => openLoginModal("/account?tab=wishlist", "Login to view items in your wishlist.")} className="relative p-2 text-gray-600 hover:text-blue-600 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center" title="Wishlist">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </button>
              )}

              <Link href="/cart" data-cart-icon className={`relative p-2 text-gray-600 hover:text-blue-600 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center ${cartShake ? "animate-cart-shake" : ""}`} title="Cart">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
                {cartCount > 0 && <span className="absolute top-0 right-0 bg-blue-600 text-white text-xs rounded-full min-w-[1.25rem] h-5 px-1 flex items-center justify-center">{cartCount > 99 ? "99+" : cartCount}</span>}
              </Link>
            </div>
          </div>
        </div>

        <div className="lg:hidden pb-4">
          <form onSubmit={handleSearch}>
            <input type="text" placeholder="Search by products" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
          </form>
        </div>
      </div>

      {!isMdUp && navPortalReady && mobileNavOpen && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-[60] md:hidden" role="presentation">
              <button type="button" className="absolute inset-0 bg-black/40 animate-pp-backdrop-in cursor-default border-0" aria-label="Close menu" onClick={closeMobileNav} />
              <div
                id="pp-mobile-nav-sheet"
                role="dialog"
                aria-modal="true"
                aria-labelledby="pp-mobile-nav-title"
                className="absolute bottom-0 left-0 right-0 flex max-h-[88vh] flex-col rounded-t-2xl bg-white shadow-[0_-8px_30px_rgba(0,0,0,0.12)] animate-pp-sheet-up"
                style={navSheetDragY > 0 ? { transform: `translateY(${navSheetDragY}px)`, transition: "none" } : undefined}
                onTouchStart={onNavSheetTouchStart}
                onTouchMove={onNavSheetTouchMove}
                onTouchEnd={onNavSheetTouchEnd}
              >
                <div className="flex shrink-0 flex-col items-center border-b border-gray-100 px-4 pt-3 pb-2">
                  <div className="mb-2 h-1 w-10 rounded-full bg-gray-300" aria-hidden />
                  <div className="flex w-full items-center justify-between gap-2">
                    <h2 id="pp-mobile-nav-title" className="text-lg font-semibold text-gray-900">
                      Menu
                    </h2>
                    <button type="button" onClick={closeMobileNav} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 min-h-[44px] min-w-[44px] flex items-center justify-center" aria-label="Close menu">
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                  <div className="py-3 space-y-1 border-b border-gray-100">
                    <Link href="/" onClick={closeMobileNav} className="block py-3 text-sm font-semibold text-gray-900">
                      Home
                    </Link>
                    <Link href="/products?category=men" onClick={closeMobileNav} className="block py-3 text-sm font-semibold text-gray-900">
                      Shop Men
                    </Link>
                    <Link href="/products?category=women" onClick={closeMobileNav} className="block py-3 text-sm font-semibold text-gray-900">
                      Shop Women
                    </Link>
                    <Link href="/products?category=mobile-covers" onClick={closeMobileNav} className="block py-3 text-sm font-semibold text-gray-900">
                      Mobile Covers
                    </Link>
                  </div>
                  <MobileNavCategorySection categoryKey="men" onNavigate={closeMobileNav} />
                  <MobileNavCategorySection categoryKey="women" onNavigate={closeMobileNav} />
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </nav>
  )
}
