import Product from "../models/product.model.js"
import sanitizeHtml from "sanitize-html"
import mongoose from "mongoose"
import { tenantCloudinaryUpload } from "../utils/cloudinary.js"

// Helper function to sanitize HTML
function sanitizeHTML(html) {
  if (!html) return html
  try {
    return sanitizeHtml(html, {
      allowedTags: ["b", "i", "em", "strong", "a", "p", "br", "ul", "ol", "li", "h1", "h2", "h3", "h4", "h5", "h6"],
      allowedAttributes: {
        a: ["href"],
      },
    })
  } catch (error) {
    console.error("Error sanitizing HTML:", error)
    // Return the original HTML if sanitization fails
    return html
  }
}

function parseDimensions(dim) {
  if (dim == null || dim === "") return { length: null, width: null, height: null }
  try {
    const o = typeof dim === "string" ? JSON.parse(dim) : dim
    return {
      length: o && (o.length || o.length === "") ? (o.length || null) : null,
      width: o && (o.width || o.width === "") ? (o.width || null) : null,
      height: o && (o.height || o.height === "") ? (o.height || null) : null,
    }
  } catch {
    return { length: null, width: null, height: null }
  }
}

/** Ensure product has all fields the admin edit form expects (plain object with defaults). */
function toId(v) {
  if (v == null || v === "") return null
  if (typeof v === "object" && v._id != null) return String(v._id)
  return String(v)
}

function normalizeProductForEdit(product) {
  if (!product) return null
  const doc = product.toObject ? product.toObject() : { ...product }
  if (doc.shortDescription === undefined) doc.shortDescription = ""
  if (doc.tags === undefined) doc.tags = ""
  // Shipping & fulfillment: always expose as strings for edit form
  if (doc.weight === undefined || doc.weight === null) doc.weight = ""
  else doc.weight = String(doc.weight)
  if (doc.shippingClass === undefined || doc.shippingClass === null) doc.shippingClass = ""
  else {
    const sc = String(doc.shippingClass).trim()
    const lower = sc.toLowerCase()
    doc.shippingClass = (lower === "standard" || lower === "express") ? lower : sc
  }
  if (doc.processingTime === undefined || doc.processingTime === null) doc.processingTime = ""
  else doc.processingTime = String(doc.processingTime)
  if (!doc.dimensions || typeof doc.dimensions !== "object") doc.dimensions = { length: null, width: null, height: null }
  doc.dimensions = {
    length: toId(doc.dimensions.length),
    width: toId(doc.dimensions.width),
    height: toId(doc.dimensions.height),
  }
  doc.collarStyle = toId(doc.collarStyle)
  doc.pattern = toId(doc.pattern)
  doc.fitType = toId(doc.fitType)
  return doc
}

console.log("Product controller loaded successfully")

