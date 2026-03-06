# Prompt 3: Database Schema

## Production-ready schema for templates, versions, products, mapping, customizations, and assets

**Primary implementation: MongoDB.** The same **logical model** is kept database-agnostic so it can map to PostgreSQL, MySQL, or another store with minimal change.

---

## 1. Design principles (any database)

- **Entities:** Templates, template versions, products, product–template mapping, user customizations, renders, assets.
- **Identifiers:** Use stable IDs (e.g. UUID or ObjectId) so the same IDs can be used in MongoDB or as primary keys in SQL.
- **JSON-first template:** The template “document” (canvas, areas, layers) stays as a JSON blob; in MongoDB it lives in the version document; in SQL it lives in a JSONB/text column.
- **Relationships:** Model as references (IDs), not DB-specific links. Application code resolves relationships; optional embedded docs in MongoDB where it helps read performance.

---

## 2. MongoDB implementation

### 2.1 Collections and document shape

**Status values (application-level enum):** `draft` | `published` | `archived`  
**Role values:** `primary` | `variant`

---

#### Collection: `templates`

Logical template; one document per template. Versions live in a separate collection.

```javascript
{
  _id: ObjectId,
  website: ObjectId,           // ref to websites
  name: String,
  productType: String,         // e.g. 'tshirt', 'poster_a3'
  description: String,
  createdAt: Date,
  updatedAt: Date,
  createdBy: ObjectId          // optional ref to users
}
```

**Unique constraint:** `{ website: 1, name: 1 }` (application-enforced or unique index).

---

#### Collection: `template_versions`

One document per version; holds the full template document (canvas, areas, layers).

```javascript
{
  _id: ObjectId,
  template: ObjectId,          // ref to templates
  versionNumber: Number,       // 1, 2, 3... per template
  status: String,              // 'draft' | 'published' | 'archived'
  label: String,               // e.g. 'v1 - Launch'
  document: Object,            // full TemplateDocument (Prompt 2 schema)
  publishedAt: Date,
  archivedAt: Date,
  createdAt: Date,
  updatedAt: Date,
  createdBy: ObjectId
}
```

**Unique constraint:** `{ template: 1, versionNumber: 1 }`.

---

#### Collection: `products`

Existing product collection (photuprint). Only fields relevant to template linkage are shown; extend as needed.

```javascript
{
  _id: ObjectId,
  website: ObjectId,
  name: String,
  sku: String,
  isActive: Boolean,
  deleted: Boolean,
  createdAt: Date,
  updatedAt: Date
  // ... rest of product schema
}
```

---

#### Collection: `product_template_mappings`

Product ↔ template N:M; optional pin to a specific version.

```javascript
{
  _id: ObjectId,
  product: ObjectId,
  template: ObjectId,
  templateVersion: ObjectId,   // optional; null = use latest published
  role: String,                // 'primary' | 'variant'
  areaId: String,              // 'front' | 'back' | etc.; null = template default
  printWidthMm: Number,
  printHeightMm: Number,
  dpiOverride: Number,
  sortOrder: Number,
  createdAt: Date,
  updatedAt: Date
}
```

**Unique constraint:** `{ product: 1, template: 1, areaId: 1 }` (use `areaId: ''` when null).

---

#### Collection: `user_customizations`

Saved design or order personalization: product + template version + variable values.

```javascript
{
  _id: ObjectId,
  website: ObjectId,
  user: ObjectId,              // optional; null for guest
  sessionId: String,            // guest cart/session
  product: ObjectId,
  templateVersion: ObjectId,
  variableValues: Object,       // { "customer_name": "Jane", "photo_1": "asset_xyz" }
  status: String,               // 'draft' | 'cart' | 'ordered'
  order: ObjectId,             // set when order placed
  createdAt: Date,
  updatedAt: Date
}
```

---

#### Collection: `customization_renders`

One document per area/format per customization (output of render worker).

```javascript
{
  _id: ObjectId,
  customization: ObjectId,
  areaId: String,               // 'front' | 'back' | etc.
  format: String,               // 'png' | 'pdf'
  dpi: Number,
  storagePath: String,           // S3 key or CDN path
  fileSizeBytes: Number,
  createdAt: Date
}
```

---

#### Collection: `assets`

Metadata for fonts and images; files in blob storage.

