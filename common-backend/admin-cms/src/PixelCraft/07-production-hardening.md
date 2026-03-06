# Prompt 7: Production Hardening

## Best practices for scaling to millions of templates and users

This document covers **performance optimization**, **caching strategies**, **template thumbnail generation**, **asset loading**, **autosave reliability**, **error handling**, and **security** for the personalization platform at production scale.

**Focus:** Scaling to millions of templates and users while maintaining performance, reliability, and security.

---

## 1. Performance optimization

### 1.1 Canvas optimization

**Problem:** Large Fabric.js canvases (1000+ objects) cause lag, memory issues, and slow rendering.

**Solutions:**

| Optimization | Implementation |
|--------------|----------------|
| **Object pooling** | Reuse Fabric objects instead of creating new ones |
| **Lazy rendering** | Render only visible objects (viewport culling) |
| **Debounce updates** | Batch canvas updates (e.g. 16ms = 60fps) |
| **Virtual scrolling** | For layer panels with 100+ layers, render only visible items |
| **Canvas size limits** | Cap editor canvas at reasonable size (e.g. 2000×2000px); server renders at full DPI |

**Code:**

```typescript
// hooks/useCanvasOptimization.ts
import { useCallback, useRef } from 'react';
import type { FabricCanvas } from '@/PixelCraft/editor/lib/fabricCanvas';

const UPDATE_THROTTLE_MS = 16; // 60fps

export function useCanvasOptimization(canvas: FabricCanvas | null) {
  const updateTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingUpdatesRef = useRef<(() => void)[]>([]);

  const scheduleUpdate = useCallback((updateFn: () => void) => {
    pendingUpdatesRef.current.push(updateFn);

    if (updateTimerRef.current) return;

    updateTimerRef.current = setTimeout(() => {
      if (!canvas) return;
      
      // Batch all pending updates
      pendingUpdatesRef.current.forEach((fn) => fn());
      pendingUpdatesRef.current = [];
      
      canvas.requestRenderAll();
      updateTimerRef.current = null;
    }, UPDATE_THROTTLE_MS);
  }, [canvas]);

  return { scheduleUpdate };
}
```

### 1.2 JSON optimization

**Problem:** Large template JSON (10MB+) causes slow API responses, high memory usage, and slow serialization.

**Solutions:**

| Optimization | Implementation |
|--------------|----------------|
| **Compression** | Gzip/Brotli compression for API responses (Next.js/Express) |
| **Lazy loading** | Load template areas on-demand (not all at once) |
| **JSON streaming** | Stream large JSON for very large templates |
| **Field selection** | API returns only needed fields (e.g. exclude full document for list view) |
| **Pagination** | Paginate template lists (e.g. 50 per page) |

**Code:**

```typescript
// API route: return compressed JSON
import { gzip } from 'zlib';
import { promisify } from 'util';

const gzipAsync = promisify(gzip);

export async function GET(req: Request) {
  const templates = await getTemplates();
  const json = JSON.stringify(templates);
  const compressed = await gzipAsync(Buffer.from(json));
  
  return new Response(compressed, {
    headers: {
      'Content-Type': 'application/json',
      'Content-Encoding': 'gzip',
    },
  });
}

// Client: lazy load areas
export async function loadTemplateArea(templateId: string, areaId: string) {
  const response = await fetch(`/api/templates/${templateId}/areas/${areaId}`);
  return response.json();
}
```

### 1.3 Rendering optimization

**Problem:** Server-side rendering at 300 DPI is slow (5–30s per render) and blocks workers.

**Solutions:**

| Optimization | Implementation |
|--------------|----------------|
| **Worker pools** | Parallelize renders across multiple workers (e.g. 4–8 workers) |
| **Render queue** | Queue renders; process async (Bull/Agenda/Redis) |
| **Caching** | Cache renders by template version + variable hash |
| **Progressive rendering** | Render low-res preview first, then high-res |
| **CDN caching** | Cache rendered PNGs/PDFs in CDN (long TTL) |

**Code:**

