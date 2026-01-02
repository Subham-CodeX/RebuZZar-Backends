const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const validator = require('validator');

// =======================
// SIGNUP
// =======================
exports.signup = async (req, res) => {
  const { name, email, password, programType, department, year, studentCode } = req.body;

  const universityDomain =
    process.env.UNIVERSITY_DOMAIN || '@brainwareuniversity.ac.in';

  if (!email || !validator.isEmail(email) || !email.endsWith(universityDomain)) {
    return res.status(400).json({ message: 'Invalid email' });
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
    hasSeenWelcome: false, // ✅ explicitly set
  });

  await user.save();

  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT) || 587,
    secure: process.env.EMAIL_SECURE === 'true',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  });

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: user.email,
    subject: 'Verify your RebuZZar Account',
    html: `<h1>${otp}</h1><p>OTP expires in 10 minutes</p>`,
  });

  res.status(201).json({
    message: 'OTP sent',
    userId: user._id,
  });
};

// =======================
// VERIFY OTP
// =======================
exports.verifyOTP = async (req, res) => {
  const { userId, otp } = req.body;

  const user = await User.findById(userId);
  if (!user) return res.status(404).json({ message: 'User not found' });

  if (user.emailOTPExpires < Date.now()) {
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
    message: 'Verified',
    token,
    user: userData, // ✅ includes hasSeenWelcome
  });
};

// =======================
// LOGIN
// =======================
exports.login = async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  if (!user) return res.status(401).json({ message: 'Invalid credentials' });

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });

  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
    expiresIn: '7d',
  });

  const { password: _, ...userData } = user.toObject();

  res.json({
    message: 'Login successful',
    token,
    user: userData, // ✅ frontend can check hasSeenWelcome
  });
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
  const { email } = req.body;
  if (!email || !validator.isEmail(email)) {
    return res.json({ message: 'If account exists, link sent.' });
  }

  const user = await User.findOne({ email });
  if (!user) return res.json({ message: 'If account exists, link sent.' });

  const rawToken = crypto.randomBytes(32).toString('hex');
  const hashed = crypto.createHash('sha256').update(rawToken).digest('hex');

  user.resetPasswordToken = hashed;
  user.resetPasswordExpires = Date.now() + 3600000;
  await user.save();

  const link = `${process.env.FRONTEND_URL}/reset-password/${rawToken}`;

  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT),
    secure: true,
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  });

  await transporter.sendMail({
    to: user.email,
    from: process.env.EMAIL_FROM,
    subject: 'Reset Password',
    html: `<a href="${link}">Reset</a>`,
  });

  res.json({ message: 'If account exists, link sent.' });
};

// =======================
// RESET PASSWORD
// =======================
exports.resetPassword = async (req, res) => {
  const hashed = crypto.createHash('sha256').update(req.params.token).digest('hex');

  const user = await User.findOne({
    resetPasswordToken: hashed,
    resetPasswordExpires: { $gt: Date.now() },
  });

  if (!user) return res.status(400).json({ message: 'Invalid token' });

  user.password = await bcrypt.hash(req.body.password, 10);
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();

  res.json({ message: 'Password updated' });
};
