import CollarStyle from '../models/collarStyle.model.js';

// Generate next collar style ID scoped by website
const generateNextCollarStyleId = async (websiteId) => {
  try {
    const lastCollarStyle = await CollarStyle.findOne(
      { website: websiteId }, 
      {}, 
      { sort: { 'collarStyleId': -1 } }
    );
    
    if (!lastCollarStyle || !lastCollarStyle.collarStyleId) {
      return 'PPSCOLSTY1001';
    }
    
    const match = lastCollarStyle.collarStyleId.match(/PPSCOLSTY(\d+)/);
    if (match) {
      const lastNumber = parseInt(match[1]);
      return `PPSCOLSTY${lastNumber + 1}`;
    }
    
    return 'PPSCOLSTY1001';
  } catch (error) {
    console.error('Error generating collar style ID:', error);
    return 'PPSCOLSTY1001';
  }
};

// Get all collar styles
export const getCollarStyles = async (req, res) => {
  try {
    // Multi-tenant: Filter by website
    if (!req.websiteId) {
      return res.status(400).json({ msg: 'Website context is missing' });
    }
const { search, isActive, showInactive, includeDeleted } = req.query;
    let query = {
      website: req.websiteId, // Multi-tenant: Set website
      // Filter by tenant website
    };
    
    // Handle different query parameters
    if (isActive !== undefined && !showInactive && !includeDeleted) {
      query.isActive = isActive === 'true';
    }
    
    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }
    
    // If not including deleted, exclude them
    if (!includeDeleted) {
      query.deleted = { $ne: true };
    }
    
    const collarStyles = await CollarStyle.find(query)
      .sort({ createdAt: -1 });
    
    res.json(collarStyles);
  } catch (error) {
    console.error('Error fetching collar styles:', error);
    res.status(500).json({ msg: 'Failed to fetch collar styles' });
  }
};

// Get single collar style by ID
export const getCollarStyleById = async (req, res) => {
  try {
    // Multi-tenant: Filter by website
    if (!req.websiteId) {
      return res.status(400).json({ msg: 'Website context is missing' });
    }
const collarStyle = await CollarStyle.findOne({ _id: req.params.id, website: req.websiteId });
    if (!collarStyle) {
      return res.status(404).json({ msg: 'Collar style not found' });
    }
    res.json(collarStyle);
  } catch (error) {
    console.error('Error fetching collar style:', error);
    res.status(500).json({ msg: 'Failed to fetch collar style' });
  }
};

// Create new collar style
export const createCollarStyle = async (req, res) => {
  try {
    console.log('Creating collar style with data:', req.body);
    
    const { name, description, isActive = true } = req.body;
    
    if (!name || !name.trim()) {
      return res.status(400).json({ msg: 'Collar style name is required' });
    }

    // Check if collar style with same name already exists (excluding deleted ones) within the same website
    const existingCollarStyle = await CollarStyle.findOne({ 
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
      website: req.websiteId,
      deleted: { $ne: true }
    });
    
    if (existingCollarStyle) {
      return res.status(400).json({ msg: 'Collar style name already exists' });
    }

    // Generate slug from name
    const slug = name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^\w\-]+/g, '');
    
    // Generate next collar style ID scoped by website
    const collarStyleId = await generateNextCollarStyleId(req.websiteId);

    const collarStyle = new CollarStyle({
      collarStyleId,
      name: name.trim(),
      slug,
      description: description?.trim() || null,
      isActive,
      deleted: false,
      website: req.websiteId // Multi-tenant: Set website
    });

    const savedCollarStyle = await collarStyle.save();
    console.log('Collar style saved successfully:', savedCollarStyle);
    
    res.status(201).json(savedCollarStyle);
  } catch (error) {
    console.error('Error creating collar style:', error);
    res.status(500).json({ msg: 'Failed to create collar style' });
  }
};

