import Company from '../models/company.model.js';
import Website from '../models/website.model.js';
import { removeLocalFile } from '../utils/fileCleanup.js';

// Get all companies
export const getCompanies = async (req, res) => {
  try {
    // Multi-tenant: Ensure website context is available
    if (!req.websiteId) {
      return res.status(400).json({ msg: 'Website context is missing' });
    }

    const { search, isActive, showInactive = 'true', includeDeleted = 'true' } = req.query;
    let query = {
      website: req.websiteId, // Filter by tenant website
    };

    // Always include deleted companies by default, but allow filtering
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
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { gstNumber: { $regex: search, $options: 'i' } },
        { panNumber: { $regex: search, $options: 'i' } },
        { 'address.city': { $regex: search, $options: 'i' } },
        { 'address.state': { $regex: search, $options: 'i' } },
      ];
    }

    const companies = await Company.find(query).sort({ isDefault: -1, createdAt: -1 });
    res.json(companies);
  } catch (error) {
    console.error('Error fetching companies:', error);
    res.status(500).json({ msg: 'Failed to fetch companies' });
  }
};

// Get default/active company (for invoices and shipping labels)
export const getDefaultCompany = async (req, res) => {
  try {
    // Multi-tenant: Use req.websiteId for CMS, or query params for storefront
    const websiteId = req.websiteId || req.query.website;
    const { domain } = req.query;
    
    let query = { 
      isDefault: true, 
      isActive: true, 
      deleted: false 
    };

    // If website ID is available (from header or query), filter by website
    if (websiteId) {
      query.website = websiteId;
    }
    // If domain is provided, filter by domain
    else if (domain) {
      query.domain = domain.toLowerCase().trim();
    } else if (!req.websiteId) {
      // For storefront, domain should be resolved by middleware
      // If neither websiteId nor domain is available, return error
      return res.status(400).json({ msg: 'Website context is missing' });
    }

    const company = await Company.findOne(query).populate('website', 'name domain');
    
    if (!company) {
      // Fallback: try to find any active company for this website/domain
      const fallbackQuery = { 
        isActive: true, 
        deleted: false 
      };
      
      if (websiteId) {
        fallbackQuery.website = websiteId;
      } else if (domain) {
        fallbackQuery.domain = domain.toLowerCase().trim();
      }
      
      const fallbackCompany = await Company.findOne(fallbackQuery)
        .populate('website', 'name domain')
        .sort({ createdAt: -1 });
      
      if (fallbackCompany) {
        return res.json(fallbackCompany);
      }
      
      // Final fallback: any active company for this website (for backward compatibility)
      if (!websiteId && !domain) {
        // Only if no website context at all, try to find any company
        // This should rarely happen if middleware is working correctly
        const anyCompany = await Company.findOne({ 
          isActive: true, 
          deleted: false 
        })
        .populate('website', 'name domain')
        .sort({ createdAt: -1 });
        
        if (anyCompany) {
          return res.json(anyCompany);
        }
      }
      
      return res.status(404).json({ msg: 'No active company found for this website' });
    }
    
    res.json(company);
  } catch (error) {
    console.error('Error fetching default company:', error);
    res.status(500).json({ msg: 'Failed to fetch default company' });
  }
};

// Get single company by ID
export const getCompanyById = async (req, res) => {
  try {
    // Multi-tenant: Ensure website context is available
    if (!req.websiteId) {
      return res.status(400).json({ msg: 'Website context is missing' });
    }

    const company = await Company.findOne({ _id: req.params.id, website: req.websiteId });
    if (!company) {
      return res.status(404).json({ msg: 'Company not found' });
    }
    res.json(company);
  } catch (error) {
    console.error('Error fetching company:', error);
    res.status(500).json({ msg: 'Failed to fetch company' });
  }
};

