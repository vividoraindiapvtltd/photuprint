import Review from "../models/review.model.js"
import cloudinary from "../utils/cloudinary.js"
import { removeLocalFile, removeLocalFiles } from "../utils/fileCleanup.js"

// Get all reviews (with admin and public filtering)
export const getReviews = async (req, res) => {
  try {
    // Multi-tenant: Filter by website (for admin requests)
    // For public storefront, website will be resolved from domain
    const websiteId = req.websiteId || req.tenant?._id;
    
    const { categoryId, subCategoryId, productId, status, rating, source, search, showInactive = "true", includeDeleted = "true", page = 1, limit = 20 } = req.query

    console.log("Getting reviews with filters:", { status, source, rating, isAdmin: req.user?.role === "admin" })

    let query = {}
    
    // Add website filter if available (for multi-tenant)
    if (websiteId) {
      query.website = websiteId;
    }

    // Handle deleted filter
    if (includeDeleted === "false") {
      query.deleted = false
    }

    // Handle active filter
    if (showInactive === "false") {
      query.isActive = true
    }

    // For public endpoints, only show approved reviews
    // For admin endpoints, apply filters only if explicitly provided
    const isAdmin = req.user && (req.user.role === "admin" || req.user.role === "super_admin")

    if (!isAdmin) {
      query.status = "approved"
      query.isActive = true
      query.deleted = false
    }

    // Apply filters (only if provided and not "all")
    if (categoryId) query.categoryId = categoryId
    if (subCategoryId) query.subCategoryId = subCategoryId
    if (productId) query.productId = productId

    // Status filter - only apply if explicitly provided (not "all" or undefined)
    // For admin: if status is not provided or is "all", show all statuses
    if (status && status !== "all") {
      query.status = status
    }

    // Source filter - only apply if explicitly provided (not "all" or undefined)
    // If source is not provided or is "all", show all sources
    if (source && source !== "all") {
      query.source = source
    }

    // Rating filter - only apply if explicitly provided (not "all" or undefined)
    // If rating is not provided or is "all", show all ratings
    if (rating && rating !== "all") {
      query.rating = parseInt(rating)
    }

    if (search) {
      query.$or = [{ name: { $regex: search, $options: "i" } }, { email: { $regex: search, $options: "i" } }, { comment: { $regex: search, $options: "i" } }, { productName: { $regex: search, $options: "i" } }, { title: { $regex: search, $options: "i" } }]
    }

    console.log("Final query:", JSON.stringify(query, null, 2))

    const skip = (page - 1) * limit

    const reviews = await Review.find(query).populate("categoryId", "name categoryId").populate("subCategoryId", "name subcategoryId").populate("productId", "name productId images").sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit))

    const total = await Review.countDocuments(query)

    res.json({
      reviews,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit),
      },
    })
  } catch (error) {
    console.error("Error fetching reviews:", error)
    res.status(500).json({ msg: "Failed to fetch reviews", error: error.message })
  }
}

// Get single review by ID
export const getReviewById = async (req, res) => {
  try {
    // Multi-tenant: Filter by website if available
    const websiteId = req.websiteId || req.tenant?._id;
    const query = websiteId ? { _id: req.params.id, website: websiteId } : { _id: req.params.id };
    
    const review = await Review.findOne(query).populate("categoryId", "name categoryId").populate("subCategoryId", "name subcategoryId").populate("productId", "name productId images")

    if (!review) {
      return res.status(404).json({ msg: "Review not found" })
    }

    // Public users can only see approved reviews
    const isAdminUser = req.user && (req.user.role === "admin" || req.user.role === "super_admin")
    if (!isAdminUser && review.status !== "approved") {
      return res.status(403).json({ msg: "Review not available" })
    }

    res.json(review)
  } catch (error) {
    console.error("Error fetching review:", error)
    res.status(500).json({ msg: "Failed to fetch review", error: error.message })
  }
}

