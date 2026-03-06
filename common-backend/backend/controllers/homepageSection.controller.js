import HomepageSection from "../models/homepageSection.model.js"
import Product from "../models/product.model.js"
import Website from "../models/website.model.js"

/**
 * Homepage Section Controller
 * 
 * Provides CRUD operations for managing homepage sections including:
 * - Section management (create, read, update, delete)
 * - Product assignment and ordering within sections
 * - Section reordering
 * - Scheduling and publishing
 * - Preview functionality
 * - Multi-tenant support
 */

// ============================================================================
// SECTION CRUD OPERATIONS
// ============================================================================

/**
 * Get all homepage sections (accessible to everyone - logged in and non-logged in users)
 * Supports filtering by status, type, and search
 * Non-admin users (including non-authenticated) can only see active, non-deleted sections
 */
export const getSections = async (req, res) => {
  try {
    // Log headers for debugging
    console.log('[getSections] Request headers:', {
      'x-website-id': req.headers['x-website-id'],
      'X-Website-Id': req.headers['X-Website-Id'],
      'host': req.headers.host,
      'x-forwarded-host': req.headers['x-forwarded-host']
    })
    console.log('[getSections] req.websiteId from middleware:', req.websiteId)
    console.log('[getSections] req.tenant from middleware:', req.tenant?.name)
    
    let websiteId = req.websiteId || req.tenant?._id
    
    // If websiteId not set by middleware, try to resolve from header or domain
    if (!websiteId) {
      // Try header first - Express normalizes headers to lowercase
      const headerWebsiteId = req.headers['x-website-id'] || req.headers['X-Website-Id']
      
      console.log('[getSections] Header website ID:', headerWebsiteId)
      
      if (headerWebsiteId) {
        // Validate ObjectId format
        if (/^[0-9a-fA-F]{24}$/.test(headerWebsiteId)) {
          // For non-admin users, only allow active websites
          // For admin users, allow inactive websites too
          const isAdmin = req.user && ["admin", "super_admin", "editor"].includes(req.user.role)
          const websiteQuery = { 
            _id: headerWebsiteId, 
            deleted: false
          }
          if (!isAdmin) {
            websiteQuery.isActive = true
          }
          
          const website = await Website.findOne(websiteQuery)
          console.log('[getSections] Website lookup result:', website ? `${website.name} (active: ${website.isActive})` : 'Not found')
          
          if (website) {
            websiteId = website._id
          } else {
            console.warn('[getSections] Website not found, inactive, or deleted:', headerWebsiteId)
            return res.status(404).json({ 
              msg: "Website not found or is inactive. Please provide a valid active website ID.",
              error: "WEBSITE_NOT_FOUND_OR_INACTIVE",
              websiteId: headerWebsiteId
            })
          }
        } else {
          console.warn('[getSections] Invalid website ID format:', headerWebsiteId)
          return res.status(400).json({ 
            msg: "Invalid website ID format. Must be a valid MongoDB ObjectId (24 characters).",
            error: "INVALID_WEBSITE_ID_FORMAT",
            receivedWebsiteId: headerWebsiteId
          })
        }
      }
      
      // If still not found, try domain resolution (for storefront)
      if (!websiteId) {
        const host = req.headers['x-forwarded-host'] || req.headers.host || ''
        const domain = host.split(':')[0]
        
        console.log('[getSections] Trying domain resolution:', domain)
        
        if (domain) {
          // For localhost in development, use first active website
          if ((domain === 'localhost' || domain === '127.0.0.1') && process.env.NODE_ENV === 'development') {
            const defaultWebsite = await Website.findOne({ 
              deleted: false,
              isActive: true
            }).sort({ createdAt: 1 })
            if (defaultWebsite) {
              websiteId = defaultWebsite._id
              console.log('[getSections] Using default website for localhost:', defaultWebsite.name)
            }
          } else {
            // Try exact domain match
            const website = await Website.findOne({ 
              domain: domain.toLowerCase(),
              deleted: false,
              isActive: true
            })
            if (website) {
              websiteId = website._id
              console.log('[getSections] Website found by domain:', website.name)
            }
          }
        }
      }
    }
    
    if (!websiteId) {
      console.error('[getSections] Website ID not resolved')
      return res.status(400).json({ 
        msg: "Website context is required. Please provide X-Website-Id header or access via a valid domain.",
        error: "WEBSITE_CONTEXT_REQUIRED",
        receivedHeaders: {
          'x-website-id': req.headers['x-website-id'],
          'X-Website-Id': req.headers['X-Website-Id'],
          host: req.headers.host
        }
      })
    }
    
    console.log('[getSections] Using website ID:', websiteId.toString())
    
    // Verify website exists and check if user can access it
    const website = await Website.findById(websiteId)
    if (!website || website.deleted) {
      return res.status(404).json({ 
        msg: "Website not found or has been deleted.",
        error: "WEBSITE_NOT_FOUND",
        websiteId: websiteId.toString()
      })
    }
    
    // Check if user is admin/editor (allowed to see inactive/deleted sections)
    // req.user will be null for non-authenticated users
    const isAdmin = req.user && ["admin", "super_admin", "editor"].includes(req.user.role)
    
    // Non-admin users can only access active websites
    if (!isAdmin && !website.isActive) {
      return res.status(403).json({ 
        msg: "This website is not active. Only administrators can access inactive websites.",
        error: "WEBSITE_INACTIVE",
        websiteId: websiteId.toString()
      })
    }
    
    const {
      status,
      type,
      search,
      showInactive = "false",
      includeDeleted = "false",
      includeProducts = "true",
      sortBy = "displayOrder",
      sortOrder = "asc",
      page = 1,
      limit = 50,
    } = req.query
    
    // Build query
    const query = { website: websiteId }
    
    // Status filter
    if (status && status !== "all") {
      query.status = status
    }
    
    // Type filter
    if (type && type !== "all") {
      query.type = type
    }
    
    // Include inactive filter - only admins can see inactive sections
    if (isAdmin) {
      if (showInactive !== "true") {
        query.isActive = true
      }
    } else {
      // Non-admin users (including non-authenticated) always see only active sections
      query.isActive = true
    }
    
    // Include deleted filter - only admins can see deleted sections
    if (isAdmin) {
      if (includeDeleted !== "true") {
        query.deleted = false
      }
    } else {
      // Non-admin users (including non-authenticated) never see deleted sections
      query.deleted = false
    }
    
    // Search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { slug: { $regex: search, $options: "i" } },
        { sectionId: { $regex: search, $options: "i" } },
      ]
    }
    
    // Build sort
    const sort = {}
    sort[sortBy] = sortOrder === "desc" ? -1 : 1
    
    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit)
    
    // Execute query
    let sectionsQuery = HomepageSection.find(query)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
    
    // Include products if requested
    if (includeProducts === "true") {
      sectionsQuery = sectionsQuery.populate({
        path: "products.product",
        select: "name slug price discountedPrice mainImage stock isActive productId homepageTags",
        match: { deleted: false },
      })
    }
    
    // Include creator/updater info
    sectionsQuery = sectionsQuery
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email")
    
    const [sections, total] = await Promise.all([
      sectionsQuery,
      HomepageSection.countDocuments(query),
    ])
    
    res.json({
      sections,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    })
  } catch (error) {
    console.error("Error fetching sections:", error)
    console.error("Error stack:", error.stack)
    res.status(500).json({ 
      msg: "Server error while fetching sections",
      error: error.message || "INTERNAL_SERVER_ERROR",
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    })
  }
}

