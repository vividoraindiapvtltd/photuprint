import Category from '../models/category.model.js';
import { removeLocalFile } from '../utils/fileCleanup.js';

// Get all categories
export const getCategories = async (req, res) => {
  try {
    // Multi-tenant: Filter by website
    if (!req.websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }

    const { search, isActive, includeDeleted = 'true' } = req.query;
    let query = {
      website: req.websiteId, // Filter by tenant website
    };
    
    // Always include deleted categories by default, but allow filtering
    if (includeDeleted === 'false') {
      query.deleted = false;
    }
    
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }
    
    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }
    
    const categories = await Category.find(query).sort({ createdAt: -1 });
    
    // Ensure all categories have a categoryId (migration for existing records)
    console.log('Starting category ID migration...');
    for (let category of categories) {
      console.log('Checking category:', category._id, 'categoryId:', category.categoryId);
      if (!category.categoryId) {
        try {
          console.log('Migrating category ID for:', category._id);
          // Find the highest existing category ID number within the same website
          const existingCategories = await Category.find({ 
            categoryId: { $exists: true, $ne: null },
            website: req.websiteId
          });
          let counter = 1001;
          
          if (existingCategories.length > 0) {
            const existingIds = existingCategories
              .map(cat => cat.categoryId)
              .filter(id => id && id.startsWith('PPSCATNM'))
              .map(id => {
                const match = id.match(/PPSCATNM(\d+)/);
                return match ? parseInt(match[1]) : 0;
              });
            
            if (existingIds.length > 0) {
              const maxNumber = Math.max(...existingIds);
              counter = maxNumber + 1;
            }
          }
          
          category.categoryId = `PPSCATNM${counter}`;
          console.log('Setting categoryId to:', category.categoryId);
          await category.save();
          console.log('Successfully migrated category ID for:', category._id);
        } catch (migrationError) {
          console.error('Error migrating category ID for category:', category._id, migrationError);
        }
      }
    }
    console.log('Category ID migration completed');
    
    res.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ msg: 'Failed to fetch categories' });
  }
};

// Get single category by ID
export const getCategoryById = async (req, res) => {
  try {
    // Multi-tenant: Filter by website
    if (!req.websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }

    const category = await Category.findOne({ _id: req.params.id, website: req.websiteId });
    if (!category) {
      return res.status(404).json({ msg: 'Category not found' });
    }
    res.json(category);
  } catch (error) {
    console.error('Error fetching category:', error);
    res.status(500).json({ msg: 'Failed to fetch category' });
  }
};

