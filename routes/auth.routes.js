const router = require("express").Router();
const passport = require("passport");
const rateLimiter = require("../middlewares/rateLimiter");

const authController = require("../controllers/auth.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const User = require("../models/User");

// =======================
// Signup + OTP (UNCHANGED ✅)
// =======================
// 🔒 Rate limit signup to prevent email abuse
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
// ✅ Google Onboarding (NEW ✅)
// =======================
// Google user must verify OTP + complete profile after login
router.post("/google/send-otp", authMiddleware, authController.sendGoogleOTP);
router.post("/google/verify-otp", authMiddleware, authController.verifyGoogleOTP);
router.post(
  "/google/complete-profile",
  authMiddleware,
  authController.completeGoogleProfile
);

// =======================
// Get Current User (UPGRADED ✅)
// =======================
// 🔒 Block unverified users
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // ✅ OTP verification required for everyone (Email + Google)
    if (!user.isVerified) {
      return res.status(403).json({
        message: "Email not verified",
      });
    }

    // ✅ Google users also must complete profile
    if (user.isGoogleUser && !user.isProfileComplete) {
      return res.status(403).json({
        message: "Google profile not complete",
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
