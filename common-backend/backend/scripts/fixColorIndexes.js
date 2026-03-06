/**
 * Script to fix Color collection indexes for multi-tenant support
 * 
 * Run with: node scripts/fixColorIndexes.js
 * 
 * This script:
 * 1. Drops all existing indexes on the Color collection (except _id)
 * 2. Recreates the correct compound indexes scoped by website
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/photuprint';

async function fixColorIndexes() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;
    const colorCollection = db.collection('colors');

    // Get current indexes
    console.log('\n--- Current Indexes ---');
    const currentIndexes = await colorCollection.indexes();
    currentIndexes.forEach(idx => {
      console.log(`  ${idx.name}: ${JSON.stringify(idx.key)}${idx.unique ? ' (UNIQUE)' : ''}`);
    });

    // Drop all indexes except _id
    console.log('\n--- Dropping non-_id indexes ---');
    for (const idx of currentIndexes) {
      if (idx.name !== '_id_') {
        try {
          await colorCollection.dropIndex(idx.name);
          console.log(`  Dropped: ${idx.name}`);
        } catch (err) {
          console.log(`  Failed to drop ${idx.name}: ${err.message}`);
        }
      }
    }

    // Create correct compound indexes
    console.log('\n--- Creating correct compound indexes ---');

    // Index 1: name + website (unique for non-deleted)
    try {
      await colorCollection.createIndex(
        { name: 1, website: 1 },
        { 
          unique: true, 
          partialFilterExpression: { deleted: false },
          name: 'name_website_unique'
        }
      );
      console.log('  Created: name_website_unique');
    } catch (err) {
      console.log(`  Failed to create name_website_unique: ${err.message}`);
    }

    // Index 2: code + website (unique for non-deleted)
    try {
      await colorCollection.createIndex(
        { code: 1, website: 1 },
        { 
          unique: true, 
          partialFilterExpression: { deleted: false },
          name: 'code_website_unique'
        }
      );
      console.log('  Created: code_website_unique');
    } catch (err) {
      console.log(`  Failed to create code_website_unique: ${err.message}`);
    }

    // Index 3: Performance index
    try {
      await colorCollection.createIndex(
        { website: 1, deleted: 1, isActive: 1 },
        { name: 'website_deleted_isActive' }
      );
      console.log('  Created: website_deleted_isActive');
    } catch (err) {
      console.log(`  Failed to create website_deleted_isActive: ${err.message}`);
    }

    // Index 4: website + name for lookups
    try {
      await colorCollection.createIndex(
        { website: 1, name: 1 },
        { name: 'website_name' }
      );
      console.log('  Created: website_name');
    } catch (err) {
      console.log(`  Failed to create website_name: ${err.message}`);
    }

    // Index 5: createdAt for sorting
    try {
      await colorCollection.createIndex(
        { createdAt: -1 },
        { name: 'createdAt_desc' }
      );
      console.log('  Created: createdAt_desc');
    } catch (err) {
      console.log(`  Failed to create createdAt_desc: ${err.message}`);
    }

    // Index 6: website index
    try {
      await colorCollection.createIndex(
        { website: 1 },
        { name: 'website' }
      );
      console.log('  Created: website');
    } catch (err) {
      console.log(`  Failed to create website: ${err.message}`);
    }

    // Verify final indexes
    console.log('\n--- Final Indexes ---');
    const finalIndexes = await colorCollection.indexes();
    finalIndexes.forEach(idx => {
      console.log(`  ${idx.name}: ${JSON.stringify(idx.key)}${idx.unique ? ' (UNIQUE)' : ''}`);
    });

    console.log('\n✅ Color indexes fixed successfully!');
    console.log('You can now create the same color name/code in different websites.');

  } catch (error) {
    console.error('Error fixing indexes:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

fixColorIndexes();
