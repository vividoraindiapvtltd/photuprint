import mongoose from 'mongoose';
import connectDB from '../db/index.js';
import Website from '../models/website.model.js';

const fixCollarStyleIndexes = async () => {
  try {
    const db = mongoose.connection.db;
    const collection = db.collection('collarstyles');
    
    console.log('🔧 Starting collar style index fixes...');
    
    // 1. Drop old unique indexes that are not scoped by website
    console.log('📋 Checking existing indexes...');
    const indexes = await collection.indexes();
    console.log('Current indexes:', indexes.map(idx => ({ name: idx.name, key: idx.key })));
    
    const indexesToDrop = [];
    
    // Check for old unique indexes that need to be dropped
    for (const index of indexes) {
      if (index.name === 'collarStyleId_1' && index.unique) {
        indexesToDrop.push('collarStyleId_1');
      }
      if (index.name === 'name_1' && index.unique) {
        indexesToDrop.push('name_1');
      }
      if (index.name === 'slug_1' && index.unique) {
        indexesToDrop.push('slug_1');
      }
    }
    
    // Drop old indexes
    for (const indexName of indexesToDrop) {
      try {
        await collection.dropIndex(indexName);
        console.log(`✅ Dropped old unique index: ${indexName}`);
      } catch (error) {
        if (error.code === 27) {
          console.log(`⚠️  Index ${indexName} doesn't exist, skipping...`);
        } else {
          console.error(`❌ Error dropping index ${indexName}:`, error.message);
        }
      }
    }
    
    // 2. Get default website (mydailyobjects.com) for existing records
    const defaultWebsite = await Website.findOne({ domain: 'mydailyobjects.com' });
    if (!defaultWebsite) {
      console.error('❌ Default website (mydailyobjects.com) not found! Please create it first.');
      return;
    }
    
    console.log(`📍 Using default website: ${defaultWebsite.name} (${defaultWebsite._id})`);
    
    // 3. Update existing collar styles without website field
    const collarStylesWithoutWebsite = await collection.countDocuments({ website: { $exists: false } });
    
    if (collarStylesWithoutWebsite > 0) {
      console.log(`🔄 Updating ${collarStylesWithoutWebsite} collar styles to include website field...`);
      
      const result = await collection.updateMany(
        { website: { $exists: false } },
        { $set: { website: defaultWebsite._id } }
      );
      
      console.log(`✅ Updated ${result.modifiedCount} collar styles with website field`);
    } else {
      console.log('✅ All collar styles already have website field');
    }
    
    // 4. Create new compound unique indexes
    console.log('🔨 Creating new compound unique indexes...');
    
    try {
      await collection.createIndex(
        { name: 1, website: 1 },
        { 
          unique: true, 
          partialFilterExpression: { deleted: false },
          name: 'name_1_website_1_unique'
        }
      );
      console.log('✅ Created compound unique index: name + website');
    } catch (error) {
      if (error.code === 85) {
        console.log('⚠️  Index name_1_website_1_unique already exists');
      } else {
        console.error('❌ Error creating name + website index:', error.message);
      }
    }
    
    try {
      await collection.createIndex(
        { slug: 1, website: 1 },
        { 
          unique: true, 
          partialFilterExpression: { deleted: false },
          name: 'slug_1_website_1_unique'
        }
      );
      console.log('✅ Created compound unique index: slug + website');
    } catch (error) {
      if (error.code === 85) {
        console.log('⚠️  Index slug_1_website_1_unique already exists');
      } else {
        console.error('❌ Error creating slug + website index:', error.message);
      }
    }
    
    try {
      await collection.createIndex(
        { collarStyleId: 1, website: 1 },
        { 
          unique: true, 
          sparse: true,
          partialFilterExpression: { deleted: false },
          name: 'collarStyleId_1_website_1_unique'
        }
      );
      console.log('✅ Created compound unique index: collarStyleId + website');
    } catch (error) {
      if (error.code === 85) {
        console.log('⚠️  Index collarStyleId_1_website_1_unique already exists');
      } else {
        console.error('❌ Error creating collarStyleId + website index:', error.message);
      }
    }
    
    // 5. Create performance indexes
    try {
      await collection.createIndex({ website: 1, deleted: 1, isActive: 1 });
      console.log('✅ Created performance index: website + deleted + isActive');
    } catch (error) {
      if (error.code === 85) {
        console.log('⚠️  Performance index already exists');
      }
    }
    
    // 6. Verify final state
    console.log('📋 Final indexes:');
    const finalIndexes = await collection.indexes();
    finalIndexes.forEach(idx => {
      console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)}`);
    });
    
    console.log('✅ Collar style index fixes completed successfully!');
    
  } catch (error) {
    console.error('❌ Error fixing collar style indexes:', error);
    throw error;
  }
};

const main = async () => {
  try {
    await connectDB();
    await fixCollarStyleIndexes();
    console.log('🎉 All collar style fixes completed successfully!');
  } catch (error) {
    console.error('❌ Script failed:', error);
  } finally {
    await mongoose.connection.close();
    console.log('📡 Database connection closed');
  }
};

main();