```typescript
// services/render/workerPool.ts
import { WorkerPool } from 'workerpool';

const pool = WorkerPool('./renderWorker.js', {
  maxWorkers: 4,
  minWorkers: 2,
});

export async function renderInParallel(
  jobs: Array<{ area: TemplateArea; variableValues: Record<string, string> }>
): Promise<Buffer[]> {
  const promises = jobs.map((job) =>
    pool.exec('renderArea', [job.area, job.variableValues, { dpi: 300 }])
  );
  return Promise.all(promises);
}
```

---

## 2. Caching strategies

### 2.1 Multi-layer caching

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 1: Browser Cache (HTTP Cache-Control)                │
│  • Template JSON: 1 hour                                    │
│  • Assets (images, fonts): 1 year                           │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  Layer 2: CDN Cache (Cloudflare/Fastly)                     │
│  • Template JSON: 5 minutes                                 │
│  • Rendered PNGs/PDFs: 24 hours                            │
│  • Thumbnails: 7 days                                       │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  Layer 3: Application Cache (Redis)                        │
│  • Template document: 10 minutes                           │
│  • Rendered outputs: 1 hour (by hash)                      │
│  • Thumbnails: 24 hours                                     │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  Layer 4: Database (MongoDB/PostgreSQL)                    │
│  • Source of truth                                          │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Cache keys and invalidation

**Template document cache:**

```typescript
// Cache key: template:{templateId}:version:{versionId}
const cacheKey = `template:${templateId}:version:${versionId}`;

// Invalidate on publish/update
await redis.del(`template:${templateId}:version:*`);
```

**Rendered output cache:**

```typescript
// Cache key: render:{templateVersionId}:{hash(variableValues)}:{areaId}:{dpi}
import crypto from 'crypto';

function hashVariableValues(values: Record<string, string>): string {
  const sorted = Object.keys(values).sort().map(k => `${k}:${values[k]}`).join('|');
  return crypto.createHash('sha256').update(sorted).digest('hex').slice(0, 16);
}

const cacheKey = `render:${templateVersionId}:${hashVariableValues(variableValues)}:${areaId}:300`;
```

**Invalidation strategy:**

- **Template publish:** Invalidate all renders for that template version.
- **Template update:** Invalidate template document cache; renders remain cached (old version still valid).
- **TTL-based:** Set TTL (e.g. 1 hour) for renders; refresh on access.

### 2.3 Redis caching implementation

```typescript
// services/cache/redisCache.ts
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

export async function getCached<T>(key: string): Promise<T | null> {
  const cached = await redis.get(key);
  return cached ? JSON.parse(cached) : null;
}

export async function setCached(key: string, value: any, ttlSeconds: number = 3600): Promise<void> {
  await redis.setex(key, ttlSeconds, JSON.stringify(value));
}

export async function invalidatePattern(pattern: string): Promise<void> {
  const keys = await redis.keys(pattern);
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}

// Usage
const template = await getCached<TemplateDocument>(`template:${templateId}:version:${versionId}`);
if (!template) {
  template = await loadTemplateFromDB(templateId, versionId);
  await setCached(`template:${templateId}:version:${versionId}`, template, 600); // 10 min
}
```

---

## 3. Template thumbnail generation

### 3.1 Thumbnail strategy

**Problem:** Loading full template JSON + rendering full canvas for list views is slow.

**Solution:** Generate thumbnails at template publish time; store in blob storage; serve via CDN.

**Thumbnail specs:**

- **Size:** 200×200px (or aspect-ratio preserved, max 200px)
- **Format:** PNG or WebP
- **DPI:** 72 DPI (screen preview, not print)
- **Storage:** S3/CDN with long TTL (7 days)

### 3.2 Thumbnail generation code