export const createProduct = async (req, res) => {
  try {
    // Validate required fields
    if (!req.body.name) {
      return res.status(400).json({ msg: "Product name is required" })
    }

    if (!req.body.price || req.body.price <= 0) {
      return res.status(400).json({ msg: "Valid product price is required" })
    }

    // Validate SKU format if provided (alphanumeric, exactly 9 characters)
    if (req.body.sku && req.body.sku.trim()) {
      const skuRegex = /^[A-Z0-9]{9}$/
      if (!skuRegex.test(req.body.sku.toUpperCase())) {
        return res.status(400).json({ msg: "SKU must be exactly 9 alphanumeric characters (A-Z, 0-9)" })
      }
    }

    if (!req.websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }

    // Main image is optional for draft saves (tab-by-tab saving)
    // It will be required when saving from the Media tab or final submission

    // Handle main image upload (optional for draft saves)
    let mainImageUrl = ""
    if (req.files && req.files.mainImage && req.files.mainImage.length > 0) {
      mainImageUrl =
        (await tenantCloudinaryUpload(req.websiteId, req.files.mainImage[0], { folder: "photuprint/products" })) || ""
      if (mainImageUrl) console.log("Main image stored:", mainImageUrl)
    }

    // Handle additional images uploads
    let imageUrls = []
    if (req.files.images && req.files.images.length > 0) {
      for (const file of req.files.images) {
        const url = await tenantCloudinaryUpload(req.websiteId, file, { folder: "photuprint/products" })
        if (url) imageUrls.push(url)
      }
      console.log("Additional images stored:", imageUrls)
    }

    // Handle video upload
    let videoUrl = null
    if (req.files.video && req.files.video.length > 0) {
      videoUrl = await tenantCloudinaryUpload(req.websiteId, req.files.video[0], {
        folder: "photuprint/products/videos",
        resource_type: "video",
      })
      if (videoUrl) console.log("Video stored:", videoUrl)
    }

    // Prepare product data
    const productData = {
      ...req.body,
      // Sanitize description HTML content
      description: req.body.description ? sanitizeHTML(req.body.description) : req.body.description,
      shortDescription: req.body.shortDescription != null ? String(req.body.shortDescription) : "",
      tags: req.body.tags != null ? String(req.body.tags) : "",
      material: req.body.material && String(req.body.material).trim() ? req.body.material : null,
      weight: req.body.weight != null && String(req.body.weight).trim() !== "" ? String(req.body.weight) : null,
      shippingClass: req.body.shippingClass != null ? String(req.body.shippingClass) : "",
      processingTime: req.body.processingTime != null ? String(req.body.processingTime) : "",
      dimensions: parseDimensions(req.body.dimensions),
      price: parseFloat(req.body.price),
      discountedPrice: req.body.discountedPrice ? parseFloat(req.body.discountedPrice) : null,
      discountPercentage: req.body.discountPercentage 
        ? parseFloat(req.body.discountPercentage) 
        : (req.body.discountedPrice && req.body.price && parseFloat(req.body.price) > parseFloat(req.body.discountedPrice)
          ? Math.round(((parseFloat(req.body.price) - parseFloat(req.body.discountedPrice)) / parseFloat(req.body.price) * 100))
          : null),
      stock: req.body.stock ? parseInt(req.body.stock) : 0,
      noOfPcsIncluded: req.body.noOfPcsIncluded ? parseInt(req.body.noOfPcsIncluded) : null,
      sku: req.body.sku ? req.body.sku.toUpperCase().trim() : undefined,
      isActive: req.body.isActive !== undefined ? req.body.isActive === "true" || req.body.isActive === true : true,
      displayMode: req.body.displayMode 
        ? req.body.displayMode 
        : req.body.productType 
          ? (req.body.productType === "customized" ? "customized" : "standard")
          : "both",
      mainImage: mainImageUrl || undefined, // Optional for draft saves
      images: imageUrls,
      video: videoUrl,
      colors: Array.isArray(req.body.colors) ? req.body.colors : req.body.colors ? [req.body.colors] : [],
      sizes: Array.isArray(req.body.sizes) ? req.body.sizes : req.body.sizes ? [req.body.sizes] : [],
      templates: Array.isArray(req.body.templates) ? req.body.templates : req.body.templates ? [req.body.templates] : [],
      heights: Array.isArray(req.body.heights) ? req.body.heights : req.body.heights ? [req.body.heights] : [],
      lengths: Array.isArray(req.body.lengths) ? req.body.lengths : req.body.lengths ? [req.body.lengths] : [],
      taxClass: req.body.taxClass && String(req.body.taxClass).trim() ? req.body.taxClass : null,
      collarStyle: req.body.collarStyle && String(req.body.collarStyle).trim() ? req.body.collarStyle : null,
      pattern: req.body.pattern && String(req.body.pattern).trim() ? req.body.pattern : null,
      fitType: req.body.fitType && String(req.body.fitType).trim() ? req.body.fitType : null,
      // SEO Fields as object
      seo: {
        metaKeywords: req.body.metaKeywords || "",
        metaDescription: req.body.metaDescription || "",
        canonicalLink: req.body.canonicalLink || "",
        jsonLd: req.body.jsonLd || "",
      },
      // Multi-tenant: Set website from tenant context
      website: req.websiteId,
    }

    // Create product (productId, slug and SKU will be auto-generated by pre-save middleware)
    const product = await Product.create(productData)
    console.log("Product created successfully:", product.name, "with productId:", product.productId)

    // Populate template with all fields including templateFiles
    const populatedProduct = await Product.findById(product._id)
      .populate("category", "name categoryId")
      .populate("subcategory", "name subcategoryId")
      .populate("brand", "name brandId")
      .populate("collarStyle", "name")
      .populate("pattern", "name")
      .populate("fitType", "name")
      .populate("colors", "name code image")
      .populate("sizes", "name dimensions")
      .populate({
        path: "templates",
        select: "templateId name description categoryId categoryName backgroundImages logoImages previewImage textOption",
      })
      .populate({
        path: "heights",
        select: "name description",
      })
      .populate({
        path: "lengths",
        select: "name description",
      })

    res.status(201).json({
      success: true,
      message: "Product created successfully",
      product: populatedProduct,
    })
  } catch (err) {
    console.error("Error creating product:", err)

    // Handle specific MongoDB errors
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern)[0]
      return res.status(400).json({
        msg: `A product with this ${field} already exists. Please use a different ${field}.`,
        error: "DUPLICATE_KEY",
      })
    }

    // Handle validation errors
    if (err.name === "ValidationError") {
      const errors = Object.values(err.errors).map((e) => e.message)
      return res.status(400).json({
        msg: "Validation failed",
        errors: errors,
      })
    }

    res.status(500).json({
      msg: "Failed to create product",
      error: err.message,
    })
  }
}

