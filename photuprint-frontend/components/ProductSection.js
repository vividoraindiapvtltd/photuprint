"use client"

import Link from "next/link"
import { getProductSlug } from "../src/utils/slugify"
import { resolveProductOfferPricing } from "../src/utils/productOfferPricing"

export default function ProductSection({ title, products = [], showViewAll = true }) {
  // Mock products if none provided
  const displayProducts =
    products.length > 0
      ? products
      : Array.from({ length: 8 }, (_, i) => ({
          _id: `product-${i}`,
          name: `Product ${i + 1}`,
          price: 999 + i * 100,
          image: null,
          category: { name: "Category" },
        }))

  return (
    <div className="bg-white py-8">
      <div className="w-full mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
          {showViewAll && (
            <Link href="/products" className="text-blue-600 hover:text-blue-700 font-semibold text-sm flex items-center">
              View All
              <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          )}
        </div>

        {/* Products Grid - More items per row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {displayProducts.map((product) => {
            const slug = getProductSlug(product)
            const offer = resolveProductOfferPricing(product)
            return (
            <Link key={product._id} href={slug ? `/products/${slug}` : "/products"} className="group bg-white rounded overflow-hidden hover:shadow-md transition-all duration-200">
              {/* Product Image */}
              <div className="relative aspect-square bg-gray-100 overflow-hidden">
                {product.mainImage || product.image ? (
                  <img src={product.mainImage?.startsWith("http") ? product.mainImage : product.image?.startsWith("http") ? product.image : `http://localhost:8080${product.mainImage || product.image}`} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-200 to-gray-300">
                    <span className="text-gray-400 text-xs">No Image</span>
                  </div>
                )}
                {offer.pctOff > 0 && (
                  <span className="absolute top-1.5 left-1.5 bg-red-500 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded">{offer.pctOff}% OFF</span>
                )}
                {product.tag && <span className="absolute top-1.5 right-1.5 bg-blue-600 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded">{product.tag}</span>}
              </div>

              {/* Product Info */}
              <div className="p-2.5">
                <h3 className="text-xs font-medium text-gray-900 mb-1 line-clamp-2 group-hover:text-blue-600 transition-colors leading-tight">{product.name}</h3>
                <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                  {offer.hasOffer && <span className="text-[10px] text-gray-400 line-through">₹{Math.round(offer.mrp)}</span>}
                  <span className="text-sm font-bold text-blue-600">₹{Math.round(offer.sale)}</span>
                  {offer.pctOff > 0 && <span className="text-[10px] text-red-600 font-medium">({offer.pctOff}% off)</span>}
                </div>
                {product.category && <p className="text-[10px] text-gray-500 mt-0.5">{product.category.name}</p>}
              </div>
            </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
