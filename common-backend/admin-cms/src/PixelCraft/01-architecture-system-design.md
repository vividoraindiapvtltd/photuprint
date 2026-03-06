# 🎯 Prompt 1: Architecture & System Design

## Personalization & Template Management Platform  
*(Canva / Printify / Zazzle–style)*

**Tech stack:** Next.js (App Router), React + TypeScript, Node.js backend, Fabric.js (HTML5 Canvas), Tailwind CSS.

---

## 1. High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT (Next.js App)                                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│  Admin CMS                    │  Storefront / Personalization                    │
│  • Template CRUD              │  • Browse templates                              │
│  • Versioning & publish       │  • Canvas editor (Fabric.js)                    │
│  • Product–template mapping   │  • Restricted field personalization              │
│  • Print spec & DPI config    │  • Preview & add to cart                         │
└──────────────┬────────────────┴────────────────┬────────────────────────────────┘
               │                                  │
               ▼                                  ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         API LAYER (Node.js / Next.js API Routes)                 │
│  • REST / tRPC for templates, products, personalization, export                   │
│  • Auth: admin vs end-user, tenant/website context                               │
└──────────────┬──────────────────────────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              BACKEND SERVICES                                    │
├──────────────────┬──────────────────┬──────────────────┬──────────────────────────┤
│  Template Svc    │  Product Svc     │  Personalization │  Render / Export Svc    │
│  • CRUD, version │  • Catalog       │  • Validation    │  • Server-side canvas    │
│  • Publish state │  • Mapping       │  • Allowed fields│  • 300 DPI export        │
└────────┬─────────┴────────┬────────┴────────┬────────┴────────────┬─────────────┘
         │                  │                 │                     │
         ▼                  ▼                 ▼                     ▼
