# Prompt 4: Admin Canvas Editor (Fabric.js)

## Admin Template Editor: React + TypeScript + Fabric.js + Next.js App Router

This document describes the **component structure**, **Fabric.js setup**, **serialization/deserialization** to the template JSON (Prompt 2), and **design decisions** for the Admin Template Editor.

**Features:** Canvas init with DPI awareness, add/edit text and image layers, lock/unlock, define editable fields, layer panel, alignment guides, zoom/pan, undo/redo, autosave to JSON.

---

## 1. Component structure

```
app/
  (dashboard)/
    templates/
      [id]/
        edit/
          page.tsx                 # Route: load template, render TemplateEditorLayout

components/
  template-editor/
    TemplateEditorLayout.tsx        # Layout: toolbar + layer panel + canvas area
    TemplateEditor.tsx             # Canvas host + Fabric instance lifecycle
    CanvasStage.tsx                 # DOM wrapper for <canvas> (ref, resize)
    Toolbar.tsx                    # Add text/image, alignment, zoom controls, undo/redo
    LayerPanel.tsx                 # Layer list, reorder, lock, editable, variableId
    AlignmentGuides.tsx             # Snapping / guide lines (Fabric events or overlay)
    hooks/
      useFabricCanvas.ts           # Init Fabric.Canvas, DPI, cleanup
      useCanvasHistory.ts          # Undo/redo stack (canvas.toJSON/loadFromJSON)
      useZoomPan.ts                # Zoom, pan, fit-to-screen
    lib/
      fabricCanvas.ts              # createCanvas, default options, DPI scaling
      serialize.ts                 # Fabric → TemplateDocument (one area)
      deserialize.ts                # TemplateDocument (one area) → Fabric
    types.ts                       # Editor-specific types (extend Prompt 2 schema)
```

**Data flow:**

- **Load:** Route loads template version document → `deserialize(document.areas[areaId])` → Fabric canvas.
- **Edit:** User actions (add, move, lock, set variableId) update Fabric objects; custom props (`layerId`, `editable`, `variableId`) stored on Fabric objects.
- **Save:** `serialize(canvas, areaId, canvasSpec)` → partial TemplateArea → merge into full document → autosave (debounced) or explicit save.

---

## 2. Fabric.js setup code

### 2.1 Canvas initialization with DPI awareness

Design coordinates are in **logical units** (e.g. 1000×1000). Display uses a **scale factor** so the canvas fits the viewport while preserving aspect ratio; export/render uses **DPI** (e.g. 300) on the server.

**Principle:** Fabric canvas size = design size (width × height). CSS scales the canvas element for display. No pixel scaling inside Fabric for the editor; DPI is applied only at render time.

```typescript
// lib/fabricCanvas.ts
import { fabric } from 'fabric';

const DEFAULT_DPI = 300;

export interface CanvasSpec {
  width: number;
  height: number;
  dpi: number;
  bleed?: number;
  safeAreaInset?: number;
}

export function createCanvas(
  element: HTMLCanvasElement,
  spec: CanvasSpec,
  options?: Partial<fabric.ICanvasOptions>
): fabric.Canvas {
  const { width, height } = spec;

  const canvas = new fabric.Canvas(element, {
    width,
    height,
    selection: true,
    preserveObjectStacking: true,
    fireRightClick: true,
    stopContextMenu: true,
    controlsAboveOverlay: true,
    imageSmoothingEnabled: true,
    ...options,
  });

  // Store spec for serialization (logical size + DPI for backend)
  (canvas as fabric.Canvas & { __canvasSpec?: CanvasSpec }).__canvasSpec = spec;

  return canvas;
}

export function getCanvasSpec(canvas: fabric.Canvas): CanvasSpec | undefined {
  return (canvas as fabric.Canvas & { __canvasSpec?: CanvasSpec }).__canvasSpec;
}
```

**Display scaling (CSS):** The parent of the canvas sets a max width/height; the canvas element is sized to `width` × `height` in pixels (logical units = pixels at 1:1 in editor). A wrapper scales it for fit-to-view:

```tsx
// CanvasStage.tsx – wrapper scales canvas to fit container
<div className="canvas-stage" ref={containerRef} style={{ overflow: 'hidden' }}>
  <canvas ref={canvasRef} />
</div>

// CSS or inline: scale transform based on container size vs canvas width/height
// e.g. transform: scale(min(containerWidth/width, containerHeight/height))
```

