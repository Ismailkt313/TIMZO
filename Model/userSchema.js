const mongoose = require('mongoose')
const { Schema } = mongoose

const userSchema = new Schema({
  fullname: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,  
  }, 
  mobile: {  
    type: Number, 
    required: false, 
    unique: false,
    default: null, 
    sparse:true,
  },
  password: {
    type: String,
    required: false, 
  },
  googleId: {
    type: String,
    unique: true,
    sparse: true, 
  },
  otp: {
    code: { type: String },
    expiresAt: { type: Date },
    verified: { type: Boolean, default: false },
  },
  isBlocked: {
    type: Boolean,
    default: false,
  },  
  isAdmin: {
    type: Boolean,
    default: false,
  },
}, { timestamps: true })

module.exports = mongoose.model('User', userSchema)
  