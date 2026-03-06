import mongoose from 'mongoose';

const patternSchema = new mongoose.Schema({
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
patternSchema.index({ name: 1, website: 1 }, { unique: true, partialFilterExpression: { deleted: false } });

// Performance indexes
patternSchema.index({ website: 1, deleted: 1, isActive: 1 });
patternSchema.index({ website: 1, name: 1 });
patternSchema.index({ createdAt: -1 });

export default mongoose.model('Pattern', patternSchema);