export const getAllProducts = async (req, res) => {
  try {
    // Multi-tenant: Filter by website
    if (!req.websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }

    console.log("Getting all products with query:", req.query)
    const { keyword, category, categoryId, subcategory, subCategoryId, minPrice, maxPrice, showInactive = "true", includeDeleted = "true" } = req.query
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 10
    const skip = (page - 1) * limit

    let filter = {
      website: req.websiteId, // Filter by tenant website
    }

    if (includeDeleted === "false") {
      filter.deleted = false
    }

    if (showInactive === "false") {
      filter.isActive = true
    }

    if (keyword) {
      filter.name = { $regex: keyword, $options: "i" }
    }

    // Support both 'category' and 'categoryId' for backward compatibility
    if (category || categoryId) {
      filter.category = category || categoryId
    }

    // Support both 'subcategory' and 'subCategoryId' for backward compatibility
    if (subcategory || subCategoryId) {
      filter.subcategory = subcategory || subCategoryId
    }

    if (minPrice && maxPrice) {
      filter.price = { $gte: Number(minPrice), $lte: Number(maxPrice) }
    }

    console.log("MongoDB filter:", JSON.stringify(filter, null, 2))

    const total = await Product.countDocuments(filter)
    console.log(`Total products found: ${total}`)

    const products = await Product.find(filter)
      .populate("category", "name categoryId")
      .populate("subcategory", "name subcategoryId")
      .populate("brand", "name brandId")
      .populate("collarStyle", "name")
      .populate("pattern", "name")
      .populate("fitType", "name")
      .populate("colors", "name code image")
      .populate("sizes", "name dimensions")
      .populate({
        path: "templates",
        select: "templateId name description categoryId categoryName backgroundImages logoImages previewImage textOption",
      })
      .populate({
        path: "heights",
        select: "name description",
      })
      .populate({
        path: "lengths",
        select: "name description",
      })
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })

    console.log(`Returning ${products.length} products`)

    const normalizedProducts = products.map((p) => normalizeProductForEdit(p))

    res.json({
      total,
      page,
      pages: Math.ceil(total / limit),
      products: normalizedProducts,
    })
  } catch (err) {
    console.error("Error in getAllProducts:", err)
    console.error("Error stack:", err.stack)
    res.status(500).json({ msg: err.message || "Failed to fetch products", error: err.toString() })
  }
}

/**
 * Get product by slug (for storefront URLs like /product/my-product-slug).
 * Uses same logic as getProductById but expects req.params.slug.
 */
export const getProductBySlug = async (req, res) => {
  if (!req.params.slug) {
    return res.status(400).json({ msg: "Product slug is required" })
  }
  req.params.id = req.params.slug
  return getProductById(req, res)
}

