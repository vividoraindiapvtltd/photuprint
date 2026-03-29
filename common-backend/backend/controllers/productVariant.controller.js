import ProductVariant from "../models/productVariant.model.js"
import Product from "../models/product.model.js"
import mongoose from "mongoose"
import { variantStockExceedsProductStock } from "../utils/productStockValidation.js"
import {
  uploadBufferToCloudinary,
  uploadLocalFileToCloudinary,
  uploadMulterFilesToCloudinary,
  uploadMulterMemoryFilesToCloudinary,
  resourceTypeFromMime,
  removeLocalFiles,
} from "../utils/cloudinaryUpload.js"

/**
 * Generate all possible variant combinations from selected attributes
 * Example: Size: [S, M, L], Color: [Red, Blue] => 6 combinations
 */
export const generateVariantCombinations = (attributes) => {
  const attributeKeys = Object.keys(attributes)
  const attributeValues = attributeKeys.map(key => attributes[key])
  
  if (attributeValues.length === 0) return []
  
  // Generate cartesian product
  const combinations = attributeValues.reduce((acc, values) => {
    const result = []
    acc.forEach(accItem => {
      values.forEach(value => {
        result.push([...accItem, value])
      })
    })
    return result
  }, [[]])
  
  // Convert to objects
  return combinations.map(combination => {
    const variant = {}
    attributeKeys.forEach((key, index) => {
      variant[key] = combination[index]
    })
    return variant
  })
}

/**
 * Create product variants
 * POST /api/products/:productId/variants
 */
