# PixelCraft Blueprint (Single Source of Truth)

You asked for a **world-class Template Manager** (Canva/Zazzle/Vistaprint-class) using:

- Next.js (latest App Router)
- React + TypeScript
- Node.js backend
- HTML5 Canvas + Fabric.js
- Tailwind CSS
- Print-ready export (300 DPI)

This file consolidates the deliverables and points to the step-by-step docs + reference code already created in `admin-cms/src/PixelCraft/`.

---

## 1) System architecture diagram (text)

```
┌───────────────────────────────────────────────────────────────────────────────┐
│                               Next.js App (Web)                               │
├───────────────────────────────────┬───────────────────────────────────────────┤
│ Admin (Template Manager)          │ Storefront (User Personalization)         │
│ - Template CRUD + versions        │ - Load published template version         │
│ - Fabric editor (full controls)   │ - Restricted editor (only allowed fields) │
│ - Publish / rollback              │ - Save variable values to cart/order       │
└───────────────────────────────────┴───────────────────────────────────────────┘
                     │ REST/tRPC (AuthZ, Tenant) │
                     ▼                           ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│                                Node.js API Layer                              │
│  - Templates: CRUD + versioning + status                                       │
│  - Product↔Template mapping                                                    │
│  - User customizations (variableValues)                                        │
│  - Assets (fonts/images) metadata + upload signing                             │
│  - Render job enqueue (export)                                                 │
└───────────────────────────────────┬───────────────────────────────────────────┘
                                    │
                                    ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│                        Render / Export Service (Workers)                       │
│  - Merge template JSON + variableValues                                        │
│  - Resolve fonts/images                                                       │
│  - Render PNG/PDF at 300 DPI                                                  │
│  - Upload to blob storage + return URLs                                       │
└───────────────────────────────────┬───────────────────────────────────────────┘
                                    │
                                    ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│                 Data & Storage                                                 │
│  - MongoDB: templates, versions, mappings, customizations, assets metadata      │
│  - Blob storage (S3/R2): images/fonts, thumbnails, exports                      │
│  - CDN: serve assets + thumbnails + exports                                    │
│  - Redis (optional): caching + queues                                          │
└───────────────────────────────────────────────────────────────────────────────┘
```

**Separation of concerns**

- **Canvas/Fabric** = editor + on-screen preview only (interactive UX)
- **JSON** = source of truth (versioned template document + constraints)
- **Renderer** = print pipeline (300 DPI) and reproducible output

---

## 2) Database schema (MongoDB-first, DB-agnostic model)

See: `03-database-schema.md` (MongoDB collections, indexes, rollback, plus DB-agnostic mapping).

**Core collections (logical model)**

- `templates`
- `template_versions` (contains full `TemplateDocument` JSON)
- `products`
- `product_template_mappings` (optionally pins `templateVersion`)
- `user_customizations` (stores `{ variableId: value }` + `templateVersion`)
- `customization_renders` (PNG/PDF outputs per area)
- `assets` (fonts/images metadata)

**Version rollback strategy**

- Create a new published version from an older published version (immutable publish history)
- Or pin `product_template_mappings.templateVersion` to a known-good version for instant rollback

---

## 3) Template JSON schema (TypeScript) + example

See: `02-template-json-schema-versioning.md` (complete interfaces + example JSON).

**Key schema ideas**

- Multi-area: `areas: { front, back, ... }`
- Layers: `text | image | shape`
- Restrictions:
  - `editable: boolean`
  - `variableId?: string` (personalizable)
  - `constraints` (maxLength, allowedFonts, resize limits, etc.)
- Ordering: `layerOrder` (bottom → top)
- Print spec: `dpi`, `bleed`, `safeAreaInset`

---

## 4) Frontend folder structure (Next.js App Router)

This is the recommended production structure (TypeScript + Tailwind).

