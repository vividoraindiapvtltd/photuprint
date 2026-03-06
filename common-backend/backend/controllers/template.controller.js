import Template from "../models/template.model.js"
import Category from "../models/category.model.js"
import cloudinary from "../utils/cloudinary.js"
import { removeLocalFile } from "../utils/fileCleanup.js"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Get all templates
export const getTemplates = async (req, res) => {
  try {
    // Multi-tenant: Filter by website
    if (!req.websiteId) {
      return res.status(400).json({ msg: 'Website context is missing' });
    }

    const { search, categoryId, isActive, includeDeleted = "true" } = req.query
    
    // Include templates for this website OR legacy templates without website field
    let query = {
      $or: [
        { website: req.websiteId },
        { website: { $exists: false } },
        { website: null }
      ]
    }

    if (includeDeleted === "false") {
      query.deleted = false
    }

    if (isActive !== undefined) {
      query.isActive = isActive === "true"
    }

    if (categoryId) {
      // Need to use $and to combine with existing $or
      query = {
        $and: [
          query,
          { $or: [{ categoryId: categoryId }, { category: categoryId }] }
        ]
      }
    }

    if (search) {
      // Need to use $and to combine with existing query
      const searchCondition = { $or: [{ name: { $regex: search, $options: "i" } }, { description: { $regex: search, $options: "i" } }] }
      if (query.$and) {
        query.$and.push(searchCondition)
      } else {
        query = { $and: [query, searchCondition] }
      }
    }

    const templates = await Template.find(query).populate("category", "name categoryId").populate("categoryId", "name categoryId").sort({ createdAt: -1 })

    res.status(200).json(templates)
  } catch (error) {
    console.error("Error fetching templates:", error)
    res.status(500).json({ msg: "Failed to fetch templates" })
  }
}

// Get template by ID
export const getTemplateById = async (req, res) => {
  try {
    // Multi-tenant: Filter by website
    if (!req.websiteId) {
      return res.status(400).json({ msg: 'Website context is missing' });
    }

    const { id } = req.params
    
    // First try to find by ID and website
    let template = await Template.findOne({ _id: id, website: req.websiteId }).populate("category", "name categoryId").populate("categoryId", "name categoryId")

    // If not found, check if template exists without website (legacy template)
    if (!template) {
      const legacyTemplate = await Template.findOne({ 
        _id: id, 
        $or: [{ website: { $exists: false } }, { website: null }] 
      })
      
      if (legacyTemplate) {
        // Update legacy template with current website for future tenant isolation
        legacyTemplate.website = req.websiteId
        await legacyTemplate.save()
        
        // Re-fetch with populated fields
        template = await Template.findById(id).populate("category", "name categoryId").populate("categoryId", "name categoryId")
      }
    }

    if (!template) {
      return res.status(404).json({ msg: "Template not found" })
    }

    res.status(200).json(template)
  } catch (error) {
    console.error("Error fetching template:", error)
    res.status(500).json({ msg: "Failed to fetch template" })
  }
}

// Get templates by category
export const getTemplatesByCategory = async (req, res) => {
  try {
    // Multi-tenant: Filter by website
    if (!req.websiteId) {
      return res.status(400).json({ msg: 'Website context is missing' });
    }

    const { categoryId } = req.params
    const { isActive = "true" } = req.query

    // Include templates for this website OR legacy templates without website field
    let query = {
      $and: [
        {
          $or: [
            { website: req.websiteId },
            { website: { $exists: false } },
            { website: null }
          ]
        },
        { $or: [{ categoryId: categoryId }, { category: categoryId }] }
      ],
      deleted: false,
    }

    if (isActive === "true") {
      query.isActive = true
    }

    const templates = await Template.find(query).populate("category", "name categoryId").populate("categoryId", "name categoryId").sort({ createdAt: -1 })

    res.status(200).json(templates)
  } catch (error) {
    console.error("Error fetching templates by category:", error)
    res.status(500).json({ msg: "Failed to fetch templates" })
  }
}

