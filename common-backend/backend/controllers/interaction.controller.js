import Interaction from "../models/interaction.model.js"
import Client from "../models/client.model.js"

/**
 * Interaction Controller
 * 
 * Manages client interactions including:
 * - Calls, emails, meetings, follow-ups
 * - Notes and tasks
 * - Activity history
 * - Multi-tenant support
 */

// ============================================================================
// CRUD OPERATIONS
// ============================================================================

/**
 * Get all interactions with filtering
 */
export const getInteractions = async (req, res) => {
  try {
    const websiteId = req.websiteId || req.tenant?._id
    
    if (!websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }
    
    const {
      client,
      type,
      status,
      priority,
      createdBy,
      startDate,
      endDate,
      includeDeleted = "false",
      sortBy = "createdAt",
      sortOrder = "desc",
      page = 1,
      limit = 20,
    } = req.query
    
    // Build query
    const query = { website: websiteId }
    
    if (client) {
      query.client = client
    }
    
    if (type && type !== "all") {
      query.type = type
    }
    
    if (status && status !== "all") {
      query.status = status
    }
    
    if (priority && priority !== "all") {
      query.priority = priority
    }
    
    if (createdBy) {
      query.createdBy = createdBy
    }
    
    if (startDate || endDate) {
      query.createdAt = {}
      if (startDate) {
        query.createdAt.$gte = new Date(startDate)
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate)
      }
    }
    
    if (includeDeleted !== "true") {
      query.deleted = false
    }
    
    // Build sort
    const sort = {}
    sort[sortBy] = sortOrder === "desc" ? -1 : 1
    
    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit)
    
    const [interactions, total] = await Promise.all([
      Interaction.find(query)
        .populate("client", "firstName lastName company email phone clientId")
        .populate("createdBy", "name email")
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Interaction.countDocuments(query),
    ])
    
    res.json({
      interactions,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    })
  } catch (error) {
    console.error("Error fetching interactions:", error)
    res.status(500).json({ msg: "Server error", error: error.message })
  }
}

/**
 * Get interactions for a specific client
 */
export const getClientInteractions = async (req, res) => {
  try {
    const websiteId = req.websiteId || req.tenant?._id
    const { clientId } = req.params
    const { type, page = 1, limit = 20 } = req.query
    
    if (!websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }
    
    // Verify client exists and belongs to website
    const client = await Client.findOne({
      _id: clientId,
      website: websiteId,
    })
    
    if (!client) {
      return res.status(404).json({ msg: "Client not found" })
    }
    
    const result = await Interaction.getClientHistory(clientId, websiteId, {
      page: parseInt(page),
      limit: parseInt(limit),
      type,
    })
    
    res.json(result)
  } catch (error) {
    console.error("Error fetching client interactions:", error)
    res.status(500).json({ msg: "Server error", error: error.message })
  }
}

/**
 * Get a single interaction by ID
 */
export const getInteractionById = async (req, res) => {
  try {
    const websiteId = req.websiteId || req.tenant?._id
    const { id } = req.params
    
    if (!websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }
    
    const interaction = await Interaction.findOne({
      _id: id,
      website: websiteId,
    })
      .populate("client", "firstName lastName company email phone clientId status")
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email")
      .populate("participants.user", "name email")
    
    if (!interaction) {
      return res.status(404).json({ msg: "Interaction not found" })
    }
    
    res.json(interaction)
  } catch (error) {
    console.error("Error fetching interaction:", error)
    res.status(500).json({ msg: "Server error", error: error.message })
  }
}

/**
 * Create a new interaction
 */
