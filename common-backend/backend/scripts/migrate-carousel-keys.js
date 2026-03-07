/**
 * One-time migration: Enable multiple carousels per website.
 * Run: npm run migrate:carousel
 * 
 * This script:
 * 1. Drops old unique index on CarouselSetting.website (if exists)
 * 2. Adds carouselKey: "hero" to existing CarouselSetting docs that lack it
 * 3. Adds carouselKey: "hero" to existing CarouselSlide docs that lack it
 */

import dotenv from "dotenv"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, "../.env") })

import mongoose from "mongoose"
import CarouselSetting from "../models/carouselSetting.model.js"
import CarouselSlide from "../models/carouselSlide.model.js"

async function migrate() {
  const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/photuprint"
  await mongoose.connect(uri)
  console.log("Connected to MongoDB")

  try {
    const settingCollection = CarouselSetting.collection
    const slideCollection = CarouselSlide.collection

    // Drop old unique index on website (CarouselSetting)
    try {
      await settingCollection.dropIndex("website_1")
      console.log("Dropped old CarouselSetting.website_1 index")
    } catch (e) {
      if (e.code === 27 || e.codeName === "IndexNotFound") {
        console.log("CarouselSetting.website_1 index not found (already migrated or never existed)")
      } else throw e
    }

    // Update existing CarouselSetting docs without carouselKey
    const settingResult = await settingCollection.updateMany(
      { $or: [{ carouselKey: { $exists: false } }, { carouselKey: "" }] },
      { $set: { carouselKey: "hero" } }
    )
    if (settingResult.modifiedCount > 0) {
      console.log(`Updated ${settingResult.modifiedCount} CarouselSetting docs with carouselKey: hero`)
    }

    // Update existing CarouselSlide docs without carouselKey
    const slideResult = await slideCollection.updateMany(
      { $or: [{ carouselKey: { $exists: false } }, { carouselKey: "" }] },
      { $set: { carouselKey: "hero" } }
    )
    if (slideResult.modifiedCount > 0) {
      console.log(`Updated ${slideResult.modifiedCount} CarouselSlide docs with carouselKey: hero`)
    }

    console.log("Migration complete")
  } finally {
    await mongoose.disconnect()
    console.log("Disconnected from MongoDB")
  }
}

migrate().catch((err) => {
  console.error("Migration failed:", err)
  process.exit(1)
})
