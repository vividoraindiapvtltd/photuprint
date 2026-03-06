import GstSlab from '../models/gstSlab.model.js';

// Get all GST slabs
export const getGstSlabs = async (req, res) => {
  try {
    // Multi-tenant: Require website context
    if (!req.websiteId) {
      return res.status(400).json({ msg: 'Website context is missing' });
    }

    const { search, isActive, showInactive = 'true', includeDeleted = 'true' } = req.query;
    let query = {
      website: req.websiteId // Multi-tenant: Filter by website
    };

    // Always include deleted slabs by default, but allow filtering
    if (includeDeleted === 'false') {
      query.deleted = false;
    }

    if (showInactive === 'false') {
      query.isActive = true;
    } else if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    const gstSlabs = await GstSlab.find(query).sort({ rate: 1 }); // Sort by rate ascending
    res.json(gstSlabs);
  } catch (error) {
    console.error('Error fetching GST slabs:', error);
    res.status(500).json({ msg: 'Failed to fetch GST slabs' });
  }
};

// Get single GST slab by ID
export const getGstSlabById = async (req, res) => {
  try {
    // Multi-tenant: Require website context
    if (!req.websiteId) {
      return res.status(400).json({ msg: 'Website context is missing' });
    }

    const gstSlab = await GstSlab.findOne({ _id: req.params.id, website: req.websiteId });
    if (!gstSlab) {
      return res.status(404).json({ msg: 'GST slab not found' });
    }
    res.json(gstSlab);
  } catch (error) {
    console.error('Error fetching GST slab:', error);
    res.status(500).json({ msg: 'Failed to fetch GST slab' });
  }
};

// Create new GST slab
export const createGstSlab = async (req, res) => {
  try {
    // Multi-tenant: Require website context
    if (!req.websiteId) {
      return res.status(400).json({ msg: 'Website context is missing. Please select a website first.' });
    }

    const { name, rate, description } = req.body;
    let { isActive = true } = req.body;

    // Convert string "true"/"false" to boolean (for FormData)
    if (typeof isActive === 'string') {
      isActive = isActive === 'true';
    }

    if (!name || !name.trim()) {
      return res.status(400).json({ msg: 'GST slab name is required' });
    }

    if (rate === undefined || rate === null || rate === '') {
      return res.status(400).json({ msg: 'GST rate is required' });
    }

    const rateNum = Number(rate);
    if (isNaN(rateNum) || rateNum < 0 || rateNum > 100) {
      return res.status(400).json({ msg: 'GST rate must be a number between 0 and 100' });
    }

    // Check if GST slab with same rate already exists within the same website
    const existingGstSlab = await GstSlab.findOne({
      rate: rateNum,
      website: req.websiteId,
      deleted: false,
    });

    if (existingGstSlab) {
      return res.status(400).json({ msg: `GST slab with rate ${rateNum}% already exists` });
    }

    // Check if GST slab with same name already exists within the same website
    const existingGstSlabByName = await GstSlab.findOne({
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
      website: req.websiteId,
      deleted: false,
    });

    if (existingGstSlabByName) {
      return res.status(400).json({ msg: `GST slab with name "${name.trim()}" already exists` });
    }

    const gstSlab = new GstSlab({
      name: name.trim(),
      rate: rateNum,
      description: description?.trim() || null,
      isActive,
      website: req.websiteId // Multi-tenant: Set website
    });

    const savedGstSlab = await gstSlab.save();
    res.status(201).json(savedGstSlab);
  } catch (error) {
    console.error('Error creating GST slab:', error);
    if (error.code === 11000) {
      return res.status(400).json({ msg: 'GST slab with this rate or name already exists' });
    }
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors)
        .map((err) => err.message)
        .join(', ');
      return res.status(400).json({ msg: `Validation error: ${validationErrors}` });
    }
    res.status(500).json({ msg: 'Failed to create GST slab', error: error.message });
  }
};

