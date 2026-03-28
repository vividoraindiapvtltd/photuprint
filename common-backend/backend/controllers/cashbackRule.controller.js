import CashbackRule from "../models/cashbackRule.model.js"

export const listCashbackRules = async (req, res) => {
  try {
    if (!req.websiteId) return res.status(400).json({ msg: "Website context is required" })
    const rules = await CashbackRule.find({ website: req.websiteId }).sort({ priority: -1 }).lean()
    res.json(rules)
  } catch (e) {
    console.error(e)
    res.status(500).json({ msg: "Failed to list rules" })
  }
}

export const getCashbackRule = async (req, res) => {
  try {
    if (!req.websiteId) return res.status(400).json({ msg: "Website context is required" })
    const rule = await CashbackRule.findOne({ _id: req.params.id, website: req.websiteId })
    if (!rule) return res.status(404).json({ msg: "Not found" })
    res.json(rule)
  } catch (e) {
    console.error(e)
    res.status(500).json({ msg: "Failed to load rule" })
  }
}

export const createCashbackRule = async (req, res) => {
  try {
    if (!req.websiteId) return res.status(400).json({ msg: "Website context is required" })
    const { scope, category, product, percent, expiryDays, priority, isActive, notes } = req.body
    if (percent == null || percent < 0 || percent > 100) {
      return res.status(400).json({ msg: "percent must be 0–100" })
    }
    if (scope === "category" && !category) return res.status(400).json({ msg: "category required for category scope" })
    if (scope === "product" && !product) return res.status(400).json({ msg: "product required for product scope" })

    const rule = await CashbackRule.create({
      website: req.websiteId,
      scope: scope || "default",
      category: category || null,
      product: product || null,
      percent,
      expiryDays: expiryDays ?? 90,
      priority: priority ?? 0,
      isActive: isActive !== false,
      notes: notes || null,
    })
    res.status(201).json(rule)
  } catch (e) {
    console.error(e)
    res.status(500).json({ msg: "Failed to create rule" })
  }
}

export const updateCashbackRule = async (req, res) => {
  try {
    if (!req.websiteId) return res.status(400).json({ msg: "Website context is required" })
    const rule = await CashbackRule.findOne({ _id: req.params.id, website: req.websiteId })
    if (!rule) return res.status(404).json({ msg: "Not found" })

    const { scope, category, product, percent, expiryDays, priority, isActive, notes } = req.body
    if (percent !== undefined) {
      if (percent < 0 || percent > 100) return res.status(400).json({ msg: "percent must be 0–100" })
      rule.percent = percent
    }
    if (scope !== undefined) rule.scope = scope
    if (category !== undefined) rule.category = category
    if (product !== undefined) rule.product = product
    if (expiryDays !== undefined) rule.expiryDays = expiryDays
    if (priority !== undefined) rule.priority = priority
    if (isActive !== undefined) rule.isActive = isActive
    if (notes !== undefined) rule.notes = notes

    await rule.save()
    res.json(rule)
  } catch (e) {
    console.error(e)
    res.status(500).json({ msg: "Failed to update rule" })
  }
}

export const deleteCashbackRule = async (req, res) => {
  try {
    if (!req.websiteId) return res.status(400).json({ msg: "Website context is required" })
    const r = await CashbackRule.findOneAndDelete({ _id: req.params.id, website: req.websiteId })
    if (!r) return res.status(404).json({ msg: "Not found" })
    res.json({ msg: "Deleted" })
  } catch (e) {
    console.error(e)
    res.status(500).json({ msg: "Failed to delete" })
  }
}
