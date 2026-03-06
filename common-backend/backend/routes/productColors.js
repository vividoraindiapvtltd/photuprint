// routes/productColors.js
import { Router } from "express";
import multer from "multer";
import path from "path";
import ProductColor from "../models/ProductColor.js"; // {productId, name, code, image}

const r = Router();
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
  const body = { productId: req.params.pid, name: req.body.name, code: req.body.code };
  if (req.file) body.image = `/uploads/colors/${req.file.filename}`;
  const saved = await ProductColor.create(body);
  res.json(saved);
});

r.put("/products/:pid/colors/:id", upload.single("image"), async (req, res) => {
  const update = { name: req.body.name, code: req.body.code };
  if (req.file) update.image = `/uploads/colors/${req.file.filename}`;
  const doc = await ProductColor.findOneAndUpdate(
    { _id: req.params.id, productId: req.params.pid },
    update,
    { new: true }
  );
  res.json(doc);
});

r.delete("/products/:pid/colors/:id", async (req, res) => {
  await ProductColor.deleteOne({ _id: req.params.id, productId: req.params.pid });
  res.json({ ok: true });
});

export default r;
