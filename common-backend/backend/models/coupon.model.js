import mongoose from 'mongoose';

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ["single", "bulk"],
      default: "single",
    },
    usageType: {
      type: String,
      enum: ["single", "multiple"],
      default: "single",
    },
    discountType: {
      type: String,
      enum: ["percentage", "flat"],
      required: true,
    },
    discountValue: {
      type: Number,
      required: true,
    },
    minPurchase: {
      type: Number,
      default: 0,
    },
    startDate: {
      type: Date,
      default: null,
    },
    expiryDate: {
      type: Date,
      required: true,
    },
    // Bulk coupon generation fields
    numberOfCodes: {
      type: Number,
      default: null,
    },
    codeLength: {
      type: Number,
      default: null,
    },
    prefix: {
      type: String,
      default: null,
      uppercase: true,
      trim: true,
    },
    suffix: {
      type: String,
      default: null,
      uppercase: true,
      trim: true,
    },
    codeGenerationType: {
      type: String,
      enum: ["custom", "alphabet", "numbers", "alphanumeric"],
      default: "alphanumeric",
    },
    useSeparator: {
      type: Boolean,
      default: false,
    },
    separatorLength: {
      type: Number,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    used: {
      type: Boolean,
      default: false,
    },
    deleted: {
      type: Boolean,
      default: false,
    },
    // Multi-tenant: Website/Tenant reference
    website: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Website',
      required: true,
      index: true
    },
  },
  { timestamps: true }
);

// Virtual field to check if coupon is expired
couponSchema.virtual('isExpired').get(function() {
  if (!this.expiryDate) return false;
  return new Date(this.expiryDate) < new Date();
});

// Pre-save hook to automatically set isActive to false if expired
couponSchema.pre('save', function(next) {
  if (this.expiryDate && new Date(this.expiryDate) < new Date() && this.isActive && !this.deleted) {
    this.isActive = false;
  }
  next();
});

// Compound unique index on code for non-deleted coupons within a website
couponSchema.index({ code: 1, website: 1 }, { unique: true, partialFilterExpression: { deleted: false } });
couponSchema.index({ website: 1, deleted: 1, isActive: 1 });
couponSchema.index({ website: 1, expiryDate: 1 });

export default mongoose.model("Coupon", couponSchema);
