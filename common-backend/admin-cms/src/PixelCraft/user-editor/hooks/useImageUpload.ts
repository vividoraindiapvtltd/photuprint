/**
 * Hook for handling image uploads: upload file, validate constraints, return URL.
 * In real app: upload to S3/CDN and return asset key or URL.
 */

import { useState } from 'react';
import { validateImage, ImageConstraints } from '../lib/validateConstraints';

export function useImageUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadImage = async (file: File, constraints?: ImageConstraints): Promise<string> => {
    setIsUploading(true);
    setError(null);

    try {
      // Validate constraints
      const validation = await validateImage(file, constraints);
      if (!validation.valid) {
        setError(validation.error || 'Invalid image');
        throw new Error(validation.error);
      }

      // In real app: upload to S3/CDN via API
      // For now: return object URL (temporary, for preview)
      const url = URL.createObjectURL(file);
      
      // TODO: Replace with actual upload:
      // const formData = new FormData();
      // formData.append('image', file);
      // const response = await fetch('/api/upload', { method: 'POST', body: formData });
      // const { url } = await response.json();
      
      setIsUploading(false);
      return url;
    } catch (err) {
      setIsUploading(false);
      throw err;
    }
  };

  return { uploadImage, isUploading, error };
}
