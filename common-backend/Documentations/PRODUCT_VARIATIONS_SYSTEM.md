# Product Variations System Documentation

## Overview

A complete Product Variations system similar to Amazon/Flipkart for managing product variants with different attributes (Size, Color, Material, etc.). Each variant can have its own SKU, price, stock, images, and status.

## Architecture

### Backend (Node.js/Express/MongoDB)

#### Models

1. **ProductVariant Model** (`backend/models/productVariant.model.js`)
   - Stores individual variant information
   - Supports flexible attribute-based variations
   - Auto-generates SKU from product SKU + attributes
   - Tracks stock, pricing, images per variant

2. **Product Model** (Updated)
   - Added `hasVariations` flag
   - Added `variationAttributes` array
   - Added `defaultVariant` reference

#### Controllers

**ProductVariant Controller** (`backend/controllers/productVariant.controller.js`)

Key Functions:
- `createVariants` - Create variants from attribute combinations
- `getProductVariants` - Get all variants for a product
- `getVariantById` - Get single variant
- `updateVariant` - Update variant details
- `updateVariantStock` - Update stock (set/add/subtract)
- `updateVariantStatus` - Enable/disable variant
- `deleteVariant` - Soft delete variant
- `bulkUpdateVariants` - Bulk update multiple variants

#### Routes

**ProductVariant Routes** (`backend/routes/productVariant.routes.js`)

- `POST /api/products/:productId/variants` - Create variants
- `GET /api/products/:productId/variants` - Get all variants
- `PUT /api/products/:productId/variants/bulk` - Bulk update
- `GET /api/variants/:variantId` - Get single variant
- `PUT /api/variants/:variantId` - Update variant
- `PATCH /api/variants/:variantId/stock` - Update stock
- `PATCH /api/variants/:variantId/status` - Update status
- `DELETE /api/variants/:variantId` - Delete variant

### Frontend (React)

**ProductVariations Component** (`admin-cms/src/components/ProductVariations.js`)

Features:
- Attribute selection (Size, Color, etc.)
- Auto-generate variant combinations
- Table view of all variants
- Inline editing of price, SKU, stock
- Stock management with low stock alerts
- Status toggle (Active/Inactive)
- Stock aggregation and statistics

## Usage Guide

### Creating Variants

#### Method 1: Generate from Attributes

```javascript
// POST /api/products/:productId/variants
{
  "attributes": {
    "size": ["size_id_1", "size_id_2", "size_id_3"],
    "color": ["color_id_1", "color_id_2"]
  }
}

// This will generate 3 × 2 = 6 variants:
// - Size: S, Color: Red
// - Size: S, Color: Blue
// - Size: M, Color: Red
// - Size: M, Color: Blue
// - Size: L, Color: Red
// - Size: L, Color: Blue
```

#### Method 2: Create Variants Directly

```javascript
// POST /api/products/:productId/variants
{
  "variants": [
    {
      "attributes": {
        "size": "size_id_1",
        "color": "color_id_1"
      },
      "price": 999.00,
      "stock": 50,
      "sku": "PROD-S-RED",
      "isActive": true
    },
    {
      "attributes": {
        "size": "size_id_2",
        "color": "color_id_1"
      },
      "price": 1099.00,
      "stock": 30,
      "sku": "PROD-M-RED",
      "isActive": true
    }
  ]
}
```

### Updating Variant Stock

```javascript
// PATCH /api/variants/:variantId/stock
{
  "stock": 100,
  "operation": "set"  // "set", "add", or "subtract"
}

// Add stock
{
  "stock": 10,
  "operation": "add"
}

// Subtract stock
{
  "stock": 5,
  "operation": "subtract"
}
```

### Updating Variant Status

```javascript
// PATCH /api/variants/:variantId/status
{
  "isActive": false  // Disable variant
}
```

### Bulk Update Variants

```javascript
// PUT /api/products/:productId/variants/bulk
{
  "variants": [
    {
      "variantId": "variant_id_1",
      "updates": {
        "price": 899.00,
        "stock": 100
      }
    },
    {
      "variantId": "variant_id_2",
      "updates": {
        "price": 999.00,
        "stock": 50
      }
    }
  ]
}
```

## API Response Examples

### Get Product Variants

