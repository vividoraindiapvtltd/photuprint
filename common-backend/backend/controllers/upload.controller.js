import { getCloudinaryForWebsite, isCloudinaryConfiguredForWebsite } from '../utils/cloudinary.js';
import { removeLocalFile } from '../utils/fileCleanup.js';

export const uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ msg: 'No file uploaded' });
    }

    if (!(await isCloudinaryConfiguredForWebsite(req.websiteId))) {
      removeLocalFile(req.file.path);
      return res.status(400).json({
        msg: 'Cloudinary is not configured. Add CLOUDINARY_URL or cloud name + API key + secret in Website Manager, or set CLOUDINARY_* / CLOUDINARY_URL in the server environment.',
      });
    }

    const cl = await getCloudinaryForWebsite(req.websiteId);
    const result = await cl.uploader.upload(req.file.path, {
      folder: 'photuprint',
    });

    removeLocalFile(req.file.path);

    res.json({
      url: result.secure_url,
      public_id: result.public_id,
      filename: req.file.filename,
    });
  } catch (err) {
    console.error('Upload error:', err);
    if (req.file) removeLocalFile(req.file.path);
    res.status(500).json({ msg: err.message || 'Failed to upload image' });
  }
};
