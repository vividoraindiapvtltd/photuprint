import mongoose from "mongoose"

const wishlistSchema = new mongoose.Schema(
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
    addedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true },
)

// One record per user+product+website
wishlistSchema.index({ user: 1, product: 1, website: 1 }, { unique: true })
// List wishlist for a user on a website (most recent first)
wishlistSchema.index({ user: 1, website: 1, addedAt: -1 })

const Wishlist = mongoose.model("Wishlist", wishlistSchema)
export default Wishlist
