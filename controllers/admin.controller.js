const Product = require('../models/Product');
const Advertisement = require('../models/Advertisement');

// ADS
exports.getPendingAds = async (req, res) => {
  const ads = await Advertisement.find({ status: 'pending' })
    .populate('ownerId', 'name email');
  res.json({ success: true, ads });
};

exports.approveAd = async (req, res) => {
  const ad = await Advertisement.findById(req.params.id);
  ad.status = 'approved';
  ad.approvedAt = new Date();
  ad.expiresAt = new Date(Date.now() + ad.requestedDuration * 86400000);
  await ad.save();
  res.json({ success: true, ad });
};

exports.rejectAd = async (req, res) => {
  const ad = await Advertisement.findById(req.params.id);
  ad.status = 'rejected';
  ad.adminNotes = req.body.reason || 'Rejected';
  await ad.save();
  res.json({ success: true, ad });
};

// PRODUCTS (ONLY SOURCE)
exports.getPendingProducts = async (req, res) => {
  const products = await Product.find({ status: 'pending' })
    .populate('sellerId', 'name email');
  res.json(products);
};

exports.updateProductStatus = async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ message: 'Not found' });

  product.status = req.body.status;
  await product.save();
  res.json(product);
};
