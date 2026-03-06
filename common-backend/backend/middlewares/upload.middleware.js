import multer from "multer"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Configure storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, "../uploads/"))
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9)
    cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname))
  },
})

// File filter - allow images, videos, and design files
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase()
  // NOTE: This middleware is used across multiple managers (brands/templates/etc).
  // Keep the allowlist broad but explicit.
  const allowedExts = [
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".webp",
    ".svg",
    ".psd",
    ".ai",
    ".pdf",
    ".mp4",
    ".webm",
    ".mov",
    ".avi",
    // Fonts (PixelCraft)
    ".ttf",
    ".otf",
    ".woff",
    ".woff2",
  ]
  if (!allowedExts.includes(ext)) {
    return cb(new Error(`File type not allowed. Allowed types: ${allowedExts.join(", ")}`), false)
  }
  cb(null, true)
}

// Create upload instance
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB file size limit
    fieldSize: 50 * 1024 * 1024, // 50MB field size limit (for large JSON like fabricJson)
    fields: 50, // Max number of non-file fields
  },
})

export default upload
