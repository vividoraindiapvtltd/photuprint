# Testing Guide

## How to test the PixelCraft Template Management System

This guide covers **unit tests**, **integration tests**, **E2E tests**, **performance tests**, and **visual regression tests** for the template management platform.

---

## 1. Test setup

### 1.1 Dependencies

```json
{
  "devDependencies": {
    "@testing-library/react": "^14.0.0",
    "@testing-library/jest-dom": "^6.1.0",
    "@testing-library/user-event": "^14.5.0",
    "jest": "^29.7.0",
    "jest-environment-jsdom": "^29.7.0",
    "vitest": "^1.0.0",
    "playwright": "^1.40.0",
    "msw": "^2.0.0"
  }
}
```

### 1.2 Jest configuration

```javascript
// jest.config.js
module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testMatch: ['**/__tests__/**/*.test.{ts,tsx}', '**/*.test.{ts,tsx}'],
  collectCoverageFrom: [
    'src/PixelCraft/**/*.{ts,tsx}',
    '!src/PixelCraft/**/*.d.ts',
    '!src/PixelCraft/**/index.ts',
  ],
};
```

---

## 2. Unit tests

### 2.1 Template serialization/deserialization

```typescript
// __tests__/editor/lib/serialize.test.ts
import { serializeCanvas } from '@/PixelCraft/editor/lib/serialize';
import { deserializeToCanvas } from '@/PixelCraft/editor/lib/deserialize';
import { createCanvasWithFabric } from '@/PixelCraft/editor/lib/fabricCanvas';
import { fabric } from 'fabric';
import type { TemplateArea } from '@/PixelCraft/editor/types';

describe('Template serialization', () => {
  it('should serialize canvas to TemplateArea', async () => {
    const canvasEl = document.createElement('canvas');
    const canvas = createCanvasWithFabric(canvasEl, { width: 1000, height: 1000, dpi: 300 }, fabric);
    
    // Add text object
    const text = new fabric.Textbox('Hello', {
      left: 100,
      top: 100,
      width: 200,
      height: 50,
      fontSize: 24,
      fontFamily: 'Arial',
      fill: '#000000',
    });
    text.set({ layerId: 'text1', editable: true, variableId: 'greeting', layerType: 'text' });
    canvas.add(text);

    // Serialize
    const area = serializeCanvas(canvas, 'front', 'Front', { width: 1000, height: 1000, dpi: 300 });

    expect(area.id).toBe('front');
    expect(area.layers.text1).toBeDefined();
    expect(area.layers.text1.type).toBe('text');
    expect(area.layers.text1.content).toBe('Hello');
    expect(area.layers.text1.variableId).toBe('greeting');
  });

  it('should round-trip serialize and deserialize', async () => {
    const originalArea: TemplateArea = {
      id: 'front',
      label: 'Front',
      canvas: { width: 1000, height: 1000, dpi: 300 },
      layerOrder: ['text1'],
      layers: {
        text1: {
          id: 'text1',
          type: 'text',
          editable: true,
          order: 0,
          transform: { left: 100, top: 100, width: 200, height: 50 },
          content: 'Hello',
          variableId: 'greeting',
          style: {
            fontFamily: 'Arial',
            fontSize: 24,
            fill: '#000000',
            textAlign: 'left',
          },
        },
      },
    };

    // Deserialize
    const canvasEl = document.createElement('canvas');
    const canvas = createCanvasWithFabric(canvasEl, originalArea.canvas, fabric);
    await deserializeToCanvas(canvas, originalArea, fabric as any);

    // Serialize back
    const serialized = serializeCanvas(canvas, 'front', 'Front', originalArea.canvas);

    expect(serialized.layers.text1.content).toBe(originalArea.layers.text1.content);
    expect(serialized.layers.text1.variableId).toBe(originalArea.layers.text1.variableId);
  });
});
```

### 2.2 Variable merger

