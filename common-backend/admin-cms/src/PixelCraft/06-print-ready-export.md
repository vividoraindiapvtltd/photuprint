# Prompt 6: Print-Ready Export System

## Server-side rendering pipeline for templates and user designs

This document describes the **rendering architecture**, **Node.js rendering code**, **DPI calculation**, and **common pitfalls** for producing print-ready exports (PNG/PDF at 300 DPI) from template JSON + user variable values.

**Requirements:** Node.js rendering (Fabric.js or node-canvas), 300 DPI output, PNG and PDF export, font consistency between frontend and backend, color accuracy.

---

## 1. Rendering architecture

### 1.1 High-level flow

```
User Customization (variableValues)
    +
Published Template (TemplateDocument)
    ↓
Render Service (Node.js)
    ├── Load template JSON
    ├── Merge variable values into template
    ├── Resolve assets (images, fonts)
    ├── Render at physical size × 300 DPI
    ├── Export PNG (per area)
    └── Export PDF (multi-page if multi-area)
    ↓
Blob Storage (S3/CDN)
    ↓
Order/Fulfillment System
```

### 1.2 Component breakdown

| Component | Responsibility |
|-----------|----------------|
| **Render Queue** | Queue jobs (Bull/Agenda/Redis); rate limiting, retries |
| **Render Worker** | Process one render job: load template, merge vars, render, upload |
| **Template Loader** | Load TemplateDocument from DB; resolve assets (images, fonts) |
| **Variable Merger** | Inject user variable values into template layers |
| **Canvas Renderer** | Create canvas at physical size × DPI; draw objects; export PNG/PDF |
| **Font Manager** | Load fonts (system fonts or custom); ensure consistency with frontend |
| **Asset Resolver** | Resolve image URLs (CDN) or load from blob storage |
| **Color Converter** | Convert RGB → CMYK if needed; handle color profiles |
| **Export Handler** | Generate PNG (per area) and PDF (multi-page); upload to S3 |

### 1.3 Architecture diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         API / Order Service                      │
│  POST /api/render                                                │
│  { productId, templateVersionId, variableValues, areaIds }      │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Render Queue (Redis)                     │
│  • Job: { id, productId, templateVersionId, variableValues }    │
│  • Priority, retries, rate limiting                              │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Render Worker (Node.js)                    │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ 1. Load TemplateDocument from DB                        │   │
│  │ 2. Resolve assets (images, fonts)                        │   │
│  │ 3. Merge variableValues into template layers             │   │
│  │ 4. For each area:                                         │   │
│  │    a. Create canvas at physical size × 300 DPI          │   │
│  │    b. Render objects (text, images, shapes)             │   │
│  │    c. Export PNG                                          │   │
│  │ 5. Combine PNGs → PDF (if multi-area)                    │   │
│  │ 6. Upload PNGs + PDF to S3                               │   │
│  │ 7. Update job status + return storage paths              │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Blob Storage (S3/CDN)                      │
│  • PNG: /renders/{orderId}/{areaId}.png                        │
│  • PDF: /renders/{orderId}/print-ready.pdf                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Example Node.js rendering code

### 2.1 Render worker (main entry)

