// utils/mailer.js
const nodemailer = require('nodemailer');

const mailPort = Number(process.env.EMAIL_PORT) || 465;

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: mailPort,
  secure: process.env.EMAIL_SECURE === 'true' || mailPort === 465,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendMailSafe = async options => {
  try {
    await transporter.sendMail(options);
    return true;
  } catch (err) {
    console.error('📧 Email failed:', err?.message || err);
    return false;
  }
};

module.exports = {
  transporter,
  sendMailSafe,
};
