const router = require('express').Router();
const auth = require('../middlewares/auth.middleware');
const admin = require('../middlewares/admin.middleware');
const adminController = require('../controllers/admin.controller');

// ADS
router.get('/ads/pending', auth, admin, adminController.getPendingAds);
router.post('/ads/approve/:id', auth, admin, adminController.approveAd);
router.post('/ads/reject/:id', auth, adminController.rejectAd);

// PRODUCTS (ONLY PLACE)
router.get('/products/pending', auth, admin, adminController.getPendingProducts);
router.put('/products/:id/status', auth, admin, adminController.updateProductStatus);

module.exports = router;
