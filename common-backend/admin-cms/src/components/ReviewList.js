import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "../context/AuthContext";

const ReviewList = () => {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:8080";
  const { token, selectedWebsite } = useAuth();

  const [categories, setCategories] = useState([]);
  const [subCategories, setSubCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(false);

  const [filters, setFilters] = useState({
    categoryId: "",
    subCategoryId: "",
    productId: "",
  });

  // Helper to get headers with auth and website context
  const getHeaders = useCallback(() => {
    const headers = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    if (selectedWebsite?._id) {
      headers["X-Website-Id"] = selectedWebsite._id;
    }
    return headers;
  }, [token, selectedWebsite]);

  useEffect(() => {
    if (!selectedWebsite?._id) return;
    
    fetch(`${API_BASE_URL}/api/categories`, {
      headers: getHeaders(),
    })
      .then((res) => res.json())
      .then((data) => {
        // Handle both array and object with categories property
        const cats = Array.isArray(data) ? data : (data.categories || []);
        setCategories(cats);
      })
      .catch((err) => console.error("Error fetching categories:", err));
  }, [API_BASE_URL, getHeaders, selectedWebsite]);

  const loadReviews = useCallback(() => {
    if (!selectedWebsite?._id) return;
    
    setLoading(true);
    let url = `${API_BASE_URL}/api/reviews`;
    const params = [];
    if (filters.categoryId) params.push(`categoryId=${filters.categoryId}`);
    if (filters.subCategoryId) params.push(`subCategoryId=${filters.subCategoryId}`);
    if (filters.productId) params.push(`productId=${filters.productId}`);
    if (params.length > 0) url += "?" + params.join("&");

    fetch(url, {
      headers: getHeaders(),
    })
      .then((res) => res.json())
      .then((data) => {
        // Backend returns { reviews, pagination } object
        const reviewsData = data.reviews || data || [];
        setReviews(Array.isArray(reviewsData) ? reviewsData : []);
      })
      .catch((err) => console.error("Error fetching reviews:", err))
      .finally(() => setLoading(false));
  }, [API_BASE_URL, filters, getHeaders, selectedWebsite]);

  const handleCategoryChange = (e) => {
    const categoryId = e.target.value;
    setFilters({ categoryId, subCategoryId: "", productId: "" });

    if (categoryId) {
      fetch(`${API_BASE_URL}/api/subcategories?categoryId=${categoryId}`, {
        headers: getHeaders(),
      })
        .then((res) => res.json())
        .then((data) => {
          const subs = Array.isArray(data) ? data : (data.subcategories || []);
          setSubCategories(subs);
        })
        .catch((err) => console.error("Error loading subcategories:", err));
    } else {
      setSubCategories([]);
      setProducts([]);
    }
  };

  const handleSubCategoryChange = (e) => {
    const subCategoryId = e.target.value;
    setFilters((prev) => ({ ...prev, subCategoryId, productId: "" }));

    if (subCategoryId) {
      fetch(`${API_BASE_URL}/api/products?subCategoryId=${subCategoryId}`, {
        headers: getHeaders(),
      })
        .then((res) => res.json())
        .then((data) => {
          const prods = Array.isArray(data) ? data : (data.products || []);
          setProducts(prods);
        })
        .catch((err) => console.error("Error loading products:", err));
    } else {
      setProducts([]);
    }
  };

  const handleProductChange = (e) => {
    setFilters((prev) => ({ ...prev, productId: e.target.value }));
  };

  const updateStatus = async (id, status) => {
    try {
      await fetch(`${API_BASE_URL}/api/reviews/${id}/status`, {
        method: "PATCH",
        headers: getHeaders(),
        body: JSON.stringify({ status }),
      });
      loadReviews();
    } catch (err) {
      console.error("Error updating status:", err);
    }
  };

  const deleteReview = async (id) => {
    if (!window.confirm("Are you sure you want to delete this review?")) return;
    try {
      await fetch(`${API_BASE_URL}/api/reviews/${id}`, { 
        method: "DELETE",
        headers: getHeaders(),
      });
      loadReviews();
    } catch (err) {
      console.error("Error deleting review:", err);
    }
  };

  useEffect(() => {
    loadReviews();
  }, [loadReviews]);

  // Show message if no website selected
  if (!selectedWebsite?._id) {
    return (
      <div className="p-4 bg-white rounded shadow max-w-6xl mx-auto">
        <h2 className="text-lg font-bold mb-4">Manage Reviews</h2>
        <p className="text-gray-500">Please select a website first.</p>
      </div>
    );
  }

  return (
    <div className="p-4 bg-white rounded shadow max-w-6xl mx-auto">
      <h2 className="text-lg font-bold mb-4">Manage Reviews</h2>

      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <select
          className="border p-2 rounded"
          value={filters.categoryId}
          onChange={handleCategoryChange}
        >
          <option value="">All Categories</option>
          {categories.map((cat) => (
            <option key={cat._id} value={cat._id}>{cat.name}</option>
          ))}
        </select>

        {subCategories.length > 0 && (
          <select
            className="border p-2 rounded"
            value={filters.subCategoryId}
            onChange={handleSubCategoryChange}
          >
            <option value="">All Subcategories</option>
            {subCategories.map((sub) => (
              <option key={sub._id} value={sub._id}>{sub.name}</option>
            ))}
          </select>
        )}

        {products.length > 0 && (
          <select
            className="border p-2 rounded"
            value={filters.productId}
            onChange={handleProductChange}
          >
            <option value="">All Products</option>
            {products.map((prod) => (
              <option key={prod._id} value={prod._id}>{prod.name}</option>
            ))}
          </select>
        )}

        <button
          onClick={loadReviews}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Refresh
        </button>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="text-center p-4 text-gray-500">Loading reviews...</div>
      )}

      {/* Card View for Reviews */}
      {!loading && reviews.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {reviews.map((review) => (
            <div key={review._id} className="border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
              {/* User Info */}
              <div className="flex items-center gap-3 mb-3">
                {review.avatar ? (
                  <img
                    src={review.avatar}
                    alt="avatar"
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center text-gray-600 font-bold">
                    {review.name?.charAt(0)?.toUpperCase() || "U"}
                  </div>
                )}
                <div>
                  <p className="font-semibold">{review.name}</p>
                  <p className="text-xs text-gray-500">{review.email}</p>
                </div>
              </div>

              {/* Product */}
              <p className="text-sm text-gray-600 mb-2">
                <span className="font-medium">Product:</span> {review.productName || review.productId?.name || "N/A"}
              </p>

              {/* Rating */}
              <div className="flex items-center gap-1 mb-2">
                <span className="text-yellow-500">{"★".repeat(review.rating)}</span>
                <span className="text-gray-300">{"★".repeat(5 - review.rating)}</span>
                <span className="text-sm text-gray-500 ml-2">({review.rating}/5)</span>
              </div>

              {/* Title */}
              {review.title && (
                <p className="font-medium text-gray-800 mb-1">{review.title}</p>
              )}

              {/* Comment */}
              <p className="text-sm text-gray-700 mb-3 line-clamp-3">{review.comment}</p>

              {/* Product Images */}
              {review.productImages && review.productImages.length > 0 && (
                <div className="flex gap-2 mb-3 overflow-x-auto">
                  {review.productImages.slice(0, 3).map((img, idx) => (
                    <img
                      key={idx}
                      src={img}
                      alt={`review-${idx}`}
                      className="w-16 h-16 object-cover rounded"
                    />
                  ))}
                  {review.productImages.length > 3 && (
                    <div className="w-16 h-16 bg-gray-200 rounded flex items-center justify-center text-gray-600 text-sm">
                      +{review.productImages.length - 3}
                    </div>
                  )}
                </div>
              )}

              {/* Status Badge */}
              <div className="mb-3">
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  review.status === "approved" 
                    ? "bg-green-100 text-green-800" 
                    : review.status === "rejected"
                    ? "bg-red-100 text-red-800"
                    : "bg-yellow-100 text-yellow-800"
                }`}>
                  {review.status?.charAt(0).toUpperCase() + review.status?.slice(1) || "Pending"}
                </span>
                <span className={`ml-2 px-2 py-1 rounded text-xs font-medium ${
                  review.source === "admin" 
                    ? "bg-purple-100 text-purple-800" 
                    : "bg-blue-100 text-blue-800"
                }`}>
                  {review.source === "admin" ? "Admin" : "User"}
                </span>
              </div>

              {/* Actions */}
              <div className="flex gap-2 flex-wrap">
                <button
                  className="bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600"
                  onClick={() => updateStatus(review._id, "approved")}
                >
                  Approve
                </button>
                <button
                  className="bg-yellow-500 text-white px-3 py-1 rounded text-sm hover:bg-yellow-600"
                  onClick={() => updateStatus(review._id, "rejected")}
                >
                  Reject
                </button>
                <button
                  className="bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600"
                  onClick={() => deleteReview(review._id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* No Reviews Message */}
      {!loading && reviews.length === 0 && (
        <div className="text-center p-8 text-gray-500 border rounded-lg">
          <p className="text-lg mb-2">No reviews found</p>
          <p className="text-sm">Reviews created will appear here.</p>
        </div>
      )}

      {/* Table View (Alternative) */}
      {!loading && reviews.length > 0 && (
        <div className="mt-6">
          <h3 className="text-md font-semibold mb-2">Table View</h3>
          <div className="overflow-x-auto">
            <table className="w-full border">
              <thead>
                <tr className="bg-gray-100 border-b">
                  <th className="p-2 border text-left">User</th>
                  <th className="p-2 border text-left">Product</th>
                  <th className="p-2 border text-center">Rating</th>
                  <th className="p-2 border text-left">Comment</th>
                  <th className="p-2 border text-center">Status</th>
                  <th className="p-2 border text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {reviews.map((review) => (
                  <tr key={review._id} className="border-b hover:bg-gray-50">
                    <td className="p-2 border">
                      <div className="flex items-center gap-2">
                        {review.avatar ? (
                          <img
                            src={review.avatar}
                            alt="avatar"
                            className="w-8 h-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-gray-600 text-sm font-bold">
                            {review.name?.charAt(0)?.toUpperCase() || "U"}
                          </div>
                        )}
                        <span>{review.name}</span>
                      </div>
                    </td>
                    <td className="p-2 border">{review.productName || review.productId?.name || "N/A"}</td>
                    <td className="p-2 border text-center">
                      <span className="text-yellow-500">{"★".repeat(review.rating)}</span>
                    </td>
                    <td className="p-2 border max-w-xs truncate">{review.comment}</td>
                    <td className="p-2 border text-center">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        review.status === "approved" 
                          ? "bg-green-100 text-green-800" 
                          : review.status === "rejected"
                          ? "bg-red-100 text-red-800"
                          : "bg-yellow-100 text-yellow-800"
                      }`}>
                        {review.status}
                      </span>
                    </td>
                    <td className="p-2 border text-center">
                      <div className="flex gap-1 justify-center">
                        <button
                          className="bg-green-500 text-white px-2 py-1 rounded text-xs hover:bg-green-600"
                          onClick={() => updateStatus(review._id, "approved")}
                          title="Approve"
                        >
                          ✓
                        </button>
                        <button
                          className="bg-yellow-500 text-white px-2 py-1 rounded text-xs hover:bg-yellow-600"
                          onClick={() => updateStatus(review._id, "rejected")}
                          title="Reject"
                        >
                          ✗
                        </button>
                        <button
                          className="bg-red-500 text-white px-2 py-1 rounded text-xs hover:bg-red-600"
                          onClick={() => deleteReview(review._id)}
                          title="Delete"
                        >
                          🗑
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReviewList;
