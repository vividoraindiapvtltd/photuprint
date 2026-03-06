import mongoose from "mongoose"
import dotenv from "dotenv"
import User from "./models/user.model.js"
import bcrypt from "bcryptjs"

dotenv.config()

const verifyAdmin = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI)
    console.log("✅ Connected to MongoDB")

    // Check if admin exists
    const admin = await User.findOne({ email: "admin@photuprint.com" })

    if (!admin) {
      console.log("❌ Admin user not found!")
      console.log("Creating admin user...")

      const hashedPassword = await bcrypt.hash("admin123", 10)
      const newAdmin = await User.create({
        name: "Admin User",
        email: "admin@photuprint.com",
        password: hashedPassword,
        role: "admin",
      })

      console.log("✅ Admin user created successfully!")
      console.log("Email: admin@photuprint.com")
      console.log("Password: admin123")
      console.log("Role: admin")
    } else {
      console.log("✅ Admin user exists!")
      console.log("Email:", admin.email)
      console.log("Role:", admin.role)
      console.log("Name:", admin.name)

      // Verify password
      const passwordMatch = await admin.matchPassword("admin123")
      if (passwordMatch) {
        console.log("✅ Password verification: PASSED")
      } else {
        console.log("⚠️  Password verification: FAILED")
        console.log("Resetting password...")
        admin.password = await bcrypt.hash("admin123", 10)
        await admin.save()
        console.log("✅ Password reset to: admin123")
      }
    }

    // List all admin users
    const allAdmins = await User.find({ role: "admin" })
    console.log(`\n📊 Total admin users: ${allAdmins.length}`)
    allAdmins.forEach((admin, index) => {
      console.log(`${index + 1}. ${admin.email} - ${admin.name}`)
    })

    process.exit(0)
  } catch (error) {
    console.error("❌ Error:", error.message)
    process.exit(1)
  }
}

verifyAdmin()

