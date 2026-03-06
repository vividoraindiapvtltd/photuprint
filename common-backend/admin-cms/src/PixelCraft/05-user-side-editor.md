# Prompt 5: User-Side Editor (Restricted Editing)

## User Personalization Editor: React + TypeScript + Fabric.js + Next.js App Router

This document describes the **component structure**, **editable vs non-editable logic**, **UX best practices**, and **mobile considerations** for the User Personalization Editor. End users can personalize only **permitted fields** (those with `variableId` and `editable: true`) from a published template.

**Features:** Load published template JSON, render with Fabric.js, restrict editing to permitted fields only, disable selection/movement/resizing for locked objects, simplified UI (text editor, image upload), mobile-optimized.

---

## 1. Component structure

```
app/
  (storefront)/
    personalize/
      [productId]/
        page.tsx                 # Route: load product + template, render PersonalizationEditor

components/
  personalization-editor/
    PersonalizationEditor.tsx    # Main component: canvas + editable fields panel
    RestrictedCanvas.tsx          # Fabric canvas wrapper: filters editable objects, locks others
    EditableFieldPanel.tsx       # Simplified UI: text inputs, image uploads, preview
    MobileCanvas.tsx             # Mobile-optimized canvas (touch, zoom, pan)
    PreviewPanel.tsx             # Live preview + "Add to cart"
    hooks/
      useRestrictedCanvas.ts     # Load template, mark editable vs locked, handle edits
      useEditableFields.ts       # Extract variableId → editable objects, sync values
      useImageUpload.ts          # Handle image uploads, replace image layer
    lib/
      restrictedDeserialize.ts   # Load template, set editable=false objects as locked
      restrictedSerialize.ts     # Extract only variableValues (not full canvas JSON)
      validateConstraints.ts     # Validate text length, image size, etc.
```

**Data flow:**

- **Load:** Route loads product → template version (published only) → `restrictedDeserialize(template, areaId)` → Fabric canvas with locked objects.
- **Edit:** User edits via `EditableFieldPanel` (text input or image upload) → updates Fabric object → canvas re-renders.
- **Save:** `restrictedSerialize(canvas, template)` → `{ variableId: value }` → save to cart/session or submit with order.

---

## 2. Core React component

### 2.1 PersonalizationEditor (main component)

```typescript
// components/personalization-editor/PersonalizationEditor.tsx
'use client';

import { useState, useEffect } from 'react';
import { RestrictedCanvas } from './RestrictedCanvas';
import { EditableFieldPanel } from './EditableFieldPanel';
import { PreviewPanel } from './PreviewPanel';
import { useRestrictedCanvas } from './hooks/useRestrictedCanvas';
import type { TemplateArea, TemplateDocument } from '@/PixelCraft/editor/types';

interface PersonalizationEditorProps {
  template: TemplateDocument;  // Published template version
  areaId: string;              // e.g. 'front'
  productId: string;
  onSave?: (variableValues: Record<string, string>) => void;
}

export function PersonalizationEditor({ template, areaId, productId, onSave }: PersonalizationEditorProps) {
  const area = template.areas[areaId];
  const { canvas, editableFields, updateField, isReady } = useRestrictedCanvas(area);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  if (!isReady || !area) return <div>Loading...</div>;

  return (
    <div className="personalization-editor">
      <div className="editor-layout">
        {/* Canvas: read-only preview for non-designers */}
        <RestrictedCanvas canvas={canvas} isMobile={isMobile} />
        
        {/* Simplified editing panel */}
        <EditableFieldPanel
          fields={editableFields}
          onUpdate={updateField}
          template={template}
        />
      </div>
      
      {/* Preview + Add to cart */}
      <PreviewPanel
        canvas={canvas}
        productId={productId}
        onSave={onSave}
      />
    </div>
  );
}
```

### 2.2 RestrictedCanvas (Fabric wrapper, locks non-editable)

