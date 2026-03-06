import mongoose from "mongoose"

/**
 * Homepage Section Model
 * 
 * Manages dynamic homepage sections like Featured Products, New Arrivals,
 * Best Sellers, Hot/Trending, Offers, and Custom Sections.
 * 
 * Features:
 * - Admin can create, rename, reorder, enable/disable sections
 * - Scheduling support (start_date / end_date)
 * - Product limit per section
 * - Multi-tenant support via website field
 */

// Schema for products within a section (embedded)
const sectionProductSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  displayOrder: {
    type: Number,
    default: 0,
  },
  addedAt: {
    type: Date,
    default: Date.now,
  },
}, { _id: false })

const homepageSectionSchema = new mongoose.Schema(
  {
    // Section identifier (auto-generated)
    sectionId: {
      type: String,
      index: true,
    },
    
    // Section name (displayed in admin and optionally on frontend)
    name: {
      type: String,
      required: [true, "Section name is required"],
      trim: true,
      maxlength: [100, "Section name cannot exceed 100 characters"],
    },
    
    // URL-friendly slug for the section
    slug: {
      type: String,
      trim: true,
      lowercase: true,
    },
    
    // Section type - predefined or custom
    type: {
      type: String,
      enum: [
        "featured",      // Featured Products
        "hot",           // Hot / Trending Products
        "new_arrivals",  // New Arrivals
        "bestsellers",   // Best Sellers
        "offers",        // Discounted Products / Offers
        "custom",        // Admin-created custom sections
      ],
      default: "custom",
    },
    
    // Section description (optional, for admin reference)
    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },
    
    // Section status
    status: {
      type: String,
      enum: ["active", "inactive", "draft", "scheduled"],
      default: "draft",
    },
    
    // Display order (for sorting sections on homepage)
    displayOrder: {
      type: Number,
      default: 0,
    },
    
    // Maximum number of products to display in this section
    productLimit: {
      type: Number,
      default: 10,
      min: [1, "Product limit must be at least 1"],
      max: [50, "Product limit cannot exceed 50"],
    },
    
    // Products in this section with their display order
    products: [sectionProductSchema],
    
    // Auto-populate based on product tags (alternative to manual selection)
    autoPopulate: {
      type: Boolean,
      default: false,
    },
    
    // Filter criteria for auto-populate (used when autoPopulate is true)
    autoPopulateFilters: {
      productTags: [{
        type: String,
        enum: ["featured", "hot", "new_arrival", "bestseller", "on_sale"],
      }],
      categories: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
      }],
      subcategories: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Subcategory",
      }],
      brands: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Brand",
      }],
      minDiscount: {
        type: Number,
        min: 0,
        max: 100,
      },
      sortBy: {
        type: String,
        enum: ["newest", "oldest", "price_asc", "price_desc", "bestselling", "random"],
        default: "newest",
      },
    },
    
    // Scheduling - section visibility period
    startDate: {
      type: Date,
      default: null,
    },
    
    endDate: {
      type: Date,
      default: null,
    },
    
    // UI Configuration
    displayConfig: {
      // Number of columns in grid view
      columns: {
        type: Number,
        default: 4,
        min: 1,
        max: 6,
      },
      // Show "View All" button
      showViewAll: {
        type: Boolean,
        default: true,
      },
      // View All link URL
      viewAllLink: {
        type: String,
        default: "",
      },
      // Section background color
      backgroundColor: {
        type: String,
        default: "#ffffff",
      },
      // Section text color
      textColor: {
        type: String,
        default: "#000000",
      },
      // Layout style
      layoutStyle: {
        type: String,
        enum: ["grid", "carousel", "list", "masonry"],
        default: "grid",
      },
      // Show product count badge
      showProductCount: {
        type: Boolean,
        default: false,
      },
      // Custom CSS class
      customClass: {
        type: String,
        default: "",
      },
    },
    
    // Draft/Preview state - stores unpublished changes
    draftData: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    
    // Published state indicator
    isPublished: {
      type: Boolean,
      default: false,
    },
    
    // Last published date
    publishedAt: {
      type: Date,
      default: null,
    },
    
    // Active state (separate from status for quick toggle)
    isActive: {
      type: Boolean,
      default: true,
    },
    
    // Soft delete flag
    deleted: {
      type: Boolean,
      default: false,
    },
    
    // Multi-tenant: Website/Tenant reference
    website: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Website",
      required: [true, "Website reference is required"],
      index: true,
    },
    
    // Created by admin user
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    
    // Last updated by admin user
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
)

