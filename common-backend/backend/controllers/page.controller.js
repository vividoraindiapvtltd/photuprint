const Page = require("../models/page.model")

exports.createPage = async (req, res) => {
  const page = await Page.create(req.body)
  res.status(201).json(page)
}

exports.getPage = async (req, res) => {
  const page = await Page.findOne({ slug: req.params.slug })
  if (!page) return res.status(404).json({ msg: "Page not found" })
  res.json(page)
}
