const User = require('../models/User');
const { sendMailSafe } = require('../utils/mailer');

exports.sendAnnouncement = async (req, res) => {
  const { subject, message } = req.body;

  if (!subject || !message) {
    return res.status(400).json({ message: 'Subject and message required' });
  }

  // Fetch all verified users
  const users = await User.find(
    { isVerified: true },
    'email'
  );

  if (!users.length) {
    return res.status(400).json({ message: 'No users found' });
  }

  // Send email to each user (safe, controlled)
  for (const user of users) {
    await sendMailSafe({
      to: user.email,
      subject,
      html: `
        <h2>${subject}</h2>
        <p>${message}</p>
        <br/>
        <p>– RebuZZar Team</p>
      `,
    });
  }

  res.json({
    success: true,
    message: `Announcement sent to ${users.length} users`,
  });
};
