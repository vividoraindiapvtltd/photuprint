import dotenv from "dotenv"
import connectDB from "./backend/db/index.js"
import Product from "./backend/models/product.model.js"

// Load environment variables
dotenv.config()

const cleanupProducts = async () => {
  try {
    console.log("Connecting to database...")
    await connectDB()
    console.log("Connected to database successfully")

    console.log("Checking for products with null slugs...")
    const productsWithNullSlugs = await Product.find({ slug: null })
    console.log(`Found ${productsWithNullSlugs.length} products with null slugs`)

    if (productsWithNullSlugs.length > 0) {
      console.log("Deleting products with null slugs...")
      const result = await Product.deleteMany({ slug: null })
      console.log(`Deleted ${result.deletedCount} products with null slugs`)
    }

    // Also check for products with null SKUs
    console.log("Checking for products with null SKUs...")
    const productsWithNullSkus = await Product.find({ sku: null })
    console.log(`Found ${productsWithNullSkus.length} products with null SKUs`)

    if (productsWithNullSkus.length > 0) {
      console.log("Deleting products with null SKUs...")
      const result = await Product.deleteMany({ sku: null })
      console.log(`Deleted ${result.deletedCount} products with null SKUs`)
    }

    // Check for any products without names (which could cause issues)
    console.log("Checking for products without names...")
    const productsWithoutNames = await Product.find({ $or: [{ name: null }, { name: "" }] })
    console.log(`Found ${productsWithoutNames.length} products without names`)

    if (productsWithoutNames.length > 0) {
      console.log("Deleting products without names...")
      const result = await Product.deleteMany({ $or: [{ name: null }, { name: "" }] })
      console.log(`Deleted ${result.deletedCount} products without names`)
    }

    console.log("Database cleanup completed successfully")
    process.exit(0)
  } catch (error) {
    console.error("Error during cleanup:", error.message)
    console.error("Full error:", error)
    process.exit(1)
  }
}

cleanupProducts()
