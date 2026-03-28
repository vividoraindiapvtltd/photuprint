import CarouselSlide from "../models/carouselSlide.model.js"
import CarouselSetting, { CAROUSEL_KEYS_LIST } from "../models/carouselSetting.model.js"
import { uploadLocalFileToCloudinary } from "../utils/cloudinaryUpload.js"
import { removeLocalFile } from "../utils/fileCleanup.js"

const CAROUSEL_KEYS = CAROUSEL_KEYS_LIST || ["hero", "featured", "promotions"]

function getCarouselKey(req) {
  const key = (req.query?.key || req.body?.carouselKey || "hero").trim().toLowerCase()
  return CAROUSEL_KEYS.includes(key) ? key : "hero"
}

function slideQuery(websiteId, carouselKey) {
  const q = { website: websiteId }
  if (carouselKey === "hero") {
    q.$or = [{ carouselKey: "hero" }, { carouselKey: { $exists: false } }, { carouselKey: "" }]
  } else {
    q.carouselKey = carouselKey
  }
  return q
}

function settingQuery(websiteId, carouselKey) {
  const q = { website: websiteId }
  if (carouselKey === "hero") {
    q.$or = [{ carouselKey: "hero" }, { carouselKey: { $exists: false } }, { carouselKey: "" }]
  } else {
    q.carouselKey = carouselKey
  }
  return q
}

/**
 * Carousel controller. Supports layouts: fullWidth, cards2, cards3, cards4.
 * Multi-tenant: scoped by website + carouselKey (hero, featured, promotions).
 */

export const getPublicSlides = async (req, res) => {
  try {
    const websiteId = req.websiteId || req.tenant?._id
    if (!websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }
    const carouselKey = getCarouselKey(req)
    const slideFilter = { ...slideQuery(websiteId, carouselKey), isActive: true }
    const [slides, setting] = await Promise.all([
      CarouselSlide.find(slideFilter).sort({ displayOrder: 1 }).lean(),
      CarouselSetting.findOne(settingQuery(websiteId, carouselKey)).lean(),
    ])
    const layout = setting?.layout || "fullWidth"
    const isCarouselActive = setting?.isActive !== false
    res.json({
      slides: isCarouselActive ? slides : [],
      layout,
      slideEffect: setting?.slideEffect || "fade",
      isActive: isCarouselActive,
      name: setting?.name ?? "",
      showDisplayName: setting?.showDisplayName !== false,
      autoplay: setting?.autoplay !== false,
      autoplayInterval: setting?.autoplayInterval ?? 5,
      transitionDuration: Math.max(0.2, Math.min(2, Number(setting?.transitionDuration) || 0.5)),
      loop: setting?.loop !== false,
      showArrows: setting?.showArrows !== false,
      arrowsPosition: setting?.arrowsPosition || "inside",
      showDots: setting?.showDots !== false,
      dotsOutside: !!setting?.dotsOutside,
      pauseOnHover: setting?.pauseOnHover !== false,
      showSlideTitle: setting?.showSlideTitle !== false,
      showSlideSubtitle: setting?.showSlideSubtitle !== false,
      captionPosition: setting?.captionPosition || "overlay",
      imageFit: setting?.imageFit || "cover",
      backgroundColor: setting?.backgroundColor || "#111827",
      displayNameColor: setting?.displayNameColor || "#ffffff",
      displayNameFontSize: setting?.displayNameFontSize || "20px",
      captionColor: setting?.captionColor || "#ffffff",
      captionSubtitleColor: setting?.captionSubtitleColor || "#e5e7eb",
      captionTitleFontSize: setting?.captionTitleFontSize || "18px",
      captionSubtitleFontSize: setting?.captionSubtitleFontSize || "14px",
      captionOverlayOpacity: Math.max(0, Math.min(1, Number(setting?.captionOverlayOpacity) ?? 0.8)),
    })
  } catch (error) {
    console.error("Error fetching public carousel slides:", error)
    res.status(500).json({ msg: "Server error", error: error.message })
  }
}

export const getSettings = async (req, res) => {
  try {
    const websiteId = req.websiteId || req.tenant?._id
    if (!websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }
    const carouselKey = getCarouselKey(req)
    let setting = await CarouselSetting.findOne(settingQuery(websiteId, carouselKey)).lean()
    if (!setting) {
      setting = await CarouselSetting.create({ website: websiteId, carouselKey, layout: "fullWidth" })
      setting = setting.toObject ? setting.toObject() : setting
    }
    res.json(setting)
  } catch (error) {
    console.error("Error fetching carousel settings:", error)
    res.status(500).json({ msg: "Server error", error: error.message })
  }
}