export const createInteraction = async (req, res) => {
  try {
    const websiteId = req.websiteId || req.tenant?._id
    const userId = req.user?._id
    
    if (!websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }
    
    const {
      client,
      type,
      subject,
      description,
      outcome,
      duration,
      scheduledAt,
      dueDate,
      reminderAt,
      priority = "medium",
      status = "scheduled",
      isPrivate = false,
      tags,
      contactMethod,
      participants,
      followUpRequired = false,
      nextFollowUpDate,
      nextFollowUpNotes,
    } = req.body
    
    // Validate client exists
    const clientDoc = await Client.findOne({
      _id: client,
      website: websiteId,
      deleted: false,
    })
    
    if (!clientDoc) {
      return res.status(404).json({ msg: "Client not found" })
    }
    
    // Parse tags if string
    let parsedTags = tags
    if (typeof tags === "string") {
      parsedTags = tags.split(",").map(t => t.trim().toLowerCase()).filter(Boolean)
    }
    
    // Create interaction
    const interaction = new Interaction({
      client,
      type,
      subject: subject.trim(),
      description: description?.trim(),
      outcome,
      duration: parseInt(duration) || 0,
      scheduledAt: scheduledAt || null,
      dueDate: dueDate || null,
      reminderAt: reminderAt || null,
      priority,
      status: status === "completed" ? "completed" : (type === "note" ? "completed" : status),
      completedAt: status === "completed" || type === "note" ? new Date() : null,
      isPrivate,
      tags: parsedTags || [],
      contactMethod,
      participants,
      followUpRequired,
      nextFollowUpDate: nextFollowUpDate || null,
      nextFollowUpNotes: nextFollowUpNotes?.trim(),
      website: websiteId,
      createdBy: userId,
      updatedBy: userId,
    })
    
    await interaction.save()
    
    // Populate and return
    const populatedInteraction = await Interaction.findById(interaction._id)
      .populate("client", "firstName lastName company email phone clientId")
      .populate("createdBy", "name email")
    
    res.status(201).json({
      msg: "Interaction created successfully",
      interaction: populatedInteraction,
    })
  } catch (error) {
    console.error("Error creating interaction:", error)
    res.status(500).json({ msg: "Server error", error: error.message })
  }
}

/**
 * Update an existing interaction
 */
export const updateInteraction = async (req, res) => {
  try {
    const websiteId = req.websiteId || req.tenant?._id
    const userId = req.user?._id
    const { id } = req.params
    
    if (!websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }
    
    const interaction = await Interaction.findOne({
      _id: id,
      website: websiteId,
    })
    
    if (!interaction) {
      return res.status(404).json({ msg: "Interaction not found" })
    }
    
    const {
      type,
      subject,
      description,
      outcome,
      duration,
      scheduledAt,
      dueDate,
      reminderAt,
      priority,
      status,
      isPrivate,
      tags,
      contactMethod,
      participants,
      followUpRequired,
      nextFollowUpDate,
      nextFollowUpNotes,
      deleted,
    } = req.body
    
    // Update fields
    if (type !== undefined) interaction.type = type
    if (subject !== undefined) interaction.subject = subject.trim()
    if (description !== undefined) interaction.description = description?.trim()
    if (outcome !== undefined) interaction.outcome = outcome
    if (duration !== undefined) interaction.duration = parseInt(duration) || 0
    if (scheduledAt !== undefined) interaction.scheduledAt = scheduledAt || null
    if (dueDate !== undefined) interaction.dueDate = dueDate || null
    if (reminderAt !== undefined) interaction.reminderAt = reminderAt || null
    if (priority !== undefined) interaction.priority = priority
    if (isPrivate !== undefined) interaction.isPrivate = isPrivate
    if (contactMethod !== undefined) interaction.contactMethod = contactMethod
    if (participants !== undefined) interaction.participants = participants
    if (followUpRequired !== undefined) interaction.followUpRequired = followUpRequired
    if (nextFollowUpDate !== undefined) interaction.nextFollowUpDate = nextFollowUpDate || null
    if (nextFollowUpNotes !== undefined) interaction.nextFollowUpNotes = nextFollowUpNotes?.trim()
    if (deleted !== undefined) interaction.deleted = deleted
    
    // Handle status change
    if (status !== undefined) {
      interaction.status = status
      if (status === "completed" && !interaction.completedAt) {
        interaction.completedAt = new Date()
      }
    }
    
    // Handle tags
    if (tags !== undefined) {
      if (typeof tags === "string") {
        interaction.tags = tags.split(",").map(t => t.trim().toLowerCase()).filter(Boolean)
      } else {
        interaction.tags = tags || []
      }
    }
    
    interaction.updatedBy = userId
    
    await interaction.save()
    
    // Populate and return
    const populatedInteraction = await Interaction.findById(interaction._id)
      .populate("client", "firstName lastName company email phone clientId")
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email")
    
    res.json({
      msg: "Interaction updated successfully",
      interaction: populatedInteraction,
    })
  } catch (error) {
    console.error("Error updating interaction:", error)
    res.status(500).json({ msg: "Server error", error: error.message })
  }
}