/**
 * Get a single section by ID
 */
export const getSectionById = async (req, res) => {
  try {
    const websiteId = req.websiteId || req.tenant?._id
    const { id } = req.params
    
    if (!websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }
    
    const section = await HomepageSection.findOne({
      _id: id,
      website: websiteId,
    })
      .populate({
        path: "products.product",
        select: "name slug price discountedPrice mainImage images stock isActive productId homepageTags category subcategory",
        match: { deleted: false },
        populate: [
          { path: "category", select: "name slug" },
          { path: "subcategory", select: "name slug" },
        ],
      })
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email")
    
    if (!section) {
      return res.status(404).json({ msg: "Section not found" })
    }
    
    res.json(section)
  } catch (error) {
    console.error("Error fetching section:", error)
    res.status(500).json({ msg: "Server error", error: error.message })
  }
}

/**
 * Create a new homepage section
 */
export const createSection = async (req, res) => {
  try {
    const websiteId = req.websiteId || req.tenant?._id
    const userId = req.user?._id
    
    if (!websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }
    
    const {
      name,
      slug,
      type = "custom",
      description,
      status = "draft",
      displayOrder,
      productLimit = 10,
      autoPopulate = false,
      autoPopulateFilters,
      startDate,
      endDate,
      displayConfig,
      isActive = true,
    } = req.body
    
    // Check for duplicate name
    const existingSection = await HomepageSection.findOne({
      website: websiteId,
      name: name.trim(),
      deleted: false,
    })
    
    if (existingSection) {
      return res.status(400).json({ msg: "A section with this name already exists" })
    }
    
    // Get max display order if not provided
    let order = displayOrder
    if (order === undefined || order === null) {
      const maxOrderSection = await HomepageSection.findOne({
        website: websiteId,
        deleted: false,
      }).sort({ displayOrder: -1 })
      order = maxOrderSection ? maxOrderSection.displayOrder + 1 : 0
    }
    
    // Create section
    const section = new HomepageSection({
      name: name.trim(),
      slug: slug?.trim() || undefined,
      type,
      description: description?.trim(),
      status,
      displayOrder: order,
      productLimit,
      autoPopulate,
      autoPopulateFilters,
      startDate: startDate || null,
      endDate: endDate || null,
      displayConfig,
      isActive,
      website: websiteId,
      createdBy: userId,
      updatedBy: userId,
    })
    
    await section.save()
    
    // Populate and return
    const populatedSection = await HomepageSection.findById(section._id)
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email")
    
    res.status(201).json({
      msg: "Section created successfully",
      section: populatedSection,
    })
  } catch (error) {
    console.error("Error creating section:", error)
    res.status(500).json({ msg: "Server error", error: error.message })
  }
}