// Create new category
export const createCategory = async (req, res) => {
  try {
    // Multi-tenant: Validate website context
    if (!req.websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }

    console.log('Create category request body:', req.body);
    console.log('Uploaded file:', req.file);
    
    const { name, description } = req.body;
    let { isActive = true } = req.body;
    
    // Convert string "true"/"false" to boolean (for FormData)
    if (typeof isActive === 'string') {
      isActive = isActive === 'true';
    }
    
    console.log('Processed isActive value:', isActive, 'Type:', typeof isActive);
    
    if (!name || !name.trim()) {
      return res.status(400).json({ msg: 'Category name is required' });
    }

    // Check if category with same name already exists in the same website (case-insensitive, non-deleted)
    const existingCategory = await Category.findOne({ 
      name: { $regex: new RegExp(`^${name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }, // Case-insensitive, escape special regex chars
      website: req.websiteId,
      deleted: false // Only check against non-deleted categories
    });
    
    if (existingCategory) {
      return res.status(400).json({ msg: `Category name "${existingCategory.name}" already exists for this website` });
    }

    // Auto-generate Category ID with format PPSCATNM1001, PPSCATNM1002, etc.
    let categoryId;
    let counter = 1001;
    
    do {
      categoryId = `PPSCATNM${counter}`;
      const existingCategoryId = await Category.findOne({ 
        categoryId: categoryId,
        website: req.websiteId
      });
      if (!existingCategoryId) {
        break;
      }
      counter++;
    } while (true);

    // Generate slug from name
    const slug = name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^\w\-]+/g, '');

    // Handle image upload
    let imageUrl = null;
    if (req.file) {
      try {
        // Upload to Cloudinary
        const cloudinary = (await import('../utils/cloudinary.js')).default;
        const result = await cloudinary.uploader.upload(req.file.path, {
          folder: 'photuprint/categories',
        });
        imageUrl = result.secure_url;
        removeLocalFile(req.file.path);
        console.log('Image uploaded to Cloudinary:', imageUrl);
      } catch (uploadError) {
        console.error('Cloudinary upload failed:', uploadError);
        // Fallback to local storage
        imageUrl = `/uploads/${req.file.filename}`;
      }
    }

    const category = new Category({
      categoryId,
      name: name.trim(),
      slug,
      description: description?.trim() || null,
      image: imageUrl,
      isActive,
      website: req.websiteId // Multi-tenant: Set website
    });

    const savedCategory = await category.save();
    res.status(201).json(savedCategory);
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({ msg: 'Failed to create category' });
  }
};

// Update category
export const updateCategory = async (req, res) => {
  try {
    // Multi-tenant: Validate website context
    if (!req.websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }

    console.log('Update category request body:', req.body);
    
    const { name, description } = req.body;
    let { isActive } = req.body;
    
    // Convert string "true"/"false" to boolean (for FormData)
    if (typeof isActive === 'string') {
      isActive = isActive === 'true';
    }
    
    console.log('Processed isActive value:', isActive, 'Type:', typeof isActive);
    
    // Check if category exists and belongs to the website
    const category = await Category.findOne({ _id: req.params.id, website: req.websiteId });
    if (!category) {
      return res.status(404).json({ msg: 'Category not found' });
    }

    // Check for duplicate names in the same website (excluding current category, non-deleted, case-insensitive)
    if (name && name.trim().toLowerCase() !== category.name.toLowerCase()) {
      const existingCategory = await Category.findOne({ 
        _id: { $ne: req.params.id },
        name: { $regex: new RegExp(`^${name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }, // Case-insensitive, escape special regex chars
        deleted: false,
        website: req.websiteId
      });
      
      if (existingCategory) {
        return res.status(400).json({ msg: 'Category name already exists' });
      }
    }

    // Ensure category has a categoryId (for existing categories that don't have one)
    if (!category.categoryId) {
      // Find the highest existing category ID number within the same website
      const existingCategories = await Category.find({ 
        categoryId: { $exists: true, $ne: null },
        website: req.websiteId
      });
      let counter = 1001;
      
      if (existingCategories.length > 0) {
        const existingIds = existingCategories
          .map(cat => cat.categoryId)
          .filter(id => id && id.startsWith('PPSCATNM'))
          .map(id => {
            const match = id.match(/PPSCATNM(\d+)/);
            return match ? parseInt(match[1]) : 0;
          });
        
        if (existingIds.length > 0) {
          const maxNumber = Math.max(...existingIds);
          counter = maxNumber + 1;
        }
      }
      
      category.categoryId = `PPSCATNM${counter}`;
    }

    // Update fields
    if (name && name.trim() !== category.name) {
      category.name = name.trim();
      category.slug = name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^\w\-]+/g, '');
    }
    
    if (description !== undefined) {
      category.description = description?.trim() || null;
    }
    
    if (isActive !== undefined) {
      category.isActive = isActive;
    }

    // Handle deleted field update (for reverting deleted categories)
    if (req.body.deleted !== undefined) {
      category.deleted = req.body.deleted;
    }

    // Handle image update/removal
    if (req.file) {
      // New image file uploaded
      try {
        // Upload to Cloudinary
        const cloudinary = (await import('../utils/cloudinary.js')).default;
        const result = await cloudinary.uploader.upload(req.file.path, {
          folder: 'photuprint/categories',
        });
        category.image = result.secure_url;
        removeLocalFile(req.file.path);
        console.log('Image updated in Cloudinary:', category.image);
      } catch (uploadError) {
        console.error('Cloudinary upload failed:', uploadError);
        // Fallback to local storage
        category.image = `/uploads/${req.file.filename}`;
      }
    } else if (req.body.image !== undefined) {
      // Image field explicitly set (could be null to remove image)
      if (req.body.image === null || req.body.image === '') {
        category.image = null;
        console.log('Image removed from category');
      } else if (req.body.image && typeof req.body.image === 'string') {
        // Keep existing image URL if provided as string
        category.image = req.body.image;
      }
    }

    const updatedCategory = await category.save();
    res.json(updatedCategory);
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({ msg: 'Failed to update category' });
  }
};

// Delete category (soft delete)
export const deleteCategory = async (req, res) => {
  try {
    // Multi-tenant: Validate website context
    if (!req.websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }

    const category = await Category.findOne({ _id: req.params.id, website: req.websiteId });
    if (!category) {
      return res.status(404).json({ msg: 'Category not found' });
    }

    // Soft delete: mark as inactive and set deleted flag
    category.isActive = false;
    category.deleted = true;
    await category.save();
    
    res.json({ msg: 'Category deleted successfully' });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ msg: 'Failed to delete category' });
  }
};

// Hard delete category
export const hardDeleteCategory = async (req, res) => {
  try {
    // Multi-tenant: Validate website context
    if (!req.websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }

    const category = await Category.findOneAndDelete({ _id: req.params.id, website: req.websiteId });
    if (!category) {
      return res.status(404).json({ msg: 'Category not found' });
    }
    
    res.json({ msg: 'Category permanently deleted' });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ msg: 'Failed to delete category' });
  }
};
