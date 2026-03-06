import mongoose from 'mongoose';

const brandSchema = new mongoose.Schema({
  brandId: { 
    type: String, 
    required: true
    // Unique constraint is handled by compound index with website
  },
  name: { 
    type: String, 
    required: true
    // Unique constraint is handled by compound index with website
  },
  logo: { 
    type: String, 
    default: null 
  },
  gstNo: { 
    type: String, 
    default: null 
  },
  companyName: { 
    type: String, 
    default: null 
  },
  address: { 
    type: String, 
    default: null 
  },
  isActive: { 
    type: Boolean, 
    default: true 
  },
  deleted: { 
    type: Boolean, 
    default: false 
  }, // Add deleted field for soft delete
  // Multi-tenant: Website/Tenant reference
  website: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Website',
    required: true,
    index: true
  },
}, { 
  timestamps: true 
});

// Create indexes for better search performance and multi-tenancy
brandSchema.index({ name: 1, website: 1 }, { unique: true, partialFilterExpression: { deleted: false } });
brandSchema.index({ brandId: 1, website: 1 }, { unique: true, partialFilterExpression: { deleted: false } });
brandSchema.index({ website: 1, isActive: 1, deleted: 1 });

export default mongoose.model('Brand', brandSchema); 