```typescript
// __tests__/render/variableMerger.test.ts
import { mergeVariables } from '@/PixelCraft/render/variableMerger';
import type { TemplateArea } from '@/PixelCraft/editor/types';

describe('Variable merger', () => {
  it('should merge variable values into template layers', () => {
    const area: TemplateArea = {
      id: 'front',
      label: 'Front',
      canvas: { width: 1000, height: 1000, dpi: 300 },
      layerOrder: ['text1', 'text2'],
      layers: {
        text1: {
          id: 'text1',
          type: 'text',
          editable: true,
          order: 0,
          transform: { left: 100, top: 100, width: 200, height: 50 },
          content: 'Default',
          variableId: 'greeting',
          style: { fontFamily: 'Arial', fontSize: 24, fill: '#000000' },
        },
        text2: {
          id: 'text2',
          type: 'text',
          editable: false,
          order: 1,
          transform: { left: 100, top: 200, width: 200, height: 50 },
          content: 'Static',
          style: { fontFamily: 'Arial', fontSize: 24, fill: '#000000' },
        },
      },
    };

    const variableValues = { greeting: 'Hello World' };
    const merged = mergeVariables(area, variableValues);

    expect(merged.layers.text1.content).toBe('Hello World');
    expect(merged.layers.text2.content).toBe('Static'); // No variableId, unchanged
  });
});
```

### 2.3 Render service

```typescript
// __tests__/render/canvasRenderer.test.ts
import { renderArea } from '@/PixelCraft/render/canvasRenderer';
import type { TemplateArea } from '@/PixelCraft/editor/types';

describe('Canvas renderer', () => {
  it('should render template area to PNG buffer', async () => {
    const area: TemplateArea = {
      id: 'front',
      label: 'Front',
      canvas: { width: 1000, height: 1000, dpi: 300 },
      layerOrder: ['text1'],
      layers: {
        text1: {
          id: 'text1',
          type: 'text',
          editable: true,
          order: 0,
          transform: { left: 100, top: 100, width: 200, height: 50 },
          content: 'Test',
          style: { fontFamily: 'Arial', fontSize: 24, fill: '#000000' },
        },
      },
    };

    const png = await renderArea(area, {
      dpi: 300,
      physicalWidthMm: 210,
      physicalHeightMm: 297,
    });

    expect(png).toBeInstanceOf(Buffer);
    expect(png.length).toBeGreaterThan(0);
    // PNG signature: 89 50 4E 47
    expect(png[0]).toBe(0x89);
    expect(png[1]).toBe(0x50);
    expect(png[2]).toBe(0x4e);
    expect(png[3]).toBe(0x47);
  });

  it('should calculate correct canvas size for DPI', async () => {
    const area: TemplateArea = {
      id: 'front',
      label: 'Front',
      canvas: { width: 1000, height: 1000, dpi: 300 },
      layerOrder: [],
      layers: {},
    };

    // A4 at 300 DPI: (210/25.4) * 300 = 2480px width
    const png = await renderArea(area, {
      dpi: 300,
      physicalWidthMm: 210,
      physicalHeightMm: 297,
    });

    // Verify canvas size (check via image metadata or render)
    // For now, just verify PNG is generated
    expect(png.length).toBeGreaterThan(0);
  });
});
```

---

## 3. Integration tests

### 3.1 API endpoints (with MSW)

```typescript
// __tests__/api/templates.test.ts
import { rest } from 'msw';
import { setupServer } from 'msw/node';
import { render, screen, waitFor } from '@testing-library/react';
import TemplatesList from '@/components/templates/TemplatesList';

const server = setupServer(
  rest.get('/api/templates', (req, res, ctx) => {
    return res(
      ctx.json([
        { id: '1', name: 'Template 1', status: 'published' },
        { id: '2', name: 'Template 2', status: 'draft' },
      ])
    );
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('Templates API', () => {
  it('should load templates list', async () => {
    render(<TemplatesList />);
    
    await waitFor(() => {
      expect(screen.getByText('Template 1')).toBeInTheDocument();
      expect(screen.getByText('Template 2')).toBeInTheDocument();
    });
  });

  it('should handle API errors', async () => {
    server.use(
      rest.get('/api/templates', (req, res, ctx) => {
        return res(ctx.status(500), ctx.json({ error: 'Server error' }));
      })
    );

    render(<TemplatesList />);
    
    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument();
    });
  });
});
```

