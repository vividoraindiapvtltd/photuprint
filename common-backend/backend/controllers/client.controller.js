import Client from "../models/client.model.js"
import Interaction from "../models/interaction.model.js"
import User from "../models/user.model.js"
import { removeLocalFile } from "../utils/fileCleanup.js"
import { uploadLocalFileToCloudinary } from "../utils/cloudinaryUpload.js"

/**
 * Client Controller
 * 
 * Provides CRUD operations for client management including:
 * - Client creation, reading, updating, deletion
 * - Search and filtering
 * - Status pipeline management
 * - Assignment tracking
 * - Statistics and analytics
 * - Multi-tenant support
 */

const isSuperAdminViewAll = (req) => req.user?.role === "super_admin" && !req.websiteId && !req.tenant?._id

/** Fields from Website manager (Website model) when populating client.website */
const CLIENT_WEBSITE_SELECT = "name domain description"

/**
 * Pick a sales agent (editor) for the given website with the fewest assigned leads (least-loaded).
 * Returns agent _id or null if no editors exist for the website.
 */
async function getNextAgentForWebsite(websiteId) {
  const editors = await User.find({
    role: "editor",
    isActive: true,
    deleted: false,
    $or: [
      { website: websiteId },
      { accessibleWebsites: websiteId },
    ],
  })
    .select("_id")
    .lean()
  if (!editors?.length) return null
  const agentIds = editors.map((e) => e._id)
  const counts = await Promise.all(
    agentIds.map((agentId) =>
      Client.countDocuments({
        website: websiteId,
        assignedTo: agentId,
        deleted: false,
      })
    )
  )
  let minIdx = 0
  for (let i = 1; i < counts.length; i++) {
    if (counts[i] < counts[minIdx]) minIdx = i
  }
  return agentIds[minIdx]
}

// ============================================================================
// CRUD OPERATIONS
// ============================================================================

/**
 * Get all clients with filtering, search, and pagination
 */
export const getClients = async (req, res) => {
  try {
    const websiteId = req.websiteId || req.tenant?._id

    if (!websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }

    const {
      status,
      priority,
      assignedTo,
      tags,
      search,
      company,
      source,
      showInactive = "false",
      includeDeleted = "false",
      sortBy = "createdAt",
      sortOrder = "desc",
      page = 1,
      limit = 20,
    } = req.query

    // Build query
    const query = { website: websiteId }

    // Status filter
    if (status && status !== "all") {
      query.status = status
    }

    // Priority filter
    if (priority && priority !== "all") {
      query.priority = priority
    }

    // Assigned user filter
    if (assignedTo) {
      query.assignedTo = assignedTo
    }

    // Tags filter
    if (tags) {
      const tagArray = tags.split(",").map(t => t.trim().toLowerCase())
      query.tags = { $in: tagArray }
    }

    // Company filter
    if (company) {
      query.company = { $regex: company, $options: "i" }
    }

    // Source filter
    if (source && source !== "all") {
      query.source = source
    }

    // Include inactive filter
    if (showInactive !== "true") {
      query.isActive = true
    }

    // Include deleted filter
    if (includeDeleted !== "true") {
      query.deleted = false
    }

    // Search filter
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
        { company: { $regex: search, $options: "i" } },
        { clientId: { $regex: search, $options: "i" } },
      ]
    }

    // Build sort
    const sort = {}
    sort[sortBy] = sortOrder === "desc" ? -1 : 1

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit)

    // Execute query
    const [clients, total] = await Promise.all([
      Client.find(query)
        .populate("assignedTo", "name email")
        .populate("createdBy", "name email")
        .populate("website", CLIENT_WEBSITE_SELECT)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Client.countDocuments(query),
    ])

    res.json({
      clients,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    })
  } catch (error) {
    console.error("Error fetching clients:", error)
    res.status(500).json({ msg: "Server error", error: error.message })
  }
}

/**
 * Get a single client by ID with interaction history
 */
