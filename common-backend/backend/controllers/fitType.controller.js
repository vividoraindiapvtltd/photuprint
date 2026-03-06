import FitType from '../models/fitType.model.js';

// Get all fit types
export const getFitTypes = async (req, res) => {
  try {
    // Multi-tenant: Filter by website
    if (!req.websiteId) {
      return res.status(400).json({ msg: 'Website context is missing' });
    }
const { search, isActive, includeDeleted = 'true' } = req.query;
    let query = {
      website: req.websiteId, // Multi-tenant: Set website
      // Filter by tenant website
    };
    
    // Always include deleted fit types by default, but allow filtering
    if (includeDeleted === 'false') {
      query.deleted = false;
    }
    
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }
    
    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }
    
    const fitTypes = await FitType.find(query).sort({ createdAt: -1 });
    res.json(fitTypes);
  } catch (error) {
    console.error('Error fetching fit types:', error);
    res.status(500).json({ msg: 'Failed to fetch fit types' });
  }
};

// Get single fit type by ID
export const getFitTypeById = async (req, res) => {
  try {
    // Multi-tenant: Filter by website
    if (!req.websiteId) {
      return res.status(400).json({ msg: 'Website context is missing' });
    }
const fitType = await FitType.findOne({ _id: req.params.id, website: req.websiteId });
    if (!fitType) {
      return res.status(404).json({ msg: 'Fit type not found' });
    }
    res.json(fitType);
  } catch (error) {
    console.error('Error fetching fit type:', error);
    res.status(500).json({ msg: 'Failed to fetch fit type' });
  }
};

// Create new fit type
export const createFitType = async (req, res) => {
  try {
    const { name, description } = req.body;
    let { isActive = true } = req.body;
    
    // Convert string "true"/"false" to boolean (for FormData)
    if (typeof isActive === 'string') {
      isActive = isActive === 'true';
    }
    
    if (!name || !name.trim()) {
      return res.status(400).json({ msg: 'Fit type name is required' });
    }

    // Check for duplicate names (case-insensitive) within the same website
    const existingFitType = await FitType.findOne({ 
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
      website: req.websiteId,
      deleted: false
    });
    
    if (existingFitType) {
      return res.status(400).json({ msg: 'Fit type name already exists' });
    }

    const fitType = new FitType({
      name: name.trim(),
      description: description?.trim() || null,
      isActive,
      website: req.websiteId // Multi-tenant: Set website
    });

    const savedFitType = await fitType.save();
    res.status(201).json(savedFitType);
  } catch (error) {
    console.error('Error creating fit type:', error);
    if (error.code === 11000) {
      res.status(400).json({ msg: 'Fit type name already exists' });
    } else {
      res.status(500).json({ msg: 'Failed to create fit type' });
    }
  }
};

// Update fit type
export const updateFitType = async (req, res) => {
  try {
    const { name, description } = req.body;
    let { isActive, deleted } = req.body;
    
    // Convert string "true"/"false" to boolean (for FormData)
    if (typeof isActive === 'string') {
      isActive = isActive === 'true';
    }
    if (typeof deleted === 'string') {
      deleted = deleted === 'true';
    }
    
    const fitType = await FitType.findOne({ _id: req.params.id, website: req.websiteId });
    if (!fitType) {
      return res.status(404).json({ msg: 'Fit type not found' });
    }

    // Check for duplicate names (case-insensitive) if name is being changed within the same website
    if (name && name.trim() !== fitType.name) {
      const existingFitType = await FitType.findOne({ 
        name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
        _id: { $ne: req.params.id },
        website: req.websiteId,
        deleted: false
      });
      
      if (existingFitType) {
        return res.status(400).json({ msg: 'Fit type name already exists' });
      }
    }

    // Update fields
    if (name && name.trim() !== fitType.name) {
      fitType.name = name.trim();
    }
    
    if (description !== undefined) {
      fitType.description = description?.trim() || null;
    }
    
    if (isActive !== undefined) {
      fitType.isActive = isActive;
    }

    // Handle deleted field update (for reverting deleted fit types)
    if (req.body.deleted !== undefined) {
      fitType.deleted = req.body.deleted;
    }

    const updatedFitType = await fitType.save();
    res.json(updatedFitType);
  } catch (error) {
    console.error('Error updating fit type:', error);
    if (error.code === 11000) {
      res.status(400).json({ msg: 'Fit type name already exists' });
    } else {
      res.status(500).json({ msg: 'Failed to update fit type' });
    }
  }
};

// Delete fit type (soft delete)
export const deleteFitType = async (req, res) => {
  try {
    const fitType = await FitType.findOne({ _id: req.params.id, website: req.websiteId });
    if (!fitType) {
      return res.status(404).json({ msg: 'Fit type not found' });
    }

    // Soft delete: mark as inactive and set deleted flag
    fitType.isActive = false;
    fitType.deleted = true;
    await fitType.save();
    
    res.json({ msg: 'Fit type deleted successfully' });
  } catch (error) {
    console.error('Error deleting fit type:', error);
    res.status(500).json({ msg: 'Failed to delete fit type' });
  }
};

// Hard delete fit type
export const hardDeleteFitType = async (req, res) => {
  try {
    const fitType = await FitType.findOneAndDelete({ _id: req.params.id, website: req.websiteId });
    if (!fitType) {
      return res.status(404).json({ msg: 'Fit type not found' });
    }
    
    res.json({ msg: 'Fit type permanently deleted' });
  } catch (error) {
    console.error('Error deleting fit type:', error);
    res.status(500).json({ msg: 'Failed to delete fit type' });
  }
};
