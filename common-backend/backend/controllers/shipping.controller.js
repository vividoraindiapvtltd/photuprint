import Shipping from '../models/shipping.model.js';

// Get all shipping addresses
export const getShippings = async (req, res) => {
  try {
    const { showInactive, includeDeleted, userId, orderId } = req.query;
    let query = {};
    
    if (showInactive !== 'true') {
      query.isActive = true;
    }
    
    if (includeDeleted !== 'true') {
      query.deleted = false;
    }

    if (userId) {
      query.user = userId;
    }

    if (orderId) {
      query.order = orderId;
    }
    
    const shippings = await Shipping.find(query)
      .populate('user', 'name email')
      .populate('order', 'orderNumber')
      .sort({ createdAt: -1 });
    
    res.json(shippings);
  } catch (error) {
    console.error('Error fetching shipping addresses:', error);
    res.status(500).json({ msg: 'Failed to fetch shipping addresses' });
  }
};

// Get single shipping address by ID
export const getShippingById = async (req, res) => {
  try {
    const shipping = await Shipping.findById(req.params.id)
      .populate('user', 'name email')
      .populate('order', 'orderNumber');
    
    if (!shipping) {
      return res.status(404).json({ msg: 'Shipping address not found' });
    }
    
    res.json(shipping);
  } catch (error) {
    console.error('Error fetching shipping address:', error);
    res.status(500).json({ msg: 'Failed to fetch shipping address' });
  }
};

// Create new shipping address
export const createShipping = async (req, res) => {
  try {
    const {
      name,
      phone,
      email,
      street,
      city,
      state,
      zipCode,
      country,
      landmark,
      addressType,
      isDefault,
      order,
      user,
      isActive
    } = req.body;

    if (!name || !street || !city || !state || !zipCode || !country) {
      return res.status(400).json({ 
        msg: 'Name, street, city, state, zip code, and country are required' 
      });
    }

    // Parse boolean values
    let isDefaultValue = false;
    if (isDefault !== undefined) {
      if (typeof isDefault === 'string') {
        isDefaultValue = isDefault === 'true';
      } else {
        isDefaultValue = Boolean(isDefault);
      }
    }

    let isActiveValue = true;
    if (isActive !== undefined) {
      if (typeof isActive === 'string') {
        isActiveValue = isActive === 'true';
      } else {
        isActiveValue = Boolean(isActive);
      }
    }

    // If this is set as default, unset other defaults for the same user
    if (isDefaultValue && user) {
      await Shipping.updateMany(
        { user, deleted: false },
        { $set: { isDefault: false } }
      );
    }

    const shipping = new Shipping({
      name: name.trim(),
      phone: phone?.trim() || null,
      email: email?.trim() || null,
      street: street.trim(),
      city: city.trim(),
      state: state.trim(),
      zipCode: zipCode.trim(),
      country: country.trim(),
      landmark: landmark?.trim() || null,
      addressType: addressType || 'home',
      isDefault: isDefaultValue,
      order: order || null,
      user: user || null,
      isActive: isActiveValue
    });

    const savedShipping = await shipping.save();
    const populatedShipping = await Shipping.findById(savedShipping._id)
      .populate('user', 'name email')
      .populate('order', 'orderNumber');

    res.status(201).json(populatedShipping);
  } catch (error) {
    console.error('Error creating shipping address:', error);
    res.status(500).json({ msg: `Failed to create shipping address: ${error.message || error}` });
  }
};

// Update shipping address
export const updateShipping = async (req, res) => {
  try {
    const {
      name,
      phone,
      email,
      street,
      city,
      state,
      zipCode,
      country,
      landmark,
      addressType,
      isDefault,
      order,
      user,
      isActive,
      deleted
    } = req.body;

    const shipping = await Shipping.findById(req.params.id);
    if (!shipping) {
      return res.status(404).json({ msg: 'Shipping address not found' });
    }

    // Update fields
    if (name !== undefined) shipping.name = name.trim();
    if (phone !== undefined) shipping.phone = phone?.trim() || null;
    if (email !== undefined) shipping.email = email?.trim() || null;
    if (street !== undefined) shipping.street = street.trim();
    if (city !== undefined) shipping.city = city.trim();
    if (state !== undefined) shipping.state = state.trim();
    if (zipCode !== undefined) shipping.zipCode = zipCode.trim();
    if (country !== undefined) shipping.country = country.trim();
    if (landmark !== undefined) shipping.landmark = landmark?.trim() || null;
    if (addressType !== undefined) shipping.addressType = addressType;
    
    if (isDefault !== undefined) {
      let isDefaultValue = false;
      if (typeof isDefault === 'string') {
        isDefaultValue = isDefault === 'true';
      } else {
        isDefaultValue = Boolean(isDefault);
      }
      
      // If setting as default, unset other defaults for the same user
      if (isDefaultValue && shipping.user) {
        await Shipping.updateMany(
          { user: shipping.user, _id: { $ne: req.params.id }, deleted: false },
          { $set: { isDefault: false } }
        );
      }
      shipping.isDefault = isDefaultValue;
    }

    if (order !== undefined) shipping.order = order || null;
    if (user !== undefined) shipping.user = user || null;
    
    if (isActive !== undefined) {
      if (typeof isActive === 'string') {
        shipping.isActive = isActive === 'true';
      } else {
        shipping.isActive = Boolean(isActive);
      }
    }

    if (deleted !== undefined) {
      if (typeof deleted === 'string') {
        shipping.deleted = deleted === 'true';
      } else {
        shipping.deleted = Boolean(deleted);
      }
    }

    const updatedShipping = await shipping.save();
    const populatedShipping = await Shipping.findById(updatedShipping._id)
      .populate('user', 'name email')
      .populate('order', 'orderNumber');

    res.json(populatedShipping);
  } catch (error) {
    console.error('Error updating shipping address:', error);
    res.status(500).json({ msg: 'Failed to update shipping address' });
  }
};

// Delete shipping address (soft delete)
export const deleteShipping = async (req, res) => {
  try {
    const shipping = await Shipping.findById(req.params.id);
    if (!shipping) {
      return res.status(404).json({ msg: 'Shipping address not found' });
    }

    shipping.isActive = false;
    shipping.deleted = true;
    await shipping.save();
    
    res.json({ msg: 'Shipping address deleted successfully' });
  } catch (error) {
    console.error('Error deleting shipping address:', error);
    res.status(500).json({ msg: 'Failed to delete shipping address' });
  }
};

// Hard delete shipping address
export const hardDeleteShipping = async (req, res) => {
  try {
    const shipping = await Shipping.findByIdAndDelete(req.params.id);
    if (!shipping) {
      return res.status(404).json({ msg: 'Shipping address not found' });
    }
    
    res.json({ msg: 'Shipping address permanently deleted' });
  } catch (error) {
    console.error('Error deleting shipping address:', error);
    res.status(500).json({ msg: 'Failed to delete shipping address' });
  }
};
