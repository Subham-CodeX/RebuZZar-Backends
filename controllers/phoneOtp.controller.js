const axios = require("axios");
const User = require("../models/User");

// ✅ helper: Validate Indian 10-digit phone
const isValidPhone = (phone) => {
  return /^[6-9]\d{9}$/.test(phone); // ✅ starts with 6/7/8/9 and total 10 digits
};

// ✅ SEND PHONE OTP (MSG91)
exports.sendPhoneOtp = async (req, res) => {
  try {
    const userId = req.user.id;
    const { phoneNumber } = req.body;

    if (!phoneNumber || !isValidPhone(phoneNumber)) {
      return res
        .status(400)
        .json({ message: "Enter a valid 10 digit Indian mobile number" });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    // ✅ must be email verified first
    if (!user.isVerified) {
      return res
        .status(403)
        .json({ message: "Email verification required first" });
    }

    // ✅ If already verified phone
    if (user.isPhoneVerified) {
      return res.json({ message: "Phone already verified ✅" });
    }

    // ✅ Send OTP using MSG91
    const response = await axios.post(
      "https://control.msg91.com/api/v5/otp",
      {
        template_id: process.env.MSG91_TEMPLATE_ID,
        mobile: `91${phoneNumber}`,
      },
      {
        headers: {
          authkey: process.env.MSG91_AUTH_KEY,
          "Content-Type": "application/json",
        },
      }
    );

    // ✅ MSG91 success response handling
    if (response?.data?.type !== "success") {
      return res.status(400).json({
        message: "❌ OTP sending failed",
        data: response.data,
      });
    }

    return res.json({
      message: "✅ OTP sent to mobile",
      data: response.data,
    });
  } catch (err) {
    console.log("SEND PHONE OTP ERROR:", err?.response?.data || err.message);
    return res.status(500).json({
      message: "❌ Failed to send OTP",
      error: err?.response?.data || err.message,
    });
  }
};

// ✅ VERIFY PHONE OTP (MSG91) + SAVE PHONE TO DB
exports.verifyPhoneOtp = async (req, res) => {
  try {
    const userId = req.user.id;
    const { phoneNumber, otp } = req.body;

    if (!phoneNumber || !isValidPhone(phoneNumber)) {
      return res
        .status(400)
        .json({ message: "Enter a valid 10 digit Indian mobile number" });
    }

    if (!otp || otp.length < 4) {
      return res.status(400).json({ message: "Valid OTP required" });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    // ✅ must be email verified first
    if (!user.isVerified) {
      return res
        .status(403)
        .json({ message: "Email verification required first" });
    }

    // ✅ Verify OTP using MSG91
    const verifyRes = await axios.get(
      `https://control.msg91.com/api/v5/otp/verify?otp=${otp}&mobile=91${phoneNumber}`,
      {
        headers: {
          authkey: process.env.MSG91_AUTH_KEY,
        },
      }
    );

    if (verifyRes?.data?.type !== "success") {
      return res.status(400).json({
        message: "❌ Invalid OTP",
        data: verifyRes.data,
      });
    }

    // ✅ prevent duplicate phone across accounts
    const fullPhone = `+91${phoneNumber}`;
    const existing = await User.findOne({ phoneNumber: fullPhone });

    if (existing && existing._id.toString() !== userId) {
      return res
        .status(409)
        .json({ message: "❌ This phone is already used by another account" });
    }

    // ✅ save phone and set verified flags
    user.phoneNumber = fullPhone;
    user.isPhoneVerified = true;

    // ✅ fully verified rule
    user.isFullyVerified = user.isVerified && user.isPhoneVerified;

    await user.save();

    // ✅ remove sensitive fields
    const { password, emailOTP, emailOTPExpires, ...safeUser } = user.toObject();

    return res.json({
      message: "✅ Phone verified successfully! You are now fully verified ✅",
      user: safeUser,
    });
  } catch (err) {
    console.log("VERIFY PHONE OTP ERROR:", err?.response?.data || err.message);
    return res.status(500).json({
      message: "❌ Failed to verify OTP",
      error: err?.response?.data || err.message,
    });
  }
};