```typescript
// components/personalization-editor/RestrictedCanvas.tsx
'use client';

import { useEffect, useRef } from 'react';
import type { FabricCanvas } from '@/PixelCraft/editor/lib/fabricCanvas';

interface RestrictedCanvasProps {
  canvas: FabricCanvas | null;
  isMobile: boolean;
}

export function RestrictedCanvas({ canvas, isMobile }: RestrictedCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!canvas || !containerRef.current) return;
    const container = containerRef.current;
    const canvasEl = container.querySelector('canvas');
    if (canvasEl) {
      container.appendChild(canvasEl);
    }
  }, [canvas]);

  if (!canvas) return <div>Loading canvas...</div>;

  return (
    <div
      ref={containerRef}
      className={`restricted-canvas ${isMobile ? 'mobile' : ''}`}
      style={{ overflow: 'hidden', position: 'relative' }}
    >
      {/* Canvas is appended here */}
    </div>
  );
}
```

---

## 3. Logic for editable vs non-editable elements

### 3.1 Hook: useRestrictedCanvas

Loads template, marks editable objects, locks others, provides update function.

```typescript
// hooks/useRestrictedCanvas.ts
import { useState, useEffect, useCallback } from 'react';
import { restrictedDeserialize } from '../lib/restrictedDeserialize';
import { restrictedSerialize } from '../lib/restrictedSerialize';
import type { TemplateArea, TemplateDocument } from '@/PixelCraft/editor/types';
import type { FabricCanvas, FabricObject } from '@/PixelCraft/editor/lib/fabricCanvas';

export interface EditableField {
  variableId: string;
  layerId: string;
  type: 'text' | 'image';
  label: string;
  value: string;
  constraints?: any;
}

export function useRestrictedCanvas(area: TemplateArea | null) {
  const [canvas, setCanvas] = useState<FabricCanvas | null>(null);
  const [editableFields, setEditableFields] = useState<EditableField[]>([]);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!area) return;
    // Load template into canvas (implementation in restrictedDeserialize)
    // After load, extract editable fields and lock others
    loadRestrictedCanvas(area).then(({ canvas: c, fields }) => {
      setCanvas(c);
      setEditableFields(fields);
      setIsReady(true);
    });
  }, [area]);

  const updateField = useCallback((variableId: string, value: string) => {
    if (!canvas) return;
    const field = editableFields.find(f => f.variableId === variableId);
    if (!field) return;
    const obj = canvas.getObjects().find(o => (o.get?.('layerId') as string) === field.layerId) as FabricObject;
    if (!obj) return;
    if (field.type === 'text') {
      obj.set({ text: value });
    } else if (field.type === 'image') {
      // Load new image (use image upload hook)
    }
    canvas.requestRenderAll();
  }, [canvas, editableFields]);

  return { canvas, editableFields, updateField, isReady };
}

async function loadRestrictedCanvas(area: TemplateArea): Promise<{ canvas: FabricCanvas; fields: EditableField[] }> {
  // Implementation: create canvas, deserialize area, mark editable vs locked
  // Return canvas and extracted editable fields
  throw new Error('Implement with restrictedDeserialize');
}
```

### 3.2 Restricted deserialize (lock non-editable objects)

