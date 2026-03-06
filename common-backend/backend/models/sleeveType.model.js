import mongoose from 'mongoose';

const sleeveTypeSchema = new mongoose.Schema({
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
sleeveTypeSchema.index({ name: 1, website: 1 }, { unique: true, partialFilterExpression: { deleted: false } });

// Performance indexes
sleeveTypeSchema.index({ website: 1, deleted: 1, isActive: 1 });
sleeveTypeSchema.index({ website: 1, name: 1 });
sleeveTypeSchema.index({ createdAt: -1 });

export default mongoose.model('SleeveType', sleeveTypeSchema);
