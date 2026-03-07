import mongoose from "mongoose"

const recentlyViewedProductSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    website: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Website",
      required: true,
      index: true,
    },
    viewedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true },
)

// One record per user+product+website; re-viewing updates viewedAt
recentlyViewedProductSchema.index({ user: 1, product: 1, website: 1 }, { unique: true })
// List recent views for a user on a website (most recent first)
recentlyViewedProductSchema.index({ user: 1, website: 1, viewedAt: -1 })

const RecentlyViewedProduct = mongoose.model("RecentlyViewedProduct", recentlyViewedProductSchema)
export default RecentlyViewedProduct
