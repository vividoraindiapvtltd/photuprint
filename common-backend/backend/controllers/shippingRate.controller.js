import ShippingRate from '../models/shippingRate.model.js'
import ShippingZone from '../models/shippingZone.model.js'

export const getShippingRates = async (req, res) => {
  try {
    if (!req.websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }

    const { showInactive, includeDeleted = 'true', zoneId } = req.query
    let query = {
      website: req.websiteId
    }
    
    if (includeDeleted === 'false') {
      query.deleted = false
    }
    
    if (showInactive !== 'true') {
      query.isActive = true
    }

    if (zoneId) {
      query.zone = zoneId
    }
    
    const rates = await ShippingRate.find(query)
      .populate('zone', 'name description')
      .sort({ zone: 1, minWeight: 1 })
    
    res.json(rates)
  } catch (error) {
    res.status(500).json({ msg: 'Failed to fetch shipping rates' })
  }
}

export const getShippingRateById = async (req, res) => {
  try {
    if (!req.websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }

    const rate = await ShippingRate.findOne({ _id: req.params.id, website: req.websiteId })
      .populate('zone', 'name description')
    
    if (!rate) {
      return res.status(404).json({ msg: 'Shipping rate not found' })
    }
    res.json(rate)
  } catch (error) {
    res.status(500).json({ msg: 'Failed to fetch shipping rate' })
  }
}

export const createShippingRate = async (req, res) => {
  try {
    if (!req.websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }

    const { zone, minWeight, maxWeight, rate, additionalWeight, additionalRate, isActive } = req.body

    if (!zone || !minWeight || !maxWeight || rate === undefined) {
      return res.status(400).json({ msg: 'Zone, minWeight, maxWeight, and rate are required' })
    }

    if (minWeight >= maxWeight) {
      return res.status(400).json({ msg: 'minWeight must be less than maxWeight' })
    }

    if (rate < 0) {
      return res.status(400).json({ msg: 'Rate must be non-negative' })
    }

    // Verify zone exists
    const zoneExists = await ShippingZone.findOne({ _id: zone, website: req.websiteId, deleted: false })
    if (!zoneExists) {
      return res.status(404).json({ msg: 'Shipping zone not found' })
    }

    // Check for overlapping weight ranges in the same zone
    const overlappingRate = await ShippingRate.findOne({
      zone,
      website: req.websiteId,
      deleted: false,
      $or: [
        { minWeight: { $lte: maxWeight }, maxWeight: { $gte: minWeight } }
      ]
    })

    if (overlappingRate) {
      return res.status(400).json({ 
        msg: `Weight range overlaps with existing rate (${overlappingRate.minWeight}g - ${overlappingRate.maxWeight}g)` 
      })
    }

    const shippingRate = new ShippingRate({
      zone,
      minWeight: parseFloat(minWeight),
      maxWeight: parseFloat(maxWeight),
      rate: parseFloat(rate),
      additionalWeight: additionalWeight ? parseFloat(additionalWeight) : 500,
      additionalRate: additionalRate ? parseFloat(additionalRate) : 0,
      isActive: isActive !== undefined ? (isActive === 'true' || isActive === true) : true,
      website: req.websiteId
    })

    const savedRate = await shippingRate.save()
    const populatedRate = await ShippingRate.findById(savedRate._id)
      .populate('zone', 'name description')
    
    res.status(201).json(populatedRate)
  } catch (error) {
    res.status(500).json({ msg: `Failed to create shipping rate: ${error.message}` })
  }
}

export const updateShippingRate = async (req, res) => {
  try {
    if (!req.websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }

    const { zone, minWeight, maxWeight, rate, additionalWeight, additionalRate, isActive, deleted } = req.body

    const shippingRate = await ShippingRate.findOne({ _id: req.params.id, website: req.websiteId })
    if (!shippingRate) {
      return res.status(404).json({ msg: 'Shipping rate not found' })
    }

    if (minWeight !== undefined && maxWeight !== undefined) {
      if (minWeight >= maxWeight) {
        return res.status(400).json({ msg: 'minWeight must be less than maxWeight' })
      }
    }

    if (zone !== undefined) {
      const zoneExists = await ShippingZone.findOne({ _id: zone, website: req.websiteId, deleted: false })
      if (!zoneExists) {
        return res.status(404).json({ msg: 'Shipping zone not found' })
      }
      shippingRate.zone = zone
    }

    if (minWeight !== undefined) shippingRate.minWeight = parseFloat(minWeight)
    if (maxWeight !== undefined) shippingRate.maxWeight = parseFloat(maxWeight)
    if (rate !== undefined) {
      if (rate < 0) {
        return res.status(400).json({ msg: 'Rate must be non-negative' })
      }
      shippingRate.rate = parseFloat(rate)
    }
    if (additionalWeight !== undefined) shippingRate.additionalWeight = parseFloat(additionalWeight)
    if (additionalRate !== undefined) {
      if (additionalRate < 0) {
        return res.status(400).json({ msg: 'Additional rate must be non-negative' })
      }
      shippingRate.additionalRate = parseFloat(additionalRate)
    }
    if (isActive !== undefined) {
      shippingRate.isActive = isActive === 'true' || isActive === true
    }
    if (deleted !== undefined) {
      shippingRate.deleted = deleted === 'true' || deleted === true
    }

    const updatedRate = await shippingRate.save()
    const populatedRate = await ShippingRate.findById(updatedRate._id)
      .populate('zone', 'name description')
    
    res.json(populatedRate)
  } catch (error) {
    res.status(500).json({ msg: 'Failed to update shipping rate' })
  }
}

export const deleteShippingRate = async (req, res) => {
  try {
    if (!req.websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }

    const rate = await ShippingRate.findOne({ _id: req.params.id, website: req.websiteId })
    if (!rate) {
      return res.status(404).json({ msg: 'Shipping rate not found' })
    }

    rate.isActive = false
    rate.deleted = true
    await rate.save()
    
    res.json({ msg: 'Shipping rate deleted successfully' })
  } catch (error) {
    res.status(500).json({ msg: 'Failed to delete shipping rate' })
  }
}
