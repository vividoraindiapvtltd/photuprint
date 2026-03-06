/**
 * Script to fix all collection indexes for multi-tenant support
 * 
 * Run with: node scripts/fixAllIndexes.js
 * 
 * This script drops old non-multi-tenant indexes and recreates 
 * the correct compound indexes scoped by website.
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/photuprint';
const DB_NAME = 'mydatabase'; // Same as used in constants.js

// Collection configurations with their unique indexes
const COLLECTIONS = [
  {
    name: 'colors',
    indexes: [
      { fields: { name: 1, website: 1 }, options: { unique: true, partialFilterExpression: { deleted: false }, name: 'name_website_unique' } },
      { fields: { code: 1, website: 1 }, options: { unique: true, partialFilterExpression: { deleted: false }, name: 'code_website_unique' } },
      { fields: { website: 1, deleted: 1, isActive: 1 }, options: { name: 'website_deleted_isActive' } },
      { fields: { website: 1, name: 1 }, options: { name: 'website_name' } },
      { fields: { website: 1 }, options: { name: 'website' } },
      { fields: { createdAt: -1 }, options: { name: 'createdAt_desc' } },
    ]
  },
  {
    name: 'brands',
    indexes: [
      { fields: { name: 1, website: 1 }, options: { unique: true, partialFilterExpression: { deleted: false }, name: 'name_website_unique' } },
      { fields: { brandId: 1, website: 1 }, options: { unique: true, partialFilterExpression: { deleted: false }, name: 'brandId_website_unique' } },
      { fields: { website: 1, isActive: 1, deleted: 1 }, options: { name: 'website_isActive_deleted' } },
      { fields: { website: 1 }, options: { name: 'website' } },
    ]
  },
  {
    name: 'categories',
    indexes: [
      { fields: { name: 1, website: 1 }, options: { unique: true, partialFilterExpression: { deleted: false }, name: 'name_website_unique' } },
      { fields: { slug: 1, website: 1 }, options: { unique: true, partialFilterExpression: { deleted: false }, name: 'slug_website_unique' } },
      { fields: { categoryId: 1, website: 1 }, options: { unique: true, sparse: true, partialFilterExpression: { deleted: false }, name: 'categoryId_website_unique' } },
      { fields: { website: 1, isActive: 1, deleted: 1 }, options: { name: 'website_isActive_deleted' } },
      { fields: { website: 1 }, options: { name: 'website' } },
    ]
  },
  {
    name: 'subcategories',
    indexes: [
      { fields: { name: 1, website: 1, categoryId: 1 }, options: { unique: true, partialFilterExpression: { deleted: false }, name: 'name_website_category_unique' } },
      { fields: { slug: 1, website: 1 }, options: { unique: true, partialFilterExpression: { deleted: false }, name: 'slug_website_unique' } },
      { fields: { subcategoryId: 1, website: 1 }, options: { unique: true, sparse: true, partialFilterExpression: { deleted: false }, name: 'subcategoryId_website_unique' } },
      { fields: { website: 1, categoryId: 1, isActive: 1, deleted: 1 }, options: { name: 'website_category_isActive_deleted' } },
      { fields: { website: 1 }, options: { name: 'website' } },
    ]
  },
  {
    name: 'collarstyles',
    indexes: [
      { fields: { name: 1, website: 1 }, options: { unique: true, partialFilterExpression: { deleted: false }, name: 'name_website_unique' } },
      { fields: { slug: 1, website: 1 }, options: { unique: true, partialFilterExpression: { deleted: false }, name: 'slug_website_unique' } },
      { fields: { collarStyleId: 1, website: 1 }, options: { unique: true, sparse: true, partialFilterExpression: { deleted: false }, name: 'collarStyleId_website_unique' } },
      { fields: { website: 1, deleted: 1, isActive: 1 }, options: { name: 'website_deleted_isActive' } },
      { fields: { website: 1, name: 1 }, options: { name: 'website_name' } },
      { fields: { website: 1 }, options: { name: 'website' } },
      { fields: { createdAt: -1 }, options: { name: 'createdAt_desc' } },
    ]
  },
  {
    name: 'countries',
    indexes: [
      { fields: { name: 1, website: 1 }, options: { unique: true, partialFilterExpression: { deleted: false }, name: 'name_website_unique' } },
      { fields: { code: 1, website: 1 }, options: { unique: true, partialFilterExpression: { deleted: false }, name: 'code_website_unique' } },
      { fields: { website: 1, deleted: 1, isActive: 1 }, options: { name: 'website_deleted_isActive' } },
      { fields: { website: 1, name: 1 }, options: { name: 'website_name' } },
      { fields: { website: 1 }, options: { name: 'website' } },
      { fields: { createdAt: -1 }, options: { name: 'createdAt_desc' } },
    ]
  },
  {
    name: 'fittypes',
    indexes: [
      { fields: { name: 1, website: 1 }, options: { unique: true, partialFilterExpression: { deleted: false }, name: 'name_website_unique' } },
      { fields: { website: 1, deleted: 1, isActive: 1 }, options: { name: 'website_deleted_isActive' } },
      { fields: { website: 1, name: 1 }, options: { name: 'website_name' } },
      { fields: { website: 1 }, options: { name: 'website' } },
      { fields: { createdAt: -1 }, options: { name: 'createdAt_desc' } },
    ]
  },
  {
    name: 'heights',
    indexes: [
      { fields: { name: 1, unit: 1, website: 1 }, options: { unique: true, partialFilterExpression: { deleted: false }, name: 'name_unit_website_unique' } },
      { fields: { website: 1, deleted: 1, isActive: 1 }, options: { name: 'website_deleted_isActive' } },
      { fields: { website: 1, name: 1 }, options: { name: 'website_name' } },
      { fields: { website: 1, unit: 1 }, options: { name: 'website_unit' } },
      { fields: { website: 1 }, options: { name: 'website' } },
      { fields: { createdAt: -1 }, options: { name: 'createdAt_desc' } },
    ]
  },
  {
    name: 'lengths',
    indexes: [
      { fields: { name: 1, unit: 1, website: 1 }, options: { unique: true, partialFilterExpression: { deleted: false }, name: 'name_unit_website_unique' } },
      { fields: { website: 1, deleted: 1, isActive: 1 }, options: { name: 'website_deleted_isActive' } },
      { fields: { website: 1, name: 1 }, options: { name: 'website_name' } },
      { fields: { website: 1, unit: 1 }, options: { name: 'website_unit' } },
      { fields: { website: 1 }, options: { name: 'website' } },
      { fields: { createdAt: -1 }, options: { name: 'createdAt_desc' } },
    ]
  },
  {
    name: 'widths',
    indexes: [
      { fields: { name: 1, unit: 1, website: 1 }, options: { unique: true, partialFilterExpression: { deleted: false }, name: 'name_unit_website_unique' } },
      { fields: { website: 1, deleted: 1, isActive: 1 }, options: { name: 'website_deleted_isActive' } },
      { fields: { website: 1, name: 1 }, options: { name: 'website_name' } },
      { fields: { website: 1, unit: 1 }, options: { name: 'website_unit' } },
      { fields: { website: 1 }, options: { name: 'website' } },
      { fields: { createdAt: -1 }, options: { name: 'createdAt_desc' } },
    ]
  },
  {
    name: 'sizes',
    indexes: [
      { fields: { name: 1, website: 1 }, options: { unique: true, partialFilterExpression: { deleted: false }, name: 'name_website_unique' } },
      { fields: { initial: 1, website: 1 }, options: { unique: true, partialFilterExpression: { deleted: false }, name: 'initial_website_unique' } },
      { fields: { website: 1, deleted: 1, isActive: 1 }, options: { name: 'website_deleted_isActive' } },
      { fields: { website: 1, name: 1, dimensions: 1 }, options: { name: 'website_name_dimensions' } },
      { fields: { website: 1 }, options: { name: 'website' } },
      { fields: { createdAt: -1 }, options: { name: 'createdAt_desc' } },
    ]
  },
  {
    name: 'materials',
    indexes: [
      { fields: { name: 1, website: 1 }, options: { unique: true, partialFilterExpression: { deleted: false }, name: 'name_website_unique' } },
      { fields: { website: 1, type: 1 }, options: { name: 'website_type' } },
      { fields: { website: 1, deleted: 1, isActive: 1 }, options: { name: 'website_deleted_isActive' } },
      { fields: { website: 1, category: 1 }, options: { name: 'website_category' } },
      { fields: { website: 1 }, options: { name: 'website' } },
      { fields: { createdAt: -1 }, options: { name: 'createdAt_desc' } },
    ]
  },
  {
    name: 'patterns',
    indexes: [
      { fields: { name: 1, website: 1 }, options: { unique: true, partialFilterExpression: { deleted: false }, name: 'name_website_unique' } },
      { fields: { website: 1, deleted: 1, isActive: 1 }, options: { name: 'website_deleted_isActive' } },
      { fields: { website: 1, name: 1 }, options: { name: 'website_name' } },
      { fields: { website: 1 }, options: { name: 'website' } },
      { fields: { createdAt: -1 }, options: { name: 'createdAt_desc' } },
    ]
  },
  {
    name: 'sleevetypes',
    indexes: [
      { fields: { name: 1, website: 1 }, options: { unique: true, partialFilterExpression: { deleted: false }, name: 'name_website_unique' } },
      { fields: { website: 1, deleted: 1, isActive: 1 }, options: { name: 'website_deleted_isActive' } },
      { fields: { website: 1, name: 1 }, options: { name: 'website_name' } },
      { fields: { website: 1 }, options: { name: 'website' } },
      { fields: { createdAt: -1 }, options: { name: 'createdAt_desc' } },
    ]
  },
  {
    name: 'gstslabs',
    indexes: [
      { fields: { rate: 1, website: 1 }, options: { unique: true, partialFilterExpression: { deleted: false }, name: 'rate_website_unique' } },
      { fields: { name: 1, website: 1 }, options: { unique: true, partialFilterExpression: { deleted: false }, name: 'name_website_unique' } },
      { fields: { website: 1, name: 1 }, options: { name: 'website_name' } },
      { fields: { website: 1, deleted: 1, isActive: 1 }, options: { name: 'website_deleted_isActive' } },
      { fields: { website: 1, rate: 1 }, options: { name: 'website_rate' } },
      { fields: { website: 1 }, options: { name: 'website' } },
      { fields: { createdAt: -1 }, options: { name: 'createdAt_desc' } },
    ]
  },
  {
    name: 'printingtypes',
    indexes: [
      { fields: { name: 1, website: 1 }, options: { unique: true, partialFilterExpression: { deleted: false }, name: 'name_website_unique' } },
      { fields: { website: 1, deleted: 1, isActive: 1 }, options: { name: 'website_deleted_isActive' } },
      { fields: { website: 1, name: 1 }, options: { name: 'website_name' } },
      { fields: { website: 1 }, options: { name: 'website' } },
    ]
  },
  {
    name: 'coupons',
    indexes: [
      { fields: { code: 1, website: 1 }, options: { unique: true, partialFilterExpression: { deleted: false }, name: 'code_website_unique' } },
      { fields: { website: 1, deleted: 1, isActive: 1 }, options: { name: 'website_deleted_isActive' } },
      { fields: { website: 1, expiryDate: 1 }, options: { name: 'website_expiryDate' } },
      { fields: { website: 1 }, options: { name: 'website' } },
    ]
  },
  {
    name: 'products',
    indexes: [
      { fields: { productId: 1, website: 1 }, options: { unique: true, partialFilterExpression: { deleted: false }, name: 'productId_website_unique' } },
      { fields: { slug: 1, website: 1 }, options: { unique: true, partialFilterExpression: { deleted: false }, name: 'slug_website_unique' } },
      { fields: { sku: 1, website: 1 }, options: { unique: true, partialFilterExpression: { deleted: false }, name: 'sku_website_unique' } },
      { fields: { website: 1, isActive: 1, deleted: 1 }, options: { name: 'website_isActive_deleted' } },
      { fields: { website: 1 }, options: { name: 'website' } },
    ]
  },
  {
    name: 'pincodes',
    indexes: [
      { fields: { name: 1, website: 1 }, options: { unique: true, partialFilterExpression: { deleted: false }, name: 'name_website_unique' } },
      { fields: { website: 1, deleted: 1, isActive: 1 }, options: { name: 'website_deleted_isActive' } },
      { fields: { website: 1, name: 1 }, options: { name: 'website_name' } },
      { fields: { website: 1, state: 1, district: 1 }, options: { name: 'website_state_district' } },
      { fields: { website: 1 }, options: { name: 'website' } },
      { fields: { createdAt: -1 }, options: { name: 'createdAt_desc' } },
    ]
  },
  {
    name: 'shippingzones',
    indexes: [
      { fields: { name: 1, website: 1 }, options: { unique: true, partialFilterExpression: { deleted: false }, name: 'name_website_unique' } },
      { fields: { website: 1, deleted: 1, isActive: 1 }, options: { name: 'website_deleted_isActive' } },
      { fields: { website: 1, name: 1 }, options: { name: 'website_name' } },
      { fields: { website: 1 }, options: { name: 'website' } },
    ]
  },
  {
    name: 'templates',
    indexes: [
      { fields: { templateId: 1, website: 1 }, options: { unique: true, partialFilterExpression: { deleted: false }, name: 'templateId_website_unique' } },
      { fields: { website: 1, categoryId: 1, category: 1, isActive: 1 }, options: { name: 'website_categoryId_category_isActive' } },
      { fields: { website: 1, name: 1 }, options: { name: 'website_name' } },
      { fields: { website: 1, deleted: 1, isActive: 1 }, options: { name: 'website_deleted_isActive' } },
      { fields: { website: 1 }, options: { name: 'website' } },
    ]
  },
  {
    name: 'fonts',
    indexes: [
      { fields: { name: 1, website: 1 }, options: { unique: true, partialFilterExpression: { deleted: false }, name: 'name_website_unique' } },
      { fields: { website: 1, type: 1, isActive: 1 }, options: { name: 'website_type_isActive' } },
      { fields: { website: 1, deleted: 1 }, options: { name: 'website_deleted' } },
      { fields: { website: 1, sortOrder: 1, name: 1 }, options: { name: 'website_sortOrder_name' } },
      { fields: { website: 1 }, options: { name: 'website' } },
    ]
  },
];

async function fixCollectionIndexes(db, collectionConfig) {
  const { name, indexes } = collectionConfig;
  
  console.log(`\n=== Processing ${name} ===`);
  
  try {
    const collection = db.collection(name);
    
    // Check if collection exists
    const collections = await db.listCollections({ name }).toArray();
    if (collections.length === 0) {
      console.log(`  Collection ${name} does not exist, skipping...`);
      return;
    }
    
    // Get current indexes
    const currentIndexes = await collection.indexes();
    console.log(`  Current indexes: ${currentIndexes.length}`);
    
    // Drop all non-_id indexes
    for (const idx of currentIndexes) {
      if (idx.name !== '_id_') {
        try {
          await collection.dropIndex(idx.name);
          console.log(`  Dropped: ${idx.name}`);
        } catch (err) {
          console.log(`  Could not drop ${idx.name}: ${err.message}`);
        }
      }
    }
    
    // Create new indexes
    for (const indexConfig of indexes) {
      try {
        await collection.createIndex(indexConfig.fields, indexConfig.options);
        console.log(`  Created: ${indexConfig.options.name}`);
      } catch (err) {
        console.log(`  Failed to create ${indexConfig.options.name}: ${err.message}`);
      }
    }
    
    console.log(`  ✅ ${name} indexes updated`);
    
  } catch (error) {
    console.error(`  ❌ Error processing ${name}:`, error.message);
  }
}

async function fixAllIndexes() {
  try {
    console.log('='.repeat(60));
    console.log('Multi-Tenant Index Fix Script');
    console.log('='.repeat(60));
    
    console.log('\nConnecting to MongoDB...');
    console.log(`Using database: ${DB_NAME}`);
    await mongoose.connect(MONGODB_URI, { dbName: DB_NAME });
    console.log(`Connected to MongoDB database: ${mongoose.connection.db.databaseName}`);

    const db = mongoose.connection.db;
    
    // Process each collection
    for (const collectionConfig of COLLECTIONS) {
      await fixCollectionIndexes(db, collectionConfig);
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ All indexes have been processed!');
    console.log('='.repeat(60));
    console.log('\nYou can now create the same entity names in different websites.');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

fixAllIndexes();