// Create new template
export const createTemplate = async (req, res) => {
  try {
    // Multi-tenant: Ensure website context is available
    if (!req.websiteId) {
      return res.status(400).json({ msg: 'Website context is missing' });
    }

    console.log("Create template request body:", req.body)
    console.log("Uploaded files:", req.files)

    const { name, description, categoryId, isActive } = req.body
    // PixelCraft: accept JSON-first template document (usually sent as JSON string in FormData)
    let pixelcraftDocument = null
    try {
      if (req.body.pixelcraftDocument) {
        pixelcraftDocument =
          typeof req.body.pixelcraftDocument === "string"
            ? JSON.parse(req.body.pixelcraftDocument)
            : req.body.pixelcraftDocument
      }
    } catch (e) {
      return res.status(400).json({ msg: "Invalid pixelcraftDocument JSON" })
    }

    if (!name || !name.trim()) {
      return res.status(400).json({ msg: "Template name is required" })
    }

    if (!categoryId) {
      return res.status(400).json({ msg: "Category is required" })
    }

    // Verify category exists and belongs to the same website
    const category = await Category.findOne({ _id: categoryId, website: req.websiteId })
    if (!category) {
      return res.status(404).json({ msg: "Category not found" })
    }

    // Auto-generate Template ID (check uniqueness within website)
    let templateId
    let counter = 1001

    do {
      templateId = `PPSTEMPL${counter}`
      const existingTemplateId = await Template.findOne({ templateId: templateId, website: req.websiteId })
      if (!existingTemplateId) {
        break
      }
      counter++
    } while (true)

    // Handle multiple file uploads - categorize into Background and Logo
    let backgroundImageUrls = []
    let logoImageUrls = []
    let previewImageUrl = null

    if (req.files) {
      console.log("Files received:", Object.keys(req.files))

      // Helper function to upload files to Cloudinary
      const uploadFiles = async (files, folder) => {
        const urls = []
        const filesArray = Array.isArray(files) ? files : [files]
        for (const file of filesArray) {
          if (file && file.path) {
            try {
              const result = await cloudinary.uploader.upload(file.path, {
                folder: `templates/${folder}`,
                resource_type: "auto",
              })
              urls.push(result.secure_url)
              removeLocalFile(file.path)
              console.log(`Uploaded ${folder} image to Cloudinary:`, result.secure_url)
            } catch (uploadError) {
              console.error(`${folder} upload error:`, uploadError)
              throw uploadError
            }
          }
        }
        return urls
      }

      // Handle background images
      if (req.files.backgroundImages) {
        try {
          backgroundImageUrls = await uploadFiles(req.files.backgroundImages, "backgrounds")
        } catch (uploadError) {
          return res.status(500).json({ msg: "Failed to upload background images to Cloudinary" })
        }
      }

      // Handle logo images
      if (req.files.logoImages) {
        try {
          logoImageUrls = await uploadFiles(req.files.logoImages, "logos")
        } catch (uploadError) {
          return res.status(500).json({ msg: "Failed to upload logo images to Cloudinary" })
        }
      }

      // Handle preview image (optional - can use first template image if not provided) - CLOUDINARY or local fallback
      if (req.files.previewImage) {
        const previewFile = Array.isArray(req.files.previewImage) ? req.files.previewImage[0] : req.files.previewImage

        if (previewFile && previewFile.path) {
          try {
            const result = await cloudinary.uploader.upload(previewFile.path, {
              folder: "templates/previews",
              resource_type: "image",
            })
            previewImageUrl = result.secure_url
            removeLocalFile(previewFile.path)
            console.log("Uploaded preview image to Cloudinary:", previewImageUrl)
          } catch (uploadError) {
            console.error("Preview image upload error:", uploadError.message || uploadError)
            // Fallback: use local upload URL when Cloudinary is not configured (e.g. missing api_key)
            if (previewFile.filename) {
              previewImageUrl = `${req.protocol}://${req.get("host")}/uploads/${previewFile.filename}`
              console.log("Using local preview image:", previewImageUrl)
            }
          }
        }
      }
    }

    // Require at least one image for legacy templates.
    // PixelCraft templates may be JSON-first and not require background/logo assets to exist at creation.
    if (!pixelcraftDocument && backgroundImageUrls.length === 0 && logoImageUrls.length === 0) {
      return res.status(400).json({ msg: "At least one template image is required (Background or Logo)" })
    }

    // If no preview image provided, use first available image as preview
    if (!previewImageUrl) {
      if (backgroundImageUrls.length > 0) {
        previewImageUrl = backgroundImageUrls[0]
      } else if (logoImageUrls.length > 0) {
        previewImageUrl = logoImageUrls[0]
      }
    }

    const template = new Template({
      templateId,
      name: name.trim(),
      description: description?.trim() || null,
      categoryId: categoryId,
      category: categoryId,
      categoryName: category.name, // Store category name directly
      backgroundImages: backgroundImageUrls,
      logoImages: logoImageUrls,
      textOption: req.body.textOption === "true" || req.body.textOption === true,
      previewImage: previewImageUrl,
      isActive: isActive === "true" || isActive === true,
      pixelcraftDocument,
      pixelcraftStatus: pixelcraftDocument ? "draft" : undefined,
      website: req.websiteId, // Set website for tenant isolation
      deleted: false,
    })

    console.log("Saving template:", {
      templateId,
      name: template.name,
      categoryId: template.categoryId,
      backgroundImagesCount: template.backgroundImages.length,
      logoImagesCount: template.logoImages.length,
      textOption: template.textOption,
    })

    // Save template - MongoDB will create 'templates' collection automatically
    const savedTemplate = await template.save()

    console.log("Template saved successfully!")
    console.log("Template ID:", savedTemplate._id)
    console.log("Template collection:", savedTemplate.constructor.collection.name)
    console.log("Template data:", {
      _id: savedTemplate._id,
      templateId: savedTemplate.templateId,
      name: savedTemplate.name,
      categoryId: savedTemplate.categoryId,
      backgroundImagesCount: savedTemplate.backgroundImages?.length || 0,
      logoImagesCount: savedTemplate.logoImages?.length || 0,
      textOption: savedTemplate.textOption,
    })

    const populatedTemplate = await Template.findById(savedTemplate._id).populate("category", "name categoryId").populate("categoryId", "name categoryId")

    res.status(201).json(populatedTemplate)
  } catch (error) {
    console.error("Error creating template:", error)
    console.error("Error details:", {
      message: error.message,
      code: error.code,
      name: error.name,
      keyPattern: error.keyPattern,
      keyValue: error.keyValue,
    })

    if (error.code === 11000) {
      // Duplicate key error - only check for templateId uniqueness
      if (error.keyPattern && error.keyPattern.templateId) {
        return res.status(400).json({ msg: "Template ID already exists" })
      }
      // For other duplicate key errors, return generic message
      return res.status(400).json({ msg: `Duplicate key error: ${error.message || "A duplicate entry was detected"}` })
    }

    if (error.name === "ValidationError") {
      const validationErrors = Object.values(error.errors)
        .map((err) => err.message)
        .join(", ")
      return res.status(400).json({ msg: `Validation error: ${validationErrors}` })
    }

    res.status(500).json({ msg: `Failed to create template: ${error.message || "Unknown error"}` })
  }
}