```javascript
{
  _id: ObjectId,
  website: ObjectId,
  kind: String,                 // 'image' | 'font'
  name: String,
  storageKey: String,
  mimeType: String,
  fileSizeBytes: Number,
  width: Number,                // images
  height: Number,
  metadata: Object,             // font family, variant; image alt, etc.
  isActive: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

---

#### Collection: `template_variable_definitions` (optional)

Normalized variables per version; can also be read from `document` in `template_versions`.

```javascript
{
  _id: ObjectId,
  templateVersion: ObjectId,
  variableId: String,           // matches layer.variableId in document
  label: String,
  type: String,                 // 'text' | 'image'
  defaultValue: String,
  required: Boolean,
  layerIds: [String],
  createdAt: Date
}
```

**Unique constraint:** `{ templateVersion: 1, variableId: 1 }`.

---

### 2.2 Key relationships (MongoDB)

| From | To | Type | How |
|------|-----|------|-----|
| templates | websites | N:1 | `website` ObjectId |
| template_versions | templates | N:1 | `template` ObjectId |
| product_template_mappings | products, templates | N:1 each | `product`, `template` ObjectIds |
| product_template_mappings | template_versions | N:1 optional | `templateVersion` ObjectId |
| user_customizations | products, template_versions | N:1 each | `product`, `templateVersion` ObjectIds |
| customization_renders | user_customizations | N:1 | `customization` ObjectId |
| assets | websites | N:1 | `website` ObjectId |

No embedded references required; all links are by ID. Application code (or aggregation) resolves refs when needed.

---

### 2.3 Indexing strategy (MongoDB)

```javascript
// templates
db.templates.createIndex({ website: 1 });
db.templates.createIndex({ website: 1, name: 1 }, { unique: true });

// template_versions
db.template_versions.createIndex({ template: 1 });
db.template_versions.createIndex({ template: 1, status: 1 });
db.template_versions.createIndex({ template: 1, publishedAt: -1 }, { partialFilterExpression: { status: 'published' } });
db.template_versions.createIndex({ template: 1, versionNumber: 1 }, { unique: true });

// product_template_mappings
db.product_template_mappings.createIndex({ product: 1 });
db.product_template_mappings.createIndex({ template: 1 });
db.product_template_mappings.createIndex({ templateVersion: 1 }, { sparse: true });

// user_customizations
db.user_customizations.createIndex({ website: 1 });
db.user_customizations.createIndex({ website: 1, user: 1 }, { sparse: true });
db.user_customizations.createIndex({ website: 1, sessionId: 1 }, { sparse: true });
db.user_customizations.createIndex({ product: 1 });
db.user_customizations.createIndex({ order: 1 }, { sparse: true });
db.user_customizations.createIndex({ templateVersion: 1 });

// customization_renders
db.customization_renders.createIndex({ customization: 1 });

// assets
db.assets.createIndex({ website: 1, kind: 1 });
db.assets.createIndex({ website: 1, isActive: 1 }, { partialFilterExpression: { isActive: true } });