export const updateSettings = async (req, res) => {
  try {
    const websiteId = req.websiteId || req.tenant?._id
    if (!websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }
    const carouselKey = getCarouselKey(req)
    const {
      name, layout, slideEffect, isActive, autoplay, autoplayInterval, transitionDuration, loop,
      showArrows, arrowsPosition, showDots, dotsOutside, pauseOnHover,
      showSlideTitle, showSlideSubtitle, captionPosition, imageFit, showDisplayName,
      backgroundColor, displayNameColor, displayNameFontSize, captionColor, captionSubtitleColor,
      captionTitleFontSize, captionSubtitleFontSize, captionOverlayOpacity,
    } = req.body
    const allowed = ["fullWidth", "cards2", "cards3", "cards4"]
    const allowedEffects = ["fade", "slide", "zoom", "slideUp", "flip"]
    const update = {}
    if (name !== undefined) update.name = String(name || "").trim()
    if (layout !== undefined) {
      if (!allowed.includes(layout)) {
        return res.status(400).json({ msg: "Invalid layout. Use: fullWidth, cards2, cards3, cards4" })
      }
      update.layout = layout
    }
    if (slideEffect !== undefined) {
      if (!allowedEffects.includes(slideEffect)) {
        return res.status(400).json({ msg: "Invalid slide effect. Use: fade, slide, zoom, slideUp, flip" })
      }
      update.slideEffect = slideEffect
    }
    if (isActive !== undefined) update.isActive = !!isActive
    if (autoplay !== undefined) update.autoplay = !!autoplay
    if (autoplayInterval !== undefined) update.autoplayInterval = Math.max(1, Math.min(60, Number(autoplayInterval) || 5))
    if (transitionDuration !== undefined) update.transitionDuration = Math.max(0.2, Math.min(2, Number(transitionDuration) || 0.5))
    if (loop !== undefined) update.loop = !!loop
    if (showArrows !== undefined) update.showArrows = !!showArrows
    if (arrowsPosition !== undefined) {
      if (["inside", "outside"].includes(arrowsPosition)) update.arrowsPosition = arrowsPosition
    }
    if (showDots !== undefined) update.showDots = !!showDots
    if (dotsOutside !== undefined) update.dotsOutside = !!dotsOutside
    if (pauseOnHover !== undefined) update.pauseOnHover = !!pauseOnHover
    if (showSlideTitle !== undefined) update.showSlideTitle = !!showSlideTitle
    if (showSlideSubtitle !== undefined) update.showSlideSubtitle = !!showSlideSubtitle
    if (captionPosition !== undefined) {
      if (["overlay", "below"].includes(captionPosition)) update.captionPosition = captionPosition
    }
    if (imageFit !== undefined) {
      if (["cover", "contain"].includes(imageFit)) update.imageFit = imageFit
    }
    if (showDisplayName !== undefined) update.showDisplayName = !!showDisplayName
    if (backgroundColor !== undefined) update.backgroundColor = String(backgroundColor || "#111827").trim()
    if (displayNameColor !== undefined) update.displayNameColor = String(displayNameColor || "#ffffff").trim()
    if (displayNameFontSize !== undefined) update.displayNameFontSize = String(displayNameFontSize || "20px").trim()
    if (captionColor !== undefined) update.captionColor = String(captionColor || "#ffffff").trim()
    if (captionSubtitleColor !== undefined) update.captionSubtitleColor = String(captionSubtitleColor || "#e5e7eb").trim()
    if (captionTitleFontSize !== undefined) update.captionTitleFontSize = String(captionTitleFontSize || "18px").trim()
    if (captionSubtitleFontSize !== undefined) update.captionSubtitleFontSize = String(captionSubtitleFontSize || "14px").trim()
    if (captionOverlayOpacity !== undefined) update.captionOverlayOpacity = Math.max(0, Math.min(1, Number(captionOverlayOpacity) ?? 0.8))
    if (Object.keys(update).length === 0) {
      const current = await CarouselSetting.findOne(settingQuery(websiteId, carouselKey)).lean()
      return res.json(current || await CarouselSetting.create({ website: websiteId, carouselKey, layout: "fullWidth" }).then((s) => s.toObject?.() || s))
    }
    const setting = await CarouselSetting.findOneAndUpdate(
      settingQuery(websiteId, carouselKey),
      { $set: { ...update, carouselKey } },
      { new: true, upsert: true }
    ).lean()
    res.json(setting)
  } catch (error) {
    console.error("Error updating carousel settings:", error)
    res.status(500).json({ msg: "Server error", error: error.message })
  }
}

export const getSlides = async (req, res) => {
  try {
    const websiteId = req.websiteId || req.tenant?._id
    if (!websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }
    const carouselKey = getCarouselKey(req)
    const showInactive = req.query.showInactive === "true"
    const query = { ...slideQuery(websiteId, carouselKey) }
    if (!showInactive) query.isActive = true
    const slides = await CarouselSlide.find(query).sort({ displayOrder: 1 }).lean()
    res.json({ slides })
  } catch (error) {
    console.error("Error fetching carousel slides:", error)
    res.status(500).json({ msg: "Server error", error: error.message })
  }
}

