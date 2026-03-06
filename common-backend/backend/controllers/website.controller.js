import Website from '../models/website.model.js';

// Get all websites
export const getWebsites = async (req, res) => {
  try {
    const { search, showInactive = 'true', includeDeleted = 'true' } = req.query;
    let query = {};

    if (includeDeleted === 'false') {
      query.deleted = false;
    }

    if (showInactive === 'false') {
      query.isActive = true;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { domain: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    const websites = await Website.find(query).sort({ name: 1 });
    res.json(websites);
  } catch (error) {
    console.error('Error fetching websites:', error);
    res.status(500).json({ msg: 'Failed to fetch websites' });
  }
};

// Get single website by ID
export const getWebsiteById = async (req, res) => {
  try {
    const website = await Website.findById(req.params.id);
    if (!website) {
      return res.status(404).json({ msg: 'Website not found' });
    }
    res.json(website);
  } catch (error) {
    console.error('Error fetching website:', error);
    res.status(500).json({ msg: 'Failed to fetch website' });
  }
};

// Get website by domain
export const getWebsiteByDomain = async (req, res) => {
  try {
    const { domain } = req.params;
    const website = await Website.findOne({ 
      domain: domain.toLowerCase().trim(),
      deleted: false,
      isActive: true
    });
    
    if (!website) {
      return res.status(404).json({ msg: 'Website not found' });
    }
    
    res.json(website);
  } catch (error) {
    console.error('Error fetching website by domain:', error);
    res.status(500).json({ msg: 'Failed to fetch website' });
  }
};

// Create new website
export const createWebsite = async (req, res) => {
  try {
    const { name, domain, description, isActive = true } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ msg: 'Website name is required' });
    }

    if (!domain || !domain.trim()) {
      return res.status(400).json({ msg: 'Domain is required' });
    }

    // Convert string "true"/"false" to boolean (for FormData)
    let isActiveValue = true;
    if (typeof isActive === 'string') {
      isActiveValue = isActive === 'true';
    } else {
      isActiveValue = Boolean(isActive);
    }

    // Normalize domain (lowercase, trim)
    const normalizedDomain = domain.trim().toLowerCase();

    // Check if domain already exists (non-deleted)
    const existingWebsite = await Website.findOne({ 
      domain: normalizedDomain,
      deleted: false
    });

    if (existingWebsite) {
      return res.status(400).json({ msg: 'Domain already exists' });
    }

    const website = new Website({
      name: name.trim(),
      domain: normalizedDomain,
      description: description?.trim() || null,
      isActive: isActiveValue,
    });

    const savedWebsite = await website.save();
    res.status(201).json(savedWebsite);
  } catch (error) {
    console.error('Error creating website:', error);
    if (error.code === 11000) {
      return res.status(400).json({ msg: 'Domain already exists' });
    }
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors)
        .map((err) => err.message)
        .join(', ');
      return res.status(400).json({ msg: `Validation error: ${validationErrors}` });
    }
    res.status(500).json({ msg: 'Failed to create website', error: error.message });
  }
};

// Update website
export const updateWebsite = async (req, res) => {
  try {
    const { name, domain, description, isActive, deleted } = req.body;

    const website = await Website.findById(req.params.id);
    if (!website) {
      return res.status(404).json({ msg: 'Website not found' });
    }

    // Update fields
    if (name !== undefined && name.trim() !== website.name) {
      website.name = name.trim();
    }

    if (domain !== undefined && domain.trim().toLowerCase() !== website.domain) {
      const normalizedDomain = domain.trim().toLowerCase();
      
      // Check if new domain already exists (excluding current website)
      const existingWebsite = await Website.findOne({ 
        _id: { $ne: req.params.id },
        domain: normalizedDomain,
        deleted: false
      });

      if (existingWebsite) {
        return res.status(400).json({ msg: 'Domain already exists' });
      }

      website.domain = normalizedDomain;
    }

    if (description !== undefined) {
      website.description = description?.trim() || null;
    }

    if (isActive !== undefined) {
      if (typeof isActive === 'string') {
        website.isActive = isActive === 'true';
      } else {
        website.isActive = Boolean(isActive);
      }
    }

    if (deleted !== undefined) {
      if (typeof deleted === 'string') {
        website.deleted = deleted === 'true';
      } else {
        website.deleted = Boolean(deleted);
      }
    }

    const updatedWebsite = await website.save();
    res.json(updatedWebsite);
  } catch (error) {
    console.error('Error updating website:', error);
    if (error.code === 11000) {
      return res.status(400).json({ msg: 'Domain already exists' });
    }
    res.status(500).json({ msg: 'Failed to update website', error: error.message });
  }
};

// Delete website (soft delete)
export const deleteWebsite = async (req, res) => {
  try {
    const website = await Website.findById(req.params.id);
    if (!website) {
      return res.status(404).json({ msg: 'Website not found' });
    }

    website.isActive = false;
    website.deleted = true;
    await website.save();

    res.json({ msg: 'Website deleted successfully' });
  } catch (error) {
    console.error('Error deleting website:', error);
    res.status(500).json({ msg: 'Failed to delete website' });
  }
};

// Hard delete website
export const hardDeleteWebsite = async (req, res) => {
  try {
    const website = await Website.findByIdAndDelete(req.params.id);
    if (!website) {
      return res.status(404).json({ msg: 'Website not found' });
    }

    res.json({ msg: 'Website permanently deleted' });
  } catch (error) {
    console.error('Error deleting website:', error);
    res.status(500).json({ msg: 'Failed to delete website' });
  }
};
