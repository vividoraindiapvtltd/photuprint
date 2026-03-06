/**
 * Template thumbnail generation: generate low-res previews for list views.
 */

import { renderArea, type RenderOptions } from '../render/canvasRenderer';
import type { TemplateArea } from '../editor/types';

export interface ThumbnailOptions {
  width?: number;
  height?: number;
  dpi?: number;
}

const DEFAULT_THUMBNAIL_SIZE = 200;
const DEFAULT_THUMBNAIL_DPI = 72;

/**
 * Generate thumbnail for one template area.
 * Returns PNG buffer at low DPI (72) and small size (200×200px max).
 */
export async function generateThumbnail(
  area: TemplateArea,
  options: ThumbnailOptions = {}
): Promise<Buffer> {
  const { width = DEFAULT_THUMBNAIL_SIZE, height = DEFAULT_THUMBNAIL_SIZE, dpi = DEFAULT_THUMBNAIL_DPI } = options;

  // Calculate aspect ratio
  const aspectRatio = area.canvas.width / area.canvas.height;
  let thumbWidth = width;
  let thumbHeight = height;

  if (aspectRatio > 1) {
    // Landscape: fit width
    thumbHeight = Math.round(thumbWidth / aspectRatio);
  } else {
    // Portrait or square: fit height
    thumbWidth = Math.round(thumbHeight * aspectRatio);
  }

  // Convert pixels to mm (for renderArea)
  // At 72 DPI: 1 inch = 72px, 1 inch = 25.4mm
  // So: px / 72 * 25.4 = mm
  const physicalWidthMm = (thumbWidth / dpi) * 25.4;
  const physicalHeightMm = (thumbHeight / dpi) * 25.4;

  // Render at low DPI
  const png = await renderArea(area, {
    dpi,
    physicalWidthMm,
    physicalHeightMm,
  });

  return png;
}

/**
 * Generate thumbnails for all areas in a template.
 * Returns map of areaId → PNG buffer.
 */
export async function generateThumbnailsForTemplate(
  areas: Record<string, TemplateArea>,
  options: ThumbnailOptions = {}
): Promise<Record<string, Buffer>> {
  const thumbnails: Record<string, Buffer> = {};

  for (const [areaId, area] of Object.entries(areas)) {
    thumbnails[areaId] = await generateThumbnail(area, options);
  }

  return thumbnails;
}
