import React, { useState, useEffect, useCallback, useRef } from "react"
import api, { getUploadBaseURL } from "../api/axios"
import { useAuth } from "../context/AuthContext"
import {
  PageHeader,
  AlertMessage,
  FormField,
  DeleteConfirmationPopup,
  SearchField,
  StatusFilter,
  ActionButtons,
  ViewToggle,
  calculateStandardStatusCounts,
  filterEntitiesByStatus,
  generateBrandColor,
} from "../common"

const AUTOPLAY_INTERVAL_MS = 5000
const CAROUSEL_LAYOUTS = [
  { value: "fullWidth", label: "Full image carousel (1 per slide)" },
  { value: "cards2", label: "2 images card" },
  { value: "cards3", label: "3 images card" },
  { value: "cards4", label: "4 images card" },
]
const CAROUSEL_SLIDE_EFFECTS = [
  { value: "fade", label: "Fade" },
  { value: "slide", label: "Slide" },
  { value: "zoom", label: "Zoom" },
  { value: "slideUp", label: "Slide Up" },
  { value: "flip", label: "Flip" },
]
const CAROUSEL_KEYS = [
  { key: "hero", label: "Hero" },
  { key: "featured", label: "Featured" },
  { key: "promotions", label: "Promotions" },
]

// Parse "14px" -> 14, "" -> "" for numeric display
const parsePxValue = (str) => {
  if (!str || typeof str !== "string") return ""
  const num = str.replace(/px$/i, "").trim()
  if (num === "" || isNaN(Number(num))) return ""
  return Number(num)
}

// Numeric field with "px" shown after the text box (value stored as e.g. "14px")
const NumericPxField = ({ label, name, value, onChange, min = 1, max }) => {
  const numValue = parsePxValue(value)
  const handleChange = (e) => {
    const v = e.target.value
    const next = v === "" ? "" : `${v}px`
    onChange({ target: { name, value: next, type: "text" } })
  }
  return (
    <div className="makeFlex column appendBottom16">
      <label className="formLabel appendBottom8" htmlFor={`field-${name}`}>{label}</label>
      <div className="makeFlex alignCenter gap8">
        <input
          type="number"
          id={`field-${name}`}
          name={name}
          value={numValue}
          onChange={handleChange}
          min={min}
          max={max}
          className="formInput"
          style={{ width: "100%" }}
          placeholder="e.g. 14"
        />
        <span className="font14 grayText">px</span>
      </div>
    </div>
  )
}

// Color field: label + color picker (palette) + optional hex text
const ColorField = ({ label, value, onChange, placeholder = "#000000" }) => {
  const hex = value && value.trim() !== "" ? value : placeholder
  const safeHex = hex.startsWith("#") && /^#[0-9A-Fa-f]{6}$/.test(hex) ? hex : "#111827"
  return (
    <div className="makeFlex column appendBottom16">
      <label className="formLabel appendBottom8">{label}</label>
      <div className="makeFlex alignCenter gap10">
        <input
          type="color"
          value={safeHex}
          onChange={(e) => onChange(e.target.value)}
          className="formInput"
          style={{ width: 40, height: 36, padding: 2, cursor: "pointer" }}
          title="Choose color"
        />
        <input
          type="text"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="formInput"
          style={{ flex: 1, minWidth: 100 }}
        />
      </div>
    </div>
  )
}

/**
 * Carousel manager. Layouts: full-width, 2/3/4 cards per row.
 * Multiple carousels per website: Hero, Featured, Promotions.
 */
