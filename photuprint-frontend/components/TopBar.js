"use client"

import Link from "next/link"
import { useAuth } from "../src/context/AuthContext"

export default function TopBar() {
  const { isAuthenticated, user } = useAuth()

  return (
    <div className="bg-gray-800 text-white text-xs py-2.5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center">
          {/* Left Side Links */}
          <div className="flex items-center space-x-5">
            <Link href="/offers" className="hover:text-yellow-400 transition-colors">
              Offers
            </Link>
            <Link href="/fanbook" className="hover:text-yellow-400 transition-colors">
              Fanbook
            </Link>
            <Link href="/download-app" className="hover:text-yellow-400 transition-colors">
              Download App
            </Link>
            <Link href="/stores" className="hover:text-yellow-400 transition-colors">
              Find a store near me
            </Link>
          </div>

          {/* Right Side - Links and Icons */}
          <div className="flex items-center space-x-5">
            <Link href="/contact" className="hover:text-yellow-400 transition-colors">
              Contact Us
            </Link>
            <Link href="/track-order" className="hover:text-yellow-400 transition-colors">
              Track Order
            </Link>
            {/* Login Icon */}
            <Link
              href={isAuthenticated ? "/account" : "/login"}
              className="flex items-center space-x-1 hover:text-yellow-400 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
              <span>LOGIN</span>
            </Link>
            {/* Wishlist Icon */}
            <Link
              href="/account?tab=wishlist"
              className="hover:text-yellow-400 transition-colors"
              title="Wishlist"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                />
              </svg>
            </Link>
            {/* Cart Icon */}
            <Link
              href="/cart"
              className="relative hover:text-yellow-400 transition-colors"
              title="Cart"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
