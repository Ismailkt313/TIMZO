const mongoose = require('mongoose')
const { Schema } = mongoose

const categorySchema = new Schema({
    name:{
        type:String,
        required: true,

},
    type: {
    type:String,
    trim: true
}, 
    icon: {
    type: String,
    default: 'tag' // example: Bootstrap icon name or custom tag
},
    categoryOffer: {  
    type: Number,
    default: 0
  },
    description: {
    type: String,
    trim: true,
    required: true,
},
    sales: {
    type: Number,
    default: 0
},
    stock: {
    type: Number,
    default: 0
},
    isListed: {
    type: Boolean,
    default: true
}
   
    
},{ timestamps: true })

module.exports = mongoose.model('Category', categorySchema);