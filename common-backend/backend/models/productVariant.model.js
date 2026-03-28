import mongoose from "mongoose"

/**
 * ProductVariant Model
 * Represents a single variation of a product (e.g., Size: M, Color: Red)
 * Similar to Amazon/Flipkart variant system
 */
const productVariantSchema = new mongoose.Schema(
  {
    // Reference to parent product
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true
    },
    
    // Variant attributes (flexible key-value pairs)
    // Example: { size: "M", color: "Red", material: "Cotton" }
    attributes: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      required: true
    },
    
    // Auto-generated SKU (editable)
    sku: {
      type: String,
      required: true,
      index: true
    },
    
    // Variant-specific pricing
    price: {
      type: Number,
      required: true,
      min: 0
    },
    
    // Discount price (optional)
    discountedPrice: {
      type: Number,
      default: null,
      min: 0
    },
    
    // Stock/Quantity management
    stock: {
      type: Number,
      default: 0,
      min: 0
    },
    
    // Low stock threshold (for alerts)
    lowStockThreshold: {
      type: Number,
      default: 10
    },
    
    // Variant-specific images
    images: [{
      type: String,
      default: []
    }],
    
    // Primary image for this variant
    primaryImage: {
      type: String,
      default: null
    },
    
    // Variant status
    isActive: {
      type: Boolean,
      default: true
    },
    
    // Out of stock flag
    isOutOfStock: {
      type: Boolean,
      default: false
    },
    
    // Weight (for shipping calculations)
    weight: {
      type: Number,
      default: null
    },
    
    // Barcode (optional)
    barcode: {
      type: String,
      default: null
    },
    
    // Multi-tenant: Website reference
    website: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Website',
      required: true,
      index: true
    },
    
    // Soft delete
    deleted: {
      type: Boolean,
      default: false
    },

    /** PDP / admin list order (ascending). Lower = first. */
    sortOrder: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true
  }
)

// Generate SKU from attributes if not provided
productVariantSchema.pre("save", async function (next) {
  if (!this.sku && this.product) {
    const Product = mongoose.model("Product")
    const product = await Product.findById(this.product)
    
    if (product) {
      // Generate SKU: Product SKU + Attribute values
      const attrValues = Array.from(this.attributes.values())
        .map(val => String(val).substring(0, 3).toUpperCase().replace(/[^A-Z0-9]/g, ""))
        .join("-")
      
      const baseSku = `${product.sku || product.productId || "VAR"}-${attrValues}`
      let sku = baseSku
      let counter = 1
      
      // Check for existing SKUs within the same website
      const ProductVariant = mongoose.model("ProductVariant")
      while (await ProductVariant.findOne({ 
        sku: sku, 
        website: this.website, 
        _id: { $ne: this._id },
        deleted: false 
      })) {
        sku = `${baseSku}-${counter}`
        counter++
      }
      
      this.sku = sku
    }
  }
  
  // Validate stock doesn't exceed product stock
  if (this.stock !== undefined && this.product) {
    const Product = mongoose.model("Product")
    const product = await Product.findById(this.product)
    
    if (product) {
      const productStock = product.stock || 0
      if (this.stock > productStock) {
        return next(new Error(`Variant stock (${this.stock}) cannot be greater than product stock (${productStock})`))
      }
    }
  }
  
  // Auto-update isOutOfStock based on stock
  if (this.stock !== undefined) {
    this.isOutOfStock = this.stock === 0
  }
  
  next()
})

// Compound indexes for performance
productVariantSchema.index({ product: 1, deleted: 1, isActive: 1 })
productVariantSchema.index({ sku: 1, website: 1 }, { unique: true, partialFilterExpression: { deleted: false } })
productVariantSchema.index({ website: 1, isActive: 1, deleted: 1 })
productVariantSchema.index({ website: 1, isOutOfStock: 1 })

// Virtual for checking low stock
productVariantSchema.virtual('isLowStock').get(function() {
  return this.stock > 0 && this.stock <= this.lowStockThreshold
})

// Method to generate variant key (for duplicate detection)
productVariantSchema.methods.generateVariantKey = function() {
  const sortedAttrs = Array.from(this.attributes.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, value]) => `${key}:${value}`)
    .join("|")
  return sortedAttrs
}

// Static method to check for duplicate variants
productVariantSchema.statics.findDuplicate = async function(productId, attributes, websiteId, excludeId = null) {
  const variantKey = Array.from(attributes.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, value]) => `${key}:${value}`)
    .join("|")
  
  const query = {
    product: productId,
    website: websiteId,
    deleted: false,
    _id: { $ne: excludeId }
  }
  
  const variants = await this.find(query)
  
  for (const variant of variants) {
    const existingKey = variant.generateVariantKey()
    if (existingKey === variantKey) {
      return variant
    }
  }
  
  return null
}

export default mongoose.model("ProductVariant", productVariantSchema)
