import mongoose from 'mongoose';

const productAttributeSchema = new mongoose.Schema({
  width: { 
    type: String, 
    required: true 
  },
  height: { 
    type: String, 
    required: true 
  },
  length: { 
    type: String, 
    required: true 
  },
  pattern: { 
    type: String, 
    required: true 
  },
  fitType: { 
    type: String, 
    required: true 
  },
  sleeveType: { 
    type: String, 
    required: true 
  },
  collarStyle: { 
    type: String, 
    required: true 
  },
  countryOfOrigin: { 
    type: String, 
    required: true 
  },
  pinCode: { 
    type: String, 
    required: true 
  },
  isActive: { 
    type: Boolean, 
    default: true 
  },
  category: { 
    type: String, 
    default: null 
  },
  subcategory: { 
    type: String, 
    default: null 
  }
}, { 
  timestamps: true 
});

// Create compound index for better search performance
productAttributeSchema.index({ 
  pattern: 1, 
  fitType: 1, 
  sleeveType: 1, 
  collarStyle: 1 
});

export default mongoose.model('ProductAttribute', productAttributeSchema); 