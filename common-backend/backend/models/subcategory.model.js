import mongoose from 'mongoose';

const subcategorySchema = new mongoose.Schema({
  subcategoryId: { type: String }, // Unique constraint handled by compound index with website
  name: { type: String, required: true },
  slug: { type: String, required: true },
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  categoryName: { type: String, required: true }, // Store category name directly
  categorySlug: { type: String, required: true }, // Store category slug for consistency
  description: { type: String, default: null },
  image: { type: String, default: null },
  isActive: { type: Boolean, default: true },
  deleted: { type: Boolean, default: false },
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
subcategorySchema.index({ name: 1, website: 1, categoryId: 1 }, { unique: true, partialFilterExpression: { deleted: false } });
subcategorySchema.index({ slug: 1, website: 1 }, { unique: true, partialFilterExpression: { deleted: false } });
subcategorySchema.index({ subcategoryId: 1, website: 1 }, { unique: true, sparse: true, partialFilterExpression: { deleted: false } });
subcategorySchema.index({ website: 1, categoryId: 1, isActive: 1, deleted: 1 });

export default mongoose.model('Subcategory', subcategorySchema); 