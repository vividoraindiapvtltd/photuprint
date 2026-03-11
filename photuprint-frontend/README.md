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

## Performance & bundle size

The app is optimized for Lighthouse (LCP, CLS, TBT) and smaller initial JS:

- **Images:** All product, cart, account, footer, and hero images use `next/image` with dimensions or `fill` and `sizes`; hero first slide uses `priority` for LCP.
- **Caching:** Homepage and footer use ISR `revalidate: 60`; product/category use 300–600s. Auth APIs remain `no-store`.
- **Dynamic imports:** Carousel, TestimonialsCarousel, RecentlyViewedProducts, CategoriesSection, SubscribeOverlay, and LoginModal are loaded with `next/dynamic` to reduce main bundle and TBT.
- **Scripts:** Razorpay is loaded via `next/script` with `strategy="lazyOnload"` on the cart page.
- **Static generation:** Category and product pages use `generateStaticParams` (top 100 categories, top 50 products) with on-demand ISR for the rest.

To analyze bundle size:

```bash
npm run analyze
```

This runs `ANALYZE=true next build` and opens the bundle analyzer report. Use it to check first-load JS and shared chunks. Production builds strip `console.log` (keep `error`/`warn`) via `next.config.js`.

