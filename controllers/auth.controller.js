const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const validator = require("validator");
const sendBrevoEmail = require("../utils/brevoEmail");

// =======================
// SIGNUP (UNCHANGED ✅)
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

      // ✅ Email signup always requires OTP
      isVerified: false,
      emailOTP: hashedOTP,
      emailOTPExpires: Date.now() + 10 * 60 * 1000,
      hasSeenWelcome: false,

      // ✅ Not Google user
      isGoogleUser: false,
      isProfileComplete: true, // ✅ email signup already completes profile
    });

    // 🔥 SEND OTP EMAIL (HTTP – NON BLOCKING)
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
// VERIFY OTP (UNCHANGED ✅)
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

    // ✅ Email signup profile already completed
    if (!user.isGoogleUser) {
      user.isProfileComplete = true;
    }

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
// LOGIN (UNCHANGED ✅)
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

    // ✅ If user is Google user, block email/password login
    if (user.isGoogleUser) {
      return res.status(403).json({
        message: "This account uses Google Login. Please sign in with Google.",
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
// GOOGLE LOGIN CALLBACK (UNCHANGED redirect ✅)
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

  // ✅ Frontend will check /me and redirect to complete profile if needed
  res.redirect(`${frontendURL}/google-auth-success?token=${token}`);
};

// ======================================================
// ✅ NEW: SEND OTP FOR GOOGLE USER (email OTP like normal)
// ======================================================
exports.sendGoogleOTP = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (!user.isGoogleUser) {
      return res.status(400).json({ message: "Not a Google user" });
    }

    // ✅ If already verified, don't resend
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

// =========================================
// ✅ NEW: VERIFY OTP FOR GOOGLE USER (email)
// =========================================
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
    await user.save();

    res.json({ message: "Email verified successfully" });
  } catch (err) {
    console.error("VERIFY GOOGLE OTP ERROR:", err);
    res.status(500).json({ message: "OTP verification failed" });
  }
};

// =================================================
// ✅ NEW: COMPLETE GOOGLE PROFILE (after OTP verify)
// =================================================
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

    // ✅ Block password reset for Google accounts
    if (user.isGoogleUser) {
      return res.json({
        message: "This account uses Google Login. Please sign in with Google.",
      });
    }

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

    // ✅ Block reset password for Google accounts
    if (user.isGoogleUser) {
      return res.status(400).json({
        message: "Google account password cannot be reset. Use Google login.",
      });
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