```typescript
// lib/restrictedDeserialize.ts
import type { TemplateArea } from '@/PixelCraft/editor/types';
import type { FabricCanvas, FabricObject, FabricFactory } from '@/PixelCraft/editor/lib/fabricCanvas';
import { deserializeToCanvas } from '@/PixelCraft/editor/lib/deserialize';

export interface EditableField {
  variableId: string;
  layerId: string;
  type: 'text' | 'image';
  label: string;
  value: string;
  constraints?: any;
}

/**
 * Load template area into canvas, then lock all objects that are NOT editable or have no variableId.
 * Returns editable fields for the UI panel.
 */
export async function restrictedDeserialize(
  canvas: FabricCanvas,
  area: TemplateArea,
  factory: FabricFactory
): Promise<EditableField[]> {
  // Load all objects (use existing deserializeToCanvas)
  await deserializeToCanvas(canvas, area, factory);
  
  const editableFields: EditableField[] = [];
  const objects = canvas.getObjects() as FabricObject[];

  objects.forEach((obj) => {
    const layerId = obj.get?.('layerId') as string;
    const editable = obj.get?.('editable') as boolean;
    const variableId = obj.get?.('variableId') as string | undefined;
    const layerType = obj.get?.('layerType') as string | undefined;

    // Lock if not editable OR no variableId (user can't personalize)
    const shouldLock = !editable || !variableId;

    if (shouldLock) {
      obj.set({
        selectable: false,
        evented: false,
        lockMovementX: true,
        lockMovementY: true,
        lockRotation: true,
        lockScalingX: true,
        lockScalingY: true,
        hoverCursor: 'default',
        moveCursor: 'default',
      });
    } else {
      // Extract editable field info
      editableFields.push({
        variableId: variableId!,
        layerId: layerId ?? '',
        type: (layerType === 'text' ? 'text' : 'image') as 'text' | 'image',
        label: variableId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()), // "customer_name" → "Customer Name"
        value: layerType === 'text' ? (obj.text as string) ?? '' : (obj._element?.src as string) ?? '',
        constraints: obj.get?.('constraints'),
      });
    }
  });

  // Disable selection on canvas (users edit via panel, not direct selection)
  (canvas as any).selection = false;
  (canvas as any).defaultCursor = 'default';

  return editableFields;
}
```

### 3.3 Restricted serialize (extract variable values only)

```typescript
// lib/restrictedSerialize.ts
import type { FabricCanvas, FabricObject } from '@/PixelCraft/editor/lib/fabricCanvas';
import type { TemplateDocument } from '@/PixelCraft/editor/types';

/**
 * Extract only variable values from canvas (not full template JSON).
 * Returns { variableId: value } for saving to cart/order.
 */
export function restrictedSerialize(canvas: FabricCanvas): Record<string, string> {
  const objects = canvas.getObjects() as FabricObject[];
  const variableValues: Record<string, string> = {};

  objects.forEach((obj) => {
    const variableId = obj.get?.('variableId') as string | undefined;
    const editable = obj.get?.('editable') as boolean;
    const layerType = obj.get?.('layerType') as string | undefined;

    if (variableId && editable) {
      if (layerType === 'text') {
        variableValues[variableId] = (obj.text as string) ?? '';
      } else if (layerType === 'image') {
        // Store image URL or asset key (from upload)
        variableValues[variableId] = (obj._element?.src as string) ?? '';
      }
    }
  });

  return variableValues;
}
```

---

## 4. UX best practices for non-designer users

### 4.1 Simplified UI: EditableFieldPanel

**Principle:** Hide Fabric.js complexity. Users see a form-like panel with labeled inputs, not a canvas editor.

```typescript
// components/personalization-editor/EditableFieldPanel.tsx
'use client';

import { useState } from 'react';
import { useImageUpload } from './hooks/useImageUpload';
import type { EditableField } from './hooks/useRestrictedCanvas';
import type { TemplateDocument } from '@/PixelCraft/editor/types';

interface EditableFieldPanelProps {
  fields: EditableField[];
  onUpdate: (variableId: string, value: string) => void;
  template: TemplateDocument;
}

export function EditableFieldPanel({ fields, onUpdate, template }: EditableFieldPanelProps) {
  const { uploadImage, isUploading } = useImageUpload();

  const handleTextChange = (variableId: string, value: string, constraints?: any) => {
    const maxLength = constraints?.maxLength;
    if (maxLength && value.length > maxLength) {
      value = value.slice(0, maxLength);
    }
    onUpdate(variableId, value);
  };

  const handleImageUpload = async (variableId: string, file: File, constraints?: any) => {
    const url = await uploadImage(file, constraints);
    onUpdate(variableId, url);
  };

  if (fields.length === 0) {
    return (
      <div className="editable-field-panel empty">
        <p>This template has no personalizable fields.</p>
      </div>
    );
  }

  return (
    <div className="editable-field-panel">
      <h3>Personalize Your Design</h3>
      {fields.map((field) => (
        <div key={field.variableId} className="field-group">
          <label htmlFor={field.variableId}>
            {field.label}
            {field.constraints?.required && <span className="required">*</span>}
          </label>
          
          {field.type === 'text' ? (
            <div>
              <input
                id={field.variableId}
                type="text"
                value={field.value}
                onChange={(e) => handleTextChange(field.variableId, e.target.value, field.constraints)}
                maxLength={field.constraints?.maxLength}
                placeholder={field.constraints?.default || `Enter ${field.label.toLowerCase()}`}
                className="text-input"
              />
              {field.constraints?.maxLength && (
                <div className="char-count">
                  {field.value.length} / {field.constraints.maxLength}
                </div>
              )}
            </div>
          ) : (
            <div>
              <input
                id={field.variableId}
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImageUpload(field.variableId, file, field.constraints);
                }}
                disabled={isUploading}
                className="image-input"
              />
              {field.value && (
                <img src={field.value} alt={field.label} className="preview-thumbnail" />
              )}
              <p className="help-text">
                {field.constraints?.maxFileSizeBytes && `Max size: ${Math.round(field.constraints.maxFileSizeBytes / 1024)}KB`}
                {field.constraints?.allowedMimeTypes && ` • Formats: ${field.constraints.allowedMimeTypes.join(', ')}`}
              </p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
```

