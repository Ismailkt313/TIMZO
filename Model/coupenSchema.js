const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  discountType: {
    type: String,
    enum: ['percentage', 'fixed'],
    required: true
  },
  discountAmount: {
    type: Number,
    required: true,
    min: 0
  },
  maxDiscount: {
    type: Number, // Only applies to percentage discount
    default: null
  },
  minPurchase: {
    type: Number,
    default: 0 // Minimum order value to apply the coupon
  },
  usageLimit: {
    type: Number,
    default: null // Total times the coupon can be used (globally)
  },
  usedCount: {
    type: Number,
    default: 0
  },
  perUserLimit: {
    type: Number,
    default: 1 // Times a single user can use it
  },
  validFrom: {
    type: Date,
    required: true
  },
  validUntil: {
    type: Date,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  usersUsed: [
    {
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      usedTimes: {
        type: Number,
        default: 1
      }
    }
  ]
}, { timestamps: true });

module.exports = mongoose.model('Coupon', couponSchema);
 