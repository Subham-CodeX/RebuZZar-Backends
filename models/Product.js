// models/Product.js
const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },

    price: { type: Number, required: true },

    quantity: { type: Number, required: true, min: 0 },

    description: { type: String, required: true },

    imageUrl: { type: [String], required: true },

    category: { type: String, required: true },

    // Seller snapshot
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    sellerName: { type: String, required: true },

    sellerEmail: { type: String, required: true },

    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },

    postDate: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Product', ProductSchema);