### 2.2 Custom properties on Fabric objects (lock, editable, variableId)

Fabric objects carry our schema fields so serialization can read them:

```typescript
// types.ts – extended Fabric object
export interface FabricObjectWithMeta extends fabric.Object {
  layerId?: string;
  editable?: boolean;
  variableId?: string;
  layerType?: 'text' | 'image' | 'shape';
}
```

Set these when creating or loading objects:

```typescript
function setObjectMeta(obj: fabric.Object, meta: { layerId: string; editable: boolean; variableId?: string; layerType: string }) {
  obj.set({ ...meta });
  obj.setControlsVisibility({ mtr: true });
  if (!meta.editable) {
    obj.set({ lockMovementX: true, lockMovementY: true, lockRotation: true, lockScalingX: true, lockScalingY: true });
  }
}
```

### 2.3 Hook: useFabricCanvas (init, DPI, cleanup)

```typescript
// hooks/useFabricCanvas.ts
import { useEffect, useRef, useState } from 'react';
import { fabric } from 'fabric';
import { createCanvas, CanvasSpec } from '../lib/fabricCanvas';

export function useFabricCanvas(spec: CanvasSpec | null) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<fabric.Canvas | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!spec || !canvasRef.current) return;
    const canvas = createCanvas(canvasRef.current, spec);
    fabricRef.current = canvas;
    setReady(true);
    return () => {
      canvas.dispose();
      fabricRef.current = null;
      setReady(false);
    };
  }, [spec?.width, spec?.height]); // re-init only when design size changes

  return { canvasRef, fabricRef, ready };
}
```

---

## 3. Serialize / deserialize: Canvas ↔ Template JSON

### 3.1 Fabric → Template JSON (serialize)

Convert current Fabric canvas state to one **TemplateArea** (Prompt 2 schema). Layer order = canvas.getObjects() bottom-to-top; each object must have `layerId`, `editable`, `variableId`, `layerType`.

```typescript
// lib/serialize.ts
import { fabric } from 'fabric';
import type { TemplateArea, TemplateLayer, CanvasSpec, TextLayer, ImageLayer, ShapeLayer, LayerTransform } from './types';

function getTransform(obj: fabric.Object): LayerTransform {
  const left = obj.left ?? 0;
  const top = obj.top ?? 0;
  const scaleX = obj.scaleX ?? 1;
  const scaleY = obj.scaleY ?? 1;
  const w = (obj.width ?? 0) * scaleX;
  const h = (obj.height ?? 0) * scaleY;
  return {
    left,
    top,
    width: w,
    height: h,
    scaleX,
    scaleY,
    angle: obj.angle ?? 0,
    originX: obj.originX ?? 'left',
    originY: obj.originY ?? 'top',
  };
}

function serializeText(obj: fabric.Textbox | fabric.Text): Partial<TextLayer> {
  const meta = obj as fabric.Object & { layerId?: string; editable?: boolean; variableId?: string };
  return {
    id: meta.layerId ?? obj.name ?? `text_${obj.uid}`,
    type: 'text',
    editable: meta.editable ?? true,
    order: 0, // set from index
    transform: getTransform(obj),
    content: obj.text ?? '',
    variableId: meta.variableId,
    style: {
      fontFamily: obj.fontFamily ?? 'Arial',
      fontSize: obj.fontSize ?? 16,
      fontWeight: obj.fontWeight,
      fontStyle: obj.fontStyle === 'italic' ? 'italic' : 'normal',
      textAlign: (obj.textAlign as 'left' | 'center' | 'right') ?? 'left',
      fill: typeof obj.fill === 'string' ? obj.fill : '#000000',
    },
  };
}

function serializeImage(obj: fabric.FabricImage): Partial<ImageLayer> {
  const meta = obj as fabric.Object & { layerId?: string; editable?: boolean; variableId?: string };
  const src = (obj as fabric.FabricImage & { _element?: HTMLImageElement })._element?.src ?? '';
  return {
    id: meta.layerId ?? obj.name ?? `img_${obj.uid}`,
    type: 'image',
    editable: meta.editable ?? true,
    order: 0,
    transform: getTransform(obj),
    src,
    variableId: meta.variableId,
  };
}

export function serializeCanvas(
  canvas: fabric.Canvas,
  areaId: string,
  label: string,
  canvasSpec: CanvasSpec
): TemplateArea {
  const objects = canvas.getObjects();
  const layerOrder: string[] = [];
  const layers: Record<string, TemplateLayer> = {};

  objects.forEach((obj, index) => {
    const meta = obj as fabric.Object & { layerId?: string; editable?: boolean; variableId?: string; layerType?: string };
    const layerId = meta.layerId ?? `${meta.layerType ?? 'obj'}_${index}`;
    layerOrder.push(layerId);

    let layer: TemplateLayer;
    if (obj.type === 'textbox' || obj.type === 'text') {
      layer = { ...serializeText(obj as fabric.Textbox), id: layerId, order: index } as TextLayer;
    } else if (obj.type === 'image') {
      layer = { ...serializeImage(obj as fabric.FabricImage), id: layerId, order: index } as ImageLayer;
    } else {
      layer = {
        id: layerId,
        type: 'shape',
        editable: meta.editable ?? true,
        order: index,
        transform: getTransform(obj),
        kind: (obj.type as 'rect') ?? 'rect',
        fill: (obj as fabric.Rect).fill as string,
      } as ShapeLayer;
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
```

