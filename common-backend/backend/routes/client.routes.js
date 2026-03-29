import express from "express"
import {
  // CRUD
  getClients,
  getClientById,
  createClient,
  createLead,
  updateClient,
  deleteClient,
  restoreClient,
  hardDeleteClient,
  // Status and Assignment
  updateClientStatus,
  assignClient,
  bulkAssignClients,
  bulkUpdateStatus,
  // Statistics
  getClientStats,
  getUpcomingFollowUps,
  getRecentClients,
  searchClients,
  getTags,
  exportLeads,
} from "../controllers/client.controller.js"
import { protect, adminOnly, optionalAuth } from "../middlewares/auth.middleware.js"
import { resolveTenantIfPresent } from "../middlewares/tenant.middleware.js"
import upload from "../middlewares/upload.middleware.js"

const router = express.Router()

// Resolve tenant when X-Website-Id is sent; when omitted, super_admin can see all leads
router.use(resolveTenantIfPresent)

// ============================================================================
// STATISTICS AND DASHBOARD
// ============================================================================

/**
 * GET /api/clients/stats
 * Get client statistics
 */
router.get("/stats", protect, getClientStats)

/**
 * GET /api/clients/upcoming-followups
 * Get clients with upcoming follow-ups
 */
router.get("/upcoming-followups", protect, getUpcomingFollowUps)

/**
 * GET /api/clients/recent
 * Get recently added clients
 */
router.get("/recent", protect, getRecentClients)

/**
 * GET /api/clients/search
 * Search clients (autocomplete)
 */
router.get("/search", protect, searchClients)

/**
 * GET /api/clients/tags
 * Get all unique tags
 */
router.get("/tags", protect, getTags)

// ============================================================================
// BULK OPERATIONS
// ============================================================================

/**
 * POST /api/clients/bulk-assign
 * Bulk assign clients to a user
 */
router.post("/bulk-assign", protect, adminOnly, bulkAssignClients)

/**
 * POST /api/clients/bulk-status
 * Bulk update client status
 */
router.post("/bulk-status", protect, adminOnly, bulkUpdateStatus)

// ============================================================================
// CRUD OPERATIONS
// ============================================================================

/**
 * GET /api/clients
 * Get all clients with filters and pagination
 */
router.get("/", protect, getClients)

/**
 * GET /api/clients/export
 * Export leads as CSV (query: period=day|week|month|year, assignedTo=userId|all)
 */
router.get("/export", protect, exportLeads)

/**
 * POST /api/clients/lead
 * Create a lead from public website (bulk product enquiry) – no auth required.
 * optionalAuth ensures no 401 if a token is sent (e.g. expired) or missing.
 */
router.post("/lead", optionalAuth, createLead)

/**
 * POST /api/clients
 * Create a new client
 */
router.post("/", protect, upload.single("avatar"), createClient)

/**
 * GET /api/clients/:id
 * Get a single client by ID
 */
router.get("/:id", protect, getClientById)

/**
 * PUT /api/clients/:id
 * Update a client
 */
router.put("/:id", protect, upload.single("avatar"), updateClient)

/**
 * DELETE /api/clients/:id
 * Soft delete a client
 */
router.delete("/:id", protect, deleteClient)

/**
 * POST /api/clients/:id/restore
 * Restore a soft-deleted client
 */
router.post("/:id/restore", protect, adminOnly, restoreClient)

/**
 * DELETE /api/clients/:id/hard
 * Permanently delete a client
 */
router.delete("/:id/hard", protect, adminOnly, hardDeleteClient)

// ============================================================================
// STATUS AND ASSIGNMENT
// ============================================================================

/**
 * PUT /api/clients/:id/status
 * Update client status
 */
router.put("/:id/status", protect, updateClientStatus)

/**
 * PUT /api/clients/:id/assign
 * Assign client to a user
 */
router.put("/:id/assign", protect, assignClient)

export default router