```typescript
// services/render/worker.ts
import { Worker, Job } from 'bull';
import { createCanvas, loadImage, registerFont } from 'canvas';
import { resolveTemplate } from './templateLoader';
import { mergeVariables } from './variableMerger';
import { renderArea } from './canvasRenderer';
import { uploadToS3 } from './storage';
import type { TemplateDocument } from '@/PixelCraft/editor/types';

interface RenderJob {
  productId: string;
  templateVersionId: string;
  variableValues: Record<string, string>;
  areaIds?: string[];  // optional: render specific areas only
  orderId?: string;
}

interface RenderResult {
  pngs: Record<string, string>;  // areaId → S3 path
  pdf?: string;                  // S3 path if multi-area
}

export async function processRenderJob(job: Job<RenderJob>): Promise<RenderResult> {
  const { productId, templateVersionId, variableValues, areaIds, orderId } = job.data;
  
  // 1. Load template document
  const template = await resolveTemplate(templateVersionId);
  if (!template) {
    throw new Error(`Template version not found: ${templateVersionId}`);
  }

  // 2. Resolve assets (images, fonts)
  await resolveAssets(template);

  // 3. Determine areas to render
  const areasToRender = areaIds ?? [template.defaultAreaId];

  // 4. Render each area
  const pngs: Record<string, string> = {};
  for (const areaId of areasToRender) {
    const area = template.areas[areaId];
    if (!area) continue;

    // Merge variable values into area layers
    const mergedArea = mergeVariables(area, variableValues);

    // Render at 300 DPI
    const pngBuffer = await renderArea(mergedArea, 300);

    // Upload PNG
    const s3Path = await uploadToS3(
      pngBuffer,
      `renders/${orderId ?? 'temp'}/${areaId}.png`,
      'image/png'
    );
    pngs[areaId] = s3Path;
  }

  // 5. Generate PDF if multi-area
  let pdfPath: string | undefined;
  if (areasToRender.length > 1) {
    pdfPath = await generatePDF(pngs, orderId);
  }

  return { pngs, pdf: pdfPath };
}

async function resolveAssets(template: TemplateDocument): Promise<void> {
  // Load fonts (registerFont for node-canvas)
  // Resolve image URLs (download if needed)
  // See fontManager.ts and assetResolver.ts
}

async function generatePDF(pngs: Record<string, string>, orderId?: string): Promise<string> {
  // Use pdfkit or similar to combine PNGs into PDF
  // See pdfExporter.ts
}
```

### 2.2 Canvas renderer (300 DPI)

```typescript
// services/render/canvasRenderer.ts
import { createCanvas, loadImage, CanvasRenderingContext2D } from 'canvas';
import type { TemplateArea, TemplateLayer, TextLayer, ImageLayer, ShapeLayer } from '@/PixelCraft/editor/types';

/**
 * Render one TemplateArea to PNG buffer at specified DPI.
 * Canvas size = physical size (mm) × DPI / 25.4 (mm to inches conversion).
 */
export async function renderArea(area: TemplateArea, dpi: number): Promise<Buffer> {
  const { canvas: spec } = area;
  
  // Calculate physical size in mm (from template or product mapping)
  // For now, assume spec.width/height are in logical units (e.g. 1000px)
  // Physical size = logical size × (DPI / 72) if logical was at 72 DPI
  // OR: if template has print dimensions, use those directly
  
  // Example: template says 210mm × 297mm (A4) at 300 DPI
  // Canvas pixels = (210 / 25.4) × 300 = 2480px width
  const physicalWidthMm = spec.width;  // or from product mapping
  const physicalHeightMm = spec.height;
  
  const canvasWidthPx = Math.round((physicalWidthMm / 25.4) * dpi);
  const canvasHeightPx = Math.round((physicalHeightMm / 25.4) * dpi);

  // Create canvas at calculated size
  const canvas = createCanvas(canvasWidthPx, canvasHeightPx);
  const ctx = canvas.getContext('2d');

  // Set DPI (for PDF metadata, not canvas size)
  (canvas as any).dpi = dpi;

  // Scale factor: logical units → physical pixels
  const scaleX = canvasWidthPx / spec.width;
  const scaleY = canvasHeightPx / spec.height;

  // Render layers in order (bottom → top)
  const layerOrder = area.layerOrder ?? Object.keys(area.layers);
  for (const layerId of layerOrder) {
    const layer = area.layers[layerId];
    if (!layer) continue;

    await renderLayer(ctx, layer, scaleX, scaleY, dpi);
  }

  // Export PNG
  return canvas.toBuffer('image/png');
}

async function renderLayer(
  ctx: CanvasRenderingContext2D,
  layer: TemplateLayer,
  scaleX: number,
  scaleY: number,
  dpi: number
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
  // If logical was at 72 DPI and we're rendering at 300 DPI:
  // fontSize = style.fontSize * (dpi / 72)
  const fontSize = style.fontSize * (dpi / 72) * scaleY;

  ctx.font = `${style.fontStyle ?? 'normal'} ${style.fontWeight ?? 'normal'} ${fontSize}px ${style.fontFamily}`;
  ctx.fillStyle = style.fill;
  ctx.textAlign = style.textAlign ?? 'left';
  ctx.textBaseline = 'top';

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
  const img = await loadImage(layer.src);
  ctx.drawImage(img, x, y, w, h);
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
    ctx.fillRect(x, y, w, h);
    if (layer.stroke) ctx.strokeRect(x, y, w, h);
  } else if (layer.kind === 'ellipse') {
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, 2 * Math.PI);
    ctx.fill();
    if (layer.stroke) ctx.stroke();
  }
  // polygon, line: similar
}
```

