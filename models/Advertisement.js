// models/Advertisement.js
const mongoose = require('mongoose');

const AdvertisementSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },

    description: { type: String, required: true },

    images: [{ type: String }], // Cloudinary URLs

    businessName: { type: String, required: true },

    contactPhone: { type: String, required: true },

    contactEmail: { type: String, required: true },

    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // Manual payment
    paymentUPI: { type: String },

    paymentProof: { type: String },

    amountPaid: { type: Number, default: 0 },

    // Workflow
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'expired'],
      default: 'pending',
    },

    requestedDuration: { type: Number, default: 7 },

    approvedAt: { type: Date },

    expiresAt: { type: Date },

    adminNotes: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Advertisement', AdvertisementSchema);
