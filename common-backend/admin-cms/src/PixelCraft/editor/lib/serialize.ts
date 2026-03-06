/**
 * Serialize Fabric canvas state to Prompt 2 TemplateArea JSON.
 * Each Fabric object must have layerId, editable, variableId, layerType (set in editor or deserialize).
 */

import type {
  TemplateArea,
  TemplateLayer,
  CanvasSpec,
  TextLayer,
  ImageLayer,
  ShapeLayer,
  LayerTransform,
  TextStyle,
} from '../types';
import type { FabricCanvas, FabricObject } from './fabricCanvas';

function getTransform(obj: FabricObject): LayerTransform {
  const left = (obj.left as number) ?? 0;
  const top = (obj.top as number) ?? 0;
  const scaleX = (obj.scaleX as number) ?? 1;
  const scaleY = (obj.scaleY as number) ?? 1;
  const w = ((obj.width as number) ?? 0) * scaleX;
  const h = ((obj.height as number) ?? 0) * scaleY;
  return {
    left,
    top,
    width: w,
    height: h,
    scaleX,
    scaleY,
    angle: (obj.angle as number) ?? 0,
    originX: (obj.originX as LayerTransform['originX']) ?? 'left',
    originY: (obj.originY as LayerTransform['originY']) ?? 'top',
  };
}

function getMeta(obj: FabricObject): { layerId: string; editable: boolean; variableId?: string; layerType?: string } {
  const layerId = (obj.get?.('layerId') as string) ?? (obj.name as string) ?? `obj_${(obj.uid as string) ?? Math.random().toString(36).slice(2)}`;
  const editable = (obj.get?.('editable') as boolean) ?? true;
  const variableId = obj.get?.('variableId') as string | undefined;
  const layerType = obj.get?.('layerType') as string | undefined;
  return { layerId, editable, variableId, layerType };
}

function serializeText(obj: FabricObject, layerId: string, order: number, editable: boolean, variableId?: string): TextLayer {
  return {
    id: layerId,
    type: 'text',
    editable,
    order,
    transform: getTransform(obj),
    content: (obj.text as string) ?? '',
    variableId: variableId || undefined,
    style: {
      fontFamily: (obj.fontFamily as string) ?? 'Arial',
      fontSize: (obj.fontSize as number) ?? 16,
      fontWeight: obj.fontWeight as TextStyle['fontWeight'],
      fontStyle: (obj.fontStyle === 'italic' ? 'italic' : 'normal') as 'normal' | 'italic',
      textAlign: (obj.textAlign as TextStyle['textAlign']) ?? 'left',
      fill: (typeof obj.fill === 'string' ? obj.fill : '#000000') as string,
    },
  };
}

function serializeImage(obj: FabricObject, layerId: string, order: number, editable: boolean, variableId?: string): ImageLayer {
  const src = (obj._element?.src as string) ?? '';
  return {
    id: layerId,
    type: 'image',
    editable,
    order,
    transform: getTransform(obj),
    src,
    variableId: variableId || undefined,
  };
}

function serializeShape(obj: FabricObject, layerId: string, order: number, editable: boolean, variableId?: string): ShapeLayer {
  const kind = (obj.type as ShapeLayer['kind']) ?? 'rect';
  return {
    id: layerId,
    type: 'shape',
    editable,
    order,
    transform: getTransform(obj),
    kind: kind === 'i-text' || kind === 'textbox' ? 'rect' : kind,
    fill: (obj.get?.('fill') as string) ?? '#cccccc',
    stroke: obj.get?.('stroke') as string | undefined,
    strokeWidth: obj.get?.('strokeWidth') as number | undefined,
    variableId: variableId || undefined,
  };
}

/**
 * Serialize current canvas to one TemplateArea (Prompt 2 schema).
 * Use getCanvasSpec(canvas) for canvasSpec or pass from template.
 */
export function serializeCanvas(
  canvas: FabricCanvas,
  areaId: string,
  label: string,
  canvasSpec: CanvasSpec
): TemplateArea {
  const objects = canvas.getObjects() as FabricObject[];
  const layerOrder: string[] = [];
  const layers: Record<string, TemplateLayer> = {};

  objects.forEach((obj, index) => {
    const { layerId, editable, variableId, layerType } = getMeta(obj);
    layerOrder.push(layerId);

    const type = layerType ?? obj.type;
    let layer: TemplateLayer;

    if (type === 'text' || obj.type === 'textbox' || obj.type === 'text') {
      layer = serializeText(obj, layerId, index, editable, variableId);
    } else if (type === 'image' || obj.type === 'image') {
      layer = serializeImage(obj, layerId, index, editable, variableId);
    } else {
      layer = serializeShape(obj, layerId, index, editable, variableId);
    }

    layers[layerId] = layer;
  });

  return {
    id: areaId,
    label,
    canvas: canvasSpec,
    layerOrder,
    layers,
  };
}
