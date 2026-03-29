/**
 * Centralized Cloudinary uploads — no local /uploads/ persistence for user media.
 * Requires CLOUDINARY_URL or CLOUDINARY_CLOUD_NAME + CLOUDINARY_API_KEY + CLOUDINARY_API_SECRET.
 */

import fs from "fs"
import cloudinary, { isCloudinaryConfigured, getCloudinaryForWebsite } from "./cloudinary.js"
import { removeLocalFile, removeLocalFiles } from "./fileCleanup.js"

export function assertCloudinaryConfigured() {
  if (!isCloudinaryConfigured()) {
    throw new Error(
      "Cloudinary is not configured. Set CLOUDINARY_URL or CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in the environment.",
    )
  }
}

/** @param {string} [mimetype] */
export function resourceTypeFromMime(mimetype) {
  if (!mimetype || typeof mimetype !== "string") return "image"
  if (mimetype.startsWith("video/")) return "video"
  if (mimetype.startsWith("image/")) return "image"
  return "image"
}

/**
 * Upload file bytes to Cloudinary (no local disk; avoids ENOENT on temp paths).
 * @param {Buffer} buffer
 * @param {{ folder?: string, resource_type?: string }} [opts]
 */
export async function uploadBufferToCloudinary(buffer, opts = {}) {
  assertCloudinaryConfigured()
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error("Invalid or empty file buffer for Cloudinary upload")
  }
  const { folder = "photuprint", resource_type = "image", ...cloudinaryOpts } = opts
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type, ...cloudinaryOpts },
      (err, result) => {
        if (err) return reject(err)
        resolve(result.secure_url)
      },
    )
    stream.end(buffer)
  })
}

/**
 * @param {import("multer").File[]} files - memoryStorage files with .buffer
 */
export async function uploadMulterMemoryFilesToCloudinary(files, opts = {}) {
  if (!files?.length) return []
  assertCloudinaryConfigured()
  const urls = []
  for (const f of files) {
    if (!f?.buffer || f.buffer.length === 0) continue
    const rt = resourceTypeFromMime(f.mimetype)
    urls.push(await uploadBufferToCloudinary(f.buffer, { ...opts, resource_type: rt }))
  }
  return urls
}

/**
 * Upload a single temp file to Cloudinary, delete local copy on success.
 * @param {string} localPath - multer file.path
 * @param {{ folder?: string, resource_type?: string }} [opts]
 * @returns {Promise<string>} secure_url
 */
export async function uploadLocalFileToCloudinary(localPath, opts = {}) {
  assertCloudinaryConfigured()
  if (!localPath || !fs.existsSync(localPath)) {
    throw new Error(
      `Temporary upload file is missing on disk (already processed or invalid path). Path: ${localPath || "(none)"}`,
    )
  }
  const { folder = "photuprint", resource_type = "image", ...cloudinaryOpts } = opts
  const result = await cloudinary.uploader.upload(localPath, { folder, resource_type, ...cloudinaryOpts })
  removeLocalFile(localPath)
  return result.secure_url
}

/**
 * Upload many multer files sequentially (same folder/resource_type).
 * Deduplicates by `path` so parallel double-upload of the same temp file cannot delete it mid-flight (ENOENT).
 * @param {import("multer").File[]} files
 * @param {{ folder?: string, resource_type?: string }} [opts]
 * @returns {Promise<string[]>} secure_urls (deduped paths preserve first-seen order)
 */
export async function uploadMulterFilesToCloudinary(files, opts = {}) {
  if (!files?.length) return []
  assertCloudinaryConfigured()
  const seen = new Set()
  const urls = []
  for (const f of files) {
    if (!f?.path) continue
    if (seen.has(f.path)) continue
    seen.add(f.path)
    if (!fs.existsSync(f.path)) {
      throw new Error(
        `Upload temp file missing at ${f.path}. If this persists, try again or check the server uploads folder.`,
      )
    }
    urls.push(await uploadLocalFileToCloudinary(f.path, opts))
  }
  return urls
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
