// routes/productColors.js
import { Router } from "express"
import multer from "multer"
import path from "path"
import ProductColor from "../models/ProductColor.js"
import { uploadLocalFileToCloudinary } from "../utils/cloudinaryUpload.js"
import { removeLocalFile } from "../utils/fileCleanup.js"

const r = Router()
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, "uploads/colors"),
  filename: (_, file, cb) =>
    cb(null, Date.now() + "-" + Math.random().toString(36).slice(2) + path.extname(file.originalname)),
});
const upload = multer({ storage });

r.get("/products/:pid/colors", async (req, res) => {
  const list = await ProductColor.find({ productId: req.params.pid }).sort({ createdAt: 1 });
  res.json(list);
});

r.post("/products/:pid/colors", upload.single("image"), async (req, res) => {
  try {
    const body = { productId: req.params.pid, name: req.body.name, code: req.body.code }
    if (req.file) {
      body.image = await uploadLocalFileToCloudinary(req.file.path, { folder: "photuprint/product-colors" })
    }
    const saved = await ProductColor.create(body)
    res.json(saved)
  } catch (e) {
    if (req.file?.path) removeLocalFile(req.file.path)
    res.status(503).json({ msg: e.message || "Image upload failed. Configure Cloudinary." })
  }
})

r.put("/products/:pid/colors/:id", upload.single("image"), async (req, res) => {
  try {
    const update = { name: req.body.name, code: req.body.code }
    if (req.file) {
      update.image = await uploadLocalFileToCloudinary(req.file.path, { folder: "photuprint/product-colors" })
    }
    const doc = await ProductColor.findOneAndUpdate(
      { _id: req.params.id, productId: req.params.pid },
      update,
      { new: true },
    )
    res.json(doc)
  } catch (e) {
    if (req.file?.path) removeLocalFile(req.file.path)
    res.status(503).json({ msg: e.message || "Image upload failed. Configure Cloudinary." })
  }
})

r.delete("/products/:pid/colors/:id", async (req, res) => {
  await ProductColor.deleteOne({ _id: req.params.id, productId: req.params.pid });
  res.json({ ok: true });
});

export default r;