// Create new company
export const createCompany = async (req, res) => {
  try {
    // Multi-tenant: Ensure website context is available
    if (!req.websiteId) {
      return res.status(400).json({ msg: 'Website context is missing' });
    }

    let { 
      name, 
      address, 
      phone, 
      email, 
      website: websiteUrl, // website URL field (legacy)
      websiteId, // website reference ID (new) - will be overridden by req.websiteId
      domain, // domain string (alternative to websiteId)
      gstNumber, 
      panNumber, 
      footerText,
      isActive = true,
      isDefault = false
    } = req.body;

    // Handle FormData nested address fields
    if (req.body['address[street]'] !== undefined) {
      address = {
        street: req.body['address[street]']?.trim() || null,
        city: req.body['address[city]']?.trim() || null,
        state: req.body['address[state]']?.trim() || null,
        zipCode: req.body['address[zipCode]']?.trim() || null,
        country: req.body['address[country]']?.trim() || null,
      };
    } else if (req.body.address && typeof req.body.address === 'object') {
      // Handle JSON address object
      address = {
        street: req.body.address.street?.trim() || null,
        city: req.body.address.city?.trim() || null,
        state: req.body.address.state?.trim() || null,
        zipCode: req.body.address.zipCode?.trim() || null,
        country: req.body.address.country?.trim() || null,
      };
    }

    if (!name || !name.trim()) {
      return res.status(400).json({ msg: 'Company name is required' });
    }

    // Convert string "true"/"false" to boolean (for FormData)
    let isActiveValue = true;
    if (typeof isActive === 'string') {
      isActiveValue = isActive === 'true';
    } else {
      isActiveValue = Boolean(isActive);
    }

    let isDefaultValue = false;
    if (typeof isDefault === 'string') {
      isDefaultValue = isDefault === 'true';
    } else {
      isDefaultValue = Boolean(isDefault);
    }

    // Use req.websiteId from middleware (tenant context)
    // This ensures strict tenant isolation
    const website = await Website.findById(req.websiteId);
    if (!website) {
      return res.status(400).json({ msg: 'Website not found' });
    }
    const websiteObjectId = website._id;
    const domainValue = website.domain;

    // If setting as default, unset other defaults for the same website/domain
    if (isDefaultValue) {
      const unsetQuery = { isDefault: true, deleted: false };
      if (websiteObjectId) {
        unsetQuery.website = websiteObjectId;
      } else if (domainValue) {
        unsetQuery.domain = domainValue;
      }
      await Company.updateMany(unsetQuery, { $set: { isDefault: false } });
    }

    // Handle logo upload
    let logoUrl = null;
    if (req.file) {
      try {
        // Upload to Cloudinary
        const cloudinary = (await import("../utils/cloudinary.js")).default;
        const result = await cloudinary.uploader.upload(req.file.path, {
          folder: "photuprint/company",
          resource_type: "auto",
        });
        logoUrl = result.secure_url;
        
        // Clean up temporary file after upload
        removeLocalFile(req.file.path);
      } catch (uploadError) {
        console.error("Cloudinary upload failed:", uploadError);
        // Fallback to local storage
        logoUrl = `/uploads/${req.file.filename}`;
      }
    }

    const company = new Company({
      name: name.trim(),
      address: address || {},
      phone: phone?.trim() || null,
      email: email?.trim() || null,
      websiteUrl: websiteUrl?.trim() || null, // website URL field (legacy)
      website: websiteObjectId || null, // website reference (ObjectId)
      domain: (domain?.trim().toLowerCase()) || domainValue || null,
      gstNumber: gstNumber?.trim() || null,
      panNumber: panNumber?.trim() || null,
      footerText: footerText?.trim() || null,
      logo: logoUrl,
      isActive: isActiveValue,
      isDefault: isDefaultValue,
    });

    const savedCompany = await company.save();
    res.status(201).json(savedCompany);
  } catch (error) {
    console.error('Error creating company:', error);
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors)
        .map((err) => err.message)
        .join(', ');
      return res.status(400).json({ msg: `Validation error: ${validationErrors}` });
    }
    res.status(500).json({ msg: 'Failed to create company', error: error.message });
  }
};

