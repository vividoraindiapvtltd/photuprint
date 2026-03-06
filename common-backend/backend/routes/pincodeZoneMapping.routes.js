import express from 'express'
import {
  getPincodeMappings,
  getPincodeMappingById,
  getZoneByPincode,
  createPincodeMapping,
  bulkCreatePincodeMappings,
  updatePincodeMapping,
  deletePincodeMapping
} from '../controllers/pincodeZoneMapping.controller.js'
import { resolveTenant, requireTenant } from '../middlewares/tenant.middleware.js'
import { protect, adminOnly } from '../middlewares/auth.middleware.js'

const router = express.Router()

router.use(resolveTenant)
router.use(requireTenant)

router.get('/', getPincodeMappings)
router.get('/pincode/:pincode', getZoneByPincode)
router.get('/:id', getPincodeMappingById)

router.post('/', protect, adminOnly, createPincodeMapping)
router.post('/bulk', protect, adminOnly, bulkCreatePincodeMappings)
router.put('/:id', protect, adminOnly, updatePincodeMapping)
router.delete('/:id', protect, adminOnly, deletePincodeMapping)

router.get('/', getPincodeMappings)
router.get('/pincode/:pincode', getZoneByPincode)
router.get('/:id', getPincodeMappingById)
router.post('/', createPincodeMapping)
router.post('/bulk', bulkCreatePincodeMappings)
router.put('/:id', updatePincodeMapping)
router.delete('/:id', deletePincodeMapping)

export default router
