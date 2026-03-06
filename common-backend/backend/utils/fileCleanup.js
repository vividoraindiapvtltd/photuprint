import fs from "fs"
import path from "path"

/**
 * Remove a locally uploaded file after it has been successfully uploaded to Cloudinary.
 * Silently handles errors (file already deleted, permissions, etc.)
 * 
 * @param {string} filePath - The absolute or relative path to the file to remove
 */
export const removeLocalFile = (filePath) => {
  if (!filePath) return

  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
      console.log("🗑️ Cleaned up local file:", path.basename(filePath))
    }
  } catch (err) {
    // Non-critical: log but don't throw
    console.warn("⚠️ Could not remove local file:", filePath, err.message)
  }
}

/**
 * Remove multiple locally uploaded files.
 * Useful when processing arrays of uploaded files (e.g. gallery images).
 * 
 * @param {Array} files - Array of multer file objects (each with a .path property)
 */
export const removeLocalFiles = (files) => {
  if (!files || !Array.isArray(files)) return

  for (const file of files) {
    if (file && file.path) {
      removeLocalFile(file.path)
    }
  }
}

/**
 * Collect all uploaded file paths from req.file and req.files for cleanup.
 * Returns an array of file paths.
 * 
 * @param {object} req - Express request object
 * @returns {string[]} Array of file paths
 */
export const getUploadedFilePaths = (req) => {
  const paths = []

  // Single file upload (req.file)
  if (req.file && req.file.path) {
    paths.push(req.file.path)
  }

  // Multiple file uploads (req.files)
  if (req.files) {
    for (const fieldName of Object.keys(req.files)) {
      const files = req.files[fieldName]
      if (Array.isArray(files)) {
        for (const file of files) {
          if (file && file.path) {
            paths.push(file.path)
          }
        }
      }
    }
  }

  return paths
}

/**
 * Remove all uploaded files from the request.
 * Useful for cleaning up after all Cloudinary uploads are done.
 * 
 * @param {object} req - Express request object
 */
export const cleanupRequestFiles = (req) => {
  const paths = getUploadedFilePaths(req)
  for (const filePath of paths) {
    removeLocalFile(filePath)
  }
}
