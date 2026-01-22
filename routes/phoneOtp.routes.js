const router = require("express").Router();
const authMiddleware = require("../middlewares/auth.middleware");

const {
  sendPhoneOtp,
  verifyPhoneOtp,
} = require("../controllers/phoneOtp.controller");

// ✅ logged-in users only
router.post("/send", authMiddleware, sendPhoneOtp);
router.post("/verify", authMiddleware, verifyPhoneOtp);

module.exports = router;