export const createVariants = async (req, res) => {
  try {
    const { productId } = req.params
    
    if (!req.websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }
    
    // Find product
    const product = await Product.findOne({
      _id: productId,
      website: req.websiteId,
      deleted: false
    })
    
    if (!product) {
      return res.status(404).json({ msg: "Product not found" })
    }
    
    const { attributes, variants } = req.body
    
    // If attributes provided, generate combinations
    let variantData = []
    if (attributes && Object.keys(attributes).length > 0) {
      const combinations = generateVariantCombinations(attributes)
      
      // Generate base SKU from product
      const baseSku = product.sku || product.productId || `PROD-${productId.toString().substring(18, 26)}`
      
      const rawProductSizes = product.sizes || []
      const productSizeIds = rawProductSizes.map((s) =>
        typeof s === "object" && s?._id ? s._id : s
      ).filter(Boolean)

      variantData = combinations.map((combo, index) => {
        // Generate SKU from attribute IDs (last 4 chars of each ID)
        const attrValues = Object.values(combo)
          .map(val => {
            const idStr = String(val)
            // Use last 4 characters of the ID
            return idStr.substring(idStr.length - 4).toUpperCase()
          })
          .join("-")
        
        // Create unique SKU: BASE-ATTR1-ATTR2-VAR001
        const variantSku = `${baseSku}-${attrValues}-${String(index + 1).padStart(3, '0')}`
        
        const productUnlimited = product.stock != null && Number(product.stock) < 0
        const keys = Object.keys(combo)
        const isColorOnly =
          keys.length === 1 && keys[0] === "color" && combo.color != null

        const row = {
          product: productId,
          attributes: new Map(Object.entries(combo)),
          price: product.price || 0,
          discountedPrice: product.discountedPrice != null ? product.discountedPrice : null,
          stock: productUnlimited ? -1 : 0,
          sku: variantSku, // Set SKU explicitly to avoid validation error
          website: req.websiteId,
          isActive: true
        }

        if (isColorOnly && productSizeIds.length > 0) {
          row.sizeStock = productSizeIds.map((size) => ({
            size,
            stock: productUnlimited ? -1 : 0,
          }))
          row.stock = productUnlimited ? -1 : 0
        }

        return row
      })
    } else if (variants && Array.isArray(variants)) {
      // If variants array provided directly
      variantData = variants.map(variant => ({
        product: productId,
        attributes: new Map(Object.entries(variant.attributes || {})),
        price: variant.price || product.price || 0,
        discountedPrice: variant.discountedPrice || null,
        stock: variant.stock || 0,
        sku: variant.sku || null,
        images: variant.images || [],
        primaryImage: variant.primaryImage || null,
        lowStockThreshold: variant.lowStockThreshold || 10,
        weight: variant.weight || null,
        barcode: variant.barcode || null,
        website: req.websiteId,
        isActive: variant.isActive !== undefined ? variant.isActive : true
      }))
    } else {
      return res.status(400).json({ 
        msg: "Either 'attributes' object or 'variants' array is required" 
      })
    }
    
    // Check for duplicates
    const createdVariants = []
    const errors = []
    
    const productStock = product.stock
    
    for (const variantDataItem of variantData) {
      try {
        const variantStock = variantDataItem.stock ?? 0
        const vs = Number(variantStock)
        if (!Number.isNaN(vs) && vs < 0 && productStock != null && Number(productStock) >= 0) {
          errors.push({
            attributes: Object.fromEntries(variantDataItem.attributes),
            error: "Unlimited variant quantity (-1) is only allowed when product inventory is unlimited.",
          })
          continue
        }
        if (variantStockExceedsProductStock(variantStock, productStock)) {
          errors.push({
            attributes: Object.fromEntries(variantDataItem.attributes),
            error: `Variant stock (${variantStock}) cannot be greater than product stock (${productStock ?? 0})`
          })
          continue
        }
        
        // Check for duplicate
        const duplicate = await ProductVariant.findDuplicate(
          productId,
          variantDataItem.attributes,
          req.websiteId
        )
        
        if (duplicate) {
          errors.push({
            attributes: Object.fromEntries(variantDataItem.attributes),
            error: "Duplicate variant combination already exists"
          })
          continue
        }
        
        // Ensure SKU is unique - check if it already exists
        let finalSku = variantDataItem.sku
        let skuCounter = 1
        while (await ProductVariant.findOne({ 
          sku: finalSku, 
          website: req.websiteId, 
          deleted: false 
        })) {
          // Append counter to make it unique
          const baseSku = variantDataItem.sku.replace(/-\d{3}$/, '') // Remove existing counter
          finalSku = `${baseSku}-${String(skuCounter).padStart(3, '0')}`
          skuCounter++
        }
        
        variantDataItem.sku = finalSku
        
        const variant = new ProductVariant(variantDataItem)
        await variant.save()
        createdVariants.push(variant)
      } catch (error) {
        console.error("Error creating variant:", error)
        errors.push({
          attributes: Object.fromEntries(variantDataItem.attributes),
          error: error.message
        })
      }
    }
    
    // Update product to enable variations
    if (createdVariants.length > 0) {
      product.hasVariations = true
      if (attributes) {
        product.variationAttributes = Object.keys(attributes)
      }
      if (!product.defaultVariant && createdVariants.length > 0) {
        product.defaultVariant = createdVariants[0]._id
      }
      await product.save()
    }
    
    res.status(201).json({
      msg: `Created ${createdVariants.length} variant(s)`,
      variants: createdVariants,
      errors: errors.length > 0 ? errors : undefined
    })
  } catch (error) {
    console.error("Error creating variants:", error)
    res.status(500).json({ msg: "Failed to create variants", error: error.message })
  }
}

/**
 * Get all variants for a product
 * GET /api/products/:productId/variants
 */