const FrontendCarousel = () => {
  const { selectedWebsite } = useAuth()
  const [selectedCarouselKey, setSelectedCarouselKey] = useState("hero")
  const [carouselCreatedForKeys, setCarouselCreatedForKeys] = useState(() => new Set(["hero"]))
  const [slides, setSlides] = useState([])
  const [publicSlides, setPublicSlides] = useState([])
  const [carouselLayout, setCarouselLayout] = useState("fullWidth")
  const [carouselName, setCarouselName] = useState("")
  const [carouselShowDisplayName, setCarouselShowDisplayName] = useState(true)
  const [carouselSlideEffect, setCarouselSlideEffect] = useState("fade")
  const [carouselIsActive, setCarouselIsActive] = useState(true)
  const [carouselAutoplay, setCarouselAutoplay] = useState(true)
  const [carouselAutoplayInterval, setCarouselAutoplayInterval] = useState(5)
  const [carouselTransitionDuration, setCarouselTransitionDuration] = useState(0.5)
  const [carouselLoop, setCarouselLoop] = useState(true)
  const [carouselShowArrows, setCarouselShowArrows] = useState(true)
  const [carouselArrowsPosition, setCarouselArrowsPosition] = useState("inside")
  const [carouselShowDots, setCarouselShowDots] = useState(true)
  const [carouselDotsOutside, setCarouselDotsOutside] = useState(false)
  const [carouselPauseOnHover, setCarouselPauseOnHover] = useState(true)
  const [carouselShowSlideTitle, setCarouselShowSlideTitle] = useState(true)
  const [carouselShowSlideSubtitle, setCarouselShowSlideSubtitle] = useState(true)
  const [carouselCaptionPosition, setCarouselCaptionPosition] = useState("overlay")
  const [carouselImageFit, setCarouselImageFit] = useState("cover")
  const [carouselBackgroundColor, setCarouselBackgroundColor] = useState("#111827")
  const [carouselDisplayNameColor, setCarouselDisplayNameColor] = useState("#ffffff")
  const [carouselDisplayNameFontSize, setCarouselDisplayNameFontSize] = useState("20px")
  const [carouselCaptionColor, setCarouselCaptionColor] = useState("#ffffff")
  const [carouselCaptionSubtitleColor, setCarouselCaptionSubtitleColor] = useState("#e5e7eb")
  const [carouselCaptionTitleFontSize, setCarouselCaptionTitleFontSize] = useState("18px")
  const [carouselCaptionSubtitleFontSize, setCarouselCaptionSubtitleFontSize] = useState("14px")
  const [carouselCaptionOverlayOpacity, setCarouselCaptionOverlayOpacity] = useState(0.8)
  const [carouselIndex, setCarouselIndex] = useState(0)
  const [loading, setLoading] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [editingId, setEditingId] = useState(null)
  const [statusFilter, setStatusFilter] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [viewMode, setViewMode] = useState("card")
  const [deletePopup, setDeletePopup] = useState({ isVisible: false, id: null, message: "" })
  const [imagePopup, setImagePopup] = useState({ isVisible: false, imageUrl: null })
  const autoplayRef = useRef(null)
  const multiSlideIdRef = useRef(0)
  const editFormRef = useRef(null)

  const oneSlideShape = (slide = null) => {
    const base = {
      tempId: `multi-${++multiSlideIdRef.current}`,
      imageUrl: "",
      title: "",
      subtitle: "",
      linkUrl: "",
      openInNewTab: false,
      displayOrder: 0,
      isActive: true,
    }
    if (slide && slide._id) {
      return {
        ...base,
        _id: slide._id,
        imageUrl: slide.imageUrl || "",
        title: slide.title || "",
        subtitle: slide.subtitle || "",
        linkUrl: slide.linkUrl || "",
        openInNewTab: !!slide.openInNewTab,
        displayOrder: slide.displayOrder ?? 0,
        isActive: slide.isActive !== false,
      }
    }
    return base
  }
  const [multiSlides, setMultiSlides] = useState(() => [oneSlideShape()])

  const addMultiRow = () => setMultiSlides((prev) => [...prev, oneSlideShape()])
  const updateMultiRow = (tempId, field, value) => {
    setMultiSlides((prev) =>
      prev.map((row) => (row.tempId === tempId ? { ...row, [field]: value } : row))
    )
  }
  const removeMultiRow = (tempId) => {
    setMultiSlides((prev) => {
      const next = prev.filter((r) => r.tempId !== tempId)
      return next.length ? next : [oneSlideShape()]
    })
  }
  const handleImageClick = (imageUrl) => {
    if (imageUrl) setImagePopup({ isVisible: true, imageUrl })
  }
  const handleCloseImagePopup = () => setImagePopup({ isVisible: false, imageUrl: null })

  const fetchSlides = useCallback(async () => {
    if (!selectedWebsite?._id) {
      setSlides([])
      setError("Please select a website first.")
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      setError("")
      const res = await api.get("/carousel", { params: { showInactive: true, key: selectedCarouselKey } })
      setSlides(res.data.slides || [])
    } catch (err) {
      const msg = err.response?.data?.msg || err.message || "Failed to load carousel slides."
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [selectedWebsite?._id, selectedCarouselKey])

  useEffect(() => {
    fetchSlides()
  }, [fetchSlides])

  useEffect(() => {
    if (slides.length > 0 && selectedCarouselKey) {
      setCarouselCreatedForKeys((prev) => new Set([...prev, selectedCarouselKey]))
    }
  }, [slides.length, selectedCarouselKey])

  const handleCarouselKeyChange = (key) => {
    setSelectedCarouselKey(key)
    setEditingId(null)
    setMultiSlides([oneSlideShape()])
    setSuccess("")
    setError("")
  }

  const showSlideSection = carouselCreatedForKeys.has(selectedCarouselKey)

  const fetchPublicSlides = useCallback(async () => {
    if (!selectedWebsite?._id) {
      setPublicSlides([])
      return
    }
    try {
      const res = await api.get("/carousel/public", { params: { key: selectedCarouselKey } })
      const list = res.data.slides || []
      const layout = res.data.layout || "fullWidth"
      setPublicSlides(list)
      setCarouselLayout(layout)
      setCarouselName(res.data.name ?? "")
      setCarouselShowDisplayName(res.data.showDisplayName !== false)
      setCarouselSlideEffect(res.data.slideEffect || "fade")
      setCarouselIsActive(res.data.isActive !== false)
      setCarouselAutoplay(res.data.autoplay !== false)
      setCarouselAutoplayInterval(res.data.autoplayInterval ?? 5)
      setCarouselTransitionDuration(res.data.transitionDuration ?? 0.5)
      setCarouselLoop(res.data.loop !== false)
      setCarouselShowArrows(res.data.showArrows !== false)
      setCarouselArrowsPosition(res.data.arrowsPosition || "inside")
      setCarouselShowDots(res.data.showDots !== false)
      setCarouselDotsOutside(!!res.data.dotsOutside)
      setCarouselPauseOnHover(res.data.pauseOnHover !== false)
      setCarouselShowSlideTitle(res.data.showSlideTitle !== false)
      setCarouselShowSlideSubtitle(res.data.showSlideSubtitle !== false)
      setCarouselCaptionPosition(res.data.captionPosition || "overlay")
      setCarouselImageFit(res.data.imageFit || "cover")
      setCarouselBackgroundColor(res.data.backgroundColor || "#111827")
      setCarouselDisplayNameColor(res.data.displayNameColor || "#ffffff")
      setCarouselDisplayNameFontSize(res.data.displayNameFontSize || "20px")
      setCarouselCaptionColor(res.data.captionColor || "#ffffff")
      setCarouselCaptionSubtitleColor(res.data.captionSubtitleColor || "#e5e7eb")
      setCarouselCaptionTitleFontSize(res.data.captionTitleFontSize || "18px")
      setCarouselCaptionSubtitleFontSize(res.data.captionSubtitleFontSize || "14px")
      setCarouselCaptionOverlayOpacity(res.data.captionOverlayOpacity ?? 0.8)
      const perPage = layout === "fullWidth" ? 1 : layout === "cards2" ? 2 : layout === "cards3" ? 3 : 4
      const maxPage = list.length ? Math.max(0, Math.ceil(list.length / perPage) - 1) : 0
      setCarouselIndex((i) => Math.min(i, maxPage))
    } catch {
      setPublicSlides([])
    }
  }, [selectedWebsite?._id, selectedCarouselKey])

  useEffect(() => {
    fetchPublicSlides()
  }, [fetchPublicSlides, slides])

  const perPage = carouselLayout === "fullWidth" ? 1 : carouselLayout === "cards2" ? 2 : carouselLayout === "cards3" ? 3 : 4
  const pageCount = carouselLayout === "fullWidth" ? publicSlides.length : Math.ceil(publicSlides.length / perPage) || 0

  useEffect(() => {
    if (pageCount <= 1) return
    autoplayRef.current = setInterval(() => {
      setCarouselIndex((i) => (i + 1) % pageCount)
    }, AUTOPLAY_INTERVAL_MS)
    return () => {
      if (autoplayRef.current) clearInterval(autoplayRef.current)
    }
  }, [pageCount])

  const handleSaveCarouselSettings = async (e) => {
    e?.preventDefault?.()
    try {
      setSavingSettings(true)
      setError("")
      await api.put("/carousel/settings", {
        carouselKey: selectedCarouselKey,
        name: carouselName,
        showDisplayName: carouselShowDisplayName,
        layout: carouselLayout,
        slideEffect: carouselSlideEffect,
        isActive: carouselIsActive,
        autoplay: carouselAutoplay,
        autoplayInterval: carouselAutoplayInterval,
        transitionDuration: carouselTransitionDuration,
        loop: carouselLoop,
        showArrows: carouselShowArrows,
        arrowsPosition: carouselArrowsPosition,
        showDots: carouselShowDots,
        dotsOutside: carouselDotsOutside,
        pauseOnHover: carouselPauseOnHover,
        showSlideTitle: carouselShowSlideTitle,
        showSlideSubtitle: carouselShowSlideSubtitle,
        captionPosition: carouselCaptionPosition,
        imageFit: carouselImageFit,
        backgroundColor: carouselBackgroundColor,
        displayNameColor: carouselDisplayNameColor,
        displayNameFontSize: carouselDisplayNameFontSize,
        captionColor: carouselCaptionColor,
        captionSubtitleColor: carouselCaptionSubtitleColor,
        captionTitleFontSize: carouselCaptionTitleFontSize,
        captionSubtitleFontSize: carouselCaptionSubtitleFontSize,
        captionOverlayOpacity: carouselCaptionOverlayOpacity,
      })
      const per = carouselLayout === "fullWidth" ? 1 : carouselLayout === "cards2" ? 2 : carouselLayout === "cards3" ? 3 : 4
      const maxPage = publicSlides.length ? Math.max(0, Math.ceil(publicSlides.length / per) - 1) : 0
      setCarouselIndex((i) => Math.min(i, maxPage))
      setSuccess("Carousel settings saved.")
      setCarouselCreatedForKeys((prev) => new Set([...prev, selectedCarouselKey]))
      fetchPublicSlides()
    } catch (err) {
      setError(err.response?.data?.msg || "Failed to save settings.")
    } finally {
      setSavingSettings(false)
    }
  }

  const resetForm = () => {
    setEditingId(null)
    setMultiSlides([oneSlideShape()])
  }

  const handleEdit = (slide) => {
    setEditingId(slide._id)
    setError("")
    setSuccess("")
    setMultiSlides([oneSlideShape(slide)])
    setTimeout(() => {
      editFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    }, 100)
  }

  const filteredSlides = React.useMemo(() => {
    let filtered = filterEntitiesByStatus(slides, statusFilter)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      filtered = filtered.filter(
        (s) =>
          (s.title || "").toLowerCase().includes(q) ||
          (s.subtitle || "").toLowerCase().includes(q)
      )
    }
    return filtered.sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
  }, [slides, statusFilter, searchQuery])

  const [savingMulti, setSavingMulti] = useState(false)
  const handleSaveAllMulti = async (e) => {
    e.preventDefault()
    const withImage = multiSlides.filter((r) => (r.imageUrl || "").trim())
    if (withImage.length === 0) {
      setError("Add at least one slide with an image.")
      return
    }
    try {
      setError("")
      setSuccess("")
      setSavingMulti(true)
      const maxOrder = slides.length ? Math.max(...slides.map((s) => s.displayOrder ?? 0), -1) + 1 : 0
      let created = 0
      let updated = 0
      let newIndex = 0
      for (let i = 0; i < withImage.length; i++) {
        const r = withImage[i]
        const payload = {
          imageUrl: r.imageUrl,
          title: r.title,
          subtitle: r.subtitle,
          linkUrl: r.linkUrl,
          openInNewTab: r.openInNewTab,
          displayOrder: r._id ? (r.displayOrder != null ? r.displayOrder : maxOrder + i) : maxOrder + newIndex,
          isActive: r.isActive !== false,
        }
        if (r._id) {
          await api.put(`/carousel/${r._id}`, payload, { params: { key: selectedCarouselKey } })
          updated++
        } else {
          await api.post("/carousel", payload, { params: { key: selectedCarouselKey } })
          created++
          newIndex++
        }
      }
      const msg = [updated && `${updated} updated`, created && `${created} added`].filter(Boolean).join(", ")
      setSuccess(msg ? `${msg}.` : "Saved.")
      resetForm()
      fetchSlides()
    } catch (err) {
      setError(err.response?.data?.msg || "Failed to save slides.")
    } finally {
      setSavingMulti(false)
    }
  }

  const handleDelete = async () => {
    if (!deletePopup.id) return
    try {
      await api.delete(`/carousel/${deletePopup.id}`, { params: { key: selectedCarouselKey } })
      setSuccess("Slide deleted.")
      setDeletePopup({ isVisible: false, id: null, message: "" })
      fetchSlides()
    } catch (err) {
      setError(err.response?.data?.msg || "Failed to delete.")
    }
  }

  const imageUrlFor = (url) => {
    if (!url) return null
    if (url.startsWith("http")) return url
    const base = getUploadBaseURL()
    return base + (url.startsWith("/") ? url : "/" + url)
  }

  return (
    <div className="paddingAll20">
      <PageHeader
        title="Full Width Carousel"
        subtitle="Manage carousel layout, settings and slides for the storefront."
        isEditing={!!editingId}
        editText="Edit Slide"
        createText="Add Slides"
      />

      <AlertMessage type="success" message={success} onClose={() => setSuccess("")} autoClose={true} />
      <AlertMessage type="error" message={error} onClose={() => setError("")} autoClose={true} />

      {/* Carousel layout & settings */}
      <div className="brandFormContainer paddingAll32 appendBottom30">
        <h3 className="listTitle font22 fontBold blackText appendBottom8">Carousel layout &amp; settings</h3>
        <p className="grayText appendBottom24 font14">Select a carousel, configure display options, then create to add slides.</p>
        <form onSubmit={handleSaveCarouselSettings} className="brandForm">
          <div className="makeFlex row gap10 appendBottom16">
            <div className="widthHalf">
              <label className="formLabel appendBottom8 block" htmlFor="carousel-select">Carousel</label>
              <select
                id="carousel-select"
                value={selectedCarouselKey}
                onChange={(e) => handleCarouselKeyChange(e.target.value)}
                className="formInput formSelect"
              >
                {CAROUSEL_KEYS.map(({ key: k, label }) => (
                  <option key={k} value={k}>{label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="makeFlex row gap10 appendBottom16">
            <div className="widthHalf">
              <label className="formLabel appendBottom8 block" htmlFor="carousel-layout">Display</label>
              <select
                id="carousel-layout"
                value={carouselLayout}
                onChange={(e) => setCarouselLayout(e.target.value)}
                className="formInput formSelect"
              >
                {CAROUSEL_LAYOUTS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="makeFlex row gap10 appendBottom16">
            <div className="widthHalf">
              <FormField
                label="Display name"
                type="text"
                value={carouselName}
                onChange={(e) => setCarouselName(e.target.value)}
                placeholder="e.g. Hero banner"
              />
            </div>
          </div>
          <div className="makeFlex row gap10 appendBottom16">
            <label className="makeFlex gap10 alignCenter font14">
              <input
                type="checkbox"
                checked={carouselShowDisplayName}
                onChange={(e) => setCarouselShowDisplayName(e.target.checked)}
              />
              Show display name on storefront
            </label>
          </div>
          <div className="makeFlex row gap10 appendBottom16">
            <div className="widthHalf">
              <label className="formLabel appendBottom8 block" htmlFor="carousel-slide-effect">Slide effect</label>
              <select
                id="carousel-slide-effect"
                value={carouselSlideEffect}
                onChange={(e) => setCarouselSlideEffect(e.target.value)}
                className="formInput formSelect"
              >
                {CAROUSEL_SLIDE_EFFECTS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="appendBottom20 paddingTop20" style={{ borderTop: "1px solid #e5e7eb" }}>
            <label className="formLabel appendBottom10 block">Playback &amp; timing</label>
            <div className="makeFlex row gap16 appendBottom16" style={{ flexWrap: "wrap" }}>
              <label className="makeFlex gap10 alignCenter font14">
                <input
                  type="checkbox"
                  checked={carouselAutoplay}
                  onChange={(e) => setCarouselAutoplay(e.target.checked)}
                />
                Autoplay
              </label>
              <div className="makeFlex alignCenter gap10">
                <label className="formLabel font14" htmlFor="carousel-interval">Interval (sec)</label>
                <input
                  id="carousel-interval"
                  type="number"
                  min={1}
                  max={60}
                  value={carouselAutoplayInterval}
                  onChange={(e) => setCarouselAutoplayInterval(Number(e.target.value) || 5)}
                  className="formInput"
                  style={{ width: 80 }}
                />
              </div>
              <div className="makeFlex alignCenter gap10">
                <label className="formLabel font14" htmlFor="carousel-transition">Transition (sec)</label>
                <input
                  id="carousel-transition"
                  type="number"
                  min={0.2}
                  max={2}
                  step={0.1}
                  value={carouselTransitionDuration}
                  onChange={(e) => setCarouselTransitionDuration(Number(e.target.value) || 0.5)}
                  className="formInput"
                  style={{ width: 80 }}
                />
              </div>
              <label className="makeFlex gap10 alignCenter font14">
                <input
                  type="checkbox"
                  checked={carouselLoop}
                  onChange={(e) => setCarouselLoop(e.target.checked)}
                />
                Loop carousel
              </label>
              <label className="makeFlex gap10 alignCenter font14">
                <input
                  type="checkbox"
                  checked={carouselPauseOnHover}
                  onChange={(e) => setCarouselPauseOnHover(e.target.checked)}
                />
                Pause on hover
              </label>
            </div>
          </div>
          <div className="appendBottom20 paddingTop20" style={{ borderTop: "1px solid #e5e7eb" }}>
            <label className="formLabel appendBottom10 block">Arrows &amp; dots</label>
            <div className="makeFlex row gap16 appendBottom16" style={{ flexWrap: "wrap" }}>
              <label className="makeFlex gap10 alignCenter font14">
                <input
                  type="checkbox"
                  checked={carouselShowArrows}
                  onChange={(e) => setCarouselShowArrows(e.target.checked)}
                />
                Show arrows
              </label>
              <div className="makeFlex alignCenter gap10">
                <label className="formLabel font14" htmlFor="carousel-arrows-position">Arrows position</label>
                <select
                  id="carousel-arrows-position"
                  value={carouselArrowsPosition}
                  onChange={(e) => setCarouselArrowsPosition(e.target.value)}
                  className="formInput formSelect"
                  style={{ width: 120 }}
                >
                  <option value="inside">Inside</option>
                  <option value="outside">Outside</option>
                </select>
              </div>
              <label className="makeFlex gap10 alignCenter font14">
                <input
                  type="checkbox"
                  checked={carouselShowDots}
                  onChange={(e) => setCarouselShowDots(e.target.checked)}
                />
                Show dots
              </label>
              <label className="makeFlex gap10 alignCenter font14">
                <input
                  type="checkbox"
                  checked={carouselDotsOutside}
                  onChange={(e) => setCarouselDotsOutside(e.target.checked)}
                />
                Dots outside image
              </label>
            </div>
          </div>
          <div className="appendBottom20 paddingTop20" style={{ borderTop: "1px solid #e5e7eb" }}>
            <label className="formLabel appendBottom10 block">Captions &amp; content</label>
            <div className="makeFlex row gap16 appendBottom16" style={{ flexWrap: "wrap" }}>
              <label className="makeFlex gap10 alignCenter font14">
                <input
                  type="checkbox"
                  checked={carouselShowSlideTitle}
                  onChange={(e) => setCarouselShowSlideTitle(e.target.checked)}
                />
                Show slide title
              </label>
              <label className="makeFlex gap10 alignCenter font14">
                <input
                  type="checkbox"
                  checked={carouselShowSlideSubtitle}
                  onChange={(e) => setCarouselShowSlideSubtitle(e.target.checked)}
                />
                Show slide subtitle
              </label>
              <div className="makeFlex alignCenter gap10">
                <label className="formLabel font14" htmlFor="carousel-caption-position">Caption position</label>
                <select
                  id="carousel-caption-position"
                  value={carouselCaptionPosition}
                  onChange={(e) => setCarouselCaptionPosition(e.target.value)}
                  className="formInput formSelect"
                  style={{ width: 120 }}
                >
                  <option value="overlay">Overlay</option>
                  <option value="below">Below</option>
                </select>
              </div>
              <div className="makeFlex alignCenter gap10">
                <label className="formLabel font14" htmlFor="carousel-image-fit">Image fit</label>
                <select
                  id="carousel-image-fit"
                  value={carouselImageFit}
                  onChange={(e) => setCarouselImageFit(e.target.value)}
                  className="formInput formSelect"
                  style={{ width: 120 }}
                >
                  <option value="cover">Cover</option>
                  <option value="contain">Contain</option>
                </select>
              </div>
            </div>
          </div>
          <div className="appendBottom20 paddingTop20" style={{ borderTop: "1px solid #e5e7eb" }}>
            <label className="formLabel appendBottom10 block">Colors &amp; styling</label>
            <div className="makeFlex row gap10 appendBottom16">
              <div className="fullWidth">
                <ColorField
                  label="Background color"
                  value={carouselBackgroundColor}
                  onChange={(v) => setCarouselBackgroundColor(v)}
                  placeholder="#111827"
                />
              </div>
            </div>
            <div className="makeFlex row gap10 appendBottom16">
              <div className="widthHalf">
                <NumericPxField
                  label="Display name font size"
                  name="displayNameFontSize"
                  value={carouselDisplayNameFontSize}
                  onChange={(e) => setCarouselDisplayNameFontSize(e.target.value)}
                />
              </div>
              <div className="widthHalf">
                <ColorField
                  label="Display name color"
                  value={carouselDisplayNameColor}
                  onChange={(v) => setCarouselDisplayNameColor(v)}
                  placeholder="#ffffff"
                />
              </div>
            </div>
            <div className="makeFlex row gap10 appendBottom16">
              <div className="widthHalf">
                <NumericPxField
                  label="Caption title font size"
                  name="captionTitleFontSize"
                  value={carouselCaptionTitleFontSize}
                  onChange={(e) => setCarouselCaptionTitleFontSize(e.target.value)}
                />
              </div>
              <div className="widthHalf">
                <ColorField
                  label="Caption title color"
                  value={carouselCaptionColor}
                  onChange={(v) => setCarouselCaptionColor(v)}
                  placeholder="#ffffff"
                />
              </div>
            </div>
            <div className="makeFlex row gap10 appendBottom16">
              <div className="widthHalf">
                <NumericPxField
                  label="Caption subtitle font size"
                  name="captionSubtitleFontSize"
                  value={carouselCaptionSubtitleFontSize}
                  onChange={(e) => setCarouselCaptionSubtitleFontSize(e.target.value)}
                />
              </div>
              <div className="widthHalf">
                <ColorField
                  label="Caption subtitle color"
                  value={carouselCaptionSubtitleColor}
                  onChange={(v) => setCarouselCaptionSubtitleColor(v)}
                  placeholder="#e5e7eb"
                />
              </div>
            </div>
            <div className="makeFlex row gap10 appendBottom16">
              <div className="widthHalf">
                <FormField
                  label="Overlay opacity (0–1)"
                  type="number"
                  name="captionOverlayOpacity"
                  value={carouselCaptionOverlayOpacity}
                  onChange={(e) => setCarouselCaptionOverlayOpacity(Number(e.target.value) ?? 0.8)}
                  min={0}
                  max={1}
                  step={0.1}
                />
              </div>
            </div>
          </div>
          <div className="makeFlex row gap10 appendBottom16 paddingTop20" style={{ borderTop: "1px solid #e5e7eb" }}>
            <div className="makeFlex column flexOne appendBottom16">
              <label className="formLabel appendBottom10">Status:</label>
              <label className="formLabel appendBottom8 makeFlex gap10">
                <input
                  type="checkbox"
                  checked={carouselIsActive}
                  onChange={(e) => setCarouselIsActive(e.target.checked)}
                />
                Active
              </label>
              <p className="negativeMarginTop10 grayText font14">Check this box to show the carousel on the storefront, uncheck to hide it</p>
            </div>
          </div>
          <div className="formActions paddingTop16">
            <button type="submit" disabled={savingSettings} className="btnPrimary">
              {savingSettings ? <span className="loadingSpinner">⏳</span> : showSlideSection ? "Save carousel settings" : "Create carousel"}
            </button>
          </div>
        </form>
      </div>

      {/* Storefront preview & slide options — shown after carousel is created */}
      {showSlideSection && (
      <>
      {publicSlides.length > 0 && (
        <div className="appendBottom30">
          <h3 className="listTitle font18 fontSemiBold blackText appendBottom16">Storefront preview</h3>
          <div
            className="brandFormContainer"
            style={{
              overflow: "hidden",
              borderRadius: 8,
              position: "relative",
              minHeight: 200,
              background: "#1a1a2e",
            }}
          >
            {carouselLayout === "fullWidth" ? (
              <div style={{ minHeight: 280, position: "relative" }}>
                {publicSlides.map((slide, idx) => (
                  <div
                    key={slide._id}
                    style={{
                      display: idx === carouselIndex ? "block" : "none",
                      position: "absolute",
                      inset: 0,
                      width: "100%",
                      height: "100%",
                    }}
                  >
                    <a
                      href={slide.linkUrl || "#"}
                      target={slide.openInNewTab ? "_blank" : "_self"}
                      rel={slide.openInNewTab ? "noopener noreferrer" : undefined}
                      style={{ display: "block", width: "100%", height: "100%", textDecoration: "none", color: "inherit" }}
                      onClick={(e) => !slide.linkUrl && e.preventDefault()}
                    >
                      <div style={{ width: "100%", height: 280, backgroundImage: `url(${imageUrlFor(slide.imageUrl)})`, backgroundSize: "cover", backgroundPosition: "center" }} />
                      {(slide.title || slide.subtitle) && (
                        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "20px 24px", background: "linear-gradient(transparent, rgba(0,0,0,0.7))", color: "#fff" }}>
                          {slide.title && <div style={{ fontWeight: 600, marginBottom: 4 }}>{slide.title}</div>}
                          {slide.subtitle && <div style={{ fontSize: "0.9rem", opacity: 0.9 }}>{slide.subtitle}</div>}
                        </div>
                      )}
                    </a>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: "16px 48px 40px", minHeight: 260 }}>
                <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                  {publicSlides.slice(carouselIndex * perPage, carouselIndex * perPage + perPage).map((slide) => (
                    <a
                      key={slide._id}
                      href={slide.linkUrl || "#"}
                      target={slide.openInNewTab ? "_blank" : "_self"}
                      rel={slide.openInNewTab ? "noopener noreferrer" : undefined}
                      style={{
                        flex: `1 1 ${100 / perPage - 2}%`,
                        minWidth: 120,
                        maxWidth: perPage === 2 ? "48%" : perPage === 3 ? "32%" : "24%",
                        textDecoration: "none",
                        color: "inherit",
                        background: "rgba(255,255,255,0.08)",
                        borderRadius: 8,
                        overflow: "hidden",
                      }}
                      onClick={(e) => !slide.linkUrl && e.preventDefault()}
                    >
                      <div
                        style={{
                          width: "100%",
                          aspectRatio: "4/3",
                          backgroundImage: `url(${imageUrlFor(slide.imageUrl)})`,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                        }}
                      />
                      {(slide.title || slide.subtitle) && (
                        <div style={{ padding: "10px 12px", color: "#fff", fontSize: "0.85rem" }}>
                          {slide.title && <div style={{ fontWeight: 600 }}>{slide.title}</div>}
                          {slide.subtitle && <div style={{ opacity: 0.9 }}>{slide.subtitle}</div>}
                        </div>
                      )}
                    </a>
                  ))}
                </div>
              </div>
            )}
            {pageCount > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => setCarouselIndex((i) => (i - 1 + pageCount) % pageCount)}
                  style={{
                    position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
                    width: 40, height: 40, borderRadius: "50%", border: "none", background: "rgba(255,255,255,0.9)",
                    cursor: "pointer", fontSize: "1.2rem", lineHeight: 1, boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
                  }}
                  aria-label="Previous"
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={() => setCarouselIndex((i) => (i + 1) % pageCount)}
                  style={{
                    position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                    width: 40, height: 40, borderRadius: "50%", border: "none", background: "rgba(255,255,255,0.9)",
                    cursor: "pointer", fontSize: "1.2rem", lineHeight: 1, boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
                  }}
                  aria-label="Next"
                >
                  ›
                </button>
                <div style={{ position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 8 }}>
                  {Array.from({ length: pageCount }, (_, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setCarouselIndex(idx)}
                      style={{
                        width: 8, height: 8, borderRadius: "50%", border: "none",
                        background: idx === carouselIndex ? "#fff" : "rgba(255,255,255,0.5)",
                        cursor: "pointer", padding: 0,
                      }}
                      aria-label={`Page ${idx + 1}`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Add / Edit slides — single form with Slide 1, Slide 2, … and + Add another slide */}
      <div className="brandFormContainer paddingAll32 appendBottom30" ref={editFormRef}>
        <h3 className="listTitle font22 fontBold blackText appendBottom8">{editingId ? "Edit slide" : "Add multiple slides"}</h3>
        <p className="grayText appendBottom24 font14">Fill each section, use &quot;+ Add another slide&quot; to add more, then click &quot;Save all slides&quot;.</p>
        <form onSubmit={handleSaveAllMulti} className="brandForm">
          {multiSlides.map((row, index) => (
            <div key={row.tempId} className="appendBottom24">
              {index > 0 && <div className="appendBottom20" style={{ borderTop: "1px solid #e5e7eb", paddingTop: 20 }} />}
              <div className="makeFlex spaceBetween alignCenter appendBottom16">
                <h4 className="font16 fontSemiBold blackText" style={{ margin: 0 }}>Slide {index + 1}</h4>
                <button
                  type="button"
                  onClick={() => removeMultiRow(row.tempId)}
                  className="btnSecondary"
                  disabled={multiSlides.length === 1}
                >
                  Remove
                </button>
              </div>
              <div className="makeFlex row gap10 appendBottom16">
                <div className="widthHalf">
                  <label className="formLabel appendBottom8 block">Choose image</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      try {
                        const fd = new FormData()
                        fd.append("image", file)
                        const res = await api.post("/carousel/upload-image", fd)
                        if (res.data?.imageUrl) updateMultiRow(row.tempId, "imageUrl", res.data.imageUrl)
                      } catch (err) {
                        setError(err.response?.data?.msg || "Image upload failed.")
                      }
                      e.target.value = ""
                    }}
                    className="formInput"
                  />
                </div>
                <div className="widthHalf">
                  <FormField
                    label="Or image URL"
                    type="text"
                    value={row.imageUrl}
                    onChange={(e) => updateMultiRow(row.tempId, "imageUrl", e.target.value)}
                    placeholder="Paste image URL"
                  />
                </div>
              </div>
              {row.imageUrl && (
                <div className="appendBottom16">
                  <img
                    src={imageUrlFor(row.imageUrl)}
                    alt=""
                    className="paddingTop8"
                    style={{ maxHeight: 80, maxWidth: 160, objectFit: "contain", borderRadius: 8, border: "1px solid #e5e7eb" }}
                    onError={(e) => { e.target.style.display = "none" }}
                  />
                </div>
              )}
              <div className="makeFlex row gap10 appendBottom16">
                <div className="widthHalf">
                  <FormField
                    label="Title"
                    type="text"
                    value={row.title}
                    onChange={(e) => updateMultiRow(row.tempId, "title", e.target.value)}
                    placeholder="Optional"
                  />
                </div>
                <div className="widthHalf">
                  <FormField
                    label="Subtitle"
                    type="text"
                    value={row.subtitle}
                    onChange={(e) => updateMultiRow(row.tempId, "subtitle", e.target.value)}
                    placeholder="Optional"
                  />
                </div>
              </div>
              <div className="makeFlex row gap10 appendBottom16">
                <div className="flexOne">
                  <FormField
                    label="Link URL"
                    type="text"
                    value={row.linkUrl}
                    onChange={(e) => updateMultiRow(row.tempId, "linkUrl", e.target.value)}
                    placeholder="Optional"
                  />
                </div>
                <div className="makeFlex alignCenter" style={{ paddingTop: 28 }}>
                  <label className="makeFlex gap10 alignCenter font14">
                    <input
                      type="checkbox"
                      checked={row.openInNewTab}
                      onChange={(e) => updateMultiRow(row.tempId, "openInNewTab", e.target.checked)}
                    />
                    Open in new tab
                  </label>
                </div>
              </div>
              <div className="makeFlex row gap10 appendBottom16">
                <div className="widthHalf">
                  <FormField
                    label="Display order"
                    type="number"
                    value={row.displayOrder ?? 0}
                    onChange={(e) => updateMultiRow(row.tempId, "displayOrder", parseInt(e.target.value, 10) || 0)}
                    min={0}
                  />
                </div>
                <div className="widthHalf makeFlex alignCenter" style={{ paddingTop: 28 }}>
                  <label className="makeFlex gap10 alignCenter font14">
                    <input
                      type="checkbox"
                      checked={row.isActive}
                      onChange={(e) => updateMultiRow(row.tempId, "isActive", e.target.checked)}
                    />
                    Active
                  </label>
                </div>
              </div>
            </div>
          ))}
          <div className="formActions paddingTop16">
            <button type="button" onClick={addMultiRow} className="btnSecondary">
              + Add another slide
            </button>
            <button type="submit" disabled={savingMulti || loading} className="btnPrimary">
              {savingMulti ? <span className="loadingSpinner">⏳</span> : `Save all slides (${multiSlides.filter((r) => (r.imageUrl || "").trim()).length} with image)`}
            </button>
            {editingId && (
              <button type="button" onClick={resetForm} className="btnSecondary">
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Slides list */}
      <div className="brandsListContainer paddingAll32">
        <div className="listHeader makeFlex spaceBetween end appendBottom24">
          <div className="leftSection">
            <h2 className="listTitle font30 fontBold blackText appendBottom16">Carousel slides ({filteredSlides.length})</h2>
            <StatusFilter
              statusFilter={statusFilter}
              onStatusChange={setStatusFilter}
              counts={calculateStandardStatusCounts(slides)}
              disabled={loading}
              statusOptions={[
                { key: "all", label: "All", count: slides.length, color: "black" },
                { key: "active", label: "Active", count: slides.filter((s) => s.isActive).length, color: "green" },
                { key: "inactive", label: "Inactive", count: slides.filter((s) => !s.isActive).length, color: "gray" },
              ]}
            />
          </div>
          <div className="rightSection makeFlex end gap10">
            <SearchField
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search slides..."
              disabled={loading}
              minWidth="250px"
            />
            {loading && <div className="loadingIndicator grayText">Loading...</div>}
            <ViewToggle viewMode={viewMode} onViewChange={setViewMode} disabled={loading} />
          </div>
        </div>

        {filteredSlides.length === 0 && !loading ? (
          <div className="emptyState textCenter paddingAll60">
            <div className="emptyIcon appendBottom16">🖼️</div>
            <h3 className="font22 fontSemiBold grayText appendBottom8">No carousel slides</h3>
            <p className="font16 grayText">Add a slide above to show a full-width carousel on the storefront.</p>
          </div>
        ) : (
          <>
            {viewMode === "card" && (
              <div
                style={{
                  width: "fit-content",
                  maxWidth: "100%",
                  background: "#fff",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                  borderRadius: 12,
                  border: "1px solid #e5e7eb",
                  overflow: "hidden",
                }}
              >
                {filteredSlides.map((s, index) => (
                  <div
                    key={s._id}
                    className="brandCardBody"
                    style={{
                      padding: "20px 24px",
                      borderBottom: index < filteredSlides.length - 1 ? "1px solid #f3f4f6" : "none",
                    }}
                  >
                    <div
                      className="brandCardHeader"
                      style={{ minWidth: 0, cursor: "pointer" }}
                      onClick={() => handleEdit(s)}
                      onKeyDown={(e) => e.key === "Enter" && handleEdit(s)}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="makeFlex alignCenter gap16">
                        <div className="brandLogo" style={{ width: 56, height: 56, overflow: "hidden", borderRadius: 8, flexShrink: 0 }}>
                          {s.imageUrl ? (
                            <img
                              src={imageUrlFor(s.imageUrl)}
                              alt=""
                              className="brandLogoImage"
                              style={{ cursor: "pointer", width: "100%", height: "100%", objectFit: "cover" }}
                              onClick={(e) => { e.stopPropagation(); handleImageClick(imageUrlFor(s.imageUrl)) }}
                              onError={(e) => { e.target.style.display = "none" }}
                            />
                          ) : (
                            <div
                              className="brandLogoPlaceholder"
                              style={{
                                width: "100%",
                                height: "100%",
                                background: generateBrandColor(s._id, s.title || "Slide"),
                                fontSize: "1.2rem",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              {(s.title || "S")[0].toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="brandInfo" style={{ minWidth: 0 }}>
                          <div className="brandName font16 fontSemiBold blackText">{s.title || "Untitled slide"}</div>
                          <div className="font12 grayText appendTop4">
                            Order {s.displayOrder ?? 0} · <span className={s.isActive ? "greenText" : "grayText"}>{s.isActive ? "Active" : "Inactive"}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    {(s.subtitle || s.linkUrl) && (
                      <div className="paddingTop12 font14 grayText" style={{ paddingLeft: 72 }}>
                        {s.subtitle && <div className="appendBottom6">{s.subtitle}</div>}
                        {s.linkUrl && (
                          <a href={s.linkUrl} target="_blank" rel="noopener noreferrer" style={{ wordBreak: "break-all", color: "inherit" }}>{s.linkUrl}</a>
                        )}
                      </div>
                    )}
                    <div className="paddingTop12" style={{ paddingLeft: 72 }} onClick={(e) => e.stopPropagation()}>
                      <ActionButtons
                        onEdit={() => handleEdit(s)}
                        onDelete={() => setDeletePopup({ isVisible: true, id: s._id, message: `Delete "${s.title || "Untitled"}"?` })}
                        loading={loading}
                        size="normal"
                        editText="✏️ Edit"
                        deleteText="🗑️ Delete"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {viewMode === "list" && (
              <div className="brandsListTable">
                <div className="tableContainer">
                  <table className="brandsTable">
                    <thead>
                      <tr>
                        <th className="tableHeader">Order</th>
                        <th className="tableHeader">Image</th>
                        <th className="tableHeader">Title</th>
                        <th className="tableHeader">Link</th>
                        <th className="tableHeader">Status</th>
                        <th className="tableHeader">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSlides.map((s) => (
                        <tr key={s._id} className={`tableRow ${!s.isActive ? "rowInactive" : ""}`.trim()}>
                          <td className="tableCell">{s.displayOrder ?? 0}</td>
                          <td className="tableCell">
                            {s.imageUrl ? (
                              <img
                                src={imageUrlFor(s.imageUrl)}
                                alt=""
                                style={{ width: 48, height: 36, objectFit: "cover", borderRadius: 4 }}
                                onError={(e) => { e.target.style.display = "none" }}
                              />
                            ) : "—"}
                          </td>
                          <td className="tableCell fontSemiBold">{s.title || "—"}</td>
                          <td className="tableCell font12">{s.linkUrl ? (s.linkUrl.length > 40 ? s.linkUrl.slice(0, 40) + "…" : s.linkUrl) : "—"}</td>
                          <td className="tableCell">
                            <span className={s.isActive ? "greenText" : "grayText"}>{s.isActive ? "Active" : "Inactive"}</span>
                          </td>
                          <td className="tableCell">
                            <ActionButtons
                              onEdit={() => handleEdit(s)}
                              onDelete={() => setDeletePopup({ isVisible: true, id: s._id, message: `Delete "${s.title || "Untitled"}"?` })}
                              loading={loading}
                              size="normal"
                              editText="✏️ Edit"
                              deleteText="🗑️ Delete"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      </>
      )}

      {imagePopup.isVisible && (
        <div
          className="imagePopupOverlay"
          onClick={handleCloseImagePopup}
          style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000, cursor: "pointer",
          }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ position: "relative", maxWidth: "90vw", maxHeight: "90vh", backgroundColor: "white", borderRadius: 8, padding: 20, boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}>
            <button type="button" onClick={handleCloseImagePopup} style={{ position: "absolute", top: 10, right: 10, background: "#ff4444", color: "white", border: "none", borderRadius: "50%", width: 30, height: 30, fontSize: 20, cursor: "pointer" }} aria-label="Close">×</button>
            <img src={imagePopup.imageUrl} alt="Slide" style={{ maxWidth: "100%", maxHeight: "85vh", objectFit: "contain" }} onError={(e) => { e.target.style.display = "none" }} />
          </div>
        </div>
      )}

      <DeleteConfirmationPopup
        isVisible={deletePopup.isVisible}
        message={deletePopup.message}
        onConfirm={handleDelete}
        onCancel={() => setDeletePopup({ isVisible: false, id: null, message: "" })}
      />
    </div>
  )
}

export default FrontendCarousel