```typescript
// services/thumbnail/generator.ts
import { renderArea } from '@/PixelCraft/render';
import type { TemplateArea } from '@/PixelCraft/editor/types';

export async function generateThumbnail(
  area: TemplateArea,
  options: { width: number; height: number } = { width: 200, height: 200 }
): Promise<Buffer> {
  // Render at low DPI (72) and small size
  const aspectRatio = area.canvas.width / area.canvas.height;
  let thumbWidth = options.width;
  let thumbHeight = options.height;

  if (aspectRatio > 1) {
    thumbHeight = Math.round(thumbWidth / aspectRatio);
  } else {
    thumbWidth = Math.round(thumbHeight * aspectRatio);
  }

  // Render at 72 DPI (screen preview)
  const png = await renderArea(area, {
    dpi: 72,
    physicalWidthMm: (thumbWidth / 72) * 25.4, // Convert px to mm
    physicalHeightMm: (thumbHeight / 72) * 25.4,
  });

  return png;
}

// Generate on template publish
export async function generateThumbnailsForTemplate(template: TemplateDocument): Promise<Record<string, string>> {
  const thumbnails: Record<string, string> = {};

  for (const [areaId, area] of Object.entries(template.areas)) {
    const thumbnail = await generateThumbnail(area);
    const s3Path = await uploadToS3(thumbnail, `thumbnails/${template.version.versionId}/${areaId}.png`);
    thumbnails[areaId] = s3Path;
  }

  return thumbnails;
}
```

### 3.3 Thumbnail API endpoint

```typescript
// app/api/templates/[id]/thumbnail/route.ts
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const { id } = params;
  const areaId = req.nextUrl.searchParams.get('area') || 'front';

  // Check cache
  const cacheKey = `thumbnail:${id}:${areaId}`;
  const cached = await getCached<string>(cacheKey);
  if (cached) {
    return Response.redirect(cached); // Redirect to CDN URL
  }

  // Generate thumbnail
  const template = await loadTemplate(id);
  const area = template.areas[areaId];
  const thumbnail = await generateThumbnail(area);
  const s3Path = await uploadToS3(thumbnail, `thumbnails/${id}/${areaId}.png`);

  // Cache CDN URL
  await setCached(cacheKey, s3Path, 7 * 24 * 3600); // 7 days

  return Response.redirect(s3Path);
}
```

---

## 4. Asset loading

### 4.1 Asset optimization

**Problem:** Loading 100+ images/fonts per template causes slow page loads and high bandwidth.

**Solutions:**

| Optimization | Implementation |
|--------------|----------------|
| **CDN delivery** | Serve all assets via CDN (Cloudflare/Fastly) |
| **Lazy loading** | Load images on-demand (when area is viewed) |
| **Image optimization** | Serve WebP/AVIF with fallback; compress images |
| **Font subsetting** | Include only used glyphs in font files |
| **Preloading** | Preload critical assets (fonts, logo) |

**Code:**

```typescript
// components/template-editor/AssetLoader.tsx
'use client';

import { useEffect, useState } from 'react';

export function useAssetPreload(urls: string[]): { loaded: number; total: number } {
  const [loaded, setLoaded] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let loadedCount = 0;

    urls.forEach((url) => {
      const img = new Image();
      img.onload = img.onerror = () => {
        if (!cancelled) {
          loadedCount++;
          setLoaded(loadedCount);
        }
      };
      img.src = url;
    });

    return () => {
      cancelled = true;
    };
  }, [urls]);

  return { loaded, total: urls.length };
}
```

### 4.2 Asset resolver (server-side)

```typescript
// services/assets/resolver.ts
import { downloadAndCache } from './cache';

export async function resolveAsset(src: string): Promise<string> {
  // If already a CDN URL, return as-is
  if (src.startsWith('https://cdn.')) {
    return src;
  }

  // If asset key, resolve to CDN URL
  if (src.startsWith('assets/')) {
    const cdnUrl = `https://cdn.example.com/${src}`;
    return cdnUrl;
  }

  // If external URL, download and cache, then return CDN URL
  if (src.startsWith('http')) {
    const cached = await downloadAndCache(src);
    return cached;
  }

  return src;
}

// Batch resolve for template
export async function resolveTemplateAssets(template: TemplateDocument): Promise<void> {
  const assetUrls: string[] = [];

  Object.values(template.areas).forEach((area) => {
    Object.values(area.layers).forEach((layer) => {
      if (layer.type === 'image') {
        assetUrls.push(layer.src);
      }
    });
  });

  // Resolve in parallel (limit concurrency)
  const resolved = await Promise.all(assetUrls.map(resolveAsset));

  // Update template with resolved URLs (or store mapping)
  // ...
}
```

---

## 5. Autosave reliability

### 5.1 Autosave strategy

**Problem:** Browser crashes, network failures, or server errors cause data loss.

**Solutions:**

| Strategy | Implementation |
|----------|----------------|
| **Dual storage** | Save to localStorage + server (localStorage as backup) |
| **Debounce + queue** | Debounce saves (2s); queue failed saves for retry |
| **Version conflict handling** | Detect conflicts (optimistic locking); merge or prompt user |
| **Offline support** | Queue saves when offline; sync when online |

**Code:**

```typescript
// hooks/useAutosave.ts
import { useEffect, useRef, useCallback } from 'react';
import { debounce } from 'lodash';