// Create new review
export const createReview = async (req, res) => {
  try {
    console.log("Create review request:", {
      hasUser: !!req.user,
      userRole: req.user?.role,
      body: { ...req.body, rating: req.body.rating },
    })

    // Authentication is required - req.user is guaranteed to exist
    if (!req.user) {
      return res.status(401).json({ msg: "Authentication required" })
    }

    // Parse rating as number
    const ratingNum = parseInt(req.body.rating) || 0
    let { categoryId, subCategoryId, productId, productName, title, comment } = req.body

    // Use authenticated user's information
    const userId = req.user._id.toString()
    const name = req.body.name || req.user.name || req.user.email?.split("@")[0] || "User"
    const email = req.body.email || req.user.email

    // Detect if request is from admin (includes super_admin)
    const isAdmin = req.user.role === "admin" || req.user.role === "super_admin"
    console.log("Create review - Is admin:", isAdmin, "User:", req.user.email, "Role:", req.user.role)

    // Validate required fields
    if (!productId || !comment || !ratingNum) {
      return res.status(400).json({
        msg: "Product, comment, and rating are required",
        missing: {
          productId: !productId,
          comment: !comment,
          rating: !ratingNum,
        },
      })
    }

    // If category/subcategory not provided, fetch from product
    if (!categoryId || !subCategoryId) {
      try {
        console.log("Category/subcategory missing, fetching from product:", productId)
        const Product = (await import("../models/product.model.js")).default
        const product = await Product.findById(productId).populate("category", "_id name").populate("subcategory", "_id name")

        if (!product) {
          console.error("Product not found:", productId)
          return res.status(404).json({ msg: "Product not found" })
        }

        console.log("Product found:", {
          name: product.name,
          category: product.category,
          subcategory: product.subcategory,
        })

        // Extract category and subcategory IDs
        // They might be ObjectIds, populated objects, or strings
        if (!categoryId && product.category) {
          if (typeof product.category === "object" && product.category._id) {
            categoryId = product.category._id.toString()
          } else {
            categoryId = product.category.toString()
          }
        }

        if (!subCategoryId && product.subcategory) {
          if (typeof product.subcategory === "object" && product.subcategory._id) {
            subCategoryId = product.subcategory._id.toString()
          } else {
            subCategoryId = product.subcategory.toString()
          }
        }

        productName = productName || product.name

        console.log("Extracted category/subcategory:", { categoryId, subCategoryId })

        // Check if product has required fields
        if (!categoryId || !subCategoryId) {
          console.error("Product missing category/subcategory:", {
            productId,
            productName: product.name,
            hasCategory: !!product.category,
            hasSubcategory: !!product.subcategory,
          })
          return res.status(400).json({
            msg: `Product "${product.name}" is missing ${!categoryId ? "category" : "subcategory"} information. Please update the product in admin panel before submitting reviews.`,
          })
        }
      } catch (err) {
        console.error("Error fetching product for category/subcategory:", err)
        return res.status(500).json({ msg: "Error fetching product details", error: err.message })
      }
    }

    // Validate email
    if (!email) {
      return res.status(400).json({ msg: "Email is required" })
    }

    // Validate rating
    if (ratingNum < 1 || ratingNum > 5) {
      return res.status(400).json({ msg: "Rating must be between 1 and 5" })
    }

    // Handle image uploads with Cloudinary or local storage
    let avatar = null
    let productImage = null // Keep for backward compatibility
    let productImages = [] // Array of product images (up to 5)

    // Check if there are actually files to upload
    const hasAvatarFile = req.files?.avatar && req.files.avatar[0]
    const hasProductImageFile = req.files?.productImage && req.files.productImage[0]
    const hasProductImagesFiles = req.files?.productImages && Array.isArray(req.files.productImages) && req.files.productImages.length > 0
    const hasAnyFiles = hasAvatarFile || hasProductImageFile || hasProductImagesFiles

    if (hasAnyFiles) {
      // Check if Cloudinary is configured
      const cloudinaryConfigured = !!(
        process.env.CLOUDINARY_CLOUD_NAME &&
        process.env.CLOUDINARY_API_KEY &&
        process.env.CLOUDINARY_API_SECRET
      )

      if (cloudinaryConfigured) {
        try {
          if (hasAvatarFile) {
            const avatarResult = await cloudinary.uploader.upload(req.files.avatar[0].path, {
              folder: "photuprint/reviews/avatars",
            })
            avatar = avatarResult.secure_url
            removeLocalFile(req.files.avatar[0].path)
          }
          
          // Handle single productImage (backward compatibility)
          if (hasProductImageFile) {
            const productImageResult = await cloudinary.uploader.upload(req.files.productImage[0].path, {
              folder: "photuprint/reviews/products",
            })
            productImage = productImageResult.secure_url
            productImages = [productImage] // Add to array as well
            removeLocalFile(req.files.productImage[0].path)
          }
          
          // Handle multiple productImages (up to 6)
          if (hasProductImagesFiles) {
            const filesToUpload = req.files.productImages.slice(0, 6)
            const uploadPromises = filesToUpload.map(file => 
              cloudinary.uploader.upload(file.path, {
                folder: "photuprint/reviews/products",
              })
            )
            const results = await Promise.all(uploadPromises)
            productImages = results.map(result => result.secure_url)
            // Clean up local files after successful upload
            removeLocalFiles(filesToUpload)
            // Set first image as productImage for backward compatibility
            if (productImages.length > 0) {
              productImage = productImages[0]
            }
          }
        } catch (uploadError) {
          console.error("Cloudinary upload failed:", uploadError)
          // Fallback to local storage
          if (hasAvatarFile) {
            avatar = `/uploads/${req.files.avatar[0].filename}`
          }
          if (hasProductImageFile) {
            productImage = `/uploads/${req.files.productImage[0].filename}`
            productImages = [productImage]
          }
          if (hasProductImagesFiles) {
            productImages = req.files.productImages.slice(0, 6).map(file => `/uploads/${file.filename}`)
            if (productImages.length > 0) {
              productImage = productImages[0]
            }
          }
        }
      } else {
        // Cloudinary not configured - use local storage
        console.log("Cloudinary not configured, using local storage for uploads")
        if (hasAvatarFile) {
          avatar = `/uploads/${req.files.avatar[0].filename}`
        }
        if (hasProductImageFile) {
          productImage = `/uploads/${req.files.productImage[0].filename}`
          productImages = [productImage]
        }
        if (hasProductImagesFiles) {
          productImages = req.files.productImages.slice(0, 6).map(file => `/uploads/${file.filename}`)
          if (productImages.length > 0) {
            productImage = productImages[0]
          }
        }
      }
    }

    // Check for duplicate reviews from same user for same product
    if (!isAdmin) {
      const existingReview = await Review.findOne({
        productId,
        userId,
        deleted: false,
      })

      if (existingReview) {
        return res.status(400).json({ msg: "You have already reviewed this product" })
      }
    }

    // Get status from form if admin, otherwise default to pending for regular users
    const statusFromForm = req.body.status
    const validStatuses = ["pending", "approved", "rejected"]
    let finalStatus = "pending" // Default for regular users
    
    if (isAdmin) {
      // Admin can set any valid status, default to approved if not specified
      finalStatus = validStatuses.includes(statusFromForm) ? statusFromForm : "approved"
    }
    
    const reviewData = {
      categoryId,
      subCategoryId,
      productId,
      productName,
      userId: isAdmin ? userId || null : userId,
      name,
      avatar,
      title,
      email,
      comment,
      rating: ratingNum, // Use parsed number
      productImage, // Keep for backward compatibility
      productImages, // Array of product images
      source: isAdmin ? "admin" : "user",
      status: finalStatus,
      isActive: true,
      deleted: false,
    }

    console.log("Creating review with data:", {
      ...reviewData,
      avatar: avatar ? "present" : "none",
      productImage: productImage ? "present" : "none",
    })

    // Multi-tenant: Get website from product or request context
    const websiteId = req.websiteId || req.tenant?._id;
    if (!websiteId) {
      // Try to get website from product
      try {
        const Product = (await import("../models/product.model.js")).default;
        const product = await Product.findById(productId).select('website');
        if (product?.website) {
          reviewData.website = product.website;
        } else {
          return res.status(400).json({ msg: "Website context is required" });
        }
      } catch (err) {
        return res.status(400).json({ msg: "Website context is required" });
      }
    } else {
      reviewData.website = websiteId;
    }

    const review = new Review(reviewData)
    const savedReview = await review.save()

    // Populate references before sending response
    const populatedReview = await Review.findById(savedReview._id).populate("categoryId", "name categoryId").populate("subCategoryId", "name subcategoryId").populate("productId", "name productId images")

    res.status(201).json(populatedReview)
  } catch (error) {
    console.error("Error creating review:", error)
    res.status(500).json({ msg: "Failed to create review", error: error.message })
  }
}

