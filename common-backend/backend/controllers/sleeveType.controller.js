import SleeveType from '../models/sleeveType.model.js';
import { tenantCloudinaryUpload } from '../utils/cloudinary.js';

// Get all sleeve types
export const getSleeveTypes = async (req, res) => {
  try {
    // Multi-tenant: Require website context
    if (!req.websiteId) {
      return res.status(400).json({ msg: 'Website context is missing' });
    }

    const { search, showInactive, includeDeleted } = req.query;
    let query = {
      website: req.websiteId // Multi-tenant: Filter by website
    };
    
    // Filter by active status if showInactive is not true
    if (showInactive !== 'true') {
      query.isActive = true;
    }
    
    // Filter deleted items if includeDeleted is not true
    if (includeDeleted !== 'true') {
      query.deleted = false;
    }
    
    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }
    
    const sleeveTypes = await SleeveType.find(query).sort({ createdAt: -1 });
    res.json(sleeveTypes);
  } catch (error) {
    console.error('Error fetching sleeve types:', error);
    res.status(500).json({ msg: 'Failed to fetch sleeve types' });
  }
};

// Get single sleeve type by ID
export const getSleeveTypeById = async (req, res) => {
  try {
    // Multi-tenant: Require website context
    if (!req.websiteId) {
      return res.status(400).json({ msg: 'Website context is missing' });
    }

    const sleeveType = await SleeveType.findOne({ _id: req.params.id, website: req.websiteId });
    if (!sleeveType) {
      return res.status(404).json({ msg: 'Sleeve type not found' });
    }
    res.json(sleeveType);
  } catch (error) {
    console.error('Error fetching sleeve type:', error);
    res.status(500).json({ msg: 'Failed to fetch sleeve type' });
  }
};

// Create new sleeve type
export const createSleeveType = async (req, res) => {
  try {
    // Multi-tenant: Require website context
    if (!req.websiteId) {
      return res.status(400).json({ msg: 'Website context is missing. Please select a website first.' });
    }

    const { name, description, isActive } = req.body;
    
    if (!name) {
      return res.status(400).json({ msg: 'Sleeve type name is required' });
    }

    let { isActive: activeStatus = true } = req.body;
    
    // Convert string "true"/"false" to boolean (for FormData)
    if (typeof activeStatus === 'string') {
      activeStatus = activeStatus === 'true';
    }

    // Check if sleeve type with same name already exists within the same website
    const existingSleeveType = await SleeveType.findOne({
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
      website: req.websiteId,
      deleted: false
    });

    if (existingSleeveType) {
      return res.status(400).json({ msg: 'Sleeve type name already exists' });
    }

    // Handle image upload if present
    let image = null;
    if (req.file) {
      image = await tenantCloudinaryUpload(req.websiteId, req.file, { folder: 'photuprint/sleeve-types' });
    }

    const sleeveType = new SleeveType({
      name: name.trim(),
      description: description?.trim() || null,
      image,
      isActive: activeStatus,
      website: req.websiteId // Multi-tenant: Set website
    });

    const savedSleeveType = await sleeveType.save();
    res.status(201).json(savedSleeveType);
  } catch (error) {
    console.error('Error creating sleeve type:', error);
    if (error.code === 11000) {
      return res.status(400).json({ msg: 'Sleeve type name already exists' });
    }
    res.status(500).json({ msg: 'Failed to create sleeve type' });
  }
};

// Update sleeve type
export const updateSleeveType = async (req, res) => {
  try {
    // Multi-tenant: Require website context
    if (!req.websiteId) {
      return res.status(400).json({ msg: 'Website context is missing. Please select a website first.' });
    }

    const { name, description, isActive, deleted } = req.body;

    const sleeveType = await SleeveType.findOne({ _id: req.params.id, website: req.websiteId });
    if (!sleeveType) {
      return res.status(404).json({ msg: 'Sleeve type not found' });
    }

    // Check if name is being changed and if it conflicts with existing sleeve type within the same website
    if (name && name.trim() !== sleeveType.name) {
      const existingSleeveType = await SleeveType.findOne({
        _id: { $ne: req.params.id },
        name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
        website: req.websiteId,
        deleted: false 
      });
      if (existingSleeveType) {
        return res.status(400).json({ msg: 'Sleeve type name already exists' });
      }
    }

    // Update fields
    if (name && name.trim() !== sleeveType.name) {
      sleeveType.name = name.trim();
    }

    if (description !== undefined) {
      sleeveType.description = description?.trim() || null;
    }

    if (isActive !== undefined) {
      let activeStatus = isActive;
      // Convert string "true"/"false" to boolean (for FormData)
      if (typeof activeStatus === 'string') {
        activeStatus = activeStatus === 'true';
      }
      sleeveType.isActive = activeStatus;
    }

    // Handle deleted field update (for reverting deleted sleeve types)
    if (deleted !== undefined) {
      sleeveType.deleted = deleted;
    }

    // Handle image upload if present
    if (req.file) {
      sleeveType.image = await tenantCloudinaryUpload(req.websiteId, req.file, { folder: 'photuprint/sleeve-types' });
    } else if (req.body.image !== undefined) {
      // Allow setting image URL directly (for keeping existing image when no new file)
      // Only update if explicitly provided in body
      sleeveType.image = req.body.image || null;
    }

    const updatedSleeveType = await sleeveType.save();
    res.json(updatedSleeveType);
  } catch (error) {
    console.error('Error updating sleeve type:', error);
    if (error.code === 11000) {
      return res.status(400).json({ msg: 'Sleeve type name already exists' });
    }
    res.status(500).json({ msg: 'Failed to update sleeve type' });
  }
};

// Delete sleeve type (soft delete)
export const deleteSleeveType = async (req, res) => {
  try {
    // Multi-tenant: Require website context
    if (!req.websiteId) {
      return res.status(400).json({ msg: 'Website context is missing. Please select a website first.' });
    }

    const sleeveType = await SleeveType.findOne({ _id: req.params.id, website: req.websiteId });
    if (!sleeveType) {
      return res.status(404).json({ msg: 'Sleeve type not found' });
    }

    sleeveType.isActive = false;
    sleeveType.deleted = true;
    await sleeveType.save();

    res.json({ msg: 'Sleeve type deleted successfully' });
  } catch (error) {
    console.error('Error deleting sleeve type:', error);
    res.status(500).json({ msg: 'Failed to delete sleeve type' });
  }
};

// Hard delete sleeve type
export const hardDeleteSleeveType = async (req, res) => {
  try {
    // Multi-tenant: Require website context
    if (!req.websiteId) {
      return res.status(400).json({ msg: 'Website context is missing. Please select a website first.' });
    }

    const sleeveType = await SleeveType.findOneAndDelete({ _id: req.params.id, website: req.websiteId });
    if (!sleeveType) {
      return res.status(404).json({ msg: 'Sleeve type not found' });
    }

    res.json({ msg: 'Sleeve type permanently deleted' });
  } catch (error) {
    console.error('Error hard deleting sleeve type:', error);
    res.status(500).json({ msg: 'Failed to delete sleeve type' });
  }
};
