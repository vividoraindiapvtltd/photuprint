# Prompt 2: Template JSON Schema & Versioning

## JSON-first template schema as single source of truth

This document defines a **JSON-first template schema** for the personalization platform: canvas specs, objects (text, images, shapes), editability, constraints, layer order, multi-area support, and versioning.

---

## 1. TypeScript interfaces (JSON schema)

```typescript
// ============== Versioning & lifecycle ==============

export type TemplateVersionStatus = 'draft' | 'published' | 'archived';

export interface TemplateVersionMeta {
  versionId: string;           // e.g. UUID or nanoid
  status: TemplateVersionStatus;
  createdAt: string;           // ISO 8601
  updatedAt: string;
  publishedAt?: string;        // set when status → published
  archivedAt?: string;         // set when status → archived
  label?: string;             // e.g. "v2 - Holiday 2024"
}

// ============== Canvas & print spec ==============

export interface CanvasSpec {
  /** Design dimensions in logical units (e.g. 1000×1000). Used in editor. */
  width: number;
  height: number;
  /** Output DPI for print (e.g. 300). Used by render service. */
  dpi: number;
  /** Bleed in logical units (same as width/height). */
  bleed: number;
  /** Safe area inset from trim (logical units). Content must stay inside. */
  safeAreaInset: number;
  /** Optional unit label for docs (e.g. "px", "pt"). */
  unit?: string;
}

/** One physical area of a product (e.g. front, back, inside left). */
export type TemplateAreaId = 'front' | 'back' | 'inside_left' | 'inside_right' | 'spine' | string;

export interface TemplateArea {
  id: TemplateAreaId;
  label: string;               // e.g. "Front", "Back"
  canvas: CanvasSpec;
  /** Ordered list of layer IDs (bottom → top). */
  layerOrder: string[];
  /** Layer definitions keyed by id. */
  layers: Record<string, TemplateLayer>;
}

// ============== Objects: text, images, shapes ==============

export type LayerType = 'text' | 'image' | 'shape';

export interface BaseLayer {
  id: string;
  type: LayerType;
  /** If false, element is locked (admin can unlock). User editor hides locked or shows read-only. */
  editable: boolean;
  /** Display order within area (higher = on top). Redundant with layerOrder but useful for sort. */
  order: number;
  /** Transform and position in design coordinates. */
  transform: LayerTransform;
}

export interface LayerTransform {
  left: number;
  top: number;
  width: number;
  height: number;
  scaleX?: number;
  scaleY?: number;
  angle?: number;              // degrees
  originX?: 'left' | 'center' | 'right';
  originY?: 'top' | 'center' | 'bottom';
}

// --------------- Text ---------------

export interface TextLayer extends BaseLayer {
  type: 'text';
  content: string;
  /** Variable ID for personalization (e.g. "customer_name"). Empty = static. */
  variableId?: string;
  style: TextStyle;
  constraints?: TextConstraints;
}

export interface TextStyle {
  fontFamily: string;
  fontSize: number;            // logical units
  fontWeight?: number | string;
  fontStyle?: 'normal' | 'italic';
  textAlign?: 'left' | 'center' | 'right';
  fill: string;                // color hex/rgb
  lineHeight?: number;
  letterSpacing?: number;
}

export interface TextConstraints {
  /** Max character length for personalization. */
  maxLength?: number;
  /** Allowed font families (user picker). Empty = any. */
  allowedFonts?: string[];
  /** Allowed fill colors (hex). Empty = any. */
  allowedColors?: string[];
  /** Min/max fontSize (logical units) user can set. */
  fontSizeMin?: number;
  fontSizeMax?: number;
}

// --------------- Image ---------------

export interface ImageLayer extends BaseLayer {
  type: 'image';
  /** URL or asset key. Resolved by render service. */
  src: string;
  /** Variable ID if user uploads/replaces image (e.g. "photo_1"). */
  variableId?: string;
  constraints?: ImageConstraints;
}

export interface ImageConstraints {
  /** Min width/height in logical units (resize limit). */
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  /** Aspect ratio lock: [w, h] e.g. [1, 1] for square. */
  aspectRatio?: [number, number];
  /** Allowed MIME types for user upload (e.g. ["image/jpeg", "image/png"]). */
  allowedMimeTypes?: string[];
  /** Max file size in bytes. */
  maxFileSizeBytes?: number;
}

// --------------- Shape ---------------

export type ShapeKind = 'rect' | 'ellipse' | 'polygon' | 'line';

export interface ShapeLayer extends BaseLayer {
  type: 'shape';
  kind: ShapeKind;
  /** Polygon points: [[x,y], ...] in normalized 0–1 or in design coords per impl. */
  points?: [number, number][];
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  /** Variable ID if user can change color (e.g. "accent_color"). */
  variableId?: string;
  constraints?: ShapeConstraints;
}

export interface ShapeConstraints {
  allowedFills?: string[];
  allowedStrokes?: string[];
  /** Lock aspect ratio when resizing. */
  lockAspectRatio?: boolean;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
}

// --------------- Union ---------------

export type TemplateLayer = TextLayer | ImageLayer | ShapeLayer;

// ============== Root template document ==============

export interface TemplateDocument {
  /** Schema version for migrations (e.g. "1.0"). */
  schemaVersion: string;
  version: TemplateVersionMeta;
  /** Product type or SKU this template is for (e.g. "tshirt", "poster_a3"). */
  productType?: string;
  /** Human-readable name. */
  name: string;
  /** Multi-area: front, back, inside, etc. */
  areas: Record<TemplateAreaId, TemplateArea>;
  /** Default/primary area for preview (e.g. "front"). */
  defaultAreaId: TemplateAreaId;
  /** Global assets referenced by src (e.g. image keys → CDN URLs). */
  assets?: Record<string, string>;
}

// ============== Variable definition (for personalization) ==============

export interface VariableDefinition {
  id: string;                  // matches layer.variableId
  label: string;               // "Your name", "Photo"
  type: 'text' | 'image';
  default?: string;            // default text or default image key/URL
  required?: boolean;
  /** Layer IDs this variable can bind to (usually one). */
  layerIds: string[];
}
```

