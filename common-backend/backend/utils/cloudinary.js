import { v2 as cloudinary } from 'cloudinary';
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
  if (process.env.CLOUDINARY_URL && process.env.CLOUDINARY_URL.startsWith('cloudinary://')) {
    return true;
  }
  return !!(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
};

/**
 * Get a Cloudinary instance configured for a specific website.
 * Returns the default global instance if the website has no custom credentials.
 * Callers use this instead of the default export when they have req.websiteId.
 *
 * @param {string|null} websiteId
 * @returns {Promise<import('cloudinary').v2>}
 */
export async function getCloudinaryForWebsite(websiteId) {
  if (!websiteId) return cloudinary;

  const creds = await getWebsiteCredentials(websiteId);
  if (!creds.cloudinaryCloudName || !creds.cloudinaryApiKey || !creds.cloudinaryApiSecret) {
    return cloudinary;
  }

  // If the resolved credentials match the global config, return the singleton
  const globalCfg = cloudinary.config();
  if (
    creds.cloudinaryCloudName === globalCfg.cloud_name &&
    creds.cloudinaryApiKey === globalCfg.api_key &&
    creds.cloudinaryApiSecret === globalCfg.api_secret
  ) {
    return cloudinary;
  }

  // Build a per-website instance. Cloudinary SDK allows creating separate
  // instances via its Cloudinary class constructor.
  const Cls = cloudinary.constructor;
  const instance = new Cls();
  instance.config({
    cloud_name: creds.cloudinaryCloudName,
    api_key: creds.cloudinaryApiKey,
    api_secret: creds.cloudinaryApiSecret,
  });
  return instance;
}

export default cloudinary;