// Update review
export const updateReview = async (req, res) => {
  try {
    // Multi-tenant: Filter by website if available
    const websiteId = req.websiteId || req.tenant?._id;
    const query = websiteId ? { _id: req.params.id, website: websiteId } : { _id: req.params.id };

    const { categoryId, subCategoryId, productId, productName, userId, name, title, email, comment, rating, status } = req.body

    // Check if review exists and belongs to website
    const review = await Review.findOne(query)
    if (!review) {
      return res.status(404).json({ msg: "Review not found" })
    }

    // Users can only update their own reviews (if needed in future)
    // For now, only admins can update
    if (!req.user || (req.user.role !== "admin" && req.user.role !== "super_admin")) {
      return res.status(403).json({ msg: "Only admins can update reviews" })
    }

    // CRITICAL: Store original productImages BEFORE any modifications
    // This is needed for fallback logic when existingProductImages is not provided
    const originalProductImages = review.productImages && Array.isArray(review.productImages) 
      ? [...review.productImages] 
      : [];

    // Handle image removal (when empty string is sent)
    if (req.body.avatar === "" || req.body.avatar === null) {
      // Delete old avatar from Cloudinary if exists
      if (review.avatar && review.avatar.includes("cloudinary")) {
        const publicId = review.avatar.split("/").slice(-2).join("/").split(".")[0]
        try {
          await cloudinary.uploader.destroy(publicId)
        } catch (destroyError) {
          console.error("Error deleting old avatar:", destroyError)
        }
      }
      review.avatar = null
    }

    // Handle existing product images from body (when sent as JSON array)
    // IMPORTANT: FormData sends this as a string, so we need to parse it
    let existingProductImages = []
    console.log("=== CHECKING FOR EXISTING PRODUCT IMAGES ===")
    console.log("req.body keys:", Object.keys(req.body))
    console.log("req.body.existingProductImages type:", typeof req.body.existingProductImages)
    console.log("req.body.existingProductImages value:", req.body.existingProductImages)
    
    if (req.body.existingProductImages !== undefined && req.body.existingProductImages !== null && req.body.existingProductImages !== '') {
      try {
        let parsed = req.body.existingProductImages;
        // If it's a string, try to parse it as JSON
        if (typeof parsed === 'string') {
          // Handle empty string or "[]"
          if (parsed.trim() === '' || parsed.trim() === '[]') {
            parsed = [];
          } else {
            parsed = JSON.parse(parsed);
          }
        }
        
        // Ensure it's an array
        if (Array.isArray(parsed)) {
          existingProductImages = parsed.filter(url => url && typeof url === 'string' && url.trim() !== '');
        } else {
          console.warn("existingProductImages is not an array:", parsed);
          existingProductImages = [];
        }
        console.log("✅ Parsed existing product images:", existingProductImages.length, existingProductImages)
      } catch (e) {
        console.error("❌ Error parsing existingProductImages:", e)
        console.error("Raw value:", req.body.existingProductImages)
        existingProductImages = []
      }
    } else {
      console.log("⚠️ No existingProductImages in request body (undefined/null/empty)")
      // Use ORIGINAL review images as fallback (before any modifications)
      if (originalProductImages.length > 0) {
        existingProductImages = originalProductImages;
        console.log("Using ORIGINAL review images as fallback:", existingProductImages.length, existingProductImages)
      } else {
        console.log("No original images to use as fallback")
      }
    }
    console.log("Final existingProductImages to preserve:", existingProductImages.length, existingProductImages)
    console.log("existingProductImages details:", existingProductImages.map((url, idx) => `${idx + 1}: ${typeof url} - ${url ? url.substring(0, 60) + '...' : 'null/undefined'}`))
    console.log("===========================================")
    
    // CRITICAL SAFEGUARD: If we have new files to upload but no existingProductImages, use originalProductImages
    // This prevents data loss when FormData parsing fails or frontend doesn't send existingProductImages
    if (req.files && req.files.productImages && Array.isArray(req.files.productImages) && req.files.productImages.length > 0) {
      if (existingProductImages.length === 0 && originalProductImages.length > 0) {
        console.warn("⚠️ CRITICAL: No existingProductImages parsed but have new files and original images exist!")
        console.warn("Using originalProductImages as fallback to prevent data loss")
        existingProductImages = [...originalProductImages]; // Create a copy
        console.log("Fallback existingProductImages:", existingProductImages.length, existingProductImages)
      }
    }
    
    // Handle productImages array from body (when sent as JSON array to remove all)
    if (req.body.productImages !== undefined && typeof req.body.productImages === 'string') {
      try {
        const parsed = JSON.parse(req.body.productImages)
        if (Array.isArray(parsed) && parsed.length === 0) {
          // All images were removed
          const oldImages = review.productImages || []
          for (const oldImage of oldImages) {
            if (oldImage && oldImage.includes("cloudinary")) {
              const publicId = oldImage.split("/").slice(-2).join("/").split(".")[0]
              try {
                await cloudinary.uploader.destroy(publicId)
              } catch (destroyError) {
                console.error("Error deleting old product image:", destroyError)
              }
            }
          }
          review.productImages = []
          review.productImage = null
        }
      } catch (e) {
        console.error("Error parsing productImages JSON:", e)
      }
    }
    
    // Handle single productImage removal (backward compatibility)
    // Only process if productImages wasn't already handled above
    if ((req.body.productImage === "" || req.body.productImage === null) && !req.files.productImages) {
      // Delete old product image from Cloudinary if exists
      if (review.productImage && review.productImage.includes("cloudinary")) {
        const publicId = review.productImage.split("/").slice(-2).join("/").split(".")[0]
        try {
          await cloudinary.uploader.destroy(publicId)
        } catch (destroyError) {
          console.error("Error deleting old product image:", destroyError)
        }
      }
      review.productImage = null
      // Also clear productImages if productImage is removed (and no new images uploaded)
      if (review.productImages && review.productImages.length > 0 && !req.files.productImages) {
        // Delete all old images
        for (const oldImage of review.productImages) {
          if (oldImage && oldImage.includes("cloudinary")) {
            const publicId = oldImage.split("/").slice(-2).join("/").split(".")[0]
            try {
              await cloudinary.uploader.destroy(publicId)
            } catch (destroyError) {
              console.error("Error deleting old product image:", destroyError)
            }
          }
        }
        review.productImages = []
      }
    }

    // Handle image uploads with Cloudinary
    if (req.files) {
      try {
        if (req.files.avatar && req.files.avatar[0]) {
          // Delete old avatar from Cloudinary if exists
          if (review.avatar && review.avatar.includes("cloudinary")) {
            const publicId = review.avatar.split("/").slice(-2).join("/").split(".")[0]
            try {
              await cloudinary.uploader.destroy(publicId)
            } catch (destroyError) {
              console.error("Error deleting old avatar:", destroyError)
            }
          }
          const avatarResult = await cloudinary.uploader.upload(req.files.avatar[0].path, {
            folder: "photuprint/reviews/avatars",
          })
          review.avatar = avatarResult.secure_url
          removeLocalFile(req.files.avatar[0].path)
        }
        // Handle single productImage upload (backward compatibility)
        if (req.files.productImage && req.files.productImage[0]) {
          // Delete old product image from Cloudinary if exists
          if (review.productImage && review.productImage.includes("cloudinary")) {
            const publicId = review.productImage.split("/").slice(-2).join("/").split(".")[0]
            try {
              await cloudinary.uploader.destroy(publicId)
            } catch (destroyError) {
              console.error("Error deleting old product image:", destroyError)
            }
          }
          const productImageResult = await cloudinary.uploader.upload(req.files.productImage[0].path, {
            folder: "photuprint/reviews/products",
          })
          review.productImage = productImageResult.secure_url
          // Update productImages array
          review.productImages = [productImageResult.secure_url]
          removeLocalFile(req.files.productImage[0].path)
        }
        
        // Handle multiple productImages upload (up to 6)
        if (req.files.productImages && Array.isArray(req.files.productImages)) {
          console.log("=== PROCESSING PRODUCT IMAGES UPLOAD ===")
          console.log("New files count:", req.files.productImages.length)
          console.log("Existing images from request body:", existingProductImages.length, existingProductImages)
          console.log("ORIGINAL review images in DB (before any modifications):", originalProductImages.length, originalProductImages)
          console.log("Current review.productImages (may have been modified):", (review.productImages || []).length, review.productImages)
          
          // CRITICAL: Determine which images to preserve
          // Priority: 1) Use existingProductImages if provided and non-empty, 2) Fallback to ORIGINAL review images
          let imagesToPreserve = [];
          const hasExistingProductImages = existingProductImages && Array.isArray(existingProductImages) && existingProductImages.length > 0;
          
          if (hasExistingProductImages) {
            // Use the provided existing images from frontend
            imagesToPreserve = existingProductImages.filter(url => url && typeof url === 'string' && url.trim() !== '');
            console.log("✅ Using existingProductImages from request:", imagesToPreserve.length, imagesToPreserve)
            console.log("✅ Each URL type check:", imagesToPreserve.map(url => ({
              url: url.substring(0, 60) + '...',
              isString: typeof url === 'string',
              trimmed: url.trim() !== ''
            })))
            
            // CRITICAL VALIDATION: If filtering removed all URLs, something is wrong - use original as fallback
            if (imagesToPreserve.length === 0 && existingProductImages.length > 0) {
              console.error("❌ CRITICAL: Filtering removed all URLs! Using originalProductImages as fallback")
              console.error("existingProductImages that were filtered out:", existingProductImages)
              if (originalProductImages.length > 0) {
                imagesToPreserve = originalProductImages.filter(url => url && typeof url === 'string' && url.trim() !== '');
                console.log("Using originalProductImages as fallback:", imagesToPreserve.length)
              }
            }
          } else {
            // Fallback: use ORIGINAL review images to preserve them
            // This ensures we NEVER lose existing images when adding new ones
            // Use originalProductImages, not review.productImages (which may have been cleared)
            if (originalProductImages.length > 0) {
              imagesToPreserve = originalProductImages.filter(url => url && typeof url === 'string' && url.trim() !== '');
              console.log("⚠️ No existingProductImages provided (or empty), using ORIGINAL review images as fallback:", imagesToPreserve.length, imagesToPreserve)
            } else {
              console.log("❌ CRITICAL: No existing images to preserve! This will cause data loss!")
              console.log("originalProductImages:", originalProductImages)
              console.log("existingProductImages:", existingProductImages)
            }
          }
          
          // FINAL SAFEGUARD: If still empty but we have original images, use them
          if (imagesToPreserve.length === 0 && originalProductImages.length > 0) {
            console.error("❌ CRITICAL: imagesToPreserve is empty but originalProductImages exist! Using originalProductImages")
            imagesToPreserve = originalProductImages.filter(url => url && typeof url === 'string' && url.trim() !== '');
          }
          
          console.log("Final images to preserve:", imagesToPreserve.length, imagesToPreserve)
          console.log("imagesToPreserve details:", imagesToPreserve.map((url, idx) => `${idx + 1}: ${typeof url} - ${url.substring(0, 60)}...`))
          
          // CRITICAL: If we have new files but no images to preserve, this is a problem
          if (imagesToPreserve.length === 0 && req.files.productImages && req.files.productImages.length > 0) {
            console.error("❌ CRITICAL ERROR: Uploading new files but NO images to preserve!")
            console.error("This will DELETE all existing images and only save new ones!")
            console.error("originalProductImages:", originalProductImages)
            console.error("existingProductImages:", existingProductImages)
          }
          
          // Create a normalized comparison function to handle URL variations
          const normalizeUrlForComparison = (url) => {
            if (!url || typeof url !== 'string') return '';
            // Remove protocol variations and trailing slashes for comparison
            return url.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase().trim();
          };
          
          const normalizedPreserveUrls = new Set(
            imagesToPreserve.map(url => normalizeUrlForComparison(url))
          );
          
          console.log("Normalized preserve URLs:", Array.from(normalizedPreserveUrls))
          
          // Delete old images from Cloudinary that are NOT in the preserve list
          // Use ORIGINAL images for comparison, not current review.productImages (which may have been modified)
          for (const oldImage of originalProductImages) {
            if (!oldImage || typeof oldImage !== 'string') continue;
            
            // Normalize both URLs for comparison
            const normalizedOldImage = normalizeUrlForComparison(oldImage);
            const shouldPreserve = normalizedPreserveUrls.has(normalizedOldImage);
            
            // Only delete if it's not in the preserve list AND it's a cloudinary image
            if (!shouldPreserve && oldImage.includes("cloudinary")) {
              console.log("🗑️ Deleting old image (not in preserve list):", oldImage)
              const publicId = oldImage.split("/").slice(-2).join("/").split(".")[0]
              try {
                await cloudinary.uploader.destroy(publicId)
                console.log("✅ Deleted from Cloudinary:", publicId)
              } catch (destroyError) {
                console.error("❌ Error deleting old product image:", destroyError)
              }
            } else {
              console.log("✅ Keeping existing image:", oldImage.substring(0, 60) + "...", shouldPreserve ? "(in preserve list)" : "(not cloudinary)")
            }
          }
          
          // Upload new files
          const filesToUpload = req.files.productImages.slice(0, 6)
          const uploadPromises = filesToUpload.map(file => 
            cloudinary.uploader.upload(file.path, {
              folder: "photuprint/reviews/products",
            })
          )
          const results = await Promise.all(uploadPromises)
          const newImageUrls = results.map(result => result.secure_url)
          // Clean up local files after successful upload
          removeLocalFiles(filesToUpload)
          console.log("✅ New image URLs uploaded:", newImageUrls.length, newImageUrls)
          
          // Combine preserved images with new ones, limit to 6 total
          // IMPORTANT: Preserve existing images first, then add new ones
          // Remove any duplicates (in case a preserved image was re-uploaded)
          console.log("=== BEFORE MERGE ===")
          console.log("imagesToPreserve:", imagesToPreserve.length, imagesToPreserve)
          console.log("newImageUrls:", newImageUrls.length, newImageUrls)
          
          const allImageUrls = [...imagesToPreserve, ...newImageUrls];
          console.log("allImageUrls (before dedupe):", allImageUrls.length, allImageUrls)
          
          const uniqueImageUrls = [];
          const seenNormalized = new Set();
          
          for (const url of allImageUrls) {
            if (!url || typeof url !== 'string') {
              console.warn("Skipping invalid URL:", url, typeof url)
              continue
            }
            const normalized = normalizeUrlForComparison(url);
            if (!seenNormalized.has(normalized)) {
              seenNormalized.add(normalized);
              uniqueImageUrls.push(url);
              console.log("Added unique URL:", url.substring(0, 60) + '...')
            } else {
              console.log("Skipped duplicate URL:", url.substring(0, 60) + '...')
            }
          }
          
          const finalProductImages = uniqueImageUrls.slice(0, 6);
          review.productImages = finalProductImages;
          
          console.log("=== FINAL IMAGE MERGE ===")
          console.log("Preserved images:", imagesToPreserve.length, imagesToPreserve)
          console.log("New uploaded images:", newImageUrls.length, newImageUrls)
          console.log("Final productImages array:", finalProductImages.length, finalProductImages)
          console.log("Final count:", finalProductImages.length, "= preserved:", imagesToPreserve.length, "+ new:", newImageUrls.length, "- duplicates:", allImageUrls.length - uniqueImageUrls.length)
          console.log("Final URLs:", finalProductImages.map((url, idx) => `${idx + 1}: ${url.substring(0, 60)}...`))
          console.log("========================")
          
          // CRITICAL VALIDATION: Ensure we didn't lose preserved images
          if (imagesToPreserve.length > 0 && finalProductImages.length < imagesToPreserve.length) {
            console.error("❌ CRITICAL ERROR: Lost preserved images!")
            console.error("Expected at least", imagesToPreserve.length, "images but got", finalProductImages.length)
          }
          
          // Set first image as productImage for backward compatibility
          if (review.productImages.length > 0) {
            review.productImage = review.productImages[0]
          } else {
            review.productImage = null
          }
        } else if (existingProductImages && Array.isArray(existingProductImages) && existingProductImages.length > 0) {
          // No new files, but existing images are being kept
          review.productImages = existingProductImages.filter(url => url && typeof url === 'string' && url.trim() !== '').slice(0, 6)
          review.productImage = review.productImages.length > 0 ? review.productImages[0] : null
          console.log("No new files uploaded, preserving existing images:", review.productImages.length)
        } else if (originalProductImages.length > 0) {
          // No new files and no existingProductImages provided, keep ORIGINAL images
          review.productImages = originalProductImages;
          review.productImage = originalProductImages.length > 0 ? originalProductImages[0] : null;
          console.log("No new files and no existingProductImages, keeping ORIGINAL review images:", review.productImages.length)
        }
      } catch (uploadError) {
        console.error("Cloudinary upload failed:", uploadError)
        console.error("⚠️ Falling back to local storage - MUST preserve existing images!")
        
        // Fallback to local storage
        if (req.files.avatar && req.files.avatar[0]) {
          review.avatar = `/uploads/${req.files.avatar[0].filename}`
        }
        if (req.files.productImage && req.files.productImage[0]) {
          review.productImage = `/uploads/${req.files.productImage[0].filename}`
          review.productImages = [review.productImage]
        }
        if (req.files.productImages && Array.isArray(req.files.productImages)) {
          // CRITICAL: Preserve existing images when falling back to local storage
          // Get existing images to preserve (from existingProductImages or originalProductImages)
          let imagesToPreserveInFallback = [];
          if (existingProductImages && Array.isArray(existingProductImages) && existingProductImages.length > 0) {
            imagesToPreserveInFallback = existingProductImages.filter(url => url && typeof url === 'string' && url.trim() !== '');
            console.log("Fallback: Using existingProductImages:", imagesToPreserveInFallback.length)
          } else if (originalProductImages.length > 0) {
            imagesToPreserveInFallback = originalProductImages.filter(url => url && typeof url === 'string' && url.trim() !== '');
            console.log("Fallback: Using originalProductImages:", imagesToPreserveInFallback.length)
          }
          
          // Convert existing URLs to relative paths if they're absolute localhost URLs
          const normalizedExistingUrls = imagesToPreserveInFallback.map(url => {
            if (url.startsWith('http://localhost:8080/') || url.startsWith('https://localhost:8080/')) {
              return url.replace(/^https?:\/\/localhost:8080/, '');
            }
            return url;
          });
          
          // Upload new files to local storage
          const newLocalImageUrls = req.files.productImages.slice(0, 6).map(file => `/uploads/${file.filename}`)
          
          // Merge: existing images + new local images
          const allLocalImages = [...normalizedExistingUrls, ...newLocalImageUrls];
          
          // Remove duplicates
          const uniqueLocalImages = [];
          const seenLocal = new Set();
          for (const url of allLocalImages) {
            const normalized = url.replace(/^https?:\/\/[^/]+/, '').replace(/\/$/, '').toLowerCase();
            if (!seenLocal.has(normalized)) {
              seenLocal.add(normalized);
              uniqueLocalImages.push(url);
            }
          }
          
          review.productImages = uniqueLocalImages.slice(0, 6);
          
          console.log("Fallback merge result:", {
            existingCount: normalizedExistingUrls.length,
            newCount: newLocalImageUrls.length,
            finalCount: review.productImages.length,
            finalImages: review.productImages
          });
          
          if (review.productImages.length > 0) {
            review.productImage = review.productImages[0]
          }
        }
      }
    }

    // Update fields
    if (categoryId) review.categoryId = categoryId
    if (subCategoryId) review.subCategoryId = subCategoryId
    if (productId) review.productId = productId
    if (productName !== undefined) review.productName = productName
    if (userId !== undefined) review.userId = userId
    if (name) review.name = name
    if (title !== undefined) review.title = title
    if (email) review.email = email
    if (comment) review.comment = comment
    if (rating) {
      if (rating < 1 || rating > 5) {
        return res.status(400).json({ msg: "Rating must be between 1 and 5" })
      }
      review.rating = rating
    }
    if (status) {
      review.status = status
      // Track who reviewed and when
      if (req.user && (status === "approved" || status === "rejected")) {
        review.reviewedBy = req.user.name || req.user.email
        review.reviewedAt = new Date()
      }
    }

    const updatedReview = await review.save()
    
    console.log("Review saved to database. productImages:", updatedReview.productImages)
    console.log("Review saved. productImages count:", updatedReview.productImages?.length || 0)

    // Populate references before sending response
    const populatedReview = await Review.findById(updatedReview._id).populate("categoryId", "name categoryId").populate("subCategoryId", "name subcategoryId").populate("productId", "name productId images")
    
    console.log("Populated review. productImages:", populatedReview.productImages)
    console.log("Populated review. productImages count:", populatedReview.productImages?.length || 0)

    res.json(populatedReview)
  } catch (error) {
    console.error("Error updating review:", error)
    res.status(500).json({ msg: "Failed to update review", error: error.message })
  }
}

