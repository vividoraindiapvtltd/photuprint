import Incentive from "../models/incentive.model.js"
import Client from "../models/client.model.js"
import Order from "../models/order.model.js"
import User from "../models/user.model.js"
import Website from "../models/website.model.js"

// Helper to build base query by role
function buildIncentiveBaseQuery(req) {
  const websiteId = req.websiteId || req.tenant?._id
  const userId = req.user?._id
  const role = req.user?.role

  let query = { deleted: false }

  if (websiteId) {
    query.website = websiteId
  }

  // Editors (sales agents) should only see their own incentives
  if (role === "editor" && userId) {
    query.agent = userId
  }

  return query
}

export const getIncentives = async (req, res) => {
  try {
    const baseQuery = buildIncentiveBaseQuery(req)
    const { agent, period, isActive } = req.query

    const query = { ...baseQuery }
    if (agent) query.agent = agent
    if (period) query.period = period
    if (isActive === "true") query.isActive = true
    if (isActive === "false") query.isActive = false

    const incentives = await Incentive.find(query)
      .populate("agent", "name email")
      .sort({ createdAt: -1 })
      .lean()

    res.json(incentives)
  } catch (error) {
    console.error("Error fetching incentives:", error)
    res.status(500).json({ msg: "Server error", error: error.message })
  }
}

export const createIncentive = async (req, res) => {
  try {
    const websiteId = req.websiteId || req.tenant?._id
    const userId = req.user?._id

    if (!websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }

    const {
      agent,
      name,
      description,
      type,
      amount,
      currency,
      period,
      month,
      year,
      targetLeads,
      targetRevenue,
      isActive,
    } = req.body

    if (!agent) {
      return res.status(400).json({ msg: "Agent is required" })
    }

    const incentive = await Incentive.create({
      website: websiteId,
      agent,
      name,
      description,
      type,
      amount,
      currency,
      period,
      month: month || null,
      year: year || null,
      targetLeads,
      targetRevenue,
      isActive,
      createdBy: userId,
      updatedBy: userId,
    })

    const populated = await Incentive.findById(incentive._id)
      .populate("agent", "name email")
      .lean()

    res.status(201).json({ msg: "Incentive created successfully", incentive: populated })
  } catch (error) {
    console.error("Error creating incentive:", error)
    res.status(500).json({ msg: "Server error", error: error.message })
  }
}

export const updateIncentive = async (req, res) => {
  try {
    const { id } = req.params
    const userId = req.user?._id

    const baseQuery = buildIncentiveBaseQuery(req)
    const incentive = await Incentive.findOne({ _id: id, ...baseQuery })

    if (!incentive) {
      return res.status(404).json({ msg: "Incentive not found" })
    }

    const {
      agent,
      name,
      description,
      type,
      amount,
      currency,
      period,
      month,
      year,
      targetLeads,
      targetRevenue,
      isActive,
      deleted,
    } = req.body

    if (agent !== undefined) incentive.agent = agent
    if (name !== undefined) incentive.name = name
    if (description !== undefined) incentive.description = description
    if (type !== undefined) incentive.type = type
    if (amount !== undefined) incentive.amount = amount
    if (currency !== undefined) incentive.currency = currency
    if (period !== undefined) incentive.period = period
    if (month !== undefined) incentive.month = month || null
    if (year !== undefined) incentive.year = year || null
    if (targetLeads !== undefined) incentive.targetLeads = targetLeads
    if (targetRevenue !== undefined) incentive.targetRevenue = targetRevenue
    if (isActive !== undefined) incentive.isActive = isActive
    if (deleted !== undefined) incentive.deleted = deleted

    incentive.updatedBy = userId
    await incentive.save()

    const populated = await Incentive.findById(incentive._id)
      .populate("agent", "name email")
      .lean()

    res.json({ msg: "Incentive updated successfully", incentive: populated })
  } catch (error) {
    console.error("Error updating incentive:", error)
    res.status(500).json({ msg: "Server error", error: error.message })
  }
}

