// middlewares/adUpload.middleware.js
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary');

const adStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'rebuzzar-ads',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
  },
});

const adUpload = multer({
  storage: adStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB per image
  },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'), false);
    }
    cb(null, true);
  },
});

module.exports = adUpload;
