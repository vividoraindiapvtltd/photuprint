import ShippingConfig from '../models/shippingConfig.model.js'

export const getShippingConfig = async (req, res) => {
  try {
    if (!req.websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }

    let config = await ShippingConfig.findOne({
      website: req.websiteId,
      deleted: false
    })

    // Create default config if doesn't exist
    if (!config) {
      config = new ShippingConfig({
        codSurcharge: 0,
        codSurchargeType: 'fixed',
        freeShippingThreshold: 0,
        website: req.websiteId
      })
      await config.save()
    }

    res.json(config)
  } catch (error) {
    res.status(500).json({ msg: 'Failed to fetch shipping config' })
  }
}

export const updateShippingConfig = async (req, res) => {
  try {
    if (!req.websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }

    const { codSurcharge, codSurchargeType, freeShippingThreshold, isActive } = req.body

    let config = await ShippingConfig.findOne({
      website: req.websiteId,
      deleted: false
    })

    if (!config) {
      config = new ShippingConfig({
        website: req.websiteId
      })
    }

    if (codSurcharge !== undefined) {
      if (codSurcharge < 0) {
        return res.status(400).json({ msg: 'COD surcharge must be non-negative' })
      }
      config.codSurcharge = parseFloat(codSurcharge)
    }

    if (codSurchargeType !== undefined) {
      if (!['fixed', 'percentage'].includes(codSurchargeType)) {
        return res.status(400).json({ msg: 'COD surcharge type must be "fixed" or "percentage"' })
      }
      config.codSurchargeType = codSurchargeType
    }

    if (freeShippingThreshold !== undefined) {
      if (freeShippingThreshold < 0) {
        return res.status(400).json({ msg: 'Free shipping threshold must be non-negative' })
      }
      config.freeShippingThreshold = parseFloat(freeShippingThreshold)
    }

    if (isActive !== undefined) {
      config.isActive = isActive === 'true' || isActive === true
    }

    const updatedConfig = await config.save()
    res.json(updatedConfig)
  } catch (error) {
    res.status(500).json({ msg: `Failed to update shipping config: ${error.message}` })
  }
}
