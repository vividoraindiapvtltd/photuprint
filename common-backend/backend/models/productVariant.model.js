import mongoose from "mongoose"
import { variantStockExceedsProductStock } from "../utils/productStockValidation.js"

function attributeEntries(attrs) {
  if (!attrs) return []
  if (attrs instanceof Map) return Array.from(attrs.entries())
  if (typeof attrs === "object" && !Array.isArray(attrs)) return Object.entries(attrs)
  return []
}

function attributeValues(attrs) {
  if (!attrs) return []
  if (attrs instanceof Map) return Array.from(attrs.values())
  if (typeof attrs === "object" && !Array.isArray(attrs)) return Object.values(attrs)
  return []
}

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
    
    // Stock/Quantity management (-1 = unlimited at variant level when product is unlimited)
    stock: {
      type: Number,
      default: 0,
      min: -1
    },
    
    // Low stock threshold (for alerts)
    lowStockThreshold: {
      type: Number,
      default: 10
    },
    
    // Variant-specific images (array of URL strings)
    images: {
      type: [String],
      default: [],
    },
    
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

    /**
     * Per-size quantities when the variant is color-only (attributes have color, not size).
     * `stock` is kept in sync as the sum of rows (or -1 if any row is unlimited).
     */
    sizeStock: {
      type: [
        {
          size: { type: mongoose.Schema.Types.ObjectId, ref: "Size", required: true },
          stock: { type: Number, default: 0, min: -1 },
        },
      ],
      default: [],
    },
  },
  {
    timestamps: true
  }
)

// Generate SKU from attributes if not provided
productVariantSchema.pre("save", async function (next) {
  if (this.attributes && !(this.attributes instanceof Map) && typeof this.attributes === "object") {
    this.attributes = new Map(Object.entries(this.attributes))
  }

  if (!this.sku && this.product) {
    const Product = mongoose.model("Product")
    const product = await Product.findById(this.product)
    
    if (product) {
      // Generate SKU: Product SKU + Attribute values
      const attrValues = attributeValues(this.attributes)
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
  
  if (this.sizeStock && Array.isArray(this.sizeStock) && this.sizeStock.length > 0) {
    let sum = 0
    let anyUnlimited = false
    for (const r of this.sizeStock) {
      const n = Number(r.stock)
      if (n === -1) {
        anyUnlimited = true
        break
      }
      if (Number.isFinite(n) && n >= 0) sum += n
    }
    this.stock = anyUnlimited ? -1 : sum
    this.isOutOfStock = this.stock === 0
  }

  if (this.stock !== undefined && this.product) {
    const Product = mongoose.model("Product")
    const product = await Product.findById(this.product)
    
    if (product) {
      const s = Number(this.stock)
      if (!Number.isNaN(s) && s < 0 && product.stock != null && Number(product.stock) >= 0) {
        return next(new Error("Unlimited variant quantity (-1) is only allowed when product inventory is unlimited."))
      }
      if (variantStockExceedsProductStock(this.stock, product.stock)) {
        return next(new Error(`Variant stock (${this.stock}) cannot be greater than product stock (${product.stock ?? 0})`))
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
  const sortedAttrs = attributeEntries(this.attributes)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, value]) => `${key}:${value}`)
    .join("|")
  return sortedAttrs
}

// Static method to check for duplicate variants
productVariantSchema.statics.findDuplicate = async function(productId, attributes, websiteId, excludeId = null) {
  const variantKey = attributeEntries(attributes)
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
