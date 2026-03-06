import Country from '../models/country.model.js';

// Get all countries
export const getCountries = async (req, res) => {
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
    
    // Always include deleted countries by default, but allow filtering
    if (includeDeleted === 'false') {
      query.deleted = false;
    }
    
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } }
      ];
    }
    
    const countries = await Country.find(query).sort({ createdAt: -1 });
    res.json(countries);
  } catch (error) {
    console.error('Error fetching countries:', error);
    res.status(500).json({ msg: 'Failed to fetch countries' });
  }
};

// Get single country by ID
export const getCountryById = async (req, res) => {
  try {
    // Multi-tenant: Filter by website
    if (!req.websiteId) {
      return res.status(400).json({ msg: 'Website context is missing' });
    }
const country = await Country.findOne({ _id: req.params.id, website: req.websiteId });
    if (!country) {
      return res.status(404).json({ msg: 'Country not found' });
    }
    res.json(country);
  } catch (error) {
    console.error('Error fetching country:', error);
    res.status(500).json({ msg: 'Failed to fetch country' });
  }
};

// Create new country
export const createCountry = async (req, res) => {
  try {
    const { name, code, description } = req.body;
    let { isActive = true } = req.body;
    
    // Convert string "true"/"false" to boolean (for FormData)
    if (typeof isActive === 'string') {
      isActive = isActive === 'true';
    }
    
    if (!name || !name.trim()) {
      return res.status(400).json({ msg: 'Country name is required' });
    }

    if (!code || !code.trim()) {
      return res.status(400).json({ msg: 'Country code is required' });
    }

    // Check for duplicate names (case-insensitive) within the same website
    const existingCountryByName = await Country.findOne({ 
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
      website: req.websiteId,
      deleted: false
    });
    
    if (existingCountryByName) {
      return res.status(400).json({ msg: 'Country name already exists' });
    }

    // Check for duplicate codes (case-insensitive) within the same website
    const existingCountryByCode = await Country.findOne({ 
      code: { $regex: new RegExp(`^${code.trim().toUpperCase()}$`, 'i') },
      website: req.websiteId,
      deleted: false
    });
    
    if (existingCountryByCode) {
      return res.status(400).json({ msg: 'Country code already exists' });
    }

    const country = new Country({
      name: name.trim(),
      code: code.trim().toUpperCase(),
      description: description?.trim() || null,
      isActive,
      website: req.websiteId // Multi-tenant: Set website
    });

    const savedCountry = await country.save();
    res.status(201).json(savedCountry);
  } catch (error) {
    console.error('Error creating country:', error);
    if (error.code === 11000) {
      res.status(400).json({ msg: 'Country name or code already exists' });
    } else {
      res.status(500).json({ msg: 'Failed to create country' });
    }
  }
};

// Update country
export const updateCountry = async (req, res) => {
  try {
    const { name, code, description } = req.body;
    let { isActive, deleted } = req.body;
    
    // Convert string "true"/"false" to boolean (for FormData)
    if (typeof isActive === 'string') {
      isActive = isActive === 'true';
    }
    if (typeof deleted === 'string') {
      deleted = deleted === 'true';
    }
    
    const country = await Country.findOne({ _id: req.params.id, website: req.websiteId });
    if (!country) {
      return res.status(404).json({ msg: 'Country not found' });
    }

    // Check for duplicate names (case-insensitive) if name is being changed within the same website
    if (name && name.trim() !== country.name) {
      const existingCountryByName = await Country.findOne({ 
        name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
        _id: { $ne: req.params.id },
        website: req.websiteId,
        deleted: false
      });
      
      if (existingCountryByName) {
        return res.status(400).json({ msg: 'Country name already exists' });
      }
    }

    // Check for duplicate codes (case-insensitive) if code is being changed within the same website
    if (code && code.trim().toUpperCase() !== country.code) {
      const existingCountryByCode = await Country.findOne({ 
        code: { $regex: new RegExp(`^${code.trim().toUpperCase()}$`, 'i') },
        _id: { $ne: req.params.id },
        website: req.websiteId,
        deleted: false
      });
      
      if (existingCountryByCode) {
        return res.status(400).json({ msg: 'Country code already exists' });
      }
    }

    // Update fields
    if (name && name.trim() !== country.name) {
      country.name = name.trim();
    }
    
    if (code && code.trim().toUpperCase() !== country.code) {
      country.code = code.trim().toUpperCase();
    }
    
    if (description !== undefined) {
      country.description = description?.trim() || null;
    }
    
    if (isActive !== undefined) {
      country.isActive = isActive;
    }

    // Handle deleted field update (for reverting deleted countries)
    if (req.body.deleted !== undefined) {
      country.deleted = req.body.deleted;
    }

    const updatedCountry = await country.save();
    res.json(updatedCountry);
  } catch (error) {
    console.error('Error updating country:', error);
    if (error.code === 11000) {
      res.status(400).json({ msg: 'Country name or code already exists' });
    } else {
      res.status(500).json({ msg: 'Failed to update country' });
    }
  }
};

// Delete country (soft delete)
export const deleteCountry = async (req, res) => {
  try {
    const country = await Country.findOne({ _id: req.params.id, website: req.websiteId });
    if (!country) {
      return res.status(404).json({ msg: 'Country not found' });
    }

    // Soft delete: mark as inactive and set deleted flag
    country.isActive = false;
    country.deleted = true;
    await country.save();
    
    res.json({ msg: 'Country deleted successfully' });
  } catch (error) {
    console.error('Error deleting country:', error);
    res.status(500).json({ msg: 'Failed to delete country' });
  }
};

// Hard delete country
export const hardDeleteCountry = async (req, res) => {
  try {
    const country = await Country.findOneAndDelete({ _id: req.params.id, website: req.websiteId });
    if (!country) {
      return res.status(404).json({ msg: 'Country not found' });
    }
    
    res.json({ msg: 'Country permanently deleted' });
  } catch (error) {
    console.error('Error deleting country:', error);
    res.status(500).json({ msg: 'Failed to delete country' });
  }
};
