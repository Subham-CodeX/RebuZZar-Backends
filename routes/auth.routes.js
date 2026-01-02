const router = require('express').Router();
const passport = require('passport');
const rateLimiter = require('../middlewares/rateLimiter');

const authController = require('../controllers/auth.controller');
const authMiddleware = require('../middlewares/auth.middleware');

// =======================
// Signup + OTP
// =======================
router.post('/signup', authController.signup);
router.post('/verify-otp', authController.verifyOTP);

// =======================
// Email Login
// =======================
router.post('/login', rateLimiter, authController.login);

// email logout for admin
// router.post('/logout', authController.logout);

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
router.get('/me', authMiddleware, async (req, res) => {
  const user = await require('../models/User')
    .findById(req.user.id)
    .select('-password');

  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  res.json({ user });
});

// =======================
// Password Reset
// =======================
router.post('/forgot-password', rateLimiter, authController.forgotPassword);
router.post('/reset-password/:token', authController.resetPassword);

module.exports = router;