export const getProductById = async (req, res) => {
  try {
    console.log("Fetching product by ID or slug:", req.params.id)

    if (!req.params.id) {
      return res.status(400).json({ msg: "Product ID is required" })
    }

    // Build query - try multiple identifier types
    let query
    const isObjectId = req.params.id.match(/^[0-9a-fA-F]{24}$/)

    // Multi-tenant: Filter by website
    if (!req.websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }

    if (isObjectId) {
      // Search by MongoDB _id - convert to ObjectId
      try {
        const objectId = new mongoose.Types.ObjectId(req.params.id)
        query = { _id: objectId, deleted: { $ne: true }, website: req.websiteId }
      } catch (objectIdError) {
        console.error("Invalid ObjectId format:", req.params.id)
        return res.status(400).json({ msg: "Invalid product ID format" })
      }
    } else {
      // Search by slug (or productId); scope by website for multi-tenant
      query = {
        $or: [{ productId: req.params.id }, { slug: req.params.id }],
        deleted: { $ne: true },
        website: req.websiteId,
      }
    }

    console.log("Query:", JSON.stringify(query, null, 2))

    // Find product first without populate to check if it exists
    const productExists = await Product.findOne(query).select("_id name")

    if (!productExists) {
      console.log("Product not found with query:", query)
      return res.status(404).json({ msg: "Product not found" })
    }

    console.log("Product found, populating references...")

    // Now populate all references - wrap in try-catch to catch populate errors
    let product
    try {
      product = await Product.findById(productExists._id)
        .populate("category", "name categoryId")
        .populate("subcategory", "name subcategoryId")
        .populate("brand", "name brandId")
        .populate("collarStyle", "name")
        .populate("pattern", "name")
        .populate("fitType", "name")
        .populate("colors", "name code image")
        .populate("sizes", "name dimensions")
        .populate({
          path: "templates",
          select: "templateId name description categoryId categoryName backgroundImages logoImages previewImage textOption",
          match: { deleted: { $ne: true } },
        })
        .populate({
          path: "heights",
          select: "name description",
        })
        .populate({
          path: "lengths",
          select: "name description",
        })

      if (!product) {
        console.log("Product not found after populate")
        return res.status(404).json({ msg: "Product not found" })
      }

      console.log("Product fetched successfully:", product.name)
      res.set("Cache-Control", "no-store, no-cache, must-revalidate")
      res.set("Pragma", "no-cache")
      res.json(normalizeProductForEdit(product))
    } catch (populateError) {
      console.error("Error during populate:", populateError)
      console.error("Populate error stack:", populateError.stack)
      const basicProduct = await Product.findById(productExists._id)
      if (!basicProduct) {
        return res.status(404).json({ msg: "Product not found" })
      }
      console.log("Returning product without full populate due to error")
      res.set("Cache-Control", "no-store, no-cache, must-revalidate")
      res.set("Pragma", "no-cache")
      res.json(normalizeProductForEdit(basicProduct))
    }
  } catch (err) {
    console.error("Error fetching product by ID:", err)
    console.error("Error stack:", err.stack)
    console.error("Error details:", {
      message: err.message,
      name: err.name,
      code: err.code,
      keyPattern: err.keyPattern,
      keyValue: err.keyValue,
    })
    res.status(500).json({
      msg: err.message || "Failed to fetch product",
      error: process.env.NODE_ENV === "development" ? err.stack : undefined,
    })
  }
}

