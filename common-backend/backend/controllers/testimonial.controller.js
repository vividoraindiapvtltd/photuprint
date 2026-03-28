import Testimonial from "../models/testimonial.model.js"
import cloudinary from "../utils/cloudinary.js"
import { uploadLocalFileToCloudinary, removeLocalFiles } from "../utils/cloudinaryUpload.js"

/**
 * Get all testimonials with filtering, search, and pagination
 * Supports admin view (all statuses) and public view (approved only)
 */
export const getTestimonials = async (req, res) => {
  try {
    const websiteId = req.websiteId || req.tenant?._id
    const isAdmin = req.user && (req.user.role === "admin" || req.user.role === "super_admin")

    const { status, category, rating, source, isFeatured, tags, search, showInactive = "true", includeDeleted = "false", sortBy = "createdAt", sortOrder = "desc", page = 1, limit = 20 } = req.query

    // Build query
    let query = {}

    // Multi-tenant filter
    if (websiteId) {
      query.website = websiteId
    }

    // For public endpoints, only show approved active testimonials
    if (!isAdmin) {
      query.status = "approved"
      query.isActive = true
      query.deleted = false
    } else {
      // Admin filters
      if (includeDeleted === "false") {
        query.deleted = false
      }
      if (showInactive === "false") {
        query.isActive = true
      }
      if (status && status !== "all") {
        query.status = status
      }
    }

    // Common filters
    if (category && category !== "all") {
      query.category = category
    }
    if (rating && rating !== "all") {
      query.rating = parseInt(rating)
    }
    if (source && source !== "all") {
      query.source = source
    }
    if (isFeatured === "true") {
      query.isFeatured = true
    }
    if (tags) {
      const tagList = tags.split(",").map((t) => t.trim().toLowerCase())
      query.tags = { $in: tagList }
    }

    // Text search
    if (search) {
      query.$or = [{ name: { $regex: search, $options: "i" } }, { testimonial: { $regex: search, $options: "i" } }, { company: { $regex: search, $options: "i" } }, { email: { $regex: search, $options: "i" } }, { tags: { $regex: search, $options: "i" } }]
    }

    // Pagination
    const pageNum = parseInt(page)
    const limitNum = parseInt(limit)
    const skip = (pageNum - 1) * limitNum

    // Sorting
    const sortOptions = {}
    sortOptions[sortBy] = sortOrder === "asc" ? 1 : -1

    // Execute query
    const testimonials = await Testimonial.find(query).populate("productId", "name images").sort(sortOptions).skip(skip).limit(limitNum)

    const total = await Testimonial.countDocuments(query)

    res.json({
      testimonials,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(total / limitNum),
        totalItems: total,
        itemsPerPage: limitNum,
      },
    })
  } catch (error) {
    console.error("Error fetching testimonials:", error)
    res.status(500).json({ msg: "Failed to fetch testimonials", error: error.message })
  }
}

/**
 * Get a single testimonial by ID
 */
export const getTestimonialById = async (req, res) => {
  try {
    const websiteId = req.websiteId || req.tenant?._id
    const isAdmin = req.user && (req.user.role === "admin" || req.user.role === "super_admin")

    const query = { _id: req.params.id }
    if (websiteId) {
      query.website = websiteId
    }

    const testimonial = await Testimonial.findOne(query).populate("productId", "name images")

    if (!testimonial) {
      return res.status(404).json({ msg: "Testimonial not found" })
    }

    // Public users can only see approved testimonials
    if (!isAdmin && testimonial.status !== "approved") {
      return res.status(403).json({ msg: "Testimonial not available" })
    }

    res.json(testimonial)
  } catch (error) {
    console.error("Error fetching testimonial:", error)
    res.status(500).json({ msg: "Failed to fetch testimonial", error: error.message })
  }
}

/**
 * Create a new testimonial
 * Can be submitted by users or created by admin
 */
