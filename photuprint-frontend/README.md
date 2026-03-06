# PhotuPrint Frontend

This is the customer-facing frontend application for PhotuPrint.

## Setup

1. Install dependencies:
```bash
npm install
```

## Running the Application

1. Make sure the backend server is running on port 8080

2. Start the frontend development server:
```bash
npm start
```

The app will open at http://localhost:3001

## Available Routes

- `/` - Home page
- `/product/:productId` - Product details page with reviews
- `/product/:productId/review` - Submit a review for a specific product
- `/review` - Submit a review (product selection required)

## Features

- View product details
- View approved reviews for products
- Submit reviews (pending admin approval)
- Product selection with category/subcategory filtering

