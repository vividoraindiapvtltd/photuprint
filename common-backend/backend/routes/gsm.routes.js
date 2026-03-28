import express from "express"
import {
  createGsm,
  getGsms,
  getGsmById,
  updateGsm,
  deleteGsm,
  hardDeleteGsm,
} from "../controllers/gsm.controller.js"
import { protect, adminOnly } from "../middlewares/auth.middleware.js"
import { resolveTenantFromHeader, requireTenant } from "../middlewares/tenant.middleware.js"

const router = express.Router()

router.use(resolveTenantFromHeader)
router.use(requireTenant)

router.get("/", getGsms)
router.get("/:id", getGsmById)

router.post("/", protect, adminOnly, createGsm)
router.put("/:id", protect, adminOnly, updateGsm)
router.delete("/:id", protect, adminOnly, deleteGsm)
router.delete("/:id/hard", protect, adminOnly, hardDeleteGsm)

export default router
