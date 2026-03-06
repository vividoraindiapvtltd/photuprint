import ProductAttribute from '../models/productAttribute.model.js';

// Get all product attributes
export const getProductAttributes = async (req, res) => {
  try {
    const { category, subcategory, pattern, fitType, sleeveType, collarStyle, search } = req.query;
    let query = { isActive: true };
    
    if (category) query.category = category;
    if (subcategory) query.subcategory = subcategory;
    if (pattern) query.pattern = pattern;
    if (fitType) query.fitType = fitType;
    if (sleeveType) query.sleeveType = sleeveType;
    if (collarStyle) query.collarStyle = collarStyle;
    
    if (search) {
      query.$or = [
        { pattern: { $regex: search, $options: 'i' } },
        { fitType: { $regex: search, $options: 'i' } },
        { sleeveType: { $regex: search, $options: 'i' } },
        { collarStyle: { $regex: search, $options: 'i' } },
        { countryOfOrigin: { $regex: search, $options: 'i' } }
      ];
    }
    
    const attributes = await ProductAttribute.find(query).sort({ createdAt: -1 });
    res.json(attributes);
  } catch (error) {
    console.error('Error fetching product attributes:', error);
    res.status(500).json({ msg: 'Failed to fetch product attributes' });
  }
};

// Get single product attribute by ID
export const getProductAttributeById = async (req, res) => {
  try {
    const attribute = await ProductAttribute.findById(req.params.id);
    if (!attribute) {
      return res.status(404).json({ msg: 'Product attribute not found' });
    }
    res.json(attribute);
  } catch (error) {
    console.error('Error fetching product attribute:', error);
    res.status(500).json({ msg: 'Failed to fetch product attribute' });
  }
};

// Create new product attribute
export const createProductAttribute = async (req, res) => {
  try {
    const {
      width,
      height,
      length,
      pattern,
      fitType,
      sleeveType,
      collarStyle,
      countryOfOrigin,
      pinCode,
      category,
      subcategory
    } = req.body;
    
    // Check if all required fields are present
    if (!width || !height || !length || !pattern || !fitType || !sleeveType || !collarStyle || !countryOfOrigin || !pinCode) {
      return res.status(400).json({ msg: 'All fields are required' });
    }

    // Check for duplicate attributes
    const existingAttribute = await ProductAttribute.findOne({
      width,
      height,
      length,
      pattern,
      fitType,
      sleeveType,
      collarStyle,
      countryOfOrigin,
      pinCode
    });
    
    if (existingAttribute) {
      return res.status(400).json({ msg: 'Product attribute with these specifications already exists' });
    }

    const attribute = new ProductAttribute({
      width,
      height,
      length,
      pattern,
      fitType,
      sleeveType,
      collarStyle,
      countryOfOrigin,
      pinCode,
      category,
      subcategory
    });

    const savedAttribute = await attribute.save();
    res.status(201).json(savedAttribute);
  } catch (error) {
    console.error('Error creating product attribute:', error);
    res.status(500).json({ msg: 'Failed to create product attribute' });
  }
};

// Update product attribute
export const updateProductAttribute = async (req, res) => {
  try {
    const {
      width,
      height,
      length,
      pattern,
      fitType,
      sleeveType,
      collarStyle,
      countryOfOrigin,
      pinCode,
      category,
      subcategory
    } = req.body;
    
    // Check if attribute exists
    const attribute = await ProductAttribute.findById(req.params.id);
    if (!attribute) {
      return res.status(404).json({ msg: 'Product attribute not found' });
    }

    // Check for duplicate attributes (excluding current one)
    const existingAttribute = await ProductAttribute.findOne({
      $and: [
        { _id: { $ne: req.params.id } },
        {
          width,
          height,
          length,
          pattern,
          fitType,
          sleeveType,
          collarStyle,
          countryOfOrigin,
          pinCode
        }
      ]
    });
    
    if (existingAttribute) {
      return res.status(400).json({ msg: 'Product attribute with these specifications already exists' });
    }

    // Update fields
    attribute.width = width || attribute.width;
    attribute.height = height || attribute.height;
    attribute.length = length || attribute.length;
    attribute.pattern = pattern || attribute.pattern;
    attribute.fitType = fitType || attribute.fitType;
    attribute.sleeveType = sleeveType || attribute.sleeveType;
    attribute.collarStyle = collarStyle || attribute.collarStyle;
    attribute.countryOfOrigin = countryOfOrigin || attribute.countryOfOrigin;
    attribute.pinCode = pinCode || attribute.pinCode;
    attribute.category = category || attribute.category;
    attribute.subcategory = subcategory || attribute.subcategory;

    const updatedAttribute = await attribute.save();
    res.json(updatedAttribute);
  } catch (error) {
    console.error('Error updating product attribute:', error);
    res.status(500).json({ msg: 'Failed to update product attribute' });
  }
};

// Delete product attribute (soft delete)
export const deleteProductAttribute = async (req, res) => {
  try {
    const attribute = await ProductAttribute.findById(req.params.id);
    if (!attribute) {
      return res.status(404).json({ msg: 'Product attribute not found' });
    }

    attribute.isActive = false;
    await attribute.save();
    
    res.json({ msg: 'Product attribute deleted successfully' });
  } catch (error) {
    console.error('Error deleting product attribute:', error);
    res.status(500).json({ msg: 'Failed to delete product attribute' });
  }
};

// Hard delete product attribute
export const hardDeleteProductAttribute = async (req, res) => {
  try {
    const attribute = await ProductAttribute.findByIdAndDelete(req.params.id);
    if (!attribute) {
      return res.status(404).json({ msg: 'Product attribute not found' });
    }
    
    res.json({ msg: 'Product attribute permanently deleted' });
  } catch (error) {
    console.error('Error deleting product attribute:', error);
    res.status(500).json({ msg: 'Failed to delete product attribute' });
  }
}; 