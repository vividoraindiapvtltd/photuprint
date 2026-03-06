# How to Run the Frontend Application

## Prerequisites

1. **Node.js** installed (v14 or higher)
2. **Backend server** running on port 8080

## Quick Start

### Step 1: Install Dependencies

```bash
cd frontend
npm install
```

### Step 2: Start Backend Server (if not already running)

In a separate terminal:
```bash
cd backend
node index.js
```

The backend should be running on `http://localhost:8080`

### Step 3: Start Frontend Development Server

```bash
cd frontend
npm start
```

The frontend will open automatically at `http://localhost:3001`

## Access URLs

- **Frontend**: http://localhost:3001
- **Backend API**: http://localhost:8080/api

## Testing the Review Features

1. **View a Product with Reviews**:
   - Navigate to: `http://localhost:3001/product/[PRODUCT_ID]`
   - Replace `[PRODUCT_ID]` with an actual product ID from your database
   - You'll see the product details and any approved reviews

2. **Submit a Review**:
   - From a product page, click "Write a Review"
   - Or navigate directly to: `http://localhost:3001/product/[PRODUCT_ID]/review`
   - Fill out the form and submit
   - The review will be pending admin approval

3. **Submit Review Without Product ID**:
   - Navigate to: `http://localhost:3001/review`
   - Select category → subcategory → product
   - Fill out and submit the review

## Getting a Product ID

To test, you'll need a valid product ID. You can:
- Check your MongoDB database
- Use the admin CMS to view products and copy an ID
- Or create a test product through the admin panel

## Troubleshooting

- **Port 3001 already in use**: Change the port in `frontend/package.json` scripts
- **Backend connection errors**: Make sure backend is running on port 8080
- **CORS errors**: Check backend CORS configuration in `backend/app.js`
- **Tailwind styles not working**: Make sure `npm install` completed successfully

## Production Build

To create a production build:

```bash
cd frontend
npm run build
```

The build will be in the `frontend/build` directory.