// Update GST slab
export const updateGstSlab = async (req, res) => {
  try {
    // Multi-tenant: Require website context
    if (!req.websiteId) {
      return res.status(400).json({ msg: 'Website context is missing. Please select a website first.' });
    }

    const { name, rate, description } = req.body;
    let { isActive } = req.body;

    // Convert string "true"/"false" to boolean (for FormData)
    if (typeof isActive === 'string') {
      isActive = isActive === 'true';
    }

    // Check if GST slab exists within the same website
    const gstSlab = await GstSlab.findOne({ _id: req.params.id, website: req.websiteId });
    if (!gstSlab) {
      return res.status(404).json({ msg: 'GST slab not found' });
    }

    // Check for duplicate rates within the same website (excluding current GST slab)
    if (rate !== undefined && rate !== null && rate !== '') {
      const rateNum = Number(rate);
      if (isNaN(rateNum) || rateNum < 0 || rateNum > 100) {
        return res.status(400).json({ msg: 'GST rate must be a number between 0 and 100' });
      }

      if (rateNum !== gstSlab.rate) {
        const existingGstSlab = await GstSlab.findOne({
          _id: { $ne: req.params.id },
          rate: rateNum,
          website: req.websiteId,
          deleted: false,
        });

        if (existingGstSlab) {
          return res.status(400).json({ msg: `GST slab with rate ${rateNum}% already exists` });
        }
      }
    }

    // Check for duplicate names within the same website (excluding current GST slab)
    if (name && name.trim() !== gstSlab.name) {
      const existingGstSlabByName = await GstSlab.findOne({
        _id: { $ne: req.params.id },
        name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
        website: req.websiteId,
        deleted: false,
      });

      if (existingGstSlabByName) {
        return res.status(400).json({ msg: `GST slab with name "${name.trim()}" already exists` });
      }
    }

    // Update fields
    if (name !== undefined && name.trim() !== gstSlab.name) {
      gstSlab.name = name.trim();
    }

    if (rate !== undefined && rate !== null && rate !== '') {
      gstSlab.rate = Number(rate);
    }

    if (description !== undefined) {
      gstSlab.description = description?.trim() || null;
    }

    if (isActive !== undefined) {
      gstSlab.isActive = isActive;
    }

    // Handle deleted field update (for reverting deleted GST slabs)
    if (req.body.deleted !== undefined) {
      gstSlab.deleted = req.body.deleted;
    }

    const updatedGstSlab = await gstSlab.save();
    res.json(updatedGstSlab);
  } catch (error) {
    console.error('Error updating GST slab:', error);
    if (error.code === 11000) {
      return res.status(400).json({ msg: 'GST slab with this rate or name already exists' });
    }
    res.status(500).json({ msg: 'Failed to update GST slab', error: error.message });
  }
};

// Delete GST slab (soft delete)
export const deleteGstSlab = async (req, res) => {
  try {
    // Multi-tenant: Require website context
    if (!req.websiteId) {
      return res.status(400).json({ msg: 'Website context is missing. Please select a website first.' });
    }

    const gstSlab = await GstSlab.findOne({ _id: req.params.id, website: req.websiteId });
    if (!gstSlab) {
      return res.status(404).json({ msg: 'GST slab not found' });
    }

    // Soft delete: mark as inactive and set deleted flag
    gstSlab.isActive = false;
    gstSlab.deleted = true;
    await gstSlab.save();

    res.json({ msg: 'GST slab deleted successfully' });
  } catch (error) {
    console.error('Error deleting GST slab:', error);
    res.status(500).json({ msg: 'Failed to delete GST slab' });
  }
};

// Hard delete GST slab
export const hardDeleteGstSlab = async (req, res) => {
  try {
    // Multi-tenant: Require website context
    if (!req.websiteId) {
      return res.status(400).json({ msg: 'Website context is missing. Please select a website first.' });
    }

    const gstSlab = await GstSlab.findOneAndDelete({ _id: req.params.id, website: req.websiteId });
    if (!gstSlab) {
      return res.status(404).json({ msg: 'GST slab not found' });
    }

    res.json({ msg: 'GST slab permanently deleted' });
  } catch (error) {
    console.error('Error deleting GST slab:', error);
    res.status(500).json({ msg: 'Failed to delete GST slab' });
  }
};