---

## 2. Example template JSON

```json
{
  "schemaVersion": "1.0",
  "version": {
    "versionId": "ver_abc123",
    "status": "published",
    "createdAt": "2024-01-15T10:00:00Z",
    "updatedAt": "2024-01-20T14:30:00Z",
    "publishedAt": "2024-01-20T14:30:00Z",
    "label": "v1 - Launch"
  },
  "productType": "tshirt",
  "name": "Classic Tee - Front & Back",
  "defaultAreaId": "front",
  "areas": {
    "front": {
      "id": "front",
      "label": "Front",
      "canvas": {
        "width": 1000,
        "height": 1200,
        "dpi": 300,
        "bleed": 40,
        "safeAreaInset": 30,
        "unit": "px"
      },
      "layerOrder": ["bg_rect", "logo_img", "title_text", "name_text"],
      "layers": {
        "bg_rect": {
          "id": "bg_rect",
          "type": "shape",
          "editable": false,
          "order": 0,
          "transform": { "left": 0, "top": 0, "width": 1000, "height": 1200 },
          "kind": "rect",
          "fill": "#f5f5f5"
        },
        "logo_img": {
          "id": "logo_img",
          "type": "image",
          "editable": false,
          "order": 1,
          "transform": { "left": 350, "top": 100, "width": 300, "height": 200 },
          "src": "assets/brand_logo.png"
        },
        "title_text": {
          "id": "title_text",
          "type": "text",
          "editable": false,
          "order": 2,
          "transform": { "left": 100, "top": 400, "width": 800, "height": 80 },
          "content": "Welcome to PixelCraft",
          "style": {
            "fontFamily": "Inter",
            "fontSize": 48,
            "fontWeight": 700,
            "textAlign": "center",
            "fill": "#1a1a1a"
          }
        },
        "name_text": {
          "id": "name_text",
          "type": "text",
          "editable": true,
          "order": 3,
          "variableId": "customer_name",
          "transform": { "left": 100, "top": 520, "width": 800, "height": 60 },
          "content": "Your Name",
          "style": {
            "fontFamily": "Inter",
            "fontSize": 36,
            "textAlign": "center",
            "fill": "#333333"
          },
          "constraints": {
            "maxLength": 30,
            "allowedFonts": ["Inter", "Roboto", "Open Sans"],
            "fontSizeMin": 24,
            "fontSizeMax": 48
          }
        }
      }
    },
    "back": {
      "id": "back",
      "label": "Back",
      "canvas": {
        "width": 1000,
        "height": 1200,
        "dpi": 300,
        "bleed": 40,
        "safeAreaInset": 30,
        "unit": "px"
      },
      "layerOrder": ["back_bg", "back_logo"],
      "layers": {
        "back_bg": {
          "id": "back_bg",
          "type": "shape",
          "editable": false,
          "order": 0,
          "transform": { "left": 0, "top": 0, "width": 1000, "height": 1200 },
          "kind": "rect",
          "fill": "#f5f5f5"
        },
        "back_logo": {
          "id": "back_logo",
          "type": "image",
          "editable": false,
          "order": 1,
          "transform": { "left": 400, "top": 500, "width": 200, "height": 200 },
          "src": "assets/brand_logo_small.png"
        }
      }
    }
  },
  "assets": {
    "brand_logo.png": "https://cdn.example.com/templates/abc123/brand_logo.png",
    "brand_logo_small.png": "https://cdn.example.com/templates/abc123/brand_logo_small.png"
  }
}
```

