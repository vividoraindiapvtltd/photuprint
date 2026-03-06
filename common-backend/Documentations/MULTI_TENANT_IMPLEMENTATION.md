# Multi-Tenant eCommerce CMS Implementation Guide

## Overview

This document describes the multi-tenant architecture implementation for the eCommerce CMS system. The system supports multiple independent storefronts (tenants) with a single backend and centralized admin panel.

## Architecture

### System Components

1. **Backend**: Single Node.js/Express backend serving all tenants
2. **Admin CMS**: Centralized admin panel for managing all tenants
3. **Storefronts**: Multiple independent frontend applications (one per tenant)

### Multi-Tenancy Rules

- Every eCommerce table includes `website` field (ObjectId reference to Website model)
- Strict tenant isolation enforced at database query level
- Admin requests use `X-Website-Id` header
- Storefront requests resolve tenant from domain (Host header)

## Database Schema

### Website Model (Tenant)

```javascript
{
  _id: ObjectId,
  name: String (required),
  domain: String (required, unique),
  description: String,
  isActive: Boolean (default: true),
  deleted: Boolean (default: false),
  timestamps: true
}
```

### Models with Website Field

All eCommerce models now include:

```javascript
website: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'Website',
  required: true, // or default: null for User model
  index: true
}
```

**Models Updated:**
- ✅ Product
- ✅ Category
- ✅ Subcategory
- ✅ User (customers - optional, admins have accessibleWebsites array)
- ✅ Order
- ✅ Coupon
- ✅ Review
- ✅ Brand
- ✅ Template
- ✅ Company

### Indexes

All models have compound indexes for tenant isolation:

```javascript
// Example: Product model
productSchema.index({ website: 1, name: 1 }, { unique: true, partialFilterExpression: { deleted: false } });
productSchema.index({ website: 1, isActive: 1, deleted: 1 });
```

## Backend Implementation

### Tenant Resolution Middleware

**File**: `backend/middlewares/tenant.middleware.js`

#### For Admin/CMS Requests

```javascript
import { resolveTenantFromHeader, requireTenant } from '../middlewares/tenant.middleware.js';

// In routes file
router.use(resolveTenantFromHeader);
router.use(requireTenant);
```

**How it works:**
1. Reads `X-Website-Id` header from request
2. Validates website exists and is active
3. Checks user has access to website (unless super_admin)
4. Attaches `req.tenant` and `req.websiteId` to request

#### For Storefront Requests

```javascript
import { resolveTenantFromDomain } from '../middlewares/tenant.middleware.js';

// In routes file
router.use(resolveTenantFromDomain);
```

**How it works:**
1. Extracts domain from `Host` or `X-Forwarded-Host` header
2. Finds website by domain
3. Attaches `req.tenant` and `req.websiteId` to request

### Controller Pattern

All controllers must:

1. **Validate tenant context:**
```javascript
if (!req.websiteId) {
  return res.status(400).json({ msg: "Website context is required" })
}
```

2. **Filter queries by website:**
```javascript
const filter = {
  website: req.websiteId,
  deleted: { $ne: true }
}
```

3. **Set website when creating:**
```javascript
const productData = {
  ...req.body,
  website: req.websiteId
}
```

4. **Filter by website when updating/deleting:**
```javascript
const product = await Product.findOne({ 
  _id: req.params.id, 
  website: req.websiteId 
})
```

### Example: Product Controller

**File**: `backend/controllers/product.controller.js`

```javascript
// CREATE
export const createProduct = async (req, res) => {
  if (!req.websiteId) {
    return res.status(400).json({ msg: "Website context is required" })
  }
  
  const productData = {
    ...req.body,
    website: req.websiteId // Set tenant
  }
  // ... rest of creation logic
}

// READ (List)
export const getAllProducts = async (req, res) => {
  if (!req.websiteId) {
    return res.status(400).json({ msg: "Website context is required" })
  }
  
  const filter = {
    website: req.websiteId, // Filter by tenant
    deleted: { $ne: true }
  }
  // ... rest of query logic
}

// UPDATE
export const updateProduct = async (req, res) => {
  if (!req.websiteId) {
    return res.status(400).json({ msg: "Website context is required" })
  }
  
  const product = await Product.findOne({ 
    _id: req.params.id, 
    website: req.websiteId // Ensure tenant match
  })
  // ... rest of update logic
}

// DELETE
export const deleteProduct = async (req, res) => {
  if (!req.websiteId) {
    return res.status(400).json({ msg: "Website context is required" })
  }
  
  const product = await Product.findOneAndDelete({ 
    _id: req.params.id, 
    website: req.websiteId // Ensure tenant match
  })
  // ... rest of delete logic
}
```

### Routes Pattern

**File**: `backend/routes/produt.route.js`

```javascript
import { resolveTenantFromHeader, requireTenant } from "../middlewares/tenant.middleware.js"

const router = express.Router()

// Apply tenant resolution to all routes
router.use(resolveTenantFromHeader)
router.use(requireTenant)

// Routes...
router.get("/", getAllProducts)
router.post("/", createProduct)
// etc.
```