export const createTestimonial = async (req, res) => {
  try {
    const websiteId = req.websiteId || req.tenant?._id
    const isAdmin = req.user && (req.user.role === "admin" || req.user.role === "super_admin")

    const { name, email, role, company, testimonial, rating, source, sourceUrl, tags, category, productId, productName, isFeatured, isActive } = req.body

    // Validate required fields
    if (!name || !testimonial) {
      return res.status(400).json({ msg: "Name and testimonial text are required" })
    }

    // Validate rating
    const ratingNum = parseInt(rating) || 5
    if (ratingNum < 1 || ratingNum > 5) {
      return res.status(400).json({ msg: "Rating must be between 1 and 5" })
    }

    let photoUrl = null
    if (req.files && req.files.photo && req.files.photo[0]) {
      try {
        photoUrl = await uploadLocalFileToCloudinary(req.files.photo[0].path, {
          folder: "photuprint/testimonials",
        })
      } catch (uploadError) {
        console.error("Cloudinary upload failed:", uploadError)
        removeLocalFiles(req.files.photo)
        return res.status(503).json({ msg: uploadError.message || "Photo upload failed. Configure Cloudinary." })
      }
    }

    // Parse tags if sent as string
    let parsedTags = []
    if (tags) {
      if (typeof tags === "string") {
        parsedTags = tags
          .split(",")
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean)
      } else if (Array.isArray(tags)) {
        parsedTags = tags.map((t) => t.trim().toLowerCase()).filter(Boolean)
      }
    }

    const testimonialData = {
      name,
      email,
      role,
      company,
      photo: photoUrl,
      testimonial,
      rating: ratingNum,
      source: source || (isAdmin ? "admin" : "website"),
      sourceUrl,
      tags: parsedTags,
      category: category || "general",
      productId: productId || null,
      productName,
      // Admin-created testimonials are auto-approved
      status: isAdmin ? "approved" : "pending",
      isFeatured: isAdmin ? isFeatured === "true" || isFeatured === true : false,
      isActive: isActive === "true" || isActive === true || isActive === undefined, // Default to true
      website: websiteId,
    }

    const newTestimonial = new Testimonial(testimonialData)
    const savedTestimonial = await newTestimonial.save()

    const populated = await Testimonial.findById(savedTestimonial._id).populate("productId", "name images")

    res.status(201).json(populated)
  } catch (error) {
    console.error("Error creating testimonial:", error)
    res.status(500).json({ msg: "Failed to create testimonial", error: error.message })
  }
}

/**
 * Update an existing testimonial
 */
export const updateTestimonial = async (req, res) => {
  try {
    const websiteId = req.websiteId || req.tenant?._id

    const query = { _id: req.params.id }
    if (websiteId) {
      query.website = websiteId
    }

    const testimonial = await Testimonial.findOne(query)
    if (!testimonial) {
      return res.status(404).json({ msg: "Testimonial not found" })
    }

    const { name, email, role, company, testimonial: testimonialText, rating, source, sourceUrl, tags, category, productId, productName, isFeatured, isActive, status, rejectionReason } = req.body

    // Handle photo upload/removal
    if (req.body.photo === "" || req.body.photo === null) {
      await tenantCloudinaryDestroyByUrl(websiteId || testimonial.website, testimonial.photo)
      testimonial.photo = null
    } else if (req.files && req.files.photo && req.files.photo[0]) {
      // Upload new photo (Cloudinary when configured, else local)
      if (testimonial.photo && testimonial.photo.includes("cloudinary")) {
        const publicId = testimonial.photo.split("/").slice(-2).join("/").split(".")[0]
        try {
          await cloudinary.uploader.destroy(publicId)
        } catch (e) {
          console.error("Error deleting old photo:", e)
        }
      }
      try {
        testimonial.photo = await uploadLocalFileToCloudinary(req.files.photo[0].path, {
          folder: "photuprint/testimonials",
        })
      } catch (uploadError) {
        console.error("Cloudinary upload failed:", uploadError)
        removeLocalFiles(req.files.photo)
        return res.status(503).json({ msg: uploadError.message || "Photo upload failed. Configure Cloudinary." })
      }
    }

    // Update fields
    if (name) testimonial.name = name
    if (email !== undefined) testimonial.email = email
    if (role !== undefined) testimonial.role = role
    if (company !== undefined) testimonial.company = company
    if (testimonialText) testimonial.testimonial = testimonialText
    if (rating) {
      const ratingNum = parseInt(rating)
      if (ratingNum >= 1 && ratingNum <= 5) {
        testimonial.rating = ratingNum
      }
    }
    if (source) testimonial.source = source
    if (sourceUrl !== undefined) testimonial.sourceUrl = sourceUrl
    if (category) testimonial.category = category
    if (productId !== undefined) testimonial.productId = productId || null
    if (productName !== undefined) testimonial.productName = productName

    // Parse and update tags
    if (tags !== undefined) {
      if (typeof tags === "string") {
        testimonial.tags = tags
          .split(",")
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean)
      } else if (Array.isArray(tags)) {
        testimonial.tags = tags.map((t) => t.trim().toLowerCase()).filter(Boolean)
      } else {
        testimonial.tags = []
      }
    }

    if (isFeatured !== undefined) {
      testimonial.isFeatured = isFeatured === "true" || isFeatured === true
    }

    if (isActive !== undefined) {
      testimonial.isActive = isActive === "true" || isActive === true
    }

    // Handle status change
    if (status && ["pending", "approved", "rejected"].includes(status)) {
      testimonial.status = status
      testimonial.reviewedBy = req.user?.name || req.user?.email || "System"
      testimonial.reviewedAt = new Date()
      if (status === "rejected" && rejectionReason) {
        testimonial.rejectionReason = rejectionReason
      }
    }

    const updatedTestimonial = await testimonial.save()
    const populated = await Testimonial.findById(updatedTestimonial._id).populate("productId", "name images")

    res.json(populated)
  } catch (error) {
    console.error("Error updating testimonial:", error)
    res.status(500).json({ msg: "Failed to update testimonial", error: error.message })
  }
}

