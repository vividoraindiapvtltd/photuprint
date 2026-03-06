/**
 * Canvas renderer: render TemplateArea to PNG buffer at specified DPI.
 * Uses node-canvas for server-side rendering.
 */

import { createCanvas, loadImage, CanvasRenderingContext2D } from 'canvas';
import type { TemplateArea, TemplateLayer, TextLayer, ImageLayer, ShapeLayer } from '../editor/types';

export interface RenderOptions {
  dpi: number;
  physicalWidthMm?: number;  // Override template canvas width
  physicalHeightMm?: number; // Override template canvas height
}

/**
 * Render one TemplateArea to PNG buffer at specified DPI.
 * Canvas size = physical size (mm) × DPI / 25.4 (mm to inches conversion).
 */
export async function renderArea(area: TemplateArea, options: RenderOptions): Promise<Buffer> {
  const { canvas: spec } = area;
  const { dpi, physicalWidthMm, physicalHeightMm } = options;

  // Use physical size from options or template spec
  const widthMm = physicalWidthMm ?? spec.width;
  const heightMm = physicalHeightMm ?? spec.height;

  // Calculate canvas pixels: (mm / 25.4) × DPI
  const canvasWidthPx = Math.round((widthMm / 25.4) * dpi);
  const canvasHeightPx = Math.round((heightMm / 25.4) * dpi);

  // Create canvas at calculated size
  const canvas = createCanvas(canvasWidthPx, canvasHeightPx);
  const ctx = canvas.getContext('2d');

  // Set DPI metadata (for PDF export)
  (canvas as any).dpi = dpi;

  // Scale factor: logical units → physical pixels
  const scaleX = canvasWidthPx / spec.width;
  const scaleY = canvasHeightPx / spec.height;

  // Render layers in order (bottom → top)
  const layerOrder = area.layerOrder ?? Object.keys(area.layers);
  for (const layerId of layerOrder) {
    const layer = area.layers[layerId];
    if (!layer) continue;

    await renderLayer(ctx, layer, scaleX, scaleY, dpi, spec.width, spec.height);
  }

  // Export PNG
  return canvas.toBuffer('image/png');
}

async function renderLayer(
  ctx: CanvasRenderingContext2D,
  layer: TemplateLayer,
  scaleX: number,
  scaleY: number,
  dpi: number,
  logicalWidth: number,
  logicalHeight: number
): Promise<void> {
  const { transform } = layer;

  // Apply transform (scale logical → physical)
  const x = transform.left * scaleX;
  const y = transform.top * scaleY;
  const w = transform.width * (transform.scaleX ?? 1) * scaleX;
  const h = transform.height * (transform.scaleY ?? 1) * scaleY;
  const angle = transform.angle ?? 0;

  ctx.save();

  // Rotate around center
  if (angle !== 0) {
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate((angle * Math.PI) / 180);
    ctx.translate(-(x + w / 2), -(y + h / 2));
  }

  if (layer.type === 'text') {
    await renderTextLayer(ctx, layer as TextLayer, x, y, w, h, scaleX, scaleY, dpi);
  } else if (layer.type === 'image') {
    await renderImageLayer(ctx, layer as ImageLayer, x, y, w, h);
  } else if (layer.type === 'shape') {
    renderShapeLayer(ctx, layer as ShapeLayer, x, y, w, h);
  }

  ctx.restore();
}

async function renderTextLayer(
  ctx: CanvasRenderingContext2D,
  layer: TextLayer,
  x: number,
  y: number,
  w: number,
  h: number,
  scaleX: number,
  scaleY: number,
  dpi: number
): Promise<void> {
  const { style, content } = layer;

  // Scale font size: logical → physical at DPI
  // Assume template was designed at 72 DPI; scale to target DPI
  const fontSize = style.fontSize * (dpi / 72) * scaleY;

  const fontStyle = style.fontStyle ?? 'normal';
  const fontWeight = style.fontWeight ?? 'normal';
  const fontFamily = style.fontFamily ?? 'Arial';

  ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
  ctx.fillStyle = style.fill;
  ctx.textAlign = (style.textAlign ?? 'left') as CanvasTextAlign;
  ctx.textBaseline = 'top';

  // Enable high-quality text rendering
  ctx.textBaseline = 'alphabetic';
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Handle line breaks (simple: split by \n)
  const lines = content.split('\n');
  const lineHeight = fontSize * (style.lineHeight ?? 1.2);

  lines.forEach((line, index) => {
    ctx.fillText(line, x, y + index * lineHeight, w);
  });
}

async function renderImageLayer(
  ctx: CanvasRenderingContext2D,
  layer: ImageLayer,
  x: number,
  y: number,
  w: number,
  h: number
): Promise<void> {
  try {
    const img = await loadImage(layer.src);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, x, y, w, h);
  } catch (error) {
    console.error(`Failed to load image: ${layer.src}`, error);
    // Draw placeholder rectangle
    ctx.fillStyle = '#cccccc';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#999999';
    ctx.strokeRect(x, y, w, h);
  }
}

function renderShapeLayer(
  ctx: CanvasRenderingContext2D,
  layer: ShapeLayer,
  x: number,
  y: number,
  w: number,
  h: number
): void {
  if (layer.fill) {
    ctx.fillStyle = layer.fill;
  }
  if (layer.stroke) {
    ctx.strokeStyle = layer.stroke;
    ctx.lineWidth = layer.strokeWidth ?? 1;
  }

  if (layer.kind === 'rect') {
    if (layer.fill) ctx.fillRect(x, y, w, h);
    if (layer.stroke) ctx.strokeRect(x, y, w, h);
  } else if (layer.kind === 'ellipse') {
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, 2 * Math.PI);
    if (layer.fill) ctx.fill();
    if (layer.stroke) ctx.stroke();
  } else if (layer.kind === 'line') {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y + h);
    if (layer.stroke) ctx.stroke();
  }
  // polygon: render points if provided
}