export const getClientById = async (req, res) => {
  try {
    const websiteId = req.websiteId || req.tenant?._id
    const { id } = req.params

    if (!websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }
    
    const clientQuery = websiteId ? { _id: id, website: websiteId } : { _id: id }
    const client = await Client.findOne(clientQuery)
      .populate("website", CLIENT_WEBSITE_SELECT)
      .populate("assignedTo", "name email phone")
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email")

    if (!client) {
      return res.status(404).json({ msg: "Client not found" })
    }

    // Get recent interactions
    const recentInteractions = await Interaction.find({
      client: id,
      website: websiteId,
      deleted: false,
    })
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 })
      .limit(10)
      .lean()

    res.json({
      client,
      recentInteractions,
    })
  } catch (error) {
    console.error("Error fetching client:", error)
    res.status(500).json({ msg: "Server error", error: error.message })
  }
}

/**

 * Create a lead from public website form (bulk product enquiry, contact, etc.)
 * No auth required. Uses tenant from X-Website-Id or domain.
 * Duplicate email allowed (multiple enquiries from same contact).
 */
export const createLead = async (req, res) => {
  try {
    const websiteId = req.websiteId || req.tenant?._id

    if (!websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }

    const {
      firstName,
      lastName,
      email,
      phone,
      company,
      productName,
      quantity,
      location,
      notes,
      leadKind,
    } = req.body

    const first = (firstName || "").toString().trim()
    if (!first) {
      return res.status(400).json({ msg: "First name is required" })
    }
    const contact = (email || phone || "").toString().trim()
    if (!contact) {
      return res.status(400).json({ msg: "Email or phone is required" })
    }

    const kind = (leadKind || "bulk").toString().trim().toLowerCase().replace(/-/g, "_")
    let sourceDetails = "Bulk product enquiry"
    let leadTags = ["bulk-enquiry", "website"]
    if (kind === "contact") {
      sourceDetails = "Contact form"
      leadTags = ["contact", "website"]
    } else if (kind === "connect_wizard") {
      sourceDetails = "Connect now wizard"
      leadTags = ["connect-wizard", "website"]
    }

    const assignedTo = await getNextAgentForWebsite(websiteId)

    const client = new Client({
      firstName: first,
      lastName: (lastName || "").toString().trim(),
      email: email ? String(email).trim().toLowerCase() : undefined,
      phone: phone ? String(phone).trim() : undefined,
      company: company ? String(company).trim() : "",
      productName: productName ? String(productName).trim() : "",
      quantity: quantity != null && quantity !== "" ? Number(quantity) : null,
      location: location ? String(location).trim() : "",
      notes: notes ? String(notes).trim() : "",
      status: "lead",
      source: "website",
      sourceDetails,
      tags: leadTags,
      priority: "medium",
      estimatedValue: 0,
      currency: "INR",
      isActive: true,
      website: websiteId,
      ...(assignedTo && { assignedTo }),
    })

    await client.save()

    res.status(201).json({
      msg: "Thank you! We have received your enquiry and will get back to you soon.",
      clientId: client._id,
    })
  } catch (error) {
    console.error("Error creating lead:", error)
    res.status(500).json({ msg: "Server error", error: error.message })
  }
}

/**
 * Create a new client
 */
