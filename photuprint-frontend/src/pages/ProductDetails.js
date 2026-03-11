// frontend/src/pages/ProductDetails.jsx
import React, { useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import DOMPurify from "dompurify"
import ColorSelector from "../components/product/ColorSelector"
import ProductReviews from "../components/ProductReviews"
import TemplateRenderer from "../components/TemplateRenderer"
import api from "../utils/api"

export default function ProductDetails() {
  const params = useParams()
  const productId = params?.productId ?? null
  const [product, setProduct] = useState(null)
  const [variants, setVariants] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [viewMode, setViewMode] = useState("standard") // "standard" or "customized"
  const mainImage = selected?.image || product?.images?.[0]

  // Get category ID from product
  const categoryId = product?.category?._id || product?.categoryId?._id || product?.categoryId || product?.category

  const fetchProductDetails = async () => {
    try {
      setLoading(true)
      setError("")
      const [pRes, cRes] = await Promise.all([
        api.get(`/products/${productId}`),
        api.get(`/products/${productId}/colors`).catch(() => ({ data: [] })), // Colors endpoint might not exist
      ])
      setProduct(pRes.data)
      setVariants(Array.isArray(cRes.data) ? cRes.data : [])
      if (cRes.data?.length) setSelected(cRes.data[0])
    } catch (err) {
      console.error("Error fetching product details:", err)
      setError("Failed to load product details")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (productId) {
      fetchProductDetails()
    } else {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId])

  if (!productId) {
    return (
      <div className="max-w-6xl mx-auto p-4">
        <div className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded">
          <p>Product ID is required. Open a product from the catalog (e.g. /products/[slug]).</p>
          <Link href="/" className="mt-2 inline-block text-blue-600 hover:underline">Back to home</Link>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-4">
        <div className="text-center py-8">
          <p className="text-gray-600">Loading product...</p>
        </div>
      </div>
    )
  }

  if (error || !product) {
    return (
      <div className="max-w-6xl mx-auto p-4">
        <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded">{error || "Product not found"}</div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto p-4">
      <div className="grid md:grid-cols-2 gap-8 mb-8">
        <div className="rounded-xl overflow-hidden border bg-white">{mainImage ? <img src={mainImage} alt={product?.name} className="w-full object-cover" /> : <div className="p-8 text-gray-400">No image</div>}</div>

        <div>
          <h1 className="text-2xl font-bold mb-4">{product?.name}</h1>

          {product?.price && <p className="text-xl font-semibold text-gray-800 mb-4">${product.price}</p>}

          {product?.description && <div className="text-gray-700 mb-4 prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(product.description) }} />}

          <ColorSelector variants={variants} selectedId={selected?._id} onChange={(_, v) => setSelected(v)} />

          {/* Standard / Customized Toggle */}
          <div className="mt-6 mb-4">
            <div className="flex items-center space-x-4">
              <span className={`text-sm font-medium ${viewMode === "standard" ? "text-gray-900" : "text-gray-500"}`}>Standard</span>
              <button type="button" onClick={() => setViewMode(viewMode === "standard" ? "customized" : "standard")} className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${viewMode === "customized" ? "bg-blue-600" : "bg-gray-200"}`} role="switch" aria-checked={viewMode === "customized"}>
                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${viewMode === "customized" ? "translate-x-5" : "translate-x-0"}`} />
              </button>
              <span className={`text-sm font-medium ${viewMode === "customized" ? "text-gray-900" : "text-gray-500"}`}>Customized</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">{viewMode === "standard" ? "View standard product design" : "Select a custom template for this product"}</p>
          </div>

          {/* Submit Review Button */}
          <div className="mt-6">
            <Link href={`/products/${productId}/review`} className="inline-block px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors">
              Write a Review
            </Link>
          </div>

          {/* Additional product details can be added here */}
        </div>
      </div>

      {/* Template Section - Only show when Customized mode is selected */}
      {viewMode === "customized" && (
        <div className="mb-8 p-6 bg-white border border-gray-200 rounded-lg shadow-sm">
          <TemplateRenderer
            categoryId={categoryId}
            onTemplateSelect={(template) => {
              console.log("Template selected:", template)
            }}
          />
        </div>
      )}

      {/* Reviews Section */}
      <ProductReviews productId={productId} />
    </div>
  )
}
