const Cart = require('../models/Cart');
const Product = require('../models/Product');
const User = require('../models/User');

// =======================
// GET CART
// =======================
exports.getCart = async (req, res) => {
  let cart = await Cart.findOne({ buyerId: req.user.id });

  if (!cart) {
    return res.json({
      buyerId: req.user.id,
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
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ message: 'Invalid request body' });
    }

    const { productId } = req.body;
    const quantity = Number(req.body.quantity) || 1;

    if (!productId) {
      return res.status(400).json({ message: 'productId is required' });
    }

    // Buyer
    const buyer = await User.findById(req.user.id).select('name email');
    if (!buyer) {
      return res.status(404).json({ message: 'Buyer not found' });
    }

    // Product + Seller
    const product = await Product.findOne({
      _id: productId,
      status: 'approved',
      quantity: { $gt: 0 },
    }).populate('sellerId', 'name email');

    if (!product) {
      return res.status(404).json({ message: 'Product not available' });
    }

    let cart = await Cart.findOne({ buyerId: buyer._id });

    if (!cart) {
      cart = new Cart({
        buyerId: buyer._id,
        buyerName: buyer.name,
        buyerEmail: buyer.email,
        items: [],
      });
    }

    const existingItem = cart.items.find(
      item => item.productId.toString() === product._id.toString()
    );

    if (existingItem) {
      existingItem.quantity += quantity;
    } else {
      cart.items.push({
        productId: product._id,
        productTitle: product.title,
        productImage: product.imageUrl?.[0] || '',
        price: product.price,
        quantity,

        sellerId: product.sellerId._id,
        sellerName: product.sellerId.name,
        sellerEmail: product.sellerId.email,
      });
    }

    await cart.save();

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
  const cart = await Cart.findOne({ buyerId: req.user.id });
  if (!cart) return res.status(404).json({ message: 'Cart not found' });

  const item = cart.items.find(
    i => i.productId.toString() === req.params.productId
  );

  if (!item)
    return res.status(404).json({ message: 'Item not found in cart' });

  const qty = Number(req.body.quantity);

  if (qty <= 0) {
    cart.items = cart.items.filter(
      i => i.productId.toString() !== req.params.productId
    );
  } else {
    item.quantity = qty;
  }

  await cart.save();
  res.json({ cart });
};

// =======================
// REMOVE CART ITEM
// =======================
exports.removeCartItem = async (req, res) => {
  const cart = await Cart.findOne({ buyerId: req.user.id });
  if (!cart) return res.status(404).json({ message: 'Cart not found' });

  cart.items = cart.items.filter(
    i => i.productId.toString() !== req.params.productId
  );

  await cart.save();
  res.json({ cart });
};

// =======================
// CLEAR CART
// =======================
exports.clearCart = async (req, res) => {
  const cart = await Cart.findOne({ buyerId: req.user.id });
  if (!cart) return res.status(404).json({ message: 'Cart not found' });

  cart.items = [];
  await cart.save();

  res.json({ cart });
};