export const createClient = async (req, res) => {
  try {
    const websiteId = req.websiteId || req.tenant?._id
    const userId = req.user?._id

    if (!websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }

    const {
      firstName,
      lastName,
      email,
      phone,
      alternatePhone,
      company,
      designation,
      industry,
      address,
      status = "lead",
      source = "other",
      sourceDetails,
      tags,
      priority = "medium",
      estimatedValue,
      currency,
      assignedTo,
      nextFollowUp,
      notes,
      internalNotes,
      customFields,
      socialProfiles,
      isActive = true,
    } = req.body

    // Check for duplicate email if provided
    if (email) {
      const existingClient = await Client.findOne({
        website: websiteId,
        email: email.toLowerCase().trim(),
        deleted: false,
      })

      if (existingClient) {
        return res.status(400).json({ msg: "A client with this email already exists" })
      }
    }
    
    let avatarUrl = null
    if (req.file) {
      try {
        avatarUrl = await uploadLocalFileToCloudinary(req.file.path, {
          folder: "clients",
          transformation: [
            { width: 200, height: 200, crop: "fill" },
            { quality: "auto" },
          ],
        })
      } catch (uploadError) {
        console.error("Error uploading avatar:", uploadError)
        removeLocalFile(req.file.path)
        return res.status(503).json({ msg: uploadError.message || "Avatar upload failed. Configure Cloudinary." })
      }
    }

    // Parse tags if string
    let parsedTags = tags
    if (typeof tags === "string") {
      parsedTags = tags.split(",").map(t => t.trim().toLowerCase()).filter(Boolean)
    }

    // Create client
    const client = new Client({
      firstName: firstName.trim(),
      lastName: lastName?.trim() || "",
      email: email?.trim().toLowerCase(),
      phone: phone?.trim(),
      alternatePhone: alternatePhone?.trim(),
      company: company?.trim(),
      designation: designation?.trim(),
      industry: industry?.trim(),
      address,
      status,
      source,
      sourceDetails: sourceDetails?.trim(),
      tags: parsedTags || [],
      priority,
      estimatedValue: parseFloat(estimatedValue) || 0,
      currency: currency || "INR",
      assignedTo: assignedTo || userId,
      nextFollowUp: nextFollowUp || null,
      notes: notes?.trim(),
      internalNotes: internalNotes?.trim(),
      customFields,
      socialProfiles,
      avatar: avatarUrl,
      isActive,
      website: websiteId,
      createdBy: userId,
      updatedBy: userId,
    })

    await client.save()

    // Create initial interaction for client creation
    await Interaction.create({
      client: client._id,
      type: "note",
      subject: "Client Created",
      description: `New client "${client.name}" was added to the system.`,
      status: "completed",
      completedAt: new Date(),
      website: websiteId,
      createdBy: userId,
    })

    // Populate and return
    const populatedClient = await Client.findById(client._id)
      .populate("website", CLIENT_WEBSITE_SELECT)
      .populate("assignedTo", "name email")
      .populate("createdBy", "name email")

    res.status(201).json({
      msg: "Client created successfully",
      client: populatedClient,
    })
  } catch (error) {
    console.error("Error creating client:", error)
    res.status(500).json({ msg: "Server error", error: error.message })
  }
}

/**
 * Update an existing client
 */
