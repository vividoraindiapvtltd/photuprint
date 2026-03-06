# Prompt 8: Canva-Level Enhancements

## Advanced features for best-in-class Template Manager

This document suggests **advanced features** that would elevate the Template Manager to Canva-level quality, prioritized by **business impact** (ROI, user value, implementation complexity).

**Features:** Template version rollback, live product mockups, real-time preview, collaboration, A/B template testing, analytics on template usage.

---

## Feature prioritization matrix

| Feature | Business Impact | User Value | Implementation Complexity | Priority |
|---------|----------------|------------|---------------------------|----------|
| **Real-time preview** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ | **P0 (Critical)** |
| **Live product mockups** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | **P0 (Critical)** |
| **Template version rollback** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ | **P1 (High)** |
| **Analytics on template usage** | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | **P1 (High)** |
| **A/B template testing** | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | **P2 (Medium)** |
| **Collaboration** | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | **P3 (Low)** |

**Priority rationale:**

- **P0 (Critical):** High business impact, high user value, low-medium complexity. These directly drive sales and user satisfaction.
- **P1 (High):** High business impact, medium-high complexity. Essential for operational excellence.
- **P2 (Medium):** Medium business impact, high complexity. Nice-to-have for optimization.
- **P3 (Low):** Lower business impact or very high complexity. Consider after core features are stable.

---

## P0: Real-time preview

### Business impact

- **Reduces returns:** Users see exactly what they'll get before ordering.
- **Increases conversion:** Confidence in design → higher add-to-cart rate.
- **Reduces support tickets:** Fewer "doesn't look right" complaints.

### Feature description

**Real-time preview** shows users their personalized design **instantly** as they type or upload images, without page refresh or server round-trip.

**Implementation:**

1. **Client-side rendering:** Use Fabric.js in browser to render preview at screen resolution (72 DPI).
2. **Debounced updates:** Update preview 100–200ms after user stops typing.
3. **Progressive enhancement:** Show low-res preview immediately; upgrade to high-res on idle.

### Code example

```typescript
// hooks/useRealTimePreview.ts
import { useEffect, useRef, useState } from 'react';
import { fabric } from 'fabric';
import type { TemplateArea } from '@/PixelCraft/editor/types';
import { deserializeToCanvas } from '@/PixelCraft/editor/lib/deserialize';
import { mergeVariables } from '@/PixelCraft/render/variableMerger';

export function useRealTimePreview(
  area: TemplateArea,
  variableValues: Record<string, string>
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<fabric.Canvas | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = new fabric.Canvas(canvasRef.current, {
      width: area.canvas.width,
      height: area.canvas.height,
      renderOnAddRemove: true,
    });
    fabricRef.current = canvas;
    setIsReady(true);
    return () => canvas.dispose();
  }, [area.canvas.width, area.canvas.height]);

  // Update preview when variableValues change (debounced)
  useEffect(() => {
    if (!fabricRef.current || !isReady) return;
    const timer = setTimeout(async () => {
      const mergedArea = mergeVariables(area, variableValues);
      await deserializeToCanvas(fabricRef.current!, mergedArea, fabric);
      fabricRef.current!.requestRenderAll();
    }, 150); // 150ms debounce
    return () => clearTimeout(timer);
  }, [area, variableValues, isReady]);

  return { canvasRef, isReady };
}
```

### UX best practices

- **Instant feedback:** Show preview update within 200ms.
- **Loading state:** Show skeleton/spinner only if update takes >500ms.
- **Error handling:** Fallback to static image if preview fails.
- **Mobile optimization:** Reduce preview resolution on mobile to save memory.

---

## P0: Live product mockups

### Business impact

- **Increases conversion:** Users see design on actual product (T-shirt, mug, poster) → higher confidence → more sales.
- **Reduces returns:** Users understand product context (size, placement, orientation).
- **Differentiation:** Competitors often show flat designs; mockups stand out.

### Feature description

**Live product mockups** render the personalized design onto a **3D product image** (T-shirt, mug, poster, etc.) in real-time, showing how it will look when printed.

**Implementation:**

