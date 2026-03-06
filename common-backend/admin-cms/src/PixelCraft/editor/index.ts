/**
 * PixelCraft Admin Canvas Editor
 * React + TypeScript + Fabric.js + Next.js App Router
 *
 * Install: npm install fabric
 * Use createCanvasWithFabric(element, spec, fabric) and pass fabric from 'fabric'.
 */

export * from './types';
export { createCanvasWithFabric, getCanvasSpec } from './lib/fabricCanvas';
export type { CanvasSpec as FabricCanvasSpec, CreateCanvasOptions, FabricCanvas, FabricObject } from './lib/fabricCanvas';
export { serializeCanvas } from './lib/serialize';
export { deserializeToCanvas, loadImageAsync } from './lib/deserialize';
export type { FabricFactory } from './lib/deserialize';
export { useFabricCanvas } from './hooks/useFabricCanvas';
export { useCanvasHistory } from './hooks/useCanvasHistory';
