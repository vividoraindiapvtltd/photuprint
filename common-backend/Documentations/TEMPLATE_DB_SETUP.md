# Template Database Setup

## MongoDB Collections

MongoDB **automatically creates collections** when you first insert a document. No manual table creation needed!

### Collection Name
- **Collection:** `templates` (automatically created from model name "Template")
- **Created:** Automatically on first template save

## Model Schema

The Template model defines:
- `templateId`: Auto-generated (PPSTEMPL1001, PPSTEMPL1002, ...)
- `name`: Required
- `description`: Optional
- `categoryId`: Required (ObjectId reference to Category)
- `category`: Required (ObjectId reference to Category)
- `templateFiles`: Array of image URLs (multiple images per template)
- `previewImage`: Optional preview thumbnail URL
- `isActive`: Boolean (default: true)
- `deleted`: Boolean (default: false) - for soft delete
- `timestamps`: createdAt, updatedAt (automatic)

## Indexes

The model creates these indexes automatically:
1. `{ categoryId: 1, category: 1, isActive: 1 }` - Search performance
2. `{ categoryId: 1, deleted: 1 }` - Unique constraint (one template per category)
3. `{ category: 1, deleted: 1 }` - Unique constraint (one template per category)
4. `{ name: 1 }` - Search by name

## Verification

### Test Route
```bash
curl http://localhost:8080/api/templates/test
```
Should return: `{"message": "Template routes are working!", ...}`

### Check Collection
After saving first template, MongoDB will have:
- Collection: `templates`
- Documents: Your template records

## Important Notes

1. **No manual table creation needed** - MongoDB creates collections automatically
2. **Collection name** is pluralized from model name: `Template` → `templates`
3. **Indexes are created** automatically when model is first used
4. **Unique constraint** ensures only one template per category (when deleted=false)

## Troubleshooting

### If collection doesn't exist:
- MongoDB creates it on first insert
- Check database connection
- Check model is imported correctly

### If save fails:
- Check backend logs for error details
- Verify categoryId exists in categories collection
- Check file uploads are working
- Verify Cloudinary configuration

## Database Structure

```
Database: [Your DB Name]
  └── Collections:
      ├── categories
      ├── templates  ← Created automatically on first save
      ├── products
      └── ...
```

The `templates` collection will be created automatically when you save the first template!
