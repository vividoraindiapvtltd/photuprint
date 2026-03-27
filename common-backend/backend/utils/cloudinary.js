import { v2 as cloudinary } from 'cloudinary';
import { removeLocalFile } from './fileCleanup.js';
import { getWebsiteCredentials } from './websiteCredentials.js';

// Default config from env (backwards-compatible)
if (process.env.CLOUDINARY_URL) {
  cloudinary.config({ url: process.env.CLOUDINARY_URL });
} else {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

export const isCloudinaryConfigured = () => {
  const url = (process.env.CLOUDINARY_URL || '').trim();
  if (url.startsWith('cloudinary://')) {
    return true;
  }
  return !!(
    (process.env.CLOUDINARY_CLOUD_NAME || '').trim() &&
    (process.env.CLOUDINARY_API_KEY || '').trim() &&
    (process.env.CLOUDINARY_API_SECRET || '').trim()
  );
};

function hasResolvedCloudinaryUrl(creds) {
  const u = creds?.cloudinaryUrl?.trim();
  return !!(u && u.startsWith('cloudinary://'));
}

function hasResolvedCloudinaryTriple(creds) {
  return !!(
    creds &&
    creds.cloudinaryCloudName &&
    creds.cloudinaryApiKey &&
    creds.cloudinaryApiSecret
  );
}

/**
 * Parse SDK connection string: cloudinary://API_KEY:API_SECRET@CLOUD_NAME
 * @param {string} urlStr
 * @returns {{ cloud_name: string, api_key: string, api_secret: string } | null}
 */
export function parseCloudinaryConnectionUrl(urlStr) {
  try {
    const uri = new URL(urlStr);
    if (uri.protocol !== 'cloudinary:') return null;
    const cloud_name = uri.hostname;
    const api_key = uri.username ? decodeURIComponent(uri.username) : '';
    const api_secret = uri.password ? decodeURIComponent(uri.password) : '';
    if (!cloud_name || !api_key || !api_secret) return null;
    return { cloud_name, api_key, api_secret };
  } catch {
    return null;
  }
}

/**
 * Auth fields to pass on each upload/destroy so tenant credentials work without mutating global config.
 * Empty object = rely on cloudinary.config() defaults.
 * @param {Awaited<ReturnType<typeof getWebsiteCredentials>>} creds
 */
function authOptionsFromMergedCredentials(creds) {
  const url = creds?.cloudinaryUrl?.trim();
  if (url && url.startsWith('cloudinary://')) {
    const parsed = parseCloudinaryConnectionUrl(url);
    if (parsed) return parsed;
  }
  if (hasResolvedCloudinaryTriple(creds)) {
    return {
      cloud_name: creds.cloudinaryCloudName,
      api_key: creds.cloudinaryApiKey,
      api_secret: creds.cloudinaryApiSecret,
    };
  }
  return {};
}

/**
 * Per-request Cloudinary auth (name/key/secret) for this website.
 * @param {string|null|undefined} websiteId
 */
export async function getCloudinaryAuthOptionsForWebsite(websiteId) {
  const creds = await getWebsiteCredentials(websiteId);
  return authOptionsFromMergedCredentials(creds);
}

/**
 * True if Cloudinary can be used for this request: global env is set, or
 * merged website+env credentials include CLOUDINARY_URL or a full name/key/secret triple.
 */
export async function isCloudinaryConfiguredForWebsite(websiteId) {
  if (isCloudinaryConfigured()) return true;
  const creds = await getWebsiteCredentials(websiteId);
  if (hasResolvedCloudinaryUrl(creds)) return true;
  return hasResolvedCloudinaryTriple(creds);
}

/**
 * v2 `cloudinary` is a plain object (`constructor === Object`); there is no per-tenant instance API.
 * Return a small wrapper that forwards upload/destroy with merged tenant auth options.
 *
 * @param {string|null|undefined} websiteId
 */
export async function getCloudinaryForWebsite(websiteId) {
  const auth = await getCloudinaryAuthOptionsForWebsite(websiteId);
  return {
    uploader: {
      upload: (filePath, opts = {}) => cloudinary.uploader.upload(filePath, { ...auth, ...opts }),
      destroy: (publicId, opts = {}) => cloudinary.uploader.destroy(publicId, { ...auth, ...opts }),
    },
  };
}

/**
 * Upload a multer file to Cloudinary for the tenant, or keep local /uploads path if not configured or on failure.
 * @param {string|null|undefined} websiteId
 * @param {{ path: string, filename?: string }|null|undefined} file
 * @param {Record<string, unknown>} [options] folder, resource_type, etc.
 * @returns {Promise<string|null>} secure_url or /uploads/filename or null if no file
 */
export async function tenantCloudinaryUpload(websiteId, file, options = {}) {
  if (!file?.path) return null;
  const filename = file.filename || 'file';
  if (!(await isCloudinaryConfiguredForWebsite(websiteId))) {
    return `/uploads/${filename}`;
  }
  try {
    const auth = await getCloudinaryAuthOptionsForWebsite(websiteId);
    const result = await cloudinary.uploader.upload(file.path, { ...auth, ...options });
    removeLocalFile(file.path);
    return result.secure_url;
  } catch (err) {
    const http = err?.http_code ?? err?.error?.http_code;
    const msg = err?.message || err?.error?.message;
    console.error('tenantCloudinaryUpload failed:', msg || err, http != null ? { http_code: http } : '');
    return `/uploads/${filename}`;
  }
}

/** Best-effort delete using the same tenant Cloudinary config as uploads (simple public_id from URL). */
export async function tenantCloudinaryDestroyByUrl(websiteId, imageUrl) {
  if (!imageUrl || typeof imageUrl !== 'string' || !imageUrl.includes('cloudinary')) return;
  const publicId = imageUrl.split('/').slice(-2).join('/').split('.')[0];
  if (!publicId) return;
  try {
    const auth = await getCloudinaryAuthOptionsForWebsite(websiteId);
    await cloudinary.uploader.destroy(publicId, auth).catch(() => {});
  } catch (e) {
    console.error('tenantCloudinaryDestroyByUrl:', e);
  }
}

export default cloudinary;
