import { calculateShippingCost, getZoneForPincode } from '../utils/shippingCalculator.js'
import ShippingZone from '../models/shippingZone.model.js'
import ShippingRate from '../models/shippingRate.model.js'
import ShippingConfig from '../models/shippingConfig.model.js'
import PincodeZoneMapping from '../models/pincodeZoneMapping.model.js'

const models = {
  ShippingZone,
  ShippingRate,
  ShippingConfig,
  PincodeZoneMapping
}

export const calculateCost = async (req, res) => {
  try {
    if (!req.websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }

    const { pincode, weight, paymentMode, orderValue } = req.body

    if (!pincode || !weight) {
      return res.status(400).json({ msg: 'Pincode and weight are required' })
    }

    const result = await calculateShippingCost({
      pincode: pincode.toString().trim(),
      weight: parseFloat(weight),
      paymentMode: paymentMode || 'prepaid',
      orderValue: parseFloat(orderValue || 0),
      websiteId: req.websiteId,
      models
    })

    if (!result.success) {
      return res.status(400).json(result)
    }

    res.json(result)
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message || 'Failed to calculate shipping cost',
      shippingCost: 0
    })
  }
}

export const getZone = async (req, res) => {
  try {
    if (!req.websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }

    const { pincode } = req.params

    if (!pincode || !/^[0-9]{6}$/.test(pincode)) {
      return res.status(400).json({ success: false, error: 'Invalid pincode format. Must be 6 digits.' })
    }

    const result = await getZoneForPincode({
      pincode: pincode.trim(),
      websiteId: req.websiteId,
      models
    })

    if (!result.success) {
      return res.status(404).json(result)
    }

    res.json(result)
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message || 'Failed to get zone for pincode',
      zone: null
    })
  }
}
