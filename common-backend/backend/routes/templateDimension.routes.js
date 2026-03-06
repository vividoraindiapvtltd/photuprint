import express from "express"
import {
  getTemplateDimensions,
  getTemplateDimensionById,
  createTemplateDimension,
  updateTemplateDimension,
  deleteTemplateDimension,
} from "../controllers/templateDimension.controller.js"
import { protect, adminOnly } from "../middlewares/auth.middleware.js"
import { resolveTenantFromHeader, requireTenant } from "../middlewares/tenant.middleware.js"

const router = express.Router()

router.use(resolveTenantFromHeader)
router.use(requireTenant)

router.get("/", getTemplateDimensions)
router.get("/:id", getTemplateDimensionById)
router.post("/", protect, adminOnly, createTemplateDimension)
router.put("/:id", protect, adminOnly, updateTemplateDimension)
router.delete("/:id", protect, adminOnly, deleteTemplateDimension)

export default router
