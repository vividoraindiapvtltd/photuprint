import Length from "../models/length.model.js";

/* ================= GET ================= */
export const getLengths = async (req, res) => {
  try {
    // Multi-tenant: Filter by website
    if (!req.websiteId) {
      return res.status(400).json({ msg: 'Website context is missing' });
    }
    const lengths = await Length.find({ website: req.websiteId }).sort({ createdAt: -1 });
    res.json(lengths);
  } catch (err) {
    res.status(500).json({ msg: "Failed to fetch lengths" });
  }
};

/* ================= CREATE ================= */
export const createLength = async (req, res) => {
  try {
    const { name, unit, description, isActive } = req.body;

    if (name === undefined || isNaN(name)) {
      return res.status(400).json({ msg: "Length value must be a number" });
    }

    const length = await Length.create({
      name: Number(name),
      unit,
      description,
      isActive,
      website: req.websiteId // Multi-tenant: Set website
    });

    res.status(201).json(length);
  } catch (err) {
    if (err.code === 11000) {
      return res
        .status(400)
        .json({ msg: "Length with same value and unit already exists" });
    }
    res.status(500).json({ msg: "Failed to create length" });
  }
};

/* ================= UPDATE ================= */
export const updateLength = async (req, res) => {
  try {
    const { name, unit, description, isActive, deleted } = req.body;

    const length = await Length.findById(req.params.id);
    if (!length) {
      return res.status(404).json({ msg: "Length not found" });
    }

    // Check for duplicate names with same unit (excluding current length)
    if (name !== undefined || unit !== undefined) {
      const checkName = name !== undefined ? Number(name) : length.name;
      const checkUnit = unit !== undefined ? unit : length.unit;
      
      // Only check if name or unit is actually changing
      if (checkName !== length.name || checkUnit !== length.unit) {
      const existingLength = await Length.findOne({
          _id: { $ne: req.params.id },
          name: checkName,
          unit: checkUnit,
          deleted: false
        });

      if (existingLength) {
          return res.status(400).json({ 
            msg: `Length value ${checkName} with unit ${checkUnit} already exists` 
          });
      }
    }
    }

    if (name !== undefined) length.name = Number(name);
    if (unit !== undefined) length.unit = unit;
    if (description !== undefined) length.description = description;
    if (isActive !== undefined) length.isActive = isActive;
    if (deleted !== undefined) length.deleted = deleted;

    await length.save();
    res.json(length);
  } catch (err) {
    if (err.code === 11000) {
      return res
        .status(400)
        .json({ msg: "Length with same value and unit already exists" });
    }
    res.status(500).json({ msg: "Failed to update length" });
  }
};

/* ================= SOFT DELETE ================= */
export const deleteLength = async (req, res) => {
  try {
    const length = await Length.findById(req.params.id);
    if (!length) {
      return res.status(404).json({ msg: "Length not found" });
    }

    length.deleted = true;
    length.isActive = false;
    await length.save();

    res.json({ msg: "Length deleted" });
  } catch (err) {
    res.status(500).json({ msg: "Failed to delete length" });
  }
};

/* ================= HARD DELETE ================= */
export const hardDeleteLength = async (req, res) => {
  try {
    await Length.findByIdAndDelete(req.params.id);
    res.json({ msg: "Length permanently deleted" });
  } catch (err) {
    res.status(500).json({ msg: "Failed to delete length" });
  }
};

/* ================= RESTORE ================= */
export const restoreLength = async (req, res) => {
  try {
    const length = await Length.findById(req.params.id);
    if (!length) {
      return res.status(404).json({ msg: "Length not found" });
    }

    length.deleted = false;
    length.isActive = true;
    await length.save();

    res.json(length);
  } catch (err) {
    if (err.code === 11000) {
      return res
        .status(400)
        .json({ msg: "Duplicate length exists, cannot restore" });
    }
    res.status(500).json({ msg: "Failed to restore length" });
  }
};