// Update review status
export const updateReviewStatus = async (req, res) => {
  try {
    console.log("Update review status request:", {
      reviewId: req.params.id,
      status: req.body.status,
      user: req.user ? { id: req.user._id, role: req.user.role } : "No user",
    })

    const { status } = req.body

    if (!status) {
      return res.status(400).json({ msg: "Status is required" })
    }

    if (!["pending", "approved", "rejected"].includes(status)) {
      return res.status(400).json({ msg: "Invalid status. Must be pending, approved, or rejected" })
    }

    const review = await Review.findById(req.params.id)
    if (!review) {
      return res.status(404).json({ msg: "Review not found" })
    }

    review.status = status

    // Track who reviewed and when
    if (req.user) {
      review.reviewedBy = req.user.name || req.user.email
      review.reviewedAt = new Date()
    }

    const updatedReview = await review.save()
    console.log("Review status updated successfully:", updatedReview._id, "to", updatedReview.status)

    // Populate references before sending response
    const populatedReview = await Review.findById(updatedReview._id).populate("categoryId", "name categoryId").populate("subCategoryId", "name subcategoryId").populate("productId", "name productId images")

    res.json({
      msg: "Review status updated successfully",
      review: populatedReview,
    })
  } catch (error) {
    console.error("Error updating review status:", error)
    console.error("Error stack:", error.stack)
    res.status(500).json({ msg: "Failed to update review status", error: error.message })
  }
}