/**
 * PATCH /templates/:id/fields - Update only scalar fields (name, description, categoryId, isActive).
 * Uses JSON body, no multer. Use this when only editing name/description etc. without file uploads.
 */
export const updateTemplateFields = async (req, res) => {
  try {
    if (!req.websiteId) {
      return res.status(400).json({ msg: 'Website context is missing' });
    }
    const { id } = req.params
    const { name, description, categoryId, isActive, textOption } = req.body || {}

    // First try to find by ID and website
    let template = await Template.findOne({ _id: id, website: req.websiteId });
    
    // If not found, check for legacy template without website
    if (!template) {
      template = await Template.findOne({ 
        _id: id, 
        $or: [{ website: { $exists: false } }, { website: null }] 
      });
      // Assign website to legacy template
      if (template) {
        template.website = req.websiteId;
      }
    }
    
    if (!template) {
      return res.status(404).json({ msg: "Template not found" });
    }

    if (name !== undefined) {
      const trimmed = (typeof name === 'string' ? name : '').trim();
      if (!trimmed) {
        return res.status(400).json({ msg: "Template name cannot be empty" });
      }
      template.name = trimmed;
    }
    if (description !== undefined) template.description = (description == null ? null : String(description).trim()) || null;
    if (categoryId !== undefined && categoryId) {
      const category = await Category.findOne({ _id: categoryId, website: req.websiteId });
      if (!category) {
        return res.status(404).json({ msg: "Category not found" });
      }
      template.categoryId = categoryId;
      template.category = categoryId;
      template.categoryName = category.name;
    }
    if (isActive !== undefined) template.isActive = isActive === true || isActive === 'true';
    if (textOption !== undefined) template.textOption = textOption === true || textOption === 'true';

    await template.save();
    const populated = await Template.findById(template._id).populate("category", "name categoryId").populate("categoryId", "name categoryId");
    return res.status(200).json(populated);
  } catch (error) {
    console.error("Error updating template fields:", error);
    return res.status(500).json({ msg: "Failed to update template" });
  }
}