```json
{
  "variants": [
    {
      "_id": "variant_id_1",
      "product": "product_id_1",
      "attributes": {
        "size": "size_id_1",
        "color": "color_id_1"
      },
      "sku": "PROD-S-RED",
      "price": 999.00,
      "discountedPrice": 899.00,
      "stock": 50,
      "lowStockThreshold": 10,
      "isActive": true,
      "isOutOfStock": false,
      "images": ["image_url_1", "image_url_2"],
      "primaryImage": "image_url_1",
      "website": "website_id",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "stats": {
    "total": 6,
    "active": 5,
    "outOfStock": 1,
    "lowStock": 2,
    "totalStock": 250
  }
}
```

## Frontend Integration

### Using ProductVariations Component

```jsx
import ProductVariations from "./components/ProductVariations"

// In your product form
<ProductVariations
  productId={productId}
  productName={productName}
  onVariantsChange={(variants) => {
    console.log("Variants updated:", variants)
    // Handle variant updates
  }}
/>
```

### Tab Integration in Products.js

The variations tab is automatically added to the product form:
- **Product Details** - Basic product information
- **Variations** - Manage product variants (NEW)
- **Media/Images** - Product images
- **SEO** - SEO settings
- **Templates** - Customization templates (if customized product)

## Features

### ✅ Auto-Generated SKUs
- Format: `{PRODUCT_SKU}-{ATTRIBUTE_VALUES}`
- Example: `TSH001-S-RED` (Product SKU: TSH001, Size: S, Color: Red)
- Automatically ensures uniqueness

### ✅ Duplicate Prevention
- System checks for duplicate attribute combinations
- Prevents creating variants with same attributes

### ✅ Stock Management
- Individual stock per variant
- Low stock threshold alerts
- Out of stock flagging
- Total stock aggregation

### ✅ Flexible Attributes
- Support for any attribute type (Size, Color, Material, etc.)
- Easy to extend without schema changes
- Attributes stored as key-value pairs

### ✅ Variant-Specific Pricing
- Each variant can have different price
- Support for discounted prices
- Price override from base product price

### ✅ Variant Images
- Each variant can have multiple images
- Primary image per variant
- Variant-specific image galleries

### ✅ Status Management
- Enable/disable individual variants
- Active/Inactive status
- Soft delete support

## Best Practices

### 1. Attribute Selection
- Use consistent attribute names across products
- Prefer IDs over names for attributes (prevents issues with name changes)
- Group related attributes together

### 2. SKU Management
- Let system auto-generate SKUs initially
- Edit SKUs manually if needed for external systems
- Keep SKUs unique and meaningful

### 3. Stock Management
- Set appropriate low stock thresholds
- Regularly update stock levels
- Use bulk update for efficiency

### 4. Pricing Strategy
- Set base price on product
- Override with variant-specific prices when needed
- Use discounted prices for promotions

### 5. Performance
- Use bulk operations for multiple updates
- Fetch variants only when needed
- Cache variant data when appropriate

## Database Indexes

The system includes optimized indexes:
- `{ product: 1, deleted: 1, isActive: 1 }` - Fast product variant queries
- `{ sku: 1, website: 1 }` - Unique SKU per website
- `{ website: 1, isActive: 1, deleted: 1 }` - Multi-tenant queries
- `{ website: 1, isOutOfStock: 1 }` - Stock status queries

## Multi-Tenancy Support

- All variants are scoped to a website
- SKUs are unique per website
- Variants inherit website from parent product
- Tenant middleware ensures proper isolation

## Future Enhancements

Potential improvements:
1. Variant image uploads via API
2. Variant-specific shipping rules
3. Variant bundles/packages
4. Variant comparison features
5. Advanced variant filtering
6. Variant analytics and reporting
7. Import/export variants via CSV
8. Variant templates for quick creation

## Troubleshooting

### Variants Not Showing
- Ensure product is saved first (variants require productId)
- Check website context is set correctly
- Verify variants exist in database

### Duplicate Variant Error
- Check if variant with same attributes already exists
- Review attribute values for exact matches
- Use update instead of create for existing variants

### Stock Not Updating
- Verify variant ID is correct
- Check stock value is a valid number
- Ensure variant is not deleted

### SKU Conflicts
- SKUs must be unique per website
- Check for existing SKUs before creating
- System auto-generates unique SKUs if not provided

## Support

For issues or questions:
1. Check API response for error messages
2. Review backend logs for detailed errors
3. Verify database indexes are created
4. Ensure multi-tenant context is properly set
