const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require("../Config/cloudinary");

const productStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'timzo/products',
    allowed_formats: ['jpg', 'png', 'jpeg'],
    transformation: [
      { width: 440, height: 440, crop: 'fill', quality: 'auto' }
    ],
    public_id: (req, file) => `watch-${Date.now()}-${file.originalname.replace(/\.[^/.]+$/, '')}`
  }
});


const brandStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'timzo/brands',
    allowed_formats: ['jpg', 'png', 'jpeg'],
    transformation: [
      { width: 200, height: 200, crop: 'fill', quality: 'auto' }
    ],
    public_id: (req, file) => `brand-${Date.now()}-${file.originalname.replace(/\.[^/.]+$/, '')}`
  }
});

const uploadProducts = multer({
  storage: productStorage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG and PNG images are allowed'), false);
    }
  },
  
});

const uploadBrand = multer({
  storage: brandStorage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG and PNG images are allowed'), false);
    }
  },
});

module.exports = { uploadProducts, uploadBrand };