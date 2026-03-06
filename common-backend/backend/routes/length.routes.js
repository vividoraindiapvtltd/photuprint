import express from "express";
import {
  getLengths,
  createLength,
  updateLength,
  deleteLength,
  hardDeleteLength,
  restoreLength
} from "../controllers/length.controller.js";
import { protect, adminOnly } from "../middlewares/auth.middleware.js";
import { resolveTenantFromHeader, requireTenant } from "../middlewares/tenant.middleware.js";

const router = express.Router();

// Apply tenant resolution middleware to all routes
router.use(resolveTenantFromHeader);
router.use(requireTenant);

// Public routes
router.get("/", getLengths);

// Protected routes (require authentication)
router.post("/", protect, adminOnly, createLength);
router.put("/:id", protect, adminOnly, updateLength);
router.delete("/:id", protect, adminOnly, deleteLength);
router.delete("/:id/hard", protect, adminOnly, hardDeleteLength);
router.put("/:id/restore", protect, adminOnly, restoreLength);

export default router;
