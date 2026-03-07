import mongoose from "mongoose"

const templateSchema = new mongoose.Schema(
  {
    templateId: { type: String, sparse: true },
    name: { type: String, required: true },
    description: { type: String, default: null },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    categoryName: { type: String, required: true }, // Store category name directly for quick access
    backgroundImages: [{ type: String }], // Array of background image URLs
    logoImages: [{ type: String }], // Array of logo image URLs
    textOption: { type: Boolean, default: false }, // Toggle for text option (on/off)
    previewImage: { type: String, default: null }, // Preview thumbnail (first image or separate preview)
    isActive: { type: Boolean, default: true },
    deleted: { type: Boolean, default: false },
    /**
     * PixelCraft (JSON-first templates)
     * This is intentionally flexible (Mixed) so we can evolve schema versions without migrations.
     * Source of truth for Fabric/editor state + template constraints lives here.
     */
    pixelcraftDocument: { type: mongoose.Schema.Types.Mixed, default: null },
    pixelcraftStatus: { type: String, enum: ["draft", "published"], default: "draft" },
    pixelcraftVersion: { type: Number, default: 1 },
    // Multi-tenant: Website/Tenant reference (indexed via compound schema.index below)
    website: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Website',
      required: true,
    },
  },
  {
    timestamps: true,
  }
)

// Create indexes for better search performance and multi-tenancy
templateSchema.index({ website: 1, categoryId: 1, category: 1, isActive: 1 })
templateSchema.index({ website: 1, name: 1 })
templateSchema.index({ website: 1, deleted: 1, isActive: 1 })

const Template = mongoose.model("Template", templateSchema)

// Drop the old unique indexes if they exist (allows multiple templates per category)
// This runs once when the model is first loaded
;(async () => {
  const dropUniqueIndexes = async () => {
    try {
      const collection = Template.collection
      const indexes = await collection.indexes()

      // Drop unique_category_template index if it exists
      const uniqueIndex = indexes.find((idx) => idx.name === "unique_category_template")
      if (uniqueIndex) {
        await collection.dropIndex("unique_category_template").catch(() => {})
        console.log("✅ Dropped unique_category_template index")
      }

      // Drop categoryId_1 unique index if it exists
      const categoryIdIndex = indexes.find((idx) => idx.name === "categoryId_1" && idx.unique)
      if (categoryIdIndex) {
        await collection.dropIndex("categoryId_1").catch(() => {})
        console.log("✅ Dropped categoryId_1 unique index")
      }

      // Drop any other unique indexes on categoryId or category
      for (const index of indexes) {
        if (index.unique && (index.key?.categoryId || index.key?.category)) {
          try {
            await collection.dropIndex(index.name).catch(() => {})
            console.log(`✅ Dropped unique index: ${index.name}`)
          } catch (err) {
            // Ignore errors
          }
        }
      }
    } catch (err) {
      console.log("ℹ️  Index cleanup:", err.message)
    }
  }

  try {
    if (mongoose.connection.readyState === 1) {
      // Connection is ready, drop indexes now
      await dropUniqueIndexes()
    } else {
      // Connection not ready, wait for it
      mongoose.connection.once("connected", async () => {
        await dropUniqueIndexes()
      })
    }
  } catch (err) {
    // Ignore errors during index cleanup
    console.log("ℹ️  Index cleanup:", err.message)
  }
})()

export default Template
