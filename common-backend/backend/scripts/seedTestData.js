import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

// Import models
import Website from '../models/website.model.js';
import User from '../models/user.model.js';
import Category from '../models/category.model.js';
import Product from '../models/product.model.js';
import Company from '../models/company.model.js';
import Coupon from '../models/coupon.model.js';
import { DB_NAME } from '../constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const seedTestData = async () => {
  try {
    // Connect to MongoDB
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI, {
      dbName: DB_NAME,
    });
    console.log('✅ Connected to MongoDB');

    // Clear existing test data (optional - comment out if you want to keep existing data)
    console.log('🧹 Cleaning up existing test data...');
    await Website.deleteMany({ domain: { $in: ['test1.example.com', 'test2.example.com', 'test3.example.com'] } });
    await User.deleteMany({ email: { $in: ['admin@test1.com', 'admin@test2.com', 'superadmin@test.com'] } });
    await Category.deleteMany({ slug: { $in: ['t-shirts-ws1', 'hoodies-ws1', 'polo-shirts-ws2', 'tank-tops-ws3'] } });
    await Product.deleteMany({ slug: { $in: ['classic-white-t-shirt-ws1', 'black-hoodie-ws1', 'blue-polo-shirt-ws2', 'red-tank-top-ws3'] } });
    await Company.deleteMany({ domain: { $in: ['test1.example.com', 'test2.example.com'] } });
    await Coupon.deleteMany({ code: { $in: ['WELCOME10', 'SAVE20'] } });
    console.log('✅ Cleanup complete');

    // Create Websites
    console.log('🌐 Creating websites...');
    const website1 = await Website.create({
      name: 'Test Store 1',
      domain: 'test1.example.com',
      description: 'First test website for multi-tenant testing',
      isActive: true,
      deleted: false,
    });

    const website2 = await Website.create({
      name: 'Test Store 2',
      domain: 'test2.example.com',
      description: 'Second test website for multi-tenant testing',
      isActive: true,
      deleted: false,
    });

    const website3 = await Website.create({
      name: 'Test Store 3',
      domain: 'test3.example.com',
      description: 'Third test website',
      isActive: true,
      deleted: false,
    });

    console.log('✅ Created 3 websites:', website1.name, website2.name, website3.name);

    // Create Admin Users (one for each website)
    console.log('👤 Creating admin users...');
    const hashedPassword = await bcrypt.hash('admin123', 10);

    // Check if users exist, if not create them
    let admin1 = await User.findOne({ email: 'admin@test1.com' });
    if (!admin1) {
      admin1 = await User.create({
        name: 'Admin Test 1',
        email: 'admin@test1.com',
        password: hashedPassword,
        role: 'admin',
        isActive: true,
        emailVerified: true,
        website: website1._id,
        deleted: false,
      });
    } else {
      admin1.website = website1._id;
      await admin1.save();
    }

    let admin2 = await User.findOne({ email: 'admin@test2.com' });
    if (!admin2) {
      admin2 = await User.create({
        name: 'Admin Test 2',
        email: 'admin@test2.com',
        password: hashedPassword,
        role: 'admin',
        isActive: true,
        emailVerified: true,
        website: website2._id,
        deleted: false,
      });
    } else {
      admin2.website = website2._id;
      await admin2.save();
    }

    // Create a super admin (can access all websites)
    let superAdmin = await User.findOne({ email: 'superadmin@test.com' });
    if (!superAdmin) {
      superAdmin = await User.create({
        name: 'Super Admin',
        email: 'superadmin@test.com',
        password: hashedPassword,
        role: 'admin',
        isActive: true,
        emailVerified: true,
        website: null, // Super admin doesn't belong to a specific website
        accessibleWebsites: [website1._id, website2._id, website3._id],
        deleted: false,
      });
    } else {
      superAdmin.accessibleWebsites = [website1._id, website2._id, website3._id];
      await superAdmin.save();
    }

    console.log('✅ Created admin users');
    console.log('   - admin@test1.com / admin123 (Website 1)');
    console.log('   - admin@test2.com / admin123 (Website 2)');
    console.log('   - superadmin@test.com / admin123 (Super Admin - all websites)');

    // Create Categories for each website
    console.log('📁 Creating categories...');
    
    const category1_1 = await Category.create({
      name: 'T-Shirts Store 1',
      slug: 't-shirts-ws1',
      description: 'Comfortable cotton t-shirts',
      isActive: true,
      website: website1._id,
      deleted: false,
    });

    const category1_2 = await Category.create({
      name: 'Hoodies Store 1',
      slug: 'hoodies-ws1',
      description: 'Warm and cozy hoodies',
      isActive: true,
      website: website1._id,
      deleted: false,
    });

    const category2_1 = await Category.create({
      name: 'Polo Shirts Store 2',
      slug: 'polo-shirts-ws2',
      description: 'Classic polo shirts',
      isActive: true,
      website: website2._id,
      deleted: false,
    });

    const category3_1 = await Category.create({
      name: 'Tank Tops Store 3',
      slug: 'tank-tops-ws3',
      description: 'Lightweight tank tops',
      isActive: true,
      website: website3._id,
      deleted: false,
    });

    console.log('✅ Created categories for each website');

    // Create Products for each website
    console.log('🛍️ Creating products...');
    
    const product1_1 = await Product.create({
      productId: 'PROD001',
      name: 'Classic White T-Shirt',
      slug: 'classic-white-t-shirt-ws1',
      description: 'Premium quality white cotton t-shirt',
      price: 599,
      discountedPrice: 499,
      discountPercentage: 17,
      sku: 'TSH-WHT-001-WS1',
      mainImage: 'https://via.placeholder.com/500',
      images: ['https://via.placeholder.com/500'],
      stock: 100,
      category: category1_1._id,
      isActive: true,
      displayMode: 'both',
      website: website1._id,
      deleted: false,
    });

    const product1_2 = await Product.create({
      productId: 'PROD002',
      name: 'Black Hoodie',
      slug: 'black-hoodie-ws1',
      description: 'Comfortable black hoodie',
      price: 1299,
      sku: 'HOD-BLK-001-WS1',
      mainImage: 'https://via.placeholder.com/500',
      images: ['https://via.placeholder.com/500'],
      stock: 50,
      category: category1_2._id,
      isActive: true,
      displayMode: 'both',
      website: website1._id,
      deleted: false,
    });

    const product2_1 = await Product.create({
      productId: 'PROD003',
      name: 'Blue Polo Shirt',
      slug: 'blue-polo-shirt-ws2',
      description: 'Classic blue polo shirt',
      price: 899,
      sku: 'POL-BLU-001-WS2',
      mainImage: 'https://via.placeholder.com/500',
      images: ['https://via.placeholder.com/500'],
      stock: 75,
      category: category2_1._id,
      isActive: true,
      displayMode: 'both',
      website: website2._id,
      deleted: false,
    });

    const product3_1 = await Product.create({
      productId: 'PROD004',
      name: 'Red Tank Top',
      slug: 'red-tank-top-ws3',
      description: 'Stylish red tank top',
      price: 399,
      sku: 'TNK-RED-001-WS3',
      mainImage: 'https://via.placeholder.com/500',
      images: ['https://via.placeholder.com/500'],
      stock: 120,
      category: category3_1._id,
      isActive: true,
      displayMode: 'both',
      website: website3._id,
      deleted: false,
    });

    console.log('✅ Created products for each website');

    // Create Companies for each website
    console.log('🏢 Creating companies...');
    
    const company1 = await Company.create({
      name: 'Test Store 1 Company',
      address: {
        street: '123 Test Street',
        city: 'Test City',
        state: 'Test State',
        zipCode: '12345',
        country: 'Test Country',
      },
      phone: '+1-234-567-8900',
      email: 'info@test1.com',
      gstNumber: 'GST123456789',
      panNumber: 'PAN123456',
      isActive: true,
      isDefault: true,
      website: website1._id,
      domain: website1.domain,
      deleted: false,
    });

    const company2 = await Company.create({
      name: 'Test Store 2 Company',
      address: {
        street: '456 Test Avenue',
        city: 'Test City 2',
        state: 'Test State 2',
        zipCode: '54321',
        country: 'Test Country',
      },
      phone: '+1-234-567-8901',
      email: 'info@test2.com',
      gstNumber: 'GST987654321',
      panNumber: 'PAN654321',
      isActive: true,
      isDefault: true,
      website: website2._id,
      domain: website2.domain,
      deleted: false,
    });

    console.log('✅ Created companies for each website');

    // Create Coupons for each website
    console.log('🎫 Creating coupons...');
    
    const coupon1 = await Coupon.create({
      code: 'WELCOME10',
      type: 'single',
      usageType: 'multiple',
      discountType: 'percentage',
      discountValue: 10,
      minPurchase: 500,
      expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      isActive: true,
      website: website1._id,
      deleted: false,
    });

    const coupon2 = await Coupon.create({
      code: 'SAVE20',
      type: 'single',
      usageType: 'single',
      discountType: 'percentage',
      discountValue: 20,
      minPurchase: 1000,
      expiryDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // 15 days from now
      isActive: true,
      website: website2._id,
      deleted: false,
    });

    console.log('✅ Created coupons for each website');

    console.log('\n🎉 Test data seeded successfully!');
    console.log('\n📋 Summary:');
    console.log(`   - 3 Websites created`);
    console.log(`   - 3 Admin users created (2 website admins + 1 super admin)`);
    console.log(`   - 4 Categories created (distributed across websites)`);
    console.log(`   - 4 Products created (distributed across websites)`);
    console.log(`   - 2 Companies created (one per website)`);
    console.log(`   - 2 Coupons created (one per website)`);
    console.log('\n🔑 Login Credentials:');
    console.log('   Website 1: admin@test1.com / admin123');
    console.log('   Website 2: admin@test2.com / admin123');
    console.log('   Super Admin: superadmin@test.com / admin123 (can access all websites)');
    console.log('\n🌐 Website Domains:');
    console.log(`   - ${website1.name}: ${website1.domain}`);
    console.log(`   - ${website2.name}: ${website2.domain}`);
    console.log(`   - ${website3.name}: ${website3.domain}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding test data:', error);
    console.error('Error stack:', error.stack);
    process.exit(1);
  }
};

// Run the seed script
seedTestData();