### 2.3 Variable merger

```typescript
// services/render/variableMerger.ts
import type { TemplateArea, TemplateLayer } from '@/PixelCraft/editor/types';

/**
 * Merge user variable values into template area layers.
 * Updates layer.content (text) or layer.src (image) for layers with matching variableId.
 */
export function mergeVariables(
  area: TemplateArea,
  variableValues: Record<string, string>
): TemplateArea {
  const mergedLayers: Record<string, TemplateLayer> = {};

  Object.entries(area.layers).forEach(([layerId, layer]) => {
    const variableId = layer.variableId;
    
    if (variableId && variableValues[variableId]) {
      // Clone layer and update with user value
      const mergedLayer = { ...layer };
      
      if (layer.type === 'text') {
        (mergedLayer as any).content = variableValues[variableId];
      } else if (layer.type === 'image') {
        (mergedLayer as any).src = variableValues[variableId];
      }
      
      mergedLayers[layerId] = mergedLayer;
    } else {
      // Keep original layer
      mergedLayers[layerId] = layer;
    }
  });

  return {
    ...area,
    layers: mergedLayers,
  };
}
```

### 2.4 Font manager

```typescript
// services/render/fontManager.ts
import { registerFont } from 'canvas';
import path from 'path';
import fs from 'fs';

const FONT_DIR = path.join(process.cwd(), 'assets', 'fonts');

/**
 * Register fonts for node-canvas.
 * Call this at worker startup or per-template.
 */
export function registerFonts(): void {
  // System fonts (if available)
  // Custom fonts from assets/fonts/
  const fontFiles = fs.readdirSync(FONT_DIR).filter(f => f.endsWith('.ttf') || f.endsWith('.otf'));
  
  fontFiles.forEach((file) => {
    const fontPath = path.join(FONT_DIR, file);
    const fontName = path.basename(file, path.extname(file));
    registerFont(fontPath, { family: fontName });
  });
}

/**
 * Get font family name for node-canvas.
 * Maps frontend font names to backend font names (may differ).
 */
export function getFontFamily(frontendFont: string): string {
  const fontMap: Record<string, string> = {
    'Inter': 'Inter',
    'Roboto': 'Roboto',
    'Open Sans': 'Open Sans',
    // Add mappings as needed
  };
  
  return fontMap[frontendFont] ?? frontendFont;
}
```

---

## 3. DPI calculation explanation

### 3.1 Understanding DPI

**DPI (Dots Per Inch)** = pixels per inch in the output image.

- **Design size (logical):** Template editor uses logical units (e.g. 1000×1000px) for design.
- **Physical size:** Product has physical dimensions (e.g. 210mm × 297mm for A4).
- **Output DPI:** Print requires 300 DPI (or 150 DPI for lower quality).

**Formula:** Canvas pixels = (Physical size in inches) × DPI

### 3.2 Calculation steps

**Step 1: Convert physical size to inches**

```
Physical width (mm) → inches: widthInches = widthMm / 25.4
Physical height (mm) → inches: heightInches = heightMm / 25.4
```

**Step 2: Calculate canvas pixels**

```
Canvas width (px) = widthInches × DPI
Canvas height (px) = heightInches × DPI
```

**Example:** A4 poster (210mm × 297mm) at 300 DPI

```
widthInches = 210 / 25.4 = 8.27 inches
heightInches = 297 / 25.4 = 11.69 inches

Canvas width = 8.27 × 300 = 2481 px
Canvas height = 11.69 × 300 = 3507 px
```

**Step 3: Scale factor (logical → physical)**

```
scaleX = canvasWidthPx / logicalWidth
scaleY = canvasHeightPx / logicalHeight
```

**Example:** Template logical size = 1000×1414 (A4 aspect ratio)

```
scaleX = 2481 / 1000 = 2.481
scaleY = 3507 / 1414 = 2.477
```

**Step 4: Scale all objects**

- Position: `x_physical = x_logical × scaleX`
- Size: `width_physical = width_logical × scaleX`
- Font size: `fontSize_physical = fontSize_logical × (DPI / 72) × scaleY`

