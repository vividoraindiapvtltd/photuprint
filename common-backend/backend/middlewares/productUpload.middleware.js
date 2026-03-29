import multer from "multer"
import path from "path"

// Memory storage → Cloudinary via buffer (avoids ENOENT on missing backend/uploads temp files)

// File filter - allow images and videos
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname || file.filename || "").toLowerCase()
  const allowedExts = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".mp4", ".webm", ".mov", ".avi"]
  if (!allowedExts.includes(ext)) {
    return cb(new Error(`File type not allowed. Allowed types: ${allowedExts.join(", ")}`), false)
  }
  cb(null, true)
}

// Images: max 5MB (frontend); videos: max 100MB (frontend). Backend allows 100MB for video field.
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024,
    // FormData sends one field per color/size/height/length/template; 50 was too low → "Too many fields"
    fields: 500,
  },
})

export default upload
