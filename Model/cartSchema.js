const mongoose = require('mongoose');

const cartSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,   
    trim: true
  },
  image: {
    type: String,   
    default: ''
  },
  isListed: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Brand = mongoose.model('cart', cartSchema);

module.exports = Brand;
