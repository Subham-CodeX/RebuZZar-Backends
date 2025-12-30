// models/User.js
const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: { type: String, required: true },

    // ✅ WELCOME POPUP FLAG (BACKEND CONTROLLED)
    hasSeenWelcome: {
      type: Boolean,
      default: false, // 👈 first-time users only
    },

    avatar: {
      type: String,
      default: 'https://via.placeholder.com/150',
    },

    joinDate: { type: Date, default: Date.now },

    programType: {
      type: String,
      required: true,
      enum: ['Diploma', 'UG', 'PG', 'PhD'],
    },

    department: { type: String, required: true },

    year: { type: String, required: true },

    studentCode: { type: String },

    // Email verification
    isVerified: { type: Boolean, default: false },
    emailOTP: { type: String },
    emailOTPExpires: { type: Date },

    // Password reset
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },

    role: {
      type: String,
      enum: ['student', 'admin'],
      default: 'student',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', UserSchema);
