import Pattern from "../models/pattern.model.js"
import { uploadLocalFileToCloudinary, removeLocalFiles } from "../utils/cloudinaryUpload.js"

// Get all patterns
export const getPatterns = async (req, res) => {
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
    
    const patterns = await Pattern.find(query).sort({ createdAt: -1 });
    res.json(patterns);
  } catch (error) {
    console.error('Error fetching patterns:', error);
    res.status(500).json({ msg: 'Failed to fetch patterns' });
  }
};

// Get single pattern by ID
export const getPatternById = async (req, res) => {
  try {
    // Multi-tenant: Require website context
    if (!req.websiteId) {
      return res.status(400).json({ msg: 'Website context is missing' });
    }

    const pattern = await Pattern.findOne({ _id: req.params.id, website: req.websiteId });
    if (!pattern) {
      return res.status(404).json({ msg: 'Pattern not found' });
    }
    res.json(pattern);
  } catch (error) {
    console.error('Error fetching pattern:', error);
    res.status(500).json({ msg: 'Failed to fetch pattern' });
  }
};

// Create new pattern
export const createPattern = async (req, res) => {
  try {
    // Multi-tenant: Require website context
    if (!req.websiteId) {
      return res.status(400).json({ msg: 'Website context is missing. Please select a website first.' });
    }

    const { name, description, isActive } = req.body;
    
    if (!name) {
      return res.status(400).json({ msg: 'Pattern name is required' });
    }

    // Check if pattern with same name already exists within the same website (non-deleted)
    const existingPattern = await Pattern.findOne({ 
      name: name.trim(),
      website: req.websiteId,
      deleted: false 
    });
    if (existingPattern) {
      return res.status(400).json({ msg: 'Pattern name already exists' });
    }

    let image = null
    if (req.file) {
      try {
        image = await uploadLocalFileToCloudinary(req.file.path, { folder: "photuprint/patterns" })
        console.log("Image uploaded to Cloudinary:", image)
      } catch (uploadError) {
        console.error("Cloudinary upload failed:", uploadError)
        removeLocalFiles([req.file])
        return res.status(503).json({ msg: uploadError.message || "Image upload failed. Configure Cloudinary." })
      }
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

    const pattern = new Pattern({
      name: name.trim(),
      description: description?.trim() || '',
      image,
      isActive: isActiveValue,
      website: req.websiteId // Multi-tenant: Set website
    });

    const savedPattern = await pattern.save();
    res.status(201).json(savedPattern);
  } catch (error) {
    console.error('Error creating pattern:', error);
    if (error.code === 11000) {
      return res.status(400).json({ msg: 'Pattern name already exists' });
    }
    res.status(500).json({ msg: `Failed to create pattern: ${error.message || error}` });
  }
};

// Update pattern
export const updatePattern = async (req, res) => {
  try {
    // Multi-tenant: Require website context
    if (!req.websiteId) {
      return res.status(400).json({ msg: 'Website context is missing. Please select a website first.' });
    }

    const { name, description, isActive, deleted } = req.body;
    
    // Check if pattern exists within the same website
    const pattern = await Pattern.findOne({ _id: req.params.id, website: req.websiteId });
    if (!pattern) {
      return res.status(404).json({ msg: 'Pattern not found' });
    }

    // Check for duplicate names within the same website (excluding current pattern, only non-deleted)
    if (name && name.trim() !== pattern.name) {
      const existingPattern = await Pattern.findOne({ 
        _id: { $ne: req.params.id },
        name: name.trim(),
        website: req.websiteId,
        deleted: false 
      });
      if (existingPattern) {
        return res.status(400).json({ msg: 'Pattern name already exists' });
      }
    }

    if (req.file) {
      try {
        pattern.image = await uploadLocalFileToCloudinary(req.file.path, { folder: "photuprint/patterns" })
        console.log("Image updated in Cloudinary:", pattern.image)
      } catch (uploadError) {
        console.error("Cloudinary upload failed:", uploadError)
        removeLocalFiles([req.file])
        return res.status(503).json({ msg: uploadError.message || "Image upload failed. Configure Cloudinary." })
      }
    }

    // Update fields
    if (name !== undefined) pattern.name = name.trim();
    if (description !== undefined) pattern.description = description.trim() || '';
    if (isActive !== undefined) {
      // Parse isActive - it might come as string 'true'/'false' from FormData
      if (typeof isActive === 'string') {
        pattern.isActive = isActive === 'true';
      } else {
        pattern.isActive = Boolean(isActive);
      }
    }
    if (deleted !== undefined) {
      // Parse deleted - it might come as string from FormData
      if (typeof deleted === 'string') {
        pattern.deleted = deleted === 'true';
      } else {
        pattern.deleted = Boolean(deleted);
      }
    }

    const updatedPattern = await pattern.save();
    res.json(updatedPattern);
  } catch (error) {
    console.error('Error updating pattern:', error);
    if (error.code === 11000) {
      return res.status(400).json({ msg: 'Pattern name already exists' });
    }
    res.status(500).json({ msg: 'Failed to update pattern' });
  }
};

// Delete pattern (soft delete)
export const deletePattern = async (req, res) => {
  try {
    // Multi-tenant: Require website context
    if (!req.websiteId) {
      return res.status(400).json({ msg: 'Website context is missing. Please select a website first.' });
    }

    const pattern = await Pattern.findOne({ _id: req.params.id, website: req.websiteId });
    if (!pattern) {
      return res.status(404).json({ msg: 'Pattern not found' });
    }

    pattern.isActive = false;
    pattern.deleted = true;
    await pattern.save();
    
    res.json({ msg: 'Pattern deleted successfully' });
  } catch (error) {
    console.error('Error deleting pattern:', error);
    res.status(500).json({ msg: 'Failed to delete pattern' });
  }
};

// Hard delete pattern
export const hardDeletePattern = async (req, res) => {
  try {
    // Multi-tenant: Require website context
    if (!req.websiteId) {
      return res.status(400).json({ msg: 'Website context is missing. Please select a website first.' });
    }

    const pattern = await Pattern.findOneAndDelete({ _id: req.params.id, website: req.websiteId });
    if (!pattern) {
      return res.status(404).json({ msg: 'Pattern not found' });
    }
    
    res.json({ msg: 'Pattern permanently deleted' });
  } catch (error) {
    console.error('Error deleting pattern:', error);
    res.status(500).json({ msg: 'Failed to delete pattern' });
  }
};
