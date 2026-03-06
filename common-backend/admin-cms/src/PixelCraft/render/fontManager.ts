/**
 * Font manager: register fonts for node-canvas and map frontend → backend font names.
 */

import { registerFont } from 'canvas';
import path from 'path';
import fs from 'fs';

const FONT_DIR = path.join(process.cwd(), 'assets', 'fonts');

/**
 * Register fonts for node-canvas.
 * Call this at worker startup or per-template.
 * Loads fonts from assets/fonts/ directory.
 */
export function registerFonts(): void {
  if (!fs.existsSync(FONT_DIR)) {
    console.warn(`Font directory not found: ${FONT_DIR}`);
    return;
  }

  const fontFiles = fs.readdirSync(FONT_DIR).filter(
    (f) => f.endsWith('.ttf') || f.endsWith('.otf') || f.endsWith('.woff')
  );

  fontFiles.forEach((file) => {
    const fontPath = path.join(FONT_DIR, file);
    const fontName = path.basename(file, path.extname(file));
    try {
      registerFont(fontPath, { family: fontName });
      console.log(`Registered font: ${fontName} from ${file}`);
    } catch (error) {
      console.error(`Failed to register font ${fontName}:`, error);
    }
  });
}

/**
 * Get font family name for node-canvas.
 * Maps frontend font names to backend font names (may differ).
 * Add mappings as needed for your fonts.
 */
export function getFontFamily(frontendFont: string): string {
  const fontMap: Record<string, string> = {
    Inter: 'Inter',
    'Inter-Regular': 'Inter',
    'Inter-Bold': 'Inter',
    Roboto: 'Roboto',
    'Roboto-Regular': 'Roboto',
    'Roboto-Bold': 'Roboto',
    'Open Sans': 'Open Sans',
    'OpenSans-Regular': 'Open Sans',
    'OpenSans-Bold': 'Open Sans',
    Arial: 'Arial',
    'Helvetica Neue': 'Helvetica',
    Helvetica: 'Helvetica',
    Times: 'Times',
    'Times New Roman': 'Times',
    Courier: 'Courier',
    'Courier New': 'Courier',
  };

  return fontMap[frontendFont] ?? frontendFont;
}

/**
 * Check if font is available in node-canvas.
 * Returns true if font is registered or is a system font.
 */
export function isFontAvailable(fontFamily: string): boolean {
  // System fonts are usually available
  const systemFonts = ['Arial', 'Helvetica', 'Times', 'Courier', 'serif', 'sans-serif', 'monospace'];
  return systemFonts.includes(fontFamily);
}
