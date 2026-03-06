import mongoose from "mongoose";

const trackingSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      index: true
    },
    status: {
      type: String,
      required: true,
      trim: true
    },
    location: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      default: null,
      trim: true
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

// Index for efficient queries
trackingSchema.index({ orderId: 1, updatedAt: -1 });

// Virtual for formatted date
trackingSchema.virtual('formattedDate').get(function() {
  return this.updatedAt.toLocaleString();
});

// Ensure virtuals are included in JSON
trackingSchema.set('toJSON', { virtuals: true });

export default mongoose.model("Tracking", trackingSchema);
