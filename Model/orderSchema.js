const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    orderId: {
        type: String,
        required: true,
        unique: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    items: [{
        productId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
            required: true
        },
        productName: {
            type: String,
            required: true
        },
        quantity: {
            type: Number,
            required: true,
            min: 1
        },
        price: {
            type: Number,
            required: true
        },
        itemTotal: {
            type: Number,
            required: true
        },
        discount: {
            type: Number,
            required: true
        },
        finalPrice: {
            type: Number,
            required: true
        },
        tax: {
            type: Number,
            required: true,
            default: 0
        },
        status: {
            type: String,
            enum: ['Ordered', 'Processing', 'Delivered', 'Returned', 'Cancelled', 'CancelRequested', 'ReturnRequested'],
            default: 'Ordered'
        },
        returnReason: {
            type: String,
            default: ''
        },
        returnDate: {
            type: Date
        },
        cancelDate: {
            type: Date
        },
        cancelRequestDate: {
            type: Date
        },
        returnRequestDate: {
            type: Date
        },
        requestStatus: {
            type: String,
            enum: ['Pending', 'Approved', 'Rejected'],
            default: 'Pending'
        }
    }],
    subtotal: {
        type: Number,
        required: true
    },
    discount: {
        type: Number,
        default: 0
    },
    shippingFee: {
        type: Number,
        required: true
    },
    tax: {
        type: Number,
        required: true
    },
    coupon: {
        code: { type: String },
        discount: { type: Number, default: 0 }
    },
    totalAmount: {
        type: Number,
        required: true
    },
    shippingAddress: {
        fullName: { type: String, required: true },
        addressLine1: { type: String, required: true },
        addressLine2: { type: String, default: '' },
        city: { type: String, required: true },
        state: { type: String, required: true },
        postalCode: { type: String, required: true },
        country: { type: String, required: true },
        phone: { type: String, required: true }
    },
    orderDate: {
        type: Date,
        default: Date.now
    },
    estimatedDelivery: {
        type: Date,
        required: true
    },
    paymentMethod: {
        type: String,
        required: true,
        enum: ['COD', 'Online', 'Wallet']
    },
    paymentStatus: {
        type: String,
        required: true,
        enum: ['Pending', 'Completed', 'Cancelled'],
        default: 'Pending'
    },
    orderStatus: {
        type: String,
        required: true,
        enum: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'],
        default: 'Pending'
    },
    statusHistory: [{
        status: {
            type: String,
            required: true,
            enum: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled']
        },
        date: {
            type: Date,
            default: Date.now
        },
        current: {
            type: Boolean,
            default: false
        }
    }]
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);