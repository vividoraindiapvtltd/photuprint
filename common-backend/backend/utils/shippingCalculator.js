/**
 * Shipping Cost Calculator Utility
 * Calculates shipping cost based on zone, weight, payment mode, and order value
 */

/**
 * Calculate shipping cost for an order
 * @param {Object} params - Calculation parameters
 * @param {string} params.pincode - Delivery pincode (6 digits)
 * @param {number} params.weight - Total weight in grams
 * @param {string} params.paymentMode - Payment mode: 'prepaid' or 'cod'
 * @param {number} params.orderValue - Total order value
 * @param {string} params.websiteId - Website/tenant ID
 * @param {Object} params.models - Mongoose models (ShippingZone, ShippingRate, ShippingConfig, PincodeZoneMapping)
 * @returns {Promise<Object>} Shipping cost details
 */
export const calculateShippingCost = async ({
  pincode,
  weight,
  paymentMode = 'prepaid',
  orderValue = 0,
  websiteId,
  models
}) => {
  try {
    const { ShippingZone, ShippingRate, ShippingConfig, PincodeZoneMapping } = models

    // Validate inputs
    if (!pincode || !/^[0-9]{6}$/.test(pincode)) {
      return {
        success: false,
        error: 'Invalid pincode format. Must be 6 digits.',
        shippingCost: 0
      }
    }

    if (!weight || weight <= 0) {
      return {
        success: false,
        error: 'Weight must be greater than 0',
        shippingCost: 0
      }
    }

    if (!websiteId) {
      return {
        success: false,
        error: 'Website ID is required',
        shippingCost: 0
      }
    }

    // Get shipping configuration
    const config = await ShippingConfig.findOne({
      website: websiteId,
      isActive: true,
      deleted: false
    })

    // Check free shipping threshold
    const freeShippingThreshold = config?.freeShippingThreshold || 0
    if (orderValue >= freeShippingThreshold && freeShippingThreshold > 0) {
      return {
        success: true,
        shippingCost: 0,
        baseCost: 0,
        codSurcharge: 0,
        totalCost: 0,
        zone: null,
        isFreeShipping: true,
        message: `Free shipping applied (Order value ₹${orderValue} >= ₹${freeShippingThreshold})`
      }
    }

    // Find zone for pincode
    const pincodeMapping = await PincodeZoneMapping.findOne({
      pincode: pincode.trim(),
      website: websiteId,
      isActive: true,
      deleted: false
    }).populate('zone')

    if (!pincodeMapping || !pincodeMapping.zone) {
      return {
        success: false,
        error: `Zone not found for pincode ${pincode}. Please configure pincode-zone mapping.`,
        shippingCost: 0
      }
    }

    const zone = pincodeMapping.zone

    // Find applicable rate based on weight
    const rates = await ShippingRate.find({
      zone: zone._id,
      website: websiteId,
      isActive: true,
      deleted: false,
      minWeight: { $lte: weight },
      maxWeight: { $gte: weight }
    }).sort({ minWeight: 1 })

    if (!rates || rates.length === 0) {
      return {
        success: false,
        error: `No shipping rate found for zone "${zone.name}" and weight ${weight}g`,
        shippingCost: 0,
        zone: zone.name
      }
    }

    // Use the first matching rate (should be most specific)
    const applicableRate = rates[0]

    // Calculate base shipping cost
    let baseCost = applicableRate.rate

    // Calculate additional weight charges
    if (weight > applicableRate.maxWeight && applicableRate.additionalRate > 0) {
      const additionalWeight = weight - applicableRate.maxWeight
      const additionalSlabs = Math.ceil(additionalWeight / applicableRate.additionalWeight)
      baseCost += additionalSlabs * applicableRate.additionalRate
    }

    // Calculate COD surcharge
    let codSurcharge = 0
    if (paymentMode.toLowerCase() === 'cod' && config) {
      if (config.codSurchargeType === 'percentage') {
        codSurcharge = (baseCost * config.codSurcharge) / 100
      } else {
        codSurcharge = config.codSurcharge
      }
    }

    const totalCost = baseCost + codSurcharge

    return {
      success: true,
      shippingCost: totalCost,
      baseCost: baseCost,
      codSurcharge: codSurcharge,
      totalCost: totalCost,
      zone: zone.name,
      zoneId: zone._id,
      weight: weight,
      paymentMode: paymentMode,
      isFreeShipping: false,
      freeShippingThreshold: freeShippingThreshold,
      rateDetails: {
        minWeight: applicableRate.minWeight,
        maxWeight: applicableRate.maxWeight,
        rate: applicableRate.rate,
        additionalWeight: applicableRate.additionalWeight,
        additionalRate: applicableRate.additionalRate
      }
    }
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Failed to calculate shipping cost',
      shippingCost: 0
    }
  }
}

/**
 * Get zone for a pincode
 * @param {string} pincode - Pincode (6 digits)
 * @param {string} websiteId - Website/tenant ID
 * @param {Object} models - Mongoose models
 * @returns {Promise<Object>} Zone information
 */
export const getZoneForPincode = async ({ pincode, websiteId, models }) => {
  try {
    const { PincodeZoneMapping } = models

    const mapping = await PincodeZoneMapping.findOne({
      pincode: pincode.trim(),
      website: websiteId,
      isActive: true,
      deleted: false
    }).populate('zone')

    if (!mapping || !mapping.zone) {
      return {
        success: false,
        error: `Zone not found for pincode ${pincode}`,
        zone: null
      }
    }

    return {
      success: true,
      zone: mapping.zone,
      pincode: mapping.pincode,
      state: mapping.state,
      city: mapping.city
    }
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Failed to get zone for pincode',
      zone: null
    }
  }
}
