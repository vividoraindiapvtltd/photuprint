# Testing Quick Start

## How to test the PixelCraft system

### Prerequisites

```bash
npm install -D jest @testing-library/react @testing-library/jest-dom @testing-library/user-event
npm install -D playwright msw
```

### 1. Unit Tests

**Run all unit tests:**
```bash
npm test
```

**Run specific test file:**
```bash
npm test -- serialize.test.ts
```

**Watch mode (auto-rerun on changes):**
```bash
npm run test:watch
```

**With coverage:**
```bash
npm run test:coverage
```

### 2. Integration Tests

**Test API endpoints (with MSW mocks):**
```bash
npm test -- api
```

### 3. E2E Tests (Playwright)

**Run all E2E tests:**
```bash
npm run test:e2e
```

**Run with UI (interactive):**
```bash
npm run test:e2e:ui
```

**Run specific test:**
```bash
npx playwright test personalization.spec.ts
```

### 4. Performance Tests

**Run performance benchmarks:**
```bash
npm run test:performance
```

### 5. Visual Regression Tests

**Compare canvas output:**
```bash
npm test -- visual
```

## Test Files Location

- **Unit tests:** `src/PixelCraft/__tests__/*.test.ts`
- **E2E tests:** `e2e/*.spec.ts`
- **Test setup:** `src/PixelCraft/__tests__/setup.ts`

## Example Test Commands

```bash
# Test serialization
npm test -- serialize.test.ts

# Test variable merger
npm test -- variableMerger.test.ts

# Test user editor
npm test -- restrictedSerialize.test.ts

# Test E2E personalization flow
npm run test:e2e -- personalization.spec.ts

# Test admin editor E2E
npm run test:e2e -- admin-editor.spec.ts
```

## Coverage Goals

- Core logic (serialize, deserialize, render): **90%+**
- API endpoints: **80%+**
- React components: **70%+**
- Utilities: **85%+**

## CI/CD

Tests run automatically on:
- Push to main branch
- Pull requests
- See `.github/workflows/test.yml` for CI configuration
