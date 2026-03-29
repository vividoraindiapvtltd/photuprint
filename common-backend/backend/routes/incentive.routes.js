import express from "express"
import { protect, adminOnly } from "../middlewares/auth.middleware.js"
import { resolveTenantFromHeader } from "../middlewares/tenant.middleware.js"
import {
  getIncentives,
  createIncentive,
  updateIncentive,
  deleteIncentive,
  getIncentivePayout,
} from "../controllers/incentive.controller.js"

const router = express.Router()

// All incentive routes require auth and tenant context
router.use(protect, adminOnly, resolveTenantFromHeader)

router.get("/", getIncentives)
router.get("/payout", getIncentivePayout)
router.post("/", createIncentive)
router.put("/:id", updateIncentive)
router.delete("/:id", deleteIncentive)

export default router

