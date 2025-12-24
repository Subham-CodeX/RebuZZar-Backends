// jobs/adExpiry.cron.js
const cron = require('node-cron');
const Advertisement = require('../models/Advertisement');

// Runs every day at midnight (00:00)
cron.schedule('0 0 * * *', async () => {
  try {
    const now = new Date();

    await Advertisement.updateMany(
      {
        status: 'approved',
        expiresAt: { $lte: now },
      },
      {
        $set: { status: 'expired' },
      }
    );

    console.log('⏳ Expired ads updated successfully');
  } catch (err) {
    console.error('❌ Error updating expired ads:', err);
  }
});
