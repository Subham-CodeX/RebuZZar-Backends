const axios = require("axios");
const User = require("../models/User");

// ✅ helper: Validate Indian 10-digit phone
const isValidPhone = (phone) => {
  return /^[6-9]\d{9}$/.test(phone);
};

// ✅ helper: Get MSG91 env safely (supports both key names)
const getMsg91Config = () => {
  const authkey =
    process.env.MSG91_AUTH_KEY || process.env.MSG91_AUTHKEY || "";
  const templateId = process.env.MSG91_TEMPLATE_ID || "";
  const sender =
    process.env.MSG91_SENDER_ID || process.env.MSG91_SENDER || "";

  return { authkey, templateId, sender };
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

    const { authkey, templateId, sender } = getMsg91Config();

    // ✅ ENV check (very important)
    if (!authkey || !templateId) {
      return res.status(500).json({
        message:
          "MSG91 config missing in backend (.env) - MSG91_AUTH_KEY / MSG91_TEMPLATE_ID required",
      });
    }

    // ✅ sender is recommended for India DLT OTP delivery
    if (!sender) {
      return res.status(500).json({
        message:
          "MSG91_SENDER_ID missing in backend (.env). Add 6 letter approved Sender ID from MSG91.",
      });
    }

    const mobile = `91${phoneNumber}`;

    // ✅ Send OTP using MSG91
    const response = await axios.post(
      "https://control.msg91.com/api/v5/otp",
      {
        template_id: templateId,
        mobile,
        sender, // ✅ Required for DLT delivery
        otp_length: 6,
        otp_expiry: 10, // minutes
      },
      {
        headers: {
          authkey,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("✅ MSG91 SEND OTP RESPONSE:", response.data);

    /**
     * MSG91 can return:
     * { type: "success", message: "OTP sent successfully" }
     * or other structure.
     */
    if (!response?.data) {
      return res.status(400).json({
        message: "❌ OTP sending failed (empty response from MSG91)",
      });
    }

    // ✅ Accept success from MSG91 in multiple formats
    const msgType = response.data.type;
    const msgMessage = response.data.message || "";

    const isSuccess =
      msgType === "success" ||
      msgMessage.toLowerCase().includes("otp sent") ||
      msgMessage.toLowerCase().includes("success");

    if (!isSuccess) {
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
    console.log(
      "SEND PHONE OTP ERROR:",
      err?.response?.data || err?.message || err
    );

    return res.status(500).json({
      message: "❌ Failed to send OTP",
      error: err?.response?.data || err?.message || err,
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

    // ✅ OTP must be 4-6 digits
    if (!otp || otp.length < 4 || otp.length > 6) {
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

    const { authkey } = getMsg91Config();
    if (!authkey) {
      return res.status(500).json({
        message: "MSG91_AUTH_KEY missing in backend (.env)",
      });
    }

    const mobile = `91${phoneNumber}`;

    // ✅ Verify OTP using MSG91
    const verifyRes = await axios.get(
      `https://control.msg91.com/api/v5/otp/verify?otp=${encodeURIComponent(
        otp
      )}&mobile=${encodeURIComponent(mobile)}`,
      {
        headers: { authkey },
      }
    );

    console.log("✅ MSG91 VERIFY OTP RESPONSE:", verifyRes.data);

    if (!verifyRes?.data) {
      return res.status(400).json({
        message: "❌ OTP verify failed (empty response from MSG91)",
      });
    }

    const verifyType = verifyRes.data.type;
    const verifyMessage = verifyRes.data.message || "";

    const isVerified =
      verifyType === "success" ||
      verifyMessage.toLowerCase().includes("verified") ||
      verifyMessage.toLowerCase().includes("success");

    if (!isVerified) {
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
    console.log(
      "VERIFY PHONE OTP ERROR:",
      err?.response?.data || err?.message || err
    );

    return res.status(500).json({
      message: "❌ Failed to verify OTP",
      error: err?.response?.data || err?.message || err,
    });
  }
};