**Note:** If template was designed at 72 DPI and you render at 300 DPI, multiply font size by `300/72 = 4.17`.

### 3.3 Code example

```typescript
function calculateCanvasSize(physicalWidthMm: number, physicalHeightMm: number, dpi: number) {
  const widthInches = physicalWidthMm / 25.4;
  const heightInches = physicalHeightMm / 25.4;
  
  const canvasWidthPx = Math.round(widthInches * dpi);
  const canvasHeightPx = Math.round(heightInches * dpi);
  
  return { canvasWidthPx, canvasHeightPx };
}

function calculateScaleFactor(
  logicalWidth: number,
  logicalHeight: number,
  physicalWidthMm: number,
  physicalHeightMm: number,
  dpi: number
) {
  const { canvasWidthPx, canvasHeightPx } = calculateCanvasSize(physicalWidthMm, physicalHeightMm, dpi);
  
  const scaleX = canvasWidthPx / logicalWidth;
  const scaleY = canvasHeightPx / logicalHeight;
  
  return { scaleX, scaleY, canvasWidthPx, canvasHeightPx };
}
```

---

## 4. Common pitfalls and solutions

### 4.1 Font consistency

**Problem:** Frontend (browser) and backend (node-canvas) use different fonts, causing text to wrap/break differently.

**Solutions:**

1. **Use web fonts in both:** Load same `.ttf`/`.otf` files in browser (via CSS) and register in node-canvas (`registerFont`).
2. **Font mapping:** Map frontend font names to backend font names (e.g. "Inter" → "Inter-Regular").
3. **Fallback fonts:** Define fallback chain (e.g. "Inter" → "Arial" → "sans-serif").
4. **Text measurement:** Use same text measurement logic (e.g. `ctx.measureText()` in both) to ensure wrapping matches.

**Code:**

```typescript
// Register fonts at worker startup
registerFonts();

// Use font mapping when rendering
const backendFont = getFontFamily(layer.style.fontFamily);
ctx.font = `${fontSize}px ${backendFont}`;
```

### 4.2 Color accuracy

**Problem:** RGB colors in browser may not match print (CMYK), or colors look different on screen vs print.

**Solutions:**

1. **Color profiles:** Use ICC color profiles for CMYK conversion (e.g. `sharp` library with color profiles).
2. **RGB → CMYK conversion:** Convert RGB to CMYK for print (optional; many printers accept RGB).
3. **Color space:** Specify color space in PDF metadata (sRGB or CMYK).
4. **Test prints:** Calibrate with test prints; adjust color profiles as needed.

**Code:**

```typescript
// Use sharp for color conversion (optional)
import sharp from 'sharp';

async function convertToCMYK(pngBuffer: Buffer): Promise<Buffer> {
  return sharp(pngBuffer)
    .toColorspace('cmyk')
    .png()
    .toBuffer();
}
```

### 4.3 Image quality

**Problem:** Images look blurry or pixelated at 300 DPI.

**Solutions:**

1. **High-res source images:** Use source images at least 2× the output size (e.g. 600 DPI source for 300 DPI output).
2. **Image scaling:** Use high-quality scaling (e.g. `ctx.imageSmoothingEnabled = true`, Lanczos resampling).
3. **Vector graphics:** Use SVG where possible; rasterize at target DPI.

**Code:**

```typescript
ctx.imageSmoothingEnabled = true;
ctx.imageSmoothingQuality = 'high';
```

### 4.4 Memory and performance

**Problem:** Large canvases (e.g. 3500×5000px) consume too much memory or render slowly.

**Solutions:**

1. **Streaming:** Use streaming canvas libraries (e.g. `node-canvas` with `createCanvasStream`).
2. **Chunked rendering:** Render in tiles/chunks if canvas is very large.
3. **Worker pools:** Use worker pools to parallelize renders.
4. **Caching:** Cache rendered outputs by template version + variable hash.

**Code:**

```typescript
// Use worker pool
import { WorkerPool } from 'workerpool';

const pool = WorkerPool('./renderWorker.js', { maxWorkers: 4 });
const result = await pool.exec('renderArea', [area, dpi]);
```

### 4.5 Asset resolution

**Problem:** Images or fonts fail to load (404, CORS, timeout).

**Solutions:**