export const updateClient = async (req, res) => {
  try {
    const websiteId = req.websiteId || req.tenant?._id
    const userId = req.user?._id
    const { id } = req.params

    if (!websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }

    const client = await Client.findOne({
      _id: id,
      website: websiteId,
    })

    if (!client) {
      return res.status(404).json({ msg: "Client not found" })
    }

    const {
      firstName,
      lastName,
      email,
      phone,
      alternatePhone,
      company,
      designation,
      industry,
      address,
      status,
      source,
      sourceDetails,
      tags,
      priority,
      estimatedValue,
      actualValue,
      currency,
      assignedTo,
      nextFollowUp,
      notes,
      internalNotes,
      customFields,
      socialProfiles,
      isActive,
      deleted,
    } = req.body

    // Check for duplicate email if changing
    if (email && email.toLowerCase().trim() !== client.email) {
      const existingClient = await Client.findOne({
        website: websiteId,
        email: email.toLowerCase().trim(),
        _id: { $ne: id },
        deleted: false,
      })

      if (existingClient) {
        return res.status(400).json({ msg: "A client with this email already exists" })
      }
    }

    // Track status change
    const oldStatus = client.status
    
    if (req.file) {
      try {
        client.avatar = await uploadLocalFileToCloudinary(req.file.path, {
          folder: "clients",
          transformation: [
            { width: 200, height: 200, crop: "fill" },
            { quality: "auto" },
          ],
        })
      } catch (uploadError) {
        console.error("Error uploading avatar:", uploadError)
        removeLocalFile(req.file.path)
        return res.status(503).json({ msg: uploadError.message || "Avatar upload failed. Configure Cloudinary." })
      }
    }

    // Update fields
    if (firstName !== undefined) client.firstName = firstName.trim()
    if (lastName !== undefined) client.lastName = lastName?.trim() || ""
    if (email !== undefined) client.email = email?.trim().toLowerCase()
    if (phone !== undefined) client.phone = phone?.trim()
    if (alternatePhone !== undefined) client.alternatePhone = alternatePhone?.trim()
    if (company !== undefined) client.company = company?.trim()
    if (designation !== undefined) client.designation = designation?.trim()
    if (industry !== undefined) client.industry = industry?.trim()
    if (address !== undefined) client.address = { ...client.address, ...address }
    if (status !== undefined) client.status = status
    if (source !== undefined) client.source = source
    if (sourceDetails !== undefined) client.sourceDetails = sourceDetails?.trim()
    if (priority !== undefined) client.priority = priority
    if (estimatedValue !== undefined) client.estimatedValue = parseFloat(estimatedValue) || 0
    if (actualValue !== undefined) client.actualValue = parseFloat(actualValue) || 0
    if (currency !== undefined) client.currency = currency
    if (assignedTo !== undefined) client.assignedTo = assignedTo
    if (nextFollowUp !== undefined) client.nextFollowUp = nextFollowUp || null
    if (notes !== undefined) client.notes = notes?.trim()
    if (internalNotes !== undefined) client.internalNotes = internalNotes?.trim()
    if (customFields !== undefined) client.customFields = customFields
    if (socialProfiles !== undefined) client.socialProfiles = { ...client.socialProfiles, ...socialProfiles }
    if (isActive !== undefined) client.isActive = isActive
    if (deleted !== undefined) client.deleted = deleted

    // Handle tags
    if (tags !== undefined) {
      if (typeof tags === "string") {
        client.tags = tags.split(",").map(t => t.trim().toLowerCase()).filter(Boolean)
      } else {
        client.tags = tags || []
      }
    }

    client.updatedBy = userId

    await client.save()

    // Log status change interaction
    if (status !== undefined && status !== oldStatus) {
      await Interaction.create({
        client: client._id,
        type: "status_change",
        subject: `Status changed from ${oldStatus} to ${status}`,
        description: `Client status was updated.`,
        statusChange: {
          from: oldStatus,
          to: status,
        },
        status: "completed",
        completedAt: new Date(),
        website: websiteId,
        createdBy: userId,
      })
    }

    // Populate and return
    const populatedClient = await Client.findById(client._id)
      .populate("website", CLIENT_WEBSITE_SELECT)
      .populate("assignedTo", "name email")
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email")

    res.json({
      msg: "Client updated successfully",
      client: populatedClient,
    })
  } catch (error) {
    console.error("Error updating client:", error)
    res.status(500).json({ msg: "Server error", error: error.message })
  }
}

/**
 * Soft delete a client
 */
export const deleteClient = async (req, res) => {
  try {
    const websiteId = req.websiteId || req.tenant?._id
    const userId = req.user?._id
    const { id } = req.params

    if (!websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }

    const client = await Client.findOne({
      _id: id,
      website: websiteId,
    })

    if (!client) {
      return res.status(404).json({ msg: "Client not found" })
    }

    client.deleted = true
    client.isActive = false
    client.updatedBy = userId

    await client.save()

    res.json({ msg: "Client deleted successfully" })
  } catch (error) {
    console.error("Error deleting client:", error)
    res.status(500).json({ msg: "Server error", error: error.message })
  }
}

/**
 * Restore a soft-deleted client
 */
