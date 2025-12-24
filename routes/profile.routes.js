// routes/profile.routes.js
const router = require('express').Router();
const auth = require('../middlewares/auth.middleware');
const upload = require('../middlewares/upload.middleware');
const profileController = require('../controllers/profile.controller');
const productController = require('../controllers/product.controller');

// EXISTING
router.put('/', auth, profileController.updateProfile);
router.post('/avatar', auth, upload.single('avatar'), profileController.updateAvatar);

// ✅ ADD THIS (IMPORTANT)
router.get('/products', auth, productController.getMyProducts);

module.exports = router;
