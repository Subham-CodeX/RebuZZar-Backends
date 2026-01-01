const router = require('express').Router();
const auth = require('../middlewares/auth.middleware');
const upload = require('../middlewares/upload.middleware');
const productController = require('../controllers/product.controller');

/* =======================
   PUBLIC
======================= */
router.get('/', productController.getAllProducts);
router.get('/category/:categoryName', productController.getByCategory);

/* =======================
   SELLER
======================= */
router.get('/profile/my-products', auth, productController.getMyProducts);
router.post('/', auth, upload.array('images', 5), productController.createProduct);

// ✅ EDIT PRODUCT (NEW & FIXED)
router.put('/:id', auth, productController.updateProductBySeller);

router.delete('/:id', auth, productController.deleteProduct);

/* =======================
   LAST (IMPORTANT)
======================= */
router.get('/:id', productController.getProductById);

module.exports = router;