1. **Product mockup images:** Pre-rendered product photos with "design area" masks (e.g. T-shirt front area).
2. **Design overlay:** Render user's design at correct size/position on mockup.
3. **Multiple views:** Show front, back, side views if applicable.

### Code example

```typescript
// components/mockup/ProductMockup.tsx
'use client';

import { useEffect, useRef } from 'react';
import { fabric } from 'fabric';
import type { TemplateArea } from '@/PixelCraft/editor/types';

interface ProductMockupProps {
  area: TemplateArea;
  variableValues: Record<string, string>;
  productType: string; // 'tshirt', 'mug', 'poster'
  view: 'front' | 'back' | 'side';
}

export function ProductMockup({ area, variableValues, productType, view }: ProductMockupProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mockupImageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !mockupImageRef.current) return;

    const canvas = new fabric.Canvas(canvasRef.current);
    
    // Load mockup image
    fabric.Image.fromURL(`/mockups/${productType}_${view}.png`, (mockupImg) => {
      canvas.setBackgroundImage(mockupImg, canvas.renderAll.bind(canvas), {
        scaleX: canvas.width! / mockupImg.width!,
        scaleY: canvas.height! / mockupImg.height!,
      });

      // Load user design
      renderUserDesign(canvas, area, variableValues, productType, view);
    });

    return () => canvas.dispose();
  }, [area, variableValues, productType, view]);

  return (
    <div className="product-mockup">
      <canvas ref={canvasRef} width={800} height={800} />
    </div>
  );
}

function renderUserDesign(
  canvas: fabric.Canvas,
  area: TemplateArea,
  variableValues: Record<string, string>,
  productType: string,
  view: string
) {
  // Get design area coordinates from mockup config
  const designArea = getDesignArea(productType, view); // { x, y, width, height }
  
  // Render user design at design area size
  // Scale template area to fit design area
  const scaleX = designArea.width / area.canvas.width;
  const scaleY = designArea.height / area.canvas.height;

  // Render layers
  Object.values(area.layers).forEach((layer) => {
    // Apply variable values, render at scaled position
    // ...
  });
}
```

### Mockup configuration

```typescript
// config/mockups.ts
export const mockupConfigs: Record<string, Record<string, { x: number; y: number; width: number; height: number }>> = {
  tshirt: {
    front: { x: 200, y: 150, width: 400, height: 500 },
    back: { x: 200, y: 150, width: 400, height: 500 },
  },
  mug: {
    front: { x: 150, y: 100, width: 300, height: 200 },
  },
  poster: {
    front: { x: 0, y: 0, width: 800, height: 1200 },
  },
};
```

---

## P1: Template version rollback

### Business impact

- **Reduces risk:** Quickly revert bad publishes without data loss.
- **Increases confidence:** Admins can experiment knowing they can rollback.
- **Operational efficiency:** Faster recovery from mistakes.

### Feature description

**Template version rollback** allows admins to **restore a previous published version** as the current live version, or create a new draft from any historical version.

**Implementation:**

1. **Version history UI:** List all versions (draft, published, archived) with timestamps and labels.
2. **Rollback action:** "Restore this version" button → creates new published version from selected version.
3. **Pin mapping:** Alternative: pin `product_template_mappings.template_version_id` to specific version (no new publish needed).

### Code example

