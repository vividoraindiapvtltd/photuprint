import express from "express"
import {
  listCashbackRules,
  getCashbackRule,
  createCashbackRule,
  updateCashbackRule,
  deleteCashbackRule,
} from "../controllers/cashbackRule.controller.js"
import { protect, adminOnly } from "../middlewares/auth.middleware.js"
import { resolveTenantFromHeader, requireTenant } from "../middlewares/tenant.middleware.js"

const router = express.Router()
router.use(resolveTenantFromHeader)
router.use(requireTenant)
router.use(protect)
router.use(adminOnly)

router.get("/", listCashbackRules)
router.get("/:id", getCashbackRule)
router.post("/", createCashbackRule)
router.put("/:id", updateCashbackRule)
router.delete("/:id", deleteCashbackRule)

export default router
