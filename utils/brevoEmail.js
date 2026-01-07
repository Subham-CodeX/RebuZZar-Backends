const axios = require('axios');

const sendBrevoEmail = async ({ to, subject, html }) => {
  try {
    await axios.post(
      'https://api.brevo.com/v3/smtp/email',
      {
        sender: {
          name: 'RebuZZar',
          email: process.env.EMAIL_FROM.match(/<(.+)>/)[1],
        },
        to: [{ email: to }],
        subject,
        htmlContent: html,
      },
      {
        headers: {
          'api-key': process.env.BREVO_API_KEY,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );
  } catch (err) {
    console.error(
      '❌ BREVO EMAIL ERROR:',
      err.response?.data || err.message
    );
  }
};

module.exports = sendBrevoEmail;