/**
 * Update an existing section
 */
export const updateSection = async (req, res) => {
  try {
    const websiteId = req.websiteId || req.tenant?._id
    const userId = req.user?._id
    const { id } = req.params
    
    if (!websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }
    
    const section = await HomepageSection.findOne({
      _id: id,
      website: websiteId,
    })
    
    if (!section) {
      return res.status(404).json({ msg: "Section not found" })
    }
    
    const {
      name,
      slug,
      type,
      description,
      status,
      displayOrder,
      productLimit,
      autoPopulate,
      autoPopulateFilters,
      startDate,
      endDate,
      displayConfig,
      isActive,
      deleted,
    } = req.body
    
    // Check for duplicate name if changing
    if (name && name.trim() !== section.name) {
      const existingSection = await HomepageSection.findOne({
        website: websiteId,
        name: name.trim(),
        _id: { $ne: id },
        deleted: false,
      })
      
      if (existingSection) {
        return res.status(400).json({ msg: "A section with this name already exists" })
      }
      section.name = name.trim()
    }
    
    // Update fields
    if (slug !== undefined) section.slug = slug?.trim() || section.slug
    if (type !== undefined) section.type = type
    if (description !== undefined) section.description = description?.trim()
    if (status !== undefined) section.status = status
    if (displayOrder !== undefined) section.displayOrder = displayOrder
    if (productLimit !== undefined) section.productLimit = productLimit
    if (autoPopulate !== undefined) section.autoPopulate = autoPopulate
    if (autoPopulateFilters !== undefined) section.autoPopulateFilters = autoPopulateFilters
    if (startDate !== undefined) section.startDate = startDate || null
    if (endDate !== undefined) section.endDate = endDate || null
    if (displayConfig !== undefined) {
      section.displayConfig = { ...section.displayConfig, ...displayConfig }
    }
    if (isActive !== undefined) section.isActive = isActive
    if (deleted !== undefined) section.deleted = deleted
    
    section.updatedBy = userId
    
    await section.save()
    
    // Populate and return
    const populatedSection = await HomepageSection.findById(section._id)
      .populate({
        path: "products.product",
        select: "name slug price discountedPrice mainImage stock isActive productId homepageTags",
        match: { deleted: false },
      })
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email")
    
    res.json({
      msg: "Section updated successfully",
      section: populatedSection,
    })
  } catch (error) {
    console.error("Error updating section:", error)
    res.status(500).json({ msg: "Server error", error: error.message })
  }
}

/**
 * Soft delete a section
 */
export const deleteSection = async (req, res) => {
  try {
    const websiteId = req.websiteId || req.tenant?._id
    const userId = req.user?._id
    const { id } = req.params
    
    if (!websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }
    
    const section = await HomepageSection.findOne({
      _id: id,
      website: websiteId,
    })
    
    if (!section) {
      return res.status(404).json({ msg: "Section not found" })
    }
    
    section.deleted = true
    section.isActive = false
    section.status = "inactive"
    section.updatedBy = userId
    
    await section.save()
    
    res.json({ msg: "Section deleted successfully" })
  } catch (error) {
    console.error("Error deleting section:", error)
    res.status(500).json({ msg: "Server error", error: error.message })
  }
}

/**
 * Restore a soft-deleted section
 */
