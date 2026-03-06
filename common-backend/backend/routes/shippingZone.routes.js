import express from 'express'
import {
  getShippingZones,
  getShippingZoneById,
  createShippingZone,
  updateShippingZone,
  deleteShippingZone
} from '../controllers/shippingZone.controller.js'
import { resolveTenant, requireTenant } from '../middlewares/tenant.middleware.js'
import { protect, adminOnly } from '../middlewares/auth.middleware.js'

const router = express.Router()

router.use(resolveTenant)
router.use(requireTenant)

router.get('/', getShippingZones)
router.get('/:id', getShippingZoneById)

router.post('/', protect, adminOnly, createShippingZone)
router.put('/:id', protect, adminOnly, updateShippingZone)
router.delete('/:id', protect, adminOnly, deleteShippingZone)

router.get('/', getShippingZones)
router.get('/:id', getShippingZoneById)
router.post('/', createShippingZone)
router.put('/:id', updateShippingZone)
router.delete('/:id', deleteShippingZone)

export default router
