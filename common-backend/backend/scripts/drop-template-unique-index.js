import mongoose from "mongoose"
import Template from "../models/template.model.js"
import { DB_NAME } from "../constants.js"
import dotenv from "dotenv"

dotenv.config()

const dropUniqueIndex = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      dbName: DB_NAME,
    })
    console.log("Connected to MongoDB")

    // Get the collection
    const collection = Template.collection

    // List all indexes
    const indexes = await collection.indexes()
    console.log("Current indexes:", indexes.map((idx) => idx.name))

    // Drop the unique_category_template index if it exists
    try {
      await collection.dropIndex("unique_category_template")
      console.log("✅ Successfully dropped 'unique_category_template' index")
    } catch (err) {
      if (err.code === 27 || err.message.includes("index not found")) {
        console.log("ℹ️  'unique_category_template' index does not exist (already removed)")
      } else {
        throw err
      }
    }

    // List indexes after dropping
    const indexesAfter = await collection.indexes()
    console.log("Indexes after drop:", indexesAfter.map((idx) => idx.name))

    console.log("✅ Migration completed successfully")
    process.exit(0)
  } catch (error) {
    console.error("❌ Error dropping index:", error)
    process.exit(1)
  }
}

dropUniqueIndex()
