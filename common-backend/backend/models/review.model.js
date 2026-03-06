import mongoose from "mongoose"

const reviewSchema = new mongoose.Schema(
  {
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    subCategoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subcategory",
      required: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    productName: {
      type: String,
      default: null,
    },
    userId: {
      type: String,
      default: null, // Optional for admin-created reviews
    },
    name: {
      type: String,
      required: true,
    },
    avatar: {
      type: String,
      default: null,
    },
    title: {
      type: String,
      default: null,
    },
    email: {
      type: String,
      required: true,
    },
    comment: {
      type: String,
      required: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    productImage: {
      type: String,
      default: null,
    }, // Keep for backward compatibility
    productImages: {
      type: [String],
      default: [],
    }, // Array of product image URLs (up to 5)
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    source: {
      type: String,
      enum: ["admin", "user"],
      default: "user",
    },
    reviewedBy: {
      type: String,
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    deleted: {
      type: Boolean,
      default: false,
    },
    // Multi-tenant: Website/Tenant reference
    website: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Website',
      required: true,
      index: true
    },
  },
  {
    timestamps: true,
  }
)

// Create indexes for better search performance and multi-tenancy
reviewSchema.index({ website: 1, productId: 1, status: 1 })
reviewSchema.index({ website: 1, categoryId: 1, subCategoryId: 1 })
reviewSchema.index({ website: 1, rating: 1, status: 1 })
reviewSchema.index({ website: 1, source: 1, status: 1 })
reviewSchema.index({ website: 1, status: 1, deleted: 1, isActive: 1 })

export default mongoose.model("Review", reviewSchema)
