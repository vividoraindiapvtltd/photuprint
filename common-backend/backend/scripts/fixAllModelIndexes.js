import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import connectDB from '../db/index.js';
import Brand from '../models/brand.model.js';
import Category from '../models/category.model.js';
import Subcategory from '../models/subcategory.model.js';
import Product from '../models/product.model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const fixModelIndexes = async (Model, modelName) => {
  try {
    const collection = Model.collection;
    const indexes = await collection.indexes();
    
    console.log(`\n📋 Current indexes on ${modelName} collection:`);
    indexes.forEach(idx => {
      console.log(`   - ${idx.name}: ${JSON.stringify(idx.key)} (unique: ${idx.unique || false})`);
    });

    // Drop old unique indexes that don't include website
    const indexesToDrop = [];
    
    indexes.forEach(idx => {
      if (idx.unique && idx.key && !idx.key.website) {
        // Skip _id_ index
        if (idx.name !== '_id_') {
          indexesToDrop.push(idx);
        }
      }
    });
    
    if (indexesToDrop.length > 0) {
      console.log(`\n🗑️  Dropping old unique indexes for ${modelName} that don't include website:`);
      for (const idx of indexesToDrop) {
        console.log(`   - ${idx.name}: ${JSON.stringify(idx.key)}`);
        try {
          await collection.dropIndex(idx.name);
          console.log(`   ✅ Successfully dropped ${idx.name} index`);
        } catch (err) {
          console.log(`   ⚠️  Error dropping ${idx.name} index: ${err.message}`);
        }
      }
    } else {
      console.log(`\nℹ️  No old unique indexes found for ${modelName} that need to be dropped`);
    }

    // List final indexes
    const finalIndexes = await collection.indexes();
    console.log(`\n📋 Final indexes on ${modelName} collection:`);
    finalIndexes.forEach(idx => {
      console.log(`   - ${idx.name}: ${JSON.stringify(idx.key)} (unique: ${idx.unique || false})`);
    });
  } catch (error) {
    console.error(`❌ Error fixing indexes for ${modelName}:`, error.message);
  }
};

const fixAllIndexes = async () => {
  try {
    await connectDB();
    console.log('✅ Connected to MongoDB\n');
    console.log('🔧 Fixing indexes for all models...\n');

    await fixModelIndexes(Brand, 'brands');
    await fixModelIndexes(Category, 'categories');
    await fixModelIndexes(Subcategory, 'subcategories');
    await fixModelIndexes(Product, 'products');

    console.log('\n\n✅ All index fixes complete!');
    console.log('💡 You can now create records with the same names in different websites.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    console.error('Error stack:', error.stack);
    process.exit(1);
  }
};

fixAllIndexes();
