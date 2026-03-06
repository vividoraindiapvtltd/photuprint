import mongoose from "mongoose"

/**
 * Interaction Model
 * 
 * Tracks all interactions/activities with clients including:
 * - Calls (inbound/outbound)
 * - Emails
 * - Meetings
 * - Follow-ups
 * - Notes
 * - Tasks
 * 
 * Provides timestamped activity history for each client.
 */

const interactionSchema = new mongoose.Schema(
  {
    // Auto-generated interaction ID
    interactionId: {
      type: String,
      index: true,
    },
    
    // Associated client
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      required: [true, "Client reference is required"],
      index: true,
    },
    
    // Interaction type
    type: {
      type: String,
      enum: [
        "call_inbound",
        "call_outbound",
        "email_sent",
        "email_received",
        "meeting",
        "video_call",
        "follow_up",
        "note",
        "task",
        "document",
        "proposal",
        "invoice",
        "payment",
        "status_change",
        "other",
      ],
      required: [true, "Interaction type is required"],
      index: true,
    },
    
    // Subject/Title
    subject: {
      type: String,
      required: [true, "Subject is required"],
      trim: true,
      maxlength: [255, "Subject cannot exceed 255 characters"],
    },
    
    // Description/Content
    description: {
      type: String,
      trim: true,
      maxlength: [10000, "Description cannot exceed 10000 characters"],
    },
    
    // Outcome/Result
    outcome: {
      type: String,
      enum: ["successful", "unsuccessful", "pending", "rescheduled", "cancelled", "no_answer", "voicemail", "busy", "callback_requested", "not_interested", "interested", "converted", "other"],
      default: "pending",
    },
    
    // Duration (for calls, meetings)
    duration: {
      type: Number, // in minutes
      min: 0,
      default: 0,
    },
    
    // Scheduled/Actual datetime
    scheduledAt: {
      type: Date,
      index: true,
    },
    
    completedAt: {
      type: Date,
    },
    
    // For follow-ups and tasks
    dueDate: {
      type: Date,
      index: true,
    },
    
    reminderAt: {
      type: Date,
    },
    
    // Priority
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },
    
    // Status
    status: {
      type: String,
      enum: ["scheduled", "in_progress", "completed", "cancelled", "overdue"],
      default: "scheduled",
      index: true,
    },
    
    // Is this a private/internal note?
    isPrivate: {
      type: Boolean,
      default: false,
    },
    
    // Attachments
    attachments: [{
      name: { type: String, required: true },
      url: { type: String, required: true },
      type: { type: String }, // mime type
      size: { type: Number }, // in bytes
      uploadedAt: { type: Date, default: Date.now },
    }],
    
    // Related entities
    relatedTo: {
      entityType: { type: String, enum: ["order", "product", "quote", "invoice", "other"] },
      entityId: { type: mongoose.Schema.Types.ObjectId },
      entityRef: { type: String },
    },
    
    // Tags
    tags: [{
      type: String,
      trim: true,
      lowercase: true,
    }],
    
    // Contact method details
    contactMethod: {
      channel: { type: String }, // phone, email, in-person, video
      direction: { type: String, enum: ["inbound", "outbound"] },
      phoneNumber: { type: String },
      emailAddress: { type: String },
      meetingLocation: { type: String },
      meetingLink: { type: String },
    },
    
    // Participants (for meetings)
    participants: [{
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      name: { type: String },
      email: { type: String },
      role: { type: String }, // organizer, attendee, optional
    }],
    
    // Status change tracking (if type is status_change)
    statusChange: {
      from: { type: String },
      to: { type: String },
      reason: { type: String },
    },
    
    // Sentiment/Feedback
    sentiment: {
      type: String,
      enum: ["positive", "neutral", "negative"],
    },
    
    // Follow-up required
    followUpRequired: {
      type: Boolean,
      default: false,
    },
    
    nextFollowUpDate: {
      type: Date,
    },
    
    nextFollowUpNotes: {
      type: String,
      maxlength: 1000,
    },
    
    // Flags
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
      required: true,
    },
    
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

// Virtual for formatted duration
interactionSchema.virtual("formattedDuration").get(function() {
  if (!this.duration) return "0 min"
  if (this.duration < 60) return `${this.duration} min`
  const hours = Math.floor(this.duration / 60)
  const mins = this.duration % 60
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
})

