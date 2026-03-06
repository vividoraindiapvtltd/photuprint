import mongoose from "mongoose"

/**
 * Client Model
 * 
 * Manages client information for CRM functionality.
 * Supports multi-tenant architecture via website field.
 * 
 * Features:
 * - Client details (name, email, phone, company)
 * - Status pipeline (Lead, Active, Inactive, Closed)
 * - Tags for categorization
 * - Assigned user tracking
 * - Notes and custom fields
 */

const clientSchema = new mongoose.Schema(
  {
    // Auto-generated client ID
    clientId: {
      type: String,
      index: true,
    },
    
    // Basic Information
    firstName: {
      type: String,
      required: [true, "First name is required"],
      trim: true,
      maxlength: [100, "First name cannot exceed 100 characters"],
    },
    
    lastName: {
      type: String,
      trim: true,
      maxlength: [100, "Last name cannot exceed 100 characters"],
      default: "",
    },
    
    // Full name (computed virtual)
    // Accessed via client.name
    
    email: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: [255, "Email cannot exceed 255 characters"],
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email address"],
    },
    
    phone: {
      type: String,
      trim: true,
      maxlength: [20, "Phone number cannot exceed 20 characters"],
    },
    
    alternatePhone: {
      type: String,
      trim: true,
      maxlength: [20, "Alternate phone cannot exceed 20 characters"],
    },
    
    // Company Information
    company: {
      type: String,
      trim: true,
      maxlength: [200, "Company name cannot exceed 200 characters"],
    },
    
    designation: {
      type: String,
      trim: true,
      maxlength: [100, "Designation cannot exceed 100 characters"],
    },
    
    industry: {
      type: String,
      trim: true,
      maxlength: [100, "Industry cannot exceed 100 characters"],
    },
    
    // Address
    address: {
      street: { type: String, trim: true, maxlength: 255 },
      city: { type: String, trim: true, maxlength: 100 },
      state: { type: String, trim: true, maxlength: 100 },
      postalCode: { type: String, trim: true, maxlength: 20 },
      country: { type: String, trim: true, maxlength: 100, default: "India" },
    },
    
    // Client Status Pipeline
    status: {
      type: String,
      enum: ["lead", "prospect", "active", "inactive", "closed", "lost"],
      default: "lead",
      index: true,
    },
    
    // Lead Source
    source: {
      type: String,
      enum: ["website", "referral", "social_media", "cold_call", "email_campaign", "trade_show", "advertisement", "partner", "other"],
      default: "other",
    },
    
    sourceDetails: {
      type: String,
      trim: true,
      maxlength: [500, "Source details cannot exceed 500 characters"],
    },
    
    // Tags for categorization
    tags: [{
      type: String,
      trim: true,
      lowercase: true,
    }],
    
    // Priority
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },
    
    // Value and Revenue
    estimatedValue: {
      type: Number,
      default: 0,
      min: 0,
    },
    
    actualValue: {
      type: Number,
      default: 0,
      min: 0,
    },
    
    currency: {
      type: String,
      default: "INR",
      maxlength: 3,
    },
    
    // Assignment
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    
    // Follow-up
    nextFollowUp: {
      type: Date,
      index: true,
    },
    
    lastContactedAt: {
      type: Date,
    },
    
    // Notes
    notes: {
      type: String,
      maxlength: [5000, "Notes cannot exceed 5000 characters"],
    },
    
    // Internal notes (only visible to admins)
    internalNotes: {
      type: String,
      maxlength: [5000, "Internal notes cannot exceed 5000 characters"],
    },
    
    // Custom fields for flexibility
    customFields: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: new Map(),
    },
    
    // Social profiles
    socialProfiles: {
      linkedin: { type: String, trim: true },
      twitter: { type: String, trim: true },
      facebook: { type: String, trim: true },
      instagram: { type: String, trim: true },
      website: { type: String, trim: true },
    },
    
    // Profile image
    avatar: {
      type: String,
      default: null,
    },
    
    // Interaction counts (denormalized for performance)
    interactionCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    
    // Status flags
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
    
    // Audit fields
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    
    convertedAt: {
      type: Date,
    },
    
    closedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
)

