// middlewares/admin.middleware.js
const User = require('../models/User');

module.exports = async (req, res, next) => {
  const user = await User.findById(req.user.id);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ message: 'Admins only' });
  }
  next();
};
