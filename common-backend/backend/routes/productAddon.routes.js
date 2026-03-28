import express from "express"
import {
  createProductAddon,
  getProductAddons,
  getProductAddonById,
  updateProductAddon,
  deleteProductAddon,
  hardDeleteProductAddon,
} from "../controllers/productAddon.controller.js"
import { protect, adminOnly } from "../middlewares/auth.middleware.js"
import { resolveTenantFromHeader, requireTenant } from "../middlewares/tenant.middleware.js"
import upload from "../middlewares/upload.middleware.js"

const router = express.Router()

router.use(resolveTenantFromHeader)
router.use(requireTenant)

router.get("/", getProductAddons)
router.get("/:id", getProductAddonById)
router.post("/", protect, adminOnly, upload.single("image"), createProductAddon)
router.put("/:id", protect, adminOnly, upload.single("image"), updateProductAddon)
router.delete("/:id", protect, adminOnly, deleteProductAddon)
router.delete("/:id/hard", protect, adminOnly, hardDeleteProductAddon)

export default router
