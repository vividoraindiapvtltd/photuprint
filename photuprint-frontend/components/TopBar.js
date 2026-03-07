"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useAuth } from "../src/context/AuthContext"

export default function TopBar() {
  const { isAuthenticated, openLoginModal } = useAuth()
  const pathname = usePathname()

  return (
    <div className="bg-gray-800 text-white text-xs py-2.5">
      <div className="w-full mx-auto px-4 sm:px-6 lg:px-8">
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
          </div>

          {/* Right Side - Links and Icons */}
          <div className="flex items-center space-x-5">
            <Link href="/contact" className="hover:text-yellow-400 transition-colors">
              Contact Us
            </Link>
            <Link href="/track-order" className="hover:text-yellow-400 transition-colors">
              Track Order
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
