"use client"

import Link from "next/link"
import UserProfileDropdown from "../../components/UserProfileDropdown"

export default function Header({ title = "Products", showSearch = false, searchValue = "", onSearchChange }) {
  return (
    <header className="bg-white shadow-sm sticky top-0 z-50">
      <div className="w-full mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo / Brand */}
          <Link href="/" className="flex items-center space-x-2">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xl">P</span>
            </div>
            <span className="text-xl font-bold text-gray-900 hidden sm:block">PP</span>
          </Link>

          {/* Page Title (centered on larger screens) */}
          <h1 className="text-lg font-semibold text-gray-700 hidden md:block absolute left-1/2 transform -translate-x-1/2">{title}</h1>

          {/* Search Bar (optional) */}
          {showSearch && (
            <div className="flex-1 max-w-md mx-4 hidden sm:block">
              <div className="relative">
                <input type="text" placeholder="Search products..." value={searchValue} onChange={(e) => onSearchChange?.(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm" />
                <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
          )}

          {/* Right Side - User Menu */}
          <div className="flex items-center space-x-4">
            {/* Wishlist Icon */}
            <Link href="/account?tab=wishlist" className="relative p-2 text-gray-600 hover:text-blue-600 transition-colors" title="Wishlist">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </Link>

            {/* User Profile Dropdown - same as NavigationBar */}
            <UserProfileDropdown />
          </div>
        </div>

        {/* Mobile Search */}
        {showSearch && (
          <div className="pb-4 sm:hidden">
            <input type="text" placeholder="Search products..." value={searchValue} onChange={(e) => onSearchChange?.(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
          </div>
        )}
      </div>
    </header>
  )
}
