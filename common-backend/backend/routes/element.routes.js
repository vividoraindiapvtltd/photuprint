import express from "express"
import {
  getElements,
  getElementById,
  createElement,
  updateElement,
  deleteElement,
} from "../controllers/element.controller.js"
import { protect, adminOnly } from "../middlewares/auth.middleware.js"
import upload from "../middlewares/upload.middleware.js"
import { resolveTenantFromHeader, requireTenant } from "../middlewares/tenant.middleware.js"

const router = express.Router()

router.use(resolveTenantFromHeader)
router.use(requireTenant)

router.get("/", getElements)
router.get("/:id", getElementById)
router.post("/", protect, adminOnly, upload.single("image"), createElement)
router.put("/:id", protect, adminOnly, upload.single("image"), updateElement)
router.delete("/:id", protect, adminOnly, deleteElement)

export default router