// Update collar style
export const updateCollarStyle = async (req, res) => {
  try {
    console.log('Updating collar style with data:', req.body);
    
    const { name, description, isActive } = req.body;
    
    // Check if collar style exists
    const collarStyle = await CollarStyle.findOne({ _id: req.params.id, website: req.websiteId });
    if (!collarStyle) {
      return res.status(404).json({ msg: 'Collar style not found' });
    }

    // Check for duplicate names (excluding current collar style and deleted ones) within the same website
    if (name && name.trim() !== collarStyle.name) {
      const existingCollarStyle = await CollarStyle.findOne({ 
        $and: [
          { _id: { $ne: req.params.id } },
          { name: { $regex: new RegExp(`^${name.trim()}$`, 'i') } },
          { website: req.websiteId },
          { deleted: { $ne: true } }
        ]
      });
      
      if (existingCollarStyle) {
        return res.status(400).json({ msg: 'Collar style name already exists' });
      }
    }

    // Update fields
    if (name && name.trim() !== collarStyle.name) {
      collarStyle.name = name.trim();
      collarStyle.slug = name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^\w\-]+/g, '');
    }
    
    if (description !== undefined) {
      collarStyle.description = description?.trim() || null;
    }
    
    if (isActive !== undefined) {
      collarStyle.isActive = isActive;
    }

    const updatedCollarStyle = await collarStyle.save();
    console.log('Collar style updated successfully:', updatedCollarStyle);
    
    res.json(updatedCollarStyle);
  } catch (error) {
    console.error('Error updating collar style:', error);
    res.status(500).json({ msg: 'Failed to update collar style' });
  }
};

// Delete collar style (soft delete)
export const deleteCollarStyle = async (req, res) => {
  try {
    const collarStyle = await CollarStyle.findOne({ _id: req.params.id, website: req.websiteId });
    if (!collarStyle) {
      return res.status(404).json({ msg: 'Collar style not found' });
    }

    // Soft delete: mark as deleted and inactive
    collarStyle.deleted = true;
    collarStyle.isActive = false;
    await collarStyle.save();
    
    res.json({ msg: 'Collar style marked as deleted successfully' });
  } catch (error) {
    console.error('Error marking collar style as deleted:', error);
    res.status(500).json({ msg: 'Failed to mark collar style as deleted' });
  }
};

// Hard delete collar style
export const hardDeleteCollarStyle = async (req, res) => {
  try {
    const collarStyle = await CollarStyle.findOneAndDelete({ _id: req.params.id, website: req.websiteId });
    if (!collarStyle) {
      return res.status(404).json({ msg: 'Collar style not found' });
    }
    
    res.json({ msg: 'Collar style permanently deleted' });
  } catch (error) {
    console.error('Error deleting collar style:', error);
    res.status(500).json({ msg: 'Failed to delete collar style' });
  }
};

// Revert deleted collar style
export const revertCollarStyle = async (req, res) => {
  try {
    const collarStyle = await CollarStyle.findOne({ _id: req.params.id, website: req.websiteId });
    if (!collarStyle) {
      return res.status(404).json({ msg: 'Collar style not found' });
    }

    if (!collarStyle.deleted) {
      return res.status(400).json({ msg: 'Collar style is not deleted' });
    }

    // Check if there's already an active or inactive collar style with the same name
    const existingCollarStyle = await CollarStyle.findOne({ 
      _id: { $ne: req.params.id },
      name: { $regex: new RegExp(`^${collarStyle.name.trim()}$`, 'i') },
      deleted: { $ne: true }
    });

    if (existingCollarStyle) {
      const status = existingCollarStyle.isActive ? 'Active' : 'Inactive';
      return res.status(400).json({ 
        msg: `Cannot restore collar style. A ${status.toLowerCase()} collar style with this name already exists.` 
      });
    }

    // Revert: mark as not deleted and active
    collarStyle.deleted = false;
    collarStyle.isActive = true;
    await collarStyle.save();
    
    res.json({ msg: 'Collar style restored successfully' });
  } catch (error) {
    console.error('Error restoring collar style:', error);
    res.status(500).json({ msg: 'Failed to restore collar style' });
  }
}; 