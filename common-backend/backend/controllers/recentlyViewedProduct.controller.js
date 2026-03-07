import RecentlyViewedProduct from "../models/recentlyViewedProduct.model.js"
import Product from "../models/product.model.js"
import mongoose from "mongoose"

const MAX_RECENT_PER_USER = 50

/**
 * Record a product view. Called by the client when a user views a product page.
 * Requires auth; scoped to user + website. Re-viewing the same product updates viewedAt.
 */
export const recordView = async (req, res) => {
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
        msg: "You must be logged in to record recently viewed products",
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

    const now = new Date()
    await RecentlyViewedProduct.findOneAndUpdate({ user: userId, product: productId, website: websiteId }, { viewedAt: now }, { upsert: true, new: true })

    // Keep only the last MAX_RECENT_PER_USER per user per website
    const all = await RecentlyViewedProduct.find({
      user: userId,
      website: websiteId,
    })
      .sort({ viewedAt: -1 })
      .select("_id")
      .lean()
    if (all.length > MAX_RECENT_PER_USER) {
      const toRemove = all.slice(MAX_RECENT_PER_USER).map((d) => d._id)
      await RecentlyViewedProduct.deleteMany({ _id: { $in: toRemove } })
    }

    res.status(200).json({
      msg: "View recorded",
      productId: product._id,
      viewedAt: now,
    })
  } catch (err) {
    console.error("recordView error:", err)
    res.status(500).json({
      msg: "Failed to record product view",
      error: err.message,
    })
  }
}

/**
 * Get recently viewed products for the current user (personalized), most recent first.
 */
export const getRecent = async (req, res) => {
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
        msg: "You must be logged in to see recently viewed products",
        error: "UNAUTHORIZED",
      })
    }

    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50)
    const recent = await RecentlyViewedProduct.find({
      user: userId,
      website: websiteId,
    })
      .sort({ viewedAt: -1 })
      .limit(limit)
      .populate({
        path: "product",
        select: "name slug mainImage images price discountedPrice discountPercentage isActive deleted website",
        match: { deleted: false, isActive: true, website: websiteId },
      })
      .lean()

    // Filter out entries where product was removed or populated as null
    const items = recent
      .filter((r) => r.product)
      .map(({ product, viewedAt }) => ({
        product,
        viewedAt,
      }))

    res.json({
      items,
      count: items.length,
    })
  } catch (err) {
    console.error("getRecent error:", err)
    res.status(500).json({
      msg: "Failed to get recently viewed products",
      error: err.message,
    })
  }
}

/**
 * Clear all recently viewed products for the current user (and website).
 */
export const clearRecent = async (req, res) => {
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
        msg: "You must be logged in to clear recently viewed products",
        error: "UNAUTHORIZED",
      })
    }

    const result = await RecentlyViewedProduct.deleteMany({
      user: userId,
      website: websiteId,
    })

    res.json({
      msg: "Recently viewed products cleared",
      deletedCount: result.deletedCount,
    })
  } catch (err) {
    console.error("clearRecent error:", err)
    res.status(500).json({
      msg: "Failed to clear recently viewed products",
      error: err.message,
    })
  }
}
