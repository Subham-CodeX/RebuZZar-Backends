// controllers/ad.controller.js
const Advertisement = require('../models/Advertisement');
const User = require('../models/User');
const { sendMailSafe } = require('../utils/mailer');

// =======================
// CREATE ADVERTISEMENT
// =======================
exports.createAd = async (req, res) => {
  try {
    const {
      title,
      description,
      businessName,
      contactPhone,
      contactEmail,
      paymentUPI,
      amountPaid,
      requestedDuration,
    } = req.body;

    // 🛑 Backend safety: max 5 images
    const imageFiles = req.files?.images || [];
    if (imageFiles.length > 5) {
      return res
        .status(400)
        .json({ message: 'Maximum 5 images allowed' });
    }

    const images = imageFiles.map(f => f.path);
    const paymentProof = req.files?.paymentProof?.[0]?.path || null;

    // Fetch uploader
    const owner = await User.findById(req.user.id).select('name email');
    if (!owner)
      return res.status(404).json({ message: 'User not found' });

    const ad = await Advertisement.create({
      title,
      description,
      businessName,
      contactPhone,
      contactEmail,

      // Owner snapshot
      ownerId: owner._id,
      ownerName: owner.name,
      ownerEmail: owner.email,

      // Payment
      paymentUPI,
      amountPaid: Number(amountPaid) || 0,
      requestedDuration: Number(requestedDuration) || 7,
      paymentProof,

      // Images (ARRAY)
      images,

      status: 'pending',
    });

    // Email
    await sendMailSafe({
      to: owner.email,
      subject: 'Advertisement submitted 📢',
      html: `
        <p>Hi ${owner.name},</p>
        <p>Your advertisement <b>${ad.title}</b> was uploaded successfully.</p>
        <p>It is currently under <b>admin verification</b>.</p>
        <p>You will receive another email once it is approved or rejected.</p>
        <br/>
        <p>Thanks for advertising on <b>RebuZZar</b>!</p>
      `,
    });

    res.status(201).json({ success: true, ad });
  } catch (err) {
    console.error('CREATE AD ERROR:', err);
    res.status(500).json({ message: 'Failed to create advertisement' });
  }
};

// =======================
// GET USER ADS
// =======================
exports.getMyAds = async (req, res) => {
  const ads = await Advertisement.find({
    ownerId: req.user.id,
  }).sort({ createdAt: -1 });

  res.json({ success: true, ads });
};

// =======================
// GET PUBLIC ADS
// =======================
exports.getPublicAds = async (req, res) => {
  const ads = await Advertisement.find({
    status: 'approved',
    expiresAt: { $gt: new Date() },
  }).sort({ approvedAt: -1 });

  res.json({ success: true, ads });
};

// =======================
// EXTEND ADVERTISEMENT
// =======================
exports.extendAd = async (req, res) => {
  const ad = await Advertisement.findById(req.params.id);

  if (!ad) return res.status(404).json({ message: 'Ad not found' });
  if (String(ad.ownerId) !== String(req.user.id))
    return res.status(403).json({ message: 'Unauthorized' });

  ad.status = 'pending';
  ad.requestedDuration = Number(req.body.extraDays) || 7;
  ad.amountPaid += Number(req.body.amountPaid) || 0;

  if (req.file) ad.paymentProof = req.file.path;

  await ad.save();
  res.json({ success: true, ad });
};
