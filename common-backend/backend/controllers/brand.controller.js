import Brand from '../models/brand.model.js';
import { tenantCloudinaryUpload } from '../utils/cloudinary.js';

// Get all brands
export const getBrands = async (req, res) => {
  try {
    // Multi-tenant: Filter by website
    if (!req.websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }

    const { showInactive, includeDeleted = 'true' } = req.query;
    let query = {
      website: req.websiteId, // Filter by tenant website
    };
    
    // Always include deleted brands by default, but allow filtering
    if (includeDeleted === 'false') {
      query.deleted = false;
    }
    
    // If showInactive is not explicitly set to 'true', only show active brands
    if (showInactive !== 'true') {
      query.isActive = true;
    }
    
    const brands = await Brand.find(query).sort({ createdAt: -1 });
    res.json(brands);
  } catch (error) {
    res.status(500).json({ msg: 'Failed to fetch brands' });
  }
};

// Get single brand by ID
export const getBrandById = async (req, res) => {
  try {
    // Multi-tenant: Filter by website
    if (!req.websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }

    const brand = await Brand.findOne({ _id: req.params.id, website: req.websiteId });
    if (!brand) {
      return res.status(404).json({ msg: 'Brand not found' });
    }
    res.json(brand);
  } catch (error) {
    res.status(500).json({ msg: 'Failed to fetch brand' });
  }
};

