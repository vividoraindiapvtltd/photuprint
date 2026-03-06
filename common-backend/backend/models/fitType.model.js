import mongoose from 'mongoose';

const fitTypeSchema = new mongoose.Schema({
  name: { type: String, required: true }, // Removed unique: true - will use compound index with website
  description: { type: String, default: null },
  isActive: { type: Boolean, default: true },
  deleted: { type: Boolean, default: false },
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

// Multi-tenant: Compound unique indexes scoped by website
fitTypeSchema.index({ name: 1, website: 1 }, { unique: true, partialFilterExpression: { deleted: false } });

// Performance indexes
fitTypeSchema.index({ website: 1, deleted: 1, isActive: 1 });
fitTypeSchema.index({ website: 1, name: 1 });
fitTypeSchema.index({ createdAt: -1 });

export default mongoose.model('FitType', fitTypeSchema);
