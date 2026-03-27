import Material from '../models/material.model.js';
import { tenantCloudinaryUpload } from '../utils/cloudinary.js';

// Get all materials
export const getMaterials = async (req, res) => {
  try {
    // Multi-tenant: Require website context
    if (!req.websiteId) {
      return res.status(400).json({ msg: 'Website context is missing' });
    }

    const { category, search, showInactive, includeDeleted } = req.query;
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
    
    if (category) {
      query.category = category;
    }
    
    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }
    
    const materials = await Material.find(query).sort({ createdAt: -1 });
    res.json(materials);
  } catch (error) {
    console.error('Error fetching materials:', error);
    res.status(500).json({ msg: 'Failed to fetch materials' });
  }
};

// Get single material by ID
export const getMaterialById = async (req, res) => {
  try {
    // Multi-tenant: Require website context
    if (!req.websiteId) {
      return res.status(400).json({ msg: 'Website context is missing' });
    }

    const material = await Material.findOne({ _id: req.params.id, website: req.websiteId });
    if (!material) {
      return res.status(404).json({ msg: 'Material not found' });
    }
    res.json(material);
  } catch (error) {
    console.error('Error fetching material:', error);
    res.status(500).json({ msg: 'Failed to fetch material' });
  }
};

// Create new material
export const createMaterial = async (req, res) => {
  try {
    // Multi-tenant: Require website context
    if (!req.websiteId) {
      return res.status(400).json({ msg: 'Website context is missing. Please select a website first.' });
    }

    const { type, name, description, category, properties, isActive } = req.body;
    
    if (!type || !name) {
      return res.status(400).json({ msg: 'Material type and name are required' });
    }

    // Check if material with same name already exists within the same website (non-deleted)
    const existingMaterial = await Material.findOne({ 
      name: name.trim(), 
      website: req.websiteId,
      deleted: false 
    });
    if (existingMaterial) {
      return res.status(400).json({ msg: 'Material name already exists' });
    }

    // Handle image upload if present
    let image = null;
    if (req.file) {
      image = await tenantCloudinaryUpload(req.websiteId, req.file, { folder: 'photuprint/materials' });
    }

    // Parse isActive - it might come as string 'true'/'false' from FormData
    let isActiveValue = true;
    if (isActive !== undefined) {
      if (typeof isActive === 'string') {
        isActiveValue = isActive === 'true';
      } else {
        isActiveValue = Boolean(isActive);
      }
    }

    const material = new Material({
      type: type.trim(),
      name: name.trim(),
      description: description?.trim() || '',
      image,
      category: category || null,
      properties: properties ? (typeof properties === 'string' ? JSON.parse(properties) : properties) : [],
      isActive: isActiveValue,
      website: req.websiteId // Multi-tenant: Set website
    });

    const savedMaterial = await material.save();
    res.status(201).json(savedMaterial);
  } catch (error) {
    console.error('Error creating material:', error);
    if (error.code === 11000) {
      return res.status(400).json({ msg: 'Material name already exists' });
    }
    res.status(500).json({ msg: `Failed to create material: ${error.message || error}` });
  }
};

// Update material
export const updateMaterial = async (req, res) => {
  try {
    // Multi-tenant: Require website context
    if (!req.websiteId) {
      return res.status(400).json({ msg: 'Website context is missing. Please select a website first.' });
    }

    const { type, name, description, category, properties, isActive, deleted } = req.body;
    
    // Check if material exists within the same website
    const material = await Material.findOne({ _id: req.params.id, website: req.websiteId });
    if (!material) {
      return res.status(404).json({ msg: 'Material not found' });
    }

    // Check for duplicate names within the same website (excluding current material, only non-deleted)
    if (name && name.trim() !== material.name) {
      const existingMaterial = await Material.findOne({ 
        _id: { $ne: req.params.id },
        name: name.trim(),
        website: req.websiteId,
        deleted: false 
      });
      if (existingMaterial) {
        return res.status(400).json({ msg: 'Material name already exists' });
      }
    }

    // Handle image upload if present
    if (req.file) {
      material.image = await tenantCloudinaryUpload(req.websiteId, req.file, { folder: 'photuprint/materials' });
    }

    // Update fields
    if (type !== undefined) material.type = type.trim();
    if (name !== undefined) material.name = name.trim();
    if (description !== undefined) material.description = description.trim() || '';
    if (category !== undefined) material.category = category || null;
    if (properties !== undefined) {
      material.properties = typeof properties === 'string' ? JSON.parse(properties) : properties;
    }
    if (isActive !== undefined) {
      // Parse isActive - it might come as string 'true'/'false' from FormData
      if (typeof isActive === 'string') {
        material.isActive = isActive === 'true';
      } else {
        material.isActive = Boolean(isActive);
      }
    }
    if (deleted !== undefined) {
      // Parse deleted - it might come as string from FormData
      if (typeof deleted === 'string') {
        material.deleted = deleted === 'true';
      } else {
        material.deleted = Boolean(deleted);
      }
    }

    const updatedMaterial = await material.save();
    res.json(updatedMaterial);
  } catch (error) {
    console.error('Error updating material:', error);
    if (error.code === 11000) {
      return res.status(400).json({ msg: 'Material name already exists' });
    }
    res.status(500).json({ msg: 'Failed to update material' });
  }
};

// Delete material (soft delete)
export const deleteMaterial = async (req, res) => {
  try {
    // Multi-tenant: Require website context
    if (!req.websiteId) {
      return res.status(400).json({ msg: 'Website context is missing. Please select a website first.' });
    }

    const material = await Material.findOne({ _id: req.params.id, website: req.websiteId });
    if (!material) {
      return res.status(404).json({ msg: 'Material not found' });
    }

    material.isActive = false;
    material.deleted = true;
    await material.save();
    
    res.json({ msg: 'Material deleted successfully' });
  } catch (error) {
    console.error('Error deleting material:', error);
    res.status(500).json({ msg: 'Failed to delete material' });
  }
};

// Hard delete material
export const hardDeleteMaterial = async (req, res) => {
  try {
    // Multi-tenant: Require website context
    if (!req.websiteId) {
      return res.status(400).json({ msg: 'Website context is missing. Please select a website first.' });
    }

    const material = await Material.findOneAndDelete({ _id: req.params.id, website: req.websiteId });
    if (!material) {
      return res.status(404).json({ msg: 'Material not found' });
    }
    
    res.json({ msg: 'Material permanently deleted' });
  } catch (error) {
    console.error('Error deleting material:', error);
    res.status(500).json({ msg: 'Failed to delete material' });
  }
};