**Variable definitions** (stored with template or in product mapping, referenced by `variableId`):

```json
[
  {
    "id": "customer_name",
    "label": "Your name",
    "type": "text",
    "default": "Your Name",
    "required": true,
    "layerIds": ["name_text"]
  }
]
```

---

## 3. How this schema supports admin and user editors

### 3.1 Single source of truth

- One **TemplateDocument** (plus variable definitions) describes canvas, areas, layers, constraints, and version.
- Both admin and user editors load the same structure; they differ only in **what they are allowed to change** and **what they persist**.

| Concern | Admin editor | User (personalization) editor |
|--------|---------------|------------------------------|
| **Load** | Full `TemplateDocument` (draft or published copy for preview) | Published template only; optionally strip internal metadata |
| **Canvas / areas** | Can edit `CanvasSpec`, add/remove areas, change `layerOrder` | Read-only; use `canvas` for dimensions and safe area overlay |
| **Layers** | Can add, delete, reorder, and set `editable`, `constraints`, `variableId` | Only layers with `editable: true`; others hidden or read-only |
| **Content** | Edit any `content`, `src`, style, transform | Only edit fields bound to variables; enforce `constraints` |
| **Save** | Persist full document (new version, draft or publish) | Persist only **variable values** (e.g. `{ "customer_name": "Jane" }`); server merges into template at render time |

### 3.2 Admin editor

- **Canvas / DPI / bleed / safe area:** Read from `areas[].canvas`; admin can change dimensions, DPI, bleed, safe area. Render service uses these for 300 DPI output.
- **Objects (text, images, shapes):** Create/update/delete layers; set `type`, `transform`, `style`, `content`/`src`. Map personalization to `variableId` and set `editable: true` for user-facing fields.
- **Editable vs locked:** `editable: false` = locked (admin can still edit; user cannot). Admin UI can toggle lock and configure constraints.
- **Constraints:** Edit `constraints` (max length, fonts, colors, resize limits, MIME types). User editor and renderer validate against these.
- **Layer order:** Modify `layerOrder` and/or `order`; both define stacking. Export to Fabric (or other) using this order.
- **Multi-area:** Switch between `areas` by `id`; each area has its own `canvas` and `layers`. Admin can add/remove areas (e.g. front/back/inside).
- **Versioning:** Save creates a new version; set `version.status` to `draft` | `published` | `archived`. Only `published` is available to the user editor and render pipeline.

### 3.3 User (personalization) editor

- **Same JSON, restricted view:** Load published template; filter to `editable: true` layers. Optionally hide non-editable layers or show them dimmed/read-only.
- **Safe area:** Draw safe-area overlay from `canvas.safeAreaInset` so user keeps content inside. No need to expose bleed in UI.
- **Text:** Only text layers with `variableId` and `editable: true` are editable. Apply `TextConstraints` (max length, font picker, color picker, font size range).
- **Images:** Only image layers with `variableId` allow upload/replace; enforce `ImageConstraints` (dimensions, aspect ratio, MIME, file size).
- **Shapes:** If `variableId` and `editable: true`, allow only what constraints permit (e.g. fill color from `allowedFills`).
- **Multi-area:** Show tabs or thumbnails per `areas`; user edits only editable layers in each area. Persist variable values per area if needed (or one flat map keyed by variableId).
- **No structural changes:** User cannot add/remove layers, change canvas, or change `layerOrder`. They only submit **variable values**; server uses template + variable values to produce print-ready art.

### 3.4 Versioning in the schema

- **draft:** Work in progress; not visible to storefront; admin can overwrite.
- **published:** Immutable snapshot; storefront and render service use only published versions; `publishedAt` set.
- **archived:** No longer selectable for new orders; keep for history and rollback; `archivedAt` set.

Rendering and cart/order always reference a specific **versionId** (and optionally `publishedAt`) so print output is reproducible.

---

## 4. Summary

| Deliverable | Location |
|-------------|----------|
| **JSON schema (TypeScript)** | Section 1: `TemplateVersionMeta`, `CanvasSpec`, `TemplateArea`, `TextLayer`, `ImageLayer`, `ShapeLayer`, constraints, `TemplateDocument`, `VariableDefinition` |
| **Example template JSON** | Section 2: multi-area (front/back), text/image/shape, editable + locked, constraints, version meta, assets |
| **Admin vs user support** | Section 3: single source of truth; admin edits full document and version; user edits only editable layers and variable values; versioning (draft/published/archived) and render pipeline use same schema |

This schema supports canvas size, DPI, bleed, safe areas, text/image/shape objects, editable vs locked, constraints, layer order, multi-area templates, and template versioning in a JSON-first way that both admin and user editors can use from one document.
