const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const validator = require('validator');

// =======================
// MAIL TRANSPORTER (SINGLE INSTANCE)
// =======================
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT) || 587,
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// =======================
// ADMIN MAIL HELPERS
// =======================
const sendAdminLoginAlert = async (user, loginMethod = 'Email/Password') => {
  if (process.env.ADMIN_ALERTS !== 'true') return;

  await transporter.sendMail({
    from: `"RebuZZar Admin Alerts" <${process.env.EMAIL_FROM}>`,
    to: process.env.ADMIN_EMAIL,
    subject: 'User Signed In - RebuZZar',
    html: `
      <h2>New User Login</h2>
      <p><b>Name:</b> ${user.name}</p>
      <p><b>Email:</b> ${user.email}</p>
      <p><b>Student Code:</b> ${user.studentCode || 'N/A'}</p>
      <p><b>Program:</b> ${user.programType}</p>
      <p><b>Department:</b> ${user.department}</p>
      <p><b>Year:</b> ${user.year}</p>
      <p><b>Login Method:</b> ${loginMethod}</p>
      <p><b>Login Time:</b> ${new Date().toLocaleString()}</p>
    `,
  });
};

const sendAdminLogoutAlert = async (user) => {
  if (process.env.ADMIN_ALERTS !== 'true') return;

  await transporter.sendMail({
    from: `"RebuZZar Admin Alerts" <${process.env.EMAIL_FROM}>`,
    to: process.env.ADMIN_EMAIL,
    subject: 'User Logged Out - RebuZZar',
    html: `
      <h2>User Logout</h2>
      <p><b>Name:</b> ${user.name}</p>
      <p><b>Email:</b> ${user.email}</p>
      <p><b>Student Code:</b> ${user.studentCode || 'N/A'}</p>
      <p><b>Program:</b> ${user.programType}</p>
      <p><b>Department:</b> ${user.department}</p>
      <p><b>Year:</b> ${user.year}</p>
      <p><b>Logout Time:</b> ${new Date().toLocaleString()}</p>
    `,
  });
};

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
    hasSeenWelcome: false,
  });

  await user.save();

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
    user: userData,
  });
};

// =======================
// LOGIN (ADMIN ALERT)
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

  await sendAdminLoginAlert(user, 'Email/Password');

  const { password: _, ...userData } = user.toObject();

  res.json({
    message: 'Login successful',
    token,
    user: userData,
  });
};

// =======================
// LOGOUT (ADMIN ALERT ADDED)
// =======================
exports.logout = async (req, res) => {
  try {
    // 1️⃣ Extract token manually
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.json({ message: 'Logout successful' }); // frontend-safe
    }

    const token = authHeader.split(' ')[1];

    // 2️⃣ Decode token manually
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 3️⃣ Get user from DB
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.json({ message: 'Logout successful' });
    }

    // 4️⃣ Send admin logout email
    await sendAdminLogoutAlert(user);

    // 5️⃣ Respond success
    res.json({ message: 'Logout successful' });
  } catch (err) {
    console.error('Logout error:', err.message);
    res.json({ message: 'Logout successful' }); // never block logout
  }
};

// =======================
// GOOGLE LOGIN CALLBACK (ADMIN ALERT)
// =======================
exports.googleCallback = async (req, res) => {
  if (!req.user) {
    return res.redirect(`${process.env.FRONTEND_URL}?error=unauthorized`);
  }

  const token = jwt.sign({ id: req.user._id }, process.env.JWT_SECRET, {
    expiresIn: '7d',
  });

  await sendAdminLoginAlert(req.user, 'Google OAuth');

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