## Frontend Implementation

### API Interceptor

**File**: `admin-cms/src/api/axios.js`

The axios interceptor automatically adds `X-Website-Id` header:

```javascript
api.interceptors.request.use((config) => {
  // ... auth token logic
  
  // Multi-tenant: Add X-Website-Id header
  try {
    const selectedWebsite = JSON.parse(localStorage.getItem("selectedWebsite"))
    if (selectedWebsite?._id) {
      config.headers['X-Website-Id'] = selectedWebsite._id
    }
  } catch (error) {
    console.warn("Failed to get selected website:", error)
  }
  
  return config
})
```

### AuthContext

**File**: `admin-cms/src/context/AuthContext.js`

Already manages `selectedWebsite` state:

```javascript
const { selectedWebsite, setSelectedWebsite } = useAuth()
```

### Website Selection Flow

1. Admin logs in
2. Redirected to `/select-website`
3. Selects website from dropdown
4. Website stored in `localStorage` and `AuthContext`
5. All API requests include `X-Website-Id` header
6. Changing website refreshes all CMS data

## Security Best Practices

### 1. Tenant Isolation

- **Always filter by website_id** in all queries
- **Never trust client-provided website_id** - validate against user's accessible websites
- **Use compound indexes** for performance and data integrity

### 2. Access Control

```javascript
// Super Admin: Access all websites
if (user.role === 'super_admin') {
  // Allow access
}

// Website Admin: Check accessibleWebsites
const hasAccess = 
  user.website?.toString() === websiteId ||
  user.accessibleWebsites?.some(w => w.toString() === websiteId)
```

### 3. Input Validation

- Validate `X-Website-Id` is valid ObjectId format
- Verify website exists and is active
- Check user permissions before allowing access

### 4. Error Handling

- Never expose tenant information in error messages
- Return generic errors for unauthorized access
- Log tenant context for debugging (server-side only)

## Migration Guide

### For Existing Controllers

1. **Add tenant middleware to routes:**
```javascript
import { resolveTenantFromHeader, requireTenant } from "../middlewares/tenant.middleware.js"
router.use(resolveTenantFromHeader)
router.use(requireTenant)
```

2. **Update controller functions:**
   - Add `req.websiteId` validation
   - Add `website: req.websiteId` to filters
   - Add `website: req.websiteId` to create operations
   - Update findOne/findById to include website filter

3. **Update model indexes:**
   - Add compound indexes with website
   - Update unique indexes to include website

### Controllers to Update

- [ ] Category Controller
- [ ] Subcategory Controller
- [ ] Brand Controller
- [ ] Order Controller
- [ ] Coupon Controller
- [ ] Review Controller
- [ ] User Controller (for customers)
- [ ] Template Controller
- [ ] Company Controller

### Database Migration

For existing data, you'll need to:

1. **Assign default website** to existing records:
```javascript
// Migration script example
const defaultWebsite = await Website.findOne({ domain: 'default-domain.com' })
await Product.updateMany(
  { website: { $exists: false } },
  { $set: { website: defaultWebsite._id } }
)
```

2. **Update unique indexes:**
   - Drop old unique indexes
   - Create new compound unique indexes with website

## Testing

### Test Cases

1. **Tenant Isolation:**
   - Create product in Website A
   - Verify it doesn't appear in Website B's product list

2. **Access Control:**
   - Admin with access to Website A only
   - Try to access Website B data → Should fail

3. **Domain Resolution:**
   - Storefront request from domain-a.com
   - Should resolve to Website A
   - Should only return Website A's products

4. **Header Resolution:**
   - Admin request with X-Website-Id header
   - Should resolve to correct website
   - Should filter all queries by that website

## Performance Considerations

1. **Indexes**: All queries filtered by website should use compound indexes
2. **Caching**: Consider caching tenant context per request
3. **Connection Pooling**: MongoDB connection pool handles multiple tenants efficiently
4. **Query Optimization**: Use `.lean()` for read-only queries when possible

## Troubleshooting

### Issue: "Website context is required"

**Solution**: Ensure:
- `X-Website-Id` header is sent from frontend
- Website is selected in admin panel
- Tenant middleware is applied to route

### Issue: "Website not found"

**Solution**: Check:
- Website exists in database
- Website is active (`isActive: true`)
- Website is not deleted (`deleted: false`)
- Domain matches exactly (case-insensitive)

### Issue: "You do not have access to this website"

**Solution**: Verify:
- User has `accessibleWebsites` array with website ID
- User role is `super_admin` (has access to all)
- Website ID matches exactly

## Next Steps

1. Update remaining controllers (Category, Order, Coupon, etc.)
2. Add tenant filtering to all list/read operations
3. Update frontend components to refresh on website change
4. Add website selection to all manager components
5. Implement data migration script for existing records
6. Add comprehensive tests for tenant isolation

## Support

For questions or issues, refer to:
- `backend/middlewares/tenant.middleware.js` - Tenant resolution logic
- `backend/controllers/product.controller.js` - Example implementation
- `admin-cms/src/api/axios.js` - Frontend header injection
