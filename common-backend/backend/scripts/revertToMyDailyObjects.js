import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import connectDB from '../db/index.js';
import Website from '../models/website.model.js';
import Brand from '../models/brand.model.js';
import Category from '../models/category.model.js';
import Subcategory from '../models/subcategory.model.js';
import Product from '../models/product.model.js';
import Company from '../models/company.model.js';
import Coupon from '../models/coupon.model.js';
import Review from '../models/review.model.js';
import Order from '../models/order.model.js';
import Template from '../models/template.model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const revertToMyDailyObjects = async () => {
  try {
    await connectDB();
    console.log('✅ Connected to MongoDB\n');

    // Get MyDailyObjects website
    const myDailyObjectsWebsite = await Website.findOne({ 
      $or: [
        { domain: 'mydailyobjects.com' },
        { name: { $regex: /mydailyobjects/i } }
      ]
    });

    if (!myDailyObjectsWebsite) {
      console.log('❌ MyDailyObjects.com website not found');
      process.exit(1);
    }

    const websiteId = myDailyObjectsWebsite._id;
    console.log(`📌 Target Website: ${myDailyObjectsWebsite.name} (${myDailyObjectsWebsite.domain})`);
    console.log(`📌 Website ID: ${websiteId}\n`);

    // Get photuprint website to find records that were moved
    const photuprintWebsite = await Website.findOne({ 
      domain: 'photuprint.com' 
    });

    if (!photuprintWebsite) {
      console.log('❌ photuprint.com website not found');
      process.exit(1);
    }

    const photuprintWebsiteId = photuprintWebsite._id;
    console.log(`📌 Source Website (photuprint.com): ${photuprintWebsite._id}\n`);

    const modelsToRevert = [
      { model: Brand, name: 'Brands' },
      { model: Category, name: 'Categories' },
      { model: Subcategory, name: 'Subcategories' },
      { model: Product, name: 'Products' },
      { model: Company, name: 'Companies' },
      { model: Coupon, name: 'Coupons' },
      { model: Review, name: 'Reviews' },
      { model: Order, name: 'Orders' },
      { model: Template, name: 'Templates' },
    ];

    let totalReverted = 0;

    for (const { model, name } of modelsToRevert) {
      // Find records that are currently assigned to photuprint.com
      // These are the ones that were moved from MyDailyObjects
      const recordsToRevert = await model.find({ 
        website: photuprintWebsiteId
      });

      if (recordsToRevert.length > 0) {
        console.log(`\n🔄 Reverting ${name}...`);
        console.log(`   - Records found in photuprint.com: ${recordsToRevert.length}`);

        // Show what we're reverting
        recordsToRevert.forEach(record => {
          const nameField = record.name || record.code || record.orderNumber || record._id;
          console.log(`     - ${nameField}`);
        });

        // Move them back to MyDailyObjects
        const result = await model.updateMany(
          { 
            website: photuprintWebsiteId
          },
          { $set: { website: websiteId } }
        );

        console.log(`   ✅ Reverted ${result.modifiedCount} records to MyDailyObjects.com`);
        totalReverted += result.modifiedCount;
      } else {
        console.log(`\nℹ️  ${name}: No records to revert`);
      }
    }

    console.log(`\n\n🎉 Reversion complete!`);
    console.log(`📊 Total records reverted: ${totalReverted}`);

    // Show final counts
    console.log(`\n📦 Final record counts:\n`);
    console.log(`For MyDailyObjects.com (${myDailyObjectsWebsite.domain}):`);
    for (const { model, name } of modelsToRevert) {
      const count = await model.countDocuments({ website: websiteId });
      console.log(`   - ${name}: ${count}`);
    }

    console.log(`\nFor photuprint.com:`);
    for (const { model, name } of modelsToRevert) {
      const count = await model.countDocuments({ website: photuprintWebsiteId });
      console.log(`   - ${name}: ${count}`);
    }

    console.log(`\n✅ All records have been moved back to MyDailyObjects.com`);
    console.log(`💡 You can now select "mydailyobjects.com" in the admin panel to see your records\n`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    console.error('Error stack:', error.stack);
    process.exit(1);
  }
};

revertToMyDailyObjects();
