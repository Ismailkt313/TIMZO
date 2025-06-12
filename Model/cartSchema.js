const mongoose = require('mongoose');

const cartSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    items: [{
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
            required: true
        },
        quantity: {
            type: Number,
            required: true,
            min: 1
        }
    }],
    coupon: {
        code: { type: String },
        percentage: { type: Number, default: 0 },
        maxDiscount: { type: Number, default: 0 }
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Cart', cartSchema);