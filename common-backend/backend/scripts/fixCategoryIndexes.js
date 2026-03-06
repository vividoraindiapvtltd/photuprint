import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import connectDB from '../db/index.js';
import Category from '../models/category.model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const fixCategoryIndexes = async () => {
  try {
    await connectDB();
    console.log('✅ Connected to MongoDB\n');

    const collection = Category.collection;
    const indexes = await collection.indexes();
    
    console.log('📋 Current indexes on categories collection:');
    indexes.forEach(idx => {
      console.log(`   - ${idx.name}: ${JSON.stringify(idx.key)} (unique: ${idx.unique || false})`);
    });
    console.log('');

    // Drop old unique indexes that don't include website
    const indexesToDrop = [];
    
    // Find all unique indexes that don't have website in their key
    indexes.forEach(idx => {
      if (idx.unique && idx.key && !idx.key.website) {
        // Skip _id_ index
        if (idx.name !== '_id_') {
          indexesToDrop.push(idx);
        }
      }
    });
    
    if (indexesToDrop.length > 0) {
      console.log('🗑️  Dropping old unique indexes that don\'t include website:');
      for (const idx of indexesToDrop) {
        console.log(`   - ${idx.name}: ${JSON.stringify(idx.key)}`);
        try {
          await collection.dropIndex(idx.name);
          console.log(`   ✅ Successfully dropped ${idx.name} index`);
        } catch (err) {
          console.log(`   ⚠️  Error dropping ${idx.name} index: ${err.message}`);
        }
      }
      console.log('');
    } else {
      console.log('ℹ️  No old unique indexes found that need to be dropped\n');
    }

    // Ensure compound index exists
    console.log('🔍 Checking for compound index: { name: 1, website: 1 }');
    const compoundIndex = indexes.find(idx => 
      idx.key && 
      idx.key.name === 1 && 
      idx.key.website === 1 &&
      idx.unique
    );
    
    if (!compoundIndex) {
      console.log('📝 Creating compound unique index: { name: 1, website: 1 }');
      try {
        await collection.createIndex(
          { name: 1, website: 1 },
          { 
            unique: true, 
            partialFilterExpression: { deleted: false },
            name: 'name_1_website_1'
          }
        );
        console.log('✅ Successfully created compound index\n');
      } catch (err) {
        console.log(`⚠️  Error creating compound index: ${err.message}\n`);
      }
    } else {
      console.log('✅ Compound index already exists\n');
    }

    // List final indexes
    const finalIndexes = await collection.indexes();
    console.log('📋 Final indexes on categories collection:');
    finalIndexes.forEach(idx => {
      console.log(`   - ${idx.name}: ${JSON.stringify(idx.key)} (unique: ${idx.unique || false})`);
    });

    console.log('\n✅ Index fix complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    console.error('Error stack:', error.stack);
    process.exit(1);
  }
};

fixCategoryIndexes();