export const getSlideById = async (req, res) => {
  try {
    const websiteId = req.websiteId || req.tenant?._id
    const { id } = req.params
    if (!websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }
    const carouselKey = getCarouselKey(req)
    const slide = await CarouselSlide.findOne({ _id: id, ...slideQuery(websiteId, carouselKey) }).lean()
    if (!slide) {
      return res.status(404).json({ msg: "Carousel slide not found" })
    }
    res.json(slide)
  } catch (error) {
    console.error("Error fetching carousel slide:", error)
    res.status(500).json({ msg: "Server error", error: error.message })
  }
}

export const createSlide = async (req, res) => {
  try {
    const websiteId = req.websiteId || req.tenant?._id
    if (!websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }
    const carouselKey = getCarouselKey(req)
    const { imageUrl, title, subtitle, linkUrl, openInNewTab, displayOrder, isActive } = req.body
    const maxOrder = await CarouselSlide.findOne({ ...slideQuery(websiteId, carouselKey) }).sort({ displayOrder: -1 }).select("displayOrder")
    const order = displayOrder != null ? Number(displayOrder) : (maxOrder ? maxOrder.displayOrder + 1 : 0)
    const slide = new CarouselSlide({
      website: websiteId,
      carouselKey,
      imageUrl: imageUrl || "",
      title: title || "",
      subtitle: subtitle || "",
      linkUrl: linkUrl || "",
      openInNewTab: !!openInNewTab,
      displayOrder: order,
      isActive: isActive !== false,
    })
    await slide.save()
    res.status(201).json(slide)
  } catch (error) {
    console.error("Error creating carousel slide:", error)
    res.status(500).json({ msg: "Server error", error: error.message })
  }
}

export const updateSlide = async (req, res) => {
  try {
    const websiteId = req.websiteId || req.tenant?._id
    const { id } = req.params
    if (!websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }
    const carouselKey = getCarouselKey(req)
    const slide = await CarouselSlide.findOne({ _id: id, ...slideQuery(websiteId, carouselKey) })
    if (!slide) {
      return res.status(404).json({ msg: "Carousel slide not found" })
    }
    const { imageUrl, title, subtitle, linkUrl, openInNewTab, displayOrder, isActive } = req.body
    if (imageUrl !== undefined) slide.imageUrl = imageUrl || ""
    if (title !== undefined) slide.title = title || ""
    if (subtitle !== undefined) slide.subtitle = subtitle || ""
    if (linkUrl !== undefined) slide.linkUrl = linkUrl || ""
    if (openInNewTab !== undefined) slide.openInNewTab = !!openInNewTab
    if (displayOrder !== undefined) slide.displayOrder = Number(displayOrder)
    if (isActive !== undefined) slide.isActive = !!isActive
    await slide.save()
    res.json(slide)
  } catch (error) {
    console.error("Error updating carousel slide:", error)
    res.status(500).json({ msg: "Server error", error: error.message })
  }
}

export const deleteSlide = async (req, res) => {
  try {
    const websiteId = req.websiteId || req.tenant?._id
    const { id } = req.params
    if (!websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }
    const carouselKey = getCarouselKey(req)
    const slide = await CarouselSlide.findOneAndDelete({ _id: id, ...slideQuery(websiteId, carouselKey) })
    if (!slide) {
      return res.status(404).json({ msg: "Carousel slide not found" })
    }
    res.json({ msg: "Slide deleted" })
  } catch (error) {
    console.error("Error deleting carousel slide:", error)
    res.status(500).json({ msg: "Server error", error: error.message })
  }
}

export const reorderSlides = async (req, res) => {
  try {
    const websiteId = req.websiteId || req.tenant?._id
    const { slides } = req.body
    if (!websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }
    if (!Array.isArray(slides) || slides.length === 0) {
      return res.status(400).json({ msg: "slides array is required" })
    }
    const carouselKey = getCarouselKey(req)
    const baseFilter = slideQuery(websiteId, carouselKey)
    const ops = slides.map(({ id, displayOrder }) => ({
      updateOne: {
        filter: { _id: id, ...baseFilter },
        update: { displayOrder },
      },
    }))
    await CarouselSlide.bulkWrite(ops)
    const updated = await CarouselSlide.find(baseFilter).sort({ displayOrder: 1 }).lean()
    res.json({ slides: updated })
  } catch (error) {
    console.error("Error reordering carousel slides:", error)
    res.status(500).json({ msg: "Server error", error: error.message })
  }
}

/**
 * Upload carousel image. Returns imageUrl.
 */
export const uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ msg: "No file uploaded" })
    }
    const imageUrl = await uploadLocalFileToCloudinary(req.file.path, {
      folder: "photuprint/carousel",
      resource_type: "auto",
    })
    return res.json({ imageUrl })
  } catch (error) {
    console.error("Error uploading carousel image:", error)
    if (req.file?.path) removeLocalFile(req.file.path)
    res.status(500).json({ msg: error.message || "Upload failed. Configure Cloudinary." })
  }
}