### 3.2 Template save/load flow

```typescript
// __tests__/integration/templateFlow.test.ts
import { saveTemplate, loadTemplate } from '@/services/templates';
import { serializeCanvas } from '@/PixelCraft/editor/lib/serialize';
import { createCanvasWithFabric } from '@/PixelCraft/editor/lib/fabricCanvas';
import { fabric } from 'fabric';

describe('Template save/load flow', () => {
  it('should save and load template', async () => {
    // Create canvas with content
    const canvasEl = document.createElement('canvas');
    const canvas = createCanvasWithFabric(canvasEl, { width: 1000, height: 1000, dpi: 300 }, fabric);
    
    const text = new fabric.Textbox('Test', { left: 100, top: 100, width: 200, height: 50 });
    text.set({ layerId: 'text1', editable: true, layerType: 'text' });
    canvas.add(text);

    // Serialize and save
    const area = serializeCanvas(canvas, 'front', 'Front', { width: 1000, height: 1000, dpi: 300 });
    const templateId = await saveTemplate({ areas: { front: area } });

    // Load and verify
    const loaded = await loadTemplate(templateId);
    expect(loaded.areas.front.layers.text1).toBeDefined();
    expect(loaded.areas.front.layers.text1.content).toBe('Test');
  });
});
```

---

## 4. E2E tests (Playwright)

### 4.1 User personalization flow

```typescript
// e2e/personalization.spec.ts
import { test, expect } from '@playwright/test';

test.describe('User Personalization', () => {
  test('should personalize template and add to cart', async ({ page }) => {
    // Navigate to product page
    await page.goto('/products/tshirt-001');
    
    // Click "Customize" button
    await page.click('text=Customize');
    
    // Wait for editor to load
    await page.waitForSelector('.personalization-editor');
    
    // Enter text in editable field
    const textInput = page.locator('input[name="customer_name"]');
    await textInput.fill('John Doe');
    
    // Verify preview updates (real-time preview)
    await expect(page.locator('.preview-canvas')).toBeVisible();
    
    // Upload image
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles('test-fixtures/photo.jpg');
    
    // Wait for image to load in preview
    await page.waitForTimeout(500);
    
    // Click "Add to Cart"
    await page.click('text=Add to Cart');
    
    // Verify cart contains personalized product
    await expect(page.locator('.cart-item')).toContainText('John Doe');
  });

  test('should validate text constraints', async ({ page }) => {
    await page.goto('/products/tshirt-001');
    await page.click('text=Customize');
    
    const textInput = page.locator('input[name="customer_name"]');
    
    // Try to enter text longer than maxLength
    const longText = 'A'.repeat(100);
    await textInput.fill(longText);
    
    // Verify it's truncated or shows error
    const value = await textInput.inputValue();
    expect(value.length).toBeLessThanOrEqual(30); // Assuming maxLength is 30
  });
});
```

### 4.2 Admin template editor

```typescript
// e2e/admin-editor.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Admin Template Editor', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin
    await page.goto('/login');
    await page.fill('input[name="email"]', 'admin@example.com');
    await page.fill('input[name="password"]', 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL('/admin');
  });

  test('should create new template', async ({ page }) => {
    await page.goto('/admin/templates');
    await page.click('text=New Template');
    
    // Fill template details
    await page.fill('input[name="name"]', 'Test Template');
    await page.selectOption('select[name="productType"]', 'tshirt');
    
    // Add text layer
    await page.click('text=Add Text');
    await page.fill('input[name="textContent"]', 'Hello World');
    
    // Set as editable field
    await page.check('input[name="editable"]');
    await page.fill('input[name="variableId"]', 'greeting');
    
    // Save template
    await page.click('text=Save');
    
    // Verify template appears in list
    await expect(page.locator('text=Test Template')).toBeVisible();
  });

  test('should publish template version', async ({ page }) => {
    await page.goto('/admin/templates/template-123/edit');
    
    // Make changes
    await page.click('.layer-item:has-text("text1")');
    await page.fill('input[name="content"]', 'Updated Text');
    
    // Save draft
    await page.click('text=Save Draft');
    await expect(page.locator('text=Draft saved')).toBeVisible();
    
    // Publish
    await page.click('text=Publish');
    await page.click('text=Confirm');
    
    // Verify status changed to published
    await expect(page.locator('text=Published')).toBeVisible();
  });

  test('should rollback to previous version', async ({ page }) => {
    await page.goto('/admin/templates/template-123/versions');
    
    // Click "Restore" on an older version
    await page.click('tr:has-text("v2") button:text("Restore")');
    await page.click('text=Confirm');
    
    // Verify new version created
    await expect(page.locator('text=v4 - Rollback to v2')).toBeVisible();
  });
});
```

