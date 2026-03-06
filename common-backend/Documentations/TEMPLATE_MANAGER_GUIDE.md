# Template Manager System - Complete Implementation Guide

## ✅ Overview

A complete Template Manager system has been implemented that allows admins to upload and manage design templates for each category. On the product details page, users can toggle between "Standard" and "Customized" views to see category-specific templates.

## 🎯 Features Implemented

### Backend (Node.js/Express)
1. **Template Model** (`backend/models/template.model.js`)
   - Stores template information with category reference
   - Supports template file and preview image uploads
   - Includes `isDefault` flag for default templates
   - Soft delete support

2. **Template Controller** (`backend/controllers/template.controller.js`)
   - CRUD operations for templates
   - Category-based template fetching
   - Cloudinary integration for file uploads
   - Default template management

3. **Template Routes** (`backend/routes/template.routes.js`)
   - Public routes for frontend (GET templates by category)
   - Protected admin routes (POST, PUT, DELETE)
   - File upload middleware integration

4. **App Integration** (`backend/app.js`)
   - Template routes registered at `/api/templates`

### Admin CMS
1. **TemplateManager Component** (`admin-cms/src/components/TemplateManager.js`)
   - Full CRUD interface for templates
   - Category selection dropdown
   - Template file and preview image uploads
   - Default template selection
   - Card and list view modes
   - Search and filter functionality

2. **Dashboard Integration**
   - Added to `admin-cms/src/App.js` routes
   - Added to `admin-cms/src/data/dashboardLinks.json`
   - Accessible at `/dashboard/templatemanager`

### Frontend
1. **TemplateRenderer Component** (`frontend/src/components/TemplateRenderer.js`)
   - Fetches templates by category
   - Displays template grid with previews
   - Template selection functionality
   - Auto-selects default template

2. **ProductDetails Page** (`frontend/src/pages/ProductDetails.js`)
   - Standard/Customized toggle switch
   - Conditionally renders templates when Customized is selected
   - Integrates with product category

## 📋 API Endpoints

### Public Endpoints (Frontend)
- `GET /api/templates` - Get all templates (with filters)
- `GET /api/templates/category/:categoryId` - Get templates for a category
- `GET /api/templates/:id` - Get template by ID

### Admin Endpoints (Protected)
- `POST /api/templates` - Create new template (requires admin)
- `PUT /api/templates/:id` - Update template (requires admin)
- `PATCH /api/templates/:id/status` - Update template status (requires admin)
- `DELETE /api/templates/:id` - Delete template (requires admin)

## 🚀 How to Use

### Admin Panel - Upload Templates

1. **Access Template Manager:**
   - Login to admin CMS: `http://localhost:3000`
   - Navigate to "Template Manager" from dashboard

2. **Create a Template:**
   - Fill in template name and description
   - Select a category from dropdown
   - Upload template file (image, PSD, AI, PDF)
   - Upload preview image (optional, for thumbnail)
   - Check "Active" to make it available
   - Check "Default Template" to set as default for category
   - Click "Add Template"

3. **Manage Templates:**
   - Edit templates by clicking "Edit" button
   - Delete templates (soft delete by default)
   - Filter by category or status
   - Search templates by name/description

### Frontend - View Templates

1. **Navigate to Product Page:**
   - Go to any product details page: `http://localhost:3001/product/:productId`

2. **Toggle to Customized View:**
   - Find the "Standard / Customized" toggle switch
   - Toggle to "Customized" mode

3. **Select Template:**
   - Templates for the product's category will appear
   - Click on a template to select it
   - Selected template will be highlighted
   - Full template preview shown below

## 🎨 Template Model Schema

```javascript
{
  templateId: String (auto-generated: PPSTEMPL1001, PPSTEMPL1002, ...)
  name: String (required)
  description: String (optional)
  categoryId: ObjectId (required, ref: Category)
  category: ObjectId (required, ref: Category)
  templateFile: String (Cloudinary URL)
  previewImage: String (Cloudinary URL, optional)
  isActive: Boolean (default: true)
  isDefault: Boolean (default: false)
  deleted: Boolean (default: false)
  timestamps: true
}
```

## 🔧 Configuration

### File Upload
- Templates are uploaded to Cloudinary
- Template files: `templates/` folder
- Preview images: `templates/previews/` folder
- Supported formats: Images, PSD, AI, PDF

### Default Templates
- Only one template per category can be marked as default
- When a template is set as default, others are automatically unset
- Default template is auto-selected in frontend

## 📱 UI Components

### Admin Panel
- **Card View:** Grid layout with template previews
- **List View:** Table format with all details
- **Search:** Real-time search by name/description
- **Filters:** By category and status (active/inactive/deleted)

### Frontend
- **Toggle Switch:** Smooth animated toggle between Standard/Customized
- **Template Grid:** Responsive grid (1-3 columns based on screen size)
- **Template Cards:** Preview image, name, default badge, description
- **Selected Template:** Highlighted with blue border and preview

## 🎯 Use Cases

1. **E-commerce Product Customization:**
   - Upload design templates for t-shirts, mugs, etc.
   - Customers can preview how their product will look with different templates
   - Templates are category-specific (e.g., t-shirt templates only for t-shirt category)

2. **Design Preview:**
   - Upload preview images for quick selection
   - Full template files for detailed view
   - Default templates for quick access

3. **Template Management:**
   - Organize templates by category
   - Activate/deactivate templates
   - Set default templates per category

## 🔒 Security

- Template creation/editing requires admin authentication
- Public endpoints only allow GET requests
- File uploads validated and stored securely in Cloudinary
- Soft delete prevents accidental data loss

## 🐛 Troubleshooting

### Templates not showing in frontend?
- Check if template is marked as "Active"
- Verify product has a valid category
- Check browser console for API errors
- Ensure category ID matches between product and template

### File upload failing?
- Check Cloudinary configuration in `.env`
- Verify file size (max 5MB)
- Check file format (images, PSD, AI, PDF)

### Default template not auto-selecting?
- Ensure template has `isDefault: true`
- Check if template is active
- Verify category match

## 📝 Next Steps (Optional Enhancements)

1. **Template Preview Editor:**
   - Allow users to customize template colors/text
   - Real-time preview updates

2. **Template Variants:**
   - Multiple sizes/versions per template
   - Template categories/subcategories

3. **Template Analytics:**
   - Track most used templates
   - User selection statistics

4. **Bulk Operations:**
   - Bulk upload templates
   - Bulk activate/deactivate

## ✅ Testing Checklist

- [ ] Create template in admin panel
- [ ] Upload template file and preview
- [ ] Set default template
- [ ] Edit template
- [ ] Delete template (soft delete)
- [ ] View templates in frontend
- [ ] Toggle between Standard/Customized
- [ ] Select different templates
- [ ] Verify default template auto-selection
- [ ] Test with multiple categories

## 🎉 Summary

The Template Manager system is now fully functional! Admins can manage templates through the admin panel, and customers can view and select templates on product pages using the Standard/Customized toggle.

**Backend:** ✅ Complete
**Admin CMS:** ✅ Complete  
**Frontend:** ✅ Complete

All components are integrated and ready to use!
