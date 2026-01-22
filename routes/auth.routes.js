const router = require("express").Router();
const passport = require("passport");
const rateLimiter = require("../middlewares/rateLimiter");

const authController = require("../controllers/auth.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const User = require("../models/User");

// ✅ NEW: Phone OTP Controller (MSG91)
const phoneOtpController = require("../controllers/phoneOtp.controller");

// =======================
// Signup + OTP (UNCHANGED ✅)
// =======================
router.post("/signup", rateLimiter, authController.signup);
router.post("/verify-otp", authController.verifyOTP);

// =======================
// Email Login (UNCHANGED ✅)
// =======================
router.post("/login", rateLimiter, authController.login);

// =======================
// Google OAuth (UNCHANGED ✅)
// =======================
router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

router.get(
  "/google/callback",
  passport.authenticate("google", {
    session: false,
    failureRedirect: `${process.env.FRONTEND_URL}?error=google_auth_failed`,
  }),
  authController.googleCallback
);

// =======================
// ✅ Google Onboarding
// =======================
router.post("/google/send-otp", authMiddleware, authController.sendGoogleOTP);
router.post("/google/verify-otp", authMiddleware, authController.verifyGoogleOTP);
router.post(
  "/google/complete-profile",
  authMiddleware,
  authController.completeGoogleProfile
);

// ✅ NEW: Set Password for Google User
router.post("/set-password", authMiddleware, authController.setPassword);

// =======================
// ✅ NEW: Phone OTP Verification (MSG91)
// =======================
router.post("/phone/send-otp", authMiddleware, phoneOtpController.sendPhoneOtp);
router.post(
  "/phone/verify-otp",
  authMiddleware,
  phoneOtpController.verifyPhoneOtp
);

// =======================
// Get Current User (UPGRADED ✅)
// =======================
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // ✅ Step 1: Email must be verified
    if (!user.isVerified) {
      return res.status(403).json({
        message: "Email not verified",
      });
    }

    // ✅ Step 2: Google profile must be complete (unchanged)
    if (user.isGoogleUser && !user.isProfileComplete) {
      return res.status(403).json({
        message: "Google profile not complete",
      });
    }

    // ✅ Step 3: Phone must be verified (NEW ✅)
    if (!user.isPhoneVerified) {
      return res.status(403).json({
        message: "Phone not verified",
        step: "PHONE_OTP_REQUIRED",
      });
    }

    // ✅ Step 4: Fully verified (extra safety)
    if (!user.isFullyVerified) {
      return res.status(403).json({
        message: "User not fully verified",
        step: "FULL_VERIFICATION_REQUIRED",
      });
    }

    res.json({ user });
  } catch (err) {
    console.error("ME ROUTE ERROR:", err);
    res.status(500).json({ message: "Failed to fetch user" });
  }
});

// =======================
// Password Reset (UNCHANGED ✅)
// =======================
router.post("/forgot-password", rateLimiter, authController.forgotPassword);
router.post("/reset-password/:token", authController.resetPassword);

module.exports = router;
