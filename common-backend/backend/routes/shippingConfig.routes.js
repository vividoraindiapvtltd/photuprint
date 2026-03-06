import express from 'express'
import {
  getShippingConfig,
  updateShippingConfig
} from '../controllers/shippingConfig.controller.js'
import { resolveTenant, requireTenant } from '../middlewares/tenant.middleware.js'
import { protect, adminOnly } from '../middlewares/auth.middleware.js'

const router = express.Router()

router.use(resolveTenant)
router.use(requireTenant)

router.get('/', getShippingConfig)

router.put('/', protect, adminOnly, updateShippingConfig)

router.get('/', getShippingConfig)
router.put('/', updateShippingConfig)

export default router
