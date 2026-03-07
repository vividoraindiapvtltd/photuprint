import express from "express"
import { subscribe } from "../controllers/newsletter.controller.js"
import { resolveTenant } from "../middlewares/tenant.middleware.js"

const router = express.Router()
router.use(resolveTenant)

// Public: subscribe email to newsletter (storefront footer form)
router.post("/subscribe", subscribe)

export default router