/**
 * Update testimonial status (approve/reject)
 */
export const updateTestimonialStatus = async (req, res) => {
  try {
    const websiteId = req.websiteId || req.tenant?._id
    const { status, rejectionReason } = req.body

    if (!status || !["pending", "approved", "rejected"].includes(status)) {
      return res.status(400).json({ msg: "Valid status is required (pending, approved, rejected)" })
    }

    const query = { _id: req.params.id }
    if (websiteId) {
      query.website = websiteId
    }

    const testimonial = await Testimonial.findOne(query)
    if (!testimonial) {
      return res.status(404).json({ msg: "Testimonial not found" })
    }

    testimonial.status = status
    testimonial.reviewedBy = req.user?.name || req.user?.email || "Admin"
    testimonial.reviewedAt = new Date()

    if (status === "rejected" && rejectionReason) {
      testimonial.rejectionReason = rejectionReason
    }

    const updated = await testimonial.save()
    const populated = await Testimonial.findById(updated._id).populate("productId", "name images")

    res.json({ msg: `Testimonial ${status}`, testimonial: populated })
  } catch (error) {
    console.error("Error updating testimonial status:", error)
    res.status(500).json({ msg: "Failed to update status", error: error.message })
  }
}

/**
 * Bulk update testimonial status
 */
export const bulkUpdateStatus = async (req, res) => {
  try {
    const websiteId = req.websiteId || req.tenant?._id
    const { ids, status } = req.body

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ msg: "Array of IDs is required" })
    }

    if (!status || !["pending", "approved", "rejected"].includes(status)) {
      return res.status(400).json({ msg: "Valid status is required" })
    }

    const query = { _id: { $in: ids } }
    if (websiteId) {
      query.website = websiteId
    }

    const result = await Testimonial.updateMany(query, {
      $set: {
        status,
        reviewedBy: req.user?.name || req.user?.email || "Admin",
        reviewedAt: new Date(),
      },
    })

    res.json({ msg: `Updated ${result.modifiedCount} testimonials`, modifiedCount: result.modifiedCount })
  } catch (error) {
    console.error("Error bulk updating testimonials:", error)
    res.status(500).json({ msg: "Failed to bulk update", error: error.message })
  }
}

/**
 * Import testimonials from CSV data
 * Expects an array of testimonial objects in request body
 */
export const importTestimonials = async (req, res) => {
  try {
    const websiteId = req.websiteId || req.tenant?._id
    if (!websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }

    const { testimonials } = req.body

    if (!testimonials || !Array.isArray(testimonials) || testimonials.length === 0) {
      return res.status(400).json({ msg: "Array of testimonials is required" })
    }

    const results = { success: 0, failed: 0, errors: [] }

    for (const item of testimonials) {
      try {
        // Validate required fields
        if (!item.name || !item.testimonial) {
          results.failed++
          results.errors.push({ item, error: "Name and testimonial are required" })
          continue
        }

        // Parse tags
        let parsedTags = []
        if (item.tags) {
          if (typeof item.tags === "string") {
            parsedTags = item.tags
              .split(",")
              .map((t) => t.trim().toLowerCase())
              .filter(Boolean)
          } else if (Array.isArray(item.tags)) {
            parsedTags = item.tags.map((t) => t.trim().toLowerCase()).filter(Boolean)
          }
        }

        const testimonialData = {
          name: item.name,
          email: item.email || null,
          role: item.role || null,
          company: item.company || null,
          testimonial: item.testimonial,
          rating: parseInt(item.rating) || 5,
          source: item.source || "import",
          sourceUrl: item.sourceUrl || null,
          tags: parsedTags,
          category: item.category || "general",
          status: "pending", // Imported testimonials need review
          website: websiteId,
        }

        await Testimonial.create(testimonialData)
        results.success++
      } catch (itemError) {
        results.failed++
        results.errors.push({ item, error: itemError.message })
      }
    }

    res.json({
      msg: `Import completed: ${results.success} success, ${results.failed} failed`,
      ...results,
    })
  } catch (error) {
    console.error("Error importing testimonials:", error)
    res.status(500).json({ msg: "Failed to import testimonials", error: error.message })
  }
}

