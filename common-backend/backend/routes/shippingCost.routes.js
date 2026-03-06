import express from 'express'
import {
  calculateCost,
  getZone
} from '../controllers/shippingCost.controller.js'
import { resolveTenant, requireTenant } from '../middlewares/tenant.middleware.js'

const router = express.Router()

router.use(resolveTenant)
router.use(requireTenant)

router.post('/calculate', calculateCost)
router.get('/zone/:pincode', getZone)

export default router
