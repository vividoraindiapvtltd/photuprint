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
      trim: true,
      lowercase: true,
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

    // Per-website Razorpay credentials (falls back to env vars if empty)
    razorpayKeyId: { type: String, default: null, trim: true },
    razorpayKeySecret: { type: String, default: null, trim: true },

    // Per-website Cloudinary credentials (falls back to env vars if empty)
    cloudinaryCloudName: { type: String, default: null, trim: true },
    cloudinaryApiKey: { type: String, default: null, trim: true },
    cloudinaryApiSecret: { type: String, default: null, trim: true },
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
