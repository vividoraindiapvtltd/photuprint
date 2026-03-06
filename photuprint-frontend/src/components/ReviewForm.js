'use client'

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { useAuth } from "../context/AuthContext"
import api from "../utils/api"

const ReviewForm = () => {
  const router = useRouter()
  const params = useParams()
  const routeProductId = params?.productId
  const { user, isAuthenticated } = useAuth()

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      const redirectPath = routeProductId ? `/product/${routeProductId}/review` : "/review"
      console.log("Not authenticated, redirecting to login with return path:", redirectPath)
      router.push(`/login?from=${encodeURIComponent(redirectPath)}`)
    }
  }, [isAuthenticated, router, routeProductId])

  // Pre-fill user info when authenticated
  useEffect(() => {
    if (user && user.user) {
      setFormData((prev) => ({
        ...prev,
        name: prev.name || user.user.name || user.user.email?.split("@")[0] || "",
        email: prev.email || user.user.email || "",
        userId: user.user.id || user.user._id || "",
      }))
    }
  }, [user])

  const [formData, setFormData] = useState({
    categoryId: "",
    subCategoryId: "",
    productId: routeProductId || "",
    productName: "",
    userId: user?.user?.id || user?.user?._id || "",
    name: user?.user?.name || user?.user?.email?.split("@")[0] || "",
    email: user?.user?.email || "",
    title: "",
    comment: "",
    rating: 0,
    avatar: null,
    productImage: null,
  })

  const [categories, setCategories] = useState([])
  const [subcategories, setSubcategories] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [selectedProduct, setSelectedProduct] = useState(null)

  // Fetch categories on mount
  useEffect(() => {
    fetchCategories()
  }, [])

  // If productId is provided via route, fetch product details
  useEffect(() => {
    if (routeProductId) {
      fetchProductDetails(routeProductId)
    }
  }, [routeProductId])

  // Fetch subcategories when category changes
  useEffect(() => {
    if (formData.categoryId) {
      fetchSubcategories(formData.categoryId)
    } else {
      setSubcategories([])
    }
  }, [formData.categoryId])

  // Fetch products when subcategory changes
  useEffect(() => {
    if (formData.categoryId && formData.subCategoryId) {
      fetchProducts(formData.categoryId, formData.subCategoryId)
    } else {
      setProducts([])
    }
  }, [formData.categoryId, formData.subCategoryId])

  // Auto-set product name when product is selected
  useEffect(() => {
    if (formData.productId && products.length > 0) {
      const product = products.find((p) => p._id === formData.productId)
      if (product) {
        setFormData((prev) => ({
          ...prev,
          productName: product.name || "",
        }))
        setSelectedProduct(product)
      }
    }
  }, [formData.productId, products])

  const fetchCategories = async () => {
    try {
      const response = await api.get("/categories?showInactive=false&includeDeleted=false")
      setCategories(response.data || [])
    } catch (err) {
      console.error("Error fetching categories:", err)
    }
  }

  const fetchSubcategories = async (categoryId) => {
    try {
      const response = await api.get(`/subcategories?category=${categoryId}&showInactive=false&includeDeleted=false`)
      setSubcategories(response.data || [])
    } catch (err) {
      console.error("Error fetching subcategories:", err)
      setSubcategories([])
    }
  }

  const fetchProducts = async (categoryId, subCategoryId) => {
    try {
      const response = await api.get(`/products?categoryId=${categoryId}&subCategoryId=${subCategoryId}&showInactive=false&includeDeleted=false&limit=1000`)
      const productsData = response.data.products || response.data || []
      setProducts(Array.isArray(productsData) ? productsData : [])
    } catch (err) {
      console.error("Error fetching products:", err)
      setProducts([])
    }
  }

  const fetchProductDetails = async (productId) => {
    try {
      setLoading(true)
      setError("")
      console.log("Fetching product with ID:", productId)

      const response = await api.get(`/products/${productId}`)
      const product = response.data
      console.log("Fetched product details:", product)

      if (product) {
        // Extract category and subcategory IDs (they might be objects or strings)
        const categoryId = product.category?._id || product.category || ""
        const subCategoryId = product.subcategory?._id || product.subcategory || ""

        console.log("Setting categoryId:", categoryId, "subCategoryId:", subCategoryId)

        setFormData((prev) => ({
          ...prev,
          productId: product._id || productId,
          productName: product.name || "",
          categoryId: categoryId,
          subCategoryId: subCategoryId,
        }))
        setSelectedProduct(product)

        // Fetch subcategories for the category if needed
        if (categoryId) {
          await fetchSubcategories(categoryId)
        }
      } else {
        console.error("No product data received")
        setError("Product not found. Please check the product ID.")
      }
    } catch (err) {
      console.error("Error fetching product details:", err)
      console.error("Error response:", err.response?.data)
      console.error("Error status:", err.response?.status)

      let errorMessage = "Failed to load product details. "
      if (err.response?.status === 404) {
        errorMessage = "Product not found. Please check the product ID."
      } else if (err.response?.status === 401) {
        errorMessage = "Authentication required. Please login first."
      } else if (err.response?.data?.msg) {
        errorMessage = err.response.data.msg
      } else if (err.message) {
        errorMessage += err.message
      }

      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e) => {
    const { name, value, type, files } = e.target

    if (type === "file") {
      setFormData({ ...formData, [name]: files[0] || null })
    } else {
      setFormData({ ...formData, [name]: value })

      // Clear dependent fields when category/subcategory changes
      if (name === "categoryId") {
        setFormData((prev) => ({
          ...prev,
          subCategoryId: "",
          productId: "",
          productName: "",
        }))
        setProducts([])
      }
      if (name === "subCategoryId") {
        setFormData((prev) => ({
          ...prev,
          productId: "",
          productName: "",
        }))
      }
    }
  }

  const handleRatingChange = (rating) => {
    setFormData({ ...formData, rating })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    setSuccess("")

    try {
      // Check authentication
      if (!isAuthenticated || !user) {
        setError("You must be logged in to submit a review")
        const redirectPath = routeProductId ? `/product/${routeProductId}/review` : "/review"
        router.push(`/login?from=${encodeURIComponent(redirectPath)}`)
        setLoading(false)
        return
      }

      // Validation
      if (!formData.productId) {
        setError("Product is required")
        setLoading(false)
        return
      }

      // Category/subcategory are optional - backend will fetch from product if not provided
      // Only validate if user is manually selecting products (no routeProductId)
      if (!routeProductId && (!formData.categoryId || !formData.subCategoryId)) {
        setError("Please select category, subcategory, and product")
        setLoading(false)
        return
      }
      if (!formData.comment || !formData.rating) {
        setError("Please fill all required fields (comment, rating)")
        setLoading(false)
        return
      }
      if (formData.rating < 1 || formData.rating > 5) {
        setError("Rating must be between 1 and 5")
        setLoading(false)
        return
      }

      const formDataToSend = new FormData()

      // Always send productId
      formDataToSend.append("productId", formData.productId)

      // Send category/subcategory if available
      if (formData.categoryId) {
        formDataToSend.append("categoryId", formData.categoryId)
      }
      if (formData.subCategoryId) {
        formDataToSend.append("subCategoryId", formData.subCategoryId)
      }
      if (formData.productName) {
        formDataToSend.append("productName", formData.productName)
      }
      // Name and email are optional since backend will use authenticated user's info
      if (formData.name) {
        formDataToSend.append("name", formData.name)
      }
      if (formData.title) {
        formDataToSend.append("title", formData.title)
      }
      if (formData.email) {
        formDataToSend.append("email", formData.email)
      }
      formDataToSend.append("comment", formData.comment)
      formDataToSend.append("rating", formData.rating.toString())

      if (formData.avatar) {
        formDataToSend.append("avatar", formData.avatar)
      }
      if (formData.productImage) {
        formDataToSend.append("productImage", formData.productImage)
      }

      const response = await api.post("/reviews", formDataToSend)

      setSuccess("Review submitted successfully! It will be visible after admin approval.")

      // Reset form
      setFormData({
        categoryId: routeProductId ? formData.categoryId : "",
        subCategoryId: routeProductId ? formData.subCategoryId : "",
        productId: routeProductId || "",
        productName: routeProductId ? formData.productName : "",
        userId: "",
        name: "",
        email: "",
        title: "",
        comment: "",
        rating: 0,
        avatar: null,
        productImage: null,
      })

      // Redirect to product page after 2 seconds
      setTimeout(() => {
        if (routeProductId) {
          router.push(`/product/${routeProductId}`)
        } else {
          router.push("/")
        }
      }, 2000)
    } catch (err) {
      console.error("Error submitting review:", err)
      setError(err.response?.data?.msg || err.message || "Failed to submit review. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const renderStarRating = () => {
    return (
      <div className="flex gap-2 items-center">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => handleRatingChange(star)}
            className={`text-2xl cursor-pointer transition-colors ${star <= formData.rating ? "text-yellow-400" : "text-gray-300"} hover:text-yellow-400`}
            style={{ userSelect: "none", background: "none", border: "none", padding: 0 }}
          >
            ★
          </button>
        ))}
        {formData.rating > 0 && (
          <span className="text-sm text-gray-600 ml-2">
            {formData.rating} star{formData.rating !== 1 ? "s" : ""}
          </span>
        )}
      </div>
    )
  }

  // Show loading or redirect if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="text-center py-8">
          <p className="text-gray-600">Redirecting to login...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Write a Review</h1>

      {selectedProduct && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h2 className="font-semibold text-blue-900 mb-2">Reviewing Product:</h2>
          <p className="text-gray-700 font-medium">{selectedProduct.name}</p>
          {selectedProduct.category && (
            <p className="text-sm text-gray-600 mt-1">
              Category: {typeof selectedProduct.category === "object" ? selectedProduct.category.name : "N/A"}
            </p>
          )}
        </div>
      )}

      {routeProductId && loading && !selectedProduct && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg text-center">
          <p className="text-gray-600">Loading product details...</p>
        </div>
      )}

      {error && (
        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">{error}</div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded">{success}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Product Selection - Only show if productId not provided via route */}
        {!routeProductId && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category <span className="text-red-500">*</span>
              </label>
              <select
                name="categoryId"
                value={formData.categoryId}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Category</option>
                {categories.map((cat) => (
                  <option key={cat._id} value={cat._id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Subcategory <span className="text-red-500">*</span>
              </label>
              <select
                name="subCategoryId"
                value={formData.subCategoryId}
                onChange={handleChange}
                required
                disabled={!formData.categoryId}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              >
                <option value="">Select Subcategory</option>
                {subcategories.map((subcat) => (
                  <option key={subcat._id} value={subcat._id}>
                    {subcat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Product <span className="text-red-500">*</span>
              </label>
              <select
                name="productId"
                value={formData.productId}
                onChange={handleChange}
                required
                disabled={!formData.subCategoryId}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              >
                <option value="">Select Product</option>
                {products.map((prod) => (
                  <option key={prod._id} value={prod._id}>
                    {prod.name}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}

        {/* Rating */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Rating <span className="text-red-500">*</span>
          </label>
          {renderStarRating()}
        </div>

        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Your Name (Optional - will use your account name if not provided)
          </label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter your name"
          />
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Email (Optional - will use your account email if not provided)
          </label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter your email"
          />
        </div>

        {/* Title (Optional) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Review Title (Optional)</label>
          <input
            type="text"
            name="title"
            value={formData.title}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Give your review a title"
          />
        </div>

        {/* Comment */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Your Review <span className="text-red-500">*</span>
          </label>
          <textarea
            name="comment"
            value={formData.comment}
            onChange={handleChange}
            required
            rows="5"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Share your experience with this product"
          />
        </div>

        {/* Avatar Upload */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Your Photo (Optional)</label>
          <input
            type="file"
            name="avatar"
            accept="image/*"
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {formData.avatar && <p className="mt-2 text-sm text-gray-600">Selected: {formData.avatar.name}</p>}
        </div>

        {/* Product Image Upload */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Product Photo (Optional)</label>
          <input
            type="file"
            name="productImage"
            accept="image/*"
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {formData.productImage && (
            <p className="mt-2 text-sm text-gray-600">Selected: {formData.productImage.name}</p>
          )}
        </div>

        {/* Show logged in user info */}
        {user && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-sm text-blue-800">
              <strong>Logged in as:</strong> {user.user?.name || user.user?.email}
            </p>
          </div>
        )}

        {/* Submit Button */}
        <div className="flex gap-4">
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {loading ? "Submitting..." : "Submit Review"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}

export default ReviewForm