```typescript
// components/template-editor/VersionHistory.tsx
'use client';

import { useState } from 'react';
import type { TemplateVersionMeta } from '@/PixelCraft/editor/types';

interface VersionHistoryProps {
  templateId: string;
  versions: TemplateVersionMeta[];
  currentVersionId: string;
  onRollback: (versionId: string) => Promise<void>;
}

export function VersionHistory({ templateId, versions, currentVersionId, onRollback }: VersionHistoryProps) {
  const [isRollingBack, setIsRollingBack] = useState<string | null>(null);

  const handleRollback = async (versionId: string) => {
    if (!confirm('Restore this version as the current published version?')) return;
    setIsRollingBack(versionId);
    try {
      await onRollback(versionId);
    } finally {
      setIsRollingBack(null);
    }
  };

  return (
    <div className="version-history">
      <h3>Version History</h3>
      <table>
        <thead>
          <tr>
            <th>Version</th>
            <th>Status</th>
            <th>Published</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {versions.map((version) => (
            <tr key={version.versionId}>
              <td>{version.label || `v${version.versionNumber}`}</td>
              <td>{version.status}</td>
              <td>{version.publishedAt ? new Date(version.publishedAt).toLocaleDateString() : '-'}</td>
              <td>
                {version.status === 'published' && version.versionId !== currentVersionId && (
                  <button
                    onClick={() => handleRollback(version.versionId)}
                    disabled={isRollingBack === version.versionId}
                  >
                    {isRollingBack === version.versionId ? 'Restoring...' : 'Restore'}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// API route: rollback version
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { versionId } = await req.json();
  const template = await loadTemplate(params.id);
  const targetVersion = await loadTemplateVersion(params.id, versionId);
  
  // Create new published version from target version
  const newVersion = {
    ...targetVersion,
    versionNumber: getNextVersionNumber(template),
    status: 'published',
    publishedAt: new Date().toISOString(),
  };
  
  await saveTemplateVersion(params.id, newVersion);
  return Response.json({ success: true, versionId: newVersion.versionId });
}
```

---

## P1: Analytics on template usage

### Business impact

- **Data-driven decisions:** Know which templates sell best; invest in winners.
- **Optimization:** Identify underperforming templates; improve or deprecate.
- **ROI tracking:** Measure template creation cost vs revenue generated.

### Feature description

**Analytics on template usage** tracks:
- Template views (admin + user)
- Personalizations started
- Add-to-cart rate
- Order conversion rate
- Revenue per template
- Average order value

### Implementation

```typescript
// services/analytics/templateAnalytics.ts
export interface TemplateAnalytics {
  templateId: string;
  templateVersionId: string;
  views: number;
  personalizationsStarted: number;
  addToCartCount: number;
  orderCount: number;
  revenue: number;
  avgOrderValue: number;
  conversionRate: number; // orders / personalizationsStarted
}

export async function trackTemplateView(templateId: string, userId?: string): Promise<void> {
  await analytics.track('template_viewed', {
    templateId,
    userId,
    timestamp: new Date().toISOString(),
  });
}

export async function trackPersonalizationStarted(
  templateId: string,
  productId: string,
  userId?: string
): Promise<void> {
  await analytics.track('personalization_started', {
    templateId,
    productId,
    userId,
    timestamp: new Date().toISOString(),
  });
}

export async function trackAddToCart(
  templateId: string,
  productId: string,
  variableValues: Record<string, string>,
  userId?: string
): Promise<void> {
  await analytics.track('add_to_cart', {
    templateId,
    productId,
    variableValues,
    userId,
    timestamp: new Date().toISOString(),
  });
}

export async function getTemplateAnalytics(
  templateId: string,
  dateRange: { start: Date; end: Date }
): Promise<TemplateAnalytics> {
  // Aggregate events from analytics DB/warehouse
  const views = await countEvents('template_viewed', { templateId, dateRange });
  const personalizations = await countEvents('personalization_started', { templateId, dateRange });
  const addToCarts = await countEvents('add_to_cart', { templateId, dateRange });
  const orders = await countOrders({ templateId, dateRange });
  const revenue = await sumRevenue({ templateId, dateRange });

  return {
    templateId,
    templateVersionId: '', // latest published
    views,
    personalizationsStarted: personalizations,
    addToCartCount: addToCarts,
    orderCount: orders,
    revenue,
    avgOrderValue: orders > 0 ? revenue / orders : 0,
    conversionRate: personalizations > 0 ? orders / personalizations : 0,
  };
}
```

### Analytics dashboard UI