### 4.2 UX principles

| Principle | Implementation |
|-----------|----------------|
| **No canvas editing** | Canvas is read-only preview; all edits via form panel |
| **Clear labels** | Variable IDs → human-readable labels ("customer_name" → "Your Name") |
| **Visual feedback** | Live preview updates as user types/uploads |
| **Constraints visible** | Show max length, file size limits, allowed formats |
| **Help text** | Explain what each field is for (e.g. "This text will appear on the front") |
| **Validation** | Real-time validation (length, file size, format) |
| **Error messages** | Clear, actionable errors ("Image too large. Max 5MB.") |
| **Progress indicators** | Show upload progress, save status |
| **Undo/redo** | Optional: simple undo last change (not full history) |

### 4.3 Preview panel (live preview + add to cart)

```typescript
// components/personalization-editor/PreviewPanel.tsx
'use client';

import { useState } from 'react';
import { restrictedSerialize } from '../lib/restrictedSerialize';
import type { FabricCanvas } from '@/PixelCraft/editor/lib/fabricCanvas';

interface PreviewPanelProps {
  canvas: FabricCanvas | null;
  productId: string;
  onSave?: (variableValues: Record<string, string>) => void;
}

export function PreviewPanel({ canvas, productId, onSave }: PreviewPanelProps) {
  const [isSaving, setIsSaving] = useState(false);

  const handleAddToCart = async () => {
    if (!canvas) return;
    setIsSaving(true);
    const variableValues = restrictedSerialize(canvas);
    // Save to cart/session or call API
    await onSave?.(variableValues);
    setIsSaving(false);
  };

  return (
    <div className="preview-panel">
      <h3>Preview</h3>
      {/* Canvas preview is rendered above */}
      <button
        onClick={handleAddToCart}
        disabled={isSaving}
        className="add-to-cart-btn"
      >
        {isSaving ? 'Saving...' : 'Add to Cart'}
      </button>
    </div>
  );
}
```

---

## 5. Mobile considerations

### 5.1 MobileCanvas (touch-optimized)

```typescript
// components/personalization-editor/MobileCanvas.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import type { FabricCanvas } from '@/PixelCraft/editor/lib/fabricCanvas';

interface MobileCanvasProps {
  canvas: FabricCanvas | null;
}

export function MobileCanvas({ canvas }: MobileCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    if (!canvas || !containerRef.current) return;
    const container = containerRef.current;
    
    // Fit canvas to viewport on mobile
    const fitToViewport = () => {
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;
      const canvasWidth = (canvas as any).width;
      const canvasHeight = (canvas as any).height;
      const scale = Math.min(containerWidth / canvasWidth, containerHeight / canvasHeight) * 0.9;
      setZoom(scale);
      canvas.setZoom(scale);
      canvas.requestRenderAll();
    };

    fitToViewport();
    window.addEventListener('resize', fitToViewport);
    return () => window.removeEventListener('resize', fitToViewport);
  }, [canvas]);

  return (
    <div
      ref={containerRef}
      className="mobile-canvas"
      style={{
        touchAction: 'pan-x pan-y',
        overflow: 'auto',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {/* Canvas is appended here */}
    </div>
  );
}
```

