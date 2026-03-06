import cloudinary from '../utils/cloudinary.js';
import { removeLocalFile } from '../utils/fileCleanup.js';

export const uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ msg: 'No file uploaded' });
    }

    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: 'photuprint',
    });

    // Clean up local file after successful Cloudinary upload
    removeLocalFile(req.file.path);

    res.json({ 
      url: result.secure_url, 
      public_id: result.public_id,
      filename: req.file.filename 
    });
  } catch (err) {
    console.error('Upload error:', err);
    // Clean up local file even on error (Cloudinary failed, no point keeping it)
    if (req.file) removeLocalFile(req.file.path);
    res.status(500).json({ msg: err.message || 'Failed to upload image' });
  }
};