export const restoreSection = async (req, res) => {
  try {
    const websiteId = req.websiteId || req.tenant?._id
    const userId = req.user?._id
    const { id } = req.params
    
    if (!websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }
    
    const section = await HomepageSection.findOne({
      _id: id,
      website: websiteId,
      deleted: true,
    })
    
    if (!section) {
      return res.status(404).json({ msg: "Deleted section not found" })
    }
    
    // Check for name conflict
    const existingSection = await HomepageSection.findOne({
      website: websiteId,
      name: section.name,
      _id: { $ne: id },
      deleted: false,
    })
    
    if (existingSection) {
      return res.status(400).json({ 
        msg: "Cannot restore: A section with this name already exists" 
      })
    }
    
    section.deleted = false
    section.isActive = true
    section.status = "draft"
    section.updatedBy = userId
    
    await section.save()
    
    res.json({ msg: "Section restored successfully", section })
  } catch (error) {
    console.error("Error restoring section:", error)
    res.status(500).json({ msg: "Server error", error: error.message })
  }
}

/**
 * Permanently delete a section
 */
export const hardDeleteSection = async (req, res) => {
  try {
    const websiteId = req.websiteId || req.tenant?._id
    const { id } = req.params
    
    if (!websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }
    
    const result = await HomepageSection.deleteOne({
      _id: id,
      website: websiteId,
    })
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ msg: "Section not found" })
    }
    
    res.json({ msg: "Section permanently deleted" })
  } catch (error) {
    console.error("Error hard deleting section:", error)
    res.status(500).json({ msg: "Server error", error: error.message })
  }
}

// ============================================================================
// SECTION ORDERING AND STATUS
// ============================================================================

/**
 * Toggle section active status
 */
export const toggleSectionStatus = async (req, res) => {
  try {
    const websiteId = req.websiteId || req.tenant?._id
    const userId = req.user?._id
    const { id } = req.params
    
    if (!websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }
    
    const section = await HomepageSection.findOne({
      _id: id,
      website: websiteId,
      deleted: false,
    })
    
    if (!section) {
      return res.status(404).json({ msg: "Section not found" })
    }
    
    section.isActive = !section.isActive
    section.status = section.isActive ? "active" : "inactive"
    section.updatedBy = userId
    
    await section.save()
    
    res.json({
      msg: `Section ${section.isActive ? "activated" : "deactivated"} successfully`,
      section,
    })
  } catch (error) {
    console.error("Error toggling section status:", error)
    res.status(500).json({ msg: "Server error", error: error.message })
  }
}

/**
 * Reorder sections (bulk update display order)
 */
export const reorderSections = async (req, res) => {
  try {
    const websiteId = req.websiteId || req.tenant?._id
    const userId = req.user?._id
    
    if (!websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }
    
    const { sections } = req.body // Array of { id, displayOrder }
    
    if (!sections || !Array.isArray(sections)) {
      return res.status(400).json({ msg: "Sections array is required" })
    }
    
    // Update each section's display order
    const updatePromises = sections.map(({ id, displayOrder }) =>
      HomepageSection.findOneAndUpdate(
        { _id: id, website: websiteId },
        { displayOrder, updatedBy: userId },
        { new: true }
      )
    )
    
    await Promise.all(updatePromises)
    
    res.json({ msg: "Sections reordered successfully" })
  } catch (error) {
    console.error("Error reordering sections:", error)
    res.status(500).json({ msg: "Server error", error: error.message })
  }
}

// ============================================================================
// PRODUCT MANAGEMENT WITHIN SECTIONS
// ============================================================================

/**
 * Add products to a section
 */
export const addProductsToSection = async (req, res) => {
  try {
    const websiteId = req.websiteId || req.tenant?._id
    const userId = req.user?._id
    const { id } = req.params
    
    if (!websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }
    
    const { productIds } = req.body // Array of product IDs
    
    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({ msg: "Product IDs array is required" })
    }
    
    const section = await HomepageSection.findOne({
      _id: id,
      website: websiteId,
      deleted: false,
    })
    
    if (!section) {
      return res.status(404).json({ msg: "Section not found" })
    }
    
    // Verify products exist and belong to the same website
    const products = await Product.find({
      _id: { $in: productIds },
      website: websiteId,
      isActive: true,
      deleted: false,
    })
    
    if (products.length === 0) {
      return res.status(400).json({ msg: "No valid products found" })
    }
    
    // Get existing product IDs in section
    const existingProductIds = section.products.map((p) => p.product.toString())
    
    // Get max display order
    let maxOrder = 0
    if (section.products.length > 0) {
      maxOrder = Math.max(...section.products.map((p) => p.displayOrder))
    }
    
    // Add new products
    let addedCount = 0
    for (const product of products) {
      if (!existingProductIds.includes(product._id.toString())) {
        maxOrder++
        section.products.push({
          product: product._id,
          displayOrder: maxOrder,
          addedAt: new Date(),
        })
        addedCount++
      }
    }
    
    if (addedCount === 0) {
      return res.status(400).json({ msg: "All products are already in this section" })
    }
    
    section.updatedBy = userId
    await section.save()
    
    // Populate and return
    const populatedSection = await HomepageSection.findById(section._id)
      .populate({
        path: "products.product",
        select: "name slug price discountedPrice mainImage stock isActive productId homepageTags",
        match: { deleted: false },
      })
    
    res.json({
      msg: `${addedCount} product(s) added to section`,
      section: populatedSection,
    })
  } catch (error) {
    console.error("Error adding products to section:", error)
    res.status(500).json({ msg: "Server error", error: error.message })
  }
}

