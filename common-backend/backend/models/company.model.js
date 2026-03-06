import mongoose from 'mongoose';

const companySchema = new mongoose.Schema(
  {
    name: { 
      type: String, 
      required: true 
    },
    address: {
      street: { type: String, default: null },
      city: { type: String, default: null },
      state: { type: String, default: null },
      zipCode: { type: String, default: null },
      country: { type: String, default: null },
    },
    phone: { 
      type: String, 
      default: null 
    },
    email: { 
      type: String, 
      default: null 
    },
    websiteUrl: { 
      type: String, 
      default: null 
    },
    website: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Website',
      default: null
    },
    domain: {
      type: String,
      default: null,
      trim: true,
      lowercase: true
    },
    gstNumber: { 
      type: String, 
      default: null 
    },
    panNumber: { 
      type: String, 
      default: null 
    },
    logo: { 
      type: String, 
      default: null 
    },
    footerText: { 
      type: String, 
      default: null 
    },
    isActive: { 
      type: Boolean, 
      default: true 
    },
    isDefault: { 
      type: Boolean, 
      default: false 
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

// Create index for default company per website (should be unique for active companies per website)
companySchema.index({ website: 1, isDefault: 1 }, { partialFilterExpression: { deleted: false, isActive: true } });
companySchema.index({ domain: 1, isDefault: 1 }, { partialFilterExpression: { deleted: false, isActive: true } });

// Create indexes for better search performance
companySchema.index({ name: 1 });
companySchema.index({ website: 1 });
companySchema.index({ domain: 1 });
companySchema.index({ deleted: 1, isActive: 1 });

export default mongoose.model('Company', companySchema);