/**
 * Soft delete a testimonial
 */
export const deleteTestimonial = async (req, res) => {
  try {
    const websiteId = req.websiteId || req.tenant?._id

    const query = { _id: req.params.id }
    if (websiteId) {
      query.website = websiteId
    }

    const testimonial = await Testimonial.findOne(query)
    if (!testimonial) {
      return res.status(404).json({ msg: "Testimonial not found" })
    }

    testimonial.deleted = true
    testimonial.isActive = false
    await testimonial.save()

    res.json({ msg: "Testimonial deleted successfully" })
  } catch (error) {
    console.error("Error deleting testimonial:", error)
    res.status(500).json({ msg: "Failed to delete testimonial", error: error.message })
  }
}

/**
 * Restore a soft-deleted testimonial
 */
export const restoreTestimonial = async (req, res) => {
  try {
    const websiteId = req.websiteId || req.tenant?._id

    const query = { _id: req.params.id }
    if (websiteId) {
      query.website = websiteId
    }

    const testimonial = await Testimonial.findOne(query)
    if (!testimonial) {
      return res.status(404).json({ msg: "Testimonial not found" })
    }

    testimonial.deleted = false
    testimonial.isActive = true
    await testimonial.save()

    res.json({ msg: "Testimonial restored successfully" })
  } catch (error) {
    console.error("Error restoring testimonial:", error)
    res.status(500).json({ msg: "Failed to restore testimonial", error: error.message })
  }
}

/**
 * Permanently delete a testimonial
 */
export const hardDeleteTestimonial = async (req, res) => {
  try {
    const websiteId = req.websiteId || req.tenant?._id

    const query = { _id: req.params.id }
    if (websiteId) {
      query.website = websiteId
    }

    const testimonial = await Testimonial.findOneAndDelete(query)
    if (!testimonial) {
      return res.status(404).json({ msg: "Testimonial not found" })
    }

    await tenantCloudinaryDestroyByUrl(websiteId || testimonial.website, testimonial.photo)

    res.json({ msg: "Testimonial permanently deleted" })
  } catch (error) {
    console.error("Error hard deleting testimonial:", error)
    res.status(500).json({ msg: "Failed to permanently delete testimonial", error: error.message })
  }
}

/**
 * Get testimonial statistics
 */
export const getTestimonialStats = async (req, res) => {
  try {
    const websiteId = req.websiteId || req.tenant?._id

    const matchStage = { deleted: false }
    if (websiteId) {
      matchStage.website = websiteId
    }

    const stats = await Testimonial.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          pending: { $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] } },
          approved: { $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] } },
          rejected: { $sum: { $cond: [{ $eq: ["$status", "rejected"] }, 1, 0] } },
          featured: { $sum: { $cond: ["$isFeatured", 1, 0] } },
          avgRating: { $avg: "$rating" },
        },
      },
    ])

    const result = stats[0] || {
      total: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
      featured: 0,
      avgRating: 0,
    }

    // Round average rating to 1 decimal place
    result.avgRating = Math.round(result.avgRating * 10) / 10 || 0

    res.json(result)
  } catch (error) {
    console.error("Error getting testimonial stats:", error)
    res.status(500).json({ msg: "Failed to get statistics", error: error.message })
  }
}

/**
 * Toggle featured status
 */
export const toggleFeatured = async (req, res) => {
  try {
    const websiteId = req.websiteId || req.tenant?._id

    const query = { _id: req.params.id }
    if (websiteId) {
      query.website = websiteId
    }

    const testimonial = await Testimonial.findOne(query)
    if (!testimonial) {
      return res.status(404).json({ msg: "Testimonial not found" })
    }

    testimonial.isFeatured = !testimonial.isFeatured
    await testimonial.save()

    res.json({
      msg: testimonial.isFeatured ? "Testimonial featured" : "Testimonial unfeatured",
      isFeatured: testimonial.isFeatured,
    })
  } catch (error) {
    console.error("Error toggling featured:", error)
    res.status(500).json({ msg: "Failed to toggle featured", error: error.message })
  }
}