export const restoreClient = async (req, res) => {
  try {
    const websiteId = req.websiteId || req.tenant?._id
    const userId = req.user?._id
    const { id } = req.params

    if (!websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }

    const client = await Client.findOne({
      _id: id,
      website: websiteId,
      deleted: true,
    })

    if (!client) {
      return res.status(404).json({ msg: "Deleted client not found" })
    }

    // Check for email conflict
    if (client.email) {
      const existingClient = await Client.findOne({
        website: websiteId,
        email: client.email,
        _id: { $ne: id },
        deleted: false,
      })

      if (existingClient) {
        return res.status(400).json({
          msg: "Cannot restore: A client with this email already exists",
        })
      }
    }

    client.deleted = false
    client.isActive = true
    client.updatedBy = userId

    await client.save()
    
    await client.populate({ path: "website", select: CLIENT_WEBSITE_SELECT })
    
    res.json({ msg: "Client restored successfully", client })
  } catch (error) {
    console.error("Error restoring client:", error)
    res.status(500).json({ msg: "Server error", error: error.message })
  }
}

/**
 * Permanently delete a client
 */
export const hardDeleteClient = async (req, res) => {
  try {
    const websiteId = req.websiteId || req.tenant?._id
    const { id } = req.params

    if (!websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }

    // Delete all interactions first
    await Interaction.deleteMany({
      client: id,
      website: websiteId,
    })

    // Delete client
    const result = await Client.deleteOne({
      _id: id,
      website: websiteId,
    })

    if (result.deletedCount === 0) {
      return res.status(404).json({ msg: "Client not found" })
    }

    res.json({ msg: "Client permanently deleted" })
  } catch (error) {
    console.error("Error hard deleting client:", error)
    res.status(500).json({ msg: "Server error", error: error.message })
  }
}

// ============================================================================
// STATUS AND ASSIGNMENT
// ============================================================================

/**
 * Update client status
 */
export const updateClientStatus = async (req, res) => {
  try {
    const websiteId = req.websiteId || req.tenant?._id
    const userId = req.user?._id
    const { id } = req.params
    const { status, reason } = req.body

    if (!websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }

    const validStatuses = ["lead", "prospect", "active", "inactive", "closed", "lost"]
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ msg: "Invalid status" })
    }

    const client = await Client.findOne({
      _id: id,
      website: websiteId,
      deleted: false,
    })

    if (!client) {
      return res.status(404).json({ msg: "Client not found" })
    }

    const oldStatus = client.status
    client.status = status
    client.updatedBy = userId

    await client.save()

    // Log status change
    await Interaction.create({
      client: id,
      type: "status_change",
      subject: `Status: ${oldStatus} → ${status}`,
      description: reason || `Status changed from ${oldStatus} to ${status}`,
      statusChange: { from: oldStatus, to: status, reason },
      status: "completed",
      completedAt: new Date(),
      website: websiteId,
      createdBy: userId,
    })
    
    await client.populate([
      { path: "website", select: CLIENT_WEBSITE_SELECT },
      { path: "assignedTo", select: "name email phone" },
    ])
    
    res.json({
      msg: `Client status updated to ${status}`,
      client,
    })
  } catch (error) {
    console.error("Error updating client status:", error)
    res.status(500).json({ msg: "Server error", error: error.message })
  }
}

/**
 * Assign client to a user
 */
export const assignClient = async (req, res) => {
  try {
    const websiteId = req.websiteId || req.tenant?._id
    const userId = req.user?._id
    const { id } = req.params
    const { assignedTo, notes } = req.body

    if (!websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }

    const client = await Client.findOne({
      _id: id,
      website: websiteId,
      deleted: false,
    })

    if (!client) {
      return res.status(404).json({ msg: "Client not found" })
    }

    const oldAssignee = client.assignedTo
    client.assignedTo = assignedTo
    client.updatedBy = userId

    await client.save()

    // Log assignment change
    await Interaction.create({
      client: id,
      type: "note",
      subject: "Client Reassigned",
      description: notes || "Client was assigned to a new user",
      status: "completed",
      completedAt: new Date(),
      website: websiteId,
      createdBy: userId,
    })

    const populatedClient = await Client.findById(id)
      .populate("website", CLIENT_WEBSITE_SELECT)
      .populate("assignedTo", "name email")

    res.json({
      msg: "Client assigned successfully",
      client: populatedClient,
    })
  } catch (error) {
    console.error("Error assigning client:", error)
    res.status(500).json({ msg: "Server error", error: error.message })
  }
}

