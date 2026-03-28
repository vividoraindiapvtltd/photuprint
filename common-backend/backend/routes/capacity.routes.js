import express from "express"
import {
  createCapacity,
  getCapacities,
  getCapacityById,
  updateCapacity,
  deleteCapacity,
  hardDeleteCapacity,
} from "../controllers/capacity.controller.js"
import { protect, adminOnly } from "../middlewares/auth.middleware.js"
import { resolveTenantFromHeader, requireTenant } from "../middlewares/tenant.middleware.js"

const router = express.Router()

router.use(resolveTenantFromHeader)
router.use(requireTenant)

router.get("/", getCapacities)
router.get("/:id", getCapacityById)

router.post("/", protect, adminOnly, createCapacity)
router.put("/:id", protect, adminOnly, updateCapacity)
router.delete("/:id", protect, adminOnly, deleteCapacity)
router.delete("/:id/hard", protect, adminOnly, hardDeleteCapacity)

export default router
