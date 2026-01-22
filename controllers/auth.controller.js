const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const validator = require("validator");
const sendBrevoEmail = require("../utils/brevoEmail");

// =======================
// SIGNUP (UPGRADED ✅ ONLY FOR PHONE FLAGS)
// =======================
exports.signup = async (req, res) => {
  try {
    const { name, email, password, programType, department, year, studentCode } =
      req.body;

    const universityDomain =
      process.env.UNIVERSITY_DOMAIN || "@brainwareuniversity.ac.in";

    if (
      !email ||
      !validator.isEmail(email) ||
      !email.endsWith(universityDomain)
    ) {
      return res.status(400).json({ message: "Invalid university email" });
    }

    if (!name || !password || !programType || !department || !year) {
      return res
        .status(400)
        .json({ message: "All required fields are required." });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res
        .status(409)
        .json({ message: "Account with this email already exists." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedOTP = crypto.createHash("sha256").update(otp).digest("hex");

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      programType,
      department,
      year,
      studentCode,

      isVerified: false,
      emailOTP: hashedOTP,
      emailOTPExpires: Date.now() + 10 * 60 * 1000,
      hasSeenWelcome: false,

      isGoogleUser: false,
      isProfileComplete: true,

      // ✅ NEW (Mobile verification flags - MSG91)
      phoneNumber: "",
      isPhoneVerified: false,
      isFullyVerified: false,
    });

    sendBrevoEmail({
      to: email,
      subject: "Verify your RebuZZar Account",
      html: `
        <h2>Email Verification</h2>
        <p>Your OTP is:</p>
        <h1>${otp}</h1>
        <p>OTP expires in 10 minutes.</p>
      `,
    });

    res.status(201).json({
      message: "OTP sent to email",
      userId: user._id,
    });
  } catch (err) {
    console.error("SIGNUP ERROR:", err);
    res.status(500).json({
      message: "Signup failed. Please try again later.",
    });
  }
};

// =======================
// VERIFY OTP (UPGRADED ✅ FOR FULLY VERIFIED FLAG)
// =======================
exports.verifyOTP = async (req, res) => {
  try {
    const { userId, otp } = req.body;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (!user.emailOTP || user.emailOTPExpires < Date.now()) {
      return res.status(400).json({ message: "OTP expired" });
    }

    const hashedOTP = crypto.createHash("sha256").update(otp).digest("hex");
    if (hashedOTP !== user.emailOTP) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    user.isVerified = true;
    user.emailOTP = undefined;
    user.emailOTPExpires = undefined;

    if (!user.isGoogleUser) {
      user.isProfileComplete = true;
    }

    // ✅ NEW: Fully Verified = Email Verified + Phone Verified
    user.isFullyVerified = user.isVerified && user.isPhoneVerified;

    await user.save();

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    const { password, ...userData } = user.toObject();

    res.json({
      message: "Email verified successfully",
      token,
      user: userData,
    });
  } catch (err) {
    console.error("VERIFY OTP ERROR:", err);
    res.status(500).json({ message: "Verification failed" });
  }
};

// =======================
// LOGIN ✅ (UNCHANGED ✅)
// =======================
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    if (!user.isVerified) {
      return res.status(403).json({
        message: "Please verify your email before logging in",
      });
    }

    /**
     * ✅ IMPORTANT FIX:
     * Google user can login via Email system ONLY if they have set a real password.
     * If password is still "GOOGLE_AUTH" => block email login
     */
    if (user.isGoogleUser && user.password === "GOOGLE_AUTH") {
      return res.status(403).json({
        message:
          "This account was created using Google. Please login with Google OR set a password first.",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: "Invalid credentials" });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    const { password: _, ...userData } = user.toObject();

    res.json({
      message: "Login successful",
      token,
      user: userData,
    });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.status(500).json({ message: "Login failed" });
  }
};

// =======================
// GOOGLE LOGIN CALLBACK (UNCHANGED ✅)
// =======================
exports.googleCallback = (req, res) => {
  if (!req.user) {
    return res.redirect(`${process.env.FRONTEND_URL}?error=unauthorized`);
  }

  const token = jwt.sign({ id: req.user._id }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });

  const frontendURL =
    process.env.FRONTEND_URL || "https://rebuzzar-frontend.onrender.com";

  res.redirect(`${frontendURL}/google-auth-success?token=${token}`);
};

// ======================================================
// ✅ SEND OTP FOR GOOGLE USER (UNCHANGED ✅)
// ======================================================
exports.sendGoogleOTP = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (!user.isGoogleUser) {
      return res.status(400).json({ message: "Not a Google user" });
    }

    if (user.isVerified) {
      return res.json({ message: "Already verified" });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedOTP = crypto.createHash("sha256").update(otp).digest("hex");

    user.emailOTP = hashedOTP;
    user.emailOTPExpires = Date.now() + 10 * 60 * 1000;
    await user.save();

    sendBrevoEmail({
      to: user.email,
      subject: "Verify your RebuZZar Account (Google Login)",
      html: `
        <h2>Email Verification</h2>
        <p>Your OTP is:</p>
        <h1>${otp}</h1>
        <p>OTP expires in 10 minutes.</p>
      `,
    });

    res.json({ message: "OTP sent to email" });
  } catch (err) {
    console.error("SEND GOOGLE OTP ERROR:", err);
    res.status(500).json({ message: "Failed to send OTP" });
  }
};

