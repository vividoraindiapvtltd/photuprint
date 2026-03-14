import multer from "multer"
import path from "path"
import fs from "fs"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const uploadsDir = path.join(__dirname, "../uploads/")
try {
  fs.mkdirSync(uploadsDir, { recursive: true })
} catch (err) {
  console.warn("Could not create uploads directory:", err.message)
}

// Configure storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir)
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9)
    cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname))
  },
})

// File filter - allow images and videos
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase()
  const allowedExts = [".jpg", ".jpeg", ".png", ".gif", ".mp4", ".webm", ".mov", ".avi"]
  if (!allowedExts.includes(ext)) {
    return cb(new Error(`File type not allowed. Allowed types: ${allowedExts.join(", ")}`), false)
  }
  cb(null, true)
}

// Create upload instance with higher limits for products
// Images: max 5MB (enforced by frontend validation)
// Videos: max 100MB (enforced by frontend validation)
// Set backend limit to 100MB to accommodate videos
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit to accommodate videos
  },
})

export default upload
