import express from "express"
import {
  createPrintingType,
  getPrintingTypes,
  getPrintingTypeById,
  updatePrintingType,
  deletePrintingType,
  hardDeletePrintingType,
} from "../controllers/printingType.controller.js"
import { protect, adminOnly } from "../middlewares/auth.middleware.js"
import { resolveTenantFromHeader, requireTenant } from "../middlewares/tenant.middleware.js"

const router = express.Router()

router.use(resolveTenantFromHeader)
router.use(requireTenant)

router.get("/", getPrintingTypes)
router.get("/:id", getPrintingTypeById)
router.post("/", protect, adminOnly, createPrintingType)
router.put("/:id", protect, adminOnly, updatePrintingType)
router.delete("/:id", protect, adminOnly, deletePrintingType)
router.delete("/:id/hard", protect, adminOnly, hardDeletePrintingType)

export default router
