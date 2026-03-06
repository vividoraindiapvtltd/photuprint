# PixelCraft Template Management System

Complete documentation and implementation guide for a Canva-level personalization and template management platform.

## 📚 Documentation

| Document | Description |
|----------|-------------|
| **[01-architecture-system-design.md](./01-architecture-system-design.md)** | High-level system architecture, separation of concerns, admin vs user flows, performance considerations |
| **[02-template-json-schema-versioning.md](./02-template-json-schema-versioning.md)** | JSON-first template schema, TypeScript interfaces, versioning strategy |
| **[03-database-schema.md](./03-database-schema.md)** | MongoDB schema (flexible for any DB), collections, indexes, version rollback |
| **[04-admin-canvas-editor.md](./04-admin-canvas-editor.md)** | Admin template editor with Fabric.js, component structure, serialize/deserialize |
| **[05-user-side-editor.md](./05-user-side-editor.md)** | User personalization editor (restricted editing), UX best practices, mobile considerations |
| **[06-print-ready-export.md](./06-print-ready-export.md)** | Server-side rendering pipeline, 300 DPI output, PNG/PDF export, DPI calculation |
| **[07-production-hardening.md](./07-production-hardening.md)** | Performance optimization, caching, thumbnails, autosave, error handling, security |
| **[08-canva-level-enhancements.md](./08-canva-level-enhancements.md)** | Advanced features (real-time preview, mockups, analytics, A/B testing) prioritized by business impact |
| **[09-testing-guide.md](./09-testing-guide.md)** | Testing guide: unit, integration, E2E, performance, visual regression |

## 🗂️ Code Structure

```
PixelCraft/
├── editor/              # Admin canvas editor
│   ├── lib/            # Fabric setup, serialize, deserialize
│   ├── hooks/          # React hooks (useFabricCanvas, useCanvasHistory)
│   └── types.ts        # Template types
├── user-editor/         # User personalization editor
│   ├── lib/            # Restricted serialize/deserialize, validation
│   └── hooks/          # useImageUpload, etc.
├── render/              # Server-side rendering
│   ├── canvasRenderer.ts
│   ├── variableMerger.ts
│   ├── fontManager.ts
│   └── pdfExporter.ts
├── production/          # Production hardening
│   ├── cache.ts        # Redis caching
│   ├── thumbnail.ts   # Thumbnail generation
│   ├── autosave.ts    # Autosave hook
│   └── validator.ts   # Security validation
├── enhancements/        # Canva-level features
│   ├── realTimePreview.ts
│   ├── productMockup.ts
│   ├── analytics.ts
│   └── versionRollback.ts
└── __tests__/          # Test files
```

## 🚀 Quick Start

### 1. Install dependencies

```bash
npm install fabric canvas pdfkit ioredis lodash
npm install -D jest @testing-library/react @testing-library/jest-dom playwright msw
```

### 2. Run tests

```bash
# Unit tests
npm test

# E2E tests
npm run test:e2e

# With coverage
npm run test:coverage
```

### 3. Example usage

```typescript
// Admin editor
import { createCanvasWithFabric, serializeCanvas } from '@/PixelCraft/editor';
import { fabric } from 'fabric';
const canvas = createCanvasWithFabric(canvasEl, spec, fabric);
const area = serializeCanvas(canvas, 'front', 'Front', spec);

// User editor
import { restrictedDeserialize, restrictedSerialize } from '@/PixelCraft/user-editor';
const editableFields = await restrictedDeserialize(canvas, area, fabric);
const variableValues = restrictedSerialize(canvas);

// Render service
import { renderArea } from '@/PixelCraft/render';
const png = await renderArea(area, { dpi: 300, physicalWidthMm: 210, physicalHeightMm: 297 });
```

## 📊 Feature Priority

**P0 (Critical):** Real-time preview, Live product mockups  
**P1 (High):** Template version rollback, Analytics  
**P2 (Medium):** A/B template testing  
**P3 (Low):** Collaboration

## 🔒 Security

- Template validation + signing (HMAC)
- Asset validation (file type, size, dimensions)
- Variable sanitization (remove HTML/scripts)
- Read-only published templates

## 📈 Performance

- Multi-layer caching (browser → CDN → Redis → DB)
- Worker pools for parallel rendering
- Thumbnail generation on publish
- Autosave with dual storage (localStorage + server)

## 🧪 Testing

See [09-testing-guide.md](./09-testing-guide.md) for comprehensive testing strategies.

---

**Built for:** Next.js (App Router), React + TypeScript, Node.js, Fabric.js, MongoDB/PostgreSQL
