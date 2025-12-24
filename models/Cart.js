// models/Cart.js
const mongoose = require('mongoose');

const CartItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },

    title: { type: String, required: true },

    price: { type: Number, required: true },

    imageUrl: { type: [String], default: [] },

    quantity: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },

    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { _id: false }
);

const CartSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },

    items: [CartItemSchema],

    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Auto-update timestamp
CartSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Cart', CartSchema);
