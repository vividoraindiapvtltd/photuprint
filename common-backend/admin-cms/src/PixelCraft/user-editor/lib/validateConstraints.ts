/**
 * Validate constraints for text and image fields.
 * Used in EditableFieldPanel before updating canvas.
 */

export interface TextConstraints {
  maxLength?: number;
  allowedFonts?: string[];
  allowedColors?: string[];
  fontSizeMin?: number;
  fontSizeMax?: number;
}

export interface ImageConstraints {
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  aspectRatio?: [number, number];
  allowedMimeTypes?: string[];
  maxFileSizeBytes?: number;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate text value against constraints.
 */
export function validateText(value: string, constraints?: TextConstraints): ValidationResult {
  if (constraints?.maxLength && value.length > constraints.maxLength) {
    return {
      valid: false,
      error: `Text must be ${constraints.maxLength} characters or less.`,
    };
  }
  return { valid: true };
}

/**
 * Validate image file against constraints.
 */
export function validateImage(file: File, constraints?: ImageConstraints): Promise<ValidationResult> {
  return new Promise((resolve) => {
    // Check file size
    if (constraints?.maxFileSizeBytes && file.size > constraints.maxFileSizeBytes) {
      resolve({
        valid: false,
        error: `Image too large. Max size: ${Math.round(constraints.maxFileSizeBytes / 1024 / 1024)}MB.`,
      });
      return;
    }

    // Check MIME type
    if (constraints?.allowedMimeTypes && !constraints.allowedMimeTypes.includes(file.type)) {
      resolve({
        valid: false,
        error: `Invalid file type. Allowed: ${constraints.allowedMimeTypes.join(', ')}.`,
      });
      return;
    }

    // Check dimensions (load image to check)
    if (constraints?.maxWidth || constraints?.maxHeight || constraints?.aspectRatio) {
      const img = new Image();
      img.onload = () => {
        if (constraints.maxWidth && img.width > constraints.maxWidth) {
          resolve({
            valid: false,
            error: `Image width must be ${constraints.maxWidth}px or less.`,
          });
          return;
        }
        if (constraints.maxHeight && img.height > constraints.maxHeight) {
          resolve({
            valid: false,
            error: `Image height must be ${constraints.maxHeight}px or less.`,
          });
          return;
        }
        if (constraints.aspectRatio) {
          const [w, h] = constraints.aspectRatio;
          const ratio = img.width / img.height;
          const expectedRatio = w / h;
          const tolerance = 0.01;
          if (Math.abs(ratio - expectedRatio) > tolerance) {
            resolve({
              valid: false,
              error: `Image aspect ratio must be ${w}:${h}.`,
            });
            return;
          }
        }
        resolve({ valid: true });
      };
      img.onerror = () => {
        resolve({
          valid: false,
          error: 'Failed to load image.',
        });
      };
      img.src = URL.createObjectURL(file);
    } else {
      resolve({ valid: true });
    }
  });
}
