/**
 * Editor types aligned with Prompt 2 template JSON schema.
 * Use these for serialization/deserialization and Fabric object metadata.
 */

export type LayerType = 'text' | 'image' | 'shape';

export interface LayerTransform {
  left: number;
  top: number;
  width: number;
  height: number;
  scaleX?: number;
  scaleY?: number;
  angle?: number;
  originX?: 'left' | 'center' | 'right';
  originY?: 'top' | 'center' | 'bottom';
}

export interface TextStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight?: number | string;
  fontStyle?: 'normal' | 'italic';
  textAlign?: 'left' | 'center' | 'right';
  fill: string;
  lineHeight?: number;
  letterSpacing?: number;
}

export interface TextConstraints {
  maxLength?: number;
  allowedFonts?: string[];
  allowedColors?: string[];
  fontSizeMin?: number;
  fontSizeMax?: number;
}

export interface BaseLayer {
  id: string;
  type: LayerType;
  editable: boolean;
  order: number;
  transform: LayerTransform;
}

export interface TextLayer extends BaseLayer {
  type: 'text';
  content: string;
  variableId?: string;
  style: TextStyle;
  constraints?: TextConstraints;
}

export interface ImageLayer extends BaseLayer {
  type: 'image';
  src: string;
  variableId?: string;
  constraints?: {
    minWidth?: number;
    minHeight?: number;
    maxWidth?: number;
    maxHeight?: number;
    aspectRatio?: [number, number];
    allowedMimeTypes?: string[];
    maxFileSizeBytes?: number;
  };
}

export interface ShapeLayer extends BaseLayer {
  type: 'shape';
  kind: 'rect' | 'ellipse' | 'polygon' | 'line';
  points?: [number, number][];
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  variableId?: string;
}

export type TemplateLayer = TextLayer | ImageLayer | ShapeLayer;

export interface CanvasSpec {
  width: number;
  height: number;
  dpi: number;
  bleed?: number;
  safeAreaInset?: number;
  unit?: string;
}

export type TemplateAreaId = string;

export interface TemplateArea {
  id: TemplateAreaId;
  label: string;
  canvas: CanvasSpec;
  layerOrder: string[];
  layers: Record<string, TemplateLayer>;
}

/** Extended Fabric object with our schema fields (stored on object) */
export interface FabricObjectMeta {
  layerId?: string;
  editable?: boolean;
  variableId?: string;
  layerType?: LayerType;
}
