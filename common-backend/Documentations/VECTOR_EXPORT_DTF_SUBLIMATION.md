# Vector Export for DTF and Sublimation

This document describes how to produce **print-ready vector graphics** from the PixelCraft editor for **DTF (Direct to Film)** and **sublimation** printing.

## What the tool does

- **Raster → vector**: Converts the flattened canvas image into an SVG using smooth Bézier curves with minimal anchor points.
- **Noise reduction**: Omits tiny paths and applies light preprocessing to reduce raster noise and compression artifacts.
- **Solid fills**: Uses a limited color palette for clean, vibrant output suitable for heat transfer.
- **Sharp edges**: Enhances right angles and rounds coordinates for clean paths and smaller files.
- **Text as outlines**: When you flatten the canvas and then vectorize, all text becomes vector paths (no live type in the SVG).

## In the PixelCraft editor

1. Design your template as usual (text, shapes, images).
2. Use **Download** → **Vector (SVG)**.
3. The app flattens the canvas to PNG, runs the vectorizer (imagetracerjs), and downloads an SVG file.

**Dependency:** `imagetracerjs` must be installed in the admin-cms app:

```bash
cd admin-cms && npm install imagetracerjs
```

## Export formats (SVG / PDF / EPS)

| Format | How to get it |
|--------|----------------|
| **SVG** | Use **Download → Vector (SVG)** in PixelCraft. Editable in Illustrator and supported by many RIPs. |
| **PDF** | Open the SVG in **Adobe Illustrator** → **File → Save As** → choose **Adobe PDF**. Or use **File → Export** and pick PDF. |
| **EPS** | Open the SVG in **Adobe Illustrator** → **File → Save As** → choose **Illustrator EPS (.eps)**. EPS is widely supported by RIP software. |

## CMYK and RIP workflow

- **SVG from PixelCraft** is in **sRGB**. For DTF/sublimation you often want **CMYK** or device-specific color.
- **In Adobe Illustrator:**
  1. Open the downloaded SVG.
  2. **Document Color Mode**: Switch to CMYK if needed (*File → Document Color Mode → CMYK*).
  3. Adjust colors if desired (e.g. for vibrant heat transfer).
  4. **Save As** PDF or EPS for your RIP.
- **In your RIP:** Use the PDF or EPS from Illustrator; the RIP will handle color mapping and separation for your printer.

## Best practices

- **Shapes and proportions**: Design at the intended print size (or use the template dimensions) so the vectorized result keeps accurate proportions.
- **Background**: If you want no background in the vector, use a transparent or solid background in the design and ensure the vectorizer options (e.g. threshold/pathomit) don’t leave stray paths; you can clean up in Illustrator if needed.
- **Gradients**: The vectorizer produces **solid fills** per region. For smooth gradients you may need to reapply them in Illustrator or keep a raster layer.
- **Open paths**: The tracer outputs closed filled paths where possible. If you see open paths in Illustrator, use *Object → Path → Join* or clean up manually.
- **Edges and overlaps**: For sharp edges and clean overlaps, do final tweaks in Illustrator (Pathfinder, outline stroke, etc.) before sending to the RIP.

## Technical notes

- **Utility:** `admin-cms/src/utils/vectorizeImage.js` — uses **imagetracerjs** with options tuned for print (ltres, qtres, pathomit, roundcoords, numberofcolors, rightangleenhance).
- **Options** can be adjusted in that file (e.g. more/fewer colors, smoother vs. sharper curves) to match your print process.
