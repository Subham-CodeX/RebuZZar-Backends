const mongoose = require('mongoose');

/* =======================
   CART ITEM SCHEMA
======================= */
const CartItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    productTitle: {
      type: String,
      required: true,
    },
    productImage: {
      type: String,
      default: '',
    },
    price: {
      type: Number,
      required: true,
    },
    quantity: {
      type: Number,
      min: 1,
      default: 1,
    },

    // Seller snapshot
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    sellerName: {
      type: String,
      required: true,
    },
    sellerEmail: {
      type: String,
      required: true,
    },
  },
  { _id: false }
);

/* =======================
   CART SCHEMA
======================= */
const CartSchema = new mongoose.Schema(
  {
    buyerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true, // ✅ exactly ONE cart per user
      index: true,
    },

    buyerName: {
      type: String,
      required: true,
    },

    buyerEmail: {
      type: String,
      required: true,
    },

    items: {
      type: [CartItemSchema],
      default: [],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Cart', CartSchema);
