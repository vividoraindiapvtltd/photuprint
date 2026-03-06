import mongoose from "mongoose"

const collarStyleSchema = new mongoose.Schema(
  {
    collarStyleId: {
      type: String,
      // Removed unique: true - will use compound index with website
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      // Removed unique: true - will use compound index with website
      required: true,
    },
    description: {
      type: String,
      default: null,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    deleted: {
      type: Boolean,
      default: false,
    },
    // Multi-tenant: Website reference
    website: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Website',
      required: true,
      index: true
    },
  },
  {
    timestamps: true,
  }
)

// Multi-tenant: Compound unique indexes scoped by website
collarStyleSchema.index({ name: 1, website: 1 }, { unique: true, partialFilterExpression: { deleted: false } });
collarStyleSchema.index({ slug: 1, website: 1 }, { unique: true, partialFilterExpression: { deleted: false } });
collarStyleSchema.index({ collarStyleId: 1, website: 1 }, { unique: true, sparse: true, partialFilterExpression: { deleted: false } });

// Performance indexes
collarStyleSchema.index({ website: 1, deleted: 1, isActive: 1 });
collarStyleSchema.index({ website: 1, name: 1 });
collarStyleSchema.index({ createdAt: -1 });

// Pre-save middleware to generate slug
collarStyleSchema.pre("save", function (next) {
  if (this.isModified("name")) {
    this.slug = this.name
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^\w\-]+/g, "")
  }
  next()
})

export default mongoose.model("CollarStyle", collarStyleSchema)