/**
 * Delete an interaction (soft delete)
 */
export const deleteInteraction = async (req, res) => {
  try {
    const websiteId = req.websiteId || req.tenant?._id
    const userId = req.user?._id
    const { id } = req.params
    
    if (!websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }
    
    const interaction = await Interaction.findOne({
      _id: id,
      website: websiteId,
    })
    
    if (!interaction) {
      return res.status(404).json({ msg: "Interaction not found" })
    }
    
    interaction.deleted = true
    interaction.isActive = false
    interaction.updatedBy = userId
    
    await interaction.save()
    
    res.json({ msg: "Interaction deleted successfully" })
  } catch (error) {
    console.error("Error deleting interaction:", error)
    res.status(500).json({ msg: "Server error", error: error.message })
  }
}

/**
 * Permanently delete an interaction
 */
export const hardDeleteInteraction = async (req, res) => {
  try {
    const websiteId = req.websiteId || req.tenant?._id
    const { id } = req.params
    
    if (!websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }
    
    const result = await Interaction.deleteOne({
      _id: id,
      website: websiteId,
    })
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ msg: "Interaction not found" })
    }
    
    res.json({ msg: "Interaction permanently deleted" })
  } catch (error) {
    console.error("Error hard deleting interaction:", error)
    res.status(500).json({ msg: "Server error", error: error.message })
  }
}

// ============================================================================
// STATUS AND TASKS
// ============================================================================

/**
 * Mark interaction as completed
 */
export const completeInteraction = async (req, res) => {
  try {
    const websiteId = req.websiteId || req.tenant?._id
    const userId = req.user?._id
    const { id } = req.params
    const { outcome, notes } = req.body
    
    if (!websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }
    
    const interaction = await Interaction.findOne({
      _id: id,
      website: websiteId,
      deleted: false,
    })
    
    if (!interaction) {
      return res.status(404).json({ msg: "Interaction not found" })
    }
    
    interaction.status = "completed"
    interaction.completedAt = new Date()
    if (outcome) interaction.outcome = outcome
    if (notes) interaction.description = `${interaction.description}\n\n[Completion Notes]: ${notes}`
    interaction.updatedBy = userId
    
    await interaction.save()
    
    res.json({
      msg: "Interaction marked as completed",
      interaction,
    })
  } catch (error) {
    console.error("Error completing interaction:", error)
    res.status(500).json({ msg: "Server error", error: error.message })
  }
}

/**
 * Get upcoming tasks and follow-ups
 */
export const getUpcomingTasks = async (req, res) => {
  try {
    const websiteId = req.websiteId || req.tenant?._id
    const userId = req.user?._id
    const { days = 7, assignedTo } = req.query
    
    if (!websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }
    
    const tasks = await Interaction.getUpcomingTasks(
      websiteId,
      assignedTo || null,
      parseInt(days)
    )
    
    res.json(tasks)
  } catch (error) {
    console.error("Error fetching upcoming tasks:", error)
    res.status(500).json({ msg: "Server error", error: error.message })
  }
}

/**
 * Get overdue tasks
 */
export const getOverdueTasks = async (req, res) => {
  try {
    const websiteId = req.websiteId || req.tenant?._id
    const { assignedTo } = req.query
    
    if (!websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }
    
    const now = new Date()
    
    const query = {
      website: websiteId,
      deleted: false,
      status: { $in: ["scheduled", "in_progress", "overdue"] },
      $or: [
        { dueDate: { $lt: now } },
        { scheduledAt: { $lt: now } },
      ],
    }
    
    if (assignedTo) {
      query.createdBy = assignedTo
    }
    
    const tasks = await Interaction.find(query)
      .populate("client", "firstName lastName company email phone clientId")
      .populate("createdBy", "name email")
      .sort({ dueDate: 1, scheduledAt: 1 })
      .lean()
    
    res.json(tasks)
  } catch (error) {
    console.error("Error fetching overdue tasks:", error)
    res.status(500).json({ msg: "Server error", error: error.message })
  }
}

