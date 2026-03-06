/**
 * Deserialize Prompt 2 TemplateArea JSON into Fabric canvas.
 * Creates Fabric objects (text, image, shape), sets layerId, editable, variableId, and adds in layerOrder.
 *
 * Usage: import { fabric } from 'fabric'; then use fabric types in implementation.
 * This module is database/engine agnostic; pass a canvas that implements add/clear and object factory.
 */

import type { TemplateArea, TemplateLayer, TextLayer, ImageLayer, ShapeLayer } from '../types';
import type { FabricCanvas, FabricObject } from './fabricCanvas';

export interface FabricFactory {
  Textbox: new (text: string, options?: object) => FabricObject;
  FabricImage: { fromURL: (url: string, callback: (img: FabricObject | null) => void) => void };
  Rect: new (options?: object) => FabricObject;
}

function applyTransform(obj: FabricObject, t: TemplateLayer['transform']): void {
  obj.set({
    left: t.left,
    top: t.top,
    width: t.width,
    height: t.height,
    scaleX: t.scaleX ?? 1,
    scaleY: t.scaleY ?? 1,
    angle: t.angle ?? 0,
    originX: t.originX ?? 'left',
    originY: t.originY ?? 'top',
  });
}

function setObjectMeta(
  obj: FabricObject,
  layerId: string,
  editable: boolean,
  variableId?: string,
  layerType?: string
): void {
  obj.set({
    name: layerId,
    layerId,
    editable,
    variableId: variableId ?? undefined,
    layerType,
  });
  if (!editable) {
    obj.set({
      lockMovementX: true,
      lockMovementY: true,
      lockRotation: true,
      lockScalingX: true,
      lockScalingY: true,
    });
  }
}

/**
 * Load image from URL and return as FabricObject (resolve in callback).
 * In real app: fabric.FabricImage.fromURL(url, callback).
 */
export function loadImageAsync(
  url: string,
  factory: FabricFactory
): Promise<FabricObject> {
  return new Promise((resolve, reject) => {
    factory.FabricImage.fromURL(url, (img) => {
      if (img) resolve(img);
      else reject(new Error(`Failed to load image: ${url}`));
    });
  });
}

/**
 * Deserialize one TemplateArea into the canvas.
 * Clears canvas, then creates and adds objects in layerOrder.
 * Pass fabric namespace for Textbox/FabricImage/Rect when using real Fabric.js.
 */
export async function deserializeToCanvas(
  canvas: FabricCanvas,
  area: TemplateArea,
  factory: FabricFactory
): Promise<void> {
  canvas.clear();
  const order = area.layerOrder ?? Object.keys(area.layers ?? {});
  const layers = area.layers ?? {};

  for (const layerId of order) {
    const layer = layers[layerId];
    if (!layer) continue;

    let obj: FabricObject | null = null;

    if (layer.type === 'text') {
      const t = layer as TextLayer;
      obj = new factory.Textbox(t.content, {
        width: t.transform.width,
        height: t.transform.height,
        fontFamily: t.style.fontFamily,
        fontSize: t.style.fontSize,
        fontWeight: t.style.fontWeight,
        fontStyle: t.style.fontStyle,
        textAlign: t.style.textAlign,
        fill: t.style.fill,
      });
      applyTransform(obj, t.transform);
    } else if (layer.type === 'image') {
      const imgLayer = layer as ImageLayer;
      obj = await loadImageAsync(imgLayer.src, factory);
      obj.set({ width: imgLayer.transform.width, height: imgLayer.transform.height });
      applyTransform(obj, imgLayer.transform);
    } else if (layer.type === 'shape') {
      const s = layer as ShapeLayer;
      obj = new factory.Rect({
        width: s.transform.width,
        height: s.transform.height,
        fill: s.fill ?? '#cccccc',
        stroke: s.stroke,
        strokeWidth: s.strokeWidth,
      });
      applyTransform(obj, s.transform);
    }

    if (obj) {
      setObjectMeta(obj, layer.id, layer.editable, layer.variableId, layer.type);
      canvas.add(obj);
    }
  }

  canvas.requestRenderAll();
}
