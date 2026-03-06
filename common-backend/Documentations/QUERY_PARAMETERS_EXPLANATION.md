# Product API Query Parameters: showInactive & includeDeleted

## How They Work

### Default Values
- `showInactive = "true"` (default) - Shows both active AND inactive products
- `includeDeleted = "true"` (default) - Shows both deleted AND non-deleted products

### Parameter Logic

#### `includeDeleted` Parameter

**When `includeDeleted=false`:**
```javascript
if (includeDeleted === "false") {
  filter.deleted = false  // Only show products where deleted = false
}
```
- **Result**: Only returns products that are NOT deleted
- **MongoDB Query**: `{ deleted: false }`

**When `includeDeleted=true` (or not provided):**
- **Result**: Returns ALL products (both deleted and non-deleted)
- **MongoDB Query**: No filter on `deleted` field

#### `showInactive` Parameter

**When `showInactive=false`:**
```javascript
if (showInactive === "false") {
  filter.isActive = true  // Only show products where isActive = true
}
```
- **Result**: Only returns products that are active
- **MongoDB Query**: `{ isActive: true }`

**When `showInactive=true` (or not provided):**
- **Result**: Returns ALL products (both active and inactive)
- **MongoDB Query**: No filter on `isActive` field

## Example: `showInactive=false&includeDeleted=false`

### URL:
```
http://localhost:8080/api/products?showInactive=false&includeDeleted=false&limit=1000
```

### What Happens:
1. `includeDeleted=false` → Adds `{ deleted: false }` to filter
2. `showInactive=false` → Adds `{ isActive: true }` to filter

### Final MongoDB Query:
```javascript
{
  deleted: false,    // Exclude deleted products
  isActive: true     // Only show active products
}
```

### Result:
- ✅ Returns only **active, non-deleted** products
- ❌ Excludes inactive products
- ❌ Excludes deleted products

## All Parameter Combinations

| showInactive | includeDeleted | Result |
|--------------|----------------|--------|
| `true` (default) | `true` (default) | All products (active, inactive, deleted, non-deleted) |
| `true` | `false` | All active + inactive products, but NOT deleted |
| `false` | `true` | All active products (including deleted ones) |
| `false` | `false` | Only active, non-deleted products ✅ |

## Product Model Fields

From `product.model.js`:
- `isActive: { type: Boolean, default: true }` - Product active status
- `deleted: { type: Boolean, default: false }` - Soft delete flag

## Code Location

**File**: `backend/controllers/product.controller.js`
**Function**: `getAllProducts`
**Lines**: 109-122

```javascript
const { showInactive = "true", includeDeleted = "true" } = req.query

let filter = {}

if (includeDeleted === "false") {
  filter.deleted = false
}

if (showInactive === "false") {
  filter.isActive = true
}
```

## Important Notes

1. **String Comparison**: Parameters are compared as strings (`"false"` not `false`)
2. **Default Behavior**: If parameters are not provided, defaults to showing everything
3. **Combined Filters**: Both filters work together (AND logic)
4. **Case Sensitive**: Must be lowercase `"false"` or `"true"`

## Best Practice for Frontend

For the ProductsList page, use:
```
showInactive=false&includeDeleted=false
```

This ensures only active, non-deleted products are shown to users.
