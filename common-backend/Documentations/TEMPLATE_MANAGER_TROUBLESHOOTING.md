# Template Manager Troubleshooting Guide

## Common Issues and Solutions

### Issue: Error accessing `/dashboard/templatemanager`

#### 1. **Backend Server Not Running**
**Solution:** Make sure the backend server is running on port 8080
```bash
cd backend
npm start
# or
node index.js
```

#### 2. **Backend Routes Not Loaded**
**Solution:** Restart the backend server after adding new routes
- The template routes are registered in `backend/app.js`
- Server needs to be restarted to load new routes

#### 3. **Check Browser Console**
Open browser DevTools (F12) and check:
- **Console tab:** Look for JavaScript errors
- **Network tab:** Check if `/api/templates` request is failing
  - If 404: Backend route not registered
  - If 500: Backend error (check backend logs)
  - If CORS error: Backend CORS not configured

#### 4. **Verify Backend Route**
Test the backend endpoint directly:
```bash
curl http://localhost:8080/api/templates
```
Should return templates array (empty if none exist)

#### 5. **Check Authentication**
Template Manager requires admin authentication:
- Make sure you're logged in as admin
- Check if token is in localStorage: `localStorage.getItem("adminUser")`
- Token should be included in API requests

#### 6. **Component Import Error**
If you see "TemplateManager is not defined":
- Check `admin-cms/src/App.js` line 26: `import TemplateManager from "./components/TemplateManager"`
- Verify file exists: `admin-cms/src/components/TemplateManager.js`
- Check for syntax errors in TemplateManager.js

#### 7. **API Base URL Issue**
Check `admin-cms/src/api/axios.js`:
- Base URL should be `http://localhost:8080/api`
- Backend port should match (default: 8080)

## Quick Diagnostic Steps

1. **Check Backend:**
   ```bash
   # In backend directory
   curl http://localhost:8080/api/templates
   ```

2. **Check Frontend:**
   - Open browser console (F12)
   - Navigate to `/dashboard/templatemanager`
   - Check for errors in console

3. **Check Network:**
   - Open DevTools → Network tab
   - Look for `/api/templates` request
   - Check status code and response

4. **Verify Files:**
   - `backend/routes/template.routes.js` exists
   - `backend/controllers/template.controller.js` exists
   - `backend/models/template.model.js` exists
   - `admin-cms/src/components/TemplateManager.js` exists

## Expected Behavior

When accessing `/dashboard/templatemanager`:
1. Page should load with "Template Manager" header
2. Should show "Loading templates..." initially
3. Should display templates list (or empty state if none)
4. Should show form to add new templates

## Error Messages

### "Failed to load templates"
- Backend not running
- API endpoint not accessible
- Network error

### "TemplateManager is not defined"
- Import error in App.js
- Component file missing
- Syntax error in component

### 404 Not Found
- Route not registered in backend
- Wrong URL path
- Backend server not running

### 401 Unauthorized
- Not logged in
- Token expired
- Invalid authentication

## Still Having Issues?

1. Check backend logs for errors
2. Check browser console for JavaScript errors
3. Verify all files are saved correctly
4. Restart both frontend and backend servers
5. Clear browser cache and localStorage