### 3.2 Template JSON → Fabric (deserialize)

Load one **TemplateArea** into an empty Fabric canvas: create Fabric objects from layers, set custom props, add in layerOrder.

```typescript
// lib/deserialize.ts
import { fabric } from 'fabric';
import type { TemplateArea, TemplateLayer, TextLayer, ImageLayer } from './types';

function applyTransform(obj: fabric.Object, t: TemplateLayer['transform']) {
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

async function loadImage(src: string): Promise<fabric.FabricImage> {
  return new Promise((resolve, reject) => {
    fabric.FabricImage.fromURL(src, (img) => {
      if (img) resolve(img);
      else reject(new Error('Failed to load image'));
    });
  });
}

export async function deserializeToCanvas(canvas: fabric.Canvas, area: TemplateArea): Promise<void> {
  canvas.clear();
  const order = area.layerOrder ?? Object.keys(area.layers);
  const layers = area.layers ?? {};

  for (const layerId of order) {
    const layer = layers[layerId];
    if (!layer) continue;

    let obj: fabric.Object | null = null;

    if (layer.type === 'text') {
      const t = layer as TextLayer;
      obj = new fabric.Textbox(t.content, {
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
      const img = await loadImage(imgLayer.src);
      img.set({ width: imgLayer.transform.width, height: imgLayer.transform.height });
      applyTransform(img, imgLayer.transform);
      obj = img;
    }
    // shape: fabric.Rect, etc.

    if (obj) {
      obj.set({
        name: layerId,
        layerId,
        editable: layer.editable,
        variableId: layer.variableId,
        layerType: layer.type,
      });
      if (!layer.editable) {
        obj.set({ lockMovementX: true, lockMovementY: true, lockRotation: true, lockScalingX: true, lockScalingY: true });
      }
      canvas.add(obj);
    }
  }

  canvas.requestRenderAll();
}
```

---

## 4. Feature summary and design decisions

| Feature | Approach | Design decision |
|--------|----------|------------------|
| **Canvas init** | `createCanvas(element, spec)` with width/height = design size | Logical units = canvas dimensions; DPI stored in spec and used only at server render. |
| **DPI awareness** | Spec has `dpi`; editor does not scale by DPI | Prevents huge canvas in browser; 300 DPI applied in render service. |
| **Add text/image** | Toolbar adds Fabric Textbox or Image.fromURL | New objects get unique `layerId`, `editable: true`; optional `variableId` in layer panel. |
| **Lock/unlock** | Toggle on object: `lockMovementX/Y`, `lockRotation`, `lockScalingX/Y` | Stored as `editable: boolean` in template JSON; admin can unlock. |
| **Editable fields** | `variableId` on object; layer panel shows input for variableId | Serialized into template; user editor only edits objects with variableId. |
| **Layer panel** | List = `canvas.getObjects()`; reorder via array swap + canvas.remove/add | Order = `layerOrder` in JSON; panel reflects stack (bottom → top). |
| **Alignment guides** | Fabric events (object:moving, object:scaling) + snap to other objects or grid | Optional overlay or Fabric’s built-in; snap thresholds in logical units. |
| **Zoom/pan** | Zoom = canvas.setZoom(); pan = canvas.relativePan() or viewportTransform | Fit-to-view = scale container or canvas zoom so full design visible. |
| **Undo/redo** | History stack of canvas.toJSON(); undo = loadFromJSON(prev) | Full canvas state; limit stack size (e.g. 50); merge object:modified for granularity optional. |
| **Autosave** | Debounce (e.g. 2s) after object:modified; serialize → PATCH template version | Draft document updated in DB; explicit “Publish” creates new version. |

