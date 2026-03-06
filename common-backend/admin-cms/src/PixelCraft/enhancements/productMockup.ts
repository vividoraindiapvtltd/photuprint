/**
 * Live product mockups: render personalized design onto 3D product images.
 * P0 feature - high business impact.
 */

import { useEffect, useRef } from 'react';
import { fabric } from 'fabric';
import type { TemplateArea } from '../editor/types';
import { mergeVariables } from '../render/variableMerger';

export interface ProductMockupConfig {
  productType: string; // 'tshirt', 'mug', 'poster'
  view: 'front' | 'back' | 'side';
  designArea: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  mockupImageUrl: string;
}

export const mockupConfigs: Record<string, Record<string, Omit<ProductMockupConfig, 'productType' | 'view'>>> = {
  tshirt: {
    front: {
      designArea: { x: 200, y: 150, width: 400, height: 500 },
      mockupImageUrl: '/mockups/tshirt_front.png',
    },
    back: {
      designArea: { x: 200, y: 150, width: 400, height: 500 },
      mockupImageUrl: '/mockups/tshirt_back.png',
    },
  },
  mug: {
    front: {
      designArea: { x: 150, y: 100, width: 300, height: 200 },
      mockupImageUrl: '/mockups/mug_front.png',
    },
  },
  poster: {
    front: {
      designArea: { x: 0, y: 0, width: 800, height: 1200 },
      mockupImageUrl: '/mockups/poster_front.png',
    },
  },
};

export interface UseProductMockupOptions {
  area: TemplateArea;
  variableValues: Record<string, string>;
  productType: string;
  view?: 'front' | 'back' | 'side';
  canvasWidth?: number;
  canvasHeight?: number;
}

export function useProductMockup(options: UseProductMockupOptions) {
  const { area, variableValues, productType, view = 'front', canvasWidth = 800, canvasHeight = 800 } = options;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<fabric.Canvas | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const config = mockupConfigs[productType]?.[view];
    if (!config) {
      console.error(`No mockup config for ${productType}/${view}`);
      return;
    }

    const canvas = new fabric.Canvas(canvasRef.current, {
      width: canvasWidth,
      height: canvasHeight,
      selection: false,
    });

    fabricRef.current = canvas;

    // Load mockup image
    fabric.Image.fromURL(config.mockupImageUrl, (mockupImg) => {
      // Scale mockup to fit canvas
      const scaleX = canvasWidth / mockupImg.width!;
      const scaleY = canvasHeight / mockupImg.height!;
      const scale = Math.min(scaleX, scaleY);

      canvas.setBackgroundImage(mockupImg, canvas.renderAll.bind(canvas), {
        scaleX: scale,
        scaleY: scale,
        originX: 'left',
        originY: 'top',
      });

      // Render user design on top
      renderUserDesignOnMockup(canvas, area, variableValues, config.designArea);
    });

    return () => {
      canvas.dispose();
      fabricRef.current = null;
    };
  }, [area, variableValues, productType, view, canvasWidth, canvasHeight]);

  return { canvasRef };
}

async function renderUserDesignOnMockup(
  canvas: fabric.Canvas,
  area: TemplateArea,
  variableValues: Record<string, string>,
  designArea: { x: number; y: number; width: number; height: number }
) {
  // Merge variable values
  const mergedArea = mergeVariables(area, variableValues);

  // Calculate scale: template canvas → design area
  const scaleX = designArea.width / area.canvas.width;
  const scaleY = designArea.height / area.canvas.height;

  // Render layers
  const layerOrder = mergedArea.layerOrder ?? Object.keys(mergedArea.layers);
  for (const layerId of layerOrder) {
    const layer = mergedArea.layers[layerId];
    if (!layer) continue;

    const x = designArea.x + layer.transform.left * scaleX;
    const y = designArea.y + layer.transform.top * scaleY;
    const w = layer.transform.width * (layer.transform.scaleX ?? 1) * scaleX;
    const h = layer.transform.height * (layer.transform.scaleY ?? 1) * scaleY;

    if (layer.type === 'text') {
      const text = new fabric.Textbox(layer.content, {
        left: x,
        top: y,
        width: w,
        height: h,
        fontFamily: layer.style.fontFamily,
        fontSize: layer.style.fontSize * scaleY,
        fill: layer.style.fill,
        textAlign: layer.style.textAlign,
      });
      canvas.add(text);
    } else if (layer.type === 'image') {
      fabric.Image.fromURL(layer.src, (img) => {
        img.set({ left: x, top: y, scaleX: w / img.width!, scaleY: h / img.height! });
        canvas.add(img);
      });
    }
  }

  canvas.requestRenderAll();
}
