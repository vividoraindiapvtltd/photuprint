import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { DB_NAME } from "./constants.js";
import User from "./models/user.model.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env from backend/.env (not repo root)
dotenv.config({
  path: path.join(__dirname, ".env"),
});

const createTestAdmin = async () => {
    try {
        // Connect to MongoDB
        if (!process.env.MONGODB_URI) {
            throw new Error("Missing MONGODB_URI in backend/.env");
        }
        await mongoose.connect(process.env.MONGODB_URI, {
            dbName: DB_NAME
        });
        console.log('Connected to MongoDB');

        // Check if admin already exists
        let existingAdmin = await User.findOne({ email: 'admin@photuprint.com' });
        if (!existingAdmin) {
            // Create test admin user
            const adminUser = new User({
                name: 'Admin User',
                email: 'admin@photuprint.com',
                password: 'admin123',
                role: 'admin'
            });
            await adminUser.save();
            console.log('✅ Test admin user created successfully!');
            console.log('   Email: admin@photuprint.com');
            console.log('   Password: admin123');
        } else {
            console.log('ℹ️  Admin user already exists');
        }

        // Check if customer user exists
        let existingCustomer = await User.findOne({ email: 'customer@photuprint.com' });
        if (!existingCustomer) {
            // Create test customer user
            const customerUser = new User({
                name: 'Test Customer',
                email: 'customer@photuprint.com',
                password: 'customer123',
                role: 'customer',
                phone: '9876543210',
                address: {
                    street: '123 Test Street',
                    city: 'Mumbai',
                    state: 'Maharashtra',
                    zipCode: '400001',
                    country: 'India'
                },
                isActive: true
            });
            await customerUser.save();
            console.log('✅ Test customer user created successfully!');
            console.log('   Email: customer@photuprint.com');
            console.log('   Password: customer123');
        } else {
            console.log('ℹ️  Customer user already exists');
        }
        
        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('Error creating admin user:', error);
        try {
            await mongoose.disconnect();
        } catch {}
        process.exit(1);
    }
};

createTestAdmin(); 