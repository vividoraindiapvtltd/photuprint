import mongoose from 'mongoose';

const gstSlabSchema = new mongoose.Schema(
  {
    name: { 
      type: String, 
      required: true 
    },
    rate: { 
      type: Number, 
      required: true,
      min: 0,
      max: 100
    },
    description: { 
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
  },
  {
    timestamps: true,
  }
);

// Multi-tenant: Compound unique index on rate + website for non-deleted items
gstSlabSchema.index({ rate: 1, website: 1 }, { unique: true, partialFilterExpression: { deleted: false } });
gstSlabSchema.index({ name: 1, website: 1 }, { unique: true, partialFilterExpression: { deleted: false } });

// Performance indexes
gstSlabSchema.index({ website: 1, name: 1 });
gstSlabSchema.index({ website: 1, deleted: 1, isActive: 1 });
gstSlabSchema.index({ website: 1, rate: 1 });
gstSlabSchema.index({ createdAt: -1 });

export default mongoose.model('GstSlab', gstSlabSchema);
