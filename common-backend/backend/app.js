import express from "express"
import cors from "cors"
import morgan from "morgan"
import dotenv from "dotenv"
import path from "path"
import { fileURLToPath } from "url"

dotenv.config()

const app = express()
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true })) // Parse URL-encoded bodies (for FormData text fields)
app.use(morgan("dev"))

// Serve static files from uploads directory
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
// When file is missing, call next() so fallback can return 200 with placeholder (avoids 404 log noise for DB paths like /uploads/... that no longer exist on disk)
app.use("/uploads", express.static(path.join(__dirname, "uploads"), { fallthrough: true }))

// Fallback for missing uploads: return 1x1 transparent image so clients don't 404 (e.g. DB has /uploads path but file was removed after Cloudinary upload)
const TRANSPARENT_1X1_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
)
app.use("/uploads", (req, res, next) => {
  if (req.method !== "GET") return next()
  res.status(200).contentType("image/gif").send(TRANSPARENT_1X1_GIF)
})

// Default route
app.get("/", (req, res) => {
  res.send("PhotuPrint API is running")
})

// Function to set up routes after database connection
export const setupRoutes = async () => {
  try {
    console.log("🔧 Setting up routes...")
    const authRoutes = (await import("./routes/auth.routes.js")).default
    if (!authRoutes) {
      throw new Error("Failed to import auth routes")
    }
    console.log("✅ Auth routes imported successfully")
    const userRoutes = (await import("./routes/user.routes.js")).default
    const productRoutes = (await import("./routes/product.route.js")).default
    const categoryRoutes = (await import("./routes/category.routes.js")).default
    const subcategoryRoutes = (await import("./routes/subcategory.routes.js")).default
    const brandRoutes = (await import("./routes/brand.routes.js")).default
    const materialRoutes = (await import("./routes/material.routes.js")).default
    const productAttributeRoutes = (await import("./routes/productAttribute.routes.js")).default
    const reviewRoutes = (await import("./routes/review.routes.js")).default
    const colorRoutes = (await import("./routes/color.routes.js")).default
    const sizeRoutes = (await import("./routes/size.routes.js")).default
    const statusRoutes = (await import("./routes/status.routes.js")).default
    const collarStyleRoutes = (await import("./routes/collarStyle.routes.js")).default
    const fitTypeRoutes = (await import("./routes/fitType.routes.js")).default
    const capacityRoutes = (await import("./routes/capacity.routes.js")).default
    const gsmRoutes = (await import("./routes/gsm.routes.js")).default
    const countryRoutes = (await import("./routes/country.routes.js")).default
    const pinCodeRoutes = (await import("./routes/pinCode.routes.js")).default
    const templateRoutes = (await import("./routes/template.routes.js")).default
    const fontRoutes = (await import("./routes/font.routes.js")).default
    const elementRoutes = (await import("./routes/element.routes.js")).default
    const elementAssetRoutes = (await import("./routes/elementAsset.routes.js")).default
    const templateDimensionRoutes = (await import("./routes/templateDimension.routes.js")).default
    const heightRoutes = (await import("./routes/height.routes.js")).default
    const lengthRoutes = (await import("./routes/length.routes.js")).default
    const widthRoutes = (await import("./routes/width.routes.js")).default
    const patternRoutes = (await import("./routes/pattern.routes.js")).default
    const printingTypeRoutes = (await import("./routes/printingType.routes.js")).default
    const printSideRoutes = (await import("./routes/printSide.routes.js")).default
    const productAddonRoutes = (await import("./routes/productAddon.routes.js")).default
    const sleeveTypeRoutes = (await import("./routes/sleeveType.routes.js")).default
    const couponRoutes = (await import("./routes/coupon.routes.js")).default
    const orderRoutes = (await import("./routes/order.routes.js")).default
    const paymentRoutes = (await import("./routes/payment.routes.js")).default
    const checkoutRoutes = (await import("./routes/checkout.routes.js")).default
    const shippingRoutes = (await import("./routes/shipping.routes.js")).default
    const gstSlabRoutes = (await import("./routes/gstSlab.routes.js")).default
    const companyRoutes = (await import("./routes/company.routes.js")).default
    const websiteRoutes = (await import("./routes/website.routes.js")).default
    const trackingRoutes = (await import("./routes/tracking.routes.js")).default
    const dashboardRoutes = (await import("./routes/dashboard.routes.js")).default
    const reportRoutes = (await import("./routes/report.routes.js")).default
    const productVariantRoutes = (await import("./routes/productVariant.routes.js")).default
    const variationSettingRoutes = (await import("./routes/variationSetting.routes.js")).default
    const shippingZoneRoutes = (await import("./routes/shippingZone.routes.js")).default
    const shippingRateRoutes = (await import("./routes/shippingRate.routes.js")).default
    const shippingConfigRoutes = (await import("./routes/shippingConfig.routes.js")).default
    const pincodeZoneMappingRoutes = (await import("./routes/pincodeZoneMapping.routes.js")).default
    const shippingCostRoutes = (await import("./routes/shippingCost.routes.js")).default
    const testimonialRoutes = (await import("./routes/testimonial.routes.js")).default
    const homepageSectionRoutes = (await import("./routes/homepageSection.routes.js")).default
    const footerSectionRoutes = (await import("./routes/footerSection.routes.js")).default
    const newsletterRoutes = (await import("./routes/newsletter.routes.js")).default
    const carouselRoutes = (await import("./routes/carousel.routes.js")).default
    const clientRoutes = (await import("./routes/client.routes.js")).default
    const interactionRoutes = (await import("./routes/interaction.routes.js")).default
    const userAccessRoutes = (await import("./routes/userAccess.routes.js")).default
    const recentlyViewedProductRoutes = (await import("./routes/recentlyViewedProduct.routes.js")).default
    const wishlistRoutes = (await import("./routes/wishlist.routes.js")).default
    const walletRoutes = (await import("./routes/wallet.routes.js")).default
    const cashbackRuleRoutes = (await import("./routes/cashbackRule.routes.js")).default

    // Register auth routes first (before any tenant middleware)
    app.use("/api/auth", authRoutes)
    console.log("✅ Auth routes registered at /api/auth")
    
    // Register user-access routes BEFORE generic /api routes (productVariant, variationSetting)
    // These generic /api routes have router.use(resolveTenant) which would incorrectly catch user-access requests
    app.use("/api/user-access", userAccessRoutes)
    console.log("✅ User Access routes registered at /api/user-access")
    // Debug: List auth routes
    console.log("Registered auth routes:")
    authRoutes.stack.forEach((r) => {
      if (r.route) {
        console.log(`  ${Object.keys(r.route.methods).join(", ").toUpperCase()} /api/auth${r.route.path}`)
      } else if (r.name === 'router') {
        // Handle nested routers
        r.handle.stack.forEach((nr) => {
          if (nr.route) {
            console.log(`  ${Object.keys(nr.route.methods).join(", ").toUpperCase()} /api/auth${nr.route.path}`)
          }
        })
      }
    })
    
    app.use("/api/users", userRoutes)
    app.use("/api/orders", orderRoutes)
    app.use("/api", checkoutRoutes)
    app.use("/api/payments", paymentRoutes)
    app.use("/api/shipping", shippingRoutes)
    app.use("/api/products", productRoutes)
    app.use("/api/categories", categoryRoutes)
    app.use("/api/subcategories", subcategoryRoutes)
    app.use("/api/brands", brandRoutes)
    app.use("/api/materials", materialRoutes)
    app.use("/api/product-attributes", productAttributeRoutes)
    app.use("/api/reviews", reviewRoutes)
    app.use("/api/testimonials", testimonialRoutes)
    app.use("/api/colors", colorRoutes)
    app.use("/api/sizes", sizeRoutes)
    app.use("/api/status", statusRoutes)
    app.use("/api/collar-styles", collarStyleRoutes)
    app.use("/api/fit-types", fitTypeRoutes)
    app.use("/api/capacities", capacityRoutes)
    app.use("/api/gsms", gsmRoutes)
    app.use("/api/countries", countryRoutes)
    app.use("/api/pin-codes", pinCodeRoutes)
    app.use("/api/templates", templateRoutes)
    app.use("/api/fonts", fontRoutes)
    app.use("/api/elements", elementRoutes)
    app.use("/api/element-assets", elementAssetRoutes)
    app.use("/api/template-dimensions", templateDimensionRoutes)
    app.use("/api/heights", heightRoutes)
    app.use("/api/lengths", lengthRoutes)
    app.use("/api/widths", widthRoutes)
    app.use("/api/patterns", patternRoutes)
    app.use("/api/printing-types", printingTypeRoutes)
    app.use("/api/print-sides", printSideRoutes)
    app.use("/api/product-addons", productAddonRoutes)
    app.use("/api/sleeve-types", sleeveTypeRoutes)
    app.use("/api/coupons", couponRoutes)
    app.use("/api/gst-slabs", gstSlabRoutes)
    app.use("/api/companies", companyRoutes)
    app.use("/api/websites", websiteRoutes)
    app.use("/api/tracking", trackingRoutes)
    app.use("/api/dashboard", dashboardRoutes)
    app.use("/api/reports", reportRoutes)
    app.use("/api/shipping-zones", shippingZoneRoutes)
    app.use("/api/shipping-rates", shippingRateRoutes)
    app.use("/api/shipping-config", shippingConfigRoutes)
    app.use("/api/pincode-zone-mappings", pincodeZoneMappingRoutes)
    app.use("/api/shipping-cost", shippingCostRoutes)
    app.use("/api/homepage-sections", homepageSectionRoutes)
    app.use("/api/footer-sections", footerSectionRoutes)
    app.use("/api/newsletter", newsletterRoutes)
    app.use("/api/carousel", carouselRoutes)
    app.use("/api/clients", clientRoutes)
    app.use("/api/interactions", interactionRoutes)
    app.use("/api/recently-viewed-products", recentlyViewedProductRoutes)
    app.use("/api/wishlist", wishlistRoutes)
    app.use("/api/wallet", walletRoutes)
    app.use("/api/cashback-rules", cashbackRuleRoutes)
    app.use("/api", productVariantRoutes)
    app.use("/api", variationSettingRoutes)
    // user-access routes moved to earlier in the file (before /api routes with router.use tenant middleware)

    console.log("Routes set up successfully")
    console.log("✅ Template routes registered at /api/templates")

    // Drop old unique indexes to allow multiple templates per category
    try {
      const Template = (await import("./models/template.model.js")).default
      const collection = Template.collection
      const indexes = await collection.indexes() 
      
      // Drop unique_category_template index if it exists
      const uniqueIndex = indexes.find((idx) => idx.name === "unique_category_template")
      if (uniqueIndex) {
        await collection.dropIndex("unique_category_template").catch(() => {})
        console.log("✅ Dropped unique_category_template index")
      }
      
      // Drop categoryId_1 unique index if it exists (auto-created unique index)
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
      
      console.log("✅ All unique category indexes dropped (multiple templates per category now allowed)")
    } catch (err) {
      console.log("ℹ️  Index cleanup:", err.message)
    }

    // Drop old unique index on FooterTheme.website so multiple themes per website are allowed
    try {
      const FooterTheme = (await import("./models/footerTheme.model.js")).default
      const collection = FooterTheme.collection
      const indexes = await collection.indexes()
      const websiteUnique = indexes.find((idx) => idx.key?.website === 1 && idx.unique)
      if (websiteUnique) {
        await collection.dropIndex(websiteUnique.name).catch(() => {})
        console.log("✅ Dropped FooterTheme website unique index (multiple themes per website now allowed)")
      }
    } catch (err) {
      console.log("ℹ️  FooterTheme index cleanup:", err.message)
    }

    // Debug: List all registered routes
    if (process.env.NODE_ENV !== "production") {
      console.log("Registered template routes:")
      templateRoutes.stack.forEach((r) => {
        if (r.route) {
          console.log(`  ${Object.keys(r.route.methods).join(", ").toUpperCase()} ${r.route.path}`)
        }
      })
    }
  } catch (error) {
    console.error("❌ Error setting up routes:", error)
    console.error("Error stack:", error.stack)
    throw error // Re-throw to prevent server from starting with broken routes
  }
}

export default app