// Virtual to get product count
homepageSectionSchema.virtual("productCount").get(function() {
  return this.products ? this.products.length : 0
})

// Virtual to check if section is currently scheduled to be visible
homepageSectionSchema.virtual("isScheduledActive").get(function() {
  const now = new Date()
  const startOk = !this.startDate || this.startDate <= now
  const endOk = !this.endDate || this.endDate >= now
  return startOk && endOk
})

// Function to generate slug from name
const generateSlug = (name) => {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

// Pre-save middleware
homepageSectionSchema.pre("save", async function(next) {
  // Generate sectionId if not provided
  if (!this.sectionId) {
    const HomepageSection = mongoose.model("HomepageSection")
    const existingSections = await HomepageSection.find({
      sectionId: { $exists: true, $ne: null },
      website: this.website,
    })
    
    let counter = 1001
    if (existingSections.length > 0) {
      const existingIds = existingSections
        .map((s) => s.sectionId)
        .filter((id) => id && id.startsWith("PPSECNM"))
        .map((id) => {
          const match = id.match(/PPSECNM(\d+)/)
          return match ? parseInt(match[1]) : 0
        })
      
      if (existingIds.length > 0) {
        const maxNumber = Math.max(...existingIds)
        counter = maxNumber + 1
      }
    }
    
    this.sectionId = `PPSECNM${counter}`
  }
  
  // Generate slug if not provided
  if (!this.slug && this.name) {
    let baseSlug = generateSlug(this.name)
    let slug = baseSlug
    let counter = 1
    
    const HomepageSection = mongoose.model("HomepageSection")
    while (await HomepageSection.findOne({ 
      slug: slug, 
      website: this.website, 
      _id: { $ne: this._id } 
    })) {
      slug = `${baseSlug}-${counter}`
      counter++
    }
    
    this.slug = slug
  }
  
  next()
})

// Compound indexes for multi-tenancy and efficient queries
homepageSectionSchema.index({ website: 1, sectionId: 1 }, { unique: true })
homepageSectionSchema.index({ website: 1, slug: 1 }, { unique: true })
homepageSectionSchema.index({ website: 1, status: 1, deleted: 1, isActive: 1 })
homepageSectionSchema.index({ website: 1, type: 1, status: 1 })
homepageSectionSchema.index({ website: 1, displayOrder: 1 })
homepageSectionSchema.index({ website: 1, startDate: 1, endDate: 1 })
homepageSectionSchema.index({ "products.product": 1 })

// Static method to get active sections for frontend
homepageSectionSchema.statics.getActiveSections = async function(websiteId, options = {}) {
  const now = new Date()
  const { includeProducts = true, limit = 10 } = options
  
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
  
  let sectionsQuery = this.find(query)
    .sort({ displayOrder: 1 })
    .lean()
  
  if (includeProducts) {
    sectionsQuery = sectionsQuery.populate({
      path: "products.product",
      match: { isActive: true, deleted: false },
      select: "name slug price discountedPrice mainImage images stock isActive",
    })
  }
  
  const sections = await sectionsQuery
  
  // Filter out null products and apply limit
  return sections.map((section) => ({
    ...section,
    products: (section.products || [])
      .filter((p) => p.product !== null)
      .slice(0, section.productLimit || limit),
  }))
}

export default mongoose.model("HomepageSection", homepageSectionSchema)