export const getProductVariants = async (req, res) => {
  try {
    const { productId } = req.params
    const { includeDeleted = 'false' } = req.query
    
    if (!req.websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }
    
    const query = {
      product: productId,
      website: req.websiteId
    }
    
    if (includeDeleted === 'false') {
      query.deleted = false
    }
    
    const variants = await ProductVariant.find(query).sort({ createdAt: -1 })
    
    // Convert Map attributes to plain objects for JSON serialization
    const variantsWithPlainAttributes = variants.map(variant => {
      const variantObj = variant.toObject ? variant.toObject() : JSON.parse(JSON.stringify(variant))
      
      // Convert Map to plain object - handle both Map instances and serialized Maps
      if (variantObj.attributes) {
        if (variantObj.attributes instanceof Map) {
          variantObj.attributes = Object.fromEntries(variantObj.attributes)
        } else if (variantObj.attributes.constructor && variantObj.attributes.constructor.name === 'Map') {
          // Handle serialized Map
          variantObj.attributes = Object.fromEntries(variantObj.attributes)
        } else if (typeof variantObj.attributes === 'object' && !Array.isArray(variantObj.attributes)) {
          // Already an object, ensure it's a plain object
          variantObj.attributes = { ...variantObj.attributes }
        }
      } else {
        variantObj.attributes = {}
      }
      
      return variantObj
    })
    
    console.log(`Found ${variantsWithPlainAttributes.length} variants for product ${productId}`)
    if (variantsWithPlainAttributes.length > 0) {
      console.log("Sample variant attributes:", JSON.stringify(variantsWithPlainAttributes[0].attributes))
    }
    
    // Calculate aggregated stats (exclude unlimited stock variants with stock === -1)
    const totalStock = variantsWithPlainAttributes.reduce((sum, v) => {
      if (v.stock === -1) return sum; // Skip unlimited stock
      return sum + (v.stock || 0);
    }, 0)
    const activeVariants = variantsWithPlainAttributes.filter(v => v.isActive).length
    const outOfStockVariants = variantsWithPlainAttributes.filter(v => v.isOutOfStock).length
    const lowStockVariants = variantsWithPlainAttributes.filter(v => v.stock !== -1 && v.stock > 0 && v.stock <= (v.lowStockThreshold || 10)).length
    
    res.json({
      variants: variantsWithPlainAttributes,
      stats: {
        total: variantsWithPlainAttributes.length,
        active: activeVariants,
        outOfStock: outOfStockVariants,
        lowStock: lowStockVariants,
        totalStock
      }
    })
  } catch (error) {
    console.error("Error fetching variants:", error)
    res.status(500).json({ msg: "Failed to fetch variants", error: error.message })
  }
}

/**
 * Get single variant
 * GET /api/variants/:variantId
 */
export const getVariantById = async (req, res) => {
  try {
    const { variantId } = req.params
    
    if (!req.websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }
    
    const variant = await ProductVariant.findOne({
      _id: variantId,
      website: req.websiteId,
      deleted: false
    }).populate("product", "name productId")
    
    if (!variant) {
      return res.status(404).json({ msg: "Variant not found" })
    }
    
    res.json(variant)
  } catch (error) {
    console.error("Error fetching variant:", error)
    res.status(500).json({ msg: "Failed to fetch variant", error: error.message })
  }
}

/**
 * Update variant
 * PUT /api/variants/:variantId
 */
