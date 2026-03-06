/**
 * PixelCraft Print-Ready Export System
 * Server-side rendering pipeline for templates and user designs.
 */

export { renderArea, type RenderOptions } from './canvasRenderer';
export { mergeVariables } from './variableMerger';
export { registerFonts, getFontFamily, isFontAvailable } from './fontManager';
export { generatePDF, generatePDFFromAreas, type PDFOptions } from './pdfExporter';
