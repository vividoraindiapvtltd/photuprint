import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema({
  categoryId: { type: String }, // Unique constraint handled by compound index with website
  name: { type: String, required: true },
  slug: { type: String, required: true },
  description: { type: String, default: null },
  image: { type: String, default: null },
  isActive: { type: Boolean, default: true },
  deleted: { type: Boolean, default: false }, // Add deleted field for soft delete
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
categorySchema.index({ name: 1, website: 1 }, { unique: true, partialFilterExpression: { deleted: false } });
categorySchema.index({ slug: 1, website: 1 }, { unique: true, partialFilterExpression: { deleted: false } });
categorySchema.index({ categoryId: 1, website: 1 }, { unique: true, sparse: true, partialFilterExpression: { deleted: false } });
categorySchema.index({ website: 1, isActive: 1, deleted: 1 });

export default mongoose.model('Category', categorySchema);
