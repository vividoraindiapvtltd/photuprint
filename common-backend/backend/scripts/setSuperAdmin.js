/**
 * Script to set a user as Super Admin
 * 
 * Run with: node scripts/setSuperAdmin.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env') });

// Import User model
import User from '../models/user.model.js';

const SUPER_ADMIN_EMAIL = 'admin@photuprint.com';

async function setSuperAdmin() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('❌ MONGO_URI not found in environment variables');
      process.exit(1);
    }

    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Find the user
    const user = await User.findOne({ email: SUPER_ADMIN_EMAIL });
    
    if (!user) {
      console.error(`❌ User with email ${SUPER_ADMIN_EMAIL} not found`);
      process.exit(1);
    }

    console.log(`📧 Found user: ${user.name} (${user.email})`);
    console.log(`   Current role: ${user.role}`);

    // Update to super_admin
    if (user.role === 'super_admin') {
      console.log('✅ User is already a Super Admin');
    } else {
      user.role = 'super_admin';
      user.isActive = true;
      user.permissions = []; // Super admin doesn't need specific permissions
      await user.save();
      console.log('✅ User role updated to super_admin');
    }

    // Also seed default permissions if not already seeded
    const Permission = (await import('../models/permission.model.js')).default;
    const permissionCount = await Permission.countDocuments();
    
    if (permissionCount === 0) {
      console.log('🔄 Seeding default permissions...');
      await Permission.seedDefaultPermissions();
      console.log('✅ Default permissions seeded');
    } else {
      console.log(`✅ ${permissionCount} permissions already exist`);
    }

    console.log('\n🎉 Setup complete!');
    console.log(`   Super Admin: ${SUPER_ADMIN_EMAIL}`);
    console.log('   You can now log in with full access to all features.');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
    process.exit(0);
  }
}

setSuperAdmin();
