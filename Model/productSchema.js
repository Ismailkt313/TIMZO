const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    brand: {
        type: String,
        required: true,
        trim: true
    },
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        required: true
    },
    description: {
        type: String,
        required: true,
        trim: true
    },
    regularPrice: {
        type: Number,
        required: true,
        min: 0
    },
    saleprice: {
        type: Number,
        min: 0
    },
    stock: {
        type: Number,
        required: true,
        min: 0
    },
    color: {
        type: [String], // example: ['Black', 'Silver', 'Rose Gold']
        required: true
    },
    material: {
        type: String,
        required: true,
        trim: true
    },
    waterResistance: {
        type: String,
        default: 'Not specified'
    },
    movementType: {
        type: String,
        enum: ['Quartz', 'Automatic', 'Mechanical', 'Solar', 'Smart'],
        required: true
    },
    warranty: {
        type: String,
        default: '1 Year'
    },
    ProductOffer: {
        type: Number,
        default: 0
    },
    images: {
        type: [String], 
        required: true
    },
    isListed: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);
