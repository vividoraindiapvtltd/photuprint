import express from "express"
import multer from "multer"
import { createProduct, getAllProducts, getProductById, getProductBySlug, updateProduct, deleteProduct, restoreProduct, hardDeleteProduct } from "../controllers/product.controller.js"
import upload from "../middlewares/productUpload.middleware.js"
import { resolveTenant, requireTenant } from "../middlewares/tenant.middleware.js"

const router = express.Router()

// Wrap upload middleware to catch Multer errors
const uploadFields = upload.fields([
  { name: "mainImage", maxCount: 1 },
  { name: "images", maxCount: 10 },
  { name: "video", maxCount: 1 },
])

const handleUpload = (req, res, next) => {
  uploadFields(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ 
          msg: `File too large. Images: maximum 5MB, Videos: maximum 100MB.` 
        })
      }
      return res.status(400).json({ msg: `Upload error: ${err.message}` })
    }
    if (err) {
      return res.status(400).json({ msg: err.message || "File upload error" })
    }
    next()
  })
}

// Resolve tenant from X-Website-Id (admin) or from request domain (storefront e.g. localhost:3001)
// so GET /api/products/by-slug/:slug works without auth or header when storefront calls from same host
router.use(resolveTenant)
router.use(requireTenant)

router.post(
  "/",
  handleUpload,
  createProduct
)
router.get("/", getAllProducts)
// Storefront: both /api/products/by-slug/:slug and /api/products/slug/:slug (no auth required)
router.get("/by-slug/:slug", getProductBySlug)
router.get("/slug/:slug", getProductBySlug)
router.get("/:id", getProductById)
router.put("/:id/restore", restoreProduct)
router.put(
  "/:id",
  handleUpload,
  updateProduct
)
router.delete("/:id", deleteProduct)
router.delete("/:id/hard", hardDeleteProduct)

export default router