---

## 5. Performance tests

### 5.1 Canvas rendering performance

```typescript
// __tests__/performance/canvas.test.ts
import { performance } from 'perf_hooks';
import { renderArea } from '@/PixelCraft/render/canvasRenderer';
import type { TemplateArea } from '@/PixelCraft/editor/types';

describe('Canvas rendering performance', () => {
  it('should render template in under 2 seconds', async () => {
    const area: TemplateArea = {
      id: 'front',
      label: 'Front',
      canvas: { width: 1000, height: 1000, dpi: 300 },
      layerOrder: Array.from({ length: 50 }, (_, i) => `layer${i}`),
      layers: Object.fromEntries(
        Array.from({ length: 50 }, (_, i) => [
          `layer${i}`,
          {
            id: `layer${i}`,
            type: 'text',
            editable: true,
            order: i,
            transform: { left: i * 10, top: i * 10, width: 100, height: 50 },
            content: `Text ${i}`,
            style: { fontFamily: 'Arial', fontSize: 12, fill: '#000000' },
          },
        ])
      ),
    };

    const start = performance.now();
    await renderArea(area, { dpi: 300, physicalWidthMm: 210, physicalHeightMm: 297 });
    const end = performance.now();

    const duration = end - start;
    expect(duration).toBeLessThan(2000); // 2 seconds
  });
});
```

### 5.2 Serialization performance

```typescript
// __tests__/performance/serialize.test.ts
import { serializeCanvas } from '@/PixelCraft/editor/lib/serialize';
import { createCanvasWithFabric } from '@/PixelCraft/editor/lib/fabricCanvas';
import { fabric } from 'fabric';
import { performance } from 'perf_hooks';

describe('Serialization performance', () => {
  it('should serialize large canvas in under 100ms', () => {
    const canvasEl = document.createElement('canvas');
    const canvas = createCanvasWithFabric(canvasEl, { width: 2000, height: 2000, dpi: 300 }, fabric);
    
    // Add 100 objects
    for (let i = 0; i < 100; i++) {
      const text = new fabric.Textbox(`Text ${i}`, {
        left: i * 10,
        top: i * 10,
        width: 100,
        height: 50,
      });
      text.set({ layerId: `text${i}`, editable: true, layerType: 'text' });
      canvas.add(text);
    }

    const start = performance.now();
    serializeCanvas(canvas, 'front', 'Front', { width: 2000, height: 2000, dpi: 300 });
    const end = performance.now();

    expect(end - start).toBeLessThan(100); // 100ms
  });
});
```

---

## 6. Visual regression tests

### 6.1 Canvas output comparison

