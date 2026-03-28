import express from "express"
import { getWalletBalance, getWalletLedger } from "../controllers/wallet.controller.js"
import { protect, adminOnly } from "../middlewares/auth.middleware.js"
import { resolveTenantFromHeader, requireTenant } from "../middlewares/tenant.middleware.js"

const router = express.Router()
router.use(resolveTenantFromHeader)
router.use(requireTenant)
router.use(protect)

router.get("/balance", getWalletBalance)
router.get("/ledger", getWalletLedger)

export default router