```typescript
// components/analytics/TemplateAnalyticsDashboard.tsx
'use client';

import { useEffect, useState } from 'react';
import type { TemplateAnalytics } from '@/services/analytics/templateAnalytics';

export function TemplateAnalyticsDashboard({ templateId }: { templateId: string }) {
  const [analytics, setAnalytics] = useState<TemplateAnalytics | null>(null);

  useEffect(() => {
    loadAnalytics(templateId).then(setAnalytics);
  }, [templateId]);

  if (!analytics) return <div>Loading...</div>;

  return (
    <div className="analytics-dashboard">
      <h2>Template Analytics</h2>
      <div className="metrics">
        <Metric label="Views" value={analytics.views} />
        <Metric label="Personalizations" value={analytics.personalizationsStarted} />
        <Metric label="Add to Cart" value={analytics.addToCartCount} />
        <Metric label="Orders" value={analytics.orderCount} />
        <Metric label="Revenue" value={`$${analytics.revenue.toFixed(2)}`} />
        <Metric label="Conversion Rate" value={`${(analytics.conversionRate * 100).toFixed(1)}%`} />
      </div>
    </div>
  );
}
```

---

## P2: A/B template testing

### Business impact

- **Optimization:** Test which template variants convert better.
- **Data-driven design:** Make design decisions based on real user behavior.
- **Incremental improvement:** Small wins compound over time.

### Feature description

**A/B template testing** allows admins to create **multiple variants** of a template and automatically serve them to users (50/50 split or custom ratio), then measure which performs better.

**Implementation:**

1. **Variant creation:** Admin creates template variants (A, B, C, etc.) from base template.
2. **Traffic splitting:** System randomly assigns users to variants (cookie/session-based).
3. **Metrics tracking:** Track conversion rate per variant.
4. **Winner selection:** After statistical significance, auto-promote winner or manual selection.

### Code example

```typescript
// services/ab-testing/variantSelector.ts
export interface ABTest {
  testId: string;
  baseTemplateId: string;
  variants: Array<{ variantId: string; templateVersionId: string; trafficPercent: number }>;
  startDate: Date;
  endDate?: Date;
  status: 'active' | 'paused' | 'completed';
}

export function selectVariant(test: ABTest, userId?: string): string {
  // Use consistent hashing for same user
  const seed = userId || Math.random().toString();
  const hash = hashString(seed + test.testId);
  const random = hash % 100;

  let cumulative = 0;
  for (const variant of test.variants) {
    cumulative += variant.trafficPercent;
    if (random < cumulative) {
      return variant.templateVersionId;
    }
  }
  return test.variants[0].templateVersionId; // fallback
}

// Track variant assignment
export async function trackVariantAssignment(
  testId: string,
  variantId: string,
  userId?: string
): Promise<void> {
  await analytics.track('ab_test_assigned', {
    testId,
    variantId,
    userId,
    timestamp: new Date().toISOString(),
  });
}
```

---

## P3: Collaboration

### Business impact

- **Team efficiency:** Multiple designers can work on same template.
- **Faster iteration:** Real-time collaboration reduces back-and-forth.
- **Knowledge sharing:** Team members can learn from each other's work.

### Feature description

**Collaboration** enables multiple admins to **edit the same template simultaneously**, with real-time cursor positions, live updates, and conflict resolution.

**Implementation complexity:** Very high (requires WebSocket, operational transforms, conflict resolution).

**Simplified alternative:** **Comments and review workflow** (lower complexity, still valuable):
- Admins can leave comments on template versions.
- Review/approval workflow before publish.
- Activity feed showing who changed what.

### Code example (simplified: comments only)

```typescript
// components/collaboration/TemplateComments.tsx
'use client';

import { useState, useEffect } from 'react';

interface Comment {
  id: string;
  templateId: string;
  versionId: string;
  userId: string;
  userName: string;
  text: string;
  layerId?: string; // Comment on specific layer
  createdAt: string;
}

export function TemplateComments({ templateId, versionId }: { templateId: string; versionId: string }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');

  useEffect(() => {
    loadComments(templateId, versionId).then(setComments);
  }, [templateId, versionId]);

  const handleSubmit = async () => {
    await addComment(templateId, versionId, newComment);
    setNewComment('');
    // Reload comments
  };

  return (
    <div className="template-comments">
      <h3>Comments</h3>
      {comments.map((comment) => (
        <div key={comment.id} className="comment">
          <strong>{comment.userName}</strong>: {comment.text}
          <small>{new Date(comment.createdAt).toLocaleString()}</small>
        </div>
      ))}
      <textarea value={newComment} onChange={(e) => setNewComment(e.target.value)} />
      <button onClick={handleSubmit}>Add Comment</button>
    </div>
  );
}
```

