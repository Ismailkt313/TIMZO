const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Watch name is required'],
    trim: true,
    validate: {
      validator: function (v) {
        return /^[a-zA-Z0-9\s]+$/.test(v);
      },
      message: 'Watch name should contain only alphanumeric characters'
    }
  },
  brand: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Brand',
    required: [true, 'Brand is required']
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: [true, 'Category is required']
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true,
    validate: {
        validator: function (v) {
          return /^[a-zA-Z0-9\s.,!:/+\-()@#'"\[\]{}&%°]+$/.test(v);
        },
        message: 'Description contains invalid characters.'
      }
          
  },
  regularPrice: {
    type: Number,
    required: [true, 'Regular price is required'],
    min: [0.01, 'Regular price must be greater than 0']
  },
  salePrice: {
    type: Number,
    required: [true, 'Sale price is required'],
    min: [0, 'Sale price cannot be negative'],
    validate: {
      validator: function (v) {
        return v < this.regularPrice;
      },
      message: 'Sale price must be less than regular price'
    }
  },
  stock: {
    type: Number,
    required: [true, 'Stock quantity is required'],
    min: [0, 'Stock cannot be negative']
  },
  color: {
    type: String,
    required: [true, 'Color is required'],
    trim: true
  },
  material: {
    type: String,
    trim: true,
    default: ''
  },
  waterResistance: {
    type: String,
    enum: {
      values: ['Not specified', '30m', '50m', '100m', '200m', '300m'],
      message: '{VALUE} is not a valid water resistance value'
    },
    default: 'Not specified'
  },
  warranty: {
    type: String,
    enum: {
      values: ['1 Year', '2 Years', '3 Years', 'Limited Lifetime'],
      message: '{VALUE} is not a valid warranty period'
    },
    default: '1 Year'
  },
  movementType: {
    type: String,
    enum: {
      values: ['Quartz', 'Automatic', 'Manual', 'Solar'],
      message: '{VALUE} is not a valid movement type'
    },
    required: [true, 'Movement type is required']
  },
  productOffer: {
    type: Number,
    default: 0,
    min: [0, 'Product offer cannot be negative']
  },
  images: {
    type: [String],
    required: [true, 'At least one image is required'],
    validate: {
      validator: function (v) {
        return v.length > 0;
      },
      message: 'At least one image is required'
    }
  },
  status: {
    type: String,
    enum: {
      values: ['available', 'out of stock', 'discontinued'],
      message: '{VALUE} is not a valid status'
    },
    default: 'available'
  },
  isListed: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

productSchema.index({ name: 1 }, { unique: true });

module.exports = mongoose.model('Product', productSchema);