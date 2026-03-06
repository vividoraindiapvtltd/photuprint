/**
 * Fabric.js canvas initialization with DPI awareness.
 * Canvas size = design size (logical units). DPI is stored for server-side render only.
 *
 * Usage (Next.js/React): install fabric: npm install fabric
 *   import { fabric } from 'fabric';
 *   import { createCanvas, getCanvasSpec } from './lib/fabricCanvas';
 *   const canvas = createCanvasWithFabric(element, spec, fabric);
 */

export interface CanvasSpec {
  width: number;
  height: number;
  dpi: number;
  bleed?: number;
  safeAreaInset?: number;
  unit?: string;
}

export interface CreateCanvasOptions {
  selection?: boolean;
  preserveObjectStacking?: boolean;
  fireRightClick?: boolean;
  stopContextMenu?: boolean;
}

export type FabricCanvas = {
  getObjects: () => FabricObject[];
  add: (obj: FabricObject) => void;
  remove: (obj: FabricObject) => void;
  clear: () => void;
  requestRenderAll: () => void;
  dispose: () => void;
  loadFromJSON: (json: object, callback?: () => void) => void;
  toJSON: (propertiesToInclude?: string[]) => object;
};

export type FabricObject = {
  type: string;
  left?: number;
  top?: number;
  width?: number;
  height?: number;
  scaleX?: number;
  scaleY?: number;
  angle?: number;
  originX?: string;
  originY?: string;
  set: (props: Record<string, unknown>) => void;
  get: (key: string) => unknown;
  name?: string;
  uid?: string;
  text?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: string | number;
  fontStyle?: string;
  textAlign?: string;
  fill?: string;
  _element?: HTMLImageElement;
};

/**
 * Create a Fabric.Canvas with design dimensions (logical units).
 * Pass the fabric namespace from 'fabric' package.
 */
export function createCanvasWithFabric(
  element: HTMLCanvasElement,
  spec: CanvasSpec,
  fabricNs: { Canvas: new (el: HTMLCanvasElement, opts?: object) => FabricCanvas },
  options?: CreateCanvasOptions
): FabricCanvas {
  const { width, height } = spec;
  const canvas = new fabricNs.Canvas(element, {
    width,
    height,
    selection: options?.selection ?? true,
    preserveObjectStacking: options?.preserveObjectStacking ?? true,
    fireRightClick: options?.fireRightClick ?? true,
    stopContextMenu: options?.stopContextMenu ?? true,
    imageSmoothingEnabled: true,
  });
  (canvas as FabricCanvas & { __canvasSpec?: CanvasSpec }).__canvasSpec = spec;
  return canvas;
}

export function getCanvasSpec(canvas: FabricCanvas): CanvasSpec | undefined {
  return (canvas as FabricCanvas & { __canvasSpec?: CanvasSpec }).__canvasSpec;
}