export const updateProduct = async (req, res) => {
  try {
    // Multi-tenant: Filter by website
    if (!req.websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }

    // Validate SKU format if provided (alphanumeric, exactly 9 characters)
    if (req.body.sku !== undefined && req.body.sku && req.body.sku.trim()) {
      const skuRegex = /^[A-Z0-9]{9}$/
      if (!skuRegex.test(req.body.sku.toUpperCase())) {
        return res.status(400).json({ msg: "SKU must be exactly 9 alphanumeric characters (A-Z, 0-9)" })
      }
    }

    const product = await Product.findOne({ _id: req.params.id, website: req.websiteId })

    if (!product) {
      return res.status(404).json({ msg: "Product not found" })
    }

    // Handle main image upload (if provided)
    let mainImageUrl = null
    if (req.files.mainImage && req.files.mainImage.length > 0) {
      mainImageUrl =
        (await tenantCloudinaryUpload(req.websiteId, req.files.mainImage[0], { folder: "photuprint/products" })) || ""
      if (mainImageUrl) console.log("Main image updated:", mainImageUrl)
    }

    // Handle additional/gallery images uploads (same pattern as main image: check Cloudinary config first)
    let newImageUrls = []
    if (req.files.images && req.files.images.length > 0) {
      for (const file of req.files.images) {
        const url = await tenantCloudinaryUpload(req.websiteId, file, { folder: "photuprint/products" })
        if (url) newImageUrls.push(url)
      }
      console.log("New additional images stored:", newImageUrls)
    }

    // Handle video upload (if provided)
    let videoUrl = null
    if (req.files.video && req.files.video.length > 0) {
      videoUrl = await tenantCloudinaryUpload(req.websiteId, req.files.video[0], {
        folder: "photuprint/products/videos",
        resource_type: "video",
      })
      if (videoUrl) console.log("Video updated:", videoUrl)
    }

    // Prepare update data
    const updateData = {
      ...req.body,
      // Sanitize description HTML content if provided
      description: req.body.description !== undefined ? (req.body.description ? sanitizeHTML(req.body.description) : req.body.description) : product.description,
      price: req.body.price ? parseFloat(req.body.price) : product.price,
      discountedPrice: req.body.discountedPrice !== undefined ? (req.body.discountedPrice ? parseFloat(req.body.discountedPrice) : null) : product.discountedPrice,
      discountPercentage: req.body.discountPercentage !== undefined 
        ? (req.body.discountPercentage ? parseFloat(req.body.discountPercentage) : null) 
        : (req.body.discountedPrice !== undefined && req.body.price && parseFloat(req.body.price) > parseFloat(req.body.discountedPrice)
          ? Math.round(((parseFloat(req.body.price) - parseFloat(req.body.discountedPrice)) / parseFloat(req.body.price) * 100))
          : (product.discountedPrice && product.price && product.price > product.discountedPrice && !product.discountPercentage
            ? Math.round(((product.price - product.discountedPrice) / product.price * 100))
            : product.discountPercentage)),
      stock: req.body.stock !== undefined ? parseInt(req.body.stock) : product.stock,
      noOfPcsIncluded: req.body.noOfPcsIncluded !== undefined ? (req.body.noOfPcsIncluded ? parseInt(req.body.noOfPcsIncluded) : null) : product.noOfPcsIncluded,
      sku: req.body.sku !== undefined ? (req.body.sku ? req.body.sku.toUpperCase().trim() : null) : product.sku,
      isActive: req.body.isActive !== undefined ? req.body.isActive === "true" || req.body.isActive === true : product.isActive,
      deleted: req.body.deleted !== undefined ? (req.body.deleted === "true" || req.body.deleted === true || req.body.deleted === "false" ? (req.body.deleted === "true" || req.body.deleted === true) : Boolean(req.body.deleted)) : product.deleted,
      displayMode: req.body.displayMode !== undefined 
        ? req.body.displayMode 
        : req.body.productType !== undefined 
          ? (req.body.productType === "customized" ? "customized" : "standard")
          : product.displayMode || "both",
      // Media fields
      mainImage: mainImageUrl !== null ? mainImageUrl : (req.body.mainImage === "" ? null : product.mainImage),
      video: videoUrl !== null ? videoUrl : req.body.video !== undefined ? req.body.video : product.video,
      // SEO Fields as object
      seo: {
        metaKeywords: req.body.metaKeywords !== undefined ? req.body.metaKeywords : product.seo?.metaKeywords || "",
        metaDescription: req.body.metaDescription !== undefined ? req.body.metaDescription : product.seo?.metaDescription || "",
        canonicalLink: req.body.canonicalLink !== undefined ? req.body.canonicalLink : product.seo?.canonicalLink || "",
        jsonLd: req.body.jsonLd !== undefined ? req.body.jsonLd : product.seo?.jsonLd || "",
      },
      taxClass: req.body.taxClass !== undefined ? (req.body.taxClass && String(req.body.taxClass).trim() ? req.body.taxClass : null) : product.taxClass,
      collarStyle: req.body.collarStyle !== undefined ? (req.body.collarStyle && String(req.body.collarStyle).trim() ? req.body.collarStyle : null) : product.collarStyle,
      pattern: req.body.pattern !== undefined ? (req.body.pattern && String(req.body.pattern).trim() ? req.body.pattern : null) : product.pattern,
      fitType: req.body.fitType !== undefined ? (req.body.fitType && String(req.body.fitType).trim() ? req.body.fitType : null) : product.fitType,
      shortDescription: req.body.shortDescription !== undefined ? String(req.body.shortDescription || "") : product.shortDescription,
      tags: req.body.tags !== undefined ? String(req.body.tags || "") : product.tags,
      material: req.body.material !== undefined ? (req.body.material && String(req.body.material).trim() ? req.body.material : null) : product.material,
      weight: req.body.weight !== undefined ? (req.body.weight != null && String(req.body.weight).trim() !== "" ? String(req.body.weight) : null) : product.weight,
      shippingClass: req.body.shippingClass !== undefined ? String(req.body.shippingClass || "") : product.shippingClass,
      processingTime: req.body.processingTime !== undefined ? String(req.body.processingTime || "") : product.processingTime,
      dimensions: req.body.dimensions !== undefined ? parseDimensions(req.body.dimensions) : (product.dimensions || { length: null, width: null, height: null }),
    }

    // Handle gallery images update
    // If existingImages is provided, it means user wants to control which existing images to keep
    if (req.body.existingImages !== undefined) {
      try {
        // Parse existing images (sent as JSON string from FormData)
        const existingImagesToKeep = typeof req.body.existingImages === 'string' 
          ? JSON.parse(req.body.existingImages) 
          : req.body.existingImages
        
        // Combine kept existing images with newly uploaded images
        updateData.images = [...(Array.isArray(existingImagesToKeep) ? existingImagesToKeep : []), ...newImageUrls]
      } catch (parseError) {
        console.error("Error parsing existingImages:", parseError)
        // Fallback: merge new images with existing ones
        updateData.images = [...(product.images || []), ...newImageUrls]
      }
    } else if (newImageUrls.length > 0) {
      // If new images uploaded but no existingImages specified, merge with existing
      updateData.images = [...(product.images || []), ...newImageUrls]
    } else if (req.body.images !== undefined) {
      // If images array is explicitly provided in body (e.g., for deletion), use it
      updateData.images = Array.isArray(req.body.images) ? req.body.images : []
    }
    // If none of the above, images remain unchanged (not included in updateData)

    // Handle arrays
    if (req.body.colors) {
      updateData.colors = Array.isArray(req.body.colors) ? req.body.colors : [req.body.colors]
    }
    if (req.body.sizes) {
      updateData.sizes = Array.isArray(req.body.sizes) ? req.body.sizes : [req.body.sizes]
    }
    if (req.body.heights) {
      updateData.heights = Array.isArray(req.body.heights) ? req.body.heights : [req.body.heights]
    }
    if (req.body.lengths) {
      updateData.lengths = Array.isArray(req.body.lengths) ? req.body.lengths : [req.body.lengths]
    }
    if (req.body.templates !== undefined) {
      updateData.templates = Array.isArray(req.body.templates) ? req.body.templates : req.body.templates ? [req.body.templates] : []
    }

    const updatedProduct = await Product.findByIdAndUpdate(req.params.id, updateData, { new: true })
      .populate("category", "name categoryId")
      .populate("subcategory", "name subcategoryId")
      .populate("brand", "name brandId")
      .populate("collarStyle", "name")
      .populate("pattern", "name")
      .populate("fitType", "name")
      .populate("colors", "name code image")
      .populate("sizes", "name dimensions")
      .populate({
        path: "templates",
        select: "templateId name description categoryId categoryName backgroundImages logoImages previewImage textOption",
      })
      .populate({
        path: "heights",
        select: "name description",
      })
      .populate({
        path: "lengths",
        select: "name description",
      })

    res.json(updatedProduct)
  } catch (err) {
    console.error("Error updating product:", err)
    res.status(500).json({ msg: err.message })
  }
}

