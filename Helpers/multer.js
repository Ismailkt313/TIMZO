const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require("../Config/cloudinary");

const productStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'timzo/products',
    allowed_formats: ['jpg', 'jpeg', 'png'],
    transformation: [
      { width: 440, height: 440, crop: 'fill', quality: 'auto' }
    ],
    public_id: (req, file) => `product-${Date.now()}-${file.originalname.replace(/\.[^/.]+$/, '')}`
  }
});

const brandStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'timzo/brands',
    allowed_formats: ['jpg', 'jpeg', 'png'],
    transformation: [
      { width: 200, height: 200, crop: 'fill', quality: 'auto' }
    ],
    public_id: (req, file) => `brand-${Date.now()}-${file.originalname.replace(/\.[^/.]+$/, '')}`
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPG, JPEG, and PNG images are allowed'), false);
  }
};

const limits = {
  fileSize: 10 * 1024 * 1024
};

const uploadProducts = multer({
  storage: productStorage,
  fileFilter,
  limits
});

const uploadBrand = multer({
  storage: brandStorage,
  fileFilter,
  limits
});

module.exports = { uploadProducts, uploadBrand };