// template_variable_definitions (optional)
db.template_variable_definitions.createIndex({ templateVersion: 1 });
db.template_variable_definitions.createIndex({ templateVersion: 1, variableId: 1 }, { unique: true });
```

**Optional – search inside document / variableValues:**

```javascript
db.template_versions.createIndex({ 'document.schemaVersion': 1, 'document.productType': 1 });
db.user_customizations.createIndex({ variableValues: 1 });  // if querying by variable keys
```

---

### 2.4 Version rollback strategy (MongoDB)

- **draft:** One active draft per template (e.g. query `{ template, status: 'draft' }` and overwrite, or enforce single draft in app).
- **published:** Immutable; storefront/render use only `status: 'published'`. “Current” = sort by `publishedAt: -1`, limit 1.
- **archived:** Set `status: 'archived'`, `archivedAt: new Date()`. Kept for history.

**Restore as new draft:** Copy an existing version doc: new `_id`, same `template`, `versionNumber: max + 1`, `status: 'draft'`, same `document`, clear `publishedAt`/`archivedAt`.

**Revert to version X:**  
- Option 1: Clone that version as a new document with `status: 'published'`, `publishedAt: new Date()`.  
- Option 2: In `product_template_mappings`, set `templateVersion` to that version’s `_id` so new orders use it.

**Rollback bad publish:** Update bad version to `status: 'archived'`, `archivedAt: new Date()`. Either set mapping’s `templateVersion` to last good version, or create a new published version from a previous good draft/version.

**Queries:**

- List versions: `find({ template })`.sort({ versionNumber: -1 }).
- Current published: `findOne({ template, status: 'published' })`.sort({ publishedAt: -1 }).
- By version number: `findOne({ template, versionNumber })`.

---

## 3. Database-agnostic model & mapping to other DBs

The **logical model** is the same regardless of database. Below is the entity list and how it maps to SQL (e.g. PostgreSQL) so the system stays flexible.

### 3.1 Logical entities (any database)

| Entity | Purpose |
|--------|--------|
| **Template** | Logical template; many versions per template |
| **Template version** | Immutable snapshot; holds full template JSON (canvas, areas, layers); status: draft / published / archived |
| **Product** | Existing product entity; referenced by mapping |
| **Product–template mapping** | N:M between product and template; optional pin to a version; area, print size, DPI override |
| **User customization** | One saved design: product + template version + variable values (JSON); status: draft / cart / ordered |
| **Customization render** | One output file per area/format per customization (path, DPI, format) |
| **Asset** | Metadata for font/image; storage key; files in blob storage |
| **Template variable definition** | Optional; normalized list of variables per version |

### 3.2 Mapping: MongoDB → PostgreSQL (or any SQL)

| Logical entity | MongoDB | PostgreSQL / SQL |
|----------------|--------|-------------------|
| Template | Collection `templates`; doc with `website`, `name`, … | Table `templates`; columns `id`, `website_id`, `name`, … |
| Template version | Collection `template_versions`; doc with `document` (object) | Table `template_versions`; column `document` JSONB |
| Product | Collection `products` | Table `products` |
| Product–template mapping | Collection `product_template_mappings` | Table `product_template_mappings` |
| User customization | Collection `user_customizations`; `variableValues` (object) | Table `user_customizations`; `variable_values` JSONB |
| Customization render | Collection `customization_renders` | Table `customization_renders` |
| Asset | Collection `assets`; `metadata` (object) | Table `assets`; `metadata` JSONB |
| Variable definition | Collection `template_variable_definitions`; `layerIds` array | Table `template_variable_definitions`; `layer_ids` array type |

**IDs:** Use UUID (or string) in both MongoDB and SQL so the same value can be stored and exchanged (e.g. `_id` in Mongo, `id` in SQL). If MongoDB uses ObjectId, application layer can map to/from UUID for cross-DB consistency.

**Relationships:** In SQL they are foreign keys; in MongoDB they are stored as ObjectId/UUID references. Application code (or ORM/ODM) resolves them; no DB-specific logic in business rules.

**JSON fields:** Template document and variable values are JSON in both: MongoDB native object; SQL JSONB/text. Same schema (Prompt 2) for the template document in either store.

### 3.3 Keeping the codebase flexible

- **Data access layer:** Abstract behind repositories or services that take “template”, “templateVersion”, “customization”, etc. Return and accept the same DTOs regardless of DB.
- **Queries:** Express in a small set of operations (e.g. “get current published version for template”, “list customizations for user/session”) so each DB has one implementation (Mongo queries vs SQL).
- **IDs:** Prefer one ID type (e.g. UUID) across the app; convert at the boundary if the DB uses native IDs (ObjectId, bigint).
- **Migrations:** For SQL, use migrations for schema; for MongoDB, use application-level checks and optional schema validation so the same logical model can evolve without locking you into one database.

---

## 4. Summary

| Area | MongoDB | Flexible for any DB |
|------|--------|----------------------|
| **Templates** | `templates` + `template_versions` (document in doc) | Same entities; SQL = tables + JSONB column |
| **Products** | `products` | Same; align with existing product schema |
| **Product ↔ Template** | `product_template_mappings` | Same; optional version ref |
| **User customizations** | `user_customizations` + `customization_renders` | Same; variable values as JSON |
| **Assets** | `assets` | Same; metadata + storage key |
| **Indexing** | Compound and partial indexes as above | Same access patterns; implement equivalent indexes in SQL |
| **Version rollback** | Copy version doc; update status; pin mapping | Same logic; SQL uses INSERT/UPDATE instead of doc copy |

**Primary DB: MongoDB.** The schema is written for MongoDB collections and indexes. The **logical model** and **versioning/rollback behavior** are database-agnostic so you can add or switch to PostgreSQL (or another DB) by implementing the same entities and relationships in that store.
