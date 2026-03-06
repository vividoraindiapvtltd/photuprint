/**
 * Real-time preview: instant client-side rendering as user types/uploads.
 * P0 feature - high business impact.
 */

import { useEffect, useRef, useState } from 'react';
import { fabric } from 'fabric';
import type { TemplateArea } from '../editor/types';
import { deserializeToCanvas } from '../editor/lib/deserialize';
import { mergeVariables } from '../render/variableMerger';

const PREVIEW_DEBOUNCE_MS = 150;

export interface UseRealTimePreviewOptions {
  area: TemplateArea;
  variableValues: Record<string, string>;
  canvasWidth?: number;
  canvasHeight?: number;
}

export function useRealTimePreview(options: UseRealTimePreviewOptions) {
  const { area, variableValues, canvasWidth, canvasHeight } = options;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<fabric.Canvas | null>(null);
  const [isReady, setIsReady] = useState(false);
  const updateTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize Fabric canvas
  useEffect(() => {
    if (!canvasRef.current) return;

    const width = canvasWidth ?? area.canvas.width;
    const height = canvasHeight ?? area.canvas.height;

    const canvas = new fabric.Canvas(canvasRef.current, {
      width,
      height,
      renderOnAddRemove: true,
      selection: false, // Preview is read-only
    });

    fabricRef.current = canvas;
    setIsReady(true);

    return () => {
      canvas.dispose();
      fabricRef.current = null;
      setIsReady(false);
    };
  }, [area.canvas.width, area.canvas.height, canvasWidth, canvasHeight]);

  // Update preview when variableValues change (debounced)
  useEffect(() => {
    if (!fabricRef.current || !isReady) return;

    // Clear previous timer
    if (updateTimerRef.current) {
      clearTimeout(updateTimerRef.current);
    }

    // Schedule update
    updateTimerRef.current = setTimeout(async () => {
      if (!fabricRef.current) return;

      try {
        // Merge variable values into template
        const mergedArea = mergeVariables(area, variableValues);

        // Clear canvas
        fabricRef.current.clear();

        // Load merged template
        await deserializeToCanvas(fabricRef.current, mergedArea, fabric as any);
        fabricRef.current.requestRenderAll();
      } catch (error) {
        console.error('Preview update failed:', error);
      }
    }, PREVIEW_DEBOUNCE_MS);

    return () => {
      if (updateTimerRef.current) {
        clearTimeout(updateTimerRef.current);
      }
    };
  }, [area, variableValues, isReady]);

  return { canvasRef, isReady };
}
