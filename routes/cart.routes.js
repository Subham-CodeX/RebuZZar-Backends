// routes/cart.routes.js
const router = require('express').Router();
const auth = require('../middlewares/auth.middleware');

const cartController = require('../controllers/cart.controller');

router.get('/', auth, cartController.getCart);
router.post('/add', auth, cartController.addToCart);
router.put('/item/:productId', auth, cartController.updateCartItem);
router.delete('/item/:productId', auth, cartController.removeCartItem);
router.post('/clear', auth, cartController.clearCart);

module.exports = router;