### 5.2 Mobile UX patterns

| Pattern | Implementation |
|---------|----------------|
| **Touch-friendly inputs** | Large tap targets (min 44×44px), spacing between fields |
| **Simplified layout** | Stack canvas above form on mobile (not side-by-side) |
| **Zoom/pan** | Canvas auto-fits viewport; pinch-to-zoom optional; pan via touch |
| **Image upload** | Native file picker; show camera option on mobile |
| **Keyboard** | Auto-focus first field; "Next" button moves to next field |
| **Save state** | Auto-save to localStorage/session; restore on return |
| **Loading states** | Skeleton screens, progress bars for uploads |
| **Error handling** | Toast notifications, inline errors below fields |

### 5.3 Responsive layout

```css
/* CSS example */
.personalization-editor {
  display: flex;
  flex-direction: column;
}

.editor-layout {
  display: flex;
  gap: 1rem;
}

@media (max-width: 768px) {
  .editor-layout {
    flex-direction: column;
  }
  
  .restricted-canvas {
    order: 1;
    max-height: 50vh;
  }
  
  .editable-field-panel {
    order: 2;
  }
}
```

---

## 6. Summary

| Component | Purpose |
|-----------|---------|
| **PersonalizationEditor** | Main component: orchestrates canvas + panel + preview |
| **RestrictedCanvas** | Fabric wrapper: locks non-editable objects, disables selection |
| **EditableFieldPanel** | Simplified UI: form-like inputs for text/image fields |
| **useRestrictedCanvas** | Hook: load template, extract editable fields, update values |
| **restrictedDeserialize** | Load template, mark editable=false or no variableId as locked |
| **restrictedSerialize** | Extract only variable values (not full canvas JSON) |
| **MobileCanvas** | Touch-optimized canvas: fit-to-viewport, zoom/pan |

**Key differences from Admin Editor:**

- **No direct canvas editing:** Users edit via form panel, not Fabric selection/move/resize.
- **Locked objects:** Non-editable or no variableId → `selectable: false`, `evented: false`, all locks enabled.
- **Simplified UI:** Form inputs, labels, help text, validation; no layer panel, alignment tools, or advanced controls.
- **Variable values only:** Save `{ variableId: value }`, not full template JSON; server merges into template at render time.
- **Mobile-first:** Responsive layout, touch-friendly inputs, auto-fit canvas, native file picker.

---

## 7. File layout (reference implementation)

Code for the above lives under `PixelCraft/user-editor/`:

| File | Purpose |
|------|--------|
| **lib/restrictedDeserialize.ts** | Load template area, lock non-editable objects, return editable fields |
| **lib/restrictedSerialize.ts** | Extract `{ variableId: value }` from canvas (not full JSON) |
| **lib/validateConstraints.ts** | Validate text length, image size/format/aspect ratio |
| **hooks/useImageUpload.ts** | Upload image file, validate constraints, return URL |
| **index.ts** | Public exports |

**Not yet implemented (structure only):** `PersonalizationEditor.tsx`, `RestrictedCanvas.tsx`, `EditableFieldPanel.tsx`, `PreviewPanel.tsx`, `MobileCanvas.tsx`, `hooks/useRestrictedCanvas.ts`. Use the patterns in this doc and the serialize/deserialize examples to build them.

**Usage (Next.js):** Install `fabric`, then:

```ts
import { fabric } from 'fabric';
import { restrictedDeserialize, restrictedSerialize } from '@/PixelCraft/user-editor';
import { createCanvasWithFabric } from '@/PixelCraft/editor';
const canvas = createCanvasWithFabric(canvasEl, spec, fabric);
const editableFields = await restrictedDeserialize(canvas, area, fabric);
// User edits via form panel → update canvas objects → extract values:
const variableValues = restrictedSerialize(canvas);
```

This design keeps the User Personalization Editor aligned with the template JSON schema (Prompt 2), the architecture (Prompt 1), and the admin editor (Prompt 4), while providing a **non-designer-friendly** experience.
