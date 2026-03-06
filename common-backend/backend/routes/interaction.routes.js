import express from "express"
import {
  // CRUD
  getInteractions,
  getClientInteractions,
  getInteractionById,
  createInteraction,
  updateInteraction,
  deleteInteraction,
  hardDeleteInteraction,
  // Status and Tasks
  completeInteraction,
  getUpcomingTasks,
  getOverdueTasks,
  // Quick Actions
  logCall,
  logEmail,
  addNote,
  scheduleFollowUp,
  // Statistics
  getInteractionStats,
} from "../controllers/interaction.controller.js"
import { protect, adminOnly } from "../middlewares/auth.middleware.js"
import { resolveTenant } from "../middlewares/tenant.middleware.js"

const router = express.Router()

// Apply tenant resolution middleware to all routes
router.use(resolveTenant)

// ============================================================================
// STATISTICS AND DASHBOARD
// ============================================================================

/**
 * GET /api/interactions/stats
 * Get interaction statistics
 */
router.get("/stats", protect, getInteractionStats)

/**
 * GET /api/interactions/upcoming-tasks
 * Get upcoming tasks and follow-ups
 */
router.get("/upcoming-tasks", protect, getUpcomingTasks)

/**
 * GET /api/interactions/overdue-tasks
 * Get overdue tasks
 */
router.get("/overdue-tasks", protect, getOverdueTasks)

// ============================================================================
// QUICK ACTIONS
// ============================================================================

/**
 * POST /api/interactions/log-call
 * Log a quick call
 */
router.post("/log-call", protect, logCall)

/**
 * POST /api/interactions/log-email
 * Log a quick email
 */
router.post("/log-email", protect, logEmail)

/**
 * POST /api/interactions/add-note
 * Add a quick note
 */
router.post("/add-note", protect, addNote)

/**
 * POST /api/interactions/schedule-followup
 * Schedule a follow-up
 */
router.post("/schedule-followup", protect, scheduleFollowUp)

// ============================================================================
// CLIENT INTERACTIONS
// ============================================================================

/**
 * GET /api/interactions/client/:clientId
 * Get interactions for a specific client
 */
router.get("/client/:clientId", protect, getClientInteractions)

// ============================================================================
// CRUD OPERATIONS
// ============================================================================

/**
 * GET /api/interactions
 * Get all interactions with filters
 */
router.get("/", protect, getInteractions)

/**
 * POST /api/interactions
 * Create a new interaction
 */
router.post("/", protect, createInteraction)

/**
 * GET /api/interactions/:id
 * Get a single interaction
 */
router.get("/:id", protect, getInteractionById)

/**
 * PUT /api/interactions/:id
 * Update an interaction
 */
router.put("/:id", protect, updateInteraction)

/**
 * DELETE /api/interactions/:id
 * Soft delete an interaction
 */
router.delete("/:id", protect, deleteInteraction)

/**
 * DELETE /api/interactions/:id/hard
 * Permanently delete an interaction
 */
router.delete("/:id/hard", protect, adminOnly, hardDeleteInteraction)

// ============================================================================
// STATUS UPDATES
// ============================================================================

/**
 * POST /api/interactions/:id/complete
 * Mark interaction as completed
 */
router.post("/:id/complete", protect, completeInteraction)

export default router