// Virtual for full name
clientSchema.virtual("name").get(function() {
  if (this.lastName) {
    return `${this.firstName} ${this.lastName}`.trim()
  }
  return this.firstName
})

// Virtual for display name with company
clientSchema.virtual("displayName").get(function() {
  const fullName = this.name
  if (this.company) {
    return `${fullName} (${this.company})`
  }
  return fullName
})

// Virtual for full address
clientSchema.virtual("fullAddress").get(function() {
  if (!this.address) return ""
  const parts = [
    this.address.street,
    this.address.city,
    this.address.state,
    this.address.postalCode,
    this.address.country,
  ].filter(Boolean)
  return parts.join(", ")
})

// Pre-save middleware to generate clientId
clientSchema.pre("save", async function(next) {
  if (!this.clientId) {
    const Client = mongoose.model("Client")
    const existingClients = await Client.find({
      clientId: { $exists: true, $ne: null },
      website: this.website,
    })
    
    let counter = 1001
    if (existingClients.length > 0) {
      const existingIds = existingClients
        .map((c) => c.clientId)
        .filter((id) => id && id.startsWith("PPCLINM"))
        .map((id) => {
          const match = id.match(/PPCLINM(\d+)/)
          return match ? parseInt(match[1]) : 0
        })
      
      if (existingIds.length > 0) {
        const maxNumber = Math.max(...existingIds)
        counter = maxNumber + 1
      }
    }
    
    this.clientId = `PPCLINM${counter}`
  }
  
  // Update status timestamps
  if (this.isModified("status")) {
    if (this.status === "active" && !this.convertedAt) {
      this.convertedAt = new Date()
    }
    if (this.status === "closed" || this.status === "lost") {
      this.closedAt = new Date()
    }
  }
  
  next()
})

// Compound indexes for multi-tenancy and efficient queries
clientSchema.index({ website: 1, clientId: 1 }, { unique: true })
clientSchema.index({ website: 1, email: 1 })
clientSchema.index({ website: 1, status: 1, deleted: 1, isActive: 1 })
clientSchema.index({ website: 1, assignedTo: 1, status: 1 })
clientSchema.index({ website: 1, nextFollowUp: 1 })
clientSchema.index({ website: 1, tags: 1 })
clientSchema.index({ website: 1, company: 1 })
clientSchema.index({ website: 1, createdAt: -1 })
clientSchema.index({ website: 1, priority: 1, status: 1 })

// Text index for search
clientSchema.index({
  firstName: "text",
  lastName: "text",
  email: "text",
  company: "text",
  phone: "text",
  notes: "text",
})

// Static method to get clients with upcoming follow-ups
clientSchema.statics.getUpcomingFollowUps = async function(websiteId, days = 7) {
  const now = new Date()
  const future = new Date()
  future.setDate(future.getDate() + days)
  
  return this.find({
    website: websiteId,
    isActive: true,
    deleted: false,
    nextFollowUp: { $gte: now, $lte: future },
  })
    .populate("assignedTo", "name email")
    .sort({ nextFollowUp: 1 })
    .lean()
}

// Static method to get client statistics
clientSchema.statics.getStatistics = async function(websiteId) {
  const baseQuery = { website: websiteId, deleted: false }
  
  const [
    total,
    byStatus,
    byPriority,
    recentlyAdded,
  ] = await Promise.all([
    this.countDocuments(baseQuery),
    this.aggregate([
      { $match: baseQuery },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    this.aggregate([
      { $match: baseQuery },
      { $group: { _id: "$priority", count: { $sum: 1 } } },
    ]),
    this.countDocuments({
      ...baseQuery,
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    }),
  ])
  
  return {
    total,
    byStatus: byStatus.reduce((acc, item) => {
      acc[item._id] = item.count
      return acc
    }, {}),
    byPriority: byPriority.reduce((acc, item) => {
      acc[item._id] = item.count
      return acc
    }, {}),
    recentlyAdded,
  }
}

export default mongoose.model("Client", clientSchema)