// Virtual to check if overdue
interactionSchema.virtual("isOverdue").get(function() {
  if (this.status === "completed" || this.status === "cancelled") return false
  if (!this.dueDate) return false
  return new Date() > this.dueDate
})

// Pre-save middleware
interactionSchema.pre("save", async function(next) {
  // Generate interactionId if not provided
  if (!this.interactionId) {
    const Interaction = mongoose.model("Interaction")
    const existingInteractions = await Interaction.find({
      interactionId: { $exists: true, $ne: null },
      website: this.website,
    })
    
    let counter = 1001
    if (existingInteractions.length > 0) {
      const existingIds = existingInteractions
        .map((i) => i.interactionId)
        .filter((id) => id && id.startsWith("PPINTNM"))
        .map((id) => {
          const match = id.match(/PPINTNM(\d+)/)
          return match ? parseInt(match[1]) : 0
        })
      
      if (existingIds.length > 0) {
        const maxNumber = Math.max(...existingIds)
        counter = maxNumber + 1
      }
    }
    
    this.interactionId = `PPINTNM${counter}`
  }
  
  // Auto-update status to overdue
  if (this.status === "scheduled" && this.dueDate && new Date() > this.dueDate) {
    this.status = "overdue"
  }
  
  // Set completedAt when status changes to completed
  if (this.isModified("status") && this.status === "completed" && !this.completedAt) {
    this.completedAt = new Date()
  }
  
  next()
})

// Post-save middleware to update client's interaction count and last contacted
interactionSchema.post("save", async function() {
  try {
    const Client = mongoose.model("Client")
    const client = await Client.findById(this.client)
    
    if (client) {
      // Update interaction count
      const count = await mongoose.model("Interaction").countDocuments({
        client: this.client,
        deleted: false,
      })
      client.interactionCount = count
      
      // Update last contacted for certain interaction types
      const contactTypes = ["call_inbound", "call_outbound", "email_sent", "email_received", "meeting", "video_call"]
      if (contactTypes.includes(this.type)) {
        client.lastContactedAt = this.createdAt
      }
      
      // Update next follow-up if specified
      if (this.nextFollowUpDate && this.followUpRequired) {
        client.nextFollowUp = this.nextFollowUpDate
      }
      
      await client.save()
    }
  } catch (error) {
    console.error("Error updating client after interaction save:", error)
  }
})

// Compound indexes for multi-tenancy and efficient queries
interactionSchema.index({ website: 1, interactionId: 1 }, { unique: true })
interactionSchema.index({ website: 1, client: 1, createdAt: -1 })
interactionSchema.index({ website: 1, type: 1, status: 1 })
interactionSchema.index({ website: 1, createdBy: 1, createdAt: -1 })
interactionSchema.index({ website: 1, dueDate: 1, status: 1 })
interactionSchema.index({ website: 1, scheduledAt: 1 })
interactionSchema.index({ website: 1, deleted: 1, isActive: 1 })

// Static method to get interactions for a client
interactionSchema.statics.getClientHistory = async function(clientId, websiteId, options = {}) {
  const { page = 1, limit = 20, type } = options
  
  const query = {
    client: clientId,
    website: websiteId,
    deleted: false,
  }
  
  if (type) {
    query.type = type
  }
  
  const skip = (page - 1) * limit
  
  const [interactions, total] = await Promise.all([
    this.find(query)
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    this.countDocuments(query),
  ])
  
  return {
    interactions,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
  }
}

// Static method to get upcoming tasks/follow-ups
interactionSchema.statics.getUpcomingTasks = async function(websiteId, userId = null, days = 7) {
  const now = new Date()
  const future = new Date()
  future.setDate(future.getDate() + days)
  
  const query = {
    website: websiteId,
    deleted: false,
    status: { $in: ["scheduled", "overdue"] },
    $or: [
      { dueDate: { $gte: now, $lte: future } },
      { scheduledAt: { $gte: now, $lte: future } },
    ],
  }
  
  if (userId) {
    query.createdBy = userId
  }
  
  return this.find(query)
    .populate("client", "firstName lastName company email phone")
    .populate("createdBy", "name email")
    .sort({ dueDate: 1, scheduledAt: 1 })
    .lean()
}

export default mongoose.model("Interaction", interactionSchema)