---

## Implementation roadmap

### Phase 1 (Months 1–2): P0 features

1. **Real-time preview** (2 weeks)
   - Client-side Fabric.js rendering
   - Debounced updates
   - Mobile optimization

2. **Live product mockups** (3 weeks)
   - Mockup image library
   - Design overlay system
   - Multiple product types

**Expected impact:** +15–25% conversion rate, -30% returns.

### Phase 2 (Months 3–4): P1 features

3. **Template version rollback** (1 week)
   - Version history UI
   - Rollback API

4. **Analytics on template usage** (2 weeks)
   - Event tracking
   - Analytics dashboard
   - Revenue attribution

**Expected impact:** Better operational efficiency, data-driven decisions.

### Phase 3 (Months 5–6): P2 features

5. **A/B template testing** (3 weeks)
   - Variant creation
   - Traffic splitting
   - Metrics aggregation

**Expected impact:** +5–10% conversion rate through optimization.

### Phase 4 (Months 7+): P3 features

6. **Collaboration** (6+ weeks)
   - Comments system (simplified)
   - Review workflow
   - Activity feed

**Expected impact:** Improved team efficiency.

---

## Summary

| Feature | Priority | Business Impact | Implementation Time | Expected ROI |
|---------|----------|-----------------|---------------------|--------------|
| **Real-time preview** | P0 | ⭐⭐⭐⭐⭐ | 2 weeks | +15–25% conversion |
| **Live product mockups** | P0 | ⭐⭐⭐⭐⭐ | 3 weeks | +15–25% conversion, -30% returns |
| **Template version rollback** | P1 | ⭐⭐⭐⭐ | 1 week | Operational efficiency |
| **Analytics on template usage** | P1 | ⭐⭐⭐⭐ | 2 weeks | Data-driven decisions |
| **A/B template testing** | P2 | ⭐⭐⭐ | 3 weeks | +5–10% conversion |
| **Collaboration** | P3 | ⭐⭐⭐ | 6+ weeks | Team efficiency |

---

## File layout (reference implementation)

Code for the above lives under `PixelCraft/enhancements/`:

| File | Purpose |
|------|---------|
| **realTimePreview.ts** | `useRealTimePreview(options)` – React hook for instant client-side preview with debounced updates |
| **productMockup.ts** | `useProductMockup(options)` – React hook for rendering design on 3D product mockups; mockup configs |
| **analytics.ts** | `trackTemplateView`, `trackPersonalizationStarted`, `trackAddToCart`, `trackOrder`, `getTemplateAnalytics` |
| **versionRollback.ts** | `rollbackTemplateVersion`, `pinProductToVersion` – restore previous published version |
| **index.ts** | Public exports |

**Not yet implemented (structure only):** A/B testing utilities, collaboration features (comments, review workflow). Use the patterns in this doc to build them.

**Usage:**

```ts
// Real-time preview
import { useRealTimePreview } from '@/PixelCraft/enhancements';
const { canvasRef, isReady } = useRealTimePreview({ area, variableValues });

// Product mockups
import { useProductMockup } from '@/PixelCraft/enhancements';
const { canvasRef } = useProductMockup({ area, variableValues, productType: 'tshirt', view: 'front' });

// Analytics
import { trackTemplateView, trackAddToCart } from '@/PixelCraft/enhancements';
await trackTemplateView(templateId, versionId, userId);
await trackAddToCart(templateId, productId, variableValues, versionId, userId);

// Version rollback
import { rollbackTemplateVersion } from '@/PixelCraft/enhancements';
const result = await rollbackTemplateVersion(templateId, targetVersionId);
```

**Recommendation:** Start with **P0 features** (real-time preview + live mockups) for maximum business impact. These directly drive sales and user satisfaction with relatively low complexity. Then add **P1 features** for operational excellence, followed by **P2/P3** as resources allow.
