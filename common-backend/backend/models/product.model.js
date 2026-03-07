import mongoose from "mongoose"

const productSchema = new mongoose.Schema(
  {
    productId: { type: String }, // Unique constraint handled by compound index with website
    name: { type: String, required: true },
    slug: { type: String }, // Unique constraint handled by compound index with website
    description: String,
    shortDescription: { type: String, default: "" },
    tags: { type: String, default: "" },
    material: { type: mongoose.Schema.Types.ObjectId, ref: "Material", default: null },
    weight: { type: String, default: null },
    shippingClass: { type: String, default: "" },
    processingTime: { type: String, default: "" },
    dimensions: {
      length: { type: mongoose.Schema.Types.ObjectId, ref: "Length", default: null },
      width: { type: mongoose.Schema.Types.ObjectId, ref: "Width", default: null },
      height: { type: mongoose.Schema.Types.ObjectId, ref: "Height", default: null },
    },
    price: { type: Number, required: true },
    discountedPrice: { type: Number, default: null },
    discountPercentage: { type: Number, default: null },
    sku: { type: String }, // Unique constraint handled by compound index with website
    mainImage: { type: String, required: false },
    images: [String],
    video: { type: String, default: null },
    colors: [{ type: mongoose.Schema.Types.ObjectId, ref: "Color" }],
    sizes: [{ type: mongoose.Schema.Types.ObjectId, ref: "Size" }],
    templates: [{ type: mongoose.Schema.Types.ObjectId, ref: "Template" }],
    heights: [{ type: mongoose.Schema.Types.ObjectId, ref: "Height" }],
    lengths: [{ type: mongoose.Schema.Types.ObjectId, ref: "Length" }],
    category: { type: mongoose.Schema.Types.ObjectId, ref: "Category" },
    subcategory: { type: mongoose.Schema.Types.ObjectId, ref: "Subcategory" },
    brand: { type: mongoose.Schema.Types.ObjectId, ref: "Brand" },
    collarStyle: { type: mongoose.Schema.Types.ObjectId, ref: "CollarStyle", default: null },
    pattern: { type: mongoose.Schema.Types.ObjectId, ref: "Pattern", default: null },
    fitType: { type: mongoose.Schema.Types.ObjectId, ref: "FitType", default: null },
    sleeveType: { type: mongoose.Schema.Types.ObjectId, ref: "SleeveType", default: null },
    printingType: { type: mongoose.Schema.Types.ObjectId, ref: "PrintingType", default: null },
    countryOfOrigin: { type: mongoose.Schema.Types.ObjectId, ref: "Country", default: null },
    taxClass: { type: mongoose.Schema.Types.ObjectId, ref: "GstSlab", default: null },
    // Additional product attributes (text)
    includedComponents: { type: String, default: null },
    productCareInstructions: { type: String, default: null },
    recommendedUsesForProduct: { type: String, default: null },
    reusability: { type: String, default: null },
    shape: { type: String, default: null },
    specialFeature: { type: String, default: null },
    specificUsesForProduct: { type: String, default: null },
    style: { type: String, default: null },
    design: { type: String, default: null },
    occasion: { type: String, default: null },
    stock: Number,
    noOfPcsIncluded: { type: Number, default: null },
    isActive: { type: Boolean, default: true },
    deleted: { type: Boolean, default: false },
    // Display mode: 'standard' (no templates), 'customized' (templates only), 'both' (toggle)
    displayMode: {
      type: String,
      enum: ["standard", "customized", "both"],
      default: "both",
    },
    // SEO Fields as nested object
    seo: {
      metaKeywords: { type: String, default: "" },
      metaDescription: { type: String, default: "" },
      canonicalLink: { type: String, default: "" },
      jsonLd: { type: String, default: "" },
    },
    // Multi-tenant: Website/Tenant reference (indexed via compound schema.index below)
    website: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Website',
      required: true,
    },
    
    // Product Variations Support
    // If true, product uses variant-based pricing/stock instead of direct price/stock
    hasVariations: {
      type: Boolean,
      default: false
    },
    
    // Available attributes for variations (e.g., ["size", "color", "material"])
    variationAttributes: [{
      type: String,
      default: []
    }],
    
    // Default variant (if no variant selected, use this)
    defaultVariant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductVariant",
      default: null
    },
    
    // Homepage Display Tags
    // These flags help categorize products for homepage sections
    homepageTags: {
      // Featured product - showcased prominently
      featured: {
        type: Boolean,
        default: false,
        index: true
      },
      // Hot/Trending product - currently popular
      hot: {
        type: Boolean,
        default: false,
        index: true
      },
      // New arrival - recently added
      newArrival: {
        type: Boolean,
        default: false,
        index: true
      },
      // Best seller - high sales volume
      bestseller: {
        type: Boolean,
        default: false,
        index: true
      },
      // On sale - currently discounted
      onSale: {
        type: Boolean,
        default: false,
        index: true
      },
      // Featured date - when product was marked as featured
      featuredAt: {
        type: Date,
        default: null
      },
      // Hot/Trending date
      hotAt: {
        type: Date,
        default: null
      },
      // New arrival date
      newArrivalAt: {
        type: Date,
        default: null
      },
      // Bestseller date
      bestsellerAt: {
        type: Date,
        default: null
      }
    },
    
    // Sales count for bestseller calculations
    salesCount: {
      type: Number,
      default: 0,
      min: 0
    },
    
    // View count for trending calculations
    viewCount: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  { timestamps: true }
)

