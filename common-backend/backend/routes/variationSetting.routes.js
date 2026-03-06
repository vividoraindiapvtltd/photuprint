import express from "express"
import {
  getVariationSettings,
  getVariationSettingById,
  checkVariationSupport,
  createVariationSetting,
  updateVariationSetting,
  deleteVariationSetting,
  bulkUpdateVariationSettings
} from "../controllers/variationSetting.controller.js"
import { resolveTenantFromHeader, requireTenant } from "../middlewares/tenant.middleware.js"

const router = express.Router()

// Resolve tenant for all routes (extracts X-Website-Id header)
router.use(resolveTenantFromHeader)

// All routes require tenant context
router.get("/variation-settings", requireTenant, getVariationSettings)
router.get("/variation-settings/check", requireTenant, checkVariationSupport)
router.get("/variation-settings/:id", requireTenant, getVariationSettingById)
router.post("/variation-settings", requireTenant, createVariationSetting)
router.post("/variation-settings/bulk", requireTenant, bulkUpdateVariationSettings)
router.put("/variation-settings/:id", requireTenant, updateVariationSetting)
router.delete("/variation-settings/:id", requireTenant, deleteVariationSetting)

export default router
