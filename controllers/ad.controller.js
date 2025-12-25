const Advertisement = require('../models/Advertisement');
const User = require('../models/User');
const { sendMailSafe } = require('../utils/mailer');

// =======================
// CREATE ADVERTISEMENT
// =======================
exports.createAd = async (req, res) => {
  console.log('BODY:', req.body);
  console.log('FILES:', req.files);
  console.log('USER:', req.user.id);

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

  const images = (req.files.images || []).map(f => f.path);
  const paymentProof = req.files.paymentProof?.[0]?.path || null;

  // 🔹 Fetch user for email
  const user = await User.findById(req.user.id).select('name email');
    if (!user) return res.status(404).json({ message: 'Seller not found' });
    const seller = await User.findById(req.user.id).select('name email');
    if (!seller) return res.status(404).json({ message: 'Seller not found' });

  const ad = await Advertisement.create({
    title,
    description,
    businessName,
    contactPhone,
    contactEmail,
    ownerId: req.user.id,
    sellerId: seller._id,
    sellerName: seller.name,
    sellerEmail: seller.email,
    paymentUPI,
    amountPaid: Number(amountPaid) || 0,
    requestedDuration: Number(requestedDuration) || 7,
    images,
    paymentProof,
    status: 'pending',
  });

  // =======================
  // AD SUBMISSION EMAIL
  // =======================
  await sendMailSafe({
    to: user.email,
    subject: 'Advertisement submitted 📢',
    html: `
      <p>Hi ${user.name},</p>
      <p>Your advertisement <b>${ad.title}</b> was uploaded successfully.</p>
      <p>It is currently under <b>admin verification</b>.</p>
      <p>You will receive another email once it is approved or rejected.</p>
      <br/>
      <p>Thanks for advertising on <b>RebuZZar</b>!</p>
    `,
  });

  res.json({ success: true, ad });
};

// =======================
// GET USER ADS
// =======================
exports.getMyAds = async (req, res) => {
  const ads = await Advertisement.find({ ownerId: req.user.id }).sort({
    createdAt: -1,
  });
  res.json({ success: true, ads });
};

// =======================
// GET PUBLIC ADS
// =======================
exports.getPublicAds = async (req, res) => {
  const ads = await Advertisement.find({ status: 'approved' }).sort({
    approvedAt: -1,
  });
  res.json({ success: true, ads });
};

// =======================
// EXTEND AD
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
