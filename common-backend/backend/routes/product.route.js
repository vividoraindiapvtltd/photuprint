import express from "express"
import multer from "multer"
import { createProduct, getAllProducts, getProductById, updateProduct, deleteProduct, restoreProduct, hardDeleteProduct } from "../controllers/product.controller.js"
import upload from "../middlewares/productUpload.middleware.js"
import { resolveTenantFromHeader, requireTenant } from "../middlewares/tenant.middleware.js"

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

// Apply tenant resolution middleware to all routes
router.use(resolveTenantFromHeader)
router.use(requireTenant)

router.post(
  "/",
  handleUpload,
  createProduct
)
router.get("/", getAllProducts)
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
