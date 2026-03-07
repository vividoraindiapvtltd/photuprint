"use client"

import { useState, useEffect } from "react"
import Link from "next/link"

const banners = [
  {
    id: 1,
    title: "BUY 2 OVERSIZED T-SHIRTS AT ₹1099",
    image: "/banners/banner-1.jpg",
    link: "/products?offer=buy2-1099",
    color: "bg-gray-800",
  },
  {
    id: 2,
    title: "UP TO 70% OFF",
    subtitle: "Winterwear Collection",
    image: "/banners/banner-2.jpg",
    link: "/products?category=winterwear",
    color: "bg-blue-50",
  },
  {
    id: 3,
    title: "INTERNET'S FAVOURITE",
    subtitle: "Choose the Unknown",
    image: "/banners/banner-3.jpg",
    link: "/products?collection=favourite",
    color: "bg-gray-100",
  },
]

export default function PromotionalBanners() {
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % banners.length)
    }, 5000) // Auto-rotate every 5 seconds

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="bg-white py-6">
      <div className="w-full mx-auto px-4 sm:px-6 lg:px-8">
        {/* Banner Grid - Side by Side */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {banners.map((banner, index) => (
            <Link key={banner.id} href={banner.link} className="relative group overflow-hidden rounded-lg shadow-sm hover:shadow-md transition-all duration-300">
              <div className={`${banner.color} h-64 flex items-center justify-center relative`}>
                {/* Placeholder for banner image */}
                <div className="absolute inset-0 bg-gradient-to-br from-gray-200 to-gray-300 opacity-30"></div>
                <div className="relative z-10 text-center p-6 w-full">
                  <h3 className="text-lg font-bold text-gray-900 mb-1 leading-tight">{banner.title}</h3>
                  {banner.subtitle && <p className="text-xs text-gray-600 mt-1">{banner.subtitle}</p>}
                </div>
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-5 transition-opacity"></div>
              </div>
            </Link>
          ))}
        </div>

        {/* Carousel Dots - Below Banners */}
        <div className="flex justify-center space-x-1.5">
          {banners.map((_, index) => (
            <button key={index} onClick={() => setCurrentIndex(index)} className={`h-1.5 rounded-full transition-all ${index === currentIndex ? "bg-gray-800 w-8" : "bg-gray-300 w-1.5"}`} aria-label={`Go to banner ${index + 1}`} />
          ))}
        </div>
      </div>
    </div>
  )
}
