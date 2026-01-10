// routes/ad.routes.js
const router = require('express').Router();
const auth = require('../middlewares/auth.middleware');
const adUpload = require('../middlewares/adUpload.middleware');
const adController = require('../controllers/ad.controller');

// =======================
// USER ROUTES
// =======================

// Create advertisement
router.post(
  '/create',
  auth,
  adUpload.fields([
    { name: 'images', maxCount: 5 },
    { name: 'paymentProof', maxCount: 1 },
  ]),
  adController.createAd
);

// Get my advertisements
router.get('/my', auth, adController.getMyAds);

// Extend advertisement
router.post(
  '/extend/:id',
  auth,
  adUpload.single('paymentProof'),
  adController.extendAd
);

// =======================
// PUBLIC ROUTES
// =======================

// Get approved ads for public
router.get('/public', adController.getPublicAds);

// Get single approved advertisement (PUBLIC)
router.get('/:id', adController.getPublicAdById);


module.exports = router;
