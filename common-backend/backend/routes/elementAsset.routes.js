import express from "express"
import {
  getElementAssets,
  getElementAssetById,
  createElementAsset,
  updateElementAsset,
  deleteElementAsset,
} from "../controllers/elementAsset.controller.js"
import { protect, adminOnly } from "../middlewares/auth.middleware.js"
import upload from "../middlewares/upload.middleware.js"
import { resolveTenantFromHeader, requireTenant } from "../middlewares/tenant.middleware.js"

const router = express.Router()

router.use(resolveTenantFromHeader)
router.use(requireTenant)

router.get("/", getElementAssets)
router.get("/:id", getElementAssetById)
router.post("/", protect, adminOnly, upload.single("image"), createElementAsset)
router.put("/:id", protect, adminOnly, upload.single("image"), updateElementAsset)
router.delete("/:id", protect, adminOnly, deleteElementAsset)

export default router
