/**
 * React hook: initialize Fabric canvas with DPI-aware spec and cleanup on unmount.
 * Pass fabric from 'fabric' package and createCanvasWithFabric from lib/fabricCanvas.
 */

import { useEffect, useRef, useState } from 'react';
import type { CanvasSpec } from '../types';
import type { FabricCanvas } from '../lib/fabricCanvas';

export interface UseFabricCanvasOptions {
  createCanvas: (
    element: HTMLCanvasElement,
    spec: CanvasSpec,
    fabricNs: unknown,
    options?: object
  ) => FabricCanvas;
  fabric: unknown;
  spec: CanvasSpec | null;
}

export function useFabricCanvas(
  spec: CanvasSpec | null,
  createCanvas: UseFabricCanvasOptions['createCanvas'],
  fabricNs: UseFabricCanvasOptions['fabric']
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fabricRef = useRef<FabricCanvas | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!spec || !fabricNs || !canvasRef.current) return;
    const el = canvasRef.current;
    const canvas = createCanvas(el, spec, fabricNs as any);
    fabricRef.current = canvas;
    setReady(true);
    return () => {
      canvas.dispose();
      fabricRef.current = null;
      setReady(false);
    };
  }, [spec?.width, spec?.height, createCanvas, fabricNs]);

  return { canvasRef, fabricRef, ready };
}