```
src/
  app/
    (admin)/
      templates/
        page.tsx                    # list view (thumbs, filters)
        [templateId]/
          versions/page.tsx         # version history + rollback
          edit/page.tsx             # admin Fabric editor
    (storefront)/
      personalize/
        [productId]/page.tsx        # user restricted editor
    api/
      templates/route.ts            # list/create
      templates/[id]/route.ts       # get/update/delete
      templates/[id]/publish/route.ts
      templates/[id]/rollback/route.ts
      products/[id]/templates/route.ts
      customizations/route.ts       # create customization (variableValues)
      render/route.ts               # enqueue render/export job

  components/
    template-manager/
      TemplateList.tsx              # admin list + thumbs
      TemplateThumbnail.tsx
    template-editor/
      AdminTemplateEditor.tsx       # admin editor (Fabric)
      LayerPanel.tsx
      Toolbar.tsx
    personalization-editor/
      UserPersonalizationEditor.tsx # restricted UX
      EditableFieldPanel.tsx

  lib/
    pixelcraft/
      schema/                       # template json types + validators
      canvas/                       # fabric helpers
      export/                       # render job client
      api/                          # typed API client
      security/                     # signing, validation
```

Reference code stubs (copyable) will live under:
`admin-cms/src/PixelCraft/reference-nextjs-app/` (added next).

---

## 5) Core React components (Admin + User)

We already created reference libraries and docs:

- Admin editor docs: `04-admin-canvas-editor.md`
  - Reference libs: `editor/lib/*` (fabric setup + serialize/deserialize)
- User editor docs: `05-user-side-editor.md`
  - Reference libs: `user-editor/lib/*` (restricted serialize/deserialize, validations)

What you build in production:

- **AdminTemplateEditor**
  - Full Fabric editing controls (add text/image/shape, reorder, lock, constraints)
  - Autosave draft, undo/redo
  - Publish → creates immutable published version
- **UserPersonalizationEditor**
  - Loads published template version
  - Locks all non-editable/no-variable objects
  - Shows a guided panel (text inputs + image upload)
  - Saves **only** `variableValues`

---

## 6) Backend API design (REST examples)

Template lifecycle:

- `GET   /api/templates?status=published&productType=tshirt`
- `POST  /api/templates` (create template)
- `GET   /api/templates/:templateId`
- `PUT   /api/templates/:templateId` (update draft metadata)
- `POST  /api/templates/:templateId/versions` (create draft version from current)
- `POST  /api/templates/:templateId/publish` (promote draft → new published version)
- `POST  /api/templates/:templateId/rollback` (republish older version or pin mapping)

Product mapping:

- `GET   /api/products/:productId/templates`
- `PUT   /api/products/:productId/templates` (set mapping, pin version, area overrides)

User personalization:

- `POST  /api/customizations` (stores `{ templateVersionId, productId, variableValues }`)
- `GET   /api/customizations/:id`

Export:

- `POST  /api/render` (enqueue render job)
- `GET   /api/render/:jobId` (status + URLs)

Assets:

- `POST  /api/assets/upload-url` (signed upload URL)
- `POST  /api/assets` (save metadata)
- `GET   /api/assets?kind=font|image`

---

## 7) Best practices (performance, scalability, print quality)

See:

- `06-print-ready-export.md` (300 DPI pipeline, fonts, PNG/PDF)
- `07-production-hardening.md` (caching, thumbnails, autosave, security)
- `08-canva-level-enhancements.md` (preview, mockups, analytics, rollback)

**Non-negotiables for print**

- Render on server/workers at physical size × 300 DPI
- Register identical font files on backend (`registerFont`) and frontend (webfont)
- Keep template JSON immutable once published (reproducible orders)

---

## 8) Where to start (practical build order)

1. Template JSON schema + validator (Prompt 2)
2. Admin editor MVP: add text/image, lock, variableId, serialize
3. Publish flow: draft → published version (immutable)
4. User editor MVP: restricted fields + variableValues save
5. Render/export worker: PNG 300 DPI, then PDF
6. Thumbnails + caching + monitoring

