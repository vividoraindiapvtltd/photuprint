const mongoose = require('mongoose');

const pageSchema = new mongoose.Schema({
  slug: { type: String, unique: true },
  title: String,
  content: String,
}, { timestamps: true });

module.exports = mongoose.model('Page', pageSchema);