┌──────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────────────┐
│  DB          │   │  File/Blob   │   │  DB (orders,  │   │  Queue + Workers      │
│  (Templates, │   │  (images,    │   │  saved       │   │  (PNG/SVG/PDF at      │
│   products,  │   │   assets)    │   │  designs)    │   │   300 DPI)            │
│   mapping)   │   │  S3/Cloud    │   │              │   │  CDN for outputs      │
└──────────────┘   └──────────────┘   └──────────────┘   └──────────────────────┘
```

- **Frontend:** Next.js App Router (React + TypeScript), Tailwind, Fabric.js for canvas.
- **Backend:** Node.js (existing or new service) for template/product/personalization and a dedicated **render/export** service.
- **Storage:** DB for metadata and mapping; object storage for assets and final print-ready files.
- **Rendering:** Client for WYSIWYG; server/workers for 300 DPI export to avoid client limits and ensure consistency.

---

## 2. Separation of Concerns: Canvas vs Data vs Rendering

| Layer | Responsibility | Where it lives | Key tech |
|-------|----------------|----------------|----------|
| **Canvas (editor)** | WYSIWYG interaction, drag/drop, zoom, selection, undo/redo | Browser | Fabric.js, React state for UI |
| **Data (model)** | Template definition, product mapping, allowed fields, versioning | DB + API | JSON schema, versioned documents |
| **Rendering (output)** | Print-ready bitmap/vector at 300 DPI | Server + optional workers | Node canvas (node-canvas / Sharp), queue (Bull/Agenda) |

### 2.1 Canvas layer (frontend only)

- **Role:** Edit experience only. No DPI or final dimensions here; use “design dimensions” (e.g. 1000×1000 logical units).
- **Data out:** Serialized Fabric JSON (objects, layers, text, images) plus **variable definitions** (which fields are editable, types, defaults).
- **No direct responsibility:** File I/O, 300 DPI, color profiles, bleed. That belongs to the rendering layer.

### 2.2 Data layer (source of truth)

- **Template document:**  
  - Metadata (name, product mapping, status, version).  
  - **Design JSON:** Fabric-compatible JSON.  
  - **Variable schema:** List of allowed personalization fields (e.g. `customer_name`, `custom_text_1`) with type, default, validation, and which Fabric object IDs they bind to.
- **Product–template mapping:** Which products use which template(s), print dimensions, DPI, bleed.
- **Versioning:** Each publish is a version; history kept for rollback and audit.

### 2.3 Rendering layer (server-side)

- **Role:** Turn “design + variables” into print-ready assets.
- **Input:** Template version ID + variable values (from order or preview).
- **Process:** Load design JSON, resolve assets (from CDN/storage), inject variable values into bound objects, render at **physical size and 300 DPI** (e.g. node-canvas, Sharp, or headless browser for complex text).
- **Output:** PNG/PDF (and optionally print-ready PDF with bleed). Store in blob storage; optionally cache by template version + hash of variables.

This keeps **canvas = editing**, **data = what is saved and versioned**, **rendering = print-ready output**.

---

## 3. Admin vs User Flows

### 3.1 Admin flow (template manager)

1. **Create / edit template**  
   - Open canvas (Fabric.js) in admin.  
   - Add art, text, images; mark which elements are “personalizable” and bind to variable IDs from the variable schema.
2. **Version & publish**  
   - Save as draft → creates new version.  
   - “Publish” copies draft to a published version; storefront uses only published versions.
3. **Map to products**  
   - Attach template (or version) to product(s). Set print dimensions, DPI, bleed per product.
4. **Print spec & DPI**  
   - Configure default DPI (300), color space, and dimensions per product/template. Rendering service reads this.

**Admin does not:** Render final 300 DPI in the browser; they work in design resolution. Export/preview can be a low-res preview from the same rendering pipeline.

### 3.2 End-user flow (personalization)

1. **Choose product**  
   - Product has one or more templates; user picks one (or it’s pre-selected).
2. **Load template**  
   - Fetch published template JSON + variable schema. Canvas shows only **allowed** personalization fields (e.g. specific text boxes, one image slot).
3. **Personalize**  
   - User edits only those fields (validation from variable schema). No structural edit (no adding/removing layers).
4. **Preview & add to cart**  
   - Preview can be a low-res render or client-side thumbnail. Cart stores: product ID, template version ID, **variable values** (not full Fabric JSON if you want to keep payloads small and secure).
5. **Checkout**  
   - Order includes product + template version + variable values. After payment, **rendering service** produces 300 DPI assets and attaches to order/fulfillment.

**User never:** Edits raw design, changes dimensions, or sees admin-only data. All they get is “allowed fields” derived from the same template data model.

---

## 4. Performance & Scalability

| Concern | Approach |
|--------|-----------|
| **Heavy canvas in browser** | Lazy-load Fabric.js only on template/edit routes. Use React.memo and virtualization if many objects. Keep “design resolution” modest (e.g. 1000–2000 px) and do 300 DPI only on server. |
| **Large template JSON** | Compress (gzip) over the wire. Lazy-load images/assets by URL. Consider splitting “structure” vs “assets” in API. |
| **300 DPI rendering** | Offload to worker processes (Bull/Agenda). Scale workers horizontally. Cache by (templateVersionId, hash(variables)). Use CDN for generated assets. |
| **Concurrent exports** | Queue (e.g. Redis-backed). Rate limit per tenant/user if needed. |
| **Asset storage** | Store originals and rendered outputs in object storage (S3/Cloudflare R2). Serve via CDN. |
| **DB** | Index template by product, status, version. Keep design JSON in DB or in blob with DB pointer, depending on size and query needs. |

---

## 5. Architectural Decisions & Tradeoffs

| Decision | Choice | Rationale | Tradeoff |
|----------|--------|-----------|----------|
| **Where to render 300 DPI** | Server (Node + canvas/Sharp or headless) | Consistent quality, no browser memory/export limits, one pipeline for preview and print. | Need to maintain a Node rendering stack and queue. |
| **Template format** | Fabric JSON + variable schema | Reuse same format in editor and renderer; clear binding between “variable” and “object id”. | Tied to Fabric; migration to another canvas lib would require a translation layer. |
| **Versioning** | Immutable published versions, draft = “current edit” | Safe rollback; storefront always uses a fixed version. | More storage and version resolution logic. |
| **What user sends to cart/order** | Variable values + template version ID (not full Fabric JSON) | Smaller payloads, no arbitrary design injection; server re-composes from template + vars. | Renderer must support “merge variables into template” reliably. |
| **Admin vs storefront apps** | Can be same Next.js app with different routes/roles, or separate apps | Same codebase for template model and API reuse. | Admin bundle includes canvas; use code-splitting so storefront stays light. |
| **Caching** | Cache rendered output by template version + variable hash | Big win for repeated designs (e.g. same template, same text). | Stale cache if template or assets change; use version in cache key. |

---

## 6. Summary

- **Frontend:** Next.js (App Router) + React + TypeScript + Fabric.js + Tailwind; admin = full template editor, storefront = restricted personalization only.
- **Backend:** Node.js for templates, products, mapping, and a dedicated **rendering service** (with queue + workers) for 300 DPI.
- **Separation:** **Canvas** = editing in design resolution; **Data** = versioned template + variable schema + product mapping; **Rendering** = server-side, print-ready output only.
- **Flows:** Admins create/edit/version/publish and map to products; users personalize allowed fields only and get print-ready output via server-side render after checkout.
- **Scale:** Queue-based rendering, horizontal workers, blob storage + CDN, and caching by template version + variables keep the system scalable and print-ready at 300 DPI.

This gives you a clear blueprint for implementing the Template Manager and personalization flows in the PixelCraft folder and beyond.
