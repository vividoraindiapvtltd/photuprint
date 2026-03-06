# Quick Test - Review Form

## ✅ Backend is Running
Products are available in the database.

## Test Product Available

**Product ID:** `69582e10463a0a920732efa2`
**Product Name:** Sandows
**Category:** testing new category
**Subcategory:** Black Magic Mugs

## Test URLs

### 1. View Product Details
```
http://localhost:3001/product/69582e10463a0a920732efa2
```

### 2. Submit Review for This Product
```
http://localhost:3001/product/69582e10463a0a920732efa2/review
```

## Testing Steps

1. **Open the review form:**
   - Click this link or paste in browser:
   - `http://localhost:3001/product/69582e10463a0a920732efa2/review`

2. **Check browser console (F12):**
   - Should see: "Fetching product with ID: 69582e10463a0a920732efa2"
   - Should see: "Fetched product details: {...}"
   - Should see: "Setting categoryId: ... subCategoryId: ..."

3. **If you see "Failed to load product details":**
   - Check Network tab in DevTools
   - Look for the API call to `/api/products/69582e10463a0a920732efa2`
   - Check if it returns 200 OK or an error
   - Check the Response tab to see what data is returned

4. **Expected behavior:**
   - Product name "Sandows" shows in blue box
   - Category "testing new category" shows below
   - No category/subcategory dropdowns visible
   - Rating stars are clickable
   - Comment field is ready

5. **Submit a test review:**
   - Login: admin@photuprint.com / admin123
   - Select rating (e.g., 5 stars)
   - Enter comment: "Test review"
   - Click "Submit Review"
   - Should see success message

## Troubleshooting

### If product doesn't load:

**Check API directly:**
```bash
curl http://localhost:8080/api/products/69582e10463a0a920732efa2
```

**Check if you're logged in:**
- Open DevTools → Application → Local Storage
- Look for key "user"
- Should have token and user data

**Check CORS:**
- Look for CORS errors in console
- Backend should allow requests from localhost:3001

### Common Console Errors:

1. **"Network Error"** → Backend not running
2. **"404 Not Found"** → Product ID doesn't exist
3. **"401 Unauthorized"** → Need to login first
4. **"CORS error"** → Backend CORS configuration issue

## Alternative: Test with Different Product

If the above product doesn't work, get another product ID:

1. Go to: http://localhost:3000 (Admin CMS)
2. Login
3. Click "Products" in sidebar
4. Copy any product's ID
5. Use: `http://localhost:3001/product/YOUR_PRODUCT_ID/review`
