const User = require('../models/User');

exports.updateProfile = async (req, res) => {
  const disallowed = [
    'role',
    '_id',
    'email',
    'password',
    'resetPasswordToken',
    'resetPasswordExpires',
  ];

  disallowed.forEach(f => delete req.body[f]);

  const user = await User.findByIdAndUpdate(
    req.user.id,
    { $set: req.body },
    { new: true, runValidators: true }
  ).select('-password');

  if (!user) return res.status(404).json({ message: 'User not found' });
  res.json(user);
};

exports.updateAvatar = async (req, res) => {
  if (!req.file)
    return res.status(400).json({ message: 'Avatar file required' });

  const user = await User.findByIdAndUpdate(
    req.user.id,
    { avatar: req.file.path },
    { new: true }
  ).select('-password');

  res.json(user);
};
