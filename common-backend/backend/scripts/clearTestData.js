import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';

// Import models
import Brand from '../models/brand.model.js';
import Category from '../models/category.model.js';
import Subcategory from '../models/subcategory.model.js';
import Product from '../models/product.model.js';
import Company from '../models/company.model.js';
import Coupon from '../models/coupon.model.js';
import Review from '../models/review.model.js';
import Order from '../models/order.model.js';
import Color from '../models/color.model.js';
import Size from '../models/size.model.js';
import Material from '../models/material.model.js';
import Pattern from '../models/pattern.model.js';
import SleeveType from '../models/sleeveType.model.js';
import Template from '../models/template.model.js';
import { DB_NAME } from '../constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const clearTestData = async () => {
  try {
    // Connect to MongoDB
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI, {
      dbName: DB_NAME,
    });
    console.log('✅ Connected to MongoDB');

    console.log('🧹 Clearing test data from collections...\n');

    // Clear all data from each collection
    const collections = [
      { name: 'Brands', model: Brand },
      { name: 'Categories', model: Category },
      { name: 'Subcategories', model: Subcategory },
      { name: 'Products', model: Product },
      { name: 'Companies', model: Company },
      { name: 'Coupons', model: Coupon },
      { name: 'Reviews', model: Review },
      { name: 'Orders', model: Order },
      { name: 'Colors', model: Color },
      { name: 'Sizes', model: Size },
      { name: 'Materials', model: Material },
      { name: 'Patterns', model: Pattern },
      { name: 'SleeveTypes', model: SleeveType },
      { name: 'Templates', model: Template },
    ];

    let totalDeleted = 0;

    for (const collection of collections) {
      try {
        const result = await collection.model.deleteMany({});
        const count = result.deletedCount || 0;
        totalDeleted += count;
        console.log(`✅ ${collection.name}: Deleted ${count} records`);
      } catch (error) {
        console.error(`❌ Error clearing ${collection.name}:`, error.message);
      }
    }

    console.log('\n🎉 Cleanup complete!');
    console.log(`📊 Total records deleted: ${totalDeleted}`);
    console.log('\n💡 Note: Websites and Users were NOT deleted (needed for login and website selection)');
    console.log('   You can now add fresh test data through the admin panel.');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error clearing test data:', error);
    console.error('Error stack:', error.stack);
    process.exit(1);
  }
};

// Run the cleanup script
clearTestData();