1. **Asset resolver:** Download assets to local cache before rendering.
2. **Retry logic:** Retry failed asset loads with exponential backoff.
3. **Fallback assets:** Use placeholder images/fonts if asset fails.
4. **CDN caching:** Ensure assets are cached in CDN for fast access.

**Code:**

```typescript
async function resolveImage(src: string): Promise<string> {
  // If URL, download and cache locally
  if (src.startsWith('http')) {
    const cached = await downloadAndCache(src);
    return cached;
  }
  // If local path, return as-is
  return src;
}
```

### 4.6 PDF generation

**Problem:** PDF pages don't match PNG dimensions, or multi-page PDF has wrong order.

**Solutions:**

1. **Page size:** Set PDF page size to match physical dimensions (e.g. 210mm × 297mm).
2. **DPI in PDF:** Embed DPI metadata in PDF (e.g. `pdfDoc.info.Resolution = 300`).
3. **Page order:** Ensure areas are added to PDF in correct order (front, back, inside).
4. **Bleed/safe area:** Add bleed margins if needed (extend canvas beyond trim).

**Code:**

```typescript
import PDFDocument from 'pdfkit';

function generatePDF(pngs: Record<string, Buffer>, physicalSizeMm: { width: number; height: number }): Buffer {
  const doc = new PDFDocument({
    size: [physicalSizeMm.width, physicalSizeMm.height],
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
  });
  
  Object.values(pngs).forEach((pngBuffer) => {
    doc.image(pngBuffer, { fit: [physicalSizeMm.width, physicalSizeMm.height] });
    doc.addPage();
  });
  
  return doc;
}
```

---

## 5. Summary

| Component | Purpose |
|-----------|---------|
| **Render Queue** | Queue jobs (Bull/Agenda); rate limiting, retries |
| **Render Worker** | Process render job: load template, merge vars, render, upload |
| **Canvas Renderer** | Create canvas at physical size × DPI; render layers; export PNG |
| **Variable Merger** | Inject user variable values into template layers |
| **Font Manager** | Register fonts; map frontend → backend font names |
| **Asset Resolver** | Resolve image URLs; download and cache |
| **PDF Exporter** | Combine PNGs into multi-page PDF |

**DPI calculation:** Canvas pixels = (Physical size in inches) × DPI. Scale all objects (position, size, font) by scale factor (logical → physical).

**Common pitfalls:** Font consistency (use same fonts + mapping), color accuracy (CMYK conversion if needed), image quality (high-res sources), memory/performance (streaming, worker pools), asset resolution (download + cache), PDF generation (correct page size + order).

---

## 6. File layout (reference implementation)

Code for the above lives under `PixelCraft/render/`:

| File | Purpose |
|------|---------|
| **canvasRenderer.ts** | `renderArea(area, options)` – render TemplateArea to PNG buffer at 300 DPI |
| **variableMerger.ts** | `mergeVariables(area, variableValues)` – inject user values into template layers |
| **fontManager.ts** | `registerFonts()`, `getFontFamily()` – register fonts and map frontend → backend names |
| **pdfExporter.ts** | `generatePDF(pngs, areaOrder, options)` – combine PNGs into multi-page PDF |
| **index.ts** | Public exports |

**Not yet implemented (structure only):** `worker.ts` (render job processor), `templateLoader.ts` (load from DB), `assetResolver.ts` (resolve images/fonts), `storage.ts` (upload to S3). Use the patterns in this doc and the render code to build them.

**Usage (Node.js):** Install `canvas` and `pdfkit`, then:

```ts
import { renderArea } from '@/PixelCraft/render';
import { mergeVariables } from '@/PixelCraft/render';
import { registerFonts } from '@/PixelCraft/render';

// Register fonts at startup
registerFonts();

// Render area at 300 DPI
const mergedArea = mergeVariables(templateArea, variableValues);
const pngBuffer = await renderArea(mergedArea, { dpi: 300, physicalWidthMm: 210, physicalHeightMm: 297 });
```

**Dependencies:**

```json
{
  "dependencies": {
    "canvas": "^2.11.2",
    "pdfkit": "^0.13.0"
  }
}
```

This design keeps the Print-Ready Export System aligned with the template JSON schema (Prompt 2), the architecture (Prompt 1), and the admin/user editors (Prompts 4–5), while ensuring **300 DPI print-ready output** for production use.