export const updateVariant = async (req, res) => {
  try {
    const { variantId } = req.params
    
    if (!req.websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }
    
    const variant = await ProductVariant.findOne({
      _id: variantId,
      website: req.websiteId,
      deleted: false
    })
    
    if (!variant) {
      return res.status(404).json({ msg: "Variant not found" })
    }
    
    // Handle primary image upload (if provided) — memory buffer → Cloudinary (no disk temp file)
    if (req.files && req.files.primaryImage && req.files.primaryImage.length > 0) {
      try {
        const file = req.files.primaryImage[0]
        if (file.buffer && file.buffer.length > 0) {
          variant.primaryImage = await uploadBufferToCloudinary(file.buffer, {
            folder: "photuprint/variants",
            resource_type: resourceTypeFromMime(file.mimetype),
          })
        } else if (file.path) {
          variant.primaryImage = await uploadLocalFileToCloudinary(file.path, {
            folder: "photuprint/variants",
          })
        } else {
          return res.status(400).json({ msg: "Primary image file is empty or invalid" })
        }
        console.log("Primary image uploaded to Cloudinary:", variant.primaryImage)
      } catch (uploadError) {
        console.error("Cloudinary upload failed:", uploadError)
        removeLocalFiles(req.files.primaryImage)
        return res.status(503).json({
          msg: uploadError.message || "Image upload failed. Configure Cloudinary (CLOUDINARY_URL or CLOUDINARY_* env vars).",
        })
      }
    }

    // Handle additional images uploads (if provided)
    if (req.files && req.files.images && req.files.images.length > 0) {
      try {
        const mem = req.files.images[0]?.buffer
        const newImageUrls =
          mem && mem.length > 0
            ? await uploadMulterMemoryFilesToCloudinary(req.files.images, { folder: "photuprint/variants" })
            : await uploadMulterFilesToCloudinary(req.files.images, { folder: "photuprint/variants" })
        const existingImages = Array.isArray(variant.images)
          ? variant.images.filter((img) => typeof img === "string" && img.length > 0)
          : []
        variant.images = [...existingImages, ...newImageUrls].slice(0, 9)
        variant.markModified("images")
        console.log("Additional images uploaded to Cloudinary:", newImageUrls)
      } catch (uploadError) {
        console.error("Cloudinary upload failed:", uploadError)
        removeLocalFiles(req.files.images)
        return res.status(503).json({
          msg: uploadError.message || "Image upload failed. Configure Cloudinary (CLOUDINARY_URL or CLOUDINARY_* env vars).",
        })
      }
    }
    
    // Update fields from req.body (JSON body is only reliable when multer is skipped for non-multipart PUTs)
    const body = req.body && typeof req.body === "object" ? req.body : {}
    let {
      price,
      discountedPrice,
      stock,
      sku,
      images,
      primaryImage,
      isActive,
      lowStockThreshold,
      weight,
      barcode,
      attributes,
      sizeStock,
    } = body

    if (typeof images === "string") {
      try {
        images = JSON.parse(images)
      } catch {
        images = undefined
      }
    }
    if (typeof attributes === "string") {
      try {
        attributes = JSON.parse(attributes)
      } catch {
        attributes = undefined
      }
    }
    if (typeof sizeStock === "string") {
      try {
        sizeStock = JSON.parse(sizeStock)
      } catch {
        sizeStock = undefined
      }
    }
    if (primaryImage === "null" || primaryImage === "") {
      primaryImage = null
    }

    // Multer multipart sends scalar fields as strings — coerce for validation and Mongoose
    if (price !== undefined && price !== "") {
      const p = typeof price === "string" ? parseFloat(price) : price
      price = Number.isNaN(p) ? undefined : p
    }
    if (stock !== undefined && stock !== "") {
      const s = typeof stock === "string" ? parseInt(stock, 10) : stock
      stock = Number.isNaN(s) ? undefined : s
    }
    if (isActive !== undefined) {
      if (isActive === "true" || isActive === true) isActive = true
      else if (isActive === "false" || isActive === false) isActive = false
    }
    if (discountedPrice !== undefined && discountedPrice !== "") {
      const dp = typeof discountedPrice === "string" ? parseFloat(discountedPrice) : discountedPrice
      discountedPrice = Number.isNaN(dp) ? undefined : dp
    } else if (discountedPrice === "" || discountedPrice === "null") {
      discountedPrice = null
    }

    console.log("Updating variant:", variantId, "with body:", {
      price,
      stock,
      sku,
      isActive,
      imagesCount: images != null ? (Array.isArray(images) ? images.length : 0) : undefined,
      primaryImage: primaryImage != null && typeof primaryImage === "string" ? primaryImage.substring(0, 50) + "..." : primaryImage,
      sizeStockLen: Array.isArray(sizeStock) ? sizeStock.length : undefined,
    })

    const product = await Product.findById(variant.product)

    if (Array.isArray(sizeStock)) {
      const cleaned = []
      for (const row of sizeStock) {
        if (!row || row.size == null) continue
        const sid =
          typeof row.size === "object" && row.size._id != null ? row.size._id : row.size
        const rawSt = row.stock === "" || row.stock === undefined ? 0 : row.stock
        const st = typeof rawSt === "string" ? parseInt(rawSt, 10) : rawSt
        const n = Number.isNaN(Number(st)) ? 0 : Number(st)
        cleaned.push({ size: sid, stock: n })
      }
      variant.sizeStock = cleaned
      variant.markModified("sizeStock")
      if (cleaned.length > 0) {
        let sum = 0
        let anyUnlimited = false
        for (const r of cleaned) {
          const n = Number(r.stock)
          if (n === -1) {
            anyUnlimited = true
            break
          }
          if (Number.isFinite(n) && n >= 0) sum += n
        }
        const computed = anyUnlimited ? -1 : sum
        if (product) {
          if (!Number.isNaN(Number(computed)) && computed < 0 && product.stock != null && Number(product.stock) >= 0) {
            return res.status(400).json({
              msg: "Unlimited variant quantity (-1) is only allowed when product inventory is unlimited.",
            })
          }
          if (variantStockExceedsProductStock(computed, product.stock)) {
            return res.status(400).json({
              msg: `Variant stock (${computed}) cannot be greater than product stock (${product.stock ?? 0})`,
            })
          }
        }
        variant.stock = computed
        variant.isOutOfStock = computed === 0
      }
    } else if (stock !== undefined) {
      if (product) {
        const s = Number(stock)
        if (!Number.isNaN(s) && s < 0 && product.stock != null && Number(product.stock) >= 0) {
          return res.status(400).json({
            msg: "Unlimited variant quantity (-1) is only allowed when product inventory is unlimited.",
          })
        }
        if (variantStockExceedsProductStock(stock, product.stock)) {
          return res.status(400).json({ 
            msg: `Variant stock (${stock}) cannot be greater than product stock (${product.stock ?? 0})` 
          })
        }
      }
      variant.stock = stock
      variant.isOutOfStock = stock === 0
    }
    
    if (price !== undefined && price !== null && !Number.isNaN(Number(price))) {
      variant.price = Number(price)
    }
    if (discountedPrice !== undefined) {
      variant.discountedPrice = discountedPrice === null ? null : Number(discountedPrice)
      variant.markModified("discountedPrice")
    }
    // Required field — never persist empty sku (multipart often sends "")
    if (sku !== undefined && sku !== null && String(sku).trim() !== "") {
      variant.sku = String(sku).trim()
    }
    // Only update images from body if no new image files were uploaded in this request
    if (images !== undefined && (!req.files || !req.files.images || req.files.images.length === 0)) {
      const validImages = Array.isArray(images)
        ? images.filter((img) => img && typeof img === "string" && !img.startsWith("blob:"))
        : []
      variant.images = validImages
      variant.markModified("images")
      console.log("Updated images from body:", validImages.length, "valid images")
    }
    // Only update primaryImage from body if no primary file was uploaded in this request
    if (primaryImage !== undefined && (!req.files || !req.files.primaryImage || req.files.primaryImage.length === 0)) {
      if (primaryImage && typeof primaryImage === "string" && !primaryImage.startsWith("blob:")) {
        variant.primaryImage = primaryImage
        variant.markModified("primaryImage")
        console.log("Updated primaryImage from body:", primaryImage.substring(0, 50))
      } else if (primaryImage === null || primaryImage === "") {
        variant.set("primaryImage", null)
        variant.markModified("primaryImage")
        console.log("Removed primaryImage")
      }
    }
    if (isActive !== undefined) variant.isActive = isActive
    if (lowStockThreshold !== undefined) variant.lowStockThreshold = lowStockThreshold
    if (weight !== undefined) variant.weight = weight
    if (barcode !== undefined) variant.barcode = barcode
    
    // Update attributes (check for duplicates) — only plain objects / Maps
    if (attributes && typeof attributes === "object" && !Array.isArray(attributes)) {
      const newAttributes = new Map(Object.entries(attributes))
      const duplicate = await ProductVariant.findDuplicate(
        variant.product,
        newAttributes,
        req.websiteId,
        variantId
      )
      
      if (duplicate) {
        return res.status(400).json({ 
          msg: "Variant with these attributes already exists",
          duplicateVariantId: duplicate._id
        })
      }
      
      variant.attributes = newAttributes
    }
    
    const savedVariant = await variant.save()
    console.log("Variant saved successfully:", savedVariant._id, {
      price: savedVariant.price,
      stock: savedVariant.stock,
      sku: savedVariant.sku,
      isActive: savedVariant.isActive,
      imagesCount: savedVariant.images ? savedVariant.images.length : 0,
      hasPrimaryImage: !!savedVariant.primaryImage
    });
    
    res.json({
      msg: "Variant updated successfully",
      variant: savedVariant
    })
  } catch (error) {
    console.error("Error updating variant:", error)
    console.error("Error stack:", error.stack)
    if (error.name === "ValidationError") {
      return res.status(400).json({
        msg: "Validation failed",
        error: error.message,
        details: error.errors,
      })
    }
    res.status(500).json({ msg: "Failed to update variant", error: error.message })
  }
}

