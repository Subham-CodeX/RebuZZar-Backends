const router = require('express').Router();
const passport = require('passport');
const rateLimiter = require('../middlewares/rateLimiter');

const authController = require('../controllers/auth.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const User = require('../models/User');

// =======================
// Signup + OTP
// =======================
// 🔒 Rate limit signup to prevent email abuse
router.post('/signup', rateLimiter, authController.signup);
router.post('/verify-otp', authController.verifyOTP);

// =======================
// Email Login
// =======================
router.post('/login', rateLimiter, authController.login);

// =======================
// Google OAuth
// =======================
router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get(
  '/google/callback',
  passport.authenticate('google', {
    session: false,
    failureRedirect: `${process.env.FRONTEND_URL}?error=google_auth_failed`,
  }),
  authController.googleCallback
);

// =======================
// Get Current User
// =======================
// 🔒 Block unverified users
router.get('/me', authMiddleware, async (req, res) => {
  const user = await User.findById(req.user.id).select('-password');

  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  if (!user.isVerified) {
    return res.status(403).json({
      message: 'Email not verified',
    });
  }

  res.json({ user });
});

// =======================
// Password Reset
// =======================
router.post('/forgot-password', rateLimiter, authController.forgotPassword);
router.post('/reset-password/:token', authController.resetPassword);

module.exports = router;
