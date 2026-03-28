/**
 * Centralized Cloudinary uploads — no local /uploads/ persistence for user media.
 * Requires CLOUDINARY_URL or CLOUDINARY_CLOUD_NAME + CLOUDINARY_API_KEY + CLOUDINARY_API_SECRET.
 */

import cloudinary, { isCloudinaryConfigured, getCloudinaryForWebsite } from "./cloudinary.js"
import { removeLocalFile, removeLocalFiles } from "./fileCleanup.js"

export function assertCloudinaryConfigured() {
  if (!isCloudinaryConfigured()) {
    throw new Error(
      "Cloudinary is not configured. Set CLOUDINARY_URL or CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in the environment.",
    )
  }
}

/**
 * Upload a single temp file to Cloudinary, delete local copy on success.
 * @param {string} localPath - multer file.path
 * @param {{ folder?: string, resource_type?: string }} [opts]
 * @returns {Promise<string>} secure_url
 */
export async function uploadLocalFileToCloudinary(localPath, opts = {}) {
  assertCloudinaryConfigured()
  const { folder = "photuprint", resource_type = "image", ...cloudinaryOpts } = opts
  const result = await cloudinary.uploader.upload(localPath, { folder, resource_type, ...cloudinaryOpts })
  removeLocalFile(localPath)
  return result.secure_url
}

/**
 * Upload many multer files in parallel (same folder/resource_type).
 * @param {import("multer").File[]} files
 * @param {{ folder?: string, resource_type?: string }} [opts]
 * @returns {Promise<string[]>} secure_urls in file order
 */
export async function uploadMulterFilesToCloudinary(files, opts = {}) {
  if (!files?.length) return []
  assertCloudinaryConfigured()
  const urls = await Promise.all(files.map((f) => (f?.path ? uploadLocalFileToCloudinary(f.path, opts) : Promise.resolve(null))))
  return urls.filter(Boolean)
}

/**
 * Generic upload using per-website Cloudinary credentials when set (falls back to global env).
 */
export async function uploadMulterFileForWebsite(req, file, { folder = "photuprint", resource_type = "image" } = {}) {
  if (!file?.path) throw new Error("No file to upload")
  assertCloudinaryConfigured()
  const cl = await getCloudinaryForWebsite(req.websiteId)
  const result = await cl.uploader.upload(file.path, { folder, resource_type })
  removeLocalFile(file.path)
  return result.secure_url
}

export { removeLocalFiles }
