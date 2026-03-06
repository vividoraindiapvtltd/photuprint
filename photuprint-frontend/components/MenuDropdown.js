"use client"

import Link from "next/link"
import { useState, useRef, useEffect } from "react"

const menuData = {
  men: {
    columns: [
      {
        title: "Topwear",
        items: [
          "All Topwear",
          "All T-Shirts",
          "All Shirts",
          "Hoodies",
          "Sweatshirts",
          "Jackets",
          "Sweaters",
          "Polo T-Shirts",
          "Oversized T-shirts",
          "Classic Fit T-shirts",
          "Half Sleeve T-Shirts",
        ],
      },
      {
        title: "Bottomwear",
        items: [
          "All Bottomwear",
          "Joggers",
          "Trackpants",
          "Trousers & Pants",
          "Jeans",
          "Pajamas",
          "Shorts",
          "Boxers",
          "Plus Size Bottomwear",
          "Cargos",
          "Cargo Joggers",
        ],
      },
      {
        title: "Winterwear",
        items: [
          "All Winterwear",
          "Hoodies",
          "Sweatshirts",
          "Jackets",
          "Sweaters",
          "Windcheaters",
          "Co-ord Sets",
          "Sweatshirts & Hoodies",
          "Plus Size",
        ],
        separator: true,
        nextTitle: "Footwear",
        nextItems: ["Bewakoof Sneakers", "Clogs", "Sliders", "Casual Shoes"],
      },
      {
        title: "Accessories",
        items: ["Mobile covers", "Backpacks", "Sling bags", "Duffel bags", "Caps"],
        separator: true,
        nextTitle: "SPECIALS",
        specials: [
          { icon: "❄️", text: "Winterwear Collection" },
          { icon: "🛒", text: "CLEARANCE STORE", subtext: "Shop Now" },
          { icon: "🎨", text: "Acid Wash Drip" },
          { icon: "👕", text: "Buy 3 for 1099", count: 3 },
          { icon: "👕", count: 2 },
          { icon: "👖", count: 2 },
        ],
      },
    ],
  },
  women: {
    columns: [
      {
        title: "Topwear",
        items: [
          "All Topwear",
          "T-Shirts",
          "Shirts",
          "Tops",
          "Dresses",
          "Kurtas",
          "Sweatshirts",
          "Hoodies",
        ],
      },
      {
        title: "Bottomwear",
        items: [
          "All Bottomwear",
          "Joggers",
          "Pants",
          "Shorts",
          "Leggings",
          "Palazzos",
          "Plus Size",
        ],
      },
      {
        title: "Winterwear",
        items: [
          "All Winterwear",
          "Hoodies",
          "Sweatshirts",
          "Jackets",
          "Sweaters",
        ],
        separator: true,
        nextTitle: "Footwear",
        nextItems: ["Sneakers", "Flats", "Heels"],
      },
      {
        title: "Accessories",
        items: ["Bags", "Jewellery", "Watches", "Sunglasses"],
      },
    ],
  },
}

export default function MenuDropdown({ category, isOpen, onClose }) {
  const dropdownRef = useRef(null)
  const categoryData = menuData[category]

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isOpen, onClose])

  if (!isOpen || !categoryData) return null

  return (
    <div
      ref={dropdownRef}
      className="absolute top-full left-1/2 transform -translate-x-1/2 w-screen max-w-7xl bg-white shadow-2xl z-50 border-t border-gray-200"
      onMouseLeave={onClose}
      style={{ left: '50%', marginLeft: 0 }}
    >
      <div className="mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-4 gap-8">
          {categoryData.columns.map((column, colIndex) => (
            <div key={colIndex} className="space-y-6">
              {/* Main Category */}
              <div>
                <h3 className="text-sm font-bold text-gray-900 mb-3 uppercase tracking-wide">
                  {column.title}
                </h3>
                <ul className="space-y-2">
                  {column.items.map((item, itemIndex) => (
                    <li key={itemIndex}>
                      <Link
                        href={`/products?category=${encodeURIComponent(item.toLowerCase())}`}
                        className="text-sm text-gray-700 hover:text-blue-600 transition-colors block py-1"
                      >
                        {item}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Separator and Next Category */}
              {column.separator && (
                <>
                  <div className="border-t border-gray-200 my-4"></div>
                  {column.nextTitle && (
                    <div>
                      <h3 className="text-sm font-bold text-gray-900 mb-3 uppercase tracking-wide">
                        {column.nextTitle}
                      </h3>
                      {column.nextItems && (
                        <ul className="space-y-2">
                          {column.nextItems.map((item, itemIndex) => (
                            <li key={itemIndex}>
                              <Link
                                href={`/products?category=${encodeURIComponent(item.toLowerCase())}`}
                                className="text-sm text-gray-700 hover:text-blue-600 transition-colors block py-1"
                              >
                                {item}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  {/* Specials Section */}
                  {column.specials && (
                    <div className="mt-6">
                      <div className="grid grid-cols-2 gap-3">
                        {column.specials.map((special, specialIndex) => (
                          <Link
                            key={specialIndex}
                            href={`/products?special=${encodeURIComponent(special.text || "")}`}
                            className="flex flex-col items-center p-3 border border-gray-200 rounded-lg hover:border-blue-500 hover:shadow-md transition-all group"
                          >
                            <span className="text-2xl mb-2">{special.icon}</span>
                            {special.text && (
                              <span className="text-xs font-semibold text-gray-900 text-center group-hover:text-blue-600">
                                {special.text}
                              </span>
                            )}
                            {special.subtext && (
                              <span className="text-xs text-gray-600 mt-1">{special.subtext}</span>
                            )}
                            {special.count && !special.text && (
                              <span className="text-xs text-gray-400 mt-1">{special.count}x</span>
                            )}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
