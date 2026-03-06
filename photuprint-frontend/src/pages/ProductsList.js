import React, { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import DOMPurify from "dompurify"
import { useAuth } from "../context/AuthContext"
import api from "../utils/api"

export default function ProductsList() {
  const { isAuthenticated, user } = useAuth()
  const navigate = useNavigate()
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [filteredProducts, setFilteredProducts] = useState([])

  useEffect(() => {
    // Redirect to login if not authenticated
    if (!isAuthenticated) {
      navigate("/login", { state: { from: { pathname: "/" } } })
      return
    }

    fetchProducts()
  }, [isAuthenticated, navigate])

  useEffect(() => {
    // Filter products based on search query
    if (searchQuery.trim() === "") {
      setFilteredProducts(products)
    } else {
      const filtered = products.filter((product) => product.name?.toLowerCase().includes(searchQuery.toLowerCase()) || product.description?.toLowerCase().includes(searchQuery.toLowerCase()) || product.category?.name?.toLowerCase().includes(searchQuery.toLowerCase()))
      setFilteredProducts(filtered)
    }
  }, [searchQuery, products])

  const fetchProducts = async () => {
    try {
      setLoading(true)
      setError("")
      const response = await api.get("/products?showInactive=false&includeDeleted=false&limit=1000")
      const productsData = response.data.products || response.data || []
      const productsArray = Array.isArray(productsData) ? productsData : []
      setProducts(productsArray)
      setFilteredProducts(productsArray)
    } catch (err) {
      console.error("Error fetching products:", err)
      setError("Failed to load products. Please try again later.")
      setProducts([])
      setFilteredProducts([])
    } finally {
      setLoading(false)
    }
  }

  if (!isAuthenticated) {
    return null // Will redirect
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Loading products...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Welcome, {user?.user?.name || "User"}!</h1>
              <p className="mt-2 text-gray-600">Browse our products and share your experience</p>
            </div>
            <div className="flex items-center gap-4">
              <Link
                to="/login"
                onClick={(e) => {
                  e.preventDefault()
                  localStorage.removeItem("user")
                  window.location.href = "/login"
                }}
                className="text-gray-600 hover:text-gray-900 text-sm"
              >
                Logout
              </Link>
            </div>
          </div>

          {/* Search Bar */}
          <div className="max-w-md">
            <input type="text" placeholder="Search products..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Products Grid */}
        {filteredProducts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600 text-lg">{searchQuery ? "No products found matching your search." : "No products available at the moment."}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProducts.map((product) => {
              const productImage = product.images?.[0] || product.image || null
              const productId = product._id || product.id

              return (
                <div key={productId} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-200">
                  {/* Product Image */}
                  <div className="aspect-w-16 aspect-h-9 bg-gray-200">
                    {productImage ? (
                      <img
                        src={productImage.startsWith("http") ? productImage : `http://localhost:8080${productImage}`}
                        alt={product.name}
                        className="w-full h-48 object-cover"
                        onError={(e) => {
                          e.target.src = "https://via.placeholder.com/400x300?text=No+Image"
                        }}
                      />
                    ) : (
                      <div className="w-full h-48 flex items-center justify-center bg-gray-100 text-gray-400">No Image</div>
                    )}
                  </div>

                  {/* Product Info */}
                  <div className="p-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">{product.name}</h3>
                    {product.description && <div className="text-sm text-gray-600 mb-3 line-clamp-2 prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(product.description) }} />}

                    <div className="flex items-center justify-between mb-3">
                      {product.price && <span className="text-xl font-bold text-blue-600">${product.price}</span>}
                      {product.category?.name && <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">{product.category.name}</span>}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <Link to={`/product/${productId}`} className="flex-1 text-center px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors text-sm font-medium">
                        View Details
                      </Link>
                      <Link to={`/product/${productId}/review`} className="flex-1 text-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium">
                        Write Review
                      </Link>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Results Count */}
        {filteredProducts.length > 0 && (
          <div className="mt-8 text-center text-gray-600">
            <p>
              Showing {filteredProducts.length} of {products.length} product{products.length !== 1 ? "s" : ""}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
