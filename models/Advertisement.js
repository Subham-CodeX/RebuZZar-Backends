const mongoose = require('mongoose');

const AdvertisementSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String },

    images: { type: [String], default: [] },

    // Business info
    businessName: { type: String, required: true },
    contactPhone: { type: String, required: true },
    contactEmail: { type: String, required: true },

    // 🔥 Advertiser (User Snapshot)
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    ownerName: {
      type: String,
      required: true,
    },
    ownerEmail: {
      type: String,
      required: true,
    },

    // Payment
    paymentUPI: { type: String },
    paymentProof: { type: String },
    amountPaid: { type: Number, default: 0 },

    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'expired'],
      default: 'pending',
    },

    adminNotes: { type: String },
    requestedDuration: { type: Number, default: 7 },

    approvedAt: { type: Date },
    expiresAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Advertisement', AdvertisementSchema);