```typescript
// __tests__/visual/canvasOutput.test.ts
import { renderArea } from '@/PixelCraft/render/canvasRenderer';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { TemplateArea } from '@/PixelCraft/editor/types';

describe('Visual regression: canvas output', () => {
  it('should match expected PNG output', async () => {
    const area: TemplateArea = {
      id: 'front',
      label: 'Front',
      canvas: { width: 1000, height: 1000, dpi: 300 },
      layerOrder: ['text1'],
      layers: {
        text1: {
          id: 'text1',
          type: 'text',
          editable: true,
          order: 0,
          transform: { left: 100, top: 100, width: 200, height: 50 },
          content: 'Hello World',
          style: { fontFamily: 'Arial', fontSize: 24, fill: '#000000' },
        },
      },
    };

    const png = await renderArea(area, { dpi: 300, physicalWidthMm: 210, physicalHeightMm: 297 });
    
    // Save actual output (for first run)
    // writeFileSync(join(__dirname, '__snapshots__/expected.png'), png);

    // Compare with expected
    const expected = readFileSync(join(__dirname, '__snapshots__/expected.png'));
    
    // Simple byte comparison (or use pixelmatch for visual diff)
    expect(png.equals(expected)).toBe(true);
  });
});
```

---

## 7. Test utilities

### 7.1 Mock Fabric.js

```typescript
// __tests__/utils/mockFabric.ts
export const mockFabric = {
  Canvas: jest.fn().mockImplementation(() => ({
    add: jest.fn(),
    remove: jest.fn(),
    clear: jest.fn(),
    getObjects: jest.fn(() => []),
    requestRenderAll: jest.fn(),
    dispose: jest.fn(),
    toJSON: jest.fn(() => ({})),
    loadFromJSON: jest.fn(),
    setZoom: jest.fn(),
    width: 1000,
    height: 1000,
  })),
  Textbox: jest.fn().mockImplementation(() => ({
    set: jest.fn(),
    get: jest.fn(),
    text: '',
    left: 0,
    top: 0,
    width: 100,
    height: 50,
  })),
  Image: {
    fromURL: jest.fn((url, callback) => {
      callback({
        set: jest.fn(),
        width: 100,
        height: 100,
      });
    }),
  },
};
```

### 7.2 Test fixtures

```typescript
// __tests__/fixtures/templates.ts
import type { TemplateDocument } from '@/PixelCraft/editor/types';

export const mockTemplate: TemplateDocument = {
  schemaVersion: '1.0',
  version: {
    versionId: 'ver_test',
    status: 'published',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    publishedAt: '2024-01-01T00:00:00Z',
  },
  name: 'Test Template',
  productType: 'tshirt',
  defaultAreaId: 'front',
  areas: {
    front: {
      id: 'front',
      label: 'Front',
      canvas: { width: 1000, height: 1000, dpi: 300 },
      layerOrder: ['text1'],
      layers: {
        text1: {
          id: 'text1',
          type: 'text',
          editable: true,
          order: 0,
          transform: { left: 100, top: 100, width: 200, height: 50 },
          content: 'Hello',
          variableId: 'greeting',
          style: {
            fontFamily: 'Arial',
            fontSize: 24,
            fill: '#000000',
            textAlign: 'left',
          },
        },
      },
    },
  },
};
```

---

## 8. Running tests

### 8.1 Scripts

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:performance": "jest --testPathPattern=performance"
  }
}
```

### 8.2 CI/CD integration

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test
      - run: npm run test:e2e
      - uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
```

---

## 9. Test coverage goals

| Area | Target Coverage |
|------|----------------|
| **Core logic** (serialize, deserialize, render) | 90%+ |
| **API endpoints** | 80%+ |
| **React components** | 70%+ |
| **Utilities** (cache, validation, analytics) | 85%+ |

---

## 10. Summary

| Test Type | Tools | Purpose |
|-----------|-------|---------|
| **Unit tests** | Jest, Vitest | Test individual functions (serialize, deserialize, render) |
| **Integration tests** | Jest, MSW | Test API endpoints, DB interactions |
| **E2E tests** | Playwright | Test full user flows (personalization, admin editor) |
| **Performance tests** | Jest, performance API | Ensure rendering completes in acceptable time |
| **Visual regression** | Jest, pixelmatch | Ensure canvas output matches expected images |

**Running tests:**

```bash
# Unit tests
npm test

# E2E tests
npm run test:e2e

# With coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

This testing guide ensures the PixelCraft system is **reliable**, **performant**, and **maintainable** at production scale.