// ======================================================
// ✅ VERIFY OTP FOR GOOGLE USER (UPGRADED ✅ FOR FULLY VERIFIED FLAG)
// ======================================================
exports.verifyGoogleOTP = async (req, res) => {
  try {
    const userId = req.user.id;
    const { otp } = req.body;

    if (!otp) return res.status(400).json({ message: "OTP is required" });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (!user.isGoogleUser) {
      return res.status(400).json({ message: "Not a Google user" });
    }

    if (!user.emailOTP || user.emailOTPExpires < Date.now()) {
      return res.status(400).json({ message: "OTP expired" });
    }

    const hashedOTP = crypto.createHash("sha256").update(otp).digest("hex");
    if (hashedOTP !== user.emailOTP) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    user.isVerified = true;
    user.emailOTP = undefined;
    user.emailOTPExpires = undefined;

    // ✅ NEW: Fully Verified = Email Verified + Phone Verified
    user.isFullyVerified = user.isVerified && user.isPhoneVerified;

    await user.save();

    res.json({ message: "Email verified successfully" });
  } catch (err) {
    console.error("VERIFY GOOGLE OTP ERROR:", err);
    res.status(500).json({ message: "OTP verification failed" });
  }
};

// ======================================================
// ✅ COMPLETE GOOGLE PROFILE (UNCHANGED ✅)
// ======================================================
exports.completeGoogleProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { programType, department, year, studentCode, name } = req.body;

    if (!programType || !department || !year) {
      return res.status(400).json({
        message: "programType, department and year are required",
      });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (!user.isGoogleUser) {
      return res.status(400).json({ message: "Not a Google user" });
    }

    if (!user.isVerified) {
      return res.status(403).json({
        message: "OTP verification required before completing profile",
      });
    }

    user.name = name || user.name;
    user.programType = programType;
    user.department = department;
    user.year = year;
    user.studentCode = studentCode || "";
    user.isProfileComplete = true;

    await user.save();

    const { password, ...userData } = user.toObject();

    res.json({
      message: "Profile completed successfully",
      user: userData,
    });
  } catch (err) {
    console.error("COMPLETE GOOGLE PROFILE ERROR:", err);
    res.status(500).json({ message: "Failed to complete profile" });
  }
};

// ======================================================
// ✅ SET PASSWORD (UNCHANGED ✅)
// ======================================================
exports.setPassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { password } = req.body;

    if (!password || password.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters" });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    // ✅ Only for Google users
    if (!user.isGoogleUser) {
      return res.status(400).json({
        message: "This account already uses email/password login.",
      });
    }

    // ✅ hash and store password
    const hashedPassword = await bcrypt.hash(password, 10);
    user.password = hashedPassword;

    // ✅ Now allow Email login too
    user.isGoogleUser = false;

    await user.save();

    res.json({
      message: "Password set successfully ✅ Now you can login using Email too.",
    });
  } catch (err) {
    console.error("SET PASSWORD ERROR:", err);
    res.status(500).json({ message: "Failed to set password" });
  }
};

// =======================
// FORGOT PASSWORD (UNCHANGED ✅)
// =======================
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !validator.isEmail(email)) {
      return res.json({ message: "If account exists, link sent." });
    }

    const user = await User.findOne({ email });
    if (!user) return res.json({ message: "If account exists, link sent." });

    const rawToken = crypto.randomBytes(32).toString("hex");
    const hashed = crypto.createHash("sha256").update(rawToken).digest("hex");

    user.resetPasswordToken = hashed;
    user.resetPasswordExpires = Date.now() + 60 * 60 * 1000;
    await user.save();

    const link = `${process.env.FRONTEND_URL}/reset-password/${rawToken}`;

    sendBrevoEmail({
      to: email,
      subject: "Reset Password",
      html: `<p>Click below to reset your password:</p><a href="${link}">Reset Password</a>`,
    });

    res.json({ message: "If account exists, link sent." });
  } catch (err) {
    console.error("FORGOT PASSWORD ERROR:", err);
    res.json({ message: "If account exists, link sent." });
  }
};

// =======================
// RESET PASSWORD (UNCHANGED ✅)
// =======================
exports.resetPassword = async (req, res) => {
  try {
    const hashed = crypto
      .createHash("sha256")
      .update(req.params.token)
      .digest("hex");

    const user = await User.findOne({
      resetPasswordToken: hashed,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    user.password = await bcrypt.hash(req.body.password, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ message: "Password updated successfully" });
  } catch (err) {
    console.error("RESET PASSWORD ERROR:", err);
    res.status(500).json({ message: "Password reset failed" });
  }
};