// Update template
export const updateTemplate = async (req, res) => {
  try {
    // Multi-tenant: Ensure website context is available
    if (!req.websiteId) {
      return res.status(400).json({ msg: 'Website context is missing' });
    }

    const { id } = req.params
    const body = req.body || {}
    const name = body.name
    const description = body.description
    const categoryId = body.categoryId
    const isActive = body.isActive
    // PixelCraft: accept JSON-first template document updates
    let incomingPixelcraftDocument = null
    try {
      if (body.pixelcraftDocument !== undefined) {
        incomingPixelcraftDocument =
          body.pixelcraftDocument === null || body.pixelcraftDocument === ""
            ? null
            : typeof body.pixelcraftDocument === "string"
              ? JSON.parse(body.pixelcraftDocument)
              : body.pixelcraftDocument
      }
    } catch (e) {
      return res.status(400).json({ msg: "Invalid pixelcraftDocument JSON" })
    }

    // First try to find by ID and website
    let template = await Template.findOne({ _id: id, website: req.websiteId })
    
    // If not found, check for legacy template without website
    if (!template) {
      template = await Template.findOne({ 
        _id: id, 
        $or: [{ website: { $exists: false } }, { website: null }] 
      })
      // Assign website to legacy template
      if (template) {
        template.website = req.websiteId
      }
    }
    
    if (!template) {
      return res.status(404).json({ msg: "Template not found" })
    }

    // If category is being changed, verify new category exists and belongs to the same website
    let updatedCategoryName = template.categoryName // Keep existing name by default
    if (categoryId && categoryId !== template.categoryId?.toString() && categoryId !== template.category?.toString()) {
      const category = await Category.findOne({ _id: categoryId, website: req.websiteId })
      if (!category) {
        return res.status(404).json({ msg: "Category not found" })
      }
      updatedCategoryName = category.name // Update category name if category changed
    }

    // Handle multiple file uploads - categorize into Background and Logo
    let existingBackgroundImages = template.backgroundImages || []
    let existingLogoImages = template.logoImages || []
    let previewImageUrl = template.previewImage

    // Helper function to delete files from Cloudinary
    const deleteFilesFromCloudinary = async (fileUrls) => {
      for (const fileUrl of fileUrls) {
        if (fileUrl.includes("cloudinary.com")) {
          try {
            const parts = fileUrl.split("/")
            const uploadIndex = parts.findIndex((part) => part === "upload")
            if (uploadIndex !== -1 && uploadIndex < parts.length - 1) {
              const pathAfterUpload = parts.slice(uploadIndex + 1)
              const versionIndex = pathAfterUpload.findIndex((part) => part.startsWith("v"))
              const publicIdParts = versionIndex !== -1 ? pathAfterUpload.slice(versionIndex + 1) : pathAfterUpload
              const publicId = publicIdParts.join("/").split(".")[0]
              await cloudinary.uploader.destroy(publicId).catch(() => {})
              console.log("Deleted file from Cloudinary:", publicId)
            }
          } catch (err) {
            console.error("Error deleting file from Cloudinary:", err)
          }
        }
      }
    }

    // Helper function to upload files to Cloudinary
    const uploadFiles = async (files, folder) => {
      const urls = []
      const filesArray = Array.isArray(files) ? files : [files]
      for (const file of filesArray) {
        if (file && file.path) {
          try {
            const result = await cloudinary.uploader.upload(file.path, {
              folder: `templates/${folder}`,
              resource_type: "auto",
            })
            urls.push(result.secure_url)
            removeLocalFile(file.path)
            console.log(`Uploaded ${folder} image to Cloudinary:`, result.secure_url)
          } catch (uploadError) {
            console.error(`${folder} upload error:`, uploadError)
            throw uploadError
          }
        }
      }
      return urls
    }

    // Handle removal of existing images
    const { removeBackgroundImages, removeLogoImages } = body
    if (removeBackgroundImages) {
      try {
        const filesToRemove = JSON.parse(removeBackgroundImages)
        await deleteFilesFromCloudinary(filesToRemove)
        existingBackgroundImages = existingBackgroundImages.filter((url) => !filesToRemove.includes(url))
      } catch (err) {
        console.error("Error parsing removeBackgroundImages:", err)
      }
    }
    if (removeLogoImages) {
      try {
        const filesToRemove = JSON.parse(removeLogoImages)
        await deleteFilesFromCloudinary(filesToRemove)
        existingLogoImages = existingLogoImages.filter((url) => !filesToRemove.includes(url))
      } catch (err) {
        console.error("Error parsing removeLogoImages:", err)
      }
    }

    if (req.files) {
      // Handle new background images (append to existing)
      if (req.files.backgroundImages) {
        try {
          const newBackgroundUrls = await uploadFiles(req.files.backgroundImages, "backgrounds")
          existingBackgroundImages = [...existingBackgroundImages, ...newBackgroundUrls]
        } catch (uploadError) {
          return res.status(500).json({ msg: "Failed to upload background images to Cloudinary" })
        }
      }

      // Handle new logo images (append to existing)
      if (req.files.logoImages) {
        try {
          const newLogoUrls = await uploadFiles(req.files.logoImages, "logos")
          existingLogoImages = [...existingLogoImages, ...newLogoUrls]
        } catch (uploadError) {
          return res.status(500).json({ msg: "Failed to upload logo images to Cloudinary" })
        }
      }

      // Handle preview image update - CLOUDINARY UPLOAD (support array or single file)
      const previewFile = req.files.previewImage
        ? (Array.isArray(req.files.previewImage) ? req.files.previewImage[0] : req.files.previewImage)
        : null
      if (previewFile && previewFile.path) {
        // Delete old preview from Cloudinary if exists
        if (template.previewImage && template.previewImage.includes("cloudinary.com")) {
          try {
            const publicId = template.previewImage.split("/").slice(-2).join("/").split(".")[0]
            await cloudinary.uploader.destroy(publicId).catch(() => {})
            console.log("Deleted old preview from Cloudinary:", publicId)
          } catch (err) {
            console.error("Error deleting old preview from Cloudinary:", err)
          }
        }

        const file = previewFile
        if (file && file.path) {
          try {
            const result = await cloudinary.uploader.upload(file.path, {
              folder: "templates/previews",
              resource_type: "image",
            })
            previewImageUrl = result.secure_url
            removeLocalFile(file.path)
            console.log("Uploaded new preview image to Cloudinary:", previewImageUrl)
          } catch (uploadError) {
            console.error("Preview image upload error:", uploadError.message || uploadError)
            // Fallback: use local upload URL when Cloudinary is not configured (e.g. missing api_key)
            if (file.filename) {
              previewImageUrl = `${req.protocol}://${req.get("host")}/uploads/${file.filename}`
              console.log("Using local preview image:", previewImageUrl)
            }
          }
        }
      }
    }

    // If no preview image, use first available image
    if (!previewImageUrl) {
      if (existingBackgroundImages.length > 0) {
        previewImageUrl = existingBackgroundImages[0]
      } else if (existingLogoImages.length > 0) {
        previewImageUrl = existingLogoImages[0]
      }
    }

    // Require at least one image for legacy templates.
    // PixelCraft templates may be JSON-first and not require background/logo assets.
    const hasPixelcraft = incomingPixelcraftDocument !== null ? Boolean(incomingPixelcraftDocument) : Boolean(template.pixelcraftDocument)
    if (!hasPixelcraft && existingBackgroundImages.length === 0 && existingLogoImages.length === 0) {
      return res.status(400).json({ msg: "At least one template image is required (Background or Logo)" })
    }

    // Update template (defensive: multer may leave req.body empty when no files sent)
    if (name !== undefined && name !== null) {
      const trimmed = (typeof name === 'string' ? name : '').trim()
      if (trimmed) template.name = trimmed
    }
    if (description !== undefined) template.description = (description == null ? null : String(description).trim()) || null
    if (categoryId) {
      template.categoryId = categoryId
      template.category = categoryId
      template.categoryName = updatedCategoryName // Update category name
    }
    template.backgroundImages = existingBackgroundImages
    template.logoImages = existingLogoImages
    template.textOption = body.textOption !== undefined ? body.textOption === "true" || body.textOption === true : template.textOption
    template.previewImage = previewImageUrl
    if (isActive !== undefined) {
      template.isActive = isActive === "true" || isActive === true
    }
    if (body.pixelcraftStatus !== undefined && (body.pixelcraftStatus === "draft" || body.pixelcraftStatus === "published")) {
      template.pixelcraftStatus = body.pixelcraftStatus
    }
    if (body.pixelcraftVersion !== undefined) {
      const v = parseInt(body.pixelcraftVersion, 10)
      if (!Number.isNaN(v)) template.pixelcraftVersion = v
    }
    if (body.pixelcraftDocument !== undefined) {
      template.pixelcraftDocument = incomingPixelcraftDocument
      // If we're saving PixelCraft, default it to draft unless explicitly published
      if (!template.pixelcraftStatus) template.pixelcraftStatus = "draft"
    }

    await template.save()

    const populatedTemplate = await Template.findById(template._id).populate("category", "name categoryId").populate("categoryId", "name categoryId")

    res.status(200).json(populatedTemplate)
  } catch (error) {
    console.error("Error updating template:", error)
    res.status(500).json({ msg: "Failed to update template" })
  }
}

