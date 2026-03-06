import React, { useState, useEffect, useMemo, useCallback, useRef } from "react"
import api from "../api/axios"
import { PageHeader, AlertMessage, ViewToggle, Pagination, EntityCard, FormField, SearchField, DeleteConfirmationPopup, StatusFilter } from "../common"

/**
 * TestimonialManager Component
 * 
 * Manages customer testimonials with approval workflow, categorization, and import capabilities.
 * Features:
 * - Create, edit, delete testimonials
 * - Approve/reject workflow for pending testimonials
 * - Tag and category management
 * - Import from CSV/JSON
 * - Public/admin view separation
 * - Featured testimonial management
 */
const TestimonialManager = () => {
  // State for testimonials list
  const [testimonials, setTestimonials] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [editingId, setEditingId] = useState(null)

  // Stats state
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    featured: 0,
    averageRating: 0,
  })

  // Form data
  const initialFormData = {
    name: "",
    email: "",
    role: "",
    company: "",
    testimonial: "",
    rating: 5,
    source: "admin",
    sourceUrl: "",
    tags: "",
    category: "general",
    productId: "",
    productName: "",
    status: "approved", // Admin-created testimonials are auto-approved
    isFeatured: false,
    displayOrder: 0,
    photo: null,
    isActive: true, // Active by default
  }

  const [formData, setFormData] = useState(initialFormData)
  const [currentPhotoUrl, setCurrentPhotoUrl] = useState(null)

  // Filter states
  const [statusFilter, setStatusFilter] = useState("all") // Approval status: all, pending, approved, rejected
  const [activeStatusFilter, setActiveStatusFilter] = useState("all") // Entity status: all, active, inactive, deleted
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [ratingFilter, setRatingFilter] = useState("all")
  const [sourceFilter, setSourceFilter] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("")

  // Import modal state
  const [showImportModal, setShowImportModal] = useState(false)
  const [importData, setImportData] = useState("")
  const [importLoading, setImportLoading] = useState(false)

  // Confirmation popup states
  const [deletePopup, setDeletePopup] = useState({
    isVisible: false,
    testimonialId: null,
    message: "",
    isPermanentDelete: false,
  })

  const [statusUpdatePopup, setStatusUpdatePopup] = useState({
    isVisible: false,
    testimonialId: null,
    newStatus: null,
    title: "",
    message: "",
  })

  // View and pagination states
  const [viewMode, setViewMode] = useState("card")
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(12)
  const [hasMoreCards, setHasMoreCards] = useState(true)
  const [displayedCards, setDisplayedCards] = useState([])

  // Products for linking
  const [products, setProducts] = useState([])

  // Refs
  const formRef = useRef(null)
  const nameInputRef = useRef(null)
  const photoInputRef = useRef(null)

  // Category and source options
  const categoryOptions = [
    { value: "product", label: "Product" },
    { value: "service", label: "Service" },
    { value: "support", label: "Support" },
    { value: "delivery", label: "Delivery" },
    { value: "quality", label: "Quality" },
    { value: "value", label: "Value" },
    { value: "general", label: "General" },
  ]

  const sourceOptions = [
    { value: "website", label: "Website" },
    { value: "email", label: "Email" },
    { value: "social", label: "Social Media" },
    { value: "import", label: "Import" },
    { value: "admin", label: "Admin" },
    { value: "google", label: "Google" },
    { value: "facebook", label: "Facebook" },
    { value: "trustpilot", label: "Trustpilot" },
    { value: "other", label: "Other" },
  ]

  // Calculate status counts for StatusFilter component
  const calculateStatusCounts = useMemo(() => {
    const counts = {
      total: testimonials.length,
      active: testimonials.filter(t => t.isActive && !t.deleted).length,
      inactive: testimonials.filter(t => !t.isActive && !t.deleted).length,
      deleted: testimonials.filter(t => t.deleted).length,
    }
    return counts
  }, [testimonials])

  // Filter testimonials based on active status filter
  const filteredByActiveStatus = useMemo(() => {
    let filtered = testimonials

    switch (activeStatusFilter) {
      case "active":
        filtered = testimonials.filter(t => t.isActive && !t.deleted)
        break
      case "inactive":
        filtered = testimonials.filter(t => !t.isActive && !t.deleted)
        break
      case "deleted":
        filtered = testimonials.filter(t => t.deleted)
        break
      default:
        // "all" - no filtering
        break
    }

    return filtered
  }, [testimonials, activeStatusFilter])

  // Normalize image URL helper
  const normalizeImageUrl = (imageUrl) => {
    if (!imageUrl) return null
    if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
      if (imageUrl.includes("/backend/uploads/") || imageUrl.includes("/Users/")) {
        const filename = imageUrl.split("/").pop()
        return `http://localhost:8080/uploads/${filename}`
      }
      return imageUrl
    }
    if (imageUrl.includes("/backend/uploads/") || imageUrl.includes("/Users/")) {
      const filename = imageUrl.split("/").pop()
      return `http://localhost:8080/uploads/${filename}`
    }
    if (imageUrl.startsWith("/uploads/") || imageUrl.startsWith("/")) {
      return `http://localhost:8080${imageUrl}`
    }
    return `http://localhost:8080/uploads/${imageUrl}`
  }

  // Fetch testimonials
  const fetchTestimonials = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        showInactive: "true",
        includeDeleted: "true",
        limit: "1000", // Fetch all testimonials
      })

      if (statusFilter && statusFilter !== "all") {
        params.append("status", statusFilter)
      }
      if (categoryFilter && categoryFilter !== "all") {
        params.append("category", categoryFilter)
      }
      if (ratingFilter && ratingFilter !== "all") {
        params.append("rating", ratingFilter)
      }
      if (sourceFilter && sourceFilter !== "all") {
        params.append("source", sourceFilter)
      }
      if (debouncedSearchQuery.trim()) {
        params.append("search", debouncedSearchQuery.trim())
      }

      const response = await api.get(`/testimonials?${params.toString()}`)
      const testimonialsData = response.data.testimonials || response.data || []

      // Process testimonials to normalize image URLs
      const processedTestimonials = (Array.isArray(testimonialsData) ? testimonialsData : []).map((t) => ({
        ...t,
        photo: t.photo ? normalizeImageUrl(t.photo) : null,
      }))

      setTestimonials(processedTestimonials)
      setError("")
    } catch (err) {
      console.error("Error fetching testimonials:", err)
      setError(`Failed to fetch testimonials: ${err.response?.data?.msg || err.message}`)
    } finally {
      setLoading(false)
    }
  }, [statusFilter, categoryFilter, ratingFilter, sourceFilter, debouncedSearchQuery])

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const response = await api.get("/testimonials/admin/stats")
      setStats(response.data)
    } catch (err) {
      console.error("Error fetching stats:", err)
    }
  }, [])

  // Fetch products for linking
  const fetchProducts = async () => {
    try {
      const response = await api.get("/products?limit=1000")
      const productsData = response.data.products || response.data || []
      setProducts(Array.isArray(productsData) ? productsData : [])
    } catch (err) {
      console.error("Error fetching products:", err)
    }
  }

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery)
    }, 500)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Fetch data on mount and when filters change
  useEffect(() => {
    fetchTestimonials()
    fetchStats()
  }, [fetchTestimonials, fetchStats])

  useEffect(() => {
    fetchProducts()
  }, [])

  // Handle form changes
  const handleChange = (e) => {
    const { name, value, type, checked, files } = e.target

    if (type === "checkbox") {
      setFormData((prev) => ({ ...prev, [name]: checked }))
    } else if (type === "file") {
      if (files[0]) {
        setFormData((prev) => ({ ...prev, [name]: files[0] }))
        setCurrentPhotoUrl(URL.createObjectURL(files[0]))
      }
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }))

      // Auto-set product name when product is selected
      if (name === "productId") {
        const selectedProduct = products.find((p) => p._id === value || p.id === value)
        setFormData((prev) => ({
          ...prev,
          productName: selectedProduct?.name || "",
        }))
      }
    }
  }

  // Handle rating change
  const handleRatingChange = (rating) => {
    setFormData((prev) => ({ ...prev, rating }))
  }

  // Render star rating input
  const renderStarRating = (currentRating, onChange) => (
    <div className="makeFlex gap5">
      {[1, 2, 3, 4, 5].map((star) => (
        <span
          key={star}
          className={`cursorPointer font24 ${star <= currentRating ? "yellowText" : "grayText"}`}
          onClick={() => onChange(star)}
          style={{ userSelect: "none" }}
        >
          ★
        </span>
      ))}
      {currentRating > 0 && (
        <span className="font14 grayText paddingLeft10">
          {currentRating} star{currentRating !== 1 ? "s" : ""}
        </span>
      )}
    </div>
  )

  // Render star rating display
  const renderStarDisplay = (rating) => (
    <div className="makeFlex gap5 alignCenter">
      {[1, 2, 3, 4, 5].map((star) => (
        <span key={star} className={`font16 ${star <= rating ? "yellowText" : "grayText"}`}>
          ★
        </span>
      ))}
      <span className="font14 grayText paddingLeft5">({rating})</span>
    </div>
  )

  // Handle form submit
  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      setLoading(true)
      setError("")
      setSuccess("")

      // Validation
      if (!formData.name || !formData.testimonial) {
        setError("Please fill in the required fields (name, testimonial)")
        return
      }

      if (formData.rating < 1 || formData.rating > 5) {
        setError("Rating must be between 1 and 5")
        return
      }

      const formDataToSend = new FormData()
      formDataToSend.append("name", formData.name)
      formDataToSend.append("email", formData.email || "")
      formDataToSend.append("role", formData.role || "")
      formDataToSend.append("company", formData.company || "")
      formDataToSend.append("testimonial", formData.testimonial)
      formDataToSend.append("rating", formData.rating.toString())
      formDataToSend.append("source", formData.source)
      formDataToSend.append("sourceUrl", formData.sourceUrl || "")
      formDataToSend.append("tags", formData.tags || "")
      formDataToSend.append("category", formData.category)
      formDataToSend.append("productId", formData.productId || "")
      formDataToSend.append("productName", formData.productName || "")
      formDataToSend.append("status", formData.status)
      formDataToSend.append("isFeatured", formData.isFeatured.toString())
      formDataToSend.append("displayOrder", formData.displayOrder.toString())
      formDataToSend.append("isActive", formData.isActive.toString())

      // Handle photo
      if (formData.photo && typeof formData.photo !== "string") {
        formDataToSend.append("photo", formData.photo)
      } else if (editingId && formData.photo === null) {
        formDataToSend.append("photo", "")
      }

      let response
      if (editingId) {
        response = await api.put(`/testimonials/${editingId}`, formDataToSend, {
          headers: { "Content-Type": "multipart/form-data" },
        })
        setSuccess("Testimonial updated successfully!")
      } else {
        response = await api.post("/testimonials", formDataToSend, {
          headers: { "Content-Type": "multipart/form-data" },
        })
        setSuccess("Testimonial created successfully!")
      }

      await fetchTestimonials()
      await fetchStats()
      resetForm()
    } catch (err) {
      console.error("Testimonial save error:", err)
      const errorMessage = err.response?.data?.msg || err.response?.data?.error || err.message
      setError(`Failed to ${editingId ? "update" : "create"} testimonial: ${errorMessage}`)
    } finally {
      setLoading(false)
    }
  }

  // Reset form
  const resetForm = () => {
    setFormData(initialFormData)
    setCurrentPhotoUrl(null)
    setEditingId(null)
    setError("")
    if (photoInputRef.current) {
      photoInputRef.current.value = ""
    }
  }

  // Handle remove photo
  const handleRemovePhoto = () => {
    setFormData((prev) => ({ ...prev, photo: null }))
    setCurrentPhotoUrl(null)
    if (photoInputRef.current) {
      photoInputRef.current.value = ""
    }
  }

  // Handle edit
  const handleEdit = (testimonial) => {
    const photoUrl = testimonial.photo ? normalizeImageUrl(testimonial.photo) : null

    setFormData({
      name: testimonial.name || "",
      email: testimonial.email || "",
      role: testimonial.role || "",
      company: testimonial.company || "",
      testimonial: testimonial.testimonial || "",
      rating: testimonial.rating || 5,
      source: testimonial.source || "admin",
      sourceUrl: testimonial.sourceUrl || "",
      tags: Array.isArray(testimonial.tags) ? testimonial.tags.join(", ") : "",
      category: testimonial.category || "general",
      productId: testimonial.productId?._id || testimonial.productId || "",
      productName: testimonial.productName || "",
      status: testimonial.status || "approved",
      isFeatured: testimonial.isFeatured || false,
      displayOrder: testimonial.displayOrder || 0,
      photo: testimonial.photo || null,
      isActive: testimonial.isActive !== false, // Default to true if undefined
    })

    setCurrentPhotoUrl(photoUrl)
    setEditingId(testimonial._id || testimonial.id)
    setError("")
    setSuccess("")

    setTimeout(() => {
      if (formRef.current) {
        formRef.current.scrollIntoView({ behavior: "smooth", block: "start" })
      }
      if (nameInputRef.current) {
        nameInputRef.current.focus()
      }
    }, 100)
  }

  // Handle delete
  const handleDelete = async (testimonialId) => {
    const testimonial = testimonials.find((t) => t._id === testimonialId)
    const isAlreadyDeleted = testimonial?.deleted

    let message
    let isPermanentDelete = false

    if (isAlreadyDeleted) {
      message = "This testimonial is already marked as deleted. Click OK to permanently remove it. This action cannot be undone."
      isPermanentDelete = true
    } else {
      message = "This will mark the testimonial as inactive. Click OK to continue."
      isPermanentDelete = false
    }

    setDeletePopup({
      isVisible: true,
      testimonialId,
      message,
      isPermanentDelete,
    })
  }

  // Handle delete confirmation
  const handleDeleteConfirm = async () => {
    const { testimonialId, isPermanentDelete } = deletePopup

    try {
      setLoading(true)
      setSuccess("")
      setError("")

      if (isPermanentDelete) {
        await api.delete(`/testimonials/${testimonialId}/hard`)
        setSuccess("Testimonial has been permanently deleted.")
      } else {
        await api.delete(`/testimonials/${testimonialId}`)
        setSuccess("Testimonial has been marked as deleted.")
      }

      await fetchTestimonials()
      await fetchStats()
    } catch (err) {
      setError(`Failed to delete testimonial: ${err.response?.data?.msg || "Please try again."}`)
    } finally {
      setLoading(false)
      setDeletePopup({
        isVisible: false,
        testimonialId: null,
        message: "",
        isPermanentDelete: false,
      })
    }
  }

  // Handle delete cancellation
  const handleDeleteCancel = () => {
    setDeletePopup({
      isVisible: false,
      testimonialId: null,
      message: "",
      isPermanentDelete: false,
    })
  }

  // Handle status update
  const handleStatusUpdate = (testimonialId, newStatus) => {
    const statusAction = newStatus === "approved" ? "approve" : newStatus === "rejected" ? "reject" : "set to pending"
    const statusTitle = newStatus === "approved" ? "Approve Testimonial" : newStatus === "rejected" ? "Reject Testimonial" : "Update Status"

    setStatusUpdatePopup({
      isVisible: true,
      testimonialId,
      newStatus,
      title: statusTitle,
      message: `Are you sure you want to ${statusAction} this testimonial?`,
    })
  }

  // Handle status update confirmation
  const handleStatusUpdateConfirm = async () => {
    const { testimonialId, newStatus } = statusUpdatePopup

    try {
      setLoading(true)
      setSuccess("")
      setError("")

      await api.patch(`/testimonials/${testimonialId}/status`, { status: newStatus })
      setSuccess(`Testimonial status updated to ${newStatus} successfully!`)

      await fetchTestimonials()
      await fetchStats()
    } catch (err) {
      setError(`Failed to update status: ${err.response?.data?.msg || "Please try again."}`)
    } finally {
      setLoading(false)
      setStatusUpdatePopup({
        isVisible: false,
        testimonialId: null,
        newStatus: null,
        title: "",
        message: "",
      })
    }
  }

  // Handle status update cancellation
  const handleStatusUpdateCancel = () => {
    setStatusUpdatePopup({
      isVisible: false,
      testimonialId: null,
      newStatus: null,
      title: "",
      message: "",
    })
  }

  // Handle toggle featured
  const handleToggleFeatured = async (testimonialId) => {
    try {
      setLoading(true)
      await api.patch(`/testimonials/${testimonialId}/featured`)
      await fetchTestimonials()
      await fetchStats()
      setSuccess("Featured status updated!")
    } catch (err) {
      setError(`Failed to update featured status: ${err.response?.data?.msg || "Please try again."}`)
    } finally {
      setLoading(false)
    }
  }

  // Handle import
  const handleImport = async () => {
    try {
      setImportLoading(true)
      setError("")

      // Parse the import data (expecting JSON array)
      let parsedData
      try {
        parsedData = JSON.parse(importData)
      } catch {
        setError("Invalid JSON format. Please provide a valid JSON array of testimonials.")
        return
      }

      if (!Array.isArray(parsedData)) {
        setError("Import data must be a JSON array of testimonials.")
        return
      }

      const response = await api.post("/testimonials/admin/import", { testimonials: parsedData })
      setSuccess(`Successfully imported ${response.data.imported} testimonials!`)
      setShowImportModal(false)
      setImportData("")
      await fetchTestimonials()
      await fetchStats()
    } catch (err) {
      setError(`Import failed: ${err.response?.data?.msg || err.message}`)
    } finally {
      setImportLoading(false)
    }
  }

  // Get status badge color
  const getStatusBadgeColor = (status) => {
    switch (status) {
      case "approved":
        return "greenText"
      case "pending":
        return "yellowText"
      case "rejected":
        return "redText"
      default:
        return "grayText"
    }
  }

  // Get source badge color
  const getSourceBadgeColor = (source) => {
    const colors = {
      admin: "blueText",
      user: "purpleText",
      website: "purpleText",
      email: "orangeText",
      social: "pinkText",
      google: "redText",
      facebook: "blueText",
      trustpilot: "greenText",
      import: "grayText",
      other: "grayText",
    }
    return colors[source] || "grayText"
  }

  // Pagination calculations
  const filteredTestimonials = filteredByActiveStatus
  const totalPages = Math.ceil(filteredTestimonials.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentTestimonials = filteredTestimonials.slice(startIndex, endIndex)

  // Card lazy loading logic
  useEffect(() => {
    if (viewMode === "card") {
      const initialCards = filteredTestimonials.slice(0, 12)
      setDisplayedCards(initialCards)
      setHasMoreCards(filteredTestimonials.length > 12)
      setCurrentPage(1)
    }
  }, [viewMode, filteredTestimonials])

  // Handle page change
  const handlePageChange = useCallback((pageNumber) => {
    setCurrentPage(pageNumber)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }, [])

  // Handle lazy loading for card view
  const handleLoadMoreCards = useCallback(() => {
    setDisplayedCards((prevCards) => {
      const currentCardCount = prevCards.length
      const nextCards = filteredTestimonials.slice(currentCardCount, currentCardCount + 12)

      if (nextCards.length > 0) {
        setHasMoreCards(currentCardCount + nextCards.length < filteredTestimonials.length)
        return [...prevCards, ...nextCards]
      } else {
        setHasMoreCards(false)
        return prevCards
      }
    })
  }, [filteredTestimonials])

  // Handle view mode change
  const handleViewModeChange = useCallback(
    (mode) => {
      setViewMode(mode)
      setCurrentPage(1)
      if (mode === "card") {
        const initialCards = filteredTestimonials.slice(0, 12)
        setDisplayedCards(initialCards)
        setHasMoreCards(filteredTestimonials.length > 12)
      }
    },
    [filteredTestimonials]
  )

  return (
    <div className="paddingAll20">
      {/* Header */}
      <PageHeader
        title="Testimonial Management"
        subtitle="Manage customer testimonials and reviews"
        isEditing={!!editingId}
        editText="Edit Testimonial"
        createText="Add New Testimonial"
      />

      {/* Stats Cards */}
      <div className="statsContainer makeFlex gap20 wrap appendBottom30">
        <div className="statCard" style={{ flex: 1, minWidth: "150px", padding: "20px", backgroundColor: "#f0f9ff", borderRadius: "8px", textAlign: "center" }}>
          <p className="font32 fontBold blueText">{stats.total}</p>
          <p className="font14 grayText">Total</p>
        </div>
        <div className="statCard" style={{ flex: 1, minWidth: "150px", padding: "20px", backgroundColor: "#fef3c7", borderRadius: "8px", textAlign: "center" }}>
          <p className="font32 fontBold orangeText">{stats.pending}</p>
          <p className="font14 grayText">Pending</p>
        </div>
        <div className="statCard" style={{ flex: 1, minWidth: "150px", padding: "20px", backgroundColor: "#d1fae5", borderRadius: "8px", textAlign: "center" }}>
          <p className="font32 fontBold greenText">{stats.approved}</p>
          <p className="font14 grayText">Approved</p>
        </div>
        <div className="statCard" style={{ flex: 1, minWidth: "150px", padding: "20px", backgroundColor: "#fee2e2", borderRadius: "8px", textAlign: "center" }}>
          <p className="font32 fontBold redText">{stats.rejected}</p>
          <p className="font14 grayText">Rejected</p>
        </div>
        <div className="statCard" style={{ flex: 1, minWidth: "150px", padding: "20px", backgroundColor: "#fdf4ff", borderRadius: "8px", textAlign: "center" }}>
          <p className="font32 fontBold purpleText">{stats.featured}</p>
          <p className="font14 grayText">Featured</p>
        </div>
        <div className="statCard" style={{ flex: 1, minWidth: "150px", padding: "20px", backgroundColor: "#f5f5f5", borderRadius: "8px", textAlign: "center" }}>
          <p className="font32 fontBold yellowText">★ {stats.averageRating?.toFixed(1) || "0.0"}</p>
          <p className="font14 grayText">Avg Rating</p>
        </div>
      </div>

      {/* Success/Error Messages */}
      <AlertMessage type="success" message={success} onClose={() => setSuccess("")} autoClose={true} />
      <AlertMessage type="error" message={error} onClose={() => setError("")} autoClose={true} />

      {/* Form */}
      <div className="brandFormContainer paddingAll32 appendBottom30" ref={formRef}>
        <form onSubmit={handleSubmit} className="brandForm">
          <h3 className="font20 fontBold appendBottom20">Testimonial Details</h3>

          {/* Customer Information */}
          <div className="makeFlex row gap10 appendBottom16">
            <div className="flexOne">
              <FormField
                ref={nameInputRef}
                type="text"
                name="name"
                label="Customer Name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Enter customer name"
                required={true}
              />
            </div>
            <div className="flexOne">
              <FormField
                type="email"
                name="email"
                label="Email (Optional)"
                value={formData.email}
                onChange={handleChange}
                placeholder="Enter email address"
              />
            </div>
          </div>

          <div className="makeFlex row gap10 appendBottom16">
            <div className="flexOne">
              <FormField
                type="text"
                name="role"
                label="Role/Position (Optional)"
                value={formData.role}
                onChange={handleChange}
                placeholder="e.g., Marketing Manager"
              />
            </div>
            <div className="flexOne">
              <FormField
                type="text"
                name="company"
                label="Company (Optional)"
                value={formData.company}
                onChange={handleChange}
                placeholder="Enter company name"
              />
            </div>
          </div>

          {/* Photo Upload */}
          <div className="makeFlex row gap10 appendBottom16">
            <div className="fullWidth">
              <FormField
                ref={photoInputRef}
                type="file"
                name="photo"
                label="Customer Photo (Optional)"
                onChange={handleChange}
                accept="image/*"
                info="Supported formats: JPG, PNG, GIF, WEBP (Max size: 5MB)"
              />
              {currentPhotoUrl && (
                <div className="paddingTop8">
                  <p className="font14 textUppercase blackText fontSemiBold" style={{ marginBottom: "10px" }}>
                    Current photo:
                  </p>
                  <img
                    src={currentPhotoUrl}
                    alt="Current photo"
                    style={{
                      maxWidth: "100px",
                      maxHeight: "100px",
                      objectFit: "cover",
                      borderRadius: "50%",
                      marginTop: "8px",
                    }}
                    onError={(e) => (e.target.style.display = "none")}
                  />
                  <div>
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      className="btnSecondary"
                      style={{
                        padding: "4px 12px",
                        fontSize: "12px",
                        backgroundColor: "#ff4444",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                        marginTop: "10px",
                      }}
                    >
                      Remove Photo
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Rating */}
          <div className="makeFlex row gap10 appendBottom16">
            <div className="fullWidth">
              <label className="formLabel appendBottom10">
                Rating <span className="redText">*</span>
              </label>
              {renderStarRating(formData.rating, handleRatingChange)}
            </div>
          </div>

          {/* Testimonial Text */}
          <div className="makeFlex row gap10 appendBottom16">
            <div className="fullWidth">
              <FormField
                type="textarea"
                name="testimonial"
                label="Testimonial Text"
                value={formData.testimonial}
                onChange={handleChange}
                placeholder="Enter the testimonial text..."
                required={true}
                rows={4}
              />
            </div>
          </div>

          {/* Source and Category */}
          <div className="makeFlex row gap10 appendBottom16">
            <div className="flexOne">
              <FormField
                type="select"
                name="source"
                label="Source"
                value={formData.source}
                onChange={handleChange}
                options={[
                  { value: "", label: "Select Source" },
                  ...sourceOptions,
                ]}
              />
            </div>
            <div className="flexOne">
              <FormField
                type="text"
                name="sourceUrl"
                label="Source URL (Optional)"
                value={formData.sourceUrl}
                onChange={handleChange}
                placeholder="e.g., https://google.com/reviews/..."
              />
            </div>
            <div className="flexOne">
              <FormField
                type="select"
                name="category"
                label="Category"
                value={formData.category}
                onChange={handleChange}
                options={[
                  { value: "", label: "Select Category" },
                  ...categoryOptions,
                ]}
              />
            </div>
          </div>

          {/* Tags and Product */}
          <div className="makeFlex row gap10 appendBottom16">
            <div className="flexOne">
              <FormField
                type="text"
                name="tags"
                label="Tags (comma-separated)"
                value={formData.tags}
                onChange={handleChange}
                placeholder="e.g., quality, fast-delivery, great-service"
              />
            </div>
            <div className="flexOne">
              <FormField
                type="select"
                name="productId"
                label="Related Product (Optional)"
                value={formData.productId}
                onChange={handleChange}
                options={[
                  { value: "", label: "Select Product" },
                  ...products.map((p) => ({
                    value: p._id || p.id,
                    label: p.name,
                  })),
                ]}
              />
            </div>
          </div>

          {/* Status and Featured */}
          <div className="makeFlex row gap10 appendBottom16">
            <div className="flexOne">
              <FormField
                type="select"
                name="status"
                label="Status"
                value={formData.status}
                onChange={handleChange}
                options={[
                  { value: "approved", label: "Approved" },
                  { value: "pending", label: "Pending" },
                  { value: "rejected", label: "Rejected" },
                ]}
              />
            </div>
            <div className="flexOne">
              <FormField
                type="number"
                name="displayOrder"
                label="Display Order"
                value={formData.displayOrder}
                onChange={handleChange}
                placeholder="0"
                min={0}
              />
            </div>
            <div className="flexOne makeFlex alignCenter">
              <label className="makeFlex alignCenter gap10 cursorPointer">
                <input
                  type="checkbox"
                  name="isFeatured"
                  checked={formData.isFeatured}
                  onChange={handleChange}
                  style={{ width: "20px", height: "20px" }}
                />
                <span className="font14">Featured Testimonial</span>
              </label>
            </div>
          </div>

          {/* Active Status */}
          <div className="makeFlex row gap10 appendBottom16">
            <div className="makeFlex column flexOne">
              <label className="formLabel appendBottom10">Active Status:</label>
              <label className="formLabel appendBottom8 makeFlex gap10">
                <FormField
                  type="checkbox"
                  name="isActive"
                  value={formData.isActive}
                  onChange={handleChange}
                />
                Active
              </label>
              <p className="negativeMarginTop10 font12 grayText">Check this box to keep the testimonial active, uncheck to mark as inactive</p>
            </div>
          </div>

          {/* Form Actions */}
          <div className="formActions paddingTop16">
            <button type="submit" disabled={loading} className="btnPrimary">
              {loading ? <span className="loadingSpinner">Processing...</span> : <span>{editingId ? "Update Testimonial" : "Add Testimonial"}</span>}
            </button>

            {editingId && (
              <button type="button" onClick={resetForm} className="btnSecondary">
                Cancel
              </button>
            )}

            <button type="button" onClick={() => setShowImportModal(true)} className="btnSecondary" style={{ marginLeft: "auto" }}>
              Import Testimonials
            </button>
          </div>
        </form>
      </div>

      {/* Testimonials List */}
      <div className="brandsListContainer paddingAll32">
        <div className="listHeader makeFlex spaceBetween end appendBottom24">
          <div className="leftSection">
            <h2 className="listTitle font30 fontBold blackText appendBottom16">Testimonials ({filteredTestimonials.length})</h2>
            
            {/* Entity Status Filter (Active/Inactive/Deleted) */}
            <StatusFilter
              statusFilter={activeStatusFilter}
              onStatusChange={setActiveStatusFilter}
              counts={calculateStatusCounts}
              disabled={loading}
            />

            <div className="makeFlex row gap10 appendBottom20 appendTop16 wrap">
              <div className="minWidth150">
                <FormField
                  type="select"
                  name="statusFilter"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  options={[
                    { value: "all", label: "All Status" },
                    { value: "pending", label: "Pending" },
                    { value: "approved", label: "Approved" },
                    { value: "rejected", label: "Rejected" },
                  ]}
                />
              </div>
              <div className="minWidth150">
                <FormField
                  type="select"
                  name="categoryFilter"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  options={[
                    { value: "all", label: "All Categories" },
                    ...categoryOptions,
                  ]}
                />
              </div>
              <div className="minWidth150">
                <FormField
                  type="select"
                  name="sourceFilter"
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value)}
                  options={[
                    { value: "all", label: "All Sources" },
                    ...sourceOptions,
                  ]}
                />
              </div>
              <div className="minWidth150">
                <FormField
                  type="select"
                  name="ratingFilter"
                  value={ratingFilter}
                  onChange={(e) => setRatingFilter(e.target.value)}
                  options={[
                    { value: "all", label: "All Ratings" },
                    { value: "5", label: "5 Stars" },
                    { value: "4", label: "4 Stars" },
                    { value: "3", label: "3 Stars" },
                    { value: "2", label: "2 Stars" },
                    { value: "1", label: "1 Star" },
                  ]}
                />
              </div>
            </div>
          </div>
          <div className="rightSection makeFlex end gap10">
            <SearchField value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search testimonials..." disabled={loading} minWidth="250px" />
            {loading && <div className="loadingIndicator grayText">Loading...</div>}
            <ViewToggle viewMode={viewMode} onViewChange={handleViewModeChange} disabled={loading} />
          </div>
        </div>

        {loading && !testimonials.length ? (
          <div className="textCenter paddingAll40">
            <p className="font16 grayText">Loading testimonials...</p>
          </div>
        ) : filteredTestimonials.length === 0 ? (
          <div className="textCenter paddingAll40">
            <p className="font16 grayText">No testimonials found</p>
          </div>
        ) : viewMode === "card" ? (
          <div className="brandsGrid">
            {displayedCards.map((testimonial) => (
              <EntityCard
                key={testimonial._id || testimonial.id}
                entity={testimonial}
                imageField="photo"
                imageAltField="name"
                showImage={true}
                titleField="name"
                subtitleField="company"
                idField="_id"
                showId={false}
                renderHeader={(t) => (
                  <div className="entityCardHeader makeFlex top gap10">
                    {t.photo && (
                      <div className="entityLogo">
                        <img
                          src={t.photo}
                          alt={t.name}
                          className="entityLogoImage"
                          style={{ borderRadius: "50%", width: "60px", height: "60px", objectFit: "cover" }}
                          onError={(e) => (e.target.style.display = "none")}
                        />
                      </div>
                    )}
                    <div className="entityInfo flexOne">
                      <h3 className="entityName font18 fontBold blackText appendBottom4">
                        {t.name}
                        {t.isFeatured && <span className="yellowText paddingLeft5">★</span>}
                      </h3>
                      {(t.role || t.company) && (
                        <p className="font12 grayText appendBottom4">
                          {t.role}
                          {t.role && t.company && " at "}
                          {t.company}
                        </p>
                      )}
                      <div className="makeFlex gap10 appendBottom4 wrap">
                        <span className={`font12 ${getStatusBadgeColor(t.status)}`}>{t.status?.toUpperCase()}</span>
                        <span className={`font12 ${getSourceBadgeColor(t.source)}`}>{t.source?.toUpperCase()}</span>
                        <span className="font12 grayText">{t.category?.toUpperCase()}</span>
                        <span className={`font12 ${t.deleted ? 'redText' : (t.isActive ? 'greenText' : 'grayText')}`}>
                          {t.deleted ? 'DELETED' : (t.isActive ? 'ACTIVE' : 'INACTIVE')}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
                renderDetails={(t) => (
                  <div>
                    <div className="appendBottom10">{renderStarDisplay(t.rating)}</div>
                    <div className="appendBottom10">
                      <p className="font14 blackText" style={{ lineHeight: "1.5" }}>
                        "{t.testimonial?.substring(0, 150)}
                        {t.testimonial?.length > 150 ? "..." : ""}"
                      </p>
                    </div>
                    {t.tags && t.tags.length > 0 && (
                      <div className="appendBottom10 makeFlex gap5 wrap">
                        {t.tags.map((tag, idx) => (
                          <span key={idx} className="font12" style={{ padding: "2px 8px", backgroundColor: "#f0f0f0", borderRadius: "4px" }}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    {t.productName && (
                      <div className="appendBottom10">
                        <p className="font12 grayText">Product: {t.productName}</p>
                      </div>
                    )}
                    <div>
                      <p className="font12 grayText">Created: {new Date(t.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                )}
                renderActions={(t) => (
                  <div className="entityCardActions makeFlex gap10 wrap">
                    {t.status === "pending" && (
                      <>
                        <button onClick={() => handleStatusUpdate(t._id || t.id, "approved")} className="btnSuccess flexOne" disabled={loading}>
                          ✓ Approve
                        </button>
                        <button onClick={() => handleStatusUpdate(t._id || t.id, "rejected")} className="btnDanger flexOne" disabled={loading}>
                          ✗ Reject
                        </button>
                      </>
                    )}
                    <button onClick={() => handleToggleFeatured(t._id || t.id)} className={t.isFeatured ? "btnWarning flexOne" : "btnSecondary flexOne"} disabled={loading}>
                      {t.isFeatured ? "★ Unfeature" : "☆ Feature"}
                    </button>
                    <button onClick={() => handleEdit(t)} className="btnEdit flexOne" disabled={loading}>
                      ✏️ Edit
                    </button>
                    <button onClick={() => handleDelete(t._id || t.id)} className="btnDelete flexOne" disabled={loading}>
                      🗑️ Delete
                    </button>
                  </div>
                )}
              />
            ))}

            {hasMoreCards && (
              <div className="textCenter paddingTop20 fullWidth">
                <button onClick={handleLoadMoreCards} className="btnSecondary" disabled={loading}>
                  Load More Testimonials
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="brandsListTable">
            <div className="dataTable">
              <table className="fullWidth">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Testimonial</th>
                    <th>Rating</th>
                    <th>Category</th>
                    <th>Status</th>
                    <th>Source</th>
                    <th>Featured</th>
                    <th>Active</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {currentTestimonials.map((t) => (
                    <tr key={t._id || t.id}>
                      <td>
                        <div className="makeFlex gap10 alignCenter">
                          {t.photo && (
                            <img
                              src={t.photo}
                              alt={t.name}
                              style={{
                                width: "40px",
                                height: "40px",
                                borderRadius: "50%",
                                objectFit: "cover",
                              }}
                              onError={(e) => (e.target.style.display = "none")}
                            />
                          )}
                          <div>
                            <p className="font14 fontBold">{t.name}</p>
                            {(t.role || t.company) && (
                              <p className="font12 grayText">
                                {t.role}
                                {t.role && t.company && " at "}
                                {t.company}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        <p className="font14" style={{ maxWidth: "300px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {t.testimonial}
                        </p>
                      </td>
                      <td>{renderStarDisplay(t.rating)}</td>
                      <td>
                        <span className="font12">{t.category}</span>
                      </td>
                      <td>
                        <span className={`font12 ${getStatusBadgeColor(t.status)}`}>{t.status?.toUpperCase()}</span>
                      </td>
                      <td>
                        <span className={`font12 ${getSourceBadgeColor(t.source)}`}>{t.source?.toUpperCase()}</span>
                      </td>
                      <td>
                        <button onClick={() => handleToggleFeatured(t._id || t.id)} className={t.isFeatured ? "btnWarning btnSmall" : "btnSecondary btnSmall"} disabled={loading}>
                          {t.isFeatured ? "★" : "☆"}
                        </button>
                      </td>
                      <td>
                        <span className={`font12 ${t.deleted ? 'redText' : (t.isActive ? 'greenText' : 'grayText')}`}>
                          {t.deleted ? 'Deleted' : (t.isActive ? 'Active' : 'Inactive')}
                        </span>
                      </td>
                      <td>
                        <p className="font12">{new Date(t.createdAt).toLocaleDateString()}</p>
                      </td>
                      <td>
                        <div className="makeFlex gap5">
                          {t.status === "pending" && (
                            <>
                              <button onClick={() => handleStatusUpdate(t._id || t.id, "approved")} className="btnSuccess btnSmall" disabled={loading} title="Approve">
                                ✓
                              </button>
                              <button onClick={() => handleStatusUpdate(t._id || t.id, "rejected")} className="btnDanger btnSmall" disabled={loading} title="Reject">
                                ✗
                              </button>
                            </>
                          )}
                          <button onClick={() => handleEdit(t)} className="btnEdit btnSmall" disabled={loading} title="Edit">
                            ✏️
                          </button>
                          <button onClick={() => handleDelete(t._id || t.id)} className="btnDelete btnSmall" disabled={loading} title="Delete">
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="paddingTop20">
                <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={handlePageChange} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delete Confirmation Popup */}
      <DeleteConfirmationPopup
        isVisible={deletePopup.isVisible}
        message={deletePopup.message}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
        isPermanentDelete={deletePopup.isPermanentDelete}
      />

      {/* Status Update Confirmation Popup */}
      {statusUpdatePopup.isVisible && (
        <div className="modalOverlay" onClick={handleStatusUpdateCancel}>
          <div className="modalContent" onClick={(e) => e.stopPropagation()}>
            <div style={{ borderBottom: "1px solid #e5e7eb", paddingBottom: "16px", marginBottom: "16px" }}>
              <h3 className="font20 fontBold" style={{ margin: 0, color: "#111827" }}>
                {statusUpdatePopup.title || "Confirm Status Update"}
              </h3>
            </div>
            <p className="font16 appendBottom24" style={{ color: "#374151", lineHeight: "1.5" }}>
              {statusUpdatePopup.message}
            </p>
            <div className="makeFlex gap10">
              <button
                onClick={handleStatusUpdateConfirm}
                className={statusUpdatePopup.newStatus === "approved" ? "btnSuccess flexOne" : statusUpdatePopup.newStatus === "rejected" ? "btnDanger flexOne" : "btnPrimary flexOne"}
                disabled={loading}
                style={{ padding: "12px 24px", fontSize: "14px", fontWeight: "600" }}
              >
                {loading ? "Processing..." : "Confirm"}
              </button>
              <button onClick={handleStatusUpdateCancel} className="btnSecondary flexOne" style={{ padding: "12px 24px", fontSize: "14px", fontWeight: "600" }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="modalOverlay" onClick={() => setShowImportModal(false)}>
          <div className="modalContent" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "600px", width: "90%" }}>
            <div style={{ borderBottom: "1px solid #e5e7eb", paddingBottom: "16px", marginBottom: "16px" }}>
              <h3 className="font20 fontBold" style={{ margin: 0, color: "#111827" }}>
                Import Testimonials
              </h3>
            </div>
            <p className="font14 grayText appendBottom16">
              Paste a JSON array of testimonials. Each testimonial should have: name, testimonial (required), and optionally: email, role, company, rating, source, tags, category.
            </p>
            <textarea
              value={importData}
              onChange={(e) => setImportData(e.target.value)}
              placeholder={`[
  {
    "name": "John Doe",
    "testimonial": "Great product!",
    "rating": 5,
    "company": "Acme Inc",
    "role": "CEO",
    "category": "product",
    "tags": ["quality", "fast-delivery"]
  }
]`}
              style={{
                width: "100%",
                minHeight: "200px",
                padding: "12px",
                border: "1px solid #d1d5db",
                borderRadius: "8px",
                fontFamily: "monospace",
                fontSize: "12px",
              }}
            />
            <div className="makeFlex gap10 paddingTop16">
              <button onClick={handleImport} className="btnPrimary flexOne" disabled={importLoading || !importData.trim()}>
                {importLoading ? "Importing..." : "Import"}
              </button>
              <button onClick={() => setShowImportModal(false)} className="btnSecondary flexOne">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default TestimonialManager
