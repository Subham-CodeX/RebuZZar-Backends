// middlewares/auth.middleware.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');

module.exports = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader)
      return res.status(401).json({ message: 'Authorization token required' });

    const [type, token] = authHeader.split(' ');
    if (type !== 'Bearer' || !token)
      return res.status(401).json({ message: 'Invalid token format' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id);
    if (!user)
      return res.status(401).json({ message: 'User not found' });

    // ✅ SINGLE SOURCE OF TRUTH
    req.user = {
      id: user._id.toString(),
      role: user.role,
      email: user.email,
    };

    next();
  } catch (err) {
    res.status(401).json({ message: 'Unauthorized' });
  }
};
