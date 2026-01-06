const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const validator = require('validator');

// =======================
// MAIL TRANSPORTER (GLOBAL)
// =======================
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT) || 465,
  secure: process.env.EMAIL_SECURE === 'true' || Number(process.env.EMAIL_PORT) === 465,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// =======================
// SIGNUP
// =======================
exports.signup = async (req, res) => {
  try {
    const { name, email, password, programType, department, year, studentCode } = req.body;

    const universityDomain =
      process.env.UNIVERSITY_DOMAIN || '@brainwareuniversity.ac.in';

    if (!email || !validator.isEmail(email) || !email.endsWith(universityDomain)) {
      return res.status(400).json({ message: 'Invalid university email' });
    }

    if (!name || !password || !programType || !department || !year) {
      return res.status(400).json({ message: 'All required fields are required.' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: 'Account with this email already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedOTP = crypto.createHash('sha256').update(otp).digest('hex');

    // 🔴 DO NOT SAVE USER YET
    const user = new User({
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
    });

    // ✅ SEND EMAIL FIRST
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: email,
      subject: 'Verify your RebuZZar Account',
      html: `
        <h2>Email Verification</h2>
        <p>Your OTP is:</p>
        <h1>${otp}</h1>
        <p>OTP expires in 10 minutes.</p>
      `,
    });

    // ✅ SAVE ONLY AFTER EMAIL SUCCESS
    await user.save();

    res.status(201).json({
      message: 'OTP sent to email',
      userId: user._id,
    });

  } catch (err) {
    console.error('SIGNUP ERROR:', err);
    res.status(500).json({
      message: 'Signup failed. Please try again later.',
    });
  }
};

// =======================
// VERIFY OTP
// =======================
exports.verifyOTP = async (req, res) => {
  try {
    const { userId, otp } = req.body;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (!user.emailOTP || user.emailOTPExpires < Date.now()) {
      return res.status(400).json({ message: 'OTP expired' });
    }

    const hashedOTP = crypto.createHash('sha256').update(otp).digest('hex');
    if (hashedOTP !== user.emailOTP) {
      return res.status(400).json({ message: 'Invalid OTP' });
    }

    user.isVerified = true;
    user.emailOTP = undefined;
    user.emailOTPExpires = undefined;
    await user.save();

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: '7d',
    });

    const { password, ...userData } = user.toObject();

    res.json({
      message: 'Email verified successfully',
      token,
      user: userData,
    });

  } catch (err) {
    console.error('VERIFY OTP ERROR:', err);
    res.status(500).json({ message: 'Verification failed' });
  }
};

// =======================
// LOGIN
// =======================
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (!user.isVerified) {
      return res.status(403).json({
        message: 'Please verify your email before logging in',
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: '7d',
    });

    const { password: _, ...userData } = user.toObject();

    res.json({
      message: 'Login successful',
      token,
      user: userData,
    });

  } catch (err) {
    console.error('LOGIN ERROR:', err);
    res.status(500).json({ message: 'Login failed' });
  }
};

// =======================
// GOOGLE LOGIN CALLBACK
// =======================
exports.googleCallback = (req, res) => {
  if (!req.user) {
    return res.redirect(`${process.env.FRONTEND_URL}?error=unauthorized`);
  }

  const token = jwt.sign({ id: req.user._id }, process.env.JWT_SECRET, {
    expiresIn: '7d',
  });

  const frontendURL = process.env.FRONTEND_URL || 'http://localhost:5173';

  res.redirect(`${frontendURL}/google-auth-success?token=${token}`);
};

// =======================
// FORGOT PASSWORD
// =======================
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !validator.isEmail(email)) {
      return res.json({ message: 'If account exists, link sent.' });
    }

    const user = await User.findOne({ email });
    if (!user) return res.json({ message: 'If account exists, link sent.' });

    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashed = crypto.createHash('sha256').update(rawToken).digest('hex');

    user.resetPasswordToken = hashed;
    user.resetPasswordExpires = Date.now() + 60 * 60 * 1000;
    await user.save();

    const link = `${process.env.FRONTEND_URL}/reset-password/${rawToken}`;

    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: email,
      subject: 'Reset Password',
      html: `<p>Click below to reset your password:</p><a href="${link}">Reset Password</a>`,
    });

    res.json({ message: 'If account exists, link sent.' });

  } catch (err) {
    console.error('FORGOT PASSWORD ERROR:', err);
    res.json({ message: 'If account exists, link sent.' });
  }
};

// =======================
// RESET PASSWORD
// =======================
exports.resetPassword = async (req, res) => {
  try {
    const hashed = crypto.createHash('sha256').update(req.params.token).digest('hex');

    const user = await User.findOne({
      resetPasswordToken: hashed,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired token' });
    }

    user.password = await bcrypt.hash(req.body.password, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ message: 'Password updated successfully' });

  } catch (err) {
    console.error('RESET PASSWORD ERROR:', err);
    res.status(500).json({ message: 'Password reset failed' });
  }
};
