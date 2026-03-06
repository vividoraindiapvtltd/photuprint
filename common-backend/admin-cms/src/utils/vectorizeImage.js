/**
 * Vectorize a raster image into a print-ready SVG suitable for DTF and sublimation.
 * - Smooth Bézier curves with minimal anchor points
 * - Solid fills, clean paths; reduces noise and artifacts
 * - Output compatible with Adobe Illustrator and RIP software
 * - For EPS: open SVG in Illustrator and Save As EPS
 * - For CMYK: convert in Illustrator or RIP (SVG uses sRGB; RIP can map to CMYK)
 *
 * @param {string} imageDataUrl - Data URL of the image (e.g. from canvas.toDataURL('image/png'))
 * @returns {Promise<string>} SVG string
 */
export function vectorizeImageToSVG(imageDataUrl) {
  return new Promise((resolve, reject) => {
    if (!imageDataUrl || typeof imageDataUrl !== "string") {
      reject(new Error("vectorizeImageToSVG requires an image data URL"))
      return
    }
    import("imagetracerjs")
      .then((mod) => {
        const ImageTracer = mod.default || mod
        if (!ImageTracer || typeof ImageTracer.imageToSVG !== "function") {
          reject(new Error("imagetracerjs did not export imageToSVG"))
          return
        }
        // Print-ready options: smooth curves, minimal points, solid fills, reduced noise
        const options = {
          // Smooth Bézier curves (lower = smoother, fewer points)
          ltres: 0.5,
          qtres: 0.5,
          // Omit tiny paths (reduces raster noise and compression artifacts)
          pathomit: 12,
          // Round coordinates for cleaner paths and smaller file
          roundcoords: 2,
          // Sharp edges where appropriate
          rightangleenhance: true,
          // Solid fills: limit palette for vibrant, clean output (good for heat transfer)
          numberofcolors: 24,
          mincolorratio: 0.02,
          // Slight blur to reduce noise before tracing (then sharp paths)
          blurradius: 0.5,
          blurdelta: 20,
          // Scale 1:1 for print dimensions
          scale: 1,
        }
        ImageTracer.imageToSVG(
          imageDataUrl,
          (svgString) => {
            if (!svgString || typeof svgString !== "string") {
              reject(new Error("Vectorization produced no SVG"))
              return
            }
            // Prepend comment for CMYK/RIP workflow (open in Illustrator for CMYK or Save As EPS)
            const comment =
              "<!-- Print-ready vector: DTF/sublimation. Open in Illustrator for CMYK or Save As EPS. -->"
            resolve(comment + "\n" + svgString)
          },
          options
        )
      })
      .catch((err) => reject(err))
  })
}