/**
 * Update variant stock
 * PATCH /api/variants/:variantId/stock
 */
export const updateVariantStock = async (req, res) => {
  try {
    const { variantId } = req.params
    const { stock, operation } = req.body // operation: 'set', 'add', 'subtract'
    
    if (!req.websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }
    
    const variant = await ProductVariant.findOne({
      _id: variantId,
      website: req.websiteId,
      deleted: false
    })
    
    if (!variant) {
      return res.status(404).json({ msg: "Variant not found" })
    }
    
    // Fetch product to get stock limit
    const product = await Product.findById(variant.product)
    if (!product) {
      return res.status(404).json({ msg: "Product not found" })
    }
    
    const productStock = product.stock
    let newStock
    
    if (operation === "add") {
      newStock = (variant.stock || 0) + stock
    } else if (operation === "subtract") {
      newStock = Math.max(0, (variant.stock || 0) - stock)
    } else {
      newStock = stock
    }
    
    const ns = Number(newStock)
    if (!Number.isNaN(ns) && ns < 0 && productStock != null && Number(productStock) >= 0) {
      return res.status(400).json({
        msg: "Unlimited variant quantity (-1) is only allowed when product inventory is unlimited.",
      })
    }
    
    if (variantStockExceedsProductStock(newStock, productStock)) {
      return res.status(400).json({ 
        msg: `Variant stock (${newStock}) cannot be greater than product stock (${productStock ?? 0})` 
      })
    }
    
    variant.stock = newStock
    variant.isOutOfStock = variant.stock === 0
    await variant.save()
    
    res.json({
      msg: "Stock updated successfully",
      variant
    })
  } catch (error) {
    console.error("Error updating stock:", error)
    res.status(500).json({ msg: "Failed to update stock", error: error.message })
  }
}