// Virtual field to expose productType from displayMode for frontend compatibility
productSchema.virtual('productType').get(function() {
  if (this.displayMode === "customized") return "customized"
  if (this.displayMode === "standard") return "standard"
  return "standard" // default
})

// Ensure virtuals are included in JSON
productSchema.set('toJSON', { virtuals: true })
productSchema.set('toObject', { virtuals: true })

// Function to generate slug from name
const generateSlug = (name) => {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "") // Remove special characters
    .replace(/[\s_-]+/g, "-") // Replace spaces and underscores with hyphens
    .replace(/^-+|-+$/g, "") // Remove leading/trailing hyphens
}

// Pre-save middleware to generate productId, slug and SKU if not provided
productSchema.pre("save", async function (next) {
  // Generate productId if not provided (scoped to website for multi-tenancy)
  if (!this.productId) {
    const Product = mongoose.model("Product")
    const existingProducts = await Product.find({ 
      productId: { $exists: true, $ne: null },
      website: this.website // Only check within the same website
    })
    let counter = 1001

    if (existingProducts.length > 0) {
      const existingIds = existingProducts
        .map((p) => p.productId)
        .filter((id) => id && id.startsWith("PPPRDNM"))
        .map((id) => {
          const match = id.match(/PPPRDNM(\d+)/)
          return match ? parseInt(match[1]) : 0
        })

      if (existingIds.length > 0) {
        const maxNumber = Math.max(...existingIds)
        counter = maxNumber + 1
      }
    }

    this.productId = `PPPRDNM${counter}`
  }

  // Generate slug if not provided
  if (!this.slug && this.name) {
    let baseSlug = generateSlug(this.name)
    let slug = baseSlug
    let counter = 1

    // Check for existing slugs within the same website and append number if needed
    const Product = mongoose.model("Product")
    while (await Product.findOne({ slug: slug, website: this.website, _id: { $ne: this._id } })) {
      slug = `${baseSlug}-${counter}`
      counter++
    }

    this.slug = slug
  }

  // Generate SKU if not provided
  if (!this.sku && this.name) {
    const timestamp = Date.now().toString().slice(-6)
    const namePrefix = this.name
      .substring(0, 3)
      .toUpperCase()
      .replace(/[^A-Z]/g, "")
    let baseSku = `${namePrefix}${timestamp}`
    let sku = baseSku
    let counter = 1

    // Check for existing SKUs within the same website and append number if needed
    const Product = mongoose.model("Product")
    while (await Product.findOne({ sku: sku, website: this.website, _id: { $ne: this._id } })) {
      sku = `${baseSku}${counter}`
      counter++
    }

    this.sku = sku
  }

  next()
})

// Create compound unique indexes for multi-tenancy
// productId, slug, and SKU should be unique per website
productSchema.index({ productId: 1, website: 1 }, { unique: true, partialFilterExpression: { deleted: false } });
productSchema.index({ slug: 1, website: 1 }, { unique: true, partialFilterExpression: { deleted: false } });
productSchema.index({ sku: 1, website: 1 }, { unique: true, partialFilterExpression: { deleted: false } });
productSchema.index({ website: 1, isActive: 1, deleted: 1 });

// Homepage tags indexes for efficient filtering
productSchema.index({ website: 1, "homepageTags.featured": 1, isActive: 1, deleted: 1 });
productSchema.index({ website: 1, "homepageTags.hot": 1, isActive: 1, deleted: 1 });
productSchema.index({ website: 1, "homepageTags.newArrival": 1, isActive: 1, deleted: 1 });
productSchema.index({ website: 1, "homepageTags.bestseller": 1, isActive: 1, deleted: 1 });
productSchema.index({ website: 1, "homepageTags.onSale": 1, isActive: 1, deleted: 1 });
productSchema.index({ website: 1, salesCount: -1 });
productSchema.index({ website: 1, viewCount: -1 });

export default mongoose.model("Product", productSchema)
