# How to Get a Valid Product ID

## Method 1: Via Admin CMS (Easiest)

1. **Open Admin CMS:**
   ```
   http://localhost:3000
   ```

2. **Login:**
   - Email: `admin@photuprint.com`
   - Password: `admin123`

3. **Go to Products:**
   - Click "Products" in the left sidebar
   - Or navigate to: `http://localhost:3000/dashboard/products`

4. **Copy Product ID:**
   - You'll see a list of products
   - Each product has an ID field
   - Copy any product ID (it's a long string like `677c8a1b2c3d4e5f6a7b8c9d`)

5. **Use in review form:**
   ```
   http://localhost:3001/product/YOUR_PRODUCT_ID/review
   ```

## Method 2: Via API Call

```bash
# Get list of products
curl http://localhost:8080/api/products?limit=5

# The response will show product IDs in the _id field
```

## Method 3: Create a Test Product

If you don't have any products, create one:

1. Go to Admin CMS: http://localhost:3000
2. Login
3. Click "Products" → "Add Product"
4. Fill in:
   - **Name:** Test Product
   - **Category:** (select any)
   - **Subcategory:** (select any)
   - **Price:** 100
   - **Description:** Test product for reviews
5. Click "Save"
6. Copy the product ID from the list

## Checking Database Directly

If you have MongoDB Compass or mongosh:

```bash
# Connect to MongoDB
mongosh

# Switch to your database
use photuprint  # or your database name

# Get products
db.products.find({}).limit(5)

# Get product IDs only
db.products.find({}, {_id: 1, name: 1}).limit(5)
```

## Troubleshooting

### No products found?

**Check if products collection exists:**
```bash
mongosh
use photuprint
show collections
db.products.countDocuments()
```

**If count is 0, you need to create products:**
- Use Admin CMS to create products
- Or import sample data if available

### Can't access Admin CMS?

**Make sure it's running:**
```bash
cd admin-cms
npm start
```

It should open at http://localhost:3000

### Backend not returning products?

**Check backend logs:**
- Look at terminal where backend is running
- Should see: "Getting all products with query: ..."

**Restart backend if needed:**
```bash
cd backend
node index.js
```

## Quick Test

Once you have a product ID, test it:

```bash
# Replace PRODUCT_ID with your actual ID
curl http://localhost:8080/api/products/PRODUCT_ID
```

If this returns product data, use that ID in the review form:
```
http://localhost:3001/product/PRODUCT_ID/review
```