// Delete template (soft delete)
export const deleteTemplate = async (req, res) => {
  try {
    // Multi-tenant: Ensure website context is available
    if (!req.websiteId) {
      return res.status(400).json({ msg: 'Website context is missing' });
    }

    console.log("DELETE request received for template:", req.params.id)
    console.log("Permanent delete:", req.query.permanent)
    console.log("User:", req.user?.email, "Role:", req.user?.role)

    const { id } = req.params
    const { permanent = "false" } = req.query

    // First try to find by ID and website
    let template = await Template.findOne({ _id: id, website: req.websiteId })
    
    // If not found, check for legacy template without website
    if (!template) {
      template = await Template.findOne({ 
        _id: id, 
        $or: [{ website: { $exists: false } }, { website: null }] 
      })
    }
    
    if (!template) {
      console.log("Template not found:", id)
      return res.status(404).json({ msg: "Template not found" })
    }

    console.log("Template found:", template.name)

    if (permanent === "true") {
      // Hard delete - remove files from Cloudinary
      // Delete all background images from Cloudinary
      if (template.backgroundImages && template.backgroundImages.length > 0) {
        for (const fileUrl of template.backgroundImages) {
          if (fileUrl.includes("cloudinary.com")) {
            try {
              const parts = fileUrl.split("/")
              const uploadIndex = parts.findIndex((part) => part === "upload")
              if (uploadIndex !== -1 && uploadIndex < parts.length - 1) {
                const pathAfterUpload = parts.slice(uploadIndex + 1)
                const versionIndex = pathAfterUpload.findIndex((part) => part.startsWith("v"))
                const publicIdParts = versionIndex !== -1 ? pathAfterUpload.slice(versionIndex + 1) : pathAfterUpload
                const publicId = publicIdParts.join("/").split(".")[0]
                await cloudinary.uploader.destroy(publicId).catch(() => {})
                console.log("Deleted background image from Cloudinary:", publicId)
              }
            } catch (err) {
              console.error("Error deleting background image from Cloudinary:", err)
            }
          }
        }
      }

      // Delete all logo images from Cloudinary
      if (template.logoImages && template.logoImages.length > 0) {
        for (const fileUrl of template.logoImages) {
          if (fileUrl.includes("cloudinary.com")) {
            try {
              const parts = fileUrl.split("/")
              const uploadIndex = parts.findIndex((part) => part === "upload")
              if (uploadIndex !== -1 && uploadIndex < parts.length - 1) {
                const pathAfterUpload = parts.slice(uploadIndex + 1)
                const versionIndex = pathAfterUpload.findIndex((part) => part.startsWith("v"))
                const publicIdParts = versionIndex !== -1 ? pathAfterUpload.slice(versionIndex + 1) : pathAfterUpload
                const publicId = publicIdParts.join("/").split(".")[0]
                await cloudinary.uploader.destroy(publicId).catch(() => {})
                console.log("Deleted logo image from Cloudinary:", publicId)
              }
            } catch (err) {
              console.error("Error deleting logo image from Cloudinary:", err)
            }
          }
        }
      }

      // Delete preview image from Cloudinary if different from template files
      if (template.previewImage && template.previewImage.includes("cloudinary.com")) {
        try {
          const publicId = template.previewImage.split("/").slice(-2).join("/").split(".")[0]
          await cloudinary.uploader.destroy(publicId).catch(() => {})
          console.log("Deleted preview image from Cloudinary:", publicId)
        } catch (err) {
          console.error("Error deleting preview image from Cloudinary:", err)
        }
      }

      await Template.findByIdAndDelete(id)
      console.log("Template permanently deleted from database")
      res.status(200).json({ msg: "Template permanently deleted" })
    } else {
      // Soft delete
      template.deleted = true
      template.isActive = false
      await template.save()
      console.log("Template soft deleted successfully")
      res.status(200).json({ msg: "Template deleted successfully" })
    }
  } catch (error) {
    console.error("Error deleting template:", error)
    console.error("Error stack:", error.stack)
    res.status(500).json({ msg: "Failed to delete template", error: error.message })
  }
}

// Update template status
export const updateTemplateStatus = async (req, res) => {
  try {
    // Multi-tenant: Ensure website context is available
    if (!req.websiteId) {
      return res.status(400).json({ msg: 'Website context is missing' });
    }

    const { id } = req.params
    const { isActive } = req.body

    // First try to find by ID and website
    let template = await Template.findOne({ _id: id, website: req.websiteId })
    
    // If not found, check for legacy template without website
    if (!template) {
      template = await Template.findOne({ 
        _id: id, 
        $or: [{ website: { $exists: false } }, { website: null }] 
      })
      // Assign website to legacy template
      if (template) {
        template.website = req.websiteId
      }
    }
    
    if (!template) {
      return res.status(404).json({ msg: "Template not found" })
    }

    template.isActive = isActive === "true" || isActive === true
    await template.save()

    res.status(200).json(template)
  } catch (error) {
    console.error("Error updating template status:", error)
    res.status(500).json({ msg: "Failed to update template status" })
  }
}
