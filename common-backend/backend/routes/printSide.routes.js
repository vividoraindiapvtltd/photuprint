import express from "express"
import {
  createPrintSide,
  getPrintSides,
  getPrintSideById,
  updatePrintSide,
  deletePrintSide,
  hardDeletePrintSide,
} from "../controllers/printSide.controller.js"
import { protect, adminOnly } from "../middlewares/auth.middleware.js"
import { resolveTenantFromHeader, requireTenant } from "../middlewares/tenant.middleware.js"
import upload from "../middlewares/upload.middleware.js"

const router = express.Router()

router.use(resolveTenantFromHeader)
router.use(requireTenant)

router.get("/", getPrintSides)
router.get("/:id", getPrintSideById)
router.post("/", protect, adminOnly, upload.single("image"), createPrintSide)
router.put("/:id", protect, adminOnly, upload.single("image"), updatePrintSide)
router.delete("/:id", protect, adminOnly, deletePrintSide)
router.delete("/:id/hard", protect, adminOnly, hardDeletePrintSide)

export default router