/**
 * Bulk assign clients
 */
export const bulkAssignClients = async (req, res) => {
  try {
    const websiteId = req.websiteId || req.tenant?._id
    const userId = req.user?._id
    const { clientIds, assignedTo } = req.body

    if (!websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }

    if (!clientIds || !Array.isArray(clientIds) || clientIds.length === 0) {
      return res.status(400).json({ msg: "Client IDs array is required" })
    }

    const result = await Client.updateMany(
      {
        _id: { $in: clientIds },
        website: websiteId,
        deleted: false,
      },
      {
        assignedTo,
        updatedBy: userId,
      }
    )

    res.json({
      msg: `${result.modifiedCount} clients assigned`,
      modifiedCount: result.modifiedCount,
    })
  } catch (error) {
    console.error("Error bulk assigning clients:", error)
    res.status(500).json({ msg: "Server error", error: error.message })
  }
}

/**
 * Bulk update client status
 */
export const bulkUpdateStatus = async (req, res) => {
  try {
    const websiteId = req.websiteId || req.tenant?._id
    const userId = req.user?._id
    const { clientIds, status } = req.body

    if (!websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }

    if (!clientIds || !Array.isArray(clientIds) || clientIds.length === 0) {
      return res.status(400).json({ msg: "Client IDs array is required" })
    }

    const validStatuses = ["lead", "prospect", "active", "inactive", "closed", "lost"]
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ msg: "Invalid status" })
    }

    const result = await Client.updateMany(
      {
        _id: { $in: clientIds },
        website: websiteId,
        deleted: false,
      },
      {
        status,
        updatedBy: userId,
      }
    )

    res.json({
      msg: `${result.modifiedCount} clients updated`,
      modifiedCount: result.modifiedCount,
    })
  } catch (error) {
    console.error("Error bulk updating status:", error)
    res.status(500).json({ msg: "Server error", error: error.message })
  }
}

// ============================================================================
// STATISTICS AND ANALYTICS
// ============================================================================

/**
 * Get client statistics
 */
export const getClientStats = async (req, res) => {
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
      active,
      byStatus,
      byPriority,
      bySource,
      today,
      thisWeek,
      thisMonth,
      upcomingFollowUps,
      recentlyContacted,
      totalValue,
    ] = await Promise.all([
      Client.countDocuments(baseQuery),
      Client.countDocuments({ ...baseQuery, isActive: true }),
      Client.aggregate([
        { $match: baseQuery },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      Client.aggregate([
        { $match: baseQuery },
        { $group: { _id: "$priority", count: { $sum: 1 } } },
      ]),
      Client.aggregate([
        { $match: baseQuery },
        { $group: { _id: "$source", count: { $sum: 1 } } },
      ]),
      Client.countDocuments({ ...baseQuery, createdAt: { $gte: todayStart } }),
      Client.countDocuments({ ...baseQuery, createdAt: { $gte: weekStart } }),
      Client.countDocuments({ ...baseQuery, createdAt: { $gte: monthStart } }),
      Client.countDocuments({
        ...baseQuery,
        nextFollowUp: { $gte: now, $lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) },
      }),
      Client.countDocuments({
        ...baseQuery,
        lastContactedAt: { $gte: weekStart },
      }),
      Client.aggregate([
        { $match: { ...baseQuery, status: { $in: ["active", "prospect"] } } },
        { $group: { _id: null, total: { $sum: "$estimatedValue" } } },
      ]),
    ])

    res.json({
      total,
      active,
      byStatus: byStatus.reduce((acc, item) => {
        acc[item._id || "unknown"] = item.count
        return acc
      }, {}),
      byPriority: byPriority.reduce((acc, item) => {
        acc[item._id || "unknown"] = item.count
        return acc
      }, {}),
      bySource: bySource.reduce((acc, item) => {
        acc[item._id || "unknown"] = item.count
        return acc
      }, {}),
      today,
      thisWeek,
      thisMonth,
      upcomingFollowUps,
      recentlyContacted,
      totalEstimatedValue: totalValue[0]?.total || 0,
    })
  } catch (error) {
    console.error("Error fetching client stats:", error)
    res.status(500).json({ msg: "Server error", error: error.message })
  }
}

