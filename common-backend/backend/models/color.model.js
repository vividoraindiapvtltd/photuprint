import mongoose from 'mongoose';

const colorSchema = new mongoose.Schema({
  name: { type: String, required: true }, // Removed unique: true - will use compound index with website
  code: { type: String, required: true },
  image: String,
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
colorSchema.index({ name: 1, website: 1 }, { unique: true, partialFilterExpression: { deleted: false } });
colorSchema.index({ code: 1, website: 1 }, { unique: true, partialFilterExpression: { deleted: false } });

// Performance indexes
colorSchema.index({ website: 1, deleted: 1, isActive: 1 });
colorSchema.index({ website: 1, name: 1 });
colorSchema.index({ createdAt: -1 });

export default mongoose.model('Color', colorSchema);
