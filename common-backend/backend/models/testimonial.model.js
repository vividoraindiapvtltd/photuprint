import mongoose from "mongoose"

/**
 * Testimonial Schema
 * 
 * Stores customer testimonials with approval workflow, categorization, and multi-tenant support.
 * Testimonials can be collected from users, imported from CSV, or created by admins.
 */
const testimonialSchema = new mongoose.Schema(
  {
    // Customer information
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      maxlength: [100, "Name cannot exceed 100 characters"],
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email"],
    },
    role: {
      type: String,
      trim: true,
      maxlength: [100, "Role cannot exceed 100 characters"],
      default: null, // e.g., "CEO", "Marketing Manager", "Customer"
    },
    company: {
      type: String,
      trim: true,
      maxlength: [200, "Company name cannot exceed 200 characters"],
      default: null,
    },
    photo: {
      type: String,
      default: null, // URL to customer photo/avatar
    },

    // Testimonial content
    testimonial: {
      type: String,
      required: [true, "Testimonial text is required"],
      trim: true,
      maxlength: [2000, "Testimonial cannot exceed 2000 characters"],
    },
    rating: {
      type: Number,
      min: [1, "Rating must be at least 1"],
      max: [5, "Rating cannot exceed 5"],
      default: 5,
    },

    // Source tracking
    source: {
      type: String,
      enum: ["website", "email", "social", "import", "admin", "google", "facebook", "trustpilot", "other"],
      default: "website",
    },
    sourceUrl: {
      type: String,
      trim: true,
      default: null, // Link to original testimonial if from external source
    },

    // Categorization with tags
    tags: [{
      type: String,
      trim: true,
      lowercase: true,
    }],
    category: {
      type: String,
      enum: ["product", "service", "support", "delivery", "quality", "value", "general"],
      default: "general",
    },
    
    // Optional product/feature reference
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null,
    },
    productName: {
      type: String,
      trim: true,
      default: null,
    },

    // Approval workflow
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    reviewedBy: {
      type: String,
      default: null, // Admin who reviewed
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    rejectionReason: {
      type: String,
      trim: true,
      default: null,
    },

    // Display settings
    isFeatured: {
      type: Boolean,
      default: false, // Featured testimonials shown prominently
    },
    displayOrder: {
      type: Number,
      default: 0, // For manual ordering
    },

    // State management
    isActive: {
      type: Boolean,
      default: true,
    },
    deleted: {
      type: Boolean,
      default: false,
    },

    // Multi-tenant support
    website: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Website",
      required: [true, "Website reference is required"],
      index: true,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt
  }
)

// Indexes for efficient queries
testimonialSchema.index({ website: 1, status: 1, deleted: 1, isActive: 1 })
testimonialSchema.index({ website: 1, category: 1, status: 1 })
testimonialSchema.index({ website: 1, rating: 1, status: 1 })
testimonialSchema.index({ website: 1, isFeatured: 1, status: 1 })
testimonialSchema.index({ website: 1, tags: 1 })
testimonialSchema.index({ website: 1, source: 1 })
testimonialSchema.index({ createdAt: -1 })

// Text index for search
testimonialSchema.index({
  name: "text",
  testimonial: "text",
  company: "text",
  tags: "text",
})

export default mongoose.model("Testimonial", testimonialSchema)
