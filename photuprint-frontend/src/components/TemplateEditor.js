"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import dynamic from "next/dynamic"

const PixelCraftEditor = dynamic(() => import("./PixelCraftEditor"), { ssr: false })

/**
 * TemplateEditor - Canvas-based template editor with layered images
 *
 * Props:
 * - template: Template object with backgroundImages, logoImages, etc.
 * - onSave: Callback when user saves the customization
 *
 * Features:
 * - Background images (non-editable, bottom layer)
 * - Logo images (can be deleted or hidden, resizable by mouse)
 * - User can upload their own custom image on top of background
 * - Mouse resize support for images
 */
export default function TemplateEditor({ template, onSave, constrained = false, simplified = false }) {
  const canvasRef = useRef(null)
  const containerRef = useRef(null)
  const fileInputRef = useRef(null)

  // Log template prop on every render for debugging
  console.log("TemplateEditor render - template:", template?.name, "backgroundImages:", template?.backgroundImages?.length || 0)

  // Canvas state
  const [canvasSize, setCanvasSize] = useState({ width: 600, height: 600 })
  const [isLoading, setIsLoading] = useState(true)
  const [isCanvasReady, setIsCanvasReady] = useState(false)

  // Background state
  const [selectedBackgroundIndex, setSelectedBackgroundIndex] = useState(0)
  const [backgroundImage, setBackgroundImage] = useState(null)

  // Logo state - showLogo will be set to true if logoImages exist (in useEffect below)
  const [showLogo, setShowLogo] = useState(false)
  const [selectedLogoIndex, setSelectedLogoIndex] = useState(0)
  const [logoImage, setLogoImage] = useState(null)
  const [logoPosition, setLogoPosition] = useState({ x: 50, y: 30 })
  const [logoScale, setLogoScale] = useState(0.25)
  const [logoInitialized, setLogoInitialized] = useState(false)

  // User uploaded image state
  const [userImage, setUserImage] = useState(null)
  // In simplified mode, position at top left (x: 5%, y: 5%)
  const [userImagePosition, setUserImagePosition] = useState({ x: simplified ? 5 : 50, y: simplified ? 5 : 50 })
  const [userImageScale, setUserImageScale] = useState(0.4)
  const [userImageFile, setUserImageFile] = useState(null)

  // Text option state (when textOption is true from template)
  const [textValue, setTextValue] = useState("")
  const [textPosition, setTextPosition] = useState({ x: simplified ? 10 : 50, y: simplified ? 15 : 50 })
  const [textFontSize, setTextFontSize] = useState(24)
  const [textColor, setTextColor] = useState("#000000")
  const [textFontFamily, setTextFontFamily] = useState("Arial")
  const [textBold, setTextBold] = useState(false)
  const [textItalic, setTextItalic] = useState(false)
  const [textUnderline, setTextUnderline] = useState(false)
  const [textAlign, setTextAlign] = useState("left") // left, center, right
  const [textCurve, setTextCurve] = useState(0) // Curve amount: 0 = straight, positive = curve up, negative = curve down

  // Interaction state
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [dragTarget, setDragTarget] = useState(null) // 'logo' or 'userImage'
  const [resizeTarget, setResizeTarget] = useState(null) // 'logo' or 'userImage'
  const [resizeHandle, setResizeHandle] = useState(null) // 'nw', 'ne', 'sw', 'se'
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [resizeStartData, setResizeStartData] = useState(null)

  // Active layer for controls
  const [activeLayer, setActiveLayer] = useState("userImage")

  // Cursor state
  const [cursorStyle, setCursorStyle] = useState("default")

  // Controls panel visibility for constrained mode
  const [showControls, setShowControls] = useState(false)

  // Text controls panel visibility - initially hidden, opens on double-click
  const [showTextControls, setShowTextControls] = useState(false)
  const textControlsRef = useRef(null)

  // Handle click outside text controls to close them
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showTextControls && textControlsRef.current && !textControlsRef.current.contains(event.target)) {
        // Check if click is on canvas (allow canvas interactions)
        if (canvasRef.current && canvasRef.current.contains(event.target)) {
          return // Don't close if clicking on canvas
        }
        setShowTextControls(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [showTextControls])

  // Handle size for resize corners
  const HANDLE_SIZE = 12

  // Get image URLs and text option
  const backgroundImages = template?.backgroundImages || []
  const logoImages = template?.logoImages || []
  // Only show text options if textOption is explicitly true from backend
  const textOption = template?.textOption === true

  // Reset logo state when template changes
  useEffect(() => {
    // Reset initialized flag when template ID changes
    setLogoInitialized(false)
  }, [template?._id])

  // Auto-show logo if template has logo images (only on initial load/template change)
  // Also initialize logo position and scale from template config
  useEffect(() => {
    if (template?._id && !logoInitialized) {
      if (logoImages.length > 0) {
        console.log("TemplateEditor: Auto-showing logo - logoImages found:", logoImages.length)
        setShowLogo(true)
        setSelectedLogoIndex(0)

        // Initialize logo position and scale from template config
        const logoConfig = template?.logoConfig || {}
        if (logoConfig.defaultPosition) {
          console.log("TemplateEditor: Setting logo position from config:", logoConfig.defaultPosition)
          setLogoPosition({
            x: logoConfig.defaultPosition.x || 50,
            y: logoConfig.defaultPosition.y || 30,
          })
        }
        if (logoConfig.defaultScale) {
          // Convert percentage (0-100) to scale factor (0-1)
          const scaleFactor = (logoConfig.defaultScale || 25) / 100
          console.log("TemplateEditor: Setting logo scale from config:", logoConfig.defaultScale, "-> factor:", scaleFactor)
          setLogoScale(scaleFactor)
        }
      } else {
        console.log("TemplateEditor: No logo images - hiding logo")
        setShowLogo(false)
      }
      setLogoInitialized(true)
    }
  }, [template?._id, logoImages.length, logoInitialized, template?.logoConfig])

  // Get text configuration from template (or use defaults)
  const textConfig = template?.textConfig || {}
  const availableFonts = textConfig.fontFamilies?.length > 0 ? textConfig.fontFamilies : ["Arial", "Times New Roman", "Courier New", "Georgia", "Verdana", "Comic Sans MS", "Impact"]

  // Load Google Fonts dynamically when template fonts change
  useEffect(() => {
    // Google Fonts list - these need to be loaded dynamically
    const googleFontsList = ["Roboto", "Open Sans", "Lato", "Montserrat", "Poppins", "Oswald", "Raleway", "Playfair Display", "Merriweather", "Dancing Script", "Pacifico", "Lobster", "Great Vibes", "Caveat", "Satisfy", "Permanent Marker"]

    if (availableFonts.length > 0) {
      // Filter to only Google Fonts that need loading
      const googleFontsToLoad = availableFonts.filter((font) => googleFontsList.includes(font))

      if (googleFontsToLoad.length > 0) {
        // Check if we already have a Google Fonts link
        const existingLink = document.querySelector('link[data-google-fonts="true"]')

        // Create font families string for Google Fonts API
        const fontFamilies = googleFontsToLoad.map((font) => font.replace(/ /g, "+")).join("&family=")
        const googleFontsUrl = `https://fonts.googleapis.com/css2?family=${fontFamilies}&display=swap`

        if (existingLink) {
          // Update existing link if URL changed
          if (existingLink.href !== googleFontsUrl) {
            existingLink.href = googleFontsUrl
            console.log("TemplateEditor: Updated Google Fonts:", googleFontsToLoad)
          }
        } else {
          // Create new link element
          const link = document.createElement("link")
          link.href = googleFontsUrl
          link.rel = "stylesheet"
          link.setAttribute("data-google-fonts", "true")
          document.head.appendChild(link)
          console.log("TemplateEditor: Loaded Google Fonts:", googleFontsToLoad)
        }
      }
    }
  }, [availableFonts])

  // Initialize text defaults from textConfig when template changes
  useEffect(() => {
    console.log("TemplateEditor: Text initialization effect running", { textOption, textConfig, templateId: template?._id })

    if (textOption) {
      // Load font family
      if (textConfig?.defaultFontFamily && availableFonts.includes(textConfig.defaultFontFamily)) {
        setTextFontFamily(textConfig.defaultFontFamily)
      }
      // Load font size
      if (textConfig?.defaultFontSize) {
        setTextFontSize(textConfig.defaultFontSize)
      }
      // Load font color
      if (textConfig?.defaultFontColor) {
        setTextColor(textConfig.defaultFontColor)
      }
      // Load sample text - use default if none provided
      const sampleText = textConfig?.sampleText || "Your Text Here"
      console.log("TemplateEditor: Setting text value to:", sampleText)
      setTextValue(sampleText)

      // Load bold, italic, underline defaults
      if (textConfig?.defaultBold !== undefined) {
        setTextBold(textConfig.defaultBold)
      }
      if (textConfig?.defaultItalic !== undefined) {
        setTextItalic(textConfig.defaultItalic)
      }
      if (textConfig?.defaultUnderline !== undefined) {
        setTextUnderline(textConfig.defaultUnderline)
      }
      // Load default curve
      if (textConfig?.defaultCurve !== undefined) {
        setTextCurve(textConfig.defaultCurve)
      }
      // Load default text position
      if (textConfig?.defaultTextPosition) {
        setTextPosition({
          x: textConfig.defaultTextPosition.x || (simplified ? 10 : 50),
          y: textConfig.defaultTextPosition.y || (simplified ? 15 : 50),
        })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template?._id, textOption])

  // Keyboard delete handler
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Check if Delete or Backspace key is pressed
      if (e.key === "Delete" || e.key === "Backspace") {
        // Don't delete if user is typing in an input field
        if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") {
          return
        }

        e.preventDefault()

        // Delete the active layer
        if (activeLayer === "userImage" && userImage) {
          // Inline handleRemoveUserImage logic
          setUserImage(null)
          setUserImageFile(null)
          if (fileInputRef.current) {
            fileInputRef.current.value = ""
          }
          // Show logo again when user removes their uploaded image (if logo images exist)
          if (logoImages && logoImages.length > 0) {
            setShowLogo(true)
          }
        } else if (activeLayer === "logo" && showLogo) {
          setShowLogo(false)
        } else if (activeLayer === "text" && textValue) {
          setTextValue("")
        }
      }
    }

    // Add event listener
    window.addEventListener("keydown", handleKeyDown)

    // Cleanup
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [activeLayer, userImage, showLogo, textValue, logoImages])

  // Update canvas size when container size changes (for constrained mode)
  useEffect(() => {
    if (constrained && containerRef.current) {
      const updateCanvasSize = () => {
        const container = containerRef.current
        if (!container) return

        // Get container dimensions (accounting for padding/borders)
        const containerRect = container.getBoundingClientRect()
        const containerWidth = containerRect.width
        const containerHeight = containerRect.height

        // Skip if container has no dimensions yet
        if (containerWidth <= 0 || containerHeight <= 0) {
          console.log("TemplateEditor: Container not ready, waiting...")
          return
        }

        if (backgroundImage && backgroundImage.width && backgroundImage.height) {
          // Fit canvas to container while maintaining aspect ratio
          const imgAspectRatio = backgroundImage.height / backgroundImage.width
          const containerAspectRatio = containerHeight / containerWidth

          let width, height
          if (imgAspectRatio > containerAspectRatio) {
            // Image is taller - fit to height
            height = containerHeight
            width = height / imgAspectRatio
          } else {
            // Image is wider - fit to width
            width = containerWidth
            height = width * imgAspectRatio
          }

          // Ensure minimum size
          if (width > 0 && height > 0) {
            console.log("TemplateEditor: Setting canvas size based on image:", Math.round(width), "x", Math.round(height))
            setCanvasSize({ width: Math.round(width), height: Math.round(height) })
          }
        } else {
          // Default size if no background - fill container
          console.log("TemplateEditor: Setting default canvas size:", Math.round(containerWidth), "x", Math.round(containerHeight))
          setCanvasSize({
            width: Math.round(containerWidth),
            height: Math.round(containerHeight),
          })
        }
      }

      // Run immediately when backgroundImage becomes available
      updateCanvasSize()

      // Also set a small delay in case container isn't ready
      const timeoutId = setTimeout(updateCanvasSize, 50)

      // Update on resize
      window.addEventListener("resize", updateCanvasSize)

      return () => {
        clearTimeout(timeoutId)
        window.removeEventListener("resize", updateCanvasSize)
      }
    }
  }, [constrained, backgroundImage])

  // Reset to first background image when template changes
  useEffect(() => {
    if (template) {
      setSelectedBackgroundIndex(0)
    }
  }, [template])

  // Load background image - re-run when template or selectedBackgroundIndex changes
  useEffect(() => {
    let isCancelled = false
    let imgElement = null

    if (!template) {
      setBackgroundImage(null)
      setIsLoading(false)
      setIsCanvasReady(true)
      return
    }

    // Get background images from template directly; fallback to previewImage for PixelCraft/legacy templates
    const rawBackgrounds = template?.backgroundImages || []
    const templateBackgroundImages =
      rawBackgrounds.length > 0 ? rawBackgrounds : template?.previewImage ? [template.previewImage] : []

    if (templateBackgroundImages.length > 0 && selectedBackgroundIndex < templateBackgroundImages.length) {
      setIsLoading(true)
      setIsCanvasReady(false)

      imgElement = new Image()
      imgElement.crossOrigin = "anonymous"
      const imgUrl = templateBackgroundImages[selectedBackgroundIndex]

      // Handle both Cloudinary URLs and local URLs
      let fullUrl = imgUrl
      if (!imgUrl.startsWith("http")) {
        fullUrl = `http://localhost:8080${imgUrl}`
      }

      console.log("TemplateEditor: Loading background image:", fullUrl, "from template:", template.name)

      imgElement.onload = () => {
        if (isCancelled) {
          console.log("TemplateEditor: Image load cancelled (stale)")
          return
        }
        console.log("TemplateEditor: Background image loaded successfully:", imgElement.width, "x", imgElement.height)
        setBackgroundImage(imgElement)
        if (!constrained) {
          const maxWidth = containerRef.current?.clientWidth || 600
          const aspectRatio = imgElement.height / imgElement.width
          setCanvasSize({
            width: maxWidth,
            height: maxWidth * aspectRatio,
          })
        }
        setIsLoading(false)
        setIsCanvasReady(true)
      }

      imgElement.onerror = (error) => {
        if (isCancelled) return
        console.error("TemplateEditor: Failed to load background image:", fullUrl, error)
        setBackgroundImage(null)
        setIsLoading(false)
        setIsCanvasReady(true)
      }

      // Set src after handlers to ensure they're attached
      imgElement.src = fullUrl
    } else {
      console.warn("TemplateEditor: No background images in template:", template?.name, "images:", templateBackgroundImages.length)
      setBackgroundImage(null)
      setIsLoading(false)
      setIsCanvasReady(true)
    }

    // Cleanup function
    return () => {
      isCancelled = true
      if (imgElement) {
        imgElement.onload = null
        imgElement.onerror = null
      }
    }
  }, [template, selectedBackgroundIndex, constrained])

  // Load logo image
  useEffect(() => {
    console.log("TemplateEditor: Logo image effect - showLogo:", showLogo, "logoImages:", logoImages.length, "selectedLogoIndex:", selectedLogoIndex)
    if (logoImages.length > 0 && selectedLogoIndex < logoImages.length && showLogo) {
      const img = new Image()
      img.crossOrigin = "anonymous"
      const imgUrl = logoImages[selectedLogoIndex]
      const fullUrl = imgUrl.startsWith("http") ? imgUrl : `http://localhost:8080${imgUrl}`
      console.log("TemplateEditor: Loading logo image from:", fullUrl)
      img.src = fullUrl
      img.onload = () => {
        console.log("TemplateEditor: Logo image loaded successfully")
        setLogoImage(img)
      }
      img.onerror = (err) => {
        console.error("TemplateEditor: Failed to load logo image:", err)
        console.error("Failed to load logo image")
        setLogoImage(null)
      }
    } else {
      setLogoImage(null)
    }
  }, [logoImages, selectedLogoIndex, showLogo])

  // Handle user image upload
  const handleUserImageUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith("image/")) {
      alert("Please upload an image file")
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      alert("Image size should be less than 5MB")
      return
    }

    setUserImageFile(file)

    const reader = new FileReader()
    reader.onload = (event) => {
      const img = new Image()
      img.onload = () => {
        setUserImage(img)
        // In simplified mode, position at top left (5%, 5%), otherwise center (50%, 50%)
        setUserImagePosition(simplified ? { x: 5, y: 5 } : { x: 50, y: 50 })
        setActiveLayer("userImage")
        // Hide logo when user uploads their own image (logo and user image are mutually exclusive)
        setShowLogo(false)
      }
      img.src = event.target.result
    }
    reader.readAsDataURL(file)
  }

  const handleRemoveUserImage = () => {
    setUserImage(null)
    setUserImageFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
    // Show logo again when user removes their uploaded image (if logo images exist)
    if (logoImages && logoImages.length > 0) {
      setShowLogo(true)
    }
  }

  // Get image bounds
  const getImageBounds = useCallback((position, scale, image, canvas) => {
    if (!image || !canvas) return null
    const width = canvas.width * scale
    const height = (image.height / image.width) * width
    const x = (position.x / 100) * canvas.width - width / 2
    const y = (position.y / 100) * canvas.height - height / 2
    return { x, y, width, height }
  }, [])

  // Get resize handle positions
  const getResizeHandles = useCallback((bounds) => {
    if (!bounds) return []
    const hs = HANDLE_SIZE
    return [
      { id: "nw", x: bounds.x - hs / 2, y: bounds.y - hs / 2, cursor: "nwse-resize" },
      { id: "ne", x: bounds.x + bounds.width - hs / 2, y: bounds.y - hs / 2, cursor: "nesw-resize" },
      { id: "sw", x: bounds.x - hs / 2, y: bounds.y + bounds.height - hs / 2, cursor: "nesw-resize" },
      { id: "se", x: bounds.x + bounds.width - hs / 2, y: bounds.y + bounds.height - hs / 2, cursor: "nwse-resize" },
    ]
  }, [])

  // Check if point is in resize handle
  const getHandleAtPoint = useCallback(
    (px, py, bounds) => {
      if (!bounds) return null
      const handles = getResizeHandles(bounds)
      for (const handle of handles) {
        if (px >= handle.x && px <= handle.x + HANDLE_SIZE && py >= handle.y && py <= handle.y + HANDLE_SIZE) {
          return handle
        }
      }
      return null
    },
    [getResizeHandles]
  )

  // Check if point is inside bounds
  const isPointInBounds = (px, py, bounds) => {
    if (!bounds) return false
    return px >= bounds.x && px <= bounds.x + bounds.width && py >= bounds.y && py <= bounds.y + bounds.height
  }

  // Draw canvas with all layers
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    // Disable image smoothing for crisp rendering
    ctx.imageSmoothingEnabled = false
    ctx.imageSmoothingQuality = "high"
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Layer 1: Background
    if (backgroundImage) {
      // Enable image smoothing for background to prevent blur
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = "high"
      ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height)
      // Disable smoothing for other elements
      ctx.imageSmoothingEnabled = false
    } else {
      ctx.fillStyle = "#f3f4f6"
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = "#9ca3af"
      ctx.font = "16px sans-serif"
      ctx.textAlign = "center"
      ctx.fillText("No background image", canvas.width / 2, canvas.height / 2)
    }

    // Layer 2: Logo (shown in both normal and simplified modes)
    console.log("TemplateEditor: Logo layer check - showLogo:", showLogo, "logoImage:", !!logoImage, "position:", logoPosition, "scale:", logoScale)
    if (showLogo && logoImage) {
      const bounds = getImageBounds(logoPosition, logoScale, logoImage, canvas)
      console.log("TemplateEditor: Drawing logo with bounds:", bounds)
      if (bounds) {
        // Enable image smoothing for logos to prevent blur
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = "high"
        // Use Math.round to ensure pixel-perfect positioning
        ctx.drawImage(logoImage, Math.round(bounds.x), Math.round(bounds.y), Math.round(bounds.width), Math.round(bounds.height))
        // Disable smoothing again for other elements
        ctx.imageSmoothingEnabled = false

        // Draw selection and resize handles when logo is active
        if (activeLayer === "logo") {
          ctx.strokeStyle = "#8b5cf6"
          ctx.lineWidth = 2
          ctx.setLineDash([5, 5])
          ctx.strokeRect(bounds.x - 2, bounds.y - 2, bounds.width + 4, bounds.height + 4)
          ctx.setLineDash([])

          // Draw resize handles
          ctx.fillStyle = "#8b5cf6"
          const handles = getResizeHandles(bounds)
          handles.forEach((handle) => {
            ctx.fillRect(handle.x, handle.y, HANDLE_SIZE, HANDLE_SIZE)
            ctx.strokeStyle = "#ffffff"
            ctx.lineWidth = 1
            ctx.strokeRect(handle.x, handle.y, HANDLE_SIZE, HANDLE_SIZE)
          })
        }
      }
    }

    // Layer 3: User uploaded image
    if (userImage) {
      const bounds = getImageBounds(userImagePosition, userImageScale, userImage, canvas)
      if (bounds) {
        // Enable image smoothing for user images to prevent blur
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = "high"
        // Use Math.round to ensure pixel-perfect positioning
        ctx.drawImage(userImage, Math.round(bounds.x), Math.round(bounds.y), Math.round(bounds.width), Math.round(bounds.height))
        // Disable smoothing again for other elements
        ctx.imageSmoothingEnabled = false

        // Draw selection and resize handles when user image is active
        if (activeLayer === "userImage") {
          ctx.strokeStyle = "#10b981"
          ctx.lineWidth = 2
          ctx.setLineDash([5, 5])
          ctx.strokeRect(bounds.x - 2, bounds.y - 2, bounds.width + 4, bounds.height + 4)
          ctx.setLineDash([])

          // Draw resize handles
          ctx.fillStyle = "#10b981"
          const handles = getResizeHandles(bounds)
          handles.forEach((handle) => {
            ctx.fillRect(handle.x, handle.y, HANDLE_SIZE, HANDLE_SIZE)
            ctx.strokeStyle = "#ffffff"
            ctx.lineWidth = 1
            ctx.strokeRect(handle.x, handle.y, HANDLE_SIZE, HANDLE_SIZE)
          })
        }
      }
    }

    // Layer 4: Text (when textOption is enabled)
    console.log("TemplateEditor: Text layer check - textOption:", textOption, "textValue:", textValue)
    if (textOption && textValue) {
      console.log("TemplateEditor: Drawing text:", textValue, "at position:", textPosition, "color:", textColor, "fontSize:", textFontSize)
      const x = (textPosition.x / 100) * canvas.width
      const y = (textPosition.y / 100) * canvas.height

      // Build font string
      let fontStyle = ""
      if (textItalic) fontStyle += "italic "
      if (textBold) fontStyle += "bold "
      const fontString = `${fontStyle}${textFontSize}px ${textFontFamily}`

      ctx.font = fontString
      ctx.fillStyle = textColor
      ctx.textAlign = textAlign
      ctx.textBaseline = "top"

      // Calculate text width for alignment
      const textMetrics = ctx.measureText(textValue)
      const textWidth = textMetrics.width
      let drawX = x

      if (textAlign === "center") {
        drawX = x - textWidth / 2
      } else if (textAlign === "right") {
        drawX = x - textWidth
      }

      // Draw text with curve if enabled
      if (textCurve !== 0 && textValue.length > 0) {
        // Draw curved text along an arc path
        const curveIntensity = Math.abs(textCurve) * 0.5 // Curve intensity multiplier
        const curveDirection = textCurve > 0 ? 1 : -1

        ctx.save()

        // Calculate arc parameters
        const centerX = drawX + textWidth / 2
        const centerY = y + textFontSize / 2
        const radius = Math.max(textWidth / 2, textFontSize) + curveIntensity * 20

        // Draw each character along the arc
        let currentX = 0
        for (let i = 0; i < textValue.length; i++) {
          const char = textValue[i]
          const charWidth = ctx.measureText(char).width

          // Calculate angle based on position along text width
          const normalizedX = (currentX + charWidth / 2 - textWidth / 2) / (textWidth / 2)
          const angle = normalizedX * (Math.PI / 3) * curveDirection // Max 60 degree arc

          // Calculate position on arc
          const charX = centerX + Math.sin(angle) * radius * curveDirection
          const charY = centerY - Math.cos(angle) * radius + Math.abs(angle) * curveIntensity * 5

          // Rotate character to follow curve
          ctx.save()
          ctx.translate(charX, charY)
          ctx.rotate(angle)
          ctx.fillText(char, 0, 0)
          ctx.restore()

          currentX += charWidth
        }

        ctx.restore()
      } else {
        // Draw straight text
        ctx.fillText(textValue, Math.round(drawX), Math.round(y))

        // Draw underline if enabled
        if (textUnderline) {
          ctx.strokeStyle = textColor
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.moveTo(Math.round(drawX), Math.round(y + textFontSize + 2))
          ctx.lineTo(Math.round(drawX + textWidth), Math.round(y + textFontSize + 2))
          ctx.stroke()
        }
      }

      // Draw selection border when text is active
      if (activeLayer === "text") {
        let textHeight = textFontSize
        let borderX = drawX
        let borderWidth = textWidth
        let borderY = y

        if (textAlign === "center") {
          borderX = x - textWidth / 2
        } else if (textAlign === "right") {
          borderX = x - textWidth
        }

        // Adjust border for curved text
        if (textCurve !== 0) {
          const curveIntensity = Math.abs(textCurve) * 0.5
          // Expand border to encompass curved text
          const extraWidth = curveIntensity * 10
          const extraHeight = curveIntensity * 20
          borderX -= extraWidth / 2
          borderY -= extraHeight / 2
          borderWidth += extraWidth
          textHeight += extraHeight
        }

        ctx.strokeStyle = "#3b82f6"
        ctx.lineWidth = 2
        ctx.setLineDash([5, 5])
        ctx.strokeRect(Math.round(borderX) - 2, Math.round(borderY) - 2, Math.round(borderWidth) + 4, Math.round(textHeight) + 4)
        ctx.setLineDash([])
      }
    }
  }, [backgroundImage, logoImage, showLogo, logoPosition, logoScale, userImage, userImagePosition, userImageScale, activeLayer, getImageBounds, getResizeHandles, simplified, textOption, textValue, textPosition, textFontSize, textColor, textFontFamily, textBold, textItalic, textUnderline, textAlign, textCurve])

  // Redraw canvas when state changes or canvas becomes ready
  useEffect(() => {
    if (isCanvasReady && canvasRef.current) {
      // Use requestAnimationFrame to ensure the canvas is ready for drawing
      requestAnimationFrame(() => {
        drawCanvas()
      })
    }
  }, [drawCanvas, isCanvasReady, canvasSize])

  // Handle mouse move for cursor changes
  const handleCanvasMouseMove = (e) => {
    if (isDragging || isResizing) {
      handleMouseMove(e)
      return
    }

    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    // Check user image handles first
    if (userImage) {
      const userBounds = getImageBounds(userImagePosition, userImageScale, userImage, canvas)
      const userHandle = getHandleAtPoint(x, y, userBounds)
      if (userHandle) {
        setCursorStyle(userHandle.cursor)
        return
      }
      if (isPointInBounds(x, y, userBounds)) {
        setCursorStyle("move")
        return
      }
    }

    // Check logo handles
    if (showLogo && logoImage) {
      const logoBounds = getImageBounds(logoPosition, logoScale, logoImage, canvas)
      const logoHandle = getHandleAtPoint(x, y, logoBounds)
      if (logoHandle) {
        setCursorStyle(logoHandle.cursor)
        return
      }
      if (isPointInBounds(x, y, logoBounds)) {
        setCursorStyle("move")
        return
      }
    }

    // Check text (when textOption is enabled)
    if (textOption && textValue) {
      const textX = (textPosition.x / 100) * canvas.width
      const textY = (textPosition.y / 100) * canvas.height
      const ctx = canvas.getContext("2d")
      let fontStyle = ""
      if (textItalic) fontStyle += "italic "
      if (textBold) fontStyle += "bold "
      ctx.font = `${fontStyle}${textFontSize}px ${textFontFamily}`
      const textMetrics = ctx.measureText(textValue)
      const textWidth = textMetrics.width
      let textHeight = textFontSize

      // Calculate actual text bounds based on alignment
      let textLeft = textX
      if (textAlign === "center") {
        textLeft = textX - textWidth / 2
      } else if (textAlign === "right") {
        textLeft = textX - textWidth
      }

      // Adjust bounds for curved text
      let curveExtraWidth = 0
      let curveExtraHeight = 0
      if (textCurve !== 0) {
        const curveIntensity = Math.abs(textCurve) * 0.5
        // Curved text spreads wider and taller
        curveExtraWidth = curveIntensity * 15
        curveExtraHeight = curveIntensity * 25
        textHeight += curveExtraHeight
      }

      // Increased padding (20px) for easier text selection and dragging
      const textPadding = 20 + curveExtraWidth
      const verticalPadding = 20 + curveExtraHeight
      if (x >= textLeft - textPadding && x <= textLeft + textWidth + textPadding && y >= textY - verticalPadding && y <= textY + textHeight + verticalPadding) {
        setCursorStyle("move")
        return
      }
    }

    setCursorStyle("default")
  }

  // Handle mouse down
  const handleMouseDown = (e) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    // Check user image first (top layer)
    if (userImage) {
      const userBounds = getImageBounds(userImagePosition, userImageScale, userImage, canvas)

      // Check resize handles first
      const userHandle = getHandleAtPoint(x, y, userBounds)
      if (userHandle) {
        setIsResizing(true)
        setResizeTarget("userImage")
        setResizeHandle(userHandle.id)
        setActiveLayer("userImage")
        setResizeStartData({
          mouseX: x,
          mouseY: y,
          scale: userImageScale,
          position: { ...userImagePosition },
          bounds: { ...userBounds },
        })
        return
      }

      // Check if clicking on image for drag
      if (isPointInBounds(x, y, userBounds)) {
        setIsDragging(true)
        setDragTarget("userImage")
        setActiveLayer("userImage")
        setDragOffset({
          x: x - (userImagePosition.x / 100) * canvas.width,
          y: y - (userImagePosition.y / 100) * canvas.height,
        })
        return
      }
    }

    // Check logo
    if (showLogo && logoImage) {
      const logoBounds = getImageBounds(logoPosition, logoScale, logoImage, canvas)
      console.log("Logo bounds check - click:", { x, y }, "bounds:", logoBounds, "inBounds:", logoBounds ? isPointInBounds(x, y, logoBounds) : false)

      // Check resize handles first
      const logoHandle = getHandleAtPoint(x, y, logoBounds)
      if (logoHandle) {
        setIsResizing(true)
        setResizeTarget("logo")
        setResizeHandle(logoHandle.id)
        setActiveLayer("logo")
        setResizeStartData({
          mouseX: x,
          mouseY: y,
          scale: logoScale,
          position: { ...logoPosition },
          bounds: { ...logoBounds },
        })
        return
      }

      // Check if clicking on logo for drag
      if (isPointInBounds(x, y, logoBounds)) {
        console.log("Logo clicked for drag - starting drag at:", { x, y }, "logoPosition:", logoPosition)
        setIsDragging(true)
        setDragTarget("logo")
        setActiveLayer("logo")
        const offset = {
          x: x - (logoPosition.x / 100) * canvas.width,
          y: y - (logoPosition.y / 100) * canvas.height,
        }
        console.log("Drag offset:", offset)
        setDragOffset(offset)
        return
      }
    }

    // Check text (when textOption is enabled)
    if (textOption && textValue) {
      const textX = (textPosition.x / 100) * canvas.width
      const textY = (textPosition.y / 100) * canvas.height
      const ctx = canvas.getContext("2d")
      let fontStyle = ""
      if (textItalic) fontStyle += "italic "
      if (textBold) fontStyle += "bold "
      ctx.font = `${fontStyle}${textFontSize}px ${textFontFamily}`
      const textMetrics = ctx.measureText(textValue)
      const textWidth = textMetrics.width
      let textHeight = textFontSize

      // Calculate actual text bounds based on alignment
      let textLeft = textX
      if (textAlign === "center") {
        textLeft = textX - textWidth / 2
      } else if (textAlign === "right") {
        textLeft = textX - textWidth
      }

      // Adjust bounds for curved text
      let curveExtraWidth = 0
      let curveExtraHeight = 0
      if (textCurve !== 0) {
        const curveIntensity = Math.abs(textCurve) * 0.5
        // Curved text spreads wider and taller
        curveExtraWidth = curveIntensity * 15
        curveExtraHeight = curveIntensity * 25
        textHeight += curveExtraHeight
      }

      // Increased padding (20px) for easier text selection and dragging
      const textPadding = 20 + curveExtraWidth
      const verticalPadding = 20 + curveExtraHeight
      // Check if clicking on text
      if (x >= textLeft - textPadding && x <= textLeft + textWidth + textPadding && y >= textY - verticalPadding && y <= textY + textHeight + verticalPadding) {
        setIsDragging(true)
        setDragTarget("text")
        setActiveLayer("text")
        setDragOffset({
          x: x - textLeft,
          y: y - textY,
        })
        return
      }
    }

    // If clicking on empty space, deselect
    setActiveLayer(null)
  }

  const handleMouseMove = (e) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    if (isResizing && resizeStartData) {
      // Calculate distance moved
      const dx = x - resizeStartData.mouseX
      const dy = y - resizeStartData.mouseY

      // Get the image being resized to maintain aspect ratio
      const image = resizeTarget === "userImage" ? userImage : logoImage
      if (!image) return

      // Calculate scale change based on handle position while maintaining aspect ratio
      // Use the diagonal distance to maintain aspect ratio for all corner handles
      let scaleDelta = 0

      if (resizeHandle === "se" || resizeHandle === "nw") {
        // Diagonal handles - use average of dx and dy to maintain aspect ratio
        scaleDelta = (dx + dy) / 2 / canvas.width
      } else if (resizeHandle === "ne" || resizeHandle === "sw") {
        // Other diagonal handles - use average but with opposite signs
        scaleDelta = (dx - dy) / 2 / canvas.width
      } else {
        // For any corner handle, use the diagonal distance to maintain aspect ratio
        const distance = Math.sqrt(dx * dx + dy * dy)
        // Determine direction based on handle
        const isPositive = resizeHandle === "se" || resizeHandle === "ne"
        scaleDelta = (isPositive ? distance : -distance) / canvas.width
      }

      const newScale = Math.max(0.05, Math.min(0.9, resizeStartData.scale + scaleDelta))

      if (resizeTarget === "logo") {
        setLogoScale(newScale)
      } else if (resizeTarget === "userImage") {
        setUserImageScale(newScale)
      }
      return
    }

    if (isDragging && dragTarget) {
      const newX = x - dragOffset.x
      const newY = y - dragOffset.y

      // Calculate raw percentage position
      let percentX = (newX / canvas.width) * 100
      let percentY = (newY / canvas.height) * 100

      // Apply boundary constraints based on element type
      if (dragTarget === "logo" && logoImage) {
        // Logo uses center positioning - get actual rendered bounds
        const bounds = getImageBounds(logoPosition, logoScale, logoImage, canvas)
        console.log("Logo drag - bounds:", bounds, "logoScale:", logoScale, "raw position:", { percentX, percentY })
        if (bounds) {
          // Calculate half-sizes as percentage of canvas
          const halfW = (bounds.width / 2 / canvas.width) * 100
          const halfH = (bounds.height / 2 / canvas.height) * 100

          // Constrain center position so edges stay within canvas
          // Use Math.max(halfW, ...) to ensure minX <= position <= maxX even if logo is larger than canvas
          const minX = Math.min(halfW, 50)
          const maxX = Math.max(100 - halfW, 50)
          const minY = Math.min(halfH, 50)
          const maxY = Math.max(100 - halfH, 50)

          console.log("Logo constraints - halfW:", halfW, "halfH:", halfH, "minX:", minX, "maxX:", maxX, "minY:", minY, "maxY:", maxY)

          percentX = Math.max(minX, Math.min(maxX, percentX))
          percentY = Math.max(minY, Math.min(maxY, percentY))

          console.log("Logo final position:", { percentX, percentY })
        }
      } else if (dragTarget === "userImage" && userImage) {
        // User image also uses center positioning (same as logo)
        const bounds = getImageBounds(userImagePosition, userImageScale, userImage, canvas)
        if (bounds) {
          // Calculate half-sizes as percentage of canvas
          const halfW = (bounds.width / 2 / canvas.width) * 100
          const halfH = (bounds.height / 2 / canvas.height) * 100

          // Constrain center position so edges stay within canvas
          const minX = Math.min(halfW, 50)
          const maxX = Math.max(100 - halfW, 50)
          const minY = Math.min(halfH, 50)
          const maxY = Math.max(100 - halfH, 50)

          percentX = Math.max(minX, Math.min(maxX, percentX))
          percentY = Math.max(minY, Math.min(maxY, percentY))
        }
      } else if (dragTarget === "text") {
        // For text, apply simple boundary with small margin
        const margin = 5 // 5% margin from edges
        percentX = Math.max(margin, Math.min(100 - margin, percentX))
        percentY = Math.max(margin, Math.min(100 - margin, percentY))
      }

      if (dragTarget === "logo") {
        setLogoPosition({ x: percentX, y: percentY })
      } else if (dragTarget === "userImage") {
        setUserImagePosition({ x: percentX, y: percentY })
      } else if (dragTarget === "text") {
        setTextPosition({ x: percentX, y: percentY })
      }
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
    setIsResizing(false)
    setDragTarget(null)
    setResizeTarget(null)
    setResizeHandle(null)
    setResizeStartData(null)
  }

  // Touch events
  const handleTouchStart = (e) => {
    e.preventDefault()
    const touch = e.touches[0]
    handleMouseDown({ clientX: touch.clientX, clientY: touch.clientY })
  }

  const handleTouchMove = (e) => {
    e.preventDefault()
    const touch = e.touches[0]
    handleMouseMove({ clientX: touch.clientX, clientY: touch.clientY })
  }

  const handleTouchEnd = () => {
    handleMouseUp()
  }

  // Helper function to download a data URL
  const downloadDataUrl = (dataUrl, filename) => {
    const link = document.createElement("a")
    link.download = filename
    link.href = dataUrl
    document.body.appendChild(link)
    link.click()
    if (link.parentNode === document.body) {
      document.body.removeChild(link)
    }
  }

  // Handle download image - downloads combined and individual layers
  const handleDownloadImage = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Temporarily remove selection borders for download
    const tempActiveLayer = activeLayer
    setActiveLayer(null)

    setTimeout(() => {
      const timestamp = Date.now()
      const width = canvas.width
      const height = canvas.height

      // 1. Download combined image (all layers)
      const ctx = canvas.getContext("2d")
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = "high"
      const combinedDataUrl = canvas.toDataURL("image/png", 1.0)
      downloadDataUrl(combinedDataUrl, `combined-design-${timestamp}.png`)

      // 2. Download background layer separately
      if (backgroundImage) {
        const bgCanvas = document.createElement("canvas")
        bgCanvas.width = width
        bgCanvas.height = height
        const bgCtx = bgCanvas.getContext("2d")
        bgCtx.imageSmoothingEnabled = true
        bgCtx.imageSmoothingQuality = "high"
        bgCtx.drawImage(backgroundImage, 0, 0, width, height)
        const bgDataUrl = bgCanvas.toDataURL("image/png", 1.0)
        downloadDataUrl(bgDataUrl, `background-${timestamp}.png`)
      }

      // 3. Download user uploaded image layer separately (if exists)
      if (userImage) {
        const userCanvas = document.createElement("canvas")
        userCanvas.width = width
        userCanvas.height = height
        const userCtx = userCanvas.getContext("2d")
        userCtx.imageSmoothingEnabled = true
        userCtx.imageSmoothingQuality = "high"
        // Make background transparent
        userCtx.clearRect(0, 0, width, height)

        // Draw user image at its current position and scale
        const bounds = getImageBounds(userImagePosition, userImageScale, userImage, canvas)
        if (bounds) {
          userCtx.drawImage(userImage, Math.round(bounds.x), Math.round(bounds.y), Math.round(bounds.width), Math.round(bounds.height))
        }
        const userDataUrl = userCanvas.toDataURL("image/png", 1.0)
        downloadDataUrl(userDataUrl, `uploaded-image-${timestamp}.png`)
      }

      // 4. Download text layer separately (if exists)
      if (textOption && textValue) {
        const textCanvas = document.createElement("canvas")
        textCanvas.width = width
        textCanvas.height = height
        const textCtx = textCanvas.getContext("2d")
        // Make background transparent
        textCtx.clearRect(0, 0, width, height)

        const x = (textPosition.x / 100) * width
        const y = (textPosition.y / 100) * height

        // Build font string
        let fontStyle = ""
        if (textItalic) fontStyle += "italic "
        if (textBold) fontStyle += "bold "
        const fontString = `${fontStyle}${textFontSize}px ${textFontFamily}`

        textCtx.font = fontString
        textCtx.fillStyle = textColor
        textCtx.textAlign = textAlign
        textCtx.textBaseline = "top"

        // Calculate text width for alignment
        const textMetrics = textCtx.measureText(textValue)
        const textWidth = textMetrics.width
        let drawX = x

        if (textAlign === "center") {
          drawX = x - textWidth / 2
        } else if (textAlign === "right") {
          drawX = x - textWidth
        }

        // Draw text (curved or straight)
        if (textCurve !== 0 && textValue.length > 0) {
          const curveIntensity = Math.abs(textCurve) * 0.5
          const curveDirection = textCurve > 0 ? 1 : -1

          textCtx.save()

          const centerX = drawX + textWidth / 2
          const centerY = y + textFontSize / 2
          const radius = Math.max(textWidth / 2, textFontSize) + curveIntensity * 20

          let currentX = 0
          for (let i = 0; i < textValue.length; i++) {
            const char = textValue[i]
            const charWidth = textCtx.measureText(char).width

            const normalizedX = (currentX + charWidth / 2 - textWidth / 2) / (textWidth / 2)
            const angle = normalizedX * (Math.PI / 3) * curveDirection

            const charX = centerX + Math.sin(angle) * radius * curveDirection
            const charY = centerY - Math.cos(angle) * radius + Math.abs(angle) * curveIntensity * 5

            textCtx.save()
            textCtx.translate(charX, charY)
            textCtx.rotate(angle)
            textCtx.fillText(char, 0, 0)
            textCtx.restore()

            currentX += charWidth
          }

          textCtx.restore()
        } else {
          textCtx.fillText(textValue, Math.round(drawX), Math.round(y))

          if (textUnderline) {
            textCtx.strokeStyle = textColor
            textCtx.lineWidth = 2
            textCtx.beginPath()
            textCtx.moveTo(Math.round(drawX), Math.round(y + textFontSize + 2))
            textCtx.lineTo(Math.round(drawX + textWidth), Math.round(y + textFontSize + 2))
            textCtx.stroke()
          }
        }

        const textDataUrl = textCanvas.toDataURL("image/png", 1.0)
        downloadDataUrl(textDataUrl, `text-layer-${timestamp}.png`)
      }

      // Restore active layer
      setActiveLayer(tempActiveLayer)
    }, 50)
  }

  // Handle save
  const handleSave = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Temporarily remove selection borders for saving
    const tempActiveLayer = activeLayer
    setActiveLayer(null)

    setTimeout(() => {
      // Ensure high quality rendering for export
      const ctx = canvas.getContext("2d")
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = "high"

      // Export at high quality (PNG always uses best quality)
      const dataUrl = canvas.toDataURL("image/png")
      if (onSave) {
        onSave({
          image: dataUrl,
          template: template,
          settings: {
            backgroundIndex: selectedBackgroundIndex,
            showLogo,
            logoIndex: selectedLogoIndex,
            logoPosition,
            logoScale,
            hasUserImage: !!userImage,
            userImagePosition,
            userImageScale,
            hasText: textOption && !!textValue,
            textValue,
            textPosition,
            textFontSize,
            textColor,
            textFontFamily,
            textBold,
            textItalic,
            textUnderline,
            textAlign,
            textCurve,
          },
        })
      }
      setActiveLayer(tempActiveLayer)
    }, 50)
  }

  // Debug: Log template data when it changes
  useEffect(() => {
    if (template) {
      console.log("TemplateEditor - Template received:", {
        name: template.name,
        id: template._id || template.id,
        backgroundImagesCount: template.backgroundImages?.length || 0,
        backgroundImages: template.backgroundImages,
        logoImagesCount: template.logoImages?.length || 0,
      })
    }
  }, [template])

  if (!template) {
    return (
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
        <p className="text-yellow-800 text-sm">No template selected. Please select a template first.</p>
      </div>
    )
  }

  // PixelCraft templates: use PixelCraftEditor for full canvas editing
  if (template.pixelcraftDocument?.fabricJson) {
    return (
      <PixelCraftEditor
        template={template}
        onSave={onSave}
        constrained={constrained}
        simplified={simplified}
      />
    )
  }

  return (
    <div className={constrained ? "h-full flex flex-col" : "space-y-4"}>
      {!constrained && (
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800">Template Editor: {template.name}</h3>
          <button onClick={handleSave} className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors">
            Save Design
          </button>
        </div>
      )}

      {/* Canvas Container */}
      <div ref={containerRef} className={`relative bg-gray-100 ${constrained ? "flex-1 min-h-0" : "rounded-lg"} overflow-hidden ${constrained ? "" : "border-2 border-gray-300"}`}>
        {/* Loading overlay - only show when actively loading */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
            <div className="flex flex-col items-center space-y-2">
              <svg className="animate-spin h-8 w-8 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="text-sm text-gray-500">Loading template...</span>
            </div>
          </div>
        )}
        {/* Canvas wrapper - always rendered, opacity controlled for smooth transition */}
        <div className={`${constrained ? "absolute inset-0 flex items-center justify-center" : ""} transition-opacity duration-200`} style={{ opacity: isCanvasReady ? 1 : 0 }}>
          <canvas
            ref={canvasRef}
            width={canvasSize.width}
            height={canvasSize.height}
            className={constrained ? "max-w-full max-h-full object-contain" : "max-w-full h-auto"}
            style={{ cursor: cursorStyle }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onDoubleClick={() => {
              // Open text controls on double-click if textOption is enabled
              if (textOption) {
                setShowTextControls(true)
              }
            }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          />
        </div>

        {/* Delete button overlay for Logo - appears on canvas */}
        {showLogo &&
          logoImage &&
          canvasRef.current &&
          (() => {
            const canvas = canvasRef.current
            const canvasRect = canvas.getBoundingClientRect()
            const containerRect = containerRef.current?.getBoundingClientRect()
            if (!containerRect) return null

            const bounds = getImageBounds(logoPosition, logoScale, logoImage, canvas)
            if (!bounds) return null

            // Calculate position relative to container
            const scaleX = canvasRect.width / canvasSize.width
            const scaleY = canvasRect.height / canvasSize.height
            const canvasOffsetX = canvasRect.left - containerRect.left
            const canvasOffsetY = canvasRect.top - containerRect.top

            const btnX = canvasOffsetX + (bounds.x + bounds.width) * scaleX - 8
            const btnY = canvasOffsetY + bounds.y * scaleY - 8

            return (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setShowLogo(false)
                }}
                className="absolute w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors shadow-lg border-2 border-white z-20"
                style={{
                  left: `${btnX}px`,
                  top: `${btnY}px`,
                  pointerEvents: isDragging || isResizing ? "none" : "auto", // Don't intercept events during drag/resize
                }}
                title="Delete logo"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )
          })()}

        {/* Delete button overlay for User Image - appears on canvas */}
        {userImage &&
          canvasRef.current &&
          (() => {
            const canvas = canvasRef.current
            const canvasRect = canvas.getBoundingClientRect()
            const containerRect = containerRef.current?.getBoundingClientRect()
            if (!containerRect) return null

            const bounds = getImageBounds(userImagePosition, userImageScale, userImage, canvas)
            if (!bounds) return null

            // Calculate position relative to container
            const scaleX = canvasRect.width / canvasSize.width
            const scaleY = canvasRect.height / canvasSize.height
            const canvasOffsetX = canvasRect.left - containerRect.left
            const canvasOffsetY = canvasRect.top - containerRect.top

            const btnX = canvasOffsetX + (bounds.x + bounds.width) * scaleX - 8
            const btnY = canvasOffsetY + bounds.y * scaleY - 8

            return (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleRemoveUserImage()
                }}
                className="absolute w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors shadow-lg border-2 border-white z-20"
                style={{
                  left: `${btnX}px`,
                  top: `${btnY}px`,
                  pointerEvents: isDragging || isResizing ? "none" : "auto", // Don't intercept events during drag/resize
                }}
                title="Delete image"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )
          })()}
        {/* Upload Custom Image Button and Text Input - Top Left in Simplified Mode */}
        {simplified && (
          <div className="absolute top-4 left-4 z-30 flex gap-2 items-start">
            {/* Upload Custom Image Button - replaces logo */}
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleUserImageUpload} className="hidden" id="user-image-upload-simplified" />
            <label htmlFor="user-image-upload-simplified" className="inline-flex items-center px-4 py-2 bg-white text-gray-700 rounded-md hover:bg-gray-50 transition-colors shadow-lg border-2 border-gray-300 cursor-pointer whitespace-nowrap">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-sm font-medium">{userImage ? "Change Image" : "Upload Your Logo"}</span>
            </label>

            {/* Text Controls Toggle Button - Only show when textOption is true and controls are hidden */}
            {textOption && !showTextControls && (
              <button type="button" onClick={() => setShowTextControls(true)} className="inline-flex items-center px-3 py-2 bg-white text-gray-700 rounded-md hover:bg-gray-50 transition-colors shadow-lg border-2 border-gray-300 cursor-pointer" title="Open text settings (or double-click on canvas)">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                <span className="text-sm">Text</span>
              </button>
            )}

            {/* Text Input and Controls - Only show when textOption is true AND showTextControls is true */}
            {textOption && showTextControls && (
              <div ref={textControlsRef} className="bg-white rounded-md shadow-lg border-2 border-blue-400 p-3 flex flex-col gap-2 animate-fadeIn" style={{ minWidth: "300px" }}>
                {/* Header with Close Button */}
                <div className="flex items-center justify-between pb-2 border-b border-gray-200">
                  <span className="text-xs font-semibold text-gray-700">📝 Text Settings</span>
                  <button type="button" onClick={() => setShowTextControls(false)} className="text-gray-400 hover:text-gray-600 p-1" title="Close (click outside also closes)">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Text Input with Download Button */}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={textValue}
                    onChange={(e) => {
                      setTextValue(e.target.value)
                      setActiveLayer("text")
                    }}
                    onFocus={() => setActiveLayer("text")}
                    placeholder="Enter text..."
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                  {/* Download Image Button */}
                  <button type="button" onClick={handleDownloadImage} className="inline-flex items-center justify-center px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors shadow-lg border-2 border-green-700" title="Download combined image (background + uploaded image + text)">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </button>
                </div>

                {/* Text Formatting Controls Row 1 */}
                <div className="flex items-center gap-1 flex-wrap">
                  {/* Font Family - Uses fonts from template textConfig */}
                  <select value={textFontFamily} onChange={(e) => setTextFontFamily(e.target.value)} className="px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500" title="Font family">
                    {availableFonts.map((font) => (
                      <option key={font} value={font} style={{ fontFamily: font }}>
                        {font}
                      </option>
                    ))}
                  </select>

                  {/* Font Size */}
                  <input type="number" value={textFontSize} onChange={(e) => setTextFontSize(Math.max(12, Math.min(72, parseInt(e.target.value) || 24)))} className="w-14 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500" min="12" max="72" title="Font size" />

                  {/* Color */}
                  <input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)} className="w-8 h-8 border border-gray-300 rounded cursor-pointer" title="Text color" />

                  {/* Bold */}
                  <button type="button" onClick={() => setTextBold(!textBold)} className={`px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-100 ${textBold ? "bg-blue-100 border-blue-500" : ""}`} title="Bold">
                    <strong>B</strong>
                  </button>

                  {/* Italic */}
                  <button type="button" onClick={() => setTextItalic(!textItalic)} className={`px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-100 ${textItalic ? "bg-blue-100 border-blue-500" : ""}`} title="Italic">
                    <em>I</em>
                  </button>

                  {/* Underline */}
                  <button type="button" onClick={() => setTextUnderline(!textUnderline)} className={`px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-100 ${textUnderline ? "bg-blue-100 border-blue-500" : ""}`} title="Underline">
                    <u>U</u>
                  </button>
                </div>

                {/* Text Formatting Controls Row 2 */}
                <div className="flex items-center gap-1 flex-wrap">
                  {/* Alignment */}
                  <div className="flex items-center gap-1 border border-gray-300 rounded p-1">
                    <button type="button" onClick={() => setTextAlign("left")} className={`px-2 py-1 text-xs hover:bg-gray-100 rounded ${textAlign === "left" ? "bg-blue-100" : ""}`} title="Align left">
                      ⬅
                    </button>
                    <button type="button" onClick={() => setTextAlign("center")} className={`px-2 py-1 text-xs hover:bg-gray-100 rounded ${textAlign === "center" ? "bg-blue-100" : ""}`} title="Align center">
                      ⬌
                    </button>
                    <button type="button" onClick={() => setTextAlign("right")} className={`px-2 py-1 text-xs hover:bg-gray-100 rounded ${textAlign === "right" ? "bg-blue-100" : ""}`} title="Align right">
                      ➡
                    </button>
                  </div>

                  {/* Curve Control */}
                  <div className="flex items-center gap-1">
                    <label className="text-xs text-gray-600 whitespace-nowrap">Curve:</label>
                    <input type="range" min="-50" max="50" value={textCurve} onChange={(e) => setTextCurve(parseInt(e.target.value))} className="w-20" title="Text curve" />
                    <span className="text-xs text-gray-600 w-8">{textCurve}</span>
                  </div>
                </div>

                {/* Hint */}
                <p className="text-xs text-gray-400 text-center mt-1">Click outside or press × to close</p>
              </div>
            )}
          </div>
        )}

        {/* Control Toggle & Save Buttons - Floating in constrained mode */}
        {constrained && !simplified && (
          <>
            <button onClick={() => setShowControls(!showControls)} className="absolute top-4 right-4 z-30 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors shadow-lg flex items-center space-x-2" title="Toggle controls">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
              <span className="text-xs">Controls</span>
            </button>
            <button onClick={handleSave} className="absolute bottom-4 right-4 z-30 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors shadow-lg flex items-center space-x-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Save</span>
            </button>
          </>
        )}

        {/* Save Button - For simplified mode */}
        {simplified && (
          <button onClick={handleSave} className="absolute bottom-4 right-4 z-30 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors shadow-lg flex items-center space-x-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>Save Design</span>
          </button>
        )}

        {/* Double-click hint - shown when text option is available but controls are hidden */}
        {simplified && textOption && !showTextControls && <div className="absolute bottom-4 left-4 z-20 bg-black/60 text-white text-xs px-3 py-1.5 rounded-full backdrop-blur-sm">💡 Double-click to edit text</div>}
      </div>

      {/* Controls Panel - Hidden in simplified mode, collapsible in constrained mode, always shown in full mode */}
      {!simplified && (!constrained || showControls) && (
        <div className={`grid md:grid-cols-3 gap-4 p-4 bg-gray-50 ${constrained ? "absolute top-16 left-0 right-0 z-40 border border-gray-300 rounded-lg shadow-xl max-h-96 overflow-y-auto" : "rounded-lg border border-gray-200"}`}>
          {/* Background Selection - Hidden in simplified mode */}
          {!simplified && (
            <div>
              <h4 className="font-semibold text-gray-700 mb-3 flex items-center">
                <span className="w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-sm mr-2">1</span>
                Background
              </h4>
              {backgroundImages.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs text-gray-500 mb-2">Select background (fixed)</p>
                  <div className="grid grid-cols-3 gap-2">
                    {backgroundImages.map((img, index) => (
                      <button key={index} onClick={() => setSelectedBackgroundIndex(index)} className={`relative aspect-square rounded-md overflow-hidden border-2 transition-all ${selectedBackgroundIndex === index ? "border-blue-500 ring-2 ring-blue-300" : "border-gray-200 hover:border-gray-400"}`}>
                        <img src={img.startsWith("http") ? img : `http://localhost:8080${img}`} alt={`Background ${index + 1}`} className="w-full h-full object-cover" />
                        {selectedBackgroundIndex === index && (
                          <div className="absolute inset-0 bg-blue-500 bg-opacity-20 flex items-center justify-center">
                            <span className="text-white text-lg">✓</span>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500">No backgrounds available</p>
              )}
            </div>
          )}

          {/* Custom Logo / Image Upload - replaces template logo */}
          <div>
            <h4 className="font-semibold text-gray-700 mb-3 flex items-center">
              <span className="w-6 h-6 bg-green-100 text-green-700 rounded-full flex items-center justify-center text-sm mr-2">2</span>
              Upload Custom Logo
            </h4>
            <div className="space-y-3">
              <p className="text-xs text-gray-500">{userImage ? "Your custom logo (replaces template logo)" : "Upload your own logo to replace template logo"}</p>

              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleUserImageUpload} className="hidden" id="user-image-upload" />

              {!userImage ? (
                <label htmlFor="user-image-upload" className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-green-400 hover:bg-green-50 transition-colors">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-xs text-gray-500 mt-1">Click to upload your logo</span>
                </label>
              ) : (
                <div className="space-y-2">
                  <div className="relative w-20 h-20 mx-auto">
                    <img src={userImage.src} alt="Your custom logo" className="w-full h-full object-contain rounded border border-green-300" />
                    <button onClick={handleRemoveUserImage} className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors" title="Remove and restore template logo">
                      ×
                    </button>
                  </div>

                  <div>
                    <label className="text-xs text-gray-600 mb-1 block">Size: {Math.round(userImageScale * 100)}%</label>
                    <input type="range" min="5" max="90" value={userImageScale * 100} onChange={(e) => setUserImageScale(parseInt(e.target.value) / 100)} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-green-600" />
                  </div>

                  <p className="text-xs text-gray-400 text-center">Drag to move • Drag corners to resize</p>
                  <p className="text-xs text-blue-500 text-center">Remove to restore template logo</p>
                </div>
              )}
            </div>
          </div>

          {/* Logo Controls - Hidden in simplified mode and when user has uploaded custom image */}
          {!simplified && !userImage && (
            <div>
              <h4 className="font-semibold text-gray-700 mb-3 flex items-center">
                <span className="w-6 h-6 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center text-sm mr-2">3</span>
                Template Logo
              </h4>

              {logoImages.length > 0 ? (
                <div className="space-y-3">
                  {!showLogo ? (
                    /* Add Logo Button - when logo is not showing */
                    <button onClick={() => setShowLogo(true)} className="flex flex-col items-center justify-center w-full h-20 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-purple-400 hover:bg-purple-50 transition-colors">
                      <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      <span className="text-xs text-gray-500 mt-1">Add Template Logo</span>
                    </button>
                  ) : (
                    /* Logo is showing - show selection and delete option */
                    <div className="space-y-2">
                      {/* Selected Logo Preview with Delete Button */}
                      <div className="relative w-16 h-16 mx-auto">
                        <img src={logoImages[selectedLogoIndex]?.startsWith("http") ? logoImages[selectedLogoIndex] : `http://localhost:8080${logoImages[selectedLogoIndex]}`} alt="Selected Logo" className="w-full h-full object-contain rounded border border-purple-300 bg-white p-1" />
                        <button onClick={() => setShowLogo(false)} className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors" title="Delete logo">
                          ×
                        </button>
                      </div>

                      {/* Logo Selection Grid */}
                      {logoImages.length > 1 && (
                        <div>
                          <p className="text-xs text-gray-500 mb-1 text-center">Change logo:</p>
                          <div className="grid grid-cols-4 gap-1">
                            {logoImages.map((img, index) => (
                              <button
                                key={index}
                                onClick={() => {
                                  setSelectedLogoIndex(index)
                                  setActiveLayer("logo")
                                }}
                                className={`relative aspect-square rounded overflow-hidden border-2 transition-all bg-white ${selectedLogoIndex === index ? "border-purple-500 ring-1 ring-purple-300" : "border-gray-200 hover:border-gray-400"}`}
                              >
                                <img src={img.startsWith("http") ? img : `http://localhost:8080${img}`} alt={`Logo ${index + 1}`} className="w-full h-full object-contain p-0.5" />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Logo Size Slider */}
                      <div>
                        <label className="text-xs text-gray-600 mb-1 block">Size: {Math.round(logoScale * 100)}%</label>
                        <input type="range" min="5" max="60" value={logoScale * 100} onChange={(e) => setLogoScale(parseInt(e.target.value) / 100)} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600" />
                      </div>

                      <p className="text-xs text-gray-400 text-center">Drag to move • Drag corners to resize</p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No logos available</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Instructions - Hidden in constrained and simplified mode */}
      {!constrained && !simplified && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
          <h5 className="font-medium text-blue-800 mb-1">How to use</h5>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>
              • <strong>Background:</strong> Fixed layer - select from options
            </li>
            <li>
              • <strong>Your Image / Logo:</strong> Click to select, drag to move
            </li>
            <li>
              • <strong>Resize:</strong> Drag the corner handles to resize
            </li>
            <li>
              • <strong>Delete:</strong> Press <kbd className="px-1.5 py-0.5 bg-gray-200 text-gray-700 rounded text-xs font-mono">Delete</kbd> or <kbd className="px-1.5 py-0.5 bg-gray-200 text-gray-700 rounded text-xs font-mono">Backspace</kbd> key, or click the delete button
            </li>
            <li>• Use sliders for precise size control</li>
            <li>• Click &quot;Save Design&quot; when finished</li>
          </ul>
        </div>
      )}
    </div>
  )
}
