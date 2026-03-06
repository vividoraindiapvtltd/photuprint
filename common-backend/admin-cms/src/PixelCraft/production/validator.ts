/**
 * Security validators: template validation, asset validation, variable sanitization.
 */

import crypto from 'crypto';
import type { TemplateDocument } from '../editor/types';

const SECRET = process.env.TEMPLATE_SIGNING_SECRET || 'change-me-in-production';

/**
 * Sign template document with HMAC.
 */
export function signTemplate(doc: TemplateDocument): string {
  const json = JSON.stringify(doc);
  return crypto.createHmac('sha256', SECRET).update(json).digest('hex');
}

/**
 * Verify template signature.
 */
export function verifyTemplate(doc: TemplateDocument, signature: string): boolean {
  const expected = signTemplate(doc);
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

/**
 * Validate template document structure (basic schema check).
 */
export function validateTemplateStructure(doc: unknown): doc is TemplateDocument {
  if (!doc || typeof doc !== 'object') return false;
  const d = doc as any;
  
  if (!d.schemaVersion || typeof d.schemaVersion !== 'string') return false;
  if (!d.version || typeof d.version !== 'object') return false;
  if (!d.version.versionId || typeof d.version.versionId !== 'string') return false;
  if (!['draft', 'published', 'archived'].includes(d.version.status)) return false;
  if (!d.areas || typeof d.areas !== 'object') return false;
  if (!d.defaultAreaId || typeof d.defaultAreaId !== 'string') return false;
  
  return true;
}

/**
 * Sanitize variable value (remove HTML, scripts, etc.).
 */
export function sanitizeVariableValue(value: string, type: 'text' | 'image'): string {
  if (type === 'text') {
    // Remove HTML tags and scripts
    return value
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+\s*=/gi, '') // Remove event handlers
      .trim();
  }

  // For images, validate URL
  if (type === 'image') {
    try {
      const url = new URL(value);
      // Only allow HTTPS
      if (url.protocol !== 'https:') {
        throw new Error('Only HTTPS URLs allowed');
      }
      // Whitelist domains (configure as needed)
      const allowedDomains = process.env.ALLOWED_IMAGE_DOMAINS?.split(',') || [];
      if (allowedDomains.length > 0) {
        const isAllowed = allowedDomains.some((domain) => url.hostname.endsWith(domain));
        if (!isAllowed) {
          throw new Error('Domain not allowed');
        }
      }
      return value;
    } catch {
      throw new Error('Invalid image URL');
    }
  }

  return value;
}

/**
 * Validate image file (basic checks).
 * In production, use sharp or file-type library for full validation.
 */
export interface ImageValidationResult {
  valid: boolean;
  error?: string;
  metadata?: {
    width: number;
    height: number;
    format: string;
    size: number;
  };
}

export async function validateImageFile(
  file: Buffer,
  constraints?: {
    maxSizeBytes?: number;
    maxWidth?: number;
    maxHeight?: number;
    allowedMimeTypes?: string[];
  }
): Promise<ImageValidationResult> {
  // Check file size
  if (constraints?.maxSizeBytes && file.length > constraints.maxSizeBytes) {
    return {
      valid: false,
      error: `File too large: ${Math.round(file.length / 1024)}KB (max: ${Math.round(constraints.maxSizeBytes / 1024)}KB)`,
    };
  }

  // In production, use sharp or file-type to validate image format and dimensions
  // For now, basic check: file must exist and have reasonable size
  if (file.length === 0) {
    return { valid: false, error: 'Empty file' };
  }

  // TODO: Use sharp to get actual dimensions and format
  // const metadata = await sharp(file).metadata();
  // if (metadata.width && constraints?.maxWidth && metadata.width > constraints.maxWidth) {
  //   return { valid: false, error: `Width too large: ${metadata.width}px` };
  // }

  return {
    valid: true,
    metadata: {
      width: 0, // Placeholder
      height: 0,
      format: 'unknown',
      size: file.length,
    },
  };
}
