const Advertisement = require('../models/Advertisement');
const User = require('../models/User');
const { sendMailSafe } = require('../utils/mailer');

/* =======================
   CREATE ADVERTISEMENT
======================= */

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

    const imageFiles = req.files?.images || [];
    if (imageFiles.length > 5) {
      return res.status(400).json({ message: 'Maximum 5 images allowed' });
    }

    const images = imageFiles.map(f => f.path);
    const paymentProof = req.files?.paymentProof?.[0]?.path || null;

    const owner = await User.findById(req.user.id).select(
      'name email studentCode programType department year'
    );
    if (!owner) return res.status(404).json({ message: 'User not found' });

    const ad = await Advertisement.create({
      title,
      description,
      businessName,
      contactPhone,
      contactEmail,

      ownerId: owner._id,
      ownerName: owner.name,
      ownerEmail: owner.email,

      paymentUPI,
      amountPaid: Number(amountPaid) || 0,
      requestedDuration: Number(requestedDuration) || 7,
      paymentProof,
      images,

      status: 'pending',
    });

    /* =======================
       SELLER EMAIL
    ======================= */
    await sendMailSafe({
      to: owner.email,
      subject: 'Advertisement submitted 📢',
      html: `
        <p>Hi ${owner.name},</p>
        <p>Your advertisement <b>${ad.title}</b> was uploaded successfully.</p>
        <p>It is currently under <b>admin verification</b>.</p>
        <p>You will be notified once it is approved or rejected.</p>
        <p>Thanks for advertising on <b>RebuZZar</b>!</p>
        <br/>
        <p>– RebuZZar Team</p>
      `,
    });

    /* =======================
       🔔 ADMIN ALERT EMAIL
    ======================= */
    await sendMailSafe({
      to: process.env.ADMIN_EMAIL,
      subject: 'New Advertisement Submitted (Admin Alert)',
      html: `
        <h2>New Advertisement Uploaded</h2>
        <p><b>Owner Name:</b> ${owner.name}</p>
        <p><b>Owner Email:</b> ${owner.email}</p>
        <p><b>Student Code:</b> ${owner.studentCode || 'N/A'}</p>
        <p><b>Program:</b> ${owner.programType}</p>
        <p><b>Department:</b> ${owner.department}</p>
        <p><b>Year:</b> ${owner.year}</p>
        <hr/>
        <p><b>Ad Title:</b> ${ad.title}</p>
        <p><b>Business Name:</b> ${businessName}</p>
        // <p><b>Amount Paid:</b> ₹${ad.amountPaid}</p>
        <p><b>Requested Duration:</b> ${ad.requestedDuration} days</p>
        <p><b>Status:</b> Pending</p>
      `,
    });

    res.status(201).json({ success: true, ad });
  } catch (err) {
    console.error('CREATE AD ERROR:', err);
    res.status(500).json({ message: 'Failed to create advertisement' });
  }
};

/* =======================
   GET USER ADS
======================= */

exports.getMyAds = async (req, res) => {
  const ads = await Advertisement.find({
    ownerId: req.user.id,
  }).sort({ createdAt: -1 });

  res.json({ success: true, ads });
};

/* =======================
   GET PUBLIC ADS
======================= */

exports.getPublicAds = async (req, res) => {
  const ads = await Advertisement.find({
    status: 'approved',
    expiresAt: { $gt: new Date() },
  }).sort({ approvedAt: -1 });

  res.json({ success: true, ads });
};

/* =======================
   GET SINGLE PUBLIC AD
======================= */

exports.getPublicAdById = async (req, res) => {
  try {
    const ad = await Advertisement.findById(req.params.id);

    if (!ad || ad.status !== 'approved') {
      return res.status(404).json({ message: 'Advertisement not found' });
    }

    res.json({ success: true, ad });
  } catch (err) {
    console.error('GET AD BY ID ERROR:', err);
    res.status(500).json({ message: 'Failed to fetch advertisement' });
  }
};



/* =======================
   EXTEND ADVERTISEMENT
======================= */

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