/**
 * Enable/Disable variant
 * PATCH /api/variants/:variantId/status
 */
export const updateVariantStatus = async (req, res) => {
  try {
    const { variantId } = req.params
    const { isActive } = req.body
    
    if (!req.websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }
    
    const variant = await ProductVariant.findOne({
      _id: variantId,
      website: req.websiteId,
      deleted: false
    })
    
    if (!variant) {
      return res.status(404).json({ msg: "Variant not found" })
    }
    
    variant.isActive = isActive !== undefined ? isActive : !variant.isActive
    await variant.save()
    
    res.json({
      msg: `Variant ${variant.isActive ? "enabled" : "disabled"} successfully`,
      variant
    })
  } catch (error) {
    console.error("Error updating variant status:", error)
    res.status(500).json({ msg: "Failed to update variant status", error: error.message })
  }
}

/**
 * Delete variant (soft delete)
 * DELETE /api/variants/:variantId
 */
export const deleteVariant = async (req, res) => {
  try {
    const { variantId } = req.params
    
    if (!req.websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }
    
    const variant = await ProductVariant.findOne({
      _id: variantId,
      website: req.websiteId,
      deleted: false
    })
    
    if (!variant) {
      return res.status(404).json({ msg: "Variant not found" })
    }
    
    variant.deleted = true
    variant.isActive = false
    await variant.save()
    
    res.json({ msg: "Variant deleted successfully" })
  } catch (error) {
    console.error("Error deleting variant:", error)
    res.status(500).json({ msg: "Failed to delete variant", error: error.message })
  }
}

