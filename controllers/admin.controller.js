const Product = require('../models/Product');
const Advertisement = require('../models/Advertisement');
const User = require('../models/User');
const { sendMailSafe } = require('../utils/mailer');

/* =====================================================
   ADS (ADMIN)
===================================================== */

// Get pending ads
exports.getPendingAds = async (req, res) => {
  const ads = await Advertisement.find({ status: 'pending' })
    .populate('ownerId', 'name email');

  res.json({ success: true, ads });
};

// Approve advertisement
exports.approveAd = async (req, res) => {
  const ad = await Advertisement.findById(req.params.id).populate(
    'ownerId',
    'name email'
  );

  if (!ad) return res.status(404).json({ message: 'Ad not found' });

  ad.status = 'approved';
  ad.approvedAt = new Date();
  ad.expiresAt = new Date(
    Date.now() + (ad.requestedDuration || 7) * 86400000
  );

  await ad.save();

  // 📧 Approval email
  await sendMailSafe({
    to: ad.ownerId.email,
    subject: 'Advertisement approved 🎉',
    html: `
      <p>Hi ${ad.ownerId.name},</p>
      <p>Your advertisement <b>${ad.title}</b> has been approved.</p>
      <p>It is now live on <b>RebuZZar</b>.</p>
      <br/>
      <p>Thanks for advertising with us!</p>
    `,
  });

  res.json({ success: true, ad });
};

// Reject advertisement
exports.rejectAd = async (req, res) => {
  const ad = await Advertisement.findById(req.params.id).populate(
    'ownerId',
    'name email'
  );

  if (!ad) return res.status(404).json({ message: 'Ad not found' });

  ad.status = 'rejected';
  ad.adminNotes = req.body.reason || 'Rejected by admin';

  await ad.save();

  // 📧 Rejection email
  await sendMailSafe({
    to: ad.ownerId.email,
    subject: 'Advertisement rejected',
    html: `
      <p>Hi ${ad.ownerId.name},</p>
      <p>Your advertisement <b>${ad.title}</b> was rejected.</p>
      <p><b>Reason:</b> ${ad.adminNotes}</p>
      <br/>
      <p>You can edit and resubmit your advertisement.</p>
    `,
  });

  res.json({ success: true, ad });
};

/* =====================================================
   PRODUCTS (ADMIN – SINGLE SOURCE)
===================================================== */

// Get pending products
exports.getPendingProducts = async (req, res) => {
  const products = await Product.find({ status: 'pending' })
    .populate('sellerId', 'name email');

  res.json(products);
};

// Approve / reject product
exports.updateProductStatus = async (req, res) => {
  const { status, reason } = req.body;

  const product = await Product.findById(req.params.id).populate(
    'sellerId',
    'name email'
  );

  if (!product) return res.status(404).json({ message: 'Product not found' });

  product.status = status;
  await product.save();

  // 📧 Email to seller
  if (status === 'approved') {
    await sendMailSafe({
      to: product.sellerId.email,
      subject: 'Product approved 🎉',
      html: `
        <p>Hi ${product.sellerId.name},</p>
        <p>Your product <b>${product.title}</b> has been approved.</p>
        <p>It is now visible to all users on <b>RebuZZar</b>.</p>
        <br/>
        <p>Happy selling!</p>
      `,
    });
  } else if (status === 'rejected') {
    await sendMailSafe({
      to: product.sellerId.email,
      subject: 'Product rejected',
      html: `
        <p>Hi ${product.sellerId.name},</p>
        <p>Your product <b>${product.title}</b> was rejected.</p>
        <p><b>Reason:</b> ${reason || 'Not specified by admin'}</p>
        <br/>
        <p>You can update and resubmit your product.</p>
      `,
    });
  }

  res.json(product);
};
