const Advertisement = require('../models/Advertisement');

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

  const ad = await Advertisement.create({
    title,
    description,
    businessName,
    contactPhone,
    contactEmail,
    ownerId: req.user.id,
    paymentUPI,
    amountPaid: Number(amountPaid) || 0,
    requestedDuration: Number(requestedDuration) || 7,
    images,
    paymentProof,
    status: 'pending',
  });

  res.json({ success: true, ad });
};

exports.getMyAds = async (req, res) => {
  const ads = await Advertisement.find({ ownerId: req.user.id }).sort({
    createdAt: -1,
  });
  res.json({ success: true, ads });
};

exports.getPublicAds = async (req, res) => {
  const ads = await Advertisement.find({ status: 'approved' }).sort({
    approvedAt: -1,
  });
  res.json({ success: true, ads });
};

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