export const deleteIncentive = async (req, res) => {
  try {
    const { id } = req.params
    const baseQuery = buildIncentiveBaseQuery(req)

    const incentive = await Incentive.findOneAndUpdate(
      { _id: id, ...baseQuery },
      { deleted: true, isActive: false },
      { new: true }
    )

    if (!incentive) {
      return res.status(404).json({ msg: "Incentive not found" })
    }

    res.json({ msg: "Incentive deleted successfully" })
  } catch (error) {
    console.error("Error deleting incentive:", error)
    res.status(500).json({ msg: "Server error", error: error.message })
  }
}

// Calculate incentive payout for a sales agent based on orders (product value only)
export const getIncentivePayout = async (req, res) => {
  try {
    const websiteId = req.websiteId || req.tenant?._id
    const { period = "monthly", month, year } = req.query
    let { agentId } = req.query

    // Editors (agents) can only view their own report
    if (req.user?.role === "editor") {
      agentId = req.user._id.toString()
    }

    if (!websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }
    if (!agentId) {
      return res.status(400).json({ msg: "agentId is required" })
    }

    const now = new Date()
    const resolvedYear = year ? Number(year) : now.getFullYear()

    let startDate
    let endDate

    if (period === "monthly") {
      const resolvedMonth = month ? Number(month) - 1 : now.getMonth()
      startDate = new Date(resolvedYear, resolvedMonth, 1, 0, 0, 0, 0)
      endDate = new Date(resolvedYear, resolvedMonth + 1, 0, 23, 59, 59, 999)
    } else if (period === "quarterly") {
      const quarter = month ? Math.floor((Number(month) - 1) / 3) : Math.floor(now.getMonth() / 3)
      const startMonth = quarter * 3
      const endMonth = startMonth + 2
      startDate = new Date(resolvedYear, startMonth, 1, 0, 0, 0, 0)
      endDate = new Date(resolvedYear, endMonth + 1, 0, 23, 59, 59, 999)
    } else if (period === "yearly") {
      startDate = new Date(resolvedYear, 0, 1, 0, 0, 0, 0)
      endDate = new Date(resolvedYear, 11, 31, 23, 59, 59, 999)
    } else {
      // one_time or unknown: use full year or provided month
      if (month) {
        const resolvedMonth = Number(month) - 1
        startDate = new Date(resolvedYear, resolvedMonth, 1, 0, 0, 0, 0)
        endDate = new Date(resolvedYear, resolvedMonth + 1, 0, 23, 59, 59, 999)
      } else {
        startDate = new Date(resolvedYear, 0, 1, 0, 0, 0, 0)
        endDate = new Date(resolvedYear, 11, 31, 23, 59, 59, 999)
      }
    }

    // Find active incentives for this agent and website matching the period.
    // Match incentives that either have the specific year/month OR have no year/month set (applies to all).
    const incentiveQuery = {
      website: websiteId,
      agent: agentId,
      deleted: false,
      isActive: true,
      period,
    }

    const andConditions = []
    if (month) {
      andConditions.push({
        $or: [{ month: Number(month) }, { month: null }, { month: { $exists: false } }],
      })
    }
    if (year) {
      andConditions.push({
        $or: [{ year: resolvedYear }, { year: null }, { year: { $exists: false } }],
      })
    }

    if (andConditions.length > 0) {
      incentiveQuery.$and = andConditions
    }

    const incentives = await Incentive.find(incentiveQuery).lean()

    // Always compute orders — even if no incentive rules exist, show the stats
    const orderQuery = {
      website: websiteId,
      deleted: false,
      paymentStatus: { $in: ["paid", "advance_paid"] },
      salesAgent: agentId,
      createdAt: { $gte: startDate, $lte: endDate },
    }

    const orders = await Order.find(orderQuery)
      .select("subtotal discount orderNumber createdAt")
      .lean()

    const orderCount = orders.length
    const ordersWithNet = orders.map((order) => {
      const subtotal = order.subtotal || 0
      const discount = order.discount || 0
      const net = Math.max(0, subtotal - discount)
      return {
        orderId: order._id,
        orderNumber: order.orderNumber || "",
        createdAt: order.createdAt,
        subtotal,
        discount,
        netSubtotal: net,
      }
    })

    const baseRevenue = ordersWithNet.reduce((sum, order) => sum + order.netSubtotal, 0)

    // Always query closed/converted leads assigned to this agent in the date range.
    // Leads are NOT filtered by website — an agent's performance counts across all sites.
    // Check closedAt, convertedAt, or updatedAt as fallback (for older records
    // where closedAt wasn't set because bulkUpdateStatus skipped the pre-save hook).
    const leadQuery = {
      deleted: { $ne: true },
      assignedTo: agentId,
      status: { $in: ["closed", "active"] },
      $or: [
        { closedAt: { $gte: startDate, $lte: endDate } },
        { convertedAt: { $gte: startDate, $lte: endDate } },
        { closedAt: { $exists: false }, convertedAt: { $exists: false }, updatedAt: { $gte: startDate, $lte: endDate } },
        { closedAt: null, convertedAt: null, updatedAt: { $gte: startDate, $lte: endDate } },
      ],
    }

    const leads = await Client.find(leadQuery)
      .select("firstName lastName email phone company status estimatedValue actualValue closedAt convertedAt createdAt updatedAt website assignedTo")
      .populate("website", "name domain")
      .populate("assignedTo", "name email")
      .lean()

    const leadCount = leads.length
    const leadsWithValue = leads.map((lead) => ({
      leadId: lead._id,
      name: [lead.firstName, lead.lastName].filter(Boolean).join(" ") || lead.email || lead.phone || "-",
      company: lead.company || "",
      status: lead.status,
      estimatedValue: lead.estimatedValue || 0,
      actualValue: lead.actualValue || 0,
      closedAt: lead.closedAt || lead.convertedAt || lead.updatedAt || lead.createdAt,
      agentName: lead.assignedTo?.name || lead.assignedTo?.email || "-",
      websiteName: lead.website?.name || lead.website?.domain || "-",
    }))

    const leadRevenue = leadsWithValue.reduce((sum, l) => sum + (l.actualValue || l.estimatedValue), 0)

    // Combined count: orders + closed leads (for targetLeads evaluation)
    const combinedLeadCount = orderCount + leadCount
    // Combined revenue: order revenue + lead actual/estimated value
    const combinedRevenue = baseRevenue + leadRevenue

    // Calculate payout per incentive
    let totalPayout = 0
    const incentiveResults = incentives.map((inc) => {
      const requiredLeads = inc.targetLeads || 0
      const requiredRevenue = inc.targetRevenue || 0

      const meetsLeadTarget = requiredLeads === 0 || combinedLeadCount >= requiredLeads
      const meetsRevenueTarget = requiredRevenue === 0 || combinedRevenue >= requiredRevenue
      const meetsTargets = meetsLeadTarget && meetsRevenueTarget

      let payout = 0
      if (meetsTargets) {
        if (inc.type === "percentage") {
          payout = (combinedRevenue * (inc.amount || 0)) / 100
        } else {
          payout = inc.amount || 0
        }
      }

      totalPayout += payout

      return {
        incentiveId: inc._id,
        name: inc.name,
        type: inc.type,
        amount: inc.amount,
        currency: inc.currency,
        targetLeads: inc.targetLeads,
        targetRevenue: inc.targetRevenue,
        meetsTargets,
        meetsLeadTarget,
        meetsRevenueTarget,
        payout,
      }
    })

    const agent = await User.findById(agentId).select("name email").lean()

    res.json({
      agentId,
      agentName: agent?.name || agent?.email || agentId,
      period,
      month: month ? Number(month) : null,
      year: resolvedYear,
      startDate,
      endDate,
      baseRevenue: combinedRevenue,
      orderCount,
      leadCount,
      orders: ordersWithNet,
      leads: leadsWithValue,
      incentives: incentiveResults,
      totalPayout,
    })
  } catch (error) {
    console.error("Error calculating incentive payout:", error)
    res.status(500).json({ msg: "Server error", error: error.message })
  }
}

