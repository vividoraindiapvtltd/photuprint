import ShippingZone from '../models/shippingZone.model.js'

export const getShippingZones = async (req, res) => {
  try {
    if (!req.websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }

    const { showInactive, includeDeleted = 'true' } = req.query
    let query = {
      website: req.websiteId
    }
    
    if (includeDeleted === 'false') {
      query.deleted = false
    }
    
    if (showInactive !== 'true') {
      query.isActive = true
    }
    
    const zones = await ShippingZone.find(query).sort({ createdAt: -1 })
    res.json(zones)
  } catch (error) {
    res.status(500).json({ msg: 'Failed to fetch shipping zones' })
  }
}

export const getShippingZoneById = async (req, res) => {
  try {
    if (!req.websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }

    const zone = await ShippingZone.findOne({ _id: req.params.id, website: req.websiteId })
    if (!zone) {
      return res.status(404).json({ msg: 'Shipping zone not found' })
    }
    res.json(zone)
  } catch (error) {
    res.status(500).json({ msg: 'Failed to fetch shipping zone' })
  }
}

export const createShippingZone = async (req, res) => {
  try {
    if (!req.websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }

    const { name, description, isActive } = req.body

    if (!name) {
      return res.status(400).json({ msg: 'Zone name is required' })
    }

    const validZones = ["Local", "Zonal", "Metro", "Rest of India", "Remote/North East/J&K"]
    if (!validZones.includes(name)) {
      return res.status(400).json({ msg: `Invalid zone name. Must be one of: ${validZones.join(', ')}` })
    }

    // Check if zone already exists for this website
    const existingZone = await ShippingZone.findOne({
      name,
      website: req.websiteId,
      deleted: false
    })

    if (existingZone) {
      return res.status(400).json({ msg: `Zone "${name}" already exists for this website` })
    }

    const zone = new ShippingZone({
      name,
      description: description || "",
      isActive: isActive !== undefined ? (isActive === 'true' || isActive === true) : true,
      website: req.websiteId
    })

    const savedZone = await zone.save()
    res.status(201).json(savedZone)
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ msg: 'Zone already exists for this website' })
    }
    res.status(500).json({ msg: `Failed to create shipping zone: ${error.message}` })
  }
}

export const updateShippingZone = async (req, res) => {
  try {
    if (!req.websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }

    const { description, isActive, deleted } = req.body

    const zone = await ShippingZone.findOne({ _id: req.params.id, website: req.websiteId })
    if (!zone) {
      return res.status(404).json({ msg: 'Shipping zone not found' })
    }

    if (description !== undefined) zone.description = description
    if (isActive !== undefined) {
      zone.isActive = isActive === 'true' || isActive === true
    }
    if (deleted !== undefined) {
      zone.deleted = deleted === 'true' || deleted === true
    }

    const updatedZone = await zone.save()
    res.json(updatedZone)
  } catch (error) {
    res.status(500).json({ msg: 'Failed to update shipping zone' })
  }
}

export const deleteShippingZone = async (req, res) => {
  try {
    if (!req.websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }

    const zone = await ShippingZone.findOne({ _id: req.params.id, website: req.websiteId })
    if (!zone) {
      return res.status(404).json({ msg: 'Shipping zone not found' })
    }

    zone.isActive = false
    zone.deleted = true
    await zone.save()
    
    res.json({ msg: 'Shipping zone deleted successfully' })
  } catch (error) {
    res.status(500).json({ msg: 'Failed to delete shipping zone' })
  }
}
