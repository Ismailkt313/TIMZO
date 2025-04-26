const mongoose = require('mongoose');
const { Schema } = mongoose;

const productSchema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  brand: {
    type: String,
    trim: true
  },
  price: {
    type: Number,
    required: true
  },
  offerPrice: {
    type: Number,
    default: 0
  },
  description: {
    type: String,
    trim: true
  },
  images: {
    type: [String], // Array of image URLs or filenames
    required: true
  },
  category: {
    type: Schema.Types.ObjectId,
    ref: 'Category',
    required: true
  },
  stock: {
    type: Number,
    default: 0
  },
  isListed: {
    type: Boolean,
    default: true
  },
  addedDate: {
    type: Date,
    default: Date.now
  },
  sales: {
    type: Number,
    default: 0
  }
});

module.exports = mongoose.model('Product', productSchema);