/**
 * Remove a product from a section
 */
export const removeProductFromSection = async (req, res) => {
  try {
    const websiteId = req.websiteId || req.tenant?._id
    const userId = req.user?._id
    const { id, productId } = req.params
    
    if (!websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }
    
    const section = await HomepageSection.findOne({
      _id: id,
      website: websiteId,
      deleted: false,
    })
    
    if (!section) {
      return res.status(404).json({ msg: "Section not found" })
    }
    
    const productIndex = section.products.findIndex(
      (p) => p.product.toString() === productId
    )
    
    if (productIndex === -1) {
      return res.status(404).json({ msg: "Product not found in section" })
    }
    
    section.products.splice(productIndex, 1)
    section.updatedBy = userId
    
    await section.save()
    
    res.json({ msg: "Product removed from section" })
  } catch (error) {
    console.error("Error removing product from section:", error)
    res.status(500).json({ msg: "Server error", error: error.message })
  }
}

/**
 * Reorder products within a section
 */
export const reorderSectionProducts = async (req, res) => {
  try {
    const websiteId = req.websiteId || req.tenant?._id
    const userId = req.user?._id
    const { id } = req.params
    
    if (!websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }
    
    const { products } = req.body // Array of { productId, displayOrder }
    
    if (!products || !Array.isArray(products)) {
      return res.status(400).json({ msg: "Products array is required" })
    }
    
    const section = await HomepageSection.findOne({
      _id: id,
      website: websiteId,
      deleted: false,
    })
    
    if (!section) {
      return res.status(404).json({ msg: "Section not found" })
    }
    
    // Update display orders
    for (const { productId, displayOrder } of products) {
      const productEntry = section.products.find(
        (p) => p.product.toString() === productId
      )
      if (productEntry) {
        productEntry.displayOrder = displayOrder
      }
    }
    
    section.updatedBy = userId
    await section.save()
    
    res.json({ msg: "Products reordered successfully" })
  } catch (error) {
    console.error("Error reordering section products:", error)
    res.status(500).json({ msg: "Server error", error: error.message })
  }
}

/**
 * Update section products (replace all products)
 */
export const updateSectionProducts = async (req, res) => {
  try {
    const websiteId = req.websiteId || req.tenant?._id
    const userId = req.user?._id
    const { id } = req.params
    
    if (!websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }
    
    const { products } = req.body // Array of { productId, displayOrder }
    
    if (!products || !Array.isArray(products)) {
      return res.status(400).json({ msg: "Products array is required" })
    }
    
    const section = await HomepageSection.findOne({
      _id: id,
      website: websiteId,
      deleted: false,
    })
    
    if (!section) {
      return res.status(404).json({ msg: "Section not found" })
    }
    
    // Verify all products exist
    const productIds = products.map((p) => p.productId)
    const validProducts = await Product.find({
      _id: { $in: productIds },
      website: websiteId,
      isActive: true,
      deleted: false,
    }).select("_id")
    
    const validProductIds = validProducts.map((p) => p._id.toString())
    
    // Build new products array
    section.products = products
      .filter((p) => validProductIds.includes(p.productId))
      .map((p, index) => ({
        product: p.productId,
        displayOrder: p.displayOrder !== undefined ? p.displayOrder : index,
        addedAt: new Date(),
      }))
    
    section.updatedBy = userId
    await section.save()
    
    // Populate and return
    const populatedSection = await HomepageSection.findById(section._id)
      .populate({
        path: "products.product",
        select: "name slug price discountedPrice mainImage stock isActive productId homepageTags",
        match: { deleted: false },
      })
    
    res.json({
      msg: "Section products updated",
      section: populatedSection,
    })
  } catch (error) {
    console.error("Error updating section products:", error)
    res.status(500).json({ msg: "Server error", error: error.message })
  }
}