// Update company
export const updateCompany = async (req, res) => {
  try {
    // Multi-tenant: Ensure website context is available
    if (!req.websiteId) {
      return res.status(400).json({ msg: 'Website context is missing' });
    }

    let { 
      name, 
      address, 
      phone, 
      email, 
      websiteUrl, // website URL field (legacy)
      websiteId, // website reference ID (new) - will be overridden by req.websiteId
      domain, // domain string (alternative to websiteId)
      gstNumber, 
      panNumber, 
      footerText,
      isActive,
      isDefault,
      deleted
    } = req.body;

    // Handle FormData nested address fields
    if (req.body['address[street]'] !== undefined) {
      address = {
        street: req.body['address[street]']?.trim() || null,
        city: req.body['address[city]']?.trim() || null,
        state: req.body['address[state]']?.trim() || null,
        zipCode: req.body['address[zipCode]']?.trim() || null,
        country: req.body['address[country]']?.trim() || null,
      };
    } else if (req.body.address && typeof req.body.address === 'object') {
      // Handle JSON address object
      address = {
        street: req.body.address.street?.trim() || null,
        city: req.body.address.city?.trim() || null,
        state: req.body.address.state?.trim() || null,
        zipCode: req.body.address.zipCode?.trim() || null,
        country: req.body.address.country?.trim() || null,
      };
    }

    // Check if company exists and belongs to the same website
    const company = await Company.findOne({ _id: req.params.id, website: req.websiteId });
    if (!company) {
      return res.status(404).json({ msg: 'Company not found' });
    }

    // Use req.websiteId from middleware (tenant context)
    // Company website cannot be changed - it's tied to the tenant
    const website = await Website.findById(req.websiteId);
    if (!website) {
      return res.status(400).json({ msg: 'Website not found' });
    }
    const websiteObjectId = website._id;
    const domainValue = website.domain;

    // If setting as default, unset other defaults for the same website/domain
    if (isDefault !== undefined) {
      let isDefaultValue = false;
      if (typeof isDefault === 'string') {
        isDefaultValue = isDefault === 'true';
      } else {
        isDefaultValue = Boolean(isDefault);
      }

      if (isDefaultValue && !company.isDefault) {
        const unsetQuery = { 
          _id: { $ne: req.params.id }, 
          isDefault: true, 
          deleted: false 
        };
        if (websiteObjectId) {
          unsetQuery.website = websiteObjectId;
        } else if (domainValue) {
          unsetQuery.domain = domainValue;
        }
        await Company.updateMany(unsetQuery, { $set: { isDefault: false } });
      }
    }

    // Update fields
    if (name !== undefined && name.trim() !== company.name) {
      company.name = name.trim();
    }

    if (address !== undefined) {
      company.address = { ...company.address, ...address };
    }

    if (phone !== undefined) {
      company.phone = phone?.trim() || null;
    }

    if (email !== undefined) {
      company.email = email?.trim() || null;
    }

    if (websiteUrl !== undefined) {
      company.websiteUrl = websiteUrl?.trim() || null;
    }

    if (domain !== undefined) {
      company.domain = domain?.trim().toLowerCase() || null;
    }

    // Website is always set from req.websiteId (tenant context)
    // No need to update it as it's immutable per tenant

    if (gstNumber !== undefined) {
      company.gstNumber = gstNumber?.trim() || null;
    }

    if (panNumber !== undefined) {
      company.panNumber = panNumber?.trim() || null;
    }

    if (footerText !== undefined) {
      company.footerText = footerText?.trim() || null;
    }

    if (isDefault !== undefined) {
      if (typeof isDefault === 'string') {
        company.isDefault = isDefault === 'true';
      } else {
        company.isDefault = Boolean(isDefault);
      }
    }

    if (isActive !== undefined) {
      if (typeof isActive === 'string') {
        company.isActive = isActive === 'true';
      } else {
        company.isActive = Boolean(isActive);
      }
    }

    if (deleted !== undefined) {
      if (typeof deleted === 'string') {
        company.deleted = deleted === 'true';
      } else {
        company.deleted = Boolean(deleted);
      }
    }

    // Handle logo upload
    if (req.file) {
      try {
        // Upload to Cloudinary
        const cloudinary = (await import("../utils/cloudinary.js")).default;
        const result = await cloudinary.uploader.upload(req.file.path, {
          folder: "photuprint/company",
          resource_type: "auto",
        });
        company.logo = result.secure_url;
        
        // Clean up temporary file after upload
        removeLocalFile(req.file.path);
      } catch (uploadError) {
        console.error("Cloudinary upload failed:", uploadError);
        // Fallback to local storage
        company.logo = `/uploads/${req.file.filename}`;
      }
    }

    const updatedCompany = await company.save();
    res.json(updatedCompany);
  } catch (error) {
    console.error('Error updating company:', error);
    res.status(500).json({ msg: 'Failed to update company', error: error.message });
  }
};

// Delete company (soft delete)
export const deleteCompany = async (req, res) => {
  try {
    // Multi-tenant: Ensure website context is available
    if (!req.websiteId) {
      return res.status(400).json({ msg: 'Website context is missing' });
    }

    const company = await Company.findOne({ _id: req.params.id, website: req.websiteId });
    if (!company) {
      return res.status(404).json({ msg: 'Company not found' });
    }

    // Soft delete: mark as inactive and set deleted flag
    company.isActive = false;
    company.deleted = true;
    company.isDefault = false; // Can't be default if deleted
    await company.save();

    res.json({ msg: 'Company deleted successfully' });
  } catch (error) {
    console.error('Error deleting company:', error);
    res.status(500).json({ msg: 'Failed to delete company' });
  }
};

// Hard delete company
export const hardDeleteCompany = async (req, res) => {
  try {
    // Multi-tenant: Ensure website context is available
    if (!req.websiteId) {
      return res.status(400).json({ msg: 'Website context is missing' });
    }

    const company = await Company.findOneAndDelete({ _id: req.params.id, website: req.websiteId });
    if (!company) {
      return res.status(404).json({ msg: 'Company not found' });
    }

    res.json({ msg: 'Company permanently deleted' });
  } catch (error) {
    console.error('Error deleting company:', error);
    res.status(500).json({ msg: 'Failed to delete company' });
  }
};