/**
 * Get upcoming follow-ups
 */
export const getUpcomingFollowUps = async (req, res) => {
  try {
    const websiteId = req.websiteId || req.tenant?._id
    const { days = 7, assignedTo } = req.query

    if (!websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }

    const now = new Date()
    const future = new Date()
    future.setDate(future.getDate() + parseInt(days))

    const query = {
      website: websiteId,
      isActive: true,
      deleted: false,
      nextFollowUp: { $gte: now, $lte: future },
    }

    if (assignedTo) {
      query.assignedTo = assignedTo
    }

    const clients = await Client.find(query)
      .populate("website", CLIENT_WEBSITE_SELECT)
      .populate("assignedTo", "name email")
      .sort({ nextFollowUp: 1 })
      .lean()

    res.json(clients)
  } catch (error) {
    console.error("Error fetching upcoming follow-ups:", error)
    res.status(500).json({ msg: "Server error", error: error.message })
  }
}

/**
 * Get recently added clients
 */
export const getRecentClients = async (req, res) => {
  try {
    const websiteId = req.websiteId || req.tenant?._id
    const { limit = 10 } = req.query

    if (!websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }
    
    const findQuery = websiteId ? { website: websiteId, deleted: false } : { deleted: false }
    const clients = await Client.find(findQuery)
      .populate("website", CLIENT_WEBSITE_SELECT)
      .populate("assignedTo", "name email")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .lean()

    res.json(clients)
  } catch (error) {
    console.error("Error fetching recent clients:", error)
    res.status(500).json({ msg: "Server error", error: error.message })
  }
}

/**
 * Search clients with autocomplete
 */
export const searchClients = async (req, res) => {
  try {
    const websiteId = req.websiteId || req.tenant?._id
    const { q, limit = 10 } = req.query

    if (!websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }

    if (!q || q.length < 2) {
      return res.json([])
    }

    const clients = await Client.find({
      website: websiteId,
      deleted: false,
      $or: [
        { firstName: { $regex: q, $options: "i" } },
        { lastName: { $regex: q, $options: "i" } },
        { email: { $regex: q, $options: "i" } },
        { company: { $regex: q, $options: "i" } },
        { phone: { $regex: q, $options: "i" } },
        { clientId: { $regex: q, $options: "i" } },
      ],
    })
      .select("firstName lastName email company phone clientId status")
      .limit(parseInt(limit))
      .lean()

    res.json(clients)
  } catch (error) {
    console.error("Error searching clients:", error)
    res.status(500).json({ msg: "Server error", error: error.message })
  }
}

/**
 * Get all unique tags
 */
export const getTags = async (req, res) => {
  try {
    const websiteId = req.websiteId || req.tenant?._id

    if (!websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }

    const tags = await Client.distinct("tags", {
      website: websiteId,
      deleted: false,
    })

    res.json(tags.filter(Boolean).sort())
  } catch (error) {
    console.error("Error fetching tags:", error)
    res.status(500).json({ msg: "Server error", error: error.message })
  }
}

const LEAD_EXPORT_HEADERS = [
  "Client ID",
  "First Name",
  "Last Name",
  "Email",
  "Phone",
  "Company",
  "Website",
  "Product",
  "Quantity",
  "Location",
  "Status",
  "Source",
  "Priority",
  "Assigned To",
  "Created At",
]

function buildLeadRows(clients) {
  return clients.map((c) => [
    c.clientId || "",
    c.firstName || "",
    c.lastName || "",
    c.email || "",
    c.phone || "",
    c.company || "",
    c.website
      ? c.website.name || c.website.domain || String(c.website._id || "")
      : "",
    c.productName || "",
    c.quantity != null ? c.quantity : "",
    c.location || "",
    c.status || "",
    c.source || "",
    c.priority || "",
    c.assignedTo ? (c.assignedTo.name || c.assignedTo.email || "") : "",
    c.createdAt ? new Date(c.createdAt).toISOString() : "",
  ])
}

