# PhotuPrint - Personalized Products E-commerce Platform

A comprehensive e-commerce solution for personalized products with admin CMS, customer frontend, and robust backend API.

## 🚀 Quick Start

```bash
# Clone the repository
git clone <repository-url>
cd PP

# Install dependencies
npm install
cd admin-cms && npm install && cd ..

# Set up environment variables (see Environment Setup section)
cp .env.example .env

# Start all servers
chmod +x start-servers.sh
./start-servers.sh
```

## 📋 Table of Contents

- [Features](#-features)
- [Prerequisites](#-prerequisites)
- [Installation](#-installation)
- [Environment Setup](#-environment-setup)
- [Running the Application](#-running-the-application)
- [Project Structure](#-project-structure)
- [API Documentation](#-api-documentation)
- [Development](#-development)
- [Deployment](#-deployment)
- [Troubleshooting](#-troubleshooting)
- [Contributing](#-contributing)

## ✨ Features

### Admin CMS

- 📊 **Dashboard**: Comprehensive admin interface
- 🛍️ **Product Management**: Add, edit, delete products with variants
- 🏷️ **Category Management**: Organize products by categories and subcategories
- 🎨 **Attribute Management**: Colors, sizes, materials, brands
- ⭐ **Review System**: Manage customer reviews and ratings
- 📸 **Media Upload**: Image and video upload with Cloudinary integration
- 👥 **User Management**: Admin, customer, and editor roles

### Backend API

- 🔐 **Authentication**: JWT-based user authentication
- 📱 **RESTful API**: Comprehensive REST API endpoints
- 🗄️ **MongoDB Integration**: Robust database with Mongoose ODM
- 📁 **File Upload**: Multer and Cloudinary integration
- 🔒 **Security**: Password hashing, CORS, input validation

### Customer Frontend (Partial)

- 🛒 **Product Catalog**: Browse products with color variants
- 🔍 **Product Details**: Detailed product pages
- 👤 **User Authentication**: Customer login and registration

## 🔧 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18.0.0 or higher)
- **npm** (v8.0.0 or higher)
- **MongoDB** (v5.0 or higher)
- **Git** (for version control)

### System Requirements

- **RAM**: 4GB minimum, 8GB recommended
- **Storage**: 2GB free space
- **OS**: Windows 10+, macOS 10.15+, Ubuntu 18.04+

## 📦 Installation

### Step 1: Clone the Repository

```bash
git clone <your-repository-url>
cd PP
```

### Step 2: Install Root Dependencies

```bash
npm install
```

### Step 3: Install Admin CMS Dependencies

```bash
cd admin-cms
npm install
cd ..
```

### Step 4: Install Backend Dependencies (if separate)

The backend dependencies are included in the root `package.json`, but if you have a separate backend package.json:

```bash
cd backend
npm install
cd ..
```

## 🔐 Environment Setup

### Step 1: Create Environment File

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

### Step 2: Configure Environment Variables

#### Backend Configuration (.env)

```env
# Database
MONGODB_URI=mongodb://localhost:27017/photuprint
DB_NAME=mydatabase

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-here

# Server Configuration
PORT=8080
NODE_ENV=development

# Cloudinary Configuration (for file uploads)
CLOUDINARY_CLOUD_NAME=your-cloudinary-cloud-name
CLOUDINARY_API_KEY=your-cloudinary-api-key
CLOUDINARY_API_SECRET=your-cloudinary-api-secret

# Stripe Configuration (for payments)
STRIPE_SECRET_KEY=your-stripe-secret-key
STRIPE_PUBLISHABLE_KEY=your-stripe-publishable-key
```

#### Admin CMS Configuration

Create `.env` file in `admin-cms/` directory:

```env
# API Configuration
REACT_APP_API_BASE_URL=http://localhost:8080/api

# Development Configuration
GENERATE_SOURCEMAP=false
```

### Step 3: Set Up MongoDB

#### Option A: Local MongoDB

1. Install MongoDB locally
2. Start MongoDB service:

   ```bash
   # macOS
   brew services start mongodb-community

   # Ubuntu
   sudo systemctl start mongod

   # Windows
   net start MongoDB
   ```

#### Option B: MongoDB Atlas (Cloud)

1. Create account at [MongoDB Atlas](https://www.mongodb.com/atlas)
2. Create a new cluster
3. Get connection string and update `MONGODB_URI` in `.env`

### Step 4: Set Up Cloudinary (Optional)

1. Create account at [Cloudinary](https://cloudinary.com)
2. Get your cloud name, API key, and API secret
3. Update Cloudinary variables in `.env`

## 🚀 Running the Application

### Option 1: Start All Servers (Recommended)

```bash
# Make script executable
chmod +x start-servers.sh

# Start all servers
./start-servers.sh
```

This will start:

- Backend API on `http://localhost:8080`
- Admin CMS on `http://localhost:3000`

### Option 2: Start Servers Individually

#### Start Backend Server

```bash
npm run dev
```

#### Start Admin CMS

```bash
cd admin-cms
npm start
```

### Default Access URLs

- **Admin CMS**: http://localhost:3000
- **Backend API**: http://localhost:8080
- **API Documentation**: http://localhost:8080/api

### Test Credentials

```
Email: admin@photuprint.com
Password: admin123
```

## 📁 Project Structure

```
PP/
├── 📂 backend/                 # Backend API server
│   ├── 📂 controllers/         # Business logic
│   ├── 📂 models/             # Database models
│   ├── 📂 routes/             # API routes
│   ├── 📂 middlewares/        # Custom middleware
│   ├── 📂 utils/              # Utility functions
│   ├── 📂 uploads/            # File storage
│   └── 📄 app.js              # Express app
│
├── 📂 admin-cms/              # Admin dashboard
│   ├── 📂 src/
│   │   ├── 📂 components/     # React components
│   │   ├── 📂 pages/          # Page components
│   │   ├── 📂 context/        # React context
│   │   └── 📂 api/            # API client
│   └── 📂 build/              # Production build
│
├── 📂 frontend/               # Customer frontend
│   └── 📂 src/                # Source files
│
├── 📄 package.json            # Root dependencies
├── 📄 start-servers.sh        # Startup script
└── 📄 TECHNICAL_DOCUMENTATION.md
```

## 📚 API Documentation

### Base URL

```
http://localhost:8080/api
```

### Authentication Endpoints

```http
POST /api/auth/register    # User registration
POST /api/auth/login       # User login
```

### Product Endpoints

```http
GET    /api/products       # Get all products
GET    /api/products/:id   # Get product by ID
POST   /api/products       # Create product (admin)
PUT    /api/products/:id   # Update product (admin)
DELETE /api/products/:id   # Delete product (admin)
```

### Category Endpoints

```http
GET    /api/categories     # Get all categories
POST   /api/categories     # Create category (admin)
PUT    /api/categories/:id # Update category (admin)
DELETE /api/categories/:id # Delete category (admin)
```

For complete API documentation, see [TECHNICAL_DOCUMENTATION.md](./TECHNICAL_DOCUMENTATION.md)

## 🛠️ Development

### Development Workflow

1. **Create Feature Branch**

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make Changes**
   - Backend: Edit files in `backend/`
   - Admin CMS: Edit files in `admin-cms/src/`
   - Frontend: Edit files in `frontend/src/`

3. **Test Changes**

   ```bash
   # Run tests (if available)
   npm test

   # Check for linting errors
   npm run lint
   ```

4. **Commit Changes**
   ```bash
   git add .
   git commit -m "Add: your feature description"
   ```

### Adding New Features

#### Adding New API Endpoint

1. Create controller in `backend/controllers/`
2. Create model in `backend/models/`
3. Create routes in `backend/routes/`
4. Update `backend/app.js` to include routes

#### Adding New Admin Page

1. Create component in `admin-cms/src/components/`
2. Create page in `admin-cms/src/pages/`
3. Update routing in `admin-cms/src/App.js`
4. Update navigation in dashboard links

### Code Style Guidelines

- Use ES6+ features
- Follow React best practices
- Use meaningful variable names
- Add comments for complex logic
- Handle errors gracefully

## 🚀 Deployment

### Production Build

#### Admin CMS

```bash
cd admin-cms
npm run build
```

#### Backend

```bash
# Set production environment
export NODE_ENV=production

# Start server
node backend/index.js
```

### Deployment Platforms

#### Heroku

1. Install Heroku CLI
2. Create Heroku app
3. Set environment variables
4. Deploy:
   ```bash
   git push heroku main
   ```

#### DigitalOcean/AWS/GCP

1. Set up server
2. Install Node.js and MongoDB
3. Clone repository
4. Install dependencies
5. Set up environment variables
6. Use PM2 for process management:
   ```bash
   npm install -g pm2
   pm2 start backend/index.js
   ```

#### Docker (Optional)

```dockerfile
# Dockerfile example
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 8080
CMD ["node", "backend/index.js"]
```

## 🔧 Troubleshooting

### Common Issues

#### Port Already in Use

```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Kill process on port 8080
lsof -ti:8080 | xargs kill -9
```

#### MongoDB Connection Issues

- Check MongoDB is running: `mongosh`
- Verify connection string in `.env`
- Check network connectivity

#### Cloudinary Upload Issues

- Verify API credentials in `.env`
- Check file size limits
- Ensure correct file formats

#### Admin CMS Won't Load

- Check backend server is running
- Verify API URL in admin CMS `.env`
- Check browser console for errors

### Getting Help

1. Check [TECHNICAL_DOCUMENTATION.md](./TECHNICAL_DOCUMENTATION.md)
2. Search existing issues
3. Create new issue with:
   - Error message
   - Steps to reproduce
   - Environment details

## 🤝 Contributing

### How to Contribute

1. Fork the repository
2. Create feature branch
3. Make changes
4. Add tests (if applicable)
5. Update documentation
6. Submit pull request

### Pull Request Guidelines

- Clear description of changes
- Link to related issues
- Test your changes
- Update documentation
- Follow code style guidelines

### Reporting Issues

- Use issue templates
- Provide detailed information
- Include error messages
- Specify environment details

## 📄 License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

## 👥 Team

- **Development Team**: PhotuPrint.com
- **Maintainer**: [Your Name]

## 📞 Support

- **Email**: support@photuprint.com
- **Documentation**: [TECHNICAL_DOCUMENTATION.md](./TECHNICAL_DOCUMENTATION.md)
- **Issues**: GitHub Issues

---

**Happy Coding! 🚀**
