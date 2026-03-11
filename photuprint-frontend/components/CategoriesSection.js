"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import api from "../src/utils/api"
import { getImageSrc } from "../src/utils/imageUrl"
import { slugify } from "../src/utils/slugify"

function getCategorySlug(category) {
  if (category?.slug && String(category.slug).trim()) return String(category.slug).trim().toLowerCase()
  if (category?.name) return slugify(category.name)
  return ""
}

function CategoryCard({ category }) {
  const id = category._id ?? category.id
  const name = category.name ?? "Category"
  const imageUrl =
    category.image ??
    category.imageUrl ??
    category.banner ??
    category.thumbnail ??
    category.icon ??
    null
  const slug = getCategorySlug(category)
  const href = slug ? `/${slug}` : (id ? `/products?categoryId=${encodeURIComponent(id)}` : "/products")

  return (
    <Link
      href={href}
      className="group block bg-white rounded-lg overflow-hidden border border-gray-100 hover:shadow-lg transition-all duration-200"
    >
      <div className="relative aspect-[4/5] sm:aspect-square bg-gray-100 overflow-hidden">
        {imageUrl ? (
          <Image
            src={getImageSrc(imageUrl) || imageUrl}
            alt={name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
            className="object-cover group-hover:scale-105 transition-transform duration-200"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-200 to-gray-300">
            <span className="text-gray-400 text-sm font-medium uppercase">{name.charAt(0)}</span>
          </div>
        )}
      </div>
      <div className="p-3 text-center">
        <span className="text-sm font-medium text-gray-700 uppercase tracking-wide">{name}</span>
      </div>
    </Link>
  )
}

function CategoriesSectionShimmer() {
  return (
    <div className="bg-white py-10 border-b border-gray-200">
      <div className="w-full mx-auto px-4 sm:px-6 lg:px-8">
        <div className="h-6 w-40 bg-gray-200 rounded animate-pulse mx-auto mb-8" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-lg overflow-hidden border border-gray-100">
              <div className="aspect-[4/5] bg-gray-200 animate-pulse" />
              <div className="p-3">
                <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4 mx-auto" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function CategoriesSection() {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .get("/categories?showInactive=false&includeDeleted=false", { skipAuth: true })
      .then((res) => {
        const data = res?.data ?? res
        setCategories(Array.isArray(data) ? data : [])
      })
      .catch(() => setCategories([]))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <CategoriesSectionShimmer />
  if (categories.length === 0) return null

  return (
    <section className="bg-white py-10 border-b border-gray-200">
      <div className="w-full mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-xl font-bold text-gray-900 text-center uppercase tracking-wide mb-8">
          Categories
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {categories.map((cat) => (
            <CategoryCard key={cat._id ?? cat.id} category={cat} />
          ))}
        </div>
      </div>
    </section>
  )
}
