import PincodeZoneMapping from '../models/pincodeZoneMapping.model.js'
import ShippingZone from '../models/shippingZone.model.js'

export const getPincodeMappings = async (req, res) => {
  try {
    if (!req.websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }

    const { showInactive, includeDeleted = 'true', zoneId, pincode, state, city } = req.query
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

    if (pincode) {
      query.pincode = pincode.trim()
    }

    if (state) {
      query.state = { $regex: state, $options: 'i' }
    }

    if (city) {
      query.city = { $regex: city, $options: 'i' }
    }
    
    const mappings = await PincodeZoneMapping.find(query)
      .populate('zone', 'name description')
      .sort({ pincode: 1 })
    
    res.json(mappings)
  } catch (error) {
    res.status(500).json({ msg: 'Failed to fetch pincode mappings' })
  }
}

export const getPincodeMappingById = async (req, res) => {
  try {
    if (!req.websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }

    const mapping = await PincodeZoneMapping.findOne({ _id: req.params.id, website: req.websiteId })
      .populate('zone', 'name description')
    
    if (!mapping) {
      return res.status(404).json({ msg: 'Pincode mapping not found' })
    }
    res.json(mapping)
  } catch (error) {
    res.status(500).json({ msg: 'Failed to fetch pincode mapping' })
  }
}

export const getZoneByPincode = async (req, res) => {
  try {
    if (!req.websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }

    const { pincode } = req.params

    if (!pincode || !/^[0-9]{6}$/.test(pincode)) {
      return res.status(400).json({ msg: 'Invalid pincode format. Must be 6 digits.' })
    }

    const mapping = await PincodeZoneMapping.findOne({
      pincode: pincode.trim(),
      website: req.websiteId,
      isActive: true,
      deleted: false
    }).populate('zone', 'name description')

    if (!mapping || !mapping.zone) {
      return res.status(404).json({ msg: `Zone not found for pincode ${pincode}` })
    }

    res.json({
      pincode: mapping.pincode,
      zone: mapping.zone,
      state: mapping.state,
      city: mapping.city
    })
  } catch (error) {
    res.status(500).json({ msg: 'Failed to get zone for pincode' })
  }
}

export const createPincodeMapping = async (req, res) => {
  try {
    if (!req.websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }

    const { pincode, zone, state, city, isActive } = req.body

    if (!pincode || !zone) {
      return res.status(400).json({ msg: 'Pincode and zone are required' })
    }

    if (!/^[0-9]{6}$/.test(pincode)) {
      return res.status(400).json({ msg: 'Invalid pincode format. Must be 6 digits.' })
    }

    // Verify zone exists
    const zoneExists = await ShippingZone.findOne({ _id: zone, website: req.websiteId, deleted: false })
    if (!zoneExists) {
      return res.status(404).json({ msg: 'Shipping zone not found' })
    }

    // Check if mapping already exists
    const existingMapping = await PincodeZoneMapping.findOne({
      pincode: pincode.trim(),
      website: req.websiteId,
      deleted: false
    })

    if (existingMapping) {
      return res.status(400).json({ msg: `Mapping already exists for pincode ${pincode}` })
    }

    const mapping = new PincodeZoneMapping({
      pincode: pincode.trim(),
      zone,
      state: state || "",
      city: city || "",
      isActive: isActive !== undefined ? (isActive === 'true' || isActive === true) : true,
      website: req.websiteId
    })

    const savedMapping = await mapping.save()
    const populatedMapping = await PincodeZoneMapping.findById(savedMapping._id)
      .populate('zone', 'name description')
    
    res.status(201).json(populatedMapping)
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ msg: 'Pincode mapping already exists for this website' })
    }
    res.status(500).json({ msg: `Failed to create pincode mapping: ${error.message}` })
  }
}

export const bulkCreatePincodeMappings = async (req, res) => {
  try {
    if (!req.websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }

    const { mappings } = req.body

    if (!Array.isArray(mappings) || mappings.length === 0) {
      return res.status(400).json({ msg: 'Mappings array is required' })
    }

    const results = {
      success: [],
      failed: []
    }

    for (const item of mappings) {
      try {
        const { pincode, zone, state, city } = item

        if (!pincode || !zone) {
          results.failed.push({ pincode: pincode || 'N/A', error: 'Pincode and zone are required' })
          continue
        }

        if (!/^[0-9]{6}$/.test(pincode)) {
          results.failed.push({ pincode, error: 'Invalid pincode format' })
          continue
        }

        const zoneExists = await ShippingZone.findOne({ _id: zone, website: req.websiteId, deleted: false })
        if (!zoneExists) {
          results.failed.push({ pincode, error: 'Zone not found' })
          continue
        }

        const existingMapping = await PincodeZoneMapping.findOne({
          pincode: pincode.trim(),
          website: req.websiteId,
          deleted: false
        })

        if (existingMapping) {
          results.failed.push({ pincode, error: 'Mapping already exists' })
          continue
        }

        const mapping = new PincodeZoneMapping({
          pincode: pincode.trim(),
          zone,
          state: state || "",
          city: city || "",
          isActive: true,
          website: req.websiteId
        })

        await mapping.save()
        results.success.push({ pincode })
      } catch (error) {
        results.failed.push({ pincode: item.pincode || 'N/A', error: error.message })
      }
    }

    res.status(201).json({
      msg: `Processed ${mappings.length} mappings`,
      success: results.success.length,
      failed: results.failed.length,
      results
    })
  } catch (error) {
    res.status(500).json({ msg: `Failed to bulk create pincode mappings: ${error.message}` })
  }
}

export const updatePincodeMapping = async (req, res) => {
  try {
    if (!req.websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }

    const { zone, state, city, isActive, deleted } = req.body

    const mapping = await PincodeZoneMapping.findOne({ _id: req.params.id, website: req.websiteId })
    if (!mapping) {
      return res.status(404).json({ msg: 'Pincode mapping not found' })
    }

    if (zone !== undefined) {
      const zoneExists = await ShippingZone.findOne({ _id: zone, website: req.websiteId, deleted: false })
      if (!zoneExists) {
        return res.status(404).json({ msg: 'Shipping zone not found' })
      }
      mapping.zone = zone
    }

    if (state !== undefined) mapping.state = state
    if (city !== undefined) mapping.city = city
    if (isActive !== undefined) {
      mapping.isActive = isActive === 'true' || isActive === true
    }
    if (deleted !== undefined) {
      mapping.deleted = deleted === 'true' || deleted === true
    }

    const updatedMapping = await mapping.save()
    const populatedMapping = await PincodeZoneMapping.findById(updatedMapping._id)
      .populate('zone', 'name description')
    
    res.json(populatedMapping)
  } catch (error) {
    res.status(500).json({ msg: 'Failed to update pincode mapping' })
  }
}

export const deletePincodeMapping = async (req, res) => {
  try {
    if (!req.websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }

    const mapping = await PincodeZoneMapping.findOne({ _id: req.params.id, website: req.websiteId })
    if (!mapping) {
      return res.status(404).json({ msg: 'Pincode mapping not found' })
    }

    mapping.isActive = false
    mapping.deleted = true
    await mapping.save()
    
    res.json({ msg: 'Pincode mapping deleted successfully' })
  } catch (error) {
    res.status(500).json({ msg: 'Failed to delete pincode mapping' })
  }
}