### 4.1 Why logical units in the editor

- **Consistency:** Same numbers in editor and template JSON; no confusion between “design” and “screen” pixels.
- **Performance:** Avoid multi-thousand-pixel canvas in the browser; keep e.g. 1000×1000.
- **Print:** Server multiplies by (dpi/72) or similar to get physical size; DPI lives in spec only.

### 4.2 Why custom props on Fabric objects

- **Single source of truth:** Template JSON is the contract; Fabric is the editing view. Serialize reads `layerId`, `editable`, `variableId` from objects so round-trip is lossless.
- **No separate “meta” store:** Avoid syncing a separate layer list with Fabric; one place (Fabric objects) holds both geometry and schema fields.

### 4.3 Why one area at a time in the editor

- **Simplicity:** One Fabric canvas per area (front/back); switch area = load another area’s JSON into the same canvas component.
- **Multi-area:** Template document still has `areas`; serialize/deserialize work on one `TemplateArea`; parent component merges into full document.

### 4.4 Undo/redo and autosave

- **Undo:** Push `canvas.toJSON()` before each change; pop on undo and `canvas.loadFromJSON()`. Restore custom props after load if Fabric strips them.
- **Autosave:** On `object:modified` (and add/remove), debounce then `serializeCanvas()` → merge into document → API save. Reduces writes while keeping draft safe.

---

## 5. File layout (reference implementation)

Code for the above lives under `PixelCraft/editor/`:

| File | Purpose |
|------|--------|
| **types.ts** | Editor/template types (Prompt 2 schema: CanvasSpec, TemplateArea, TextLayer, ImageLayer, ShapeLayer, etc.) |
| **lib/fabricCanvas.ts** | `createCanvasWithFabric(element, spec, fabric)`, `getCanvasSpec(canvas)` – DPI-aware init |
| **lib/serialize.ts** | `serializeCanvas(canvas, areaId, label, canvasSpec)` → `TemplateArea` |
| **lib/deserialize.ts** | `deserializeToCanvas(canvas, area, factory)` – load TemplateArea into Fabric |
| **hooks/useFabricCanvas.ts** | Init Fabric canvas from spec, cleanup on unmount |
| **hooks/useCanvasHistory.ts** | Undo/redo stack (canvas.toJSON / loadFromJSON) |
| **index.ts** | Public exports |

**Not yet implemented (structure only):** `useZoomPan.ts`, `TemplateEditor.tsx`, `LayerPanel.tsx`, `Toolbar.tsx`, `AlignmentGuides.tsx`. Use the patterns in this doc and the serialize/deserialize examples to build them.

**Usage (Next.js):** Install `fabric`, then:

```ts
import { fabric } from 'fabric';
import { createCanvasWithFabric, getCanvasSpec, serializeCanvas, deserializeToCanvas } from '@/PixelCraft/editor';
const canvas = createCanvasWithFabric(canvasEl, spec, fabric);
await deserializeToCanvas(canvas, area, fabric);
const areaJson = serializeCanvas(canvas, area.id, area.label, getCanvasSpec(canvas)!);
```

Next.js App Router page: `app/(dashboard)/templates/[id]/edit/page.tsx` loads template version, passes area and spec to `TemplateEditorLayout`, which renders toolbar + layer panel + canvas. Save/autosave calls API with serialized document.

This design keeps the Admin Canvas Editor aligned with the template JSON schema (Prompt 2), the architecture (Prompt 1), and the DB schema (Prompt 3).
