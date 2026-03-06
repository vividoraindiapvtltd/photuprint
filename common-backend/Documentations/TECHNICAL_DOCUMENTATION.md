# PhotuPrint - Technical Documentation

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Technology Stack](#technology-stack)
4. [Project Structure](#project-structure)
5. [Database Schema](#database-schema)
6. [API Endpoints](#api-endpoints)
7. [Frontend Components](#frontend-components)
8. [Authentication & Authorization](#authentication--authorization)
9. [File Upload & Media Management](#file-upload--media-management)
10. [Development Workflow](#development-workflow)
11. [Deployment](#deployment)
12. [Security Considerations](#security-considerations)
13. [Performance Optimization](#performance-optimization)

## Project Overview

PhotuPrint is a comprehensive e-commerce platform for personalized products, featuring:

- **Admin CMS**: React-based administrative interface for managing products, categories, orders, and reviews
- **Backend API**: Node.js/Express REST API with MongoDB database
- **Frontend**: Customer-facing interface for product browsing and purchasing
- **Media Management**: Cloudinary integration for image/video uploads

### Key Features

- Product catalog management with categories, subcategories, and attributes
- Multi-variant products (colors, sizes, materials)
- User authentication and role-based access control
- Review and rating system
- Order management
- Brand and supplier management
- Media upload with image/video support

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Admin CMS     │    │   Customer      │    │   Mobile App    │
│  (React SPA)    │    │   Frontend      │    │   (Future)      │
│   Port: 3000    │    │  (React SPA)    │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │   Backend API   │
                    │ (Node.js/Express)│
                    │   Port: 8080    │
                    └─────────────────┘
                                 │
                    ┌─────────────────┐    ┌─────────────────┐
                    │   MongoDB       │    │   Cloudinary    │
                    │   Database      │    │   Media CDN     │
                    └─────────────────┘    └─────────────────┘
```

## Technology Stack

### Backend

- **Runtime**: Node.js (ES6 Modules)
- **Framework**: Express.js 5.1.0
- **Database**: MongoDB with Mongoose ODM 8.16.4
- **Authentication**: JWT (jsonwebtoken 9.0.2)
- **Password Hashing**: bcryptjs 3.0.2
- **File Upload**: Multer 2.0.2
- **Media Storage**: Cloudinary 2.7.0
- **Payment**: Stripe 18.4.0
- **CORS**: cors 2.8.5
- **Logging**: morgan 1.10.1
- **Environment**: dotenv 17.2.0

### Frontend (Admin CMS)

- **Framework**: React 19.1.1
- **Routing**: React Router DOM 7.8.0
- **HTTP Client**: Axios 1.11.0
- **Icons**: React Icons 5.5.0, @react-md/icon 5.1.6
- **Testing**: Jest, React Testing Library
- **Build Tool**: Create React App

### Development Tools

- **Process Manager**: nodemon 3.1.10
- **Code Formatting**: Prettier 3.6.2

## Project Structure

```
PP/
├── backend/                    # Backend API server
│   ├── controllers/           # Business logic controllers
│   ├── models/               # MongoDB/Mongoose models
│   ├── routes/               # API route definitions
│   ├── middlewares/          # Custom middleware functions
│   ├── utils/                # Utility functions
│   ├── uploads/              # Local file storage
│   ├── db/                   # Database connection
│   ├── app.js                # Express app configuration
│   ├── index.js              # Server entry point
│   └── constants.js          # Application constants
│
├── admin-cms/                 # Admin dashboard (React)
│   ├── src/
│   │   ├── components/       # Reusable UI components
│   │   ├── pages/            # Page components
│   │   ├── context/          # React context providers
│   │   ├── api/              # API client configuration
│   │   ├── css/              # Stylesheets
│   │   ├── data/             # Static data files
│   │   ├── images/           # Static images
│   │   └── utils/            # Utility functions
│   ├── public/               # Public assets
│   └── build/                # Production build
│
├── frontend/                  # Customer frontend (partial)
│   ├── src/pages/            # Page components
│   ├── components/           # UI components
│   └── Login/                # Authentication components
│
├── package.json              # Root dependencies
├── start-servers.sh          # Development server startup script
└── TECHNICAL_DOCUMENTATION.md # This file
```

## Database Schema

### User Model

```javascript
{
  name: String (required),
  email: String (unique, required),
  password: String (required, hashed),
  role: String (enum: ['admin', 'customer', 'editor'], default: 'customer'),
  timestamps: true
}
```

### Product Model

```javascript
{
  name: String (required),
  slug: String (unique),
  description: String,
  price: Number (required),
  sku: String (unique),
  images: [String],
  colors: [ObjectId] (ref: 'Color'),
  sizes: [ObjectId] (ref: 'Size'),
  category: ObjectId (ref: 'Category'),
  subcategory: ObjectId (ref: 'SubCategory'),
  stock: Number,
  timestamps: true
}
```

### Category Model

```javascript
{
  categoryId: String (unique, sparse),
  name: String (required, unique),
  slug: String (unique),
  description: String,
  image: String,
  isActive: Boolean (default: true),
  deleted: Boolean (default: false),
  timestamps: true
}
```

### Brand Model

```javascript
{
  brandId: String (unique, required),
  name: String (required, unique),
  logo: String,
  gstNo: String,
  companyName: String,
  address: String,
  isActive: Boolean (default: true),
  deleted: Boolean (default: false),
  timestamps: true
}
```

### Color Model

```javascript
{
  name: String (required, unique),
  code: String (required),
  image: String,
  isActive: Boolean (default: true),
  deleted: Boolean (default: false),
  timestamps: true
}
```

### Review Model

```javascript
{
  categoryId: ObjectId (ref: 'Category', required),
  subCategoryId: ObjectId (ref: 'Subcategory', required),
  productId: ObjectId (ref: 'Product', required),
  productName: String,
  userId: String (required),
  name: String (required),
  avatar: String,
  title: String,
  email: String (required),
  comment: String (required),
  rating: Number (required, min: 1, max: 5),
  productImage: String,
  status: String (enum: ['pending', 'approved', 'rejected'], default: 'pending'),
  isActive: Boolean (default: true),
  timestamps: true
}
```

### Order Model

```javascript
{
  user: ObjectId (ref: 'User'),
  products: [{
    product: ObjectId (ref: 'Product'),
    quantity: Number,
    price: Number
  }],
  amount: Number,
  paymentStatus: String (default: 'pending'),
  timestamps: true
}
```

## API Endpoints

### Authentication Routes (`/api/auth`)

- `POST /register` - User registration
- `POST /login` - User login

### User Routes (`/api/users`)

- `GET /` - Get all users (admin only)
- `GET /:id` - Get user by ID
- `PUT /:id` - Update user
- `DELETE /:id` - Delete user

### Product Routes (`/api/products`)

- `GET /` - Get all products
- `GET /:id` - Get product by ID
- `POST /` - Create new product
- `PUT /:id` - Update product
- `DELETE /:id` - Delete product
- `GET /:id/colors` - Get product color variants

### Category Routes (`/api/categories`)

- `GET /` - Get all categories
- `GET /:id` - Get category by ID
- `POST /` - Create new category
- `PUT /:id` - Update category
- `DELETE /:id` - Delete category

### Brand Routes (`/api/brands`)

- `GET /` - Get all brands
- `GET /:id` - Get brand by ID
- `POST /` - Create new brand
- `PUT /:id` - Update brand
- `DELETE /:id` - Delete brand

### Color Routes (`/api/colors`)

- `GET /` - Get all colors
- `POST /` - Create new color
- `PUT /:id` - Update color
- `DELETE /:id` - Delete color

### Size Routes (`/api/sizes`)

- `GET /` - Get all sizes
- `POST /` - Create new size
- `PUT /:id` - Update size
- `DELETE /:id` - Delete size

### Review Routes (`/api/reviews`)

- `GET /` - Get all reviews
- `GET /:id` - Get review by ID
- `POST /` - Create new review
- `PUT /:id` - Update review
- `DELETE /:id` - Delete review

### Additional Routes

- Material Routes (`/api/materials`)
- Subcategory Routes (`/api/subcategories`)
- Product Attribute Routes (`/api/product-attributes`)
- Status Routes (`/api/status`)
- Collar Style Routes (`/api/collar-styles`)
- Fit Type Routes (`/api/fit-types`)
- Country Routes (`/api/countries`)

## Frontend Components

### Admin CMS Structure

#### Core Pages

- **Login** (`/`) - Authentication page
- **Dashboard** (`/dashboard`) - Main admin interface
- **Products** (`/dashboard/addproducts`) - Product management
- **Status** (`/status`) - System status page

#### Management Components

- **ColorManager** - Color attribute management
- **SizeManager** - Size attribute management
- **CategoryManager** - Product category management
- **SubcategoryManager** - Subcategory management
- **BrandManager** - Brand management
- **MaterialManager** - Material attribute management
- **ReviewManager** - Review management
- **ProductMediaUploader** - Media upload interface

#### Layout Components

- **LeftContainer** - Navigation sidebar
- **RightContainer** - Main content area
- **PrivateRoute** - Protected route wrapper

#### Context Providers

- **AuthContext** - Authentication state management

### Customer Frontend (Partial Implementation)

- **ProductDetails** - Product detail page with color selection
- **ColorSelector** - Product variant selection component
- **Login Forms** - Customer authentication

## Authentication & Authorization

### JWT Implementation

- **Token Generation**: 7-day expiration
- **Payload**: User ID and role
- **Storage**: LocalStorage (Admin), Context API
- **Middleware**: Route protection for admin endpoints

### User Roles

- **admin**: Full system access
- **customer**: Limited to customer functions
- **editor**: Content management access

### Security Features

- Password hashing with bcryptjs (10 rounds)
- JWT token validation middleware
- Role-based route protection
- CORS configuration for cross-origin requests

## File Upload & Media Management

### Cloudinary Integration

- **Image Upload**: Product images, brand logos, user avatars
- **Video Support**: Product demonstration videos
- **Optimization**: Automatic image optimization and CDN delivery
- **Storage**: Cloud-based with backup and versioning

### Local Storage Fallback

- **Development**: Local uploads directory
- **Static Serving**: Express static middleware
- **Path**: `/uploads` endpoint for file access

### Upload Middleware

- **Multer Configuration**: File size limits, type validation
- **Error Handling**: Upload failure management
- **Multiple Files**: Support for batch uploads

## Development Workflow

### Environment Setup

1. **Prerequisites**: Node.js 18+, MongoDB, Git
2. **Installation**: `npm install` in root and admin-cms directories
3. **Environment Variables**: Configure `.env` file
4. **Database**: MongoDB connection setup

### Development Commands

```bash
# Start both servers
./start-servers.sh

# Backend only
npm run dev

# Admin CMS only
cd admin-cms && npm start
```

### Environment Variables

```env
# Backend
MONGODB_URI=mongodb://localhost:27017/photuprint
JWT_SECRET=your-jwt-secret
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
PORT=8080

# Frontend
REACT_APP_API_BASE_URL=http://localhost:8080/api
```

### Code Organization

- **ES6 Modules**: Modern JavaScript module system
- **Async/Await**: Promise-based asynchronous operations
- **Error Handling**: Comprehensive try-catch blocks
- **Validation**: Input validation and sanitization
- **Logging**: Morgan for HTTP request logging

## Deployment

### Production Considerations

- **Environment Variables**: Secure configuration management
- **Database**: MongoDB Atlas or dedicated server
- **File Storage**: Cloudinary for production media
- **Process Management**: PM2 or Docker containers
- **Reverse Proxy**: Nginx for load balancing
- **SSL/TLS**: HTTPS encryption
- **Monitoring**: Application performance monitoring

### Build Process

```bash
# Admin CMS production build
cd admin-cms
npm run build

# Backend production
NODE_ENV=production node backend/index.js
```

## Security Considerations

### Data Protection

- **Password Security**: bcryptjs hashing
- **JWT Security**: Secure secret keys, token expiration
- **Input Validation**: Mongoose schema validation
- **SQL Injection**: MongoDB's built-in protection
- **XSS Prevention**: Input sanitization

### API Security

- **CORS Configuration**: Controlled cross-origin access
- **Rate Limiting**: Prevent API abuse (to be implemented)
- **Authentication Middleware**: Protected route access
- **File Upload Security**: Type and size validation

### Best Practices

- **Environment Variables**: Sensitive data protection
- **Error Handling**: No sensitive information exposure
- **Logging**: Security event monitoring
- **Updates**: Regular dependency updates

## Performance Optimization

### Database Optimization

- **Indexing**: Strategic database indexes
- **Query Optimization**: Efficient MongoDB queries
- **Connection Pooling**: Mongoose connection management
- **Soft Deletes**: Maintain data integrity

### Frontend Optimization

- **Code Splitting**: React lazy loading
- **Bundle Optimization**: Webpack optimization
- **Caching**: Browser and CDN caching
- **Image Optimization**: Cloudinary transformations

### API Performance

- **Response Compression**: Gzip compression
- **Pagination**: Large dataset handling
- **Caching**: Redis implementation (future)
- **CDN**: Static asset delivery

### Monitoring

- **Performance Metrics**: Response time monitoring
- **Error Tracking**: Comprehensive error logging
- **Resource Usage**: Memory and CPU monitoring
- **Database Performance**: Query performance analysis

---

## Contributing

### Development Guidelines

1. **Code Style**: Follow ESLint and Prettier configurations
2. **Git Workflow**: Feature branches with pull requests
3. **Testing**: Unit and integration tests
4. **Documentation**: Update technical documentation
5. **Security**: Security review for sensitive changes

### Future Enhancements

- **Mobile App**: React Native implementation
- **Payment Integration**: Complete Stripe integration
- **Search Functionality**: Elasticsearch integration
- **Real-time Features**: WebSocket implementation
- **Analytics**: User behavior tracking
- **Multi-language**: Internationalization support

---

_This documentation is maintained by the PhotuPrint development team. Last updated: $(date)_
