import mongoose from "mongoose";

const lengthSchema = new mongoose.Schema(
  {
    name: {
      type: Number,
      required: true
    },
    unit: {
      type: String,
      enum: ["millimeters", "centimeters", "inches", "feet", "meters"],
      default: "centimeters"
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
  { timestamps: true }
);

// Multi-tenant: Prevent duplicate (name + unit + website) for non-deleted records
lengthSchema.index(
  { name: 1, unit: 1, website: 1 },
  { unique: true, partialFilterExpression: { deleted: false } }
);

// Performance indexes
lengthSchema.index({ website: 1, deleted: 1, isActive: 1 });
lengthSchema.index({ website: 1, name: 1 });
lengthSchema.index({ website: 1, unit: 1 });
lengthSchema.index({ createdAt: -1 });

export default mongoose.model("Length", lengthSchema);
