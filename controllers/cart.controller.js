const Cart = require('../models/Cart');
const Product = require('../models/Product');

// =======================
// GET CART
// =======================
exports.getCart = async (req, res) => {
  let cart = await Cart.findOne({ userId: req.user.id });

  if (!cart) {
    cart = await Cart.create({
      userId: req.user.id,
      items: [],
    });
  }

  res.json(cart);
};

// =======================
// ADD TO CART
// =======================
exports.addToCart = async (req, res) => {
  try {
    // 🔒 HARD GUARD (prevents crash)
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ message: 'Invalid request body' });
    }

    const productId = req.body.productId;
    const quantity = Number(req.body.quantity) || 1;

    if (!productId) {
      return res.status(400).json({ message: 'productId is required' });
    }

    const product = await Product.findOne({
      _id: productId,
      status: 'approved',
      quantity: { $gt: 0 },
    });

    if (!product) {
      return res.status(404).json({ message: 'Product not available' });
    }

    let cart = await Cart.findOne({ userId: req.user.id });

    if (!cart) {
      cart = new Cart({
        userId: req.user.id,
        items: [],
      });
    }

    const index = cart.items.findIndex(
      item => item.productId.toString() === productId
    );

    if (index > -1) {
      cart.items[index].quantity += quantity;
    } else {
      cart.items.push({
        productId: product._id,
        title: product.title,
        price: product.price,
        imageUrl: product.imageUrl,
        quantity,
        sellerId: product.sellerId,
      });
    }

    await cart.save();

    // 🔁 IMPORTANT: match frontend expectation
    res.json({ cart });
  } catch (err) {
    console.error('ADD TO CART ERROR:', err);
    res.status(500).json({ message: 'Could not add item to cart' });
  }
};


// =======================
// UPDATE CART ITEM
// =======================
exports.updateCartItem = async (req, res) => {
  const cart = await Cart.findOne({ userId: req.user.id });
  if (!cart) return res.status(404).json({ message: 'Cart not found' });

  const item = cart.items.find(
    i => i.productId.toString() === req.params.productId
  );

  if (!item)
    return res.status(404).json({ message: 'Item not found in cart' });

  item.quantity = Number(req.body.quantity);

  // optional: auto-remove if quantity <= 0
  if (item.quantity <= 0) {
    cart.items = cart.items.filter(
      i => i.productId.toString() !== req.params.productId
    );
  }

  await cart.save();

  res.json({ cart }); // ✅ IMPORTANT
};


// =======================
// REMOVE CART ITEM
// =======================
exports.removeCartItem = async (req, res) => {
  const cart = await Cart.findOne({ userId: req.user.id });
  if (!cart) return res.status(404).json({ message: 'Cart not found' });

  cart.items = cart.items.filter(
    i => i.productId.toString() !== req.params.productId
  );

  await cart.save();

  res.json({ cart }); // ✅ IMPORTANT
};


// =======================
// CLEAR CART
// =======================
exports.clearCart = async (req, res) => {
  const cart = await Cart.findOne({ userId: req.user.id });
  if (!cart) return res.status(404).json({ message: 'Cart not found' });

  cart.items = [];
  await cart.save();

  res.json({ cart }); // ✅ IMPORTANT
};

