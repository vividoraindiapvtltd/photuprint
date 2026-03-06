# Testing Product API and Review Form

## Quick Diagnostics

### 1. Check if backend is running
```bash
curl http://localhost:8080/api/products?limit=1
```

Expected: JSON response with products

### 2. Get a valid product ID
```bash
# Get first product
curl http://localhost:8080/api/products?limit=1 | jq '.products[0]._id'
```

Or visit: http://localhost:3000 (Admin CMS) → Products

### 3. Test product endpoint directly
```bash
# Replace PRODUCT_ID with actual ID
curl http://localhost:8080/api/products/PRODUCT_ID
```

Expected response:
```json
{
  "_id": "...",
  "name": "Product Name",
  "category": {
    "_id": "category_id",
    "name": "Category Name"
  },
  "subcategory": {
    "_id": "subcategory_id", 
    "name": "Subcategory Name"
  },
  ...
}
```

## Common Issues

### Issue 1: "Failed to load product details"

**Possible causes:**
1. Backend not running on port 8080
2. Product ID doesn't exist
3. Product doesn't have category/subcategory
4. CORS issue

**Debug steps:**
1. Open browser console (F12)
2. Check Network tab for failed requests
3. Look for error messages in console
4. Check backend terminal for errors

### Issue 2: Backend not responding

**Check if backend is running:**
```bash
# Check if port 8080 is in use
lsof -i :8080
```

**Start backend if not running:**
```bash
cd backend
node index.js
```

### Issue 3: No products in database

**Create a test product via admin CMS:**
1. Go to http://localhost:3000
2. Login: admin@photuprint.com / admin123
3. Navigate to Products
4. Add a new product with category and subcategory

### Issue 4: CORS errors

Check backend console for CORS errors. Backend should have CORS enabled in `backend/app.js`.

## Testing the Review Form

### Step 1: Get a valid product ID

**Option A: Via Admin CMS**
1. Go to http://localhost:3000
2. Login
3. Click "Products"
4. Copy any product's ID (looks like: `677c8a1b2c3d4e5f6a7b8c9d`)

**Option B: Via API**
```bash
curl http://localhost:8080/api/products?limit=1
```
Copy the `_id` from the response.

### Step 2: Test the review form

1. Open: `http://localhost:3001/product/PRODUCT_ID/review`
   (Replace PRODUCT_ID with actual ID)

2. Open browser console (F12)

3. Check for logs:
   ```
   Fetching product with ID: ...
   Fetched product details: {...}
   Setting categoryId: ... subCategoryId: ...
   ```

4. If you see errors, check:
   - Network tab for failed API calls
   - Console for error messages
   - Backend terminal for server errors

### Step 3: Submit a review

1. Login if prompted
2. Select rating (click stars)
3. Enter comment
4. Click "Submit Review"
5. Should see success message
6. Check admin panel for pending review

## Debugging Checklist

- [ ] Backend running on port 8080
- [ ] Frontend running on port 3001
- [ ] MongoDB connected
- [ ] At least one product exists with category and subcategory
- [ ] Product ID is valid (24 character hex string)
- [ ] Browser console shows no CORS errors
- [ ] Network tab shows successful API calls
- [ ] User is logged in (check localStorage for "user" key)

## Quick Fix Commands

```bash
# Restart backend
cd backend
node index.js

# Restart frontend  
cd frontend
npm start

# Check MongoDB connection
# Look for "MongoDB connected" in backend terminal

# Create admin user if needed
cd backend
node seed.js
```
