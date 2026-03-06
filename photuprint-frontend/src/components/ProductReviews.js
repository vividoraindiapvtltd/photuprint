'use client'

import { useState, useEffect } from "react"
import api from "../utils/api"

const ProductReviews = ({ productId }) => {
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    itemsPerPage: 20,
  })

  useEffect(() => {
    if (productId) {
      fetchReviews()
    }
  }, [productId])

  const fetchReviews = async (page = 1) => {
    if (!productId) return

    try {
      setLoading(true)
      setError("")
      const response = await api.get(`/reviews`, {
        params: {
          productId,
          status: "approved",
          page,
          limit: pagination.itemsPerPage,
        },
      })

      const reviewsData = response.data.reviews || response.data || []
      setReviews(Array.isArray(reviewsData) ? reviewsData : [])

      if (response.data.pagination) {
        setPagination(response.data.pagination)
      }
    } catch (err) {
      console.error("Error fetching reviews:", err)
      setError("Failed to load reviews")
      setReviews([])
    } finally {
      setLoading(false)
    }
  }

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      fetchReviews(newPage)
    }
  }

  const renderStarRating = (rating) => {
    return (
      <div className="flex gap-1 items-center">
        {[1, 2, 3, 4, 5].map((star) => (
          <span key={star} className={`text-lg ${star <= rating ? "text-yellow-400" : "text-gray-300"}`}>
            ★
          </span>
        ))}
        <span className="text-sm text-gray-600 ml-1">({rating})</span>
      </div>
    )
  }

  const formatDate = (dateString) => {
    if (!dateString) return ""
    const date = new Date(dateString)
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  if (loading) {
    return (
      <div className="mt-8">
        <h2 className="text-2xl font-bold mb-4">Customer Reviews</h2>
        <div className="text-center py-8">
          <p className="text-gray-600">Loading reviews...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="mt-8">
        <h2 className="text-2xl font-bold mb-4">Customer Reviews</h2>
        <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded">{error}</div>
      </div>
    )
  }

  return (
    <div className="mt-8">
      <h2 className="text-2xl font-bold mb-4">
        Customer Reviews {pagination.totalItems > 0 && `(${pagination.totalItems})`}
      </h2>

      {reviews.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-600">No reviews yet. Be the first to review this product!</p>
        </div>
      ) : (
        <>
          <div className="space-y-6">
            {reviews.map((review) => (
              <div key={review._id} className="border border-gray-200 rounded-lg p-6 bg-white shadow-sm">
                <div className="flex items-start gap-4">
                  {/* Avatar */}
                  <div className="flex-shrink-0">
                    {review.avatar ? (
                      <img
                        src={review.avatar.startsWith("http") ? review.avatar : `http://localhost:8080${review.avatar}`}
                        alt={review.name}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gray-300 flex items-center justify-center text-gray-600 font-semibold">
                        {review.name?.charAt(0).toUpperCase() || "?"}
                      </div>
                    )}
                  </div>

                  {/* Review Content */}
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-semibold text-lg">{review.name}</h3>
                        {review.title && <p className="text-gray-700 font-medium mt-1">{review.title}</p>}
                      </div>
                      <div className="text-sm text-gray-500">{formatDate(review.createdAt)}</div>
                    </div>

                    {/* Rating */}
                    <div className="mb-3">{renderStarRating(review.rating)}</div>

                    {/* Comment */}
                    <p className="text-gray-700 mb-4 whitespace-pre-wrap">{review.comment}</p>

                    {/* Product Image if available */}
                    {review.productImage && (
                      <div className="mt-4">
                        <img
                          src={review.productImage.startsWith("http") ? review.productImage : `http://localhost:8080${review.productImage}`}
                          alt="Product"
                          className="max-w-xs rounded-lg border border-gray-200"
                        />
                      </div>
                    )}

                    {/* Product Info (if populated) */}
                    {review.productId && typeof review.productId === "object" && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <p className="text-sm text-gray-600">
                          Review for: <span className="font-medium">{review.productId.name}</span>
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-2">
              <button
                onClick={() => handlePageChange(pagination.currentPage - 1)}
                disabled={pagination.currentPage === 1}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-400"
              >
                Previous
              </button>
              <span className="text-gray-600">
                Page {pagination.currentPage} of {pagination.totalPages}
              </span>
              <button
                onClick={() => handlePageChange(pagination.currentPage + 1)}
                disabled={pagination.currentPage === pagination.totalPages}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-400"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default ProductReviews
