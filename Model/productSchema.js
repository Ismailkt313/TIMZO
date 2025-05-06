const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  brand: { type: mongoose.Schema.Types.ObjectId, ref: 'Brand', required: true },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  regularPrice: { type: Number, required: true },
  salePrice: { type: Number, required: true },
  stock: { type: Number, required: true },
  color: { type: String, required: true }, 
  material: { type: String },
  waterResistance: { type: String },
  warranty: { type: String },
  movementType: { type: String, required: true },
  images: [{ type: String }],
  status: { type: String, default: 'available' },
  ProductOffer: { type: Number, default: 0 },
  isDeleted: { type: Boolean, default: false }, 
  deletedAt: { type: Date } ,
  isBlocked: { type: Boolean, default: false },
  ProductOffer: { type: Number, default: 0 }  
});

module.exports = mongoose.model('Product', productSchema);