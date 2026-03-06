import mongoose from 'mongoose';

const websiteSchema = new mongoose.Schema(
  {
    name: { 
      type: String, 
      required: true,
      trim: true
    },
    domain: { 
      type: String, 
      required: true,
      unique: true,
      trim: true,
      lowercase: true
    },
    description: { 
      type: String, 
      default: null 
    },
    logo: { 
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
  },
  {
    timestamps: true,
  }
);

// Create indexes
websiteSchema.index({ domain: 1 }, { unique: true, partialFilterExpression: { deleted: false } });
websiteSchema.index({ deleted: 1, isActive: 1 });
websiteSchema.index({ name: 1 });

export default mongoose.model('Website', websiteSchema);
