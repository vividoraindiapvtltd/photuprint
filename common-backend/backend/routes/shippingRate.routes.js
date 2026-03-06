import express from 'express'
import {
  getShippingRates,
  getShippingRateById,
  createShippingRate,
  updateShippingRate,
  deleteShippingRate
} from '../controllers/shippingRate.controller.js'
import { resolveTenant, requireTenant } from '../middlewares/tenant.middleware.js'
import { protect, adminOnly } from '../middlewares/auth.middleware.js'

const router = express.Router()

router.use(resolveTenant)
router.use(requireTenant)

router.get('/', getShippingRates)
router.get('/:id', getShippingRateById)

router.post('/', protect, adminOnly, createShippingRate)
router.put('/:id', protect, adminOnly, updateShippingRate)
router.delete('/:id', protect, adminOnly, deleteShippingRate)

router.get('/', getShippingRates)
router.get('/:id', getShippingRateById)
router.post('/', createShippingRate)
router.put('/:id', updateShippingRate)
router.delete('/:id', deleteShippingRate)

export default router