const AUTOSAVE_DEBOUNCE_MS = 2000;
const MAX_RETRIES = 3;

export function useAutosave(
  templateId: string,
  serialize: () => TemplateDocument,
  onSave: (doc: TemplateDocument) => Promise<void>
) {
  const saveQueueRef = useRef<Array<{ doc: TemplateDocument; retries: number }>>([]);
  const isOnlineRef = useRef(navigator.onLine);

  // Save to localStorage as backup
  const saveToLocalStorage = useCallback((doc: TemplateDocument) => {
    try {
      localStorage.setItem(`template_draft_${templateId}`, JSON.stringify(doc));
    } catch (error) {
      console.error('Failed to save to localStorage:', error);
    }
  }, [templateId]);

  // Save to server
  const saveToServer = useCallback(async (doc: TemplateDocument) => {
    try {
      await onSave(doc);
      saveToLocalStorage(doc); // Update localStorage on success
    } catch (error) {
      // Queue for retry
      saveQueueRef.current.push({ doc, retries: 0 });
      throw error;
    }
  }, [onSave, saveToLocalStorage]);

  // Retry failed saves
  const retryFailedSaves = useCallback(async () => {
    if (!isOnlineRef.current || saveQueueRef.current.length === 0) return;

    const failed = saveQueueRef.current.filter((item) => item.retries < MAX_RETRIES);
    saveQueueRef.current = [];

    for (const item of failed) {
      try {
        await saveToServer(item.doc);
      } catch (error) {
        saveQueueRef.current.push({ ...item, retries: item.retries + 1 });
      }
    }
  }, [saveToServer]);

  // Debounced autosave
  const debouncedSave = useCallback(
    debounce(async () => {
      const doc = serialize();
      saveToLocalStorage(doc); // Immediate localStorage save
      
      if (isOnlineRef.current) {
        await saveToServer(doc).catch(() => {
          // Already queued in saveToServer
        });
      }
    }, AUTOSAVE_DEBOUNCE_MS),
    [serialize, saveToLocalStorage, saveToServer]
  );

  // Online/offline handlers
  useEffect(() => {
    const handleOnline = () => {
      isOnlineRef.current = true;
      retryFailedSaves();
    };
    const handleOffline = () => {
      isOnlineRef.current = false;
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [retryFailedSaves]);

  return { save: debouncedSave, retryFailedSaves };
}
```

### 5.2 Conflict resolution

```typescript
// services/template/conflictResolver.ts
export async function saveWithConflictResolution(
  templateId: string,
  newDoc: TemplateDocument,
  currentVersion: string
): Promise<{ success: boolean; conflict?: boolean }> {
  // Load current version from DB
  const currentDoc = await loadTemplateVersion(templateId, currentVersion);

  // Check for conflicts (optimistic locking)
  if (currentDoc.version.updatedAt !== newDoc.version.updatedAt) {
    // Conflict: another user saved
    return { success: false, conflict: true };
  }

  // Save new version
  await saveTemplateVersion(templateId, newDoc);
  return { success: true };
}
```

---

## 6. Error handling

### 6.1 Error boundaries and fallbacks

**Frontend:**

```typescript
// components/ErrorBoundary.tsx
'use client';

import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    // Log to error tracking service (Sentry, etc.)
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div>
          <h2>Something went wrong</h2>
          <button onClick={() => this.setState({ hasError: false })}>Try again</button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

**Backend:**

```typescript
// services/render/errorHandler.ts
export async function handleRenderError(error: Error, jobId: string): Promise<void> {
  // Log error
  console.error(`Render job ${jobId} failed:`, error);

  // Notify monitoring (Sentry, Datadog, etc.)
  await notifyError({
    service: 'render',
    jobId,
    error: error.message,
    stack: error.stack,
  });

  // Update job status
  await updateJobStatus(jobId, 'failed', { error: error.message });

  // Retry if transient error
  if (isTransientError(error)) {
    await retryJob(jobId);
  }
}

function isTransientError(error: Error): boolean {
  // Network errors, timeouts, etc.
  return error.message.includes('timeout') || error.message.includes('ECONNRESET');
}
```

### 6.2 Graceful degradation

```typescript
// components/template-editor/GracefulCanvas.tsx
export function GracefulCanvas({ template, onError }: Props) {
  const [fallback, setFallback] = useState(false);

  if (fallback) {
    // Fallback: show static image preview instead of interactive canvas
    return <StaticPreview template={template} />;
  }

  return (
    <ErrorBoundary
      fallback={<StaticPreview template={template} />}
      onError={() => setFallback(true)}
    >
      <FabricCanvas template={template} />
    </ErrorBoundary>
  );
}
```

---

## 7. Security

### 7.1 Template tampering prevention

**Problem:** Users or attackers modify template JSON to inject malicious content or bypass restrictions.

**Solutions:**

| Security measure | Implementation |
|------------------|----------------|
| **Server-side validation** | Validate template JSON schema on save/load |
| **Signed templates** | Sign template JSON with HMAC; verify on load |
| **Read-only published** | Published templates are immutable; only draft can be edited |
| **Variable whitelist** | Only allow variable values that match constraints |

**Code:**

```typescript
// services/template/validator.ts
import { z } from 'zod';
import type { TemplateDocument } from '@/PixelCraft/editor/types';

const TemplateDocumentSchema = z.object({
  schemaVersion: z.string(),
  version: z.object({
    versionId: z.string(),
    status: z.enum(['draft', 'published', 'archived']),
  }),
  areas: z.record(z.any()),
});

export function validateTemplate(doc: unknown): TemplateDocument {
  return TemplateDocumentSchema.parse(doc);
}

// Sign template on publish
import crypto from 'crypto';

const SECRET = process.env.TEMPLATE_SIGNING_SECRET!;

export function signTemplate(doc: TemplateDocument): string {
  const json = JSON.stringify(doc);
  return crypto.createHmac('sha256', SECRET).update(json).digest('hex');
}

export function verifyTemplate(doc: TemplateDocument, signature: string): boolean {
  const expected = signTemplate(doc);
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
```

### 7.2 Asset validation

**Problem:** Malicious images (malware, oversized files) uploaded by users.

**Solutions:**

| Security measure | Implementation |
|------------------|----------------|
| **File type validation** | Check MIME type and file extension |
| **File size limits** | Enforce max file size (e.g. 10MB) |
| **Image scanning** | Scan images for malware (ClamAV, etc.) |
| **Dimension limits** | Enforce max width/height |
| **Content validation** | Verify image is valid (can be loaded/rendered) |

**Code:**

```typescript
// services/assets/validator.ts
import sharp from 'sharp';
import { fileTypeFromBuffer } from 'file-type';

export interface ValidationResult {
  valid: boolean;
  error?: string;
  metadata?: {
    width: number;
    height: number;
    format: string;
    size: number;
  };
}

export async function validateImage(file: Buffer, constraints?: {
  maxSizeBytes?: number;
  maxWidth?: number;
  maxHeight?: number;
  allowedMimeTypes?: string[];
}): Promise<ValidationResult> {
  // Check file type
  const fileType = await fileTypeFromBuffer(file);
  if (!fileType || !fileType.mime.startsWith('image/')) {
    return { valid: false, error: 'Invalid file type' };
  }

  if (constraints?.allowedMimeTypes && !constraints.allowedMimeTypes.includes(fileType.mime)) {
    return { valid: false, error: `MIME type not allowed: ${fileType.mime}` };
  }

  // Check file size
  if (constraints?.maxSizeBytes && file.length > constraints.maxSizeBytes) {
    return { valid: false, error: `File too large: ${file.length} bytes` };
  }

  // Get image metadata
  const metadata = await sharp(file).metadata();

  if (!metadata.width || !metadata.height) {
    return { valid: false, error: 'Invalid image dimensions' };
  }

  // Check dimensions
  if (constraints?.maxWidth && metadata.width > constraints.maxWidth) {
    return { valid: false, error: `Width too large: ${metadata.width}px` };
  }

  if (constraints?.maxHeight && metadata.height > constraints.maxHeight) {
    return { valid: false, error: `Height too large: ${metadata.height}px` };
  }

  return {
    valid: true,
    metadata: {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format ?? 'unknown',
      size: file.length,
    },
  };
}
```

### 7.3 Variable value sanitization

```typescript
// services/template/sanitizer.ts
import DOMPurify from 'isomorphic-dompurify';

export function sanitizeVariableValue(value: string, type: 'text' | 'image'): string {
  if (type === 'text') {
    // Remove HTML tags, scripts, etc.
    return DOMPurify.sanitize(value, { ALLOWED_TAGS: [] });
  }
  
  // For images, validate URL
  if (type === 'image') {
    try {
      const url = new URL(value);
      // Only allow HTTPS and whitelisted domains
      if (url.protocol !== 'https:') {
        throw new Error('Only HTTPS URLs allowed');
      }
      const allowedDomains = ['cdn.example.com', 's3.amazonaws.com'];
      if (!allowedDomains.some(domain => url.hostname.endsWith(domain))) {
        throw new Error('Domain not allowed');
      }
      return value;
    } catch {
      throw new Error('Invalid image URL');
    }
  }

  return value;
}
```

---

## 8. Summary

| Area | Best Practice |
|------|---------------|
| **Performance** | Object pooling, lazy rendering, debounce updates, worker pools, compression |
| **Caching** | Multi-layer (browser → CDN → Redis → DB); cache by hash; TTL-based invalidation |
| **Thumbnails** | Generate on publish; 200×200px at 72 DPI; store in CDN with long TTL |
| **Asset loading** | CDN delivery, lazy loading, image optimization, font subsetting |
| **Autosave** | Dual storage (localStorage + server), debounce + queue, conflict resolution, offline support |
| **Error handling** | Error boundaries, graceful degradation, retry logic, monitoring |
| **Security** | Template validation + signing, asset validation, variable sanitization, read-only published |

**Scaling to millions:**

- **Horizontal scaling:** Stateless workers; scale workers independently.
- **Database sharding:** Shard templates by website/tenant.
- **CDN:** Serve all static assets and renders via CDN.
- **Caching:** Aggressive caching at all layers; cache renders by hash.
- **Queue:** Use Redis-backed queue (Bull/Agenda) for async renders.
- **Monitoring:** Track render times, cache hit rates, error rates; alert on anomalies.

---

## 9. File layout (reference implementation)

Code for the above lives under `PixelCraft/production/`:

| File | Purpose |
|------|---------|
| **cache.ts** | Redis caching utilities: `getCached`, `setCached`, `invalidatePattern`, cache key generators |
| **thumbnail.ts** | `generateThumbnail(area, options)` – generate 200×200px thumbnails at 72 DPI |
| **autosave.ts** | `useAutosave(options)` – React hook for dual storage (localStorage + server) with retry |
| **validator.ts** | `signTemplate`, `verifyTemplate`, `validateTemplateStructure`, `sanitizeVariableValue`, `validateImageFile` |
| **index.ts** | Public exports |

**Dependencies:**

```json
{
  "dependencies": {
    "ioredis": "^5.3.2",
    "lodash": "^4.17.21",
    "sharp": "^0.32.6"
  },
  "devDependencies": {
    "@types/lodash": "^4.14.202"
  }
}
```

**Usage:**

```ts
// Caching
import { getCached, setCached, cacheKeys } from '@/PixelCraft/production';
const template = await getCached(cacheKeys.template(templateId, versionId));

// Thumbnails
import { generateThumbnail } from '@/PixelCraft/production';
const thumbnail = await generateThumbnail(area, { width: 200, height: 200 });

// Autosave
import { useAutosave } from '@/PixelCraft/production';
const { save } = useAutosave({ templateId, serialize, onSave });

// Security
import { signTemplate, verifyTemplate, sanitizeVariableValue } from '@/PixelCraft/production';
const signature = signTemplate(template);
const isValid = verifyTemplate(template, signature);
const sanitized = sanitizeVariableValue(userInput, 'text');
```

This design keeps the platform **performant**, **reliable**, and **secure** at production scale, supporting millions of templates and users.