/**
 * Hard delete variant (permanent delete)
 * DELETE /api/variants/:variantId/hard
 */
export const hardDeleteVariant = async (req, res) => {
  try {
    const { variantId } = req.params
    
    if (!req.websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }
    
    const variant = await ProductVariant.findOne({
      _id: variantId,
      website: req.websiteId
    })
    
    if (!variant) {
      return res.status(404).json({ msg: "Variant not found" })
    }
    
    await ProductVariant.findByIdAndDelete(variantId)
    
    res.json({ msg: "Variant permanently deleted" })
  } catch (error) {
    console.error("Error hard deleting variant:", error)
    res.status(500).json({ msg: "Failed to permanently delete variant", error: error.message })
  }
}

/**
 * Bulk update variants
 * PUT /api/products/:productId/variants/bulk
 */
export const bulkUpdateVariants = async (req, res) => {
  try {
    const { productId } = req.params
    const { variants } = req.body // Array of { variantId, updates }
    
    if (!req.websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }
    
    // Fetch product to get stock limit
    const product = await Product.findOne({
      _id: productId,
      website: req.websiteId,
      deleted: false
    })
    
    if (!product) {
      return res.status(404).json({ msg: "Product not found" })
    }
    
    const productStock = product.stock
    const results = []
    const errors = []
    
    for (const item of variants) {
      try {
        const variant = await ProductVariant.findOne({
          _id: item.variantId,
          product: productId,
          website: req.websiteId,
          deleted: false
        })
        
        if (!variant) {
          errors.push({ variantId: item.variantId, error: "Variant not found" })
          continue
        }
        
        // Update fields
        Object.keys(item.updates || {}).forEach(key => {
          if (key === "stock") {
            const newStock = item.updates[key]
            const ns = Number(newStock)
            if (!Number.isNaN(ns) && ns < 0 && productStock != null && Number(productStock) >= 0) {
              errors.push({
                variantId: item.variantId,
                error: "Unlimited variant quantity (-1) is only allowed when product inventory is unlimited.",
              })
              return
            }
            if (variantStockExceedsProductStock(newStock, productStock)) {
              errors.push({ 
                variantId: item.variantId, 
                error: `Variant stock (${newStock}) cannot be greater than product stock (${productStock ?? 0})` 
              })
              return // Skip this variant
            }
            variant.stock = newStock
            variant.isOutOfStock = variant.stock === 0
          } else if (variant[key] !== undefined) {
            variant[key] = item.updates[key]
          }
        })
        
        // Only save if no stock validation error occurred
        if (!errors.some(e => e.variantId === item.variantId)) {
          await variant.save()
          results.push({ variantId: item.variantId, success: true })
        }
      } catch (error) {
        errors.push({ variantId: item.variantId, error: error.message })
      }
    }
    
    res.json({
      msg: `Updated ${results.length} variant(s)`,
      results,
      errors: errors.length > 0 ? errors : undefined
    })
  } catch (error) {
    console.error("Error bulk updating variants:", error)
    res.status(500).json({ msg: "Failed to bulk update variants", error: error.message })
  }
}