// Create new brand
export const createBrand = async (req, res) => {
  try {
    // Multi-tenant: Validate website context
    if (!req.websiteId) {
      console.error('Brand creation failed: No websiteId in request');
      return res.status(400).json({ msg: "Website context is required" })
    }

    const { name, gstNo, companyName, address, isActive } = req.body;
    
    // Validate required fields
    if (!name || !name.trim()) {
      return res.status(400).json({ msg: 'Brand name is required' });
    }
    
    // Check if brand with same name already exists in the same website (case-insensitive, non-deleted)
    const trimmedName = name.trim();
    const existingBrand = await Brand.findOne({ 
      name: { $regex: new RegExp(`^${trimmedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }, // Case-insensitive, escape special regex chars
      website: req.websiteId,
      deleted: false // Only check against non-deleted brands
    });
    
    if (existingBrand) {
      return res.status(400).json({ 
        msg: `Brand name "${existingBrand.name}" already exists for this website`
      });
    }

    // Check if GST number already exists in the same website (only if GST is provided)
    if (gstNo && gstNo.trim()) {
      const existingGSTBrand = await Brand.findOne({ 
        gstNo: gstNo.trim(),
        website: req.websiteId
      });
      
      if (existingGSTBrand) {
        return res.status(400).json({ 
          msg: 'GST number already exists'
        });
      }
    }

    // Auto-generate Brand ID with format PPSBDNM1001, PPSBDNM1002, etc.
    let brandId;
    let counter = 1001;
    
    do {
      brandId = `PPSBDNM${counter}`;
      const existingBrandId = await Brand.findOne({ 
        brandId: brandId,
        website: req.websiteId
      });
      if (!existingBrandId) {
        break;
      }
      counter++;
    } while (true);

    // Handle logo upload if present
    let logo = null;
    if (req.file) {
      logo = await tenantCloudinaryUpload(req.websiteId, req.file, { folder: 'photuprint/brands' });
    }

    const brand = new Brand({
      brandId,
      name,
      logo,
      gstNo,
      companyName,
      address,
      isActive: isActive === 'true' || isActive === true,
      website: req.websiteId // Multi-tenant: Set website
    });

    const savedBrand = await brand.save();
    res.status(201).json(savedBrand);
  } catch (error) {
    console.error('Error creating brand:', error);
    console.error('Error stack:', error.stack);
    console.error('Request body:', req.body);
    console.error('Website ID:', req.websiteId);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(e => e.message).join(', ');
      return res.status(400).json({ 
        msg: `Validation error: ${errors}`,
        errors: process.env.NODE_ENV === 'development' ? error.errors : undefined
      });
    }
    
    // Handle duplicate key errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({ 
        msg: `${field} already exists`
      });
    }
    
    res.status(500).json({ 
      msg: 'Failed to create brand',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Update brand
export const updateBrand = async (req, res) => {
  try {
    // Multi-tenant: Validate website context
    if (!req.websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }

    const { name, gstNo, companyName, address, isActive } = req.body;
    // Check if brand exists and belongs to the website
    const brand = await Brand.findOne({ _id: req.params.id, website: req.websiteId });
    if (!brand) {
      return res.status(404).json({ msg: 'Brand not found' });
    }

    // Check for duplicate names in the same website (excluding current brand, non-deleted, case-insensitive)
    const trimmedName = name.trim();
    if (trimmedName.toLowerCase() !== brand.name.toLowerCase()) {
      const existingBrand = await Brand.findOne({
        _id: { $ne: req.params.id },
        name: { $regex: new RegExp(`^${trimmedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }, // Case-insensitive, escape special regex chars
        deleted: false,
        website: req.websiteId
      });
      
      if (existingBrand) {
        return res.status(400).json({ 
          msg: `Brand name "${existingBrand.name}" already exists for this website`
        });
      }
    }

    // Check if GST number already exists in the same website (only if GST is provided and different from current)
    if (gstNo && gstNo.trim() && gstNo.trim() !== brand.gstNo) {
      const existingGSTBrand = await Brand.findOne({
        $and: [
          { _id: { $ne: req.params.id } },
          { gstNo: gstNo.trim() },
          { website: req.websiteId }
        ]
      });
      
      if (existingGSTBrand) {
        return res.status(400).json({ 
          msg: 'GST number already exists'
        });
      }
    }

    // Handle logo upload if present
    if (req.file) {
      brand.logo = await tenantCloudinaryUpload(req.websiteId, req.file, { folder: 'photuprint/brands' });
    }

    // Update fields (brandId cannot be changed as it's auto-generated)
    brand.name = name || brand.name;
    brand.gstNo = gstNo || brand.gstNo;
    brand.companyName = companyName || brand.companyName;
    brand.address = address || brand.address;
    
    // Update isActive field if provided
    if (isActive !== undefined) {
      // Handle both boolean and string values from FormData
      if (typeof isActive === 'boolean') {
        brand.isActive = isActive;
      } else if (typeof isActive === 'string') {
        brand.isActive = isActive === 'true';
      }
    }

    // Handle deleted field update (for reverting deleted brands)
    if (req.body.deleted !== undefined) {
      brand.deleted = req.body.deleted;
    }

    const updatedBrand = await brand.save();
    
    res.json(updatedBrand);
  } catch (error) {
    res.status(500).json({ msg: 'Failed to update brand' });
  }
};

// Delete brand (soft delete)
export const deleteBrand = async (req, res) => {
  try {
    // Multi-tenant: Validate website context
    if (!req.websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }

    const brand = await Brand.findOne({ _id: req.params.id, website: req.websiteId });
    if (!brand) {
      return res.status(404).json({ msg: 'Brand not found' });
    }

    // Soft delete: mark as inactive and set deleted flag
    brand.isActive = false;
    brand.deleted = true;
    await brand.save();
    
    res.json({ msg: 'Brand deleted successfully' });
  } catch (error) {
    res.status(500).json({ msg: 'Failed to delete brand' });
  }
};

// Hard delete brand
export const hardDeleteBrand = async (req, res) => {
  try {
    // Multi-tenant: Validate website context
    if (!req.websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }

    const brand = await Brand.findOneAndDelete({ _id: req.params.id, website: req.websiteId });
    if (!brand) {
      return res.status(404).json({ msg: 'Brand not found' });
    }
    
    res.json({ msg: 'Brand permanently deleted' });
  } catch (error) {
    res.status(500).json({ msg: 'Failed to delete brand' });
  }
}; 