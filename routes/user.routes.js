const router = require('express').Router();
const authMiddleware = require('../middlewares/auth.middleware');
const User = require('../models/User');

// =======================
// MARK WELCOME POPUP AS SEEN
// =======================
router.post('/mark-welcome-seen', authMiddleware, async (req, res) => {
  await User.findByIdAndUpdate(req.user.id, {
    hasSeenWelcome: true,
  });

  res.json({ success: true });
});

module.exports = router;
