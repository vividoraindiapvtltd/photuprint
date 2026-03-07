import Wishlist from "../models/wishlist.model.js"
import Product from "../models/product.model.js"
import mongoose from "mongoose"

const MAX_WISHLIST_PER_USER = 100

/**
 * Add a product to wishlist. Requires auth; scoped to user + website.
 */
export const addToWishlist = async (req, res) => {
  try {
    const websiteId = req.websiteId || req.tenant?._id
    if (!websiteId) {
      return res.status(400).json({
        msg: "Website context is required (X-Website-Id header or domain)",
        error: "MISSING_WEBSITE",
      })
    }
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({
        msg: "You must be logged in to add items to wishlist",
        error: "UNAUTHORIZED",
      })
    }
    const { productId } = req.body
    if (!productId) {
      return res.status(400).json({
        msg: "productId is required",
        error: "MISSING_PRODUCT_ID",
      })
    }
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        msg: "Invalid product ID",
        error: "INVALID_PRODUCT_ID",
      })
    }

    const product = await Product.findOne({
      _id: productId,
      website: websiteId,
      deleted: false,
      isActive: true,
    })
    if (!product) {
      return res.status(404).json({
        msg: "Product not found or not available for this website",
        error: "PRODUCT_NOT_FOUND",
      })
    }

    const existing = await Wishlist.findOne({
      user: userId,
      product: productId,
      website: websiteId,
    })
    if (existing) {
      return res.status(200).json({
        msg: "Product already in wishlist",
        productId: product._id,
        addedAt: existing.addedAt,
      })
    }

    const now = new Date()
    await Wishlist.create({
      user: userId,
      product: productId,
      website: websiteId,
      addedAt: now,
    })

    // Enforce max items per user per website
    const all = await Wishlist.find({ user: userId, website: websiteId })
      .sort({ addedAt: -1 })
      .select("_id")
      .lean()
    if (all.length > MAX_WISHLIST_PER_USER) {
      const toRemove = all.slice(MAX_WISHLIST_PER_USER).map((d) => d._id)
      await Wishlist.deleteMany({ _id: { $in: toRemove } })
    }

    res.status(201).json({
      msg: "Added to wishlist",
      productId: product._id,
      addedAt: now,
    })
  } catch (err) {
    console.error("addToWishlist error:", err)
    res.status(500).json({
      msg: "Failed to add to wishlist",
      error: err.message,
    })
  }
}

/**
 * Remove a product from wishlist.
 */
export const removeFromWishlist = async (req, res) => {
  try {
    const websiteId = req.websiteId || req.tenant?._id
    if (!websiteId) {
      return res.status(400).json({
        msg: "Website context is required",
        error: "MISSING_WEBSITE",
      })
    }
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({
        msg: "You must be logged in to remove from wishlist",
        error: "UNAUTHORIZED",
      })
    }
    const { productId } = req.params
    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        msg: "Valid product ID is required",
        error: "INVALID_PRODUCT_ID",
      })
    }

    const result = await Wishlist.findOneAndDelete({
      user: userId,
      product: productId,
      website: websiteId,
    })

    if (!result) {
      return res.status(404).json({
        msg: "Product not found in wishlist",
        error: "NOT_IN_WISHLIST",
      })
    }

    res.json({
      msg: "Removed from wishlist",
      productId,
    })
  } catch (err) {
    console.error("removeFromWishlist error:", err)
    res.status(500).json({
      msg: "Failed to remove from wishlist",
      error: err.message,
    })
  }
}

/**
 * Get wishlist for the current user.
 */
export const getWishlist = async (req, res) => {
  try {
    const websiteId = req.websiteId || req.tenant?._id
    if (!websiteId) {
      return res.status(400).json({
        msg: "Website context is required (X-Website-Id header or domain)",
        error: "MISSING_WEBSITE",
      })
    }
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({
        msg: "You must be logged in to see your wishlist",
        error: "UNAUTHORIZED",
      })
    }

    const limit = Math.min(parseInt(req.query.limit, 10) || 50, MAX_WISHLIST_PER_USER)
    const items = await Wishlist.find({
      user: userId,
      website: websiteId,
    })
      .sort({ addedAt: -1 })
      .limit(limit)
      .populate({
        path: "product",
        select: "name slug mainImage images price discountedPrice discountPercentage isActive deleted website",
        match: { deleted: false, isActive: true, website: websiteId },
      })
      .lean()

    const products = items
      .filter((w) => w.product)
      .map(({ product, addedAt }) => ({
        product,
        addedAt,
      }))

    res.json({
      items: products,
      count: products.length,
    })
  } catch (err) {
    console.error("getWishlist error:", err)
    res.status(500).json({
      msg: "Failed to get wishlist",
      error: err.message,
    })
  }
}

/**
 * Check if a product is in the user's wishlist.
 */
export const checkInWishlist = async (req, res) => {
  try {
    const websiteId = req.websiteId || req.tenant?._id
    if (!websiteId) {
      return res.status(400).json({
        msg: "Website context is required",
        error: "MISSING_WEBSITE",
      })
    }
    const userId = req.user?.id
    if (!userId) {
      return res.status(200).json({ inWishlist: false })
    }
    const { productId } = req.params
    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        msg: "Valid product ID is required",
        error: "INVALID_PRODUCT_ID",
      })
    }

    const found = await Wishlist.findOne({
      user: userId,
      product: productId,
      website: websiteId,
    })

    res.json({ inWishlist: !!found })
  } catch (err) {
    console.error("checkInWishlist error:", err)
    res.status(500).json({
      msg: "Failed to check wishlist",
      error: err.message,
    })
  }
}

/**
 * Clear all wishlist items for the current user.
 */
export const clearWishlist = async (req, res) => {
  try {
    const websiteId = req.websiteId || req.tenant?._id
    if (!websiteId) {
      return res.status(400).json({
        msg: "Website context is required",
        error: "MISSING_WEBSITE",
      })
    }
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({
        msg: "You must be logged in to clear wishlist",
        error: "UNAUTHORIZED",
      })
    }

    const result = await Wishlist.deleteMany({
      user: userId,
      website: websiteId,
    })

    res.json({
      msg: "Wishlist cleared",
      deletedCount: result.deletedCount,
    })
  } catch (err) {
    console.error("clearWishlist error:", err)
    res.status(500).json({
      msg: "Failed to clear wishlist",
      error: err.message,
    })
  }
}
