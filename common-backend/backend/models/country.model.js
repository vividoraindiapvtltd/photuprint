import mongoose from 'mongoose';

const countrySchema = new mongoose.Schema({
  name: { type: String, required: true }, // Removed unique: true - will use compound index with website
  code: { type: String, required: true, uppercase: true, maxlength: 3 }, // Removed unique: true - will use compound index with website
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
countrySchema.index({ name: 1, website: 1 }, { unique: true, partialFilterExpression: { deleted: false } });
countrySchema.index({ code: 1, website: 1 }, { unique: true, partialFilterExpression: { deleted: false } });

// Performance indexes
countrySchema.index({ website: 1, deleted: 1, isActive: 1 });
countrySchema.index({ website: 1, name: 1 });
countrySchema.index({ createdAt: -1 });

export default mongoose.model('Country', countrySchema);
