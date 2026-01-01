const transporter = require('../config/mailTransporter');

module.exports = async function sendAdminMail({ subject, html }) {
  if (process.env.ADMIN_ALERTS !== 'true') return;

  await transporter.sendMail({
    from: `"RebuZZar Admin Alerts" <${process.env.EMAIL_FROM}>`,
    to: process.env.ADMIN_EMAIL,
    subject,
    html,
  });
};
