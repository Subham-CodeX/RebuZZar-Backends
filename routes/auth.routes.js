// routes/auth.routes.js
const router = require('express').Router();
const passport = require('passport');
const rateLimiter = require('../middlewares/rateLimiter');

const authController = require('../controllers/auth.controller');

// Signup + OTP
router.post('/signup', authController.signup);
router.post('/verify-otp', authController.verifyOTP);

// Login
router.post('/login', rateLimiter, authController.login);

// Google OAuth
router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get(
  '/google/callback',
  passport.authenticate('google', { session: false }),
  authController.googleCallback
);

// Password reset
router.post('/forgot-password', rateLimiter, authController.forgotPassword);
router.post('/reset-password/:token', authController.resetPassword);

module.exports = router;