// ============================================================================
// PREVIEW AND PUBLISHING
// ============================================================================

/**
 * Save draft changes for preview
 */
export const saveDraft = async (req, res) => {
  try {
    const websiteId = req.websiteId || req.tenant?._id
    const userId = req.user?._id
    const { id } = req.params
    
    if (!websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }
    
    const section = await HomepageSection.findOne({
      _id: id,
      website: websiteId,
      deleted: false,
    })
    
    if (!section) {
      return res.status(404).json({ msg: "Section not found" })
    }
    
    const { draftData } = req.body
    
    section.draftData = draftData
    section.updatedBy = userId
    
    await section.save()
    
    res.json({ msg: "Draft saved successfully" })
  } catch (error) {
    console.error("Error saving draft:", error)
    res.status(500).json({ msg: "Server error", error: error.message })
  }
}

/**
 * Publish section (apply draft and set as active)
 */
export const publishSection = async (req, res) => {
  try {
    const websiteId = req.websiteId || req.tenant?._id
    const userId = req.user?._id
    const { id } = req.params
    
    if (!websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }
    
    const section = await HomepageSection.findOne({
      _id: id,
      website: websiteId,
      deleted: false,
    })
    
    if (!section) {
      return res.status(404).json({ msg: "Section not found" })
    }
    
    // Apply draft data if exists
    if (section.draftData) {
      const draftData = section.draftData
      
      // Apply draft fields
      if (draftData.name) section.name = draftData.name
      if (draftData.description !== undefined) section.description = draftData.description
      if (draftData.productLimit !== undefined) section.productLimit = draftData.productLimit
      if (draftData.displayConfig) {
        section.displayConfig = { ...section.displayConfig, ...draftData.displayConfig }
      }
      if (draftData.products) section.products = draftData.products
      
      // Clear draft
      section.draftData = null
    }
    
    section.status = "active"
    section.isActive = true
    section.isPublished = true
    section.publishedAt = new Date()
    section.updatedBy = userId
    
    await section.save()
    
    res.json({ msg: "Section published successfully", section })
  } catch (error) {
    console.error("Error publishing section:", error)
    res.status(500).json({ msg: "Server error", error: error.message })
  }
}

/**
 * Discard draft changes
 */