// Delete review (soft delete)
export const deleteReview = async (req, res) => {
  try {
    // Multi-tenant: Filter by website if available
    const websiteId = req.websiteId || req.tenant?._id;
    const query = websiteId ? { _id: req.params.id, website: websiteId } : { _id: req.params.id };

    const review = await Review.findOne(query)
    if (!review) {
      return res.status(404).json({ msg: "Review not found" })
    }

    review.isActive = false
    review.deleted = true
    await review.save()

    res.json({ msg: "Review deleted successfully" })
  } catch (error) {
    console.error("Error deleting review:", error)
    res.status(500).json({ msg: "Failed to delete review", error: error.message })
  }
}

// Hard delete review
export const hardDeleteReview = async (req, res) => {
  try {
    const review = await Review.findByIdAndDelete(req.params.id)
    if (!review) {
      return res.status(404).json({ msg: "Review not found" })
    }

    // Delete images from Cloudinary if they exist
    if (review.avatar && review.avatar.includes("cloudinary")) {
      try {
        const publicId = review.avatar.split("/").slice(-2).join("/").split(".")[0]
        await cloudinary.uploader.destroy(publicId)
      } catch (destroyError) {
        console.error("Error deleting avatar from Cloudinary:", destroyError)
      }
    }
    if (review.productImage && review.productImage.includes("cloudinary")) {
      try {
        const publicId = review.productImage.split("/").slice(-2).join("/").split(".")[0]
        await cloudinary.uploader.destroy(publicId)
      } catch (destroyError) {
        console.error("Error deleting product image from Cloudinary:", destroyError)
      }
    }

    res.json({ msg: "Review permanently deleted" })
  } catch (error) {
    console.error("Error deleting review:", error)
    res.status(500).json({ msg: "Failed to delete review", error: error.message })
  }
}