// ============================================================================
// QUICK ACTIONS
// ============================================================================

/**
 * Log a quick call
 */
export const logCall = async (req, res) => {
  try {
    const websiteId = req.websiteId || req.tenant?._id
    const userId = req.user?._id
    
    if (!websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }
    
    const {
      client,
      direction = "outbound",
      duration,
      outcome,
      notes,
      followUpRequired = false,
      nextFollowUpDate,
    } = req.body
    
    // Validate client
    const clientDoc = await Client.findOne({
      _id: client,
      website: websiteId,
      deleted: false,
    })
    
    if (!clientDoc) {
      return res.status(404).json({ msg: "Client not found" })
    }
    
    const interaction = new Interaction({
      client,
      type: direction === "inbound" ? "call_inbound" : "call_outbound",
      subject: `${direction === "inbound" ? "Incoming" : "Outgoing"} Call`,
      description: notes?.trim(),
      outcome: outcome || "successful",
      duration: parseInt(duration) || 0,
      status: "completed",
      completedAt: new Date(),
      contactMethod: {
        channel: "phone",
        direction,
        phoneNumber: clientDoc.phone,
      },
      followUpRequired,
      nextFollowUpDate: nextFollowUpDate || null,
      website: websiteId,
      createdBy: userId,
    })
    
    await interaction.save()
    
    const populatedInteraction = await Interaction.findById(interaction._id)
      .populate("client", "firstName lastName company email phone")
      .populate("createdBy", "name email")
    
    res.status(201).json({
      msg: "Call logged successfully",
      interaction: populatedInteraction,
    })
  } catch (error) {
    console.error("Error logging call:", error)
    res.status(500).json({ msg: "Server error", error: error.message })
  }
}

/**
 * Log a quick email
 */
export const logEmail = async (req, res) => {
  try {
    const websiteId = req.websiteId || req.tenant?._id
    const userId = req.user?._id
    
    if (!websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }
    
    const {
      client,
      direction = "sent",
      subject,
      content,
      followUpRequired = false,
      nextFollowUpDate,
    } = req.body
    
    // Validate client
    const clientDoc = await Client.findOne({
      _id: client,
      website: websiteId,
      deleted: false,
    })
    
    if (!clientDoc) {
      return res.status(404).json({ msg: "Client not found" })
    }
    
    const interaction = new Interaction({
      client,
      type: direction === "received" ? "email_received" : "email_sent",
      subject: subject?.trim() || `Email ${direction === "received" ? "Received" : "Sent"}`,
      description: content?.trim(),
      status: "completed",
      completedAt: new Date(),
      contactMethod: {
        channel: "email",
        direction: direction === "received" ? "inbound" : "outbound",
        emailAddress: clientDoc.email,
      },
      followUpRequired,
      nextFollowUpDate: nextFollowUpDate || null,
      website: websiteId,
      createdBy: userId,
    })
    
    await interaction.save()
    
    const populatedInteraction = await Interaction.findById(interaction._id)
      .populate("client", "firstName lastName company email phone")
      .populate("createdBy", "name email")
    
    res.status(201).json({
      msg: "Email logged successfully",
      interaction: populatedInteraction,
    })
  } catch (error) {
    console.error("Error logging email:", error)
    res.status(500).json({ msg: "Server error", error: error.message })
  }
}

/**
 * Add a quick note
 */
export const addNote = async (req, res) => {
  try {
    const websiteId = req.websiteId || req.tenant?._id
    const userId = req.user?._id
    
    if (!websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }
    
    const { client, content, isPrivate = false } = req.body
    
    // Validate client
    const clientDoc = await Client.findOne({
      _id: client,
      website: websiteId,
      deleted: false,
    })
    
    if (!clientDoc) {
      return res.status(404).json({ msg: "Client not found" })
    }
    
    const interaction = new Interaction({
      client,
      type: "note",
      subject: "Note",
      description: content?.trim(),
      status: "completed",
      completedAt: new Date(),
      isPrivate,
      website: websiteId,
      createdBy: userId,
    })
    
    await interaction.save()
    
    const populatedInteraction = await Interaction.findById(interaction._id)
      .populate("client", "firstName lastName company email phone")
      .populate("createdBy", "name email")
    
    res.status(201).json({
      msg: "Note added successfully",
      interaction: populatedInteraction,
    })
  } catch (error) {
    console.error("Error adding note:", error)
    res.status(500).json({ msg: "Server error", error: error.message })
  }
}