export const discardDraft = async (req, res) => {
  try {
    const websiteId = req.websiteId || req.tenant?._id
    const userId = req.user?._id
    const { id } = req.params
    
    if (!websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }
    
    const section = await HomepageSection.findOne({
      _id: id,
      website: websiteId,
      deleted: false,
    })
    
    if (!section) {
      return res.status(404).json({ msg: "Section not found" })
    }
    
    section.draftData = null
    section.updatedBy = userId
    
    await section.save()
    
    res.json({ msg: "Draft discarded successfully" })
  } catch (error) {
    console.error("Error discarding draft:", error)
    res.status(500).json({ msg: "Server error", error: error.message })
  }
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Get active homepage sections for public display (frontend)
 * Only returns sections that are:
 * - Active
 * - Not deleted
 * - Within scheduled date range (if applicable)
 */
export const getPublicSections = async (req, res) => {
  try {
    const websiteId = req.websiteId || req.tenant?._id
    
    if (!websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }
    
    const { type, limit = 10 } = req.query
    
    const now = new Date()
    
    // Build query for active, scheduled sections
    const query = {
      website: websiteId,
      status: "active",
      isActive: true,
      deleted: false,
      $or: [
        { startDate: null, endDate: null },
        { startDate: { $lte: now }, endDate: null },
        { startDate: null, endDate: { $gte: now } },
        { startDate: { $lte: now }, endDate: { $gte: now } },
      ],
    }
    
    if (type) {
      query.type = type
    }
    
    let sections = await HomepageSection.find(query)
      .sort({ displayOrder: 1 })
      .populate({
        path: "products.product",
        match: { isActive: true, deleted: false },
        select: "name slug price discountedPrice discountPercentage mainImage images stock productId homepageTags category subcategory",
        populate: [
          { path: "category", select: "name slug" },
          { path: "subcategory", select: "name slug" },
        ],
      })
      .lean()
    
    // Process sections - filter null products and apply limits
    sections = sections.map((section) => {
      // Filter out null products and sort by display order
      let sectionProducts = (section.products || [])
        .filter((p) => p.product !== null)
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .slice(0, section.productLimit || parseInt(limit))
      
      return {
        _id: section._id,
        sectionId: section.sectionId,
        name: section.name,
        slug: section.slug,
        type: section.type,
        description: section.description,
        displayConfig: section.displayConfig,
        productCount: sectionProducts.length,
        products: sectionProducts.map((p) => ({
          ...p.product,
          displayOrder: p.displayOrder,
        })),
      }
    })
    
    // Filter out sections with no products
    sections = sections.filter((s) => s.productCount > 0)
    
    res.json(sections)
  } catch (error) {
    console.error("Error fetching public sections:", error)
    res.status(500).json({ msg: "Server error", error: error.message })
  }
}

/**
 * Get products by homepage tag for public display
 */
export const getProductsByTag = async (req, res) => {
  try {
    const websiteId = req.websiteId || req.tenant?._id
    
    if (!websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }
    
    const { tag, limit = 10, page = 1 } = req.query
    
    const validTags = ["featured", "hot", "newArrival", "bestseller", "onSale"]
    if (!tag || !validTags.includes(tag)) {
      return res.status(400).json({ 
        msg: `Invalid tag. Valid tags: ${validTags.join(", ")}` 
      })
    }
    
    const query = {
      website: websiteId,
      isActive: true,
      deleted: false,
      [`homepageTags.${tag}`]: true,
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit)
    
    const [products, total] = await Promise.all([
      Product.find(query)
        .select("name slug price discountedPrice discountPercentage mainImage images stock productId homepageTags")
        .sort({ [`homepageTags.${tag}At`]: -1, createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Product.countDocuments(query),
    ])
    
    res.json({
      products,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    })
  } catch (error) {
    console.error("Error fetching products by tag:", error)
    res.status(500).json({ msg: "Server error", error: error.message })
  }
}

// ============================================================================
// PRODUCT TAG MANAGEMENT
// ============================================================================

/**
 * Update product homepage tags
 */
export const updateProductTags = async (req, res) => {
  try {
    const websiteId = req.websiteId || req.tenant?._id
    const { productId } = req.params
    
    if (!websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }
    
    const product = await Product.findOne({
      _id: productId,
      website: websiteId,
      deleted: false,
    })
    
    if (!product) {
      return res.status(404).json({ msg: "Product not found" })
    }
    
    const { featured, hot, newArrival, bestseller, onSale } = req.body
    
    // Initialize homepageTags if not exists
    if (!product.homepageTags) {
      product.homepageTags = {}
    }
    
    const now = new Date()
    
    // Update tags with timestamps
    if (featured !== undefined) {
      product.homepageTags.featured = featured
      if (featured && !product.homepageTags.featuredAt) {
        product.homepageTags.featuredAt = now
      }
    }
    
    if (hot !== undefined) {
      product.homepageTags.hot = hot
      if (hot && !product.homepageTags.hotAt) {
        product.homepageTags.hotAt = now
      }
    }
    
    if (newArrival !== undefined) {
      product.homepageTags.newArrival = newArrival
      if (newArrival && !product.homepageTags.newArrivalAt) {
        product.homepageTags.newArrivalAt = now
      }
    }
    
    if (bestseller !== undefined) {
      product.homepageTags.bestseller = bestseller
      if (bestseller && !product.homepageTags.bestsellerAt) {
        product.homepageTags.bestsellerAt = now
      }
    }
    
    if (onSale !== undefined) {
      product.homepageTags.onSale = onSale
    }
    
    await product.save()
    
    res.json({
      msg: "Product tags updated successfully",
      product: {
        _id: product._id,
        name: product.name,
        homepageTags: product.homepageTags,
      },
    })
  } catch (error) {
    console.error("Error updating product tags:", error)
    res.status(500).json({ msg: "Server error", error: error.message })
  }
}

/**
 * Bulk update product homepage tags
 */
export const bulkUpdateProductTags = async (req, res) => {
  try {
    const websiteId = req.websiteId || req.tenant?._id
    
    if (!websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }
    
    const { productIds, tags } = req.body
    
    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({ msg: "Product IDs array is required" })
    }
    
    if (!tags || typeof tags !== "object") {
      return res.status(400).json({ msg: "Tags object is required" })
    }
    
    const updateObj = {}
    const now = new Date()
    
    if (tags.featured !== undefined) {
      updateObj["homepageTags.featured"] = tags.featured
      if (tags.featured) {
        updateObj["homepageTags.featuredAt"] = now
      }
    }
    
    if (tags.hot !== undefined) {
      updateObj["homepageTags.hot"] = tags.hot
      if (tags.hot) {
        updateObj["homepageTags.hotAt"] = now
      }
    }
    
    if (tags.newArrival !== undefined) {
      updateObj["homepageTags.newArrival"] = tags.newArrival
      if (tags.newArrival) {
        updateObj["homepageTags.newArrivalAt"] = now
      }
    }
    
    if (tags.bestseller !== undefined) {
      updateObj["homepageTags.bestseller"] = tags.bestseller
      if (tags.bestseller) {
        updateObj["homepageTags.bestsellerAt"] = now
      }
    }
    
    if (tags.onSale !== undefined) {
      updateObj["homepageTags.onSale"] = tags.onSale
    }
    
    const result = await Product.updateMany(
      {
        _id: { $in: productIds },
        website: websiteId,
        deleted: false,
      },
      { $set: updateObj }
    )
    
    res.json({
      msg: `${result.modifiedCount} product(s) updated`,
      modifiedCount: result.modifiedCount,
    })
  } catch (error) {
    console.error("Error bulk updating product tags:", error)
    res.status(500).json({ msg: "Server error", error: error.message })
  }
}

// ============================================================================
// STATISTICS
// ============================================================================

/**
 * Get homepage sections statistics
 */
export const getSectionStats = async (req, res) => {
  try {
    const websiteId = req.websiteId || req.tenant?._id
    
    if (!websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }
    
    const baseQuery = { website: websiteId, deleted: false }
    
    const [
      total,
      active,
      inactive,
      draft,
      scheduled,
      deleted,
      byType,
    ] = await Promise.all([
      HomepageSection.countDocuments({ ...baseQuery }),
      HomepageSection.countDocuments({ ...baseQuery, status: "active", isActive: true }),
      HomepageSection.countDocuments({ ...baseQuery, isActive: false }),
      HomepageSection.countDocuments({ ...baseQuery, status: "draft" }),
      HomepageSection.countDocuments({ ...baseQuery, status: "scheduled" }),
      HomepageSection.countDocuments({ website: websiteId, deleted: true }),
      HomepageSection.aggregate([
        { $match: baseQuery },
        { $group: { _id: "$type", count: { $sum: 1 } } },
      ]),
    ])
    
    // Product tag counts
    const productTagCounts = await Product.aggregate([
      { $match: { website: websiteId, isActive: true, deleted: false } },
      {
        $group: {
          _id: null,
          featured: { $sum: { $cond: ["$homepageTags.featured", 1, 0] } },
          hot: { $sum: { $cond: ["$homepageTags.hot", 1, 0] } },
          newArrival: { $sum: { $cond: ["$homepageTags.newArrival", 1, 0] } },
          bestseller: { $sum: { $cond: ["$homepageTags.bestseller", 1, 0] } },
          onSale: { $sum: { $cond: ["$homepageTags.onSale", 1, 0] } },
        },
      },
    ])
    
    res.json({
      sections: {
        total,
        active,
        inactive,
        draft,
        scheduled,
        deleted,
        byType: byType.reduce((acc, item) => {
          acc[item._id] = item.count
          return acc
        }, {}),
      },
      productTags: productTagCounts[0] || {
        featured: 0,
        hot: 0,
        newArrival: 0,
        bestseller: 0,
        onSale: 0,
      },
    })
  } catch (error) {
    console.error("Error fetching section stats:", error)
    res.status(500).json({ msg: "Server error", error: error.message })
  }
}

/**
 * Get products available to add to sections
 */
export const getAvailableProducts = async (req, res) => {
  try {
    const websiteId = req.websiteId || req.tenant?._id
    
    if (!websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }
    
    const {
      search,
      category,
      subcategory,
      excludeSection,
      page = 1,
      limit = 20,
    } = req.query
    
    const query = {
      website: websiteId,
      isActive: true,
      deleted: false,
    }
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { productId: { $regex: search, $options: "i" } },
        { sku: { $regex: search, $options: "i" } },
      ]
    }
    
    if (category) {
      query.category = category
    }
    
    if (subcategory) {
      query.subcategory = subcategory
    }
    
    // Exclude products already in a section
    if (excludeSection) {
      const section = await HomepageSection.findOne({
        _id: excludeSection,
        website: websiteId,
      }).select("products")
      
      if (section && section.products.length > 0) {
        const excludeIds = section.products.map((p) => p.product)
        query._id = { $nin: excludeIds }
      }
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit)
    
    const [products, total] = await Promise.all([
      Product.find(query)
        .select("name slug price discountedPrice mainImage stock productId homepageTags category subcategory")
        .populate("category", "name")
        .populate("subcategory", "name")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Product.countDocuments(query),
    ])
    
    res.json({
      products,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    })
  } catch (error) {
    console.error("Error fetching available products:", error)
    res.status(500).json({ msg: "Server error", error: error.message })
  }
}