/**
 * Export leads (by period and optional agent) as CSV, Excel, or PDF
 * Query: period=day|week|month|year, assignedTo=userId|all, format=csv|xlsx|pdf
 */
export const exportLeads = async (req, res) => {
  try {
    const websiteId = req.websiteId || req.tenant?._id
    if (!websiteId && !isSuperAdminViewAll(req)) {
      return res.status(400).json({ msg: "Website context is required" })
    }

    const { period = "month", assignedTo, format = "csv" } = req.query
    const fmt = String(format).toLowerCase()
    if (!["csv", "xlsx", "pdf"].includes(fmt)) {
      return res.status(400).json({ msg: "Invalid format. Use csv, xlsx, or pdf." })
    }

    const now = new Date()
    let startDate
    switch (String(period).toLowerCase()) {
      case "day":
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        break
      case "week":
        startDate = new Date(now)
        startDate.setDate(now.getDate() - 7)
        break
      case "month":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
        break
      case "year":
        startDate = new Date(now.getFullYear(), 0, 1)
        break
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
    }

    let query = { deleted: false, createdAt: { $gte: startDate, $lte: now } }
    if (websiteId) query.website = websiteId
    if (assignedTo && assignedTo !== "all") query.assignedTo = assignedTo

    if (req.user?.role === "editor" && !isSuperAdminViewAll(req)) {
      const userId = req.user._id
      delete query.assignedTo
      query = {
        $and: [
          query,
          { $or: [{ assignedTo: userId }, { createdBy: userId }] },
        ],
      }
    }

    const clients = await Client.find(query)
      .populate("website", CLIENT_WEBSITE_SELECT)
      .populate("assignedTo", "name email")
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 })
      .lean()

    const rows = buildLeadRows(clients)
    const dateStr = new Date().toISOString().slice(0, 10)

    if (fmt === "csv") {
      const escapeCsv = (v) => {
        if (v == null) return ""
        const s = String(v).replace(/"/g, '""')
        return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s}"` : s
      }
      const csv = [LEAD_EXPORT_HEADERS.join(","), ...rows.map((r) => r.map(escapeCsv).join(","))].join("\n")
      const filename = `leads-${period}-${dateStr}.csv`
      res.setHeader("Content-Type", "text/csv; charset=utf-8")
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`)
      return res.send("\uFEFF" + csv)
    }

    if (fmt === "xlsx") {
      const XLSX = await import("xlsx")
      const wb = XLSX.utils.book_new()
      const sheetData = [LEAD_EXPORT_HEADERS, ...rows]
      const ws = XLSX.utils.aoa_to_sheet(sheetData)
      XLSX.utils.book_append_sheet(wb, ws, "Leads")
      const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" })
      const filename = `leads-${period}-${dateStr}.xlsx`
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`)
      return res.send(buf)
    }

    if (fmt === "pdf") {
      const PDFDocument = (await import("pdfkit-table")).default
      const filename = `leads-${period}-${dateStr}.pdf`
      res.setHeader("Content-Type", "application/pdf")
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`)
      const doc = new PDFDocument({ margin: 30, size: "A4" })
      doc.pipe(res)
      const table = {
        title: `Leads export (${period})`,
        subtitle: `Generated ${new Date().toLocaleString()}`,
        headers: LEAD_EXPORT_HEADERS,
        rows,
      }
      await doc.table(table, {
        prepareHeader: () => doc.font("Helvetica-Bold").fontSize(8),
        prepareRow: () => doc.font("Helvetica").fontSize(7),
      })
      doc.end()
      return
    }
  } catch (error) {
    console.error("Error exporting leads:", error)
    res.status(500).json({ msg: "Server error", error: error.message })
  }
}
