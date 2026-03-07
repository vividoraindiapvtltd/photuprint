import Coupon from '../models/coupon.model.js';

// Helper function to generate random coupon code
const generateCouponCode = (length, type, prefix = '', suffix = '', useSeparator = false, separatorLength = 0) => {
  let chars = '';
  
  switch (type) {
    case 'alphabet':
      chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      break;
    case 'numbers':
      chars = '0123456789';
      break;
    case 'alphanumeric':
    default:
      chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      break;
  }
  
  let code = '';
  const actualLength = length - prefix.length - suffix.length - (useSeparator ? separatorLength : 0);
  
  for (let i = 0; i < actualLength; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  // Add separator if needed
  if (useSeparator && separatorLength > 0 && code.length > separatorLength) {
    const separator = '-';
    const parts = [];
    for (let i = 0; i < code.length; i += separatorLength) {
      parts.push(code.slice(i, i + separatorLength));
    }
    code = parts.join(separator);
  }
  
  return prefix + code + suffix;
};

// Get all coupons
export const getCoupons = async (req, res) => {
  try {
    // Multi-tenant: Filter by website
    if (!req.websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }

    const { showInactive, includeDeleted } = req.query;
    let query = {
      website: req.websiteId, // Filter by tenant website
    };
    
    // Filter by active status if showInactive is not true
    if (showInactive !== 'true') {
      query.isActive = true;
    }
    
    // Filter deleted items if includeDeleted is not true
    if (includeDeleted !== 'true') {
      query.deleted = false;
    }
    
    const coupons = await Coupon.find(query).sort({ createdAt: -1 });
    
    // Automatically mark expired coupons as inactive
    const now = new Date();
    const updatePromises = [];
    
    coupons.forEach(coupon => {
      if (coupon.expiryDate && new Date(coupon.expiryDate) < now && coupon.isActive && !coupon.deleted) {
        updatePromises.push(
          Coupon.findByIdAndUpdate(coupon._id, { isActive: false }, { new: false })
        );
      }
    });
    
    // Wait for all updates to complete
    if (updatePromises.length > 0) {
      await Promise.all(updatePromises);
      // Fetch updated coupons
      const updatedCoupons = await Coupon.find(query).sort({ createdAt: -1 });
      return res.json(updatedCoupons);
    }
    
    res.json(coupons);
  } catch (error) {
    console.error('Error fetching coupons:', error);
    res.status(500).json({ msg: 'Failed to fetch coupons' });
  }
};

// Get single coupon by ID
export const getCouponById = async (req, res) => {
  try {
    // Multi-tenant: Filter by website
    if (!req.websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }

    const coupon = await Coupon.findOne({ _id: req.params.id, website: req.websiteId });
    if (!coupon) {
      return res.status(404).json({ msg: 'Coupon not found' });
    }
    
    // Automatically mark as inactive if expired
    const now = new Date();
    if (coupon.expiryDate && new Date(coupon.expiryDate) < now && coupon.isActive && !coupon.deleted) {
      coupon.isActive = false;
      await coupon.save();
    }
    
    res.json(coupon);
  } catch (error) {
    console.error('Error fetching coupon:', error);
    res.status(500).json({ msg: 'Failed to fetch coupon' });
  }
};

// Create new coupon(s)
export const createCoupon = async (req, res) => {
  try {
    // Multi-tenant: Validate website context
    if (!req.websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }

    const { 
      code, 
      type, 
      usageType,
      discountType, 
      discountValue, 
      minPurchase, 
      startDate,
      expiryDate, 
      isActive,
      numberOfCodes,
      codeLength,
      prefix,
      suffix,
      codeGenerationType,
      useSeparator,
      separatorLength,
      offerType,
      applicableProductIds,
      bankName
    } = req.body;
    
    if (!discountType || !discountValue || !expiryDate) {
      return res.status(400).json({ msg: 'Discount type, discount value, and expiry date are required' });
    }

    // Validate discount value
    const discountValueNum = Number(discountValue);
    if (isNaN(discountValueNum) || discountValueNum <= 0) {
      return res.status(400).json({ msg: 'Discount value must be a positive number' });
    }

    // Validate percentage discount (0-100)
    if (discountType === 'percentage' && discountValueNum > 100) {
      return res.status(400).json({ msg: 'Percentage discount cannot exceed 100%' });
    }

    // Validate dates
    const expiryDateObj = new Date(expiryDate);
    if (isNaN(expiryDateObj.getTime())) {
      return res.status(400).json({ msg: 'Invalid expiry date' });
    }

    let startDateObj = null;
    if (startDate) {
      startDateObj = new Date(startDate);
      if (isNaN(startDateObj.getTime())) {
        return res.status(400).json({ msg: 'Invalid start date' });
      }
    }

    // Parse isActive
    let isActiveValue = true;
    if (isActive !== undefined) {
      if (typeof isActive === 'string') {
        isActiveValue = isActive === 'true';
      } else {
        isActiveValue = Boolean(isActive);
      }
    }

    const couponType = type || 'single';

    // Handle bulk coupon generation
    if (couponType === 'bulk') {
      if (!numberOfCodes || numberOfCodes <= 0) {
        return res.status(400).json({ msg: 'Number of codes is required for bulk coupons' });
      }
      if (!codeLength || codeLength <= 0) {
        return res.status(400).json({ msg: 'Code length is required for bulk coupons' });
      }

      const generatedCodes = [];
      const existingCodes = new Set();
      
      // Get all existing codes to avoid duplicates within the same website
      const existingCoupons = await Coupon.find({ 
        deleted: false,
        website: req.websiteId
      }, 'code');
      existingCoupons.forEach(c => existingCodes.add(c.code.toUpperCase()));

      // Generate unique codes
      const maxAttempts = numberOfCodes * 100; // Prevent infinite loop
      let attempts = 0;
      
      while (generatedCodes.length < numberOfCodes && attempts < maxAttempts) {
        attempts++;
        const generatedCode = generateCouponCode(
          Number(codeLength),
          codeGenerationType || 'alphanumeric',
          (prefix || '').trim().toUpperCase(),
          (suffix || '').trim().toUpperCase(),
          useSeparator || false,
          separatorLength ? Number(separatorLength) : 0
        ).toUpperCase();

        if (!existingCodes.has(generatedCode) && !generatedCodes.includes(generatedCode)) {
          generatedCodes.push(generatedCode);
          existingCodes.add(generatedCode);
        }
      }

      if (generatedCodes.length < numberOfCodes) {
        return res.status(400).json({ 
          msg: `Failed to generate ${numberOfCodes} unique codes. Only generated ${generatedCodes.length} codes.` 
        });
      }

      const normalizedOfferType = ['cart', 'product_base', 'bank_offer'].includes(offerType) ? offerType : 'cart';
      const normalizedProductIds = Array.isArray(applicableProductIds) ? applicableProductIds.filter(Boolean) : [];

      // Create bulk coupons
      const bulkCoupons = generatedCodes.map(couponCode => ({
        code: couponCode,
        type: 'bulk',
        usageType: usageType || 'single',
        discountType,
        discountValue: discountValueNum,
        minPurchase: minPurchase ? Number(minPurchase) : 0,
        startDate: startDateObj,
        expiryDate: expiryDateObj,
        numberOfCodes: Number(numberOfCodes),
        codeLength: Number(codeLength),
        prefix: prefix ? prefix.trim().toUpperCase() : null,
        suffix: suffix ? suffix.trim().toUpperCase() : null,
        codeGenerationType: codeGenerationType || 'alphanumeric',
        useSeparator: useSeparator || false,
        separatorLength: separatorLength ? Number(separatorLength) : null,
        isActive: isActiveValue,
        offerType: normalizedOfferType,
        applicableProductIds: normalizedOfferType === 'product_base' ? normalizedProductIds : [],
        bankName: normalizedOfferType === 'bank_offer' && bankName ? String(bankName).trim() : null,
        website: req.websiteId // Multi-tenant: Set website
      }));

      const savedCoupons = await Coupon.insertMany(bulkCoupons);
      res.status(201).json({ 
        msg: `Successfully created ${savedCoupons.length} bulk coupons`,
        coupons: savedCoupons,
        count: savedCoupons.length
      });
      return;
    }

    // Handle single coupon
    if (!code || !code.trim()) {
      return res.status(400).json({ msg: 'Coupon code is required for single coupon' });
    }

    // Check if coupon with same code already exists in the same website (non-deleted)
    const existingCoupon = await Coupon.findOne({ 
      code: code.trim().toUpperCase(), 
      deleted: false,
      website: req.websiteId
    });
    if (existingCoupon) {
      return res.status(400).json({ msg: 'Coupon code already exists' });
    }

    const normalizedOfferType = ['cart', 'product_base', 'bank_offer'].includes(offerType) ? offerType : 'cart';
    const normalizedProductIds = Array.isArray(applicableProductIds) ? applicableProductIds.filter(Boolean) : [];

    const coupon = new Coupon({
      code: code.trim().toUpperCase(),
      type: 'single',
      usageType: usageType || 'single',
      discountType,
      discountValue: discountValueNum,
      minPurchase: minPurchase ? Number(minPurchase) : 0,
      startDate: startDateObj,
      expiryDate: expiryDateObj,
      isActive: isActiveValue,
      offerType: normalizedOfferType,
      applicableProductIds: normalizedOfferType === 'product_base' ? normalizedProductIds : [],
      bankName: normalizedOfferType === 'bank_offer' && bankName ? String(bankName).trim() : null,
      website: req.websiteId // Multi-tenant: Set website
    });

    const savedCoupon = await coupon.save();
    res.status(201).json(savedCoupon);
  } catch (error) {
    console.error('Error creating coupon:', error);
    if (error.code === 11000) {
      return res.status(400).json({ msg: 'Coupon code already exists' });
    }
    res.status(500).json({ msg: `Failed to create coupon: ${error.message || error}` });
  }
};

// Update coupon
export const updateCoupon = async (req, res) => {
  try {
    // Multi-tenant: Validate website context
    if (!req.websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }

    const { 
      code, 
      type,
      usageType,
      discountType, 
      discountValue, 
      minPurchase, 
      startDate,
      expiryDate, 
      isActive, 
      used,
      deleted,
      numberOfCodes,
      codeLength,
      prefix,
      suffix,
      codeGenerationType,
      useSeparator,
      separatorLength,
      offerType,
      applicableProductIds,
      bankName
    } = req.body;
    
    // Check if coupon exists and belongs to the website
    const coupon = await Coupon.findOne({ _id: req.params.id, website: req.websiteId });
    if (!coupon) {
      return res.status(404).json({ msg: 'Coupon not found' });
    }

    // Check for duplicate codes in the same website (excluding current coupon, only non-deleted)
    if (code && code.trim().toUpperCase() !== coupon.code) {
      const existingCoupon = await Coupon.findOne({ 
        _id: { $ne: req.params.id },
        code: code.trim().toUpperCase(), 
        deleted: false,
        website: req.websiteId
      });
      if (existingCoupon) {
        return res.status(400).json({ msg: 'Coupon code already exists' });
      }
    }

    // Update fields
    if (code !== undefined) coupon.code = code.trim().toUpperCase();
    if (type !== undefined) coupon.type = type;
    if (usageType !== undefined) coupon.usageType = usageType;
    if (discountType !== undefined) coupon.discountType = discountType;
    if (discountValue !== undefined) {
      const discountValueNum = Number(discountValue);
      if (isNaN(discountValueNum) || discountValueNum <= 0) {
        return res.status(400).json({ msg: 'Discount value must be a positive number' });
      }
      const currentDiscountType = discountType || coupon.discountType;
      if (currentDiscountType === 'percentage' && discountValueNum > 100) {
        return res.status(400).json({ msg: 'Percentage discount cannot exceed 100%' });
      }
      coupon.discountValue = discountValueNum;
    }
    if (minPurchase !== undefined) coupon.minPurchase = Number(minPurchase) || 0;
    if (startDate !== undefined) {
      if (startDate === null || startDate === '') {
        coupon.startDate = null;
      } else {
        const startDateObj = new Date(startDate);
        if (isNaN(startDateObj.getTime())) {
          return res.status(400).json({ msg: 'Invalid start date' });
        }
        coupon.startDate = startDateObj;
      }
    }
    if (expiryDate !== undefined) {
      const expiryDateObj = new Date(expiryDate);
      if (isNaN(expiryDateObj.getTime())) {
        return res.status(400).json({ msg: 'Invalid expiry date' });
      }
      coupon.expiryDate = expiryDateObj;
    }
    if (numberOfCodes !== undefined) coupon.numberOfCodes = numberOfCodes ? Number(numberOfCodes) : null;
    if (codeLength !== undefined) coupon.codeLength = codeLength ? Number(codeLength) : null;
    if (prefix !== undefined) coupon.prefix = prefix ? prefix.trim().toUpperCase() : null;
    if (suffix !== undefined) coupon.suffix = suffix ? suffix.trim().toUpperCase() : null;
    if (codeGenerationType !== undefined) coupon.codeGenerationType = codeGenerationType || 'alphanumeric';
    if (useSeparator !== undefined) {
      if (typeof useSeparator === 'string') {
        coupon.useSeparator = useSeparator === 'true';
      } else {
        coupon.useSeparator = Boolean(useSeparator);
      }
    }
    if (separatorLength !== undefined) coupon.separatorLength = separatorLength ? Number(separatorLength) : null;
    if (offerType !== undefined && ['cart', 'product_base', 'bank_offer'].includes(offerType)) {
      coupon.offerType = offerType;
      if (offerType !== 'product_base') coupon.applicableProductIds = [];
      if (offerType !== 'bank_offer') coupon.bankName = null;
    }
    if (applicableProductIds !== undefined) {
      coupon.applicableProductIds = Array.isArray(applicableProductIds) ? applicableProductIds.filter(Boolean) : [];
    }
    if (bankName !== undefined) {
      coupon.bankName = coupon.offerType === 'bank_offer' && bankName ? String(bankName).trim() : null;
    }
    if (used !== undefined) {
      if (typeof used === 'string') {
        coupon.used = used === 'true';
      } else {
        coupon.used = Boolean(used);
      }
      // When a coupon is marked as used, automatically set it to inactive
      if (coupon.used) {
        coupon.isActive = false;
      }
    }
    if (isActive !== undefined) {
      if (typeof isActive === 'string') {
        coupon.isActive = isActive === 'true';
      } else {
        coupon.isActive = Boolean(isActive);
      }
    }
    if (deleted !== undefined) {
      if (typeof deleted === 'string') {
        coupon.deleted = deleted === 'true';
      } else {
        coupon.deleted = Boolean(deleted);
      }
    }

    const updatedCoupon = await coupon.save();
    res.json(updatedCoupon);
  } catch (error) {
    console.error('Error updating coupon:', error);
    if (error.code === 11000) {
      return res.status(400).json({ msg: 'Coupon code already exists' });
    }
    res.status(500).json({ msg: 'Failed to update coupon' });
  }
};

// Delete coupon (soft delete)
export const deleteCoupon = async (req, res) => {
  try {
    // Multi-tenant: Validate website context
    if (!req.websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }

    const coupon = await Coupon.findOne({ _id: req.params.id, website: req.websiteId });
    if (!coupon) {
      return res.status(404).json({ msg: 'Coupon not found' });
    }

    coupon.isActive = false;
    coupon.deleted = true;
    await coupon.save();
    
    res.json({ msg: 'Coupon deleted successfully' });
  } catch (error) {
    console.error('Error deleting coupon:', error);
    res.status(500).json({ msg: 'Failed to delete coupon' });
  }
};

// Hard delete coupon
export const hardDeleteCoupon = async (req, res) => {
  try {
    // Multi-tenant: Validate website context
    if (!req.websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }

    const coupon = await Coupon.findOneAndDelete({ _id: req.params.id, website: req.websiteId });
    if (!coupon) {
      return res.status(404).json({ msg: 'Coupon not found' });
    }
    
    res.json({ msg: 'Coupon permanently deleted' });
  } catch (error) {
    console.error('Error deleting coupon:', error);
    res.status(500).json({ msg: 'Failed to delete coupon' });
  }
};