/**
 * Schedule a follow-up
 */
export const scheduleFollowUp = async (req, res) => {
  try {
    const websiteId = req.websiteId || req.tenant?._id
    const userId = req.user?._id
    
    if (!websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }
    
    const {
      client,
      scheduledAt,
      subject,
      description,
      priority = "medium",
      reminderAt,
    } = req.body
    
    // Validate client
    const clientDoc = await Client.findOne({
      _id: client,
      website: websiteId,
      deleted: false,
    })
    
    if (!clientDoc) {
      return res.status(404).json({ msg: "Client not found" })
    }
    
    const interaction = new Interaction({
      client,
      type: "follow_up",
      subject: subject?.trim() || "Follow-up",
      description: description?.trim(),
      scheduledAt: scheduledAt || null,
      dueDate: scheduledAt || null,
      reminderAt: reminderAt || null,
      priority,
      status: "scheduled",
      website: websiteId,
      createdBy: userId,
    })
    
    await interaction.save()
    
    // Update client's next follow-up
    if (scheduledAt) {
      clientDoc.nextFollowUp = scheduledAt
      await clientDoc.save()
    }
    
    const populatedInteraction = await Interaction.findById(interaction._id)
      .populate("client", "firstName lastName company email phone")
      .populate("createdBy", "name email")
    
    res.status(201).json({
      msg: "Follow-up scheduled successfully",
      interaction: populatedInteraction,
    })
  } catch (error) {
    console.error("Error scheduling follow-up:", error)
    res.status(500).json({ msg: "Server error", error: error.message })
  }
}

// ============================================================================
// STATISTICS
// ============================================================================

/**
 * Get interaction statistics
 */
export const getInteractionStats = async (req, res) => {
  try {
    const websiteId = req.websiteId || req.tenant?._id
    
    if (!websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }
    
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - 7)
    const monthStart = new Date(now)
    monthStart.setMonth(now.getMonth() - 1)
    
    const baseQuery = { website: websiteId, deleted: false }
    
    const [
      total,
      byType,
      byStatus,
      today,
      thisWeek,
      thisMonth,
      upcoming,
      overdue,
    ] = await Promise.all([
      Interaction.countDocuments(baseQuery),
      Interaction.aggregate([
        { $match: baseQuery },
        { $group: { _id: "$type", count: { $sum: 1 } } },
      ]),
      Interaction.aggregate([
        { $match: baseQuery },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      Interaction.countDocuments({ ...baseQuery, createdAt: { $gte: todayStart } }),
      Interaction.countDocuments({ ...baseQuery, createdAt: { $gte: weekStart } }),
      Interaction.countDocuments({ ...baseQuery, createdAt: { $gte: monthStart } }),
      Interaction.countDocuments({
        ...baseQuery,
        status: "scheduled",
        $or: [
          { dueDate: { $gte: now } },
          { scheduledAt: { $gte: now } },
        ],
      }),
      Interaction.countDocuments({
        ...baseQuery,
        status: { $in: ["scheduled", "in_progress"] },
        $or: [
          { dueDate: { $lt: now } },
          { scheduledAt: { $lt: now } },
        ],
      }),
    ])
    
    res.json({
      total,
      byType: byType.reduce((acc, item) => {
        acc[item._id || "unknown"] = item.count
        return acc
      }, {}),
      byStatus: byStatus.reduce((acc, item) => {
        acc[item._id || "unknown"] = item.count
        return acc
      }, {}),
      today,
      thisWeek,
      thisMonth,
      upcoming,
      overdue,
    })
  } catch (error) {
    console.error("Error fetching interaction stats:", error)
    res.status(500).json({ msg: "Server error", error: error.message })
  }
}
