/**
 * Example Usage of Shipping Cost Calculator
 * 
 * This file demonstrates how to use the shipping cost calculator
 * in your application code (e.g., checkout, order processing)
 */

import { calculateShippingCost, getZoneForPincode } from './shippingCalculator.js'
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

/**
 * Example 1: Calculate shipping cost for checkout
 */
export const calculateCheckoutShipping = async (websiteId, orderData) => {
  const { pincode, weight, paymentMode, orderValue } = orderData

  const result = await calculateShippingCost({
    pincode,
    weight,
    paymentMode: paymentMode || 'prepaid',
    orderValue: orderValue || 0,
    websiteId,
    models
  })

  if (!result.success) {
    throw new Error(result.error)
  }

  return {
    shippingCost: result.totalCost,
    baseCost: result.baseCost,
    codSurcharge: result.codSurcharge,
    zone: result.zone,
    isFreeShipping: result.isFreeShipping
  }
}

/**
 * Example 2: Calculate shipping for multiple items
 */
export const calculateMultiItemShipping = async (websiteId, items, pincode, paymentMode) => {
  // Calculate total weight
  const totalWeight = items.reduce((sum, item) => {
    return sum + (item.weight || 0) * (item.quantity || 1)
  }, 0)

  // Calculate total order value
  const totalOrderValue = items.reduce((sum, item) => {
    return sum + (item.price || 0) * (item.quantity || 1)
  }, 0)

  const result = await calculateShippingCost({
    pincode,
    weight: totalWeight,
    paymentMode: paymentMode || 'prepaid',
    orderValue: totalOrderValue,
    websiteId,
    models
  })

  return result
}

/**
 * Example 3: Validate pincode and get zone before checkout
 */
export const validatePincodeForShipping = async (websiteId, pincode) => {
  const result = await getZoneForPincode({
    pincode,
    websiteId,
    models
  })

  if (!result.success) {
    return {
      isValid: false,
      error: result.error,
      zone: null
    }
  }

  return {
    isValid: true,
    zone: result.zone.name,
    state: result.state,
    city: result.city
  }
}

/**
 * Example 4: Calculate shipping with weight breakdown
 */
export const calculateShippingWithBreakdown = async (websiteId, orderData) => {
  const result = await calculateShippingCost({
    pincode: orderData.pincode,
    weight: orderData.weight,
    paymentMode: orderData.paymentMode,
    orderValue: orderData.orderValue,
    websiteId,
    models
  })

  if (!result.success) {
    return result
  }

  // Add breakdown explanation
  const breakdown = []
  
  if (result.isFreeShipping) {
    breakdown.push(`Free shipping applied (Order value ₹${orderData.orderValue} >= ₹${result.freeShippingThreshold})`)
  } else {
    breakdown.push(`Base rate for ${result.rateDetails.minWeight}g-${result.rateDetails.maxWeight}g: ₹${result.rateDetails.rate}`)
    
    if (orderData.weight > result.rateDetails.maxWeight) {
      const additionalWeight = orderData.weight - result.rateDetails.maxWeight
      const additionalSlabs = Math.ceil(additionalWeight / result.rateDetails.additionalWeight)
      breakdown.push(`Additional weight (${additionalWeight}g): ${additionalSlabs} slab(s) × ₹${result.rateDetails.additionalRate} = ₹${additionalSlabs * result.rateDetails.additionalRate}`)
    }
    
    if (result.codSurcharge > 0) {
      breakdown.push(`COD surcharge: ₹${result.codSurcharge}`)
    }
    
    breakdown.push(`Total shipping cost: ₹${result.totalCost}`)
  }

  return {
    ...result,
    breakdown
  }
}

/**
 * Example Usage in Express Route:
 * 
 * router.post('/checkout/calculate-shipping', async (req, res) => {
 *   try {
 *     const { pincode, weight, paymentMode, orderValue } = req.body
 *     
 *     const result = await calculateShippingCost({
 *       pincode,
 *       weight,
 *       paymentMode: paymentMode || 'prepaid',
 *       orderValue: orderValue || 0,
 *       websiteId: req.websiteId,
 *       models: {
 *         ShippingZone,
 *         ShippingRate,
 *         ShippingConfig,
 *         PincodeZoneMapping
 *       }
 *     })
 *     
 *     if (!result.success) {
 *       return res.status(400).json(result)
 *     }
 *     
 *     res.json(result)
 *   } catch (error) {
 *     res.status(500).json({ 
 *       success: false, 
 *       error: error.message 
 *     })
 *   }
 * })
 */
