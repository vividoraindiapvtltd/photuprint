/**
 * PDF exporter: combine PNG buffers into multi-page PDF.
 * Uses pdfkit for PDF generation.
 */

import PDFDocument from 'pdfkit';
import type { TemplateArea } from '../editor/types';

export interface PDFOptions {
  physicalWidthMm: number;
  physicalHeightMm: number;
  dpi?: number;
}

/**
 * Generate PDF from PNG buffers (one per area).
 * Returns PDF buffer.
 */
export function generatePDF(
  pngs: Record<string, Buffer>,
  areaOrder: string[],
  options: PDFOptions
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const { physicalWidthMm, physicalHeightMm, dpi = 300 } = options;

    // Convert mm to points (1 point = 1/72 inch, 1 inch = 25.4 mm)
    const widthPt = (physicalWidthMm / 25.4) * 72;
    const heightPt = (physicalHeightMm / 25.4) * 72;

    const doc = new PDFDocument({
      size: [widthPt, heightPt],
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      autoFirstPage: false,
    });

    const buffers: Buffer[] = [];

    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    // Add pages in order
    areaOrder.forEach((areaId, index) => {
      const png = pngs[areaId];
      if (!png) {
        console.warn(`PNG not found for area: ${areaId}`);
        return;
      }

      if (index > 0) {
        doc.addPage({ size: [widthPt, heightPt], margins: { top: 0, bottom: 0, left: 0, right: 0 } });
      } else {
        doc.addPage({ size: [widthPt, heightPt], margins: { top: 0, bottom: 0, left: 0, right: 0 } });
      }

      // Embed PNG image at full page size
      doc.image(png, {
        fit: [widthPt, heightPt],
        align: 'center',
        valign: 'center',
      });
    });

    doc.end();
  });
}

/**
 * Generate PDF from TemplateArea array (render areas first, then combine).
 * This is a convenience function that combines rendering + PDF generation.
 */
export async function generatePDFFromAreas(
  areas: TemplateArea[],
  areaOrder: string[],
  variableValues: Record<string, string>,
  options: PDFOptions & { renderArea: (area: TemplateArea, opts: { dpi: number }) => Promise<Buffer> }
): Promise<Buffer> {
  const pngs: Record<string, Buffer> = {};

  // Render each area
  for (const areaId of areaOrder) {
    const area = areas.find((a) => a.id === areaId);
    if (!area) continue;

    // Merge variables (if you have variableMerger)
    // const mergedArea = mergeVariables(area, variableValues);
    const png = await options.renderArea(area, { dpi: options.dpi ?? 300 });
    pngs[areaId] = png;
  }

  // Generate PDF
  return generatePDF(pngs, areaOrder, options);
}
