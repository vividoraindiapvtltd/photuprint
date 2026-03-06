# Next.js Frontend Migration

This frontend has been migrated from Create React App to Next.js 14 with App Router.

## Project Structure

```
frontend/
├── app/                    # Next.js App Router
│   ├── layout.js          # Root layout with providers
│   ├── page.js            # Home page (Products List)
│   ├── login/
│   │   └── page.js        # Login page
│   ├── register/
│   │   └── page.js        # Register page
│   ├── product/
│   │   └── [productId]/
│   │       ├── page.js    # Product details page
│   │       └── review/
│   │           └── page.js # Review form for specific product
│   └── review/
│       └── page.js         # General review form
├── src/
│   ├── components/         # Reusable components
│   ├── context/           # React context providers
│   └── utils/             # Utility functions
├── public/                # Static assets
├── next.config.js         # Next.js configuration
├── tailwind.config.js     # Tailwind CSS configuration
└── package.json           # Dependencies

```

## Key Changes

### 1. Routing
- **Before**: React Router (`react-router-dom`)
- **After**: Next.js file-based routing (App Router)
- Routes are now defined by folder structure in `app/` directory

### 2. Pages
- All pages are now in `app/` directory
- Pages use `'use client'` directive for client-side components
- Dynamic routes use `[param]` folder naming (e.g., `[productId]`)

### 3. Navigation
- **Before**: `useNavigate()`, `Link` from `react-router-dom`
- **After**: `useRouter()`, `Link` from `next/navigation`

### 4. Context Providers
- Moved to root `layout.js` file
- All context providers marked with `'use client'`

### 5. API Utilities
- Updated to work with both client and server-side rendering
- Uses `typeof window !== 'undefined'` checks for browser-only code

## Installation

1. Install dependencies:
```bash
cd frontend
npm install
```

2. Create `.env.local` file (if needed):
```env
NEXT_PUBLIC_API_URL=http://localhost:8080/api
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id
```

## Running the Application

### Development
```bash
npm run dev
```
Runs on http://localhost:3001

### Production Build
```bash
npm run build
npm start
```

## Environment Variables

- `NEXT_PUBLIC_API_URL`: Backend API URL (default: http://localhost:8080/api)
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID`: Google OAuth Client ID

## Routes

- `/` - Products list (home page)
- `/login` - Login page
- `/register` - Registration page
- `/product/[productId]` - Product details page
- `/product/[productId]/review` - Review form for specific product
- `/review` - General review form

## Notes

- All components that use hooks or browser APIs must have `'use client'` directive
- Image optimization is handled by Next.js Image component (can be added later)
- Static assets go in `public/` directory
- The old `src/App.js` and `src/index.js` are no longer used
