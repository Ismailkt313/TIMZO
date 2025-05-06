const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  isListed: { type: Boolean, default: true },
  categoryOffer: { type: Number, default: 0 },
  sales: { type: Number, default: 0 },
  stock: { type: Number, default: 0 },
  isDeleted: { type: Boolean, default: false }, 
  deletedAt: { type: Date } 
});

module.exports = mongoose.model('Category', categorySchema);