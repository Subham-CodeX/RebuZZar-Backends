const router = require('express').Router();
const authMiddleware = require('../middlewares/auth.middleware');
const adminMiddleware = require('../middlewares/admin.middleware');
const adminEmailController = require('../controllers/adminBroadcastEmail.controller');

router.post(
  '/broadcast',
  authMiddleware,
  adminMiddleware,
  adminEmailController.sendAnnouncement
);

module.exports = router;
