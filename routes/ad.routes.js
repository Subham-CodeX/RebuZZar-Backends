// routes/ad.routes.js
const router = require('express').Router();
const auth = require('../middlewares/auth.middleware');
const adUpload = require('../middlewares/adUpload.middleware');

const adController = require('../controllers/ad.controller');

// User
router.post(
  '/create',
  auth,
  adUpload.fields([
    { name: 'images', maxCount: 5 },
    { name: 'paymentProof', maxCount: 1 },
  ]),
  adController.createAd
);

router.get('/my', auth, adController.getMyAds);
router.get('/public', adController.getPublicAds);
router.post(
  '/extend/:id',
  auth,
  adUpload.single('paymentProof'),
  adController.extendAd
);

module.exports = router;
