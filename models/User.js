// models/User.js
const mongoose = require("mongoose");

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
      default: "https://via.placeholder.com/150",
    },

    joinDate: { type: Date, default: Date.now },

    /**
     * ✅ IMPORTANT UPGRADE FOR GOOGLE USERS
     * Email Signup users will still provide these during signup (so required ✅)
     * Google Signup users will fill these AFTER OTP verification (so required ❌)
     */
    programType: {
      type: String,
      required: false, // ✅ changed (Google will fill later)
      enum: ["Diploma", "UG", "PG", "PhD"],
    },

    department: {
      type: String,
      required: false, // ✅ changed (Google will fill later)
    },

    year: {
      type: String,
      required: false, // ✅ changed (Google will fill later)
    },

    studentCode: {
      type: String,
      default: "",
    },

    // ✅ Google Login Flags
    isGoogleUser: {
      type: Boolean,
      default: false,
    },

    // ✅ This means programType/department/year/studentCode completed
    isProfileComplete: {
      type: Boolean,
      default: false,
    },

    // ✅ Email verification (OTP) (SAME AS YOUR SYSTEM ✅)
    isVerified: { type: Boolean, default: false },
    emailOTP: { type: String },
    emailOTPExpires: { type: Date },

    // ✅ ✅ NEW: Phone verification (MSG91 OTP)
    phoneNumber: { type: String, default: "" },
    isPhoneVerified: { type: Boolean, default: false },

    // ✅ ✅ NEW: Fully Verified (Email Verified + Phone Verified)
    isFullyVerified: { type: Boolean, default: false },

    // ✅ Password reset (unchanged)
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },

    role: {
      type: String,
      enum: ["student", "admin"],
      default: "student",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", UserSchema);
