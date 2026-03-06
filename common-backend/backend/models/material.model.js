import mongoose from 'mongoose';

const materialSchema = new mongoose.Schema({
  type: { 
    type: String, 
    required: true 
  },
  name: { 
    type: String, 
    required: true 
  },
  description: { 
    type: String, 
    default: null 
  },
  image: { 
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
  },
  properties: [{
    name: String,
    value: String
  }],
  category: { 
    type: String, 
    default: null 
  },
  // Multi-tenant: Website reference
  website: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Website',
    required: true,
    index: true
  }
}, { 
  timestamps: true 
});

// Multi-tenant: Compound unique index for name + website (only for non-deleted items)
materialSchema.index({ name: 1, website: 1 }, { unique: true, partialFilterExpression: { deleted: false } });

// Performance indexes
materialSchema.index({ website: 1, type: 1 });
materialSchema.index({ website: 1, deleted: 1, isActive: 1 });
materialSchema.index({ website: 1, category: 1 });
materialSchema.index({ createdAt: -1 });

export default mongoose.model('Material', materialSchema); 