/**
 * Delete product (soft delete)
 * DELETE /api/products/:id
 */
export const deleteProduct = async (req, res) => {
  try {
    // Multi-tenant: Filter by website
    if (!req.websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }

    const product = await Product.findOne({
      _id: req.params.id,
      website: req.websiteId,
      deleted: false
    })

    if (!product) {
      return res.status(404).json({ msg: "Product not found" })
    }

    // Soft delete: mark as inactive and set deleted flag
    product.deleted = true
    product.isActive = false
    await product.save()

    res.json({ msg: "Product deleted successfully" })
  } catch (err) {
    res.status(500).json({ msg: err.message })
  }
}

/**
 * Restore (revert) a soft-deleted product
 * PUT /api/products/:id/restore
 */
export const restoreProduct = async (req, res) => {
  try {
    if (!req.websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }

    const product = await Product.findOne({
      _id: req.params.id,
      website: req.websiteId
    })

    if (!product) {
      return res.status(404).json({ msg: "Product not found" })
    }

    if (!product.deleted) {
      return res.status(400).json({ msg: "Product is not deleted" })
    }

    product.deleted = false
    product.isActive = true
    await product.save()

    res.json({ msg: "Product restored successfully", product })
  } catch (err) {
    res.status(500).json({ msg: err.message })
  }
}

/**
 * Hard delete product (permanent delete)
 * DELETE /api/products/:id/hard
 */
export const hardDeleteProduct = async (req, res) => {
  try {
    // Multi-tenant: Filter by website
    if (!req.websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }

    const product = await Product.findOne({
      _id: req.params.id,
      website: req.websiteId
    })

    if (!product) {
      return res.status(404).json({ msg: "Product not found" })
    }

    await Product.findByIdAndDelete(req.params.id)

    res.json({ msg: "Product permanently deleted" })
  } catch (err) {
    res.status(500).json({ msg: err.message })
  }